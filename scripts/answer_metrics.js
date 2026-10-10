/**
 * scripts/answer_metrics.js — 상담 답의 품질을 기계 지표로 잰다 (2026-10-09, 29차-4)
 *
 *   node scripts/answer_metrics.js --live  [--n 10] [--url 주소]     배포된 서버(/해설)에 평가 세트를 보내 잰다 (Gemini n회)
 *   node scripts/answer_metrics.js --local [--n 10]                  이 저장소 코드로 서버를 임시로 띄워 잰다 (GEMINI_API_KEY 필요, Gemini n회)
 *   node scripts/answer_metrics.js --dir docs/eval/answers/<날짜>      eval_answers.js 로 받아 둔 답을 다시 잰다 (Gemini 없음)
 *   공통: [--baseline docs/eval/answer_baseline.json] [--update] [--md 파일] [--json 파일] [--no-fail]
 *
 * 지표는 사람 평가표(docs/eval/README.md)의 세 항목에 맞춰 묶는다 — 기계가 사람 점수를 대신하지는 않는다.
 *   판정 타당성: 해마다 표 첫말 ↔ 엔진 세운 판정 어긋남, 표 밖 간지·연도
 *   근거 추적  : 세 책 근거 빠짐, 「이 답에 나온 말」 빠짐, 용어 풀이 경고
 *   읽기       : 문장당 전문어, 평균 문장 길이, 문장 한자 비율, 다시 쓰기(시도 2)
 *   금지 표현  : 하나라도 있으면 사람 평가표의 0점 규칙 — 흉단·육친 흉단·등급어·품행어·신살·파해원진·표시금지 원문·사건 단정
 * 판정(엔진)은 이 저장소의 interpret 로 다시 내 대조한다. 기준값보다 나빠지면 종료 1.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const 뿌리 = path.join(__dirname, '..');
const 인자 = process.argv.slice(2);
const 값 = (k, d) => { const i = 인자.indexOf(k); return i >= 0 && 인자[i + 1] && !인자[i + 1].startsWith('--') ? 인자[i + 1] : d; };
const 있음 = k => 인자.includes(k);

const interpret = require(path.join(뿌리, 'interpret'));
const haeseol = require(path.join(뿌리, 'haeseol'));
const D = require(path.join(뿌리, 'dapgeomsa'));
const SW = require(path.join(뿌리, 'swiunmal'));
const { cases } = require(path.join(뿌리, 'docs', 'eval', 'cases.json'));

const 머리 = ['▶ 한 줄로 말하면', '▶ 쉽게 풀어 보면', '▶ 왜 그렇게 보나요', '▶ 해마다 보면', '▶ 해 볼 만한 일', '▶ 이 답에 나온 말'];
const 금지규칙 = new Set(['흉단·단정', '육친 흉단', '등급어', '품행어', '신살', '파해원진', '표시금지 원문', '사건 단정']);
const 첫말들 = ['크게 열리는 해', '열리는 해', '두드러진 일이 적은 해', '크게 조심할 해', '지키는 해'];

function 몸of(c) { return { 명식: c.명식, 성별: c.성별, 출생연도: c.출생연도, 절기날수: c.명식.daysFromJeolip, 주제: c.주제 }; }

/** 답 하나를 잰다 — 엔진 판정·브리프는 이 저장소 코드로 다시 낸다 */
function 재기(c, 본문, 서버검사) {
  const opt = { gender: c.성별 === '여' ? '여' : '남', 출생연도: c.출생연도, daysToJeolgi: c.명식.daysFromJeolip, 주제: c.주제 };
  const r = interpret.interpret(c.명식, opt);
  const 브리프 = haeseol.toLLMBrief(r, opt);
  const 검 = D.검사(본문, { 브리프, 모드: '상담', 질문: c.주제, 궁통있음: /\[궁통보감 조건절 —/.test(브리프) });
  const 규칙 = {};
  for (const x of [...검.오류, ...검.경고]) 규칙[x.규칙] = (규칙[x.규칙] || 0) + 1;
  // 해마다 표 첫말 ↔ 엔진
  const 판 = new Map((r.단계11b_세운 || []).map(x => [String(x.연도), haeseol.해마다첫말[x.길흉.판정]]));
  let 표줄 = 0, 어긋 = 0, 밖해 = 0;
  for (const l of 본문.split('\n')) {
    const m = l.match(/^\s*\|\s*\**\s*(\d{4})년/); if (!m) continue; 표줄++;
    const 칸 = (l.split('|')[2] || '').replace(/\*/g, '').trim(); const 첫 = 첫말들.find(w => 칸.startsWith(w));
    if (!판.has(m[1])) 밖해++; else if (첫 && 첫 !== 판.get(m[1])) 어긋++;
  }
  // 읽기 — 표 줄·머리말·풀이 절을 뺀 문장
  const 풀이시작 = 본문.indexOf('▶ 이 답에 나온 말');
  const 몸글 = (풀이시작 >= 0 ? 본문.slice(0, 풀이시작) : 본문).split('\n').filter(l => !/^\s*\|/.test(l) && !/^\s*▶/.test(l)).join('\n');
  const 문장 = 몸글.split(/(?<=[.!?。])\s+|\n+/).map(s => s.replace(/^[-*\s]+/, '').trim()).filter(s => s.length >= 4);
  const 글자수 = 문장.reduce((a, s) => a + s.length, 0);
  const 한자 = (몸글.match(/[一-鿿]/g) || []).length;
  let 전문어 = 0; for (const s of 문장) { try { 전문어 += SW.쓴전문어(s).length; } catch (e) {} }
  return {
    id: c.id, 길이: 본문.length,
    머리말빠짐: 머리.filter(h => !본문.includes(h)).length,
    첫말어긋남: 어긋, 표밖해: 밖해, 표줄,
    오류: 검.오류.length, 경고: 검.경고.length,
    금지: Object.entries(규칙).filter(([k]) => 금지규칙.has(k)).reduce((a, [, v]) => a + v, 0),
    표밖간지연도: (규칙['표 밖 간지'] || 0) + (규칙['표 밖 연도'] || 0),
    세책빠짐: 규칙['세 책 근거'] ? 1 : 0,
    풀이빠짐: 본문.includes('▶ 이 답에 나온 말') ? 0 : 1,
    용어풀이경고: 규칙['용어 풀이'] || 0,
    문장수: 문장.length,
    평균문장길이: 문장.length ? 글자수 / 문장.length : 0,
    문장당전문어: 문장.length ? 전문어 / 문장.length : 0,
    한자비율: 글자수 ? 한자 / 글자수 : 0,
    다시씀: 서버검사 && (서버검사.시도 > 1 || 서버검사.다시씀) ? 1 : 0,
    규칙,
  };
}

/** 묶음 지표 — 사람 평가표 세 항목 + 금지 */
function 묶기(행) {
  const n = 행.length || 1, 합 = k => 행.reduce((a, x) => a + (x[k] || 0), 0), 평 = k => 합(k) / n;
  return {
    건수: 행.length,
    판정타당성: { 첫말어긋남: 합('첫말어긋남'), 표밖해: 합('표밖해'), 표밖간지연도: 합('표밖간지연도') },
    근거추적: { 세책빠짐: 합('세책빠짐'), 풀이빠짐: 합('풀이빠짐'), 용어풀이경고: 합('용어풀이경고'), 머리말빠짐: 합('머리말빠짐') },
    읽기: { 평균문장길이: +평('평균문장길이').toFixed(1), 문장당전문어: +평('문장당전문어').toFixed(3), 한자비율: +평('한자비율').toFixed(4), 다시쓰기율: +(합('다시씀') / n).toFixed(3), 평균길이: Math.round(평('길이')) },
    금지: 합('금지'),
    오류: 합('오류'), 경고: 합('경고'),
  };
}

/** 기준값과 견준다 — 나빠짐 목록 */
function 견주기(지금, 기준) {
  const 나쁨 = [], 표 = [];
  const 칸 = (묶, k, 지, 기, 큰게나쁨 = true, 여유 = 0) => {
    const 변 = 지 - 기; const 악 = 큰게나쁨 ? 변 > 여유 : 변 < -여유;
    표.push(`| ${묶} | ${k} | ${기} | ${지} | ${악 ? '나빠짐' : 변 === 0 ? '같음' : '나아짐'} |`);
    if (악) 나쁨.push(`${묶}·${k} ${기} → ${지}`);
  };
  // 건수가 다르면 합계는 건수로 나눠 견준다
  const 비 = (지금.건수 || 1) / (기준.건수 || 1);
  for (const [k, v] of Object.entries(지금.판정타당성)) 칸('판정 타당성', k, v, Math.round(기준.판정타당성[k] * 비));
  for (const [k, v] of Object.entries(지금.근거추적)) 칸('근거 추적', k, v, Math.round(기준.근거추적[k] * 비), true, Math.max(1, Math.round(0.1 * (지금.건수 || 1))));
  const 읽 = 지금.읽기, 기읽 = 기준.읽기;
  칸('읽기', '평균문장길이', 읽.평균문장길이, 기읽.평균문장길이, true, +(기읽.평균문장길이 * 0.1).toFixed(1));
  칸('읽기', '문장당전문어', 읽.문장당전문어, 기읽.문장당전문어, true, +(Math.max(0.02, 기읽.문장당전문어 * 0.15)).toFixed(3));
  칸('읽기', '한자비율', 읽.한자비율, 기읽.한자비율, true, +(Math.max(0.005, 기읽.한자비율 * 0.2)).toFixed(4));
  칸('읽기', '다시쓰기율', 읽.다시쓰기율, 기읽.다시쓰기율, true, 0.15);
  칸('금지 표현', '건수', 지금.금지, 0);   // 금지는 기준과 무관하게 0 이어야 한다
  return { 나쁨, 표 };
}

async function 서버로(주소, 고른) {
  const 행 = [];
  for (const c of 고른) {
    try {
      const res = await fetch(`${주소}/%ED%95%B4%EC%84%A4`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(몸of(c)), signal: AbortSignal.timeout(180000) });
      const 답 = await res.json();
      if (!답.성공) { console.log(c.id, '실패', 답.사유); 행.push({ id: c.id, 실패: true }); continue; }
      const x = 재기(c, String(답.본문 || ''), 답.검사); 행.push(x);
      console.log(c.id, `${x.길이}자 · 오류 ${x.오류} · 경고 ${x.경고} · 첫말 어긋남 ${x.첫말어긋남} · 금지 ${x.금지}`);
    } catch (e) { console.log(c.id, '오류', e.message); 행.push({ id: c.id, 실패: true }); }
    await new Promise(r => setTimeout(r, 1200));
  }
  return 행;
}

