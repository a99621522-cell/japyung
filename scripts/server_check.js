/**
 * scripts/server_check.js — 중계 서버(server/server.js)를 Gemini 없이 돌려 보는 시험 (2026-10-07)
 *
 *   node scripts/server_check.js
 *
 * 하는 일
 *   · 루트 엔진(*.js)과 server/server.js 를 임시 폴더에 복사해 **루트 판**으로 서버를 띄운다(server/engine 동기화와 무관)
 *   · globalThis.fetch 를 가짜 Gemini 로 바꾼다 — 첫 답에는 일부러 「매듭」을 한 줄 답에 넣고,
 *     섹션 다시 쓰기 요청에는 고친 답을 돌려준다
 *   · 확인: ① 본문 초과 → 400 JSON ② /해설 섹션 다시 쓰기 경로를 타고 채택되는가 ③ /문답이 신살 낱말을 거르는가
 *          ④ 예외 → 500 JSON(스택 없음) ⑤ /health 통계 셈
 * 명식·본문은 로그에 남기지 않는다. 종료 코드 0/1.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const 뿌리 = path.join(__dirname, '..');
const 임시 = fs.mkdtempSync(path.join(process.env.CLAUDE_SCRATCHPAD || os.tmpdir(), 'ganmyeong-server-'));
fs.mkdirSync(path.join(임시, 'engine'));
for (const f of fs.readdirSync(뿌리).filter(f => f.endsWith('.js'))) fs.copyFileSync(path.join(뿌리, f), path.join(임시, 'engine', f));
fs.copyFileSync(path.join(뿌리, 'server', 'server.js'), path.join(임시, 'server.js'));

process.env.GEMINI_API_KEY = 'fake-key';
process.env.RATE_LIMIT = '100';
delete process.env.ALLOW_ORIGIN;

// ── 가짜 Gemini ───────────────────────────────
const 상태 = { 모드: '사투리', 호출: [] };
function 모범답안(브리프) {
  const 줄 = 브리프.split('\n');
  const i = 줄.findIndex(l => l.startsWith('**이 분야의 모범 답안')), j = 줄.findIndex(l => l.startsWith('〔예시 끝〕'));
  if (i < 0 || j < 0) throw new Error('브리프에서 모범 답안을 못 찾음');
  return 줄.slice(i + 1, j).join('\n').trim();
}
let 마지막모범 = '';
const 진짜fetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('http://127.0.0.1')) return 진짜fetch(url, init);   // 시험이 서버를 부르는 것은 진짜로
  const 보낸 = JSON.parse(init.body).contents[0].parts[0].text;
  상태.호출.push({ 크기: 보낸.length, 섹션: 보낸.includes('[답 고쳐 쓰기') });
  let 답;
  if (보낸.includes('[답 고쳐 쓰기')) {
    // 섹션 다시 쓰기 요청 — 원래 답을 꺼내 걸린 문장만 뺀 것을 돌려준다
    const a = 보낸.indexOf('─── 원래 답 (여기부터) ───'), b = 보낸.indexOf('─── 원래 답 (여기까지) ───');
    답 = 보낸.slice(a + '─── 원래 답 (여기부터) ───'.length, b).trim().replace(/매듭을 짓는 해입니다\. ?/g, '').replace(/도화가 있어 인기가 많습니다\. ?/g, '');
  } else {
    마지막모범 = 모범답안(보낸);
    답 = 상태.모드 === '신살'
      ? 마지막모범.replace('▶ 한 줄로 말하면\n', '▶ 한 줄로 말하면\n도화가 있어 인기가 많습니다. ')
      : 마지막모범.replace('▶ 한 줄로 말하면\n', '▶ 한 줄로 말하면\n매듭을 짓는 해입니다. ');
  }
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 답 }] } }] }) };
};

const { 서버 } = require(path.join(임시, 'server.js'));
const haeseol = require(path.join(임시, 'engine', 'haeseol'));

const 명식 = { yeonGan: '辛', yeonJi: '亥', wolGan: '丁', wolJi: '酉', ilGan: '己', ilJi: '酉', siGan: '乙', siJi: '亥' };
const 몸기본 = { 명식, 성별: '남', 출생연도: 1971, 절기날수: 13 };
const 실패 = [];
const 확인 = (이름, 조건, 설명) => { console.log(`  ${조건 ? '통과' : '실패'}  ${이름}${조건 ? '' : ' — ' + (설명 || '')}`); if (!조건) 실패.push(이름); };

(async () => {
  const t0 = Date.now();
  await new Promise(r => 서버.listen(0, '127.0.0.1', r));
  const 주소 = `http://127.0.0.1:${서버.address().port}`;
  const 부름 = async (길, 몸, 날것) => {
    const res = await fetch(주소 + encodeURI(길), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 날것 || JSON.stringify(몸) });
    return { 상태: res.status, d: await res.json() };
  };

  console.log('① 본문 초과');
  { const r = await 부름('/해설', null, JSON.stringify({ ...몸기본, 주제: 'x'.repeat(25000) }));
    확인('400 JSON', r.상태 === 400 && r.d.성공 === false && r.d.사유 === '본문이 너무 큽니다', JSON.stringify(r)); }

  console.log('② /해설 — 한 줄 답 사투리 → 섹션 다시 쓰기');
  { 상태.모드 = '사투리'; 상태.호출 = [];
    const r = await 부름('/해설', { ...몸기본, 주제: '올해 재물운 어때' });
    const 검 = r.d.검사 || {};
    확인('200 성공', r.상태 === 200 && r.d.성공 === true, JSON.stringify({ 상태: r.상태, 성공: r.d.성공, 사유: r.d.사유 }));
    확인('첫 답이 「한 줄 답 사투리」에 걸림', (검.첫오류 || 검.오류 || []).some(x => String(x).startsWith('한 줄 답 사투리')), JSON.stringify(검.첫오류 || 검.오류));
    확인('섹션 다시 쓰기 경로', 검.다시쓰기 && 검.다시쓰기.방식 === '섹션', JSON.stringify(검.다시쓰기));
    확인('둘째 답 채택', 검.시도 === 2 && 검.다시씀 === true && 검.다시쓰기 && 검.다시쓰기.채택 === true, JSON.stringify({ 시도: 검.시도, 다시씀: 검.다시씀 }));
    확인('채택된 본문에 「매듭」 없음', !/매듭/.test(String(r.d.본문).split('▶ 쉽게')[0]));
    const 짧은 = 상태.호출.find(c => c.섹션), 긴 = 상태.호출.find(c => !c.섹션);
    확인('짧은 요청이 브리프보다 작음', 짧은 && 긴 && 짧은.크기 < 긴.크기 * 0.5, JSON.stringify(상태.호출));
    console.log(`     브리프 ${긴 && 긴.크기}자 → 섹션 다시 쓰기 요청 ${짧은 && 짧은.크기}자 (${짧은 && 긴 ? Math.round(짧은.크기 / 긴.크기 * 100) : '?'}%)`);
  }

  console.log('③ /문답 — 신살 낱말');
  { 상태.모드 = '신살';
    const r = await 부름('/문답', { ...몸기본, 질문: '올해 재물운 어때' });
    확인('도화가 본문에 없음', r.상태 === 200 && (!r.d.성공 || !/도화/.test(String(r.d.본문))), JSON.stringify({ 상태: r.상태, 성공: r.d.성공, 사유: r.d.사유 }));
    확인('가드가 신살을 잡음', Array.isArray(r.d.가드) && r.d.가드.includes('신살·여명 속설'), JSON.stringify(r.d.가드));
    상태.모드 = '사투리';
  }

  console.log('④ 예외 → 500');
  { const 원 = haeseol.궁통브리프; haeseol.궁통브리프 = () => { throw new Error('시험용 예외'); };
    const r = await 부름('/해설', { ...몸기본, 주제: '올해', 관법: '궁통보감' });
    haeseol.궁통브리프 = 원;
    확인('/해설 500 JSON · 사유만', r.상태 === 500 && r.d.성공 === false && /시험용 예외/.test(r.d.사유) && !/\n\s+at /.test(JSON.stringify(r.d)), JSON.stringify(r));
    const 원2 = haeseol.toLLMBrief; haeseol.toLLMBrief = () => { throw new Error('시험용 예외 2'); };
    const r2 = await 부름('/문답', { ...몸기본, 질문: '올해' });
    haeseol.toLLMBrief = 원2;
    확인('/문답 500 JSON · 사유만', r2.상태 === 500 && r2.d.성공 === false && /시험용 예외 2/.test(r2.d.사유) && !/\n\s+at /.test(JSON.stringify(r2.d)), JSON.stringify(r2));
  }

  console.log('⑤ /health 통계');
  { const h = await (await fetch(주소 + '/health')).json();
    const s = h.통계 || {};
    확인('요청 수', s.요청 && s.요청.해설 === 2 && s.요청.문답 === 2, JSON.stringify(s.요청));
    확인('본문 초과 1 · 예외 2', s.본문초과 === 1 && s.예외 === 2, JSON.stringify({ 본문초과: s.본문초과, 예외: s.예외 }));
    확인('시도 2 · 채택 둘째', s.시도2 >= 1 && s.채택둘째 >= 1 && s.다시쓰기 && s.다시쓰기.섹션 >= 1, JSON.stringify({ 시도2: s.시도2, 채택둘째: s.채택둘째, 다시쓰기: s.다시쓰기 }));
    확인('오류 규칙별', s.오류규칙 && s.오류규칙['한 줄 답 사투리'] >= 1, JSON.stringify(s.오류규칙));
    확인('가드 규칙별', s.가드 && s.가드['신살·여명 속설'] >= 1, JSON.stringify(s.가드));
    확인('통계에 명식·본문 없음', !JSON.stringify(s).includes('辛亥') && !JSON.stringify(s).includes('▶'));
    console.log('     통계', JSON.stringify(s));
  }

  서버.close();
  try { fs.rmSync(임시, { recursive: true, force: true }); } catch (e) {}
  console.log(`${실패.length ? '실패 ' + 실패.length + '건: ' + 실패.join(', ') : '전부 통과'} · ${Date.now() - t0}ms`);
  process.exit(실패.length ? 1 : 0);
})().catch(e => { console.log('실패 — ' + (e && e.stack || e)); try { 서버.close(); } catch (_) {} process.exit(1); });
