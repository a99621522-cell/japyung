// 명례 회귀 — 격 이름이 맞고 결론이 패격이 아니어야 한다 (명례는 저자의 정답 라벨)
// 2026-10-07: fixtures_zpjz_expect.js 의 기대 상신·성패·조문까지 대조한다.
//   --strict 면 격 불일치가 있거나, 일치 수가 기록된 기준(아래 기준일치)보다 적으면 exit 1
// 2026-10-07(5차): 부록 78건 다음에 **각 편 본문 명례**(fixtures_zpjz_chapters.js)도 돌린다 — 격·상신·성패 라벨, 47편 외격은 japgyeok 격 이름.
//   부록과 겹치는 명식(부록:true)은 참고로만 세고, 겹치지 않는 명례의 일치 수를 기준(장내기준)으로 지킨다.
const path = require('path');
const 뿌리 = path.join(__dirname, '..');
const { FIXTURES } = require(path.join(뿌리, 'fixtures_zpjz'));
const { EXPECT } = require(path.join(뿌리, 'fixtures_zpjz_expect'));
const { CHAPTERS } = require(path.join(뿌리, 'fixtures_zpjz_chapters'));
const { judge } = require(path.join(뿌리, 'gyeokguk'));
const oegyeok = require(path.join(뿌리, 'oegyeok'));
const japgyeok = require(path.join(뿌리, 'japgyeok'));
const 기준일치 = { 격:78, 상신:78, 성패:78, 조문:78 };   // 마지막으로 확인한 일치 수 — 떨어지면 --strict 실패
const 장내기준 = { 건수:4, 격:4, 상신:4, 성패:4, 외격:12 };   // 부록과 겹치지 않는 장내 명례(정격 4: 高太尉·壬申癸丑己丑甲戌·李御史·戊申甲子庚午丁丑, 외격 12 — 趙丞相은 원문 자체 모순으로 제외) — 떨어지면 --strict 실패
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
console.log(`\n명례 78건 · 격 불일치 ${격오류} · 패격/상신미현 ${패격} · 일치 상신 ${일치.상신} 성패 ${일치.성패} 조문 ${일치.조문} (기준 ${기준일치.상신}/${기준일치.성패}/${기준일치.조문})`);

// ── 장내 명례 ────────────────────────────────────────────
const 장 = { 건수:0, 격:0, 상신:0, 성패:0, 외격:0, 외격건수:0 }; const 참고 = { 건수:0, 전부:0 }; const 불일치표 = [];
for (const c of CHAPTERS) {
  let r; try { r = judge(c.m); } catch (e) { 불일치표.push(`✗ ${c.편} ${c.이름} 예외 ${e.message}`); continue; }
  const 실제격 = r.ctx?.gyeok ?? r.격;
  if (c.외격) {
    let jg; try { jg = japgyeok.analyze(oegyeok.analyze(r, c.m), c.m); } catch (e) { jg = { 해당없음:true, 사유:'예외 ' + e.message }; }
    const ok = !jg.해당없음 && String(jg.격).includes(c.외격) && (!!c.폐기 === !!jg.폐기격);
    if (c.원문자체모순) { 불일치표.push(`~ [원문 자체 모순·기준 제외] ${c.편} ${c.이름}\t${c.명식}\t기대 ${c.외격} → ${jg.해당없음 ? '해당없음: ' + jg.사유 : jg.격} — ${c.근거}`); continue; }
    장.외격건수++; if (ok) 장.외격++;
    else 불일치표.push(`✗ [외격] ${c.편} ${c.이름}\t${c.명식}\t기대 ${c.외격}${c.폐기 ? '(可廢)' : ''} → ${jg.해당없음 ? '해당없음: ' + jg.사유 : jg.격 + (jg.폐기격 ? '(폐기)' : '')} (월령 ${실제격} ${r.결론})`);
    continue;
  }
  const 격ok = 같은격(c.격, 실제격);
  const 상신ok = c.상신 === undefined ? true : 목록(c.상신).includes(r.상신 ?? null);
  const 성패ok = c.성패 === undefined ? true : 목록(c.성패).includes(r.결론);
  const ok = 격ok && 상신ok && 성패ok;
  if (c.부록) { 참고.건수++; if (ok) 참고.전부++; if (!ok) 불일치표.push(`~ [부록겹침] ${c.편} ${c.이름}\t${c.명식}\t기대 ${c.격}/${목록(c.상신).join('|')}/${목록(c.성패).join('|')} → ${실제격}/${r.상신 ?? '-'}/${r.결론}`); continue; }
  장.건수++; if (격ok) 장.격++; if (상신ok) 장.상신++; if (성패ok) 장.성패++;
  if (!ok) 불일치표.push(`✗ ${c.편} ${c.이름}\t${c.명식}\t기대 ${c.격}/${목록(c.상신).join('|')}/${목록(c.성패).join('|')} → ${실제격}/${r.상신 ?? '-'}/${r.결론}\t[${(r.조문?.전체 ?? []).map(j => j.id.replace('ZPJZ-','')).join(',')}]\t(${c.인용.slice(0, 40)})`);
}
console.log(`\n장내 명례 ${CHAPTERS.length}건 — 부록 밖 정격 ${장.건수}건: 격 ${장.격} 상신 ${장.상신} 성패 ${장.성패} · 외격 ${장.외격}/${장.외격건수} · 부록 겹침 ${참고.전부}/${참고.건수} (기준 ${장내기준.격}/${장내기준.상신}/${장내기준.성패}, 외격 ${장내기준.외격})`);
if (불일치표.length) console.log('[장내 명례 불일치표]\n' + 불일치표.join('\n'));

if (process.argv.includes('--strict')) {
  const 떨어짐 = Object.keys(기준일치).filter(k => 일치[k] < 기준일치[k]);
  const 장떨어짐 = ['격','상신','성패','외격'].filter(k => 장[k] < 장내기준[k]);
  if (격오류 || 떨어짐.length || 장떨어짐.length) {
    if (떨어짐.length) console.log(`--strict: 부록 일치 수가 기준보다 떨어졌다 — ${떨어짐.map(k => `${k} ${일치[k]}<${기준일치[k]}`).join(', ')}`);
    if (장떨어짐.length) console.log(`--strict: 장내 일치 수가 기준보다 떨어졌다 — ${장떨어짐.map(k => `${k} ${장[k]}<${장내기준[k]}`).join(', ')}`);
    process.exit(1);
  }
}
