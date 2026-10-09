/**
 * sync_engine.js — 상위 폴더의 엔진을 server/engine으로 복사한다
 * 원본을 고친 뒤 이것을 돌리지 않으면 서버만 낡은 채로 남는다.
 */
const fs = require('fs'), path = require('path');
const 위 = path.join(__dirname, '..');
const 필요 = new Set();
(function 모으기(n) {
  if (필요.has(n)) return;
  const f = path.join(위, n + '.js');
  if (!fs.existsSync(f)) return;
  필요.add(n);
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/require\(['"]\.\/([\w-]+)['"]\)/g)) 모으기(m[1]);
})('gemini');
// 2026-10-09: server.js 가 './engine/…' 로 직접 부르는 모듈(mundap_route·jomun_trace 등)도 — 전에는 gemini 쪽만 따라가 손으로 복사해야 했고, mundap_route 가 낡은 채 남았다
for (const m of fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8').matchAll(/require\(['"]\.\/engine\/([\w-]+)['"]\)/g)) {
  (function 모으기2(n) {
    if (필요.has(n)) return; const f = path.join(위, n + '.js'); if (!fs.existsSync(f)) return; 필요.add(n);
    for (const k of fs.readFileSync(f, 'utf8').matchAll(/require\(['"]\.\/([\w-]+)['"]\)/g)) 모으기2(k[1]);
  })(m[1]);
}
fs.mkdirSync(path.join(__dirname, 'engine'), { recursive: true });
for (const n of 필요) fs.copyFileSync(path.join(위, n + '.js'), path.join(__dirname, 'engine', n + '.js'));
console.log(`${필요.size}개 모듈 복사`);
