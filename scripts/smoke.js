/**
 * scripts/smoke.js — 배포된 서버가 새 코드로 답하는지 확인한다
 *
 *   node scripts/smoke.js [기대 커밋 7자리]
 *   환경변수 RELAY_URL (기본 https://ganmyeong-relay.onrender.com)
 *
 * ① /health를 두드려 서버를 깨우고, 기대 커밋이 주어지면 그 커밋이 올라올 때까지 기다린다(최대 15분)
 * ② /해설에 시험 명식을 보내 답의 모양을 본다 — 쉬운 말 층(▶ 머리말·용어 풀이)과 답 검사 결과
 * ③ /문답 첫 물음(앱 주 경로)도 보내 해마다 표 첫말을 엔진 세운 판정과 대조한다
 * Gemini를 두 번 부른다(요금 두 번).
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
  if (답.검사) console.log(`시도 ${답.검사.시도 || 1}회 · 다시씀 ${답.검사.다시씀} · 보강된 용어 ${(답.검사.보강된용어 || []).join('·') || '없음'} · 재검사 ${답.검사.재검사 ? JSON.stringify(답.검사.재검사) : '없음(첫 답 통과)'}`);
  console.log('\n' + 본문 + '\n');
  // 에이전트가 읽을 수 있게 답을 파일로 남긴다 — 워크플로가 커밋 댓글로 올린다(작업 공간 프록시는 Actions 로그 파일을 못 받는다)
  try { require('fs').writeFileSync('smoke-answer.md', `### 배포 확인 — 시험 명식 辛巳丁酉辛巳甲午(여), 물음 「${몸.주제}」\n\n서버 커밋 ${h.커밋} · 성공 ${답.성공} · ${본문.length}자\n\n검사: \`${JSON.stringify(답.검사 || null)}\`\n\n시도 ${(답.검사 && 답.검사.시도) || 1}회 · 다시씀 ${!!(답.검사 && 답.검사.다시씀)} · 보강된 용어 ${((답.검사 && 답.검사.보강된용어) || []).join('·') || '없음'}\n\n---\n\n${본문}\n`); } catch (e) {}
  // 재시도 기록(C14) — /health 의 통계. 섹션 다시 쓰기(C16)가 돌았으면 짧은 요청 크기도 여기서 본다
  try { const h2 = await 건강(); console.log('통계', JSON.stringify(h2.통계 || null)); if (답.검사 && 답.검사.다시쓰기) console.log(`다시 쓰기 ${답.검사.다시쓰기.방식} · 요청 ${답.검사.다시쓰기.요청크기}자 · 채택 ${답.검사.다시쓰기.채택}`); } catch (e) {}
  const 머리 = ['▶ 한 줄로 말하면', '▶ 쉽게 풀어 보면', '▶ 왜 그렇게 보나요', '▶ 해 볼 만한 일', '▶ 이 답에 나온 말'];
  const 빠짐 = 머리.filter(m => !본문.includes(m));
  if (!답.성공) { console.log(`::error::해설 실패 — ${답.사유}`); process.exit(1); }
  if (빠짐.length) { console.log(`::warning::머리말 빠짐: ${빠짐.join(', ')}`); process.exit(2); }
  console.log('쉬운 말 층 반영 확인 — 다섯 머리말 모두 있음');

  // ③ /문답 첫 물음 (2026-10-09, 28차) — 앱에서 물음을 치면 /해설 이 아니라 이 길로 간다. 세운 3년만 계산하던 버그(24차)를
  //    smoke 가 못 잡았던 까닭. 해마다 표 첫말을 같은 명식의 엔진 세운 판정과 대조한다. Gemini 한 번 더.
  const 문몸 = { 명식: 몸.명식, 성별: 몸.성별, 출생연도: 몸.출생연도, 절기날수: 몸.절기날수, 질문: 몸.주제, 이력: [] };
  const res2 = await fetch(`${주소}/%EB%AC%B8%EB%8B%B5`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(문몸),
    signal: AbortSignal.timeout(180000),
  });
  const 답2 = await res2.json();
  const 본문2 = String(답2.본문 || '');
  console.log(`\n── /문답 첫 물음 ── 성공 ${답2.성공} · ${본문2.length}자`);
  console.log('검사', JSON.stringify(답2.검사 || null));
  console.log('\n' + 본문2 + '\n');
  // 엔진 판정 — 서버(mundap_route)와 같은 옵션으로 이 저장소의 엔진을 돌린다(서버가 같은 커밋이면 같아야 한다)
  const 문제 = [];
  try {
    const interpret = require('../interpret'), { 해마다첫말 } = require('../haeseol');
    const r = interpret.interpret(몸.명식, { 출생연도: 몸.출생연도, gender: 몸.성별, daysToJeolgi: 몸.절기날수 });
    const 판 = new Map((r.단계11b_세운 || []).map(x => [String(x.연도), 해마다첫말[x.길흉.판정]]));
    const 줄 = 본문2.split('\n').filter(l => /^\s*\|\s*\**\s*\d{4}년/.test(l));
    for (const l of 줄) {
      const y = l.match(/(\d{4})년/)[1], 칸 = (l.split('|')[2] || '').replace(/\*/g, '').trim();
      const 첫 = ['크게 열리는 해', '열리는 해', '두드러진 일이 적은 해', '크게 조심할 해', '지키는 해'].find(w => 칸.startsWith(w));
      if (!판.has(y)) 문제.push(`${y}년: 엔진 세운에 없는 해`);
      else if (첫 && 첫 !== 판.get(y)) 문제.push(`${y}년: 답 「${첫}」 ↔ 엔진 「${판.get(y)}」`);
    }
    console.log(`해마다 표 ${줄.length}줄 대조 — 어긋남 ${문제.length}`); 문제.forEach(x => console.log('  ' + x));
  } catch (e) { console.log('엔진 대조 못 함 — ' + (e.message || e)); }
  try { require('fs').appendFileSync('smoke-answer.md', `\n\n---\n\n### /문답 첫 물음 (앱 주 경로)\n\n성공 ${답2.성공} · ${본문2.length}자 · 검사: \`${JSON.stringify(답2.검사 || null)}\`\n\n해마다 표 엔진 대조: ${문제.length ? 문제.join(' / ') : '어긋남 없음'}\n\n---\n\n${본문2}\n`); } catch (e) {}
  const 머리2 = [...머리.slice(0, 3), '▶ 해마다 보면', ...머리.slice(3)];
  const 빠짐2 = 머리2.filter(m => !본문2.includes(m));
  if (!답2.성공) { console.log(`::error::/문답 실패 — ${답2.사유}`); process.exit(1); }
  if (문제.length) { console.log(`::error::/문답 해마다 표가 엔진 판정과 다름: ${문제.join(' / ')}`); process.exit(1); }
  if (빠짐2.length) { console.log(`::warning::/문답 머리말 빠짐: ${빠짐2.join(', ')}`); process.exit(2); }
  console.log('/문답 확인 — 여섯 머리말·해마다 표 엔진 판정 일치');
})().catch(e => { console.log('::error::' + (e.message || e)); process.exit(1); });
