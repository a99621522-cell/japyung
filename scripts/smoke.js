/**
 * scripts/smoke.js — 배포된 서버가 새 코드로 답하는지 확인한다
 *
 *   node scripts/smoke.js [기대 커밋 7자리]
 *   환경변수 RELAY_URL (기본 https://ganmyeong-relay.onrender.com)
 *
 * ① /health를 두드려 서버를 깨우고, 기대 커밋이 주어지면 그 커밋이 올라올 때까지 기다린다(최대 15분)
 * ② /해설에 시험 명식을 보내 답의 모양을 본다 — 쉬운 말 층(▶ 머리말·용어 풀이)과 답 검사 결과
 * Gemini를 한 번 부른다(요금 한 번).
 */
const 주소 = (process.env.RELAY_URL || 'https://ganmyeong-relay.onrender.com').replace(/\/$/, '');
const 기대 = (process.argv[2] || '').slice(0, 7);
const 쉼 = ms => new Promise(r => setTimeout(r, ms));

async function 건강() {
  const res = await fetch(`${주소}/health`, { signal: AbortSignal.timeout(90000) });
  return res.json();
}

(async () => {
  // ① 배포 기다리기
  const 끝 = Date.now() + 15 * 60 * 1000;
  let h = null;
  for (;;) {
    try { h = await 건강(); } catch (e) { h = { 오류: String(e.message || e) }; }
    console.log('health', JSON.stringify(h));
    if (!기대) break;
    if (h && h.커밋 === 기대) break;
    if (h && h.살아있음 && h.커밋 === undefined) { console.log('서버가 커밋을 알리지 않는 옛 판입니다 — 기다립니다'); }
    if (Date.now() > 끝) { console.log(`::error::15분 안에 커밋 ${기대}가 배포되지 않았습니다 (Render 자동 배포가 꺼져 있을 수 있음)`); process.exit(1); }
    await 쉼(30000);
  }
  if (!h || !h.살아있음) { console.log('::error::서버가 응답하지 않습니다'); process.exit(1); }
  if (!h.키) { console.log('::error::서버에 GEMINI_API_KEY가 없습니다'); process.exit(1); }

  // ② 해설 한 번
  const 몸 = {
    명식: { yeonGan: '辛', yeonJi: '巳', wolGan: '丁', wolJi: '酉', ilGan: '辛', ilJi: '巳', siGan: '甲', siJi: '午' },
    성별: '여', 출생연도: 2001, 절기날수: 8, 주제: '취업, 결혼, 재물, 건강을 알려주세요',
  };
  const res = await fetch(`${주소}/%ED%95%B4%EC%84%A4`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(몸),
    signal: AbortSignal.timeout(180000),
  });
  const 답 = await res.json();
  const 본문 = String(답.본문 || '');
  console.log(`\n── 응답 ── 성공 ${답.성공} · 출처 ${답.출처} · ${본문.length}자`);
  console.log('검사', JSON.stringify(답.검사 || null));
  console.log('\n' + 본문 + '\n');
  // 에이전트가 읽을 수 있게 답을 파일로 남긴다 — 워크플로가 커밋 댓글로 올린다(작업 공간 프록시는 Actions 로그 파일을 못 받는다)
  try { require('fs').writeFileSync('smoke-answer.md', `### 배포 확인 — 시험 명식 辛巳丁酉辛巳甲午(여), 물음 「${몸.주제}」\n\n서버 커밋 ${h.커밋} · 성공 ${답.성공} · ${본문.length}자\n\n검사: \`${JSON.stringify(답.검사 || null)}\`\n\n---\n\n${본문}\n`); } catch (e) {}
  const 머리 = ['▶ 한 줄로 말하면', '▶ 쉽게 풀어 보면', '▶ 왜 그렇게 보나요', '▶ 해 볼 만한 일', '▶ 이 답에 나온 말'];
  const 빠짐 = 머리.filter(m => !본문.includes(m));
  if (!답.성공) { console.log(`::error::해설 실패 — ${답.사유}`); process.exit(1); }
  if (빠짐.length) { console.log(`::warning::머리말 빠짐: ${빠짐.join(', ')}`); process.exit(2); }
  console.log('쉬운 말 층 반영 확인 — 다섯 머리말 모두 있음');
})().catch(e => { console.log('::error::' + (e.message || e)); process.exit(1); });
