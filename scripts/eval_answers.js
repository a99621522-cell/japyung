/**
 * scripts/eval_answers.js — 평가 세트 50건의 상담 답을 서버에서 받아 둔다 (블라인드 평가용, Gemini 요금 50회)
 *   RELAY_URL=... node scripts/eval_answers.js [시작 id] → docs/eval/answers/<날짜>/E??.md
 */
const fs = require('fs'); const path = require('path');
const 주소 = (process.env.RELAY_URL || 'https://ganmyeong-relay.onrender.com').replace(/\/$/, '');
const { cases } = require(path.join(__dirname, '..', 'docs', 'eval', 'cases.json'));
const 폴더 = path.join(__dirname, '..', 'docs', 'eval', 'answers', new Date().toISOString().slice(0, 10));
fs.mkdirSync(폴더, { recursive: true });
(async () => {
  for (const c of cases) {
    if (process.argv[2] && c.id < process.argv[2]) continue;
    const 몸 = { 명식: c.명식, 성별: c.성별, 출생연도: c.출생연도, 절기날수: c.명식.daysFromJeolip, 주제: c.주제 };
    try {
      const res = await fetch(`${주소}/%ED%95%B4%EC%84%A4`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(몸), signal: AbortSignal.timeout(180000) });
      const 답 = await res.json();
      fs.writeFileSync(path.join(폴더, `${c.id}.md`), `# ${c.id} — ${c.주제}\n\n명식 ${c.명식.yeonGan}${c.명식.yeonJi} ${c.명식.wolGan}${c.명식.wolJi} ${c.명식.ilGan}${c.명식.ilJi} ${c.명식.siGan || '·'}${c.명식.siJi || '·'} · ${c.성별}\n\n검사: \`${JSON.stringify(답.검사 || null)}\`\n\n---\n\n${답.본문 || ''}\n`);
      console.log(c.id, 답.성공 ? '성공' : '실패', (답.본문 || '').length + '자');
    } catch (e) { console.log(c.id, '오류', e.message); }
    await new Promise(r => setTimeout(r, 1500));
  }
})();
