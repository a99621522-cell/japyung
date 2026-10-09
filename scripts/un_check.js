// un_check.js — 운(運) 삼자 관계 검사 (2026-10-07, 9차 · docs/PROMPTS.md 2번)
//   무작위 N건(기본 900)에서
//   (a) 대운 두 읽기(통합/분할 천간5·지지5) 산출 예외 0
//   (b) 통합·분할 판정이 뒤집히는 건수 표 — 사실 보고(실패 조건 아님)
//   (c) chwiun 死 key(국 키) 국별 hit — 하나도 안 걸린 키는 보고(실패 조건 아님, 3,000건으로 따로 센다)
//   (d) 세운 대운관계 기록 예외 0 · 26편 성격변격이 세운 점수에 들어가지 않았는가
//   (e) 운 판정(대운·세운)에 신살어 0
//   (f) 명례 국판별 fixture — 원문이 국 이름을 붙인 명례가 그 국 키로 가는가
//   사용: node scripts/un_check.js [N]   · 어느 하나라도 틀리면 exit 1
const path = require('path'); const 뿌리 = path.join(__dirname, '..');
const manse = require(path.join(뿌리, 'manse')); const { interpret } = require(path.join(뿌리, 'interpret'));
const chwiun = require(path.join(뿌리, 'chwiun')); const { judge } = require(path.join(뿌리, 'gyeokguk'));
const { FIXTURES } = require(path.join(뿌리, 'fixtures_zpjz'));
let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const 신살어 = /도화|역마|화개|천을귀인|백호|괴강|양인살|원진|귀문|공망/;
const 판정어 = new Set(['결이 크게 눌림', '결이 눌림', '뒤섞임', '결이 살아남', '결이 크게 살아남']);
const N = +(process.argv[2] || 900);
const 문제 = { 읽기예외:[], 대운관계예외:[], 세운성격변격점수:[], 신살어:[], 국fixture:[] };
const 표 = { 대운수:0, 보류:0, 갈림:0, 통합vs천간5:0, 통합vs지지5:0, 모두같음:0, 갈린명식:0 };
const 국hit = {}; const 국키전체 = []; for (const [격, 키들] of Object.entries(chwiun.死키)) for (const k of 키들) 국키전체.push(`${격}.${k}`);
let 예외 = 0;
for (let i = 0; i < N; i++) {
  const y = 1950 + Math.floor(rnd()*61), mo = 1+Math.floor(rnd()*12), d = 1+Math.floor(rnd()*28), h = Math.floor(rnd()*24), mi = Math.floor(rnd()*60);
  const g = rnd() < 0.5 ? '남' : '여'; let ms, r;
  try {
    ms = manse.사주(y, mo, d, h, mi, { 성별: g }); const dw = manse.대운수(ms, g);
    r = interpret(ms.명식, { gender: g, 출생연도: y, daysToJeolgi: dw.날수, 세운시작: 2026, 세운개수: 4, 월운: false });
  } catch (e) { 문제.읽기예외.push(`${y}-${mo}-${d} ${h}:${mi} ${g} — ${e.message}`); 예외++; continue; }
  const tag = `${ms.사주} ${r.결론.격}/${r.결론.상신 ?? '-'}`;
  // (a)(b)
  let 갈린 = false;
  for (const u of (r.단계11_행운?.대운 ?? [])) {
    const k = u.읽기;
    // 상신 미지정으로 판정이 보류된 대운은 세 판정이 모두 같은 보류여야 한다
    const 보류 = u.길흉?.점수 == null;
    const 좋은판정 = p => 보류 ? p === u.길흉.판정 : 판정어.has(p);
    if (!k || !k.통합 || !k.분할 || !좋은판정(k.통합.판정) || !좋은판정(k.분할.천간5.판정) || !좋은판정(k.분할.지지5.판정) || !['분할','통합'].includes(k.머리))
      { 문제.읽기예외.push(tag + ' ' + u.간지); continue; }
    if (보류) { 표.보류++; continue; }
    표.대운수++;
    if (k.갈림) { 표.갈림++; 갈린 = true; }
    if (k.뒤집힘.includes('천간5')) 표.통합vs천간5++;
    if (k.뒤집힘.includes('지지5')) 표.통합vs지지5++;
    if (!k.갈림 && !k.뒤집힘.length) 표.모두같음++;
  }
  if (갈린) 표.갈린명식++;
  // (c)
  const rule = chwiun.lookup(r.결론.격, r.결론.상신, r.ctx);
  if (rule?.국키) { const key = `${chwiun.CHWIUN[r.결론.격] ? r.결론.격 : ({ 정재:'__財', 편재:'__財', 정인:'__印', 편인:'__印' })[r.결론.격]}.${rule.국키}`; 국hit[key] = (국hit[key] ?? 0) + 1; }
  // (d)
  for (const s of (r.단계11b_세운 ?? [])) {
    const k = s.대운관계;
    if (!k || !('합' in k) || !('충' in k) || !('육합' in k) || !('회국' in k) || !k.근거 || '점수' in k || '가감' in k) 문제.대운관계예외.push(tag + ' ' + s.연도);
    if (!s.성격변격 || s.성격변격.적용 !== false || s.길흉?.성격변격) 문제.세운성격변격점수.push(tag + ' ' + s.연도);
    if (!Array.isArray(s.비고) || !s.비고.some(x => /26편/.test(x))) 문제.대운관계예외.push(tag + ' ' + s.연도 + ' 비고 없음');
  }
  // (e)
  if (신살어.test(JSON.stringify(r.단계11_행운 ?? '')) || 신살어.test(JSON.stringify(r.단계11b_세운 ?? ''))) 문제.신살어.push(tag);
}
// (f) 명례 국판별 fixture — 원문이 국 이름을 붙인 명례 (33·35·37·41편 본문의 평 그대로)
const 국기대 = {
  '趙侍郎': '_살인',        // 33편 「有財用煞印者 … 趙侍郎命」
  '吳榜眼': '식인',         // 33편 「有用食而兼用印者 … 吳榜眼命」
  '平江伯': '식인',         // 33편 「或有暗官而去食護官 … 平江伯命」 — 取運은 財用食印으로 묶는다
  '무명(합살류관)': '_관살경투',   // 35편 「又有印而透兼官煞者，或合煞，或有制 … 辛亥、庚子、甲辰、乙亥」
  '무명(관살유제)': '_관살경투',   // 35편 「壬子、癸卯、丙子、己亥，此官煞有制也」
  '胡會元': '_대살',        // 37편 「若無印綬而單露偏官，只要無財 … 胡會元命」
  '劉提督': '_대살',        // 37편 「食神透煞 … 財先煞後，食以間之 … 劉提督命」
  '都統制': '_재인',        // 41편 「有傷官兼用財印者 … 財太重而帶印 … 都統制命」
  '一丞相': '_재인',        // 41편 「印太重而帶財 … 一丞相命」
  '蔡貴妃': '_살인',        // 41편 「有傷官用煞印者 … 蔡貴妃命」
  '常國公': null,           // 37편 「若不用財而就煞印」 — 인이 있어 食神帶煞이 아니라 食用煞印(상신 키)
  '孫布政': null,           // 35편 「有用煞而兼帶傷食者」 — __印.편관 조건절로 간다
  '張參政': null,           // 35편 「有印而透官者」 — 상신 키
  '婁參政': null,           // 45편 合財黨煞 — 건록 상신 편관, 국 키 없음
};
for (const [이름, 기대] of Object.entries(국기대)) {
  const f = FIXTURES.find(x => x.이름 === 이름); if (!f) { 문제.국fixture.push(이름 + ' 명례 없음'); continue; }
  const r = judge(f.m); const rule = chwiun.lookup(r.ctx.gyeok, r.상신, r.ctx);
  if ((rule?.국키 ?? null) !== 기대) 문제.국fixture.push(`${이름} ${f.명식} 기대 ${기대 ?? 'null'} → ${rule?.국키 ?? 'null'} (${r.ctx.gyeok}/${r.상신})`);
}
// g) 지나온 해(34차) — 과거 해 판정은 올해를 내는 함수와 같은 길이어야 한다: 지나온해 를 올해까지 늘려 낸 판정 = interpret 세운
문제.지나온해 = [];
{ const { 생년월일시로 } = require('../interpret'); const seun = require('../seun');
  for (const [y, mo, d, h] of [[1971, 9, 21, 21], [1984, 1, 25, 10], [1990, 6, 3, 4], [1958, 12, 30, 23]]) {
    const r = 생년월일시로({ 년: y, 월: mo, 일: d, 시: h, 분: 0, 성별: '남' });
    const 앞 = seun.지나온해(r, y, { 올해: 2031, 최대: 5 }).filter(s => s.연도 >= 2026), 지금 = (r.단계11b_세운 || []).filter(s => s.연도 < 2031);
    if (앞.length !== 지금.length || 앞.some((s, i) => s.길흉.판정 !== 지금[i].길흉.판정 || s.길흉.자평읽기.판정 !== 지금[i].길흉.자평읽기.판정)) 문제.지나온해.push(`${y}-${mo}-${d} ${h}시 지나온해 ↔ 세운 판정 다름`);
    const 과거 = seun.지나온해(r, y, { 올해: 2026 });
    if (!과거.length || 과거.some(s => s.나이 < 16 || s.연도 >= 2026 || s.거리 !== 2026 - s.연도)) 문제.지나온해.push(`${y} 범위·나이·거리`);
  } }
let 실패 = 0;
for (const [k, v] of Object.entries(문제)) { console.log(`  ${v.length ? '실패' : '통과'}  ${k} ${v.length}건${v.length ? ' — ' + v.slice(0,3).join(' / ') : ''}`); if (v.length) 실패++; }
console.log(`  [두 읽기 뒤집힘 표 — 사실 보고] 대운 ${표.대운수}개: 천간5↔지지5 갈림 ${표.갈림} · 통합↔천간5 어긋남 ${표.통합vs천간5} · 통합↔지지5 어긋남 ${표.통합vs지지5} · 모두 같은 결 ${표.모두같음} · 갈림이 하나라도 있는 명식 ${표.갈린명식}/${N - 예외} · 판정 보류(상신 미지정) 대운 ${표.보류}`);
console.log(`  [국 키 hit] ` + 국키전체.map(k => `${k}:${국hit[k] ?? 0}`).join(' ') + (국키전체.some(k => !국hit[k]) ? `  — 안 걸린 키: ${국키전체.filter(k => !국hit[k]).join(', ')}` : '  — 전부 도달'));
console.log(`무작위 ${N}건 · 문제 항목 ${실패}`);
if (실패) process.exit(1);
