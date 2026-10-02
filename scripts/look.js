/**
 * scripts/look.js — 배포된 화면을 브라우저로 열어 본다 (GitHub Actions에서 돈다)
 *   node scripts/look.js <주소> <저장폴더>
 * 첫 화면 캡처(휴대폰 크기)와 화면 글자, 페이지가 불러온 파일 목록을 남긴다.
 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [주소, 폴더] = process.argv.slice(2);
  fs.mkdirSync(폴더, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const 불러온 = [];
  p.on('response', r => 불러온.push(`${r.status()} ${r.url()}`));
  p.on('console', m => fs.appendFileSync(`${폴더}/console.txt`, `[${m.type()}] ${m.text()}\n`));
  await p.goto(주소, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${폴더}/첫화면.png`, fullPage: true });
  fs.writeFileSync(`${폴더}/화면글자.txt`, await p.innerText('body'));
  fs.writeFileSync(`${폴더}/불러온파일.txt`, 불러온.join('\n'));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
