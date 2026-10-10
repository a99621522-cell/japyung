/**
 * scripts/look.js — 배포된 화면을 브라우저로 열어 본다 (GitHub Actions에서 돈다)
 *   node scripts/look.js <주소> <저장폴더> [물음]
 * 휴대폰 크기로 열어 → 명식(넷째 인자 'YYYY-MM-DD HH:MM 남|여', 없으면 시험 명식 2001-09-15 12:30 여)을 넣고 「본다」 → 물음을 넣고 「묻는다」 →
 * 답이 올 때까지 기다려 캡처한다. 단계마다 캡처·글자를 남기고, 실패해도 그 자리까지 남긴다.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [주소, 폴더, 물음 = '취업, 결혼, 재물, 건강을 알려주세요', 명식입력 = ''] = process.argv.slice(2);
// 명식입력: 'YYYY-MM-DD HH:MM 남|여' (비우면 시험 명식 2001-09-15 12:30 여)
const 명 = /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})\s*(남|여)$/.exec(명식입력.trim()) || [null, '2001', '9', '15', '12', '30', '여'];
fs.mkdirSync(폴더, { recursive: true });
const 기록 = (s) => { console.log(s); fs.appendFileSync(`${폴더}/진행.txt`, s + '\n'); };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  p.on('console', m => fs.appendFileSync(`${폴더}/console.txt`, `[${m.type()}] ${m.text()}\n`));
  p.on('pageerror', e => fs.appendFileSync(`${폴더}/console.txt`, `[pageerror] ${e.message}\n`));
  const 찍기 = async (n) => { await p.screenshot({ path: `${폴더}/${n}.png`, fullPage: true }); 기록(`찍음 ${n}`); };
  try {
    await p.goto(주소, { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(2500);
    await 찍기('1-첫화면');
    await p.fill('#이름', '시험');
    await p.fill('#년', 명[1]); await p.fill('#월', String(+명[2])); await p.fill('#일', String(+명[3]));
    await p.fill('#시', String(+명[4])); await p.fill('#분', 명[5]);
    await p.selectOption('#성', 명[6]);
    기록(`명식 ${명.slice(1).join(' ')}`);
    await p.click('button:has-text("본다")');
    await p.waitForTimeout(3000);
    await 찍기('2-결과화면');
    fs.writeFileSync(`${폴더}/2-결과글자.txt`, await p.innerText('body'));
    await p.fill('#물음칸', 물음);
    await p.click('#물음단추');
    기록('물음 보냄 — 답 기다림(최대 4분, 서버가 자고 있으면 오래 걸림)');
    await p.waitForFunction(() => { const c = document.querySelector('#상담칸'); return c && c.querySelector('.상담'); }, null, { timeout: 240000 });
    await p.waitForTimeout(1500);
    const 칸 = await p.$('#상담칸');
    await 칸.scrollIntoViewIfNeeded();
    await 칸.screenshot({ path: `${폴더}/3-답.png` });
    fs.writeFileSync(`${폴더}/3-답글자.txt`, await 칸.innerText());
    fs.writeFileSync(`${폴더}/3-답html.txt`, await 칸.innerHTML());
    기록('답 받음');
  } catch (e) {
    기록('실패: ' + (e.message || e));
    try { await 찍기('실패한-자리'); } catch (_) {}
    process.exitCode = 1;
  } finally { await b.close(); }
})();
