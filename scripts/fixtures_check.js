// 명례 78건 회귀 — 격 이름이 맞고 결론이 패격이 아니어야 한다 (부록 명례는 저자의 정답 라벨)
const path = require('path');
const 뿌리 = path.join(__dirname, '..');
const { FIXTURES } = require(path.join(뿌리, 'fixtures_zpjz'));
const { judge } = require(path.join(뿌리, 'gyeokguk'));
const 같은격 = (기대, 실제) => 기대 === 실제 || (기대 === '재' && /재$/.test(실제)) || (기대 === '인' && /인$/.test(실제))
  || (기대 === '칠살' && 실제 === '편관') || (기대 === '건록' && ['건록','월겁'].includes(실제));
let 격오류 = 0, 패격 = 0; const rows = [];
for (const f of FIXTURES) {
  let r; try { r = judge(f.m); } catch (e) { rows.push(`✗ ${f.이름} 예외 ${e.message}`); 격오류++; continue; }
  const 격ok = 같은격(f.격, r.ctx?.gyeok ?? r.격);
  const 결론 = r.결론;
  if (!격ok) 격오류++; if (결론 === '패격' || 결론 === '상신미현') 패격++;
  rows.push(`${격ok && 결론 !== '패격' ? '✓' : '✗'} ${f.격}\t${f.이름}\t${f.명식}\t→ ${r.ctx?.gyeok ?? r.격} ${결론} 상신=${r.상신 ?? '-'}\t(${f.평})`);
}
console.log(rows.join('\n'));
console.log(`\n명례 ${FIXTURES.length}건 · 격 불일치 ${격오류} · 패격/상신미현 ${패격}`);
if (process.argv.includes('--strict') && 격오류) process.exit(1);
