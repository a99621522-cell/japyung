// fuzz_check.js — 무작위 명식 600건으로 엔진 불변식을 본다 (2026-10-07 재점검에서 쓴 검사를 저장소에 둠)
//   예외 0 · 상신 === 격 0 · 운 판정에 신살어 0 · 得時 조후가 무정 흠으로 0 · 상신 십성이 취운 「기」에 든 것 0 ·
//   만세력 대운수 ↔ 행운 대운수 불일치 0 · 변화 후보에 비겁 0. 어느 하나라도 있으면 exit 1
const path = require('path'); const 뿌리 = path.join(__dirname, '..');
const manse = require(path.join(뿌리, 'manse')); const { interpret } = require(path.join(뿌리, 'interpret'));
let seed = 777; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const 신살어 = /도화|역마|화개|천을귀인|백호|괴강|양인살|원진|귀문|공망/;
const 群 = { 재:['정재','편재'], 인:['정인','편인'], 식상:['식신','상관'], 관살:['정관','편관'], 비겁:['비견','겁재'] };
const 속 = (s, g) => 群[g] ? 群[g].includes(s) : s === g;
const 문제 = { 예외:[], 상신격:[], 신살어:[], 득시무정:[], 상신기:[], 대운수:[], 변화비겁:[] };
const N = +(process.argv[2] || 600);
for (let i = 0; i < N; i++) {
  const y = 1950 + Math.floor(rnd()*61), mo = 1+Math.floor(rnd()*12), d = 1+Math.floor(rnd()*28), h = Math.floor(rnd()*24), mi = Math.floor(rnd()*60);
  const g = rnd() < 0.5 ? '남' : '여'; let ms, r;
  try {
    ms = manse.사주(y, mo, d, h, mi, { 성별: g }); const dw = manse.대운수(ms, g);
    r = interpret(ms.명식, { gender: g, 출생연도: y, daysToJeolgi: dw.날수, 세운: false });
  } catch (e) { 문제.예외.push(`${y}-${mo}-${d} ${h}:${mi} ${g} — ${e.message}`); continue; }
  const c = r.결론, tag = `${ms.사주} ${c.격}/${c.상신 ?? '-'}`;
  if (c.상신 && c.상신 === c.격) 문제.상신격.push(tag);
  const 운글 = JSON.stringify(r.단계11_행운 ?? '');
  if (신살어.test(운글)) 문제.신살어.push(tag);
  if (r.단계8_고저?.축?.유정?.흠?.some(x => /계절이 급한데/.test(x)) && r.ctx?.기후?.해소) 문제.득시무정.push(tag);
  const rule = r.단계11_행운?.취운조문;
  if (rule && c.상신 && Array.isArray(rule.기) && rule.기.some(k => 속(c.상신, k)) && !rule.원문) 문제.상신기.push(tag + ' 기=' + rule.기.join('·'));
  if (ms.대운 && r.단계11_행운 && ms.대운.대운수 !== r.단계11_행운.대운수) 문제.대운수.push(tag);
  if ((r.단계6_용신변화?.후보 ?? []).some(x => !x.채택 && ['비견','겁재'].includes(x.격))) 문제.변화비겁.push(tag);
}
let 실패 = 0;
for (const [k, v] of Object.entries(문제)) { console.log(`  ${v.length ? '실패' : '통과'}  ${k} ${v.length}건${v.length ? ' — ' + v.slice(0,3).join(' / ') : ''}`); if (v.length) 실패++; }
console.log(`무작위 ${N}건 · 문제 항목 ${실패}`);
if (실패) process.exit(1);
