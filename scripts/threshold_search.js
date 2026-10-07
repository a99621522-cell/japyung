// threshold_search.js — tonggeun.THRESH 임계값 격자 탐색 (2026-10-07)
//   점수: ① 명례 78건 격·상신·성패·조문 일치 수(합) ② 명례 패격/상신미현 수(적을수록) ③ 무작위 집합 상신미현 수(적을수록) ④ 무작위 패격 수(적을수록)
//   방법: 기본값에서 출발해 한 임계값씩 범위를 훑어 점수가 **엄격히** 오르면 바꾸는 좌표 오름을 수렴할 때까지 반복(전체 격자는 12차원이라 불가).
//   그리고 임계값마다 「명례 점수가 최대로 유지되는 구간」을 민감도 표로 찍는다.
//   기본값을 바꾸는 일은 사람이 한다 — 이 스크립트는 바꾸지 않고 보고만 한다.
//   사용: node scripts/threshold_search.js [무작위 건수=600]
const path = require('path'); const 뿌리 = path.join(__dirname, '..');
const { THRESH } = require(path.join(뿌리, 'tonggeun'));
const { judge } = require(path.join(뿌리, 'gyeokguk'));
const { FIXTURES } = require(path.join(뿌리, 'fixtures_zpjz'));
const { EXPECT } = require(path.join(뿌리, 'fixtures_zpjz_expect'));
const manse = require(path.join(뿌리, 'manse'));

const N = +(process.argv[2] || 600);
let seed = 777; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const 무작위 = [];
for (let i = 0; i < N; i++) {
  const y = 1950 + Math.floor(rnd()*61), mo = 1+Math.floor(rnd()*12), d = 1+Math.floor(rnd()*28), h = Math.floor(rnd()*24), mi = Math.floor(rnd()*60);
  try { const ms = manse.사주(y, mo, d, h, mi, { 성별: '남' }); 무작위.push({ ...ms.명식, daysFromJeolip: 15 }); } catch {}
}
const 같은격 = (기대, 실제) => 기대 === 실제 || (기대 === '재' && /재$/.test(실제)) || (기대 === '인' && /인$/.test(실제)) || (기대 === '건록' && ['건록','월겁'].includes(실제));
const 목록 = x => x == null ? [null] : Array.isArray(x) ? x : [x];

function 점수() {
  let 일치 = 0, 명례패 = 0;
  for (const f of FIXTURES) {
    let r; try { r = judge(f.m); } catch { continue; }
    const e = EXPECT[f.이름]; const 전체 = new Set((r.조문?.전체 ?? []).map(j => j.id));
    if (같은격(f.격, r.격)) 일치++;
    if (목록(e.상신).includes(r.상신 ?? null)) 일치++;
    if (목록(e.성패).includes(r.결론)) 일치++;
    if (e.조문.every(id => 전체.has(id))) 일치++;
    if (['패격','상신미현'].includes(r.결론)) 명례패++;
  }
  let 미현 = 0, 패 = 0;
  for (const m of 무작위) { let r; try { r = judge(m); } catch { 미현++; continue; } if (r.결론 === '상신미현') 미현++; if (r.결론 === '패격') 패++; }
  return { 일치, 명례패, 미현, 패 };
}
const 비교 = (a, b) => (a.일치 - b.일치) || (b.명례패 - a.명례패) || (b.미현 - a.미현) || (b.패 - a.패);   // >0 이면 a 가 낫다
const 표시 = s => `명례 일치 ${s.일치}/312 · 명례 패 ${s.명례패} · 무작위 상신미현 ${s.미현} · 패격 ${s.패}`;

const 범위 = {
  인경:[1.5,1.75,2.0,2.25,2.5], 인중:[2.0,2.25,2.5,2.75,3.0], 식상왕:[1.0,1.25,1.5,1.75,2.0], 관살중:[1.5,1.75,2.0,2.25,2.5],
  관살유:[1.0,1.25,1.5,1.75,2.0], 신강:[0.4,0.45,0.5,0.55,0.6], 신강강:[0.55,0.6,0.65,0.7,0.75], 신중:[0.7,0.85,1.0,1.15,1.3],
  우열:[0.3,0.45,0.6,0.75,0.9], 설수:[0.7,0.85,1.0,1.15,1.3], 화왕:[1.5,1.75,2.0,2.25,2.5],
  // 아래 셋은 judge 에 영향이 없다(sunjap 고저·oegyeok) — 점수가 변하지 않음을 보이려고만 넣는다
  재중:[2.0,2.5,3.0], 개비:[0.7,1.0,1.3], 개균:[0.4,0.5,0.6],
};
const 제약 = t => t.인중 > t.인경 && t.신강강 > t.신강;
const 기본 = { ...THRESH };
const 기본점수 = 점수();
console.log('기본값', JSON.stringify(기본));
console.log('기본 점수:', 표시(기본점수));

// 민감도 — 한 임계값만 바꿀 때
console.log('\n[민감도] 한 임계값만 바꿀 때 (★ 기본값 · ○ 같은 점수 · ▲ 더 좋음 · ▽ 더 나쁨 — 괄호는 명례 일치/명례 패/무작위 상신미현/무작위 패격)');
for (const [k, vals] of Object.entries(범위)) {
  const row = [];
  for (const v of vals) {
    Object.assign(THRESH, 기본, { [k]: v });
    if (!제약(THRESH)) { row.push(`${v}:제약`); continue; }
    const s = 점수(); const c = 비교(s, 기본점수);
    row.push(`${v}${v === 기본[k] ? "★" : c > 0 ? "▲" : c < 0 ? "▽" : "○"}(${s.일치}/${s.명례패}/${s.미현}/${s.패})`);
  }
  console.log(`  ${k.padEnd(4)} ${row.join('  ')}`);
}
Object.assign(THRESH, 기본);

// 좌표 오름
let 현재 = { ...기본 }, 현재점수 = 기본점수, 바뀜 = true, 회차 = 0;
while (바뀜 && 회차 < 6) {
  바뀜 = false; 회차++;
  for (const [k, vals] of Object.entries(범위)) {
    for (const v of vals) {
      if (v === 현재[k]) continue;
      const 시도 = { ...현재, [k]: v }; if (!제약(시도)) continue;
      Object.assign(THRESH, 시도); const s = 점수();
      if (비교(s, 현재점수) > 0) { 현재 = 시도; 현재점수 = s; 바뀜 = true; console.log(`  ↑ ${k}=${v} → ${표시(s)}`); }
    }
  }
}
Object.assign(THRESH, 기본);
console.log('\n[결과]');
console.log('  기본:', JSON.stringify(기본), '→', 표시(기본점수));
console.log('  최선:', JSON.stringify(현재), '→', 표시(현재점수));
const 차이 = Object.keys(기본).filter(k => 기본[k] !== 현재[k]);
if (!차이.length) console.log('  기본값이 최선이다 — 바꿀 것 없음');
else {
  const 명례개선 = 현재점수.일치 > 기본점수.일치 && 현재점수.명례패 <= 기본점수.명례패;
  console.log(`  달라진 값: ${차이.map(k => `${k} ${기본[k]}→${현재[k]}`).join(', ')}`);
  console.log(`  명례 일치가 엄격히 오르고 패격이 늘지 않음: ${명례개선 ? '예 — tonggeun.THRESH 기본값 교체를 검토할 것' : '아니오 — 무작위 집합 상신미현만 줄어든 것이라 기본값을 유지한다'}`);
}
