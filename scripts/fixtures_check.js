// 명례 78건 회귀 — 격 이름이 맞고 결론이 패격이 아니어야 한다 (부록 명례는 저자의 정답 라벨)
// 2026-10-07: fixtures_zpjz_expect.js 의 기대 상신·성패·조문까지 대조한다.
//   --strict 면 격 불일치가 있거나, 일치 수가 기록된 기준(아래 기준일치)보다 적으면 exit 1
const path = require('path');
const 뿌리 = path.join(__dirname, '..');
const { FIXTURES } = require(path.join(뿌리, 'fixtures_zpjz'));
const { EXPECT } = require(path.join(뿌리, 'fixtures_zpjz_expect'));
const { judge } = require(path.join(뿌리, 'gyeokguk'));
const 기준일치 = { 격:78, 상신:78, 성패:78, 조문:78 };   // 마지막으로 확인한 일치 수 — 떨어지면 --strict 실패
const 같은격 = (기대, 실제) => 기대 === 실제 || (기대 === '재' && /재$/.test(실제)) || (기대 === '인' && /인$/.test(실제))
  || (기대 === '칠살' && 실제 === '편관') || (기대 === '건록' && ['건록','월겁'].includes(실제));
const 목록 = x => x == null ? [null] : Array.isArray(x) ? x : [x];
let 격오류 = 0, 패격 = 0; const 일치 = { 격:0, 상신:0, 성패:0, 조문:0 }; const rows = [];
for (const f of FIXTURES) {
  let r; try { r = judge(f.m); } catch (e) { rows.push(`✗ ${f.이름} 예외 ${e.message}`); 격오류++; continue; }
  const 격ok = 같은격(f.격, r.ctx?.gyeok ?? r.격);
  const 결론 = r.결론;
  if (!격ok) 격오류++; else 일치.격++;
  if (결론 === '패격' || 결론 === '상신미현') 패격++;
  const e = EXPECT[f.이름];
  const 전체 = new Set((r.조문?.전체 ?? []).map(j => j.id));
  const 상신ok = e ? 목록(e.상신).includes(r.상신 ?? null) : false;
  const 성패ok = e ? 목록(e.성패).includes(결론) : false;
  const 빠진조문 = e ? e.조문.filter(id => !전체.has(id)) : ['(기대 없음)'];
  const 조문ok = 빠진조문.length === 0;
  if (상신ok) 일치.상신++; if (성패ok) 일치.성패++; if (조문ok) 일치.조문++;
  const ok = 격ok && 결론 !== '패격' && 상신ok && 성패ok && 조문ok;
  rows.push(`${ok ? '✓' : '✗'} ${f.격}\t${f.이름}\t${f.명식}\t→ ${r.ctx?.gyeok ?? r.격} ${결론} 상신=${r.상신 ?? '-'}\t(${f.평})`
    + (ok ? '' : `\n     기대 상신=${목록(e?.상신).join('|')} 성패=${목록(e?.성패).join('|')}${빠진조문.length ? ' 빠진 조문=' + 빠진조문.join(',') : ''}`));
}
console.log(rows.join('\n'));
console.log(`\n명례 ${FIXTURES.length}건 · 격 불일치 ${격오류} · 패격/상신미현 ${패격} · 일치 상신 ${일치.상신} 성패 ${일치.성패} 조문 ${일치.조문} (기준 ${기준일치.상신}/${기준일치.성패}/${기준일치.조문})`);
if (process.argv.includes('--strict')) {
  const 후퇴 = Object.keys(기준일치).filter(k => 일치[k] < 기준일치[k]);
  if (격오류 || 패격 || 후퇴.length) { console.log(`✗ strict 실패: 격 불일치 ${격오류}, 패격 ${패격}, 기준보다 적은 항목 ${후퇴.join(',') || '없음'}`); process.exit(1); }
}
