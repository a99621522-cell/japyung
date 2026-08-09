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
fs.mkdirSync(path.join(__dirname, 'engine'), { recursive: true });
for (const n of 필요) fs.copyFileSync(path.join(위, n + '.js'), path.join(__dirname, 'engine', n + '.js'));
console.log(`${필요.size}개 모듈 복사`);