function 로컬서버() {
  // server_check.js 와 같은 방식 — 루트 엔진과 server.js 를 임시 폴더에 복사해 이 저장소 코드로 띄운다(진짜 Gemini)
  if (!process.env.GEMINI_API_KEY) { console.log('::warning::GEMINI_API_KEY 가 없어 --local 을 건너뜁니다'); return null; }
  const 임시 = fs.mkdtempSync(path.join(process.env.CLAUDE_SCRATCHPAD || os.tmpdir(), 'ganmyeong-metrics-'));
  fs.mkdirSync(path.join(임시, 'engine'));
  for (const f of fs.readdirSync(뿌리).filter(f => f.endsWith('.js'))) fs.copyFileSync(path.join(뿌리, f), path.join(임시, 'engine', f));
  fs.copyFileSync(path.join(뿌리, 'server', 'server.js'), path.join(임시, 'server.js'));
  process.env.RATE_LIMIT = '1000'; process.env.CACHE_TTL_H = '0';
  const { 서버 } = require(path.join(임시, 'server.js'));
  return new Promise(res => { const s = 서버.listen(0, '127.0.0.1', () => res({ s, 주소: `http://127.0.0.1:${s.address().port}` })); });
}

function 파일로(폴더, 고른) {
  const 행 = [];
  for (const c of 고른) {
    const f = path.join(폴더, `${c.id}.md`); if (!fs.existsSync(f)) continue;
    const 글 = fs.readFileSync(f, 'utf8'); const i = 글.indexOf('\n---\n');
    const 검사 = (() => { try { return JSON.parse((글.match(/검사: `(.*)`/) || [])[1] || 'null'); } catch (e) { return null; } })();
    행.push(재기(c, i >= 0 ? 글.slice(i + 5).trim() : 글, 검사));
  }
  return 행;
}

