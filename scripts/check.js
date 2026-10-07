/**
 * scripts/check.js — 올리기 전 점검 (GitHub Actions와 Claude Code 에이전트가 같이 쓴다)
 *
 *   node scripts/check.js
 *
 * 하는 일
 *   ① 엔진 모듈이 다 불러와지는가
 *   ② 시험 명식 둘로 브리프 네 갈래(상담·설명·문답·궁통)가 만들어지는가
 *   ③ 쉬운 말 층 — 상담 브리프 맨 끝에 규칙이 붙고, 모범 답안이 검사기 두 개를 통과하는가
 *   ④ 루트와 server/engine의 같은 이름 파일이 똑같은가 (Render는 server/ 폴더만 본다)
 *   ⑤ 궁통보감 회귀(verify_gungtong.js)
 *   ⑨ 운 삼자 관계(scripts/un_check.js, 2026-10-07 9차)
 *   ⑩ 세계 만세력(scripts/world_check.js, 2026-10-07 11차)
 * 하나라도 틀리면 종료 코드 1.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 엔진 = path.join(뿌리, 'server', 'engine');
const 실패 = [];
const 됨 = (이름) => console.log(`  통과  ${이름}`);
const 틀림 = (이름, 사유) => { 실패.push(`${이름}: ${사유}`); console.log(`  실패  ${이름} — ${사유}`); };
function 시험(이름, fn) { try { const r = fn(); r === false ? 틀림(이름, '조건 불충족') : 됨(이름); } catch (e) { 틀림(이름, String(e && e.message || e).slice(0, 200)); } }

// 루트와 server/engine이 달라도 되는 파일 — 이유를 적어 둔다. 고치면 여기서 지운다.
const 알려진차이 = {
  'manse.js': '루트는 KST 절입 보정판(246줄), server/engine은 옛판(174줄). 서버는 세운올해() 입춘 계산에만 쓴다 — 맞출지 결정 대기',
};

console.log('① 모듈 불러오기');
for (const m of ['interpret', 'haeseol', 'mundap', 'mundap_route', 'gemini', 'dapgeomsa', 'swiunmal', 'gungtong_jomun'])
  시험(m, () => { require(path.join(뿌리, m)); });

console.log('② 브리프 만들기');
const { interpret } = require(path.join(뿌리, 'interpret'));
const H = require(path.join(뿌리, 'haeseol'));
const M = require(path.join(뿌리, 'mundap'));
const SW = require(path.join(뿌리, 'swiunmal'));
const D = require(path.join(뿌리, 'dapgeomsa'));
const G = require(path.join(뿌리, 'gemini'));
const 명식들 = {
  '辛巳丁酉辛巳甲午 여': [{ yeonGan: '辛', yeonJi: '巳', wolGan: '丁', wolJi: '酉', ilGan: '辛', ilJi: '巳', siGan: '甲', siJi: '午', daysFromJeolip: 8 }, { gender: '여', 출생연도: 2001 }],
  '辛亥丁酉己酉乙亥 남': [{ yeonGan: '辛', yeonJi: '亥', wolGan: '丁', wolJi: '酉', ilGan: '己', ilJi: '酉', siGan: '乙', siJi: '亥', daysFromJeolip: 13 }, { gender: '남', 출생연도: 1971 }],
};
const 브리프 = {};
for (const [이름, [m, o]] of Object.entries(명식들)) {
  const r = interpret(m, o);
  시험(`${이름} 상담`, () => { 브리프[이름] = H.toLLMBrief(r, { ...o, 주제: '올해 재물운 어때' }); return 브리프[이름].includes(SW.머리.용어); });
  시험(`${이름} 설명`, () => H.toLLMBrief(r, { ...o, 주제: '반기는 것은 실물이라는 게 무슨 말이야' }).includes('설명 답의 쉬운 말 규칙'));
  시험(`${이름} 문답`, () => { const b = M.toMundapBrief(r, { ...o, 질문: '내년은요', 이력: [{ 질문: '올해', 답: '앞 답' }] }); return b.includes('쉬운 말 규칙') && !b.includes('〔예시 끝〕'); });
  시험(`${이름} 궁통`, () => { const b = H.궁통브리프(r, { ...o, 주제: '올해', 관법: '궁통보감' }); return b.includes('쉬운 말 규칙') && !b.includes('〔예시 끝〕') && !b.includes('다섯 머리말을 이 글자'); });
}

console.log('③ 쉬운 말 층');
시험('모범 답안이 두 검사기를 통과', () => {
  const [이름, [m, o]] = Object.entries(명식들)[1];
  const b = 브리프[이름]; const 줄 = b.split('\n');
  const i = 줄.findIndex(l => l.startsWith('**이 분야의 모범 답안')), j = 줄.findIndex(l => l.startsWith('〔예시 끝〕'));
  if (i < 0 || j < 0) throw new Error('모범 답안을 못 찾음');
  const 답 = 줄.slice(i + 1, j).join('\n');
  const v = D.검사(답, { 브리프: b, 모드: '상담' });
  if (!v.통과) throw new Error('답 검사 오류: ' + v.오류.map(x => x.규칙).join(','));
  const g = G.validate(답, interpret(m, o));
  if (!g.통과) throw new Error('gemini 검사: ' + JSON.stringify(g.문제).slice(0, 120));
});
시험('옛 말투 답은 걸린다', () => !D.검사('올해 丙午는 丙-辛 합으로 식신 辛을 갈무리합니다. 정리하면 채우는 해입니다.', { 모드: '상담' }).통과);
시험('문장 덜어내도 줄바꿈 보존', () => G.문제문장제거('▶ 한 줄로 말하면\n가. 도화가 있다.\n\n▶ 쉽게 풀어 보면\n나.', [{ 검출: ['도화'] }]).includes('\n\n▶ 쉽게'));

console.log('④ 루트 ↔ server/engine');
for (const f of fs.readdirSync(엔진).filter(f => f.endsWith('.js'))) {
  const 위 = path.join(뿌리, f);
  if (!fs.existsSync(위)) continue;
  const 같음 = fs.readFileSync(위, 'utf8') === fs.readFileSync(path.join(엔진, f), 'utf8');
  if (같음) continue;
  if (알려진차이[f]) console.log(`  알림  ${f} — ${알려진차이[f]}`);
  else 틀림(f, '루트와 server/engine이 다름 — 고친 쪽을 다른 쪽에 복사할 것');
}
for (const f of ['swiunmal.js', 'haeseol.js', 'mundap.js', 'dapgeomsa.js', 'gemini.js'])
  if (!fs.existsSync(path.join(엔진, f))) 틀림(f, 'server/engine에 없음');

console.log('⑤ 궁통보감 회귀');
시험('verify_gungtong', () => {
  const out = execFileSync('node', [path.join(뿌리, 'verify_gungtong.js')], { encoding: 'utf8' });
  return /표일치 6\/6/.test(out) && /25\/25/.test(out);
});

console.log('⑥ 무작위 명식 불변식 (scripts/fuzz_check.js)');
시험('fuzz_check 600건', () => {
  const out = execFileSync('node', [path.join(뿌리, 'scripts', 'fuzz_check.js'), '600'], { encoding: 'utf8' });
  return /문제 항목 0/.test(out);
});

console.log('⑦ 쉬운 말 층 오탐 재현 (scripts/easy_check.js)');
시험('easy_check', () => {
  const out = execFileSync('node', [path.join(뿌리, 'scripts', 'easy_check.js')], { encoding: 'utf8' });
  return !/^실패/m.test(out);
});

console.log('⑧ 중계 서버 시험 (scripts/server_check.js — 가짜 Gemini, 본문 초과·500·섹션 다시 쓰기·통계)');
시험('server_check', () => {
  const out = execFileSync('node', [path.join(뿌리, 'scripts', 'server_check.js')], { encoding: 'utf8', timeout: 20000 });
  return /전부 통과/.test(out);
});

console.log('⑨ 운 삼자 관계 (scripts/un_check.js — 대운 두 읽기·세운↔대운 사실 기록·死 key 국별 hit·명례 국 fixture)');
시험('un_check 900건', () => {
  const out = execFileSync('node', [path.join(뿌리, 'scripts', 'un_check.js'), '900'], { encoding: 'utf8', timeout: 20000 });
  return /문제 항목 0/.test(out);
});

console.log('⑩ 세계 만세력 (scripts/world_check.js — 한국 4,000건 불일치 0·미일중 각 200건 오프셋/년월주/진태양시 손계산)');
시험('world_check', () => {
  const out = execFileSync('node', [path.join(뿌리, 'scripts', 'world_check.js'), '200'], { encoding: 'utf8', timeout: 60000 });
  return /문제 항목 0/.test(out);
});

console.log(실패.length ? `\n실패 ${실패.length}건` : '\n전부 통과');
process.exit(실패.length ? 1 : 0);
