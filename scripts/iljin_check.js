/**
 * scripts/iljin_check.js — 일진 회귀 (2026-10-09)
 *   ① 일간지(y,m,d) 가 manse.사주 의 일주(정오, 한국)와 같은가 — 1900~2070 무작위 400날
 *   ② 무작위 명식 200건 × 7일: 판정어가 다섯 가운데 하나, 첫말 표기, 금지어 없음, 한계 문장에 「일진을 다룬 대목은 없다」
 *   ③ 브리프줄이 「[일진 —」 으로 시작하고 7일
 */
const path = require('path');
const 뿌리 = path.join(__dirname, '..');
const J = require(path.join(뿌리, 'iljin'));
const M = require(path.join(뿌리, 'manse'));
const { interpret } = require(path.join(뿌리, 'interpret'));
let 검사 = 0, 문제 = 0; const 확인 = (이름, ok, 덧) => { 검사++; if (!ok) { 문제++; console.log('  실패', 이름, 덧 ?? ''); } };
let seed = 1009; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
// ①
let 어긋 = 0;
for (let i = 0; i < 400; i++) {
  const y = ri(1900, 2070), m = ri(1, 12), d = ri(1, 28);
  let s; try { s = M.사주(y, m, d, 12, 0); } catch (e) { continue; }
  const 일 = (s.사주 || '').split(' ')[2]; if (!일) continue;
  if (J.일간지(y, m, d).간지 !== 일) { 어긋++; if (어긋 < 3) console.log('  어긋남', y, m, d, J.일간지(y, m, d).간지, 일); }
}
확인('일간지 = manse 일주 (400날)', 어긋 === 0, 어긋);
// ②
const 간 = '甲乙丙丁戊己庚辛壬癸', 지 = '子丑寅卯辰巳午未申酉戌亥';
const 판정어 = new Set(Object.keys(J.첫말)); const 첫말들 = new Set(Object.values(J.첫말));
const 금지 = /신살|도화|역마|귀인|수명|사망|질병|상격|귀격|천격|승진합니다|합격합니다/;
let 위반 = 0;
for (let i = 0; i < 200; i++) {
  const 일간 = 간[ri(0, 9)], 일지 = 지[(ri(0, 5) * 2 + 간.indexOf(일간) % 2) % 12], 년간 = 간[ri(0, 9)], 년지 = 지[(ri(0, 5) * 2 + 간.indexOf(년간) % 2) % 12];
  const 월지 = 지[ri(0, 11)], 월두 = { 甲: 2, 己: 2, 乙: 4, 庚: 4, 丙: 6, 辛: 6, 丁: 8, 壬: 8, 戊: 0, 癸: 0 }[년간], 월간 = 간[(월두 + ((지.indexOf(월지) - 2 + 12) % 12)) % 10];
  const 시지 = 지[ri(0, 11)], 시두 = { 甲: 0, 己: 0, 乙: 2, 庚: 2, 丙: 4, 辛: 4, 丁: 6, 壬: 6, 戊: 8, 癸: 8 }[일간], 시간 = 간[(시두 + 지.indexOf(시지)) % 10];
  const m = { yeonGan: 년간, yeonJi: 년지, wolGan: 월간, wolJi: 월지, ilGan: 일간, ilJi: 일지, siGan: 시간, siJi: 시지, daysFromJeolip: ri(1, 29) };
  const r = interpret(m, { gender: i % 2 ? '여' : '남', 출생연도: 1980, 세운: false });
  const a = J.analyze(r, { 시작: { y: 2026, m: ri(1, 12), d: ri(1, 28) }, 날수: 7 });
  for (const d of a.날) if (!판정어.has(d.판정) || !첫말들.has(d.첫말) || 금지.test(JSON.stringify(d))) 위반++;
  if (!/일진\(하루 운\)을 다룬 대목은 없다/.test(a.한계[0])) 위반++;
}
확인('무작위 200건 × 7일 판정어·첫말·금지어·한계 문장', 위반 === 0, 위반);
// ③
{ const r = interpret({ yeonGan: '辛', yeonJi: '巳', wolGan: '丁', wolJi: '酉', ilGan: '辛', ilJi: '巳', siGan: '甲', siJi: '午', daysFromJeolip: 8 }, { gender: '여', 출생연도: 2001, 세운: false });
  const l = J.브리프줄(r); 확인('브리프줄 모양', l.startsWith('[일진 —') && (l.match(/\d\d\/\d\d\(/g) || []).length === 7, l.slice(0, 60)); }
console.log(`일진 검사: 검사 ${검사} · 문제 항목 ${문제}`);
process.exit(문제 ? 1 : 0);