if (require.main === module) (async () => {
  const n = Number(값('--n', 있음('--dir') ? cases.length : 10));
  const 고른 = cases.slice(0, n);
  let 행 = [], 출처 = '', 로컬 = null;
  if (있음('--dir')) { 출처 = `저장된 답 ${값('--dir')}`; 행 = 파일로(path.resolve(값('--dir')), 고른); }
  else if (있음('--local')) { 로컬 = await 로컬서버(); if (!로컬) process.exit(0); 출처 = '이 저장소 코드(임시 서버)'; 행 = await 서버로(로컬.주소, 고른); }
  else { const 주소 = (값('--url', process.env.RELAY_URL || 'https://ganmyeong-relay.onrender.com')).replace(/\/$/, ''); 출처 = `배포 서버 ${주소}`; 행 = await 서버로(주소, 고른); }
  if (로컬) 로컬.s.close();
  const 잰 = 행.filter(x => !x.실패);
  const 지금 = { 날짜: new Date().toISOString().slice(0, 10), 출처, ...묶기(잰), 실패: 행.length - 잰.length };
  const md = [`### 답 품질 기계 지표 — ${지금.날짜}`, '', `${출처} · 평가 세트 앞 ${고른.length}건 중 ${잰.length}건 잼${지금.실패 ? ` (실패 ${지금.실패})` : ''}`, ''];
  md.push('| 묶음 | 지표 | 값 |', '|---|---|---|');
  for (const [묶, o] of [['판정 타당성', 지금.판정타당성], ['근거 추적', 지금.근거추적], ['읽기', 지금.읽기]]) for (const [k, v] of Object.entries(o)) md.push(`| ${묶} | ${k} | ${v} |`);
  md.push(`| 금지 표현 | 건수 | ${지금.금지} |`, `| 검사 | 오류·경고 | ${지금.오류}·${지금.경고} |`);
  const 기준파일 = path.resolve(값('--baseline', path.join(뿌리, 'docs', 'eval', 'answer_baseline.json')));
  let 나쁨 = [];
  if (있음('--update')) { fs.writeFileSync(기준파일, JSON.stringify(지금, null, 1) + '\n'); md.push('', `기준값을 ${path.relative(뿌리, 기준파일)} 에 새로 썼습니다.`); }
  else if (fs.existsSync(기준파일)) {
    const 기준 = JSON.parse(fs.readFileSync(기준파일, 'utf8'));
    const 견 = 견주기(지금, 기준); 나쁨 = 견.나쁨;
    md.push('', `#### 기준값(${기준.날짜}, ${기준.건수}건)과 견줌`, '', '| 묶음 | 지표 | 기준 | 지금 | |', '|---|---|---|---|---|', ...견.표);
    md.push('', 나쁨.length ? `**나빠진 지표 ${나쁨.length}개**: ${나쁨.join(' · ')}` : '나빠진 지표 없음');
  } else md.push('', '기준값 파일이 없습니다 — `--update` 로 먼저 만드세요.');
  md.push('', '<details><summary>답마다</summary>', '', '| id | 길이 | 오류 | 경고 | 첫말 어긋남 | 금지 | 문장당 전문어 |', '|---|---|---|---|---|---|---|',
    ...잰.map(x => `| ${x.id} | ${x.길이} | ${x.오류} | ${x.경고} | ${x.첫말어긋남} | ${x.금지} | ${x.문장당전문어.toFixed(2)} |`), '', '</details>');
  const 글 = md.join('\n'); console.log('\n' + 글);
  if (값('--md')) fs.writeFileSync(값('--md'), 글 + '\n');
  if (값('--json')) fs.writeFileSync(값('--json'), JSON.stringify({ 지금, 행: 잰 }, null, 1));
  if (나쁨.length && !있음('--no-fail')) process.exit(1);
})().catch(e => { console.log('::error::' + (e.stack || e)); process.exit(1); });

module.exports = { 재기, 묶기, 견주기 };
