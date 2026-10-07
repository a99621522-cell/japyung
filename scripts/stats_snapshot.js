/**
 * scripts/stats_snapshot.js — /health 통계를 날마다 받아 쌓는다 (2026-10-07, docs/PROMPTS.md 5)
 *
 *   node scripts/stats_snapshot.js            # 받아서 data/stats/health.jsonl 에 한 줄 덧붙이고 summary.md 다시 씀
 *   node scripts/stats_snapshot.js --report   # 받지 않고 summary.md 만 다시 씀
 *
 * 서버 통계는 메모리라 재시작하면 0 이 된다. 그래서 스냅샷마다 `시작` 시각을 함께 적고,
 * 집계는 같은 `시작` 안에서는 마지막 값만, `시작` 이 바뀌면 각각 더한다(누적 = Σ 세션별 마지막 값).
 * 명식·본문·IP 는 서버가 애초에 세지 않는다. 워크플로 `.github/workflows/stats.yml` 이 매일 돌려 커밋한다.
 */
const fs = require('fs');
const path = require('path');
const 주소 = (process.env.RELAY_URL || 'https://ganmyeong-relay.onrender.com').replace(/\/$/, '');
const 폴더 = path.join(__dirname, '..', 'data', 'stats');
const 파일 = path.join(폴더, 'health.jsonl');
const 요약 = path.join(폴더, 'summary.md');

function 읽기() {
  if (!fs.existsSync(파일)) return [];
  return fs.readFileSync(파일, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

/** 세션(서버 시작 시각)별 마지막 스냅샷을 더한다 */
function 누적(목록, 부터 = null) {
  const 세션 = new Map();
  for (const x of 목록) { if (!x.통계 || !x.통계.시작) continue; if (부터 && x.때 < 부터) continue; 세션.set(x.통계.시작, x.통계); }
  const 합 = { 세션수: 세션.size, 요청: { 해설: 0, 문답: 0 }, 성공: 0, 실패: 0, 예외: 0, 본문초과: 0, 시도2: 0, 채택둘째: 0, 다시쓰기: { 섹션: 0, 전체: 0, 실패: 0 }, 오류규칙: {}, 경고규칙: {}, 보강용어: {}, 가드: {}, 이해안됨: {} };
  const 더함 = (표, 추가) => { for (const [k, v] of Object.entries(추가 || {})) 표[k] = (표[k] || 0) + v; };
  for (const t of 세션.values()) {
    합.요청.해설 += t.요청?.해설 || 0; 합.요청.문답 += t.요청?.문답 || 0;
    for (const k of ['성공', '실패', '예외', '본문초과', '시도2', '채택둘째']) 합[k] += t[k] || 0;
    for (const k of ['섹션', '전체', '실패']) 합.다시쓰기[k] += t.다시쓰기?.[k] || 0;
    for (const k of ['오류규칙', '경고규칙', '보강용어', '가드', '이해안됨']) 더함(합[k], t[k]);
  }
  return 합;
}

function 표(obj) {
  const e = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  return e.length ? e.map(([k, v]) => `| ${k} | ${v} |`).join('\n') : '| (없음) | 0 |';
}

function 보고서(목록) {
  const 전체 = 누적(목록);
  const 이주 = 누적(목록, new Date(Date.now() - 14 * 86400000).toISOString());
  const 율 = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : '-';
  const 한덩이 = (이름, t) => {
    const 답 = t.성공 + t.실패;
    return `## ${이름}
세션(서버 시작) ${t.세션수} · 요청 해설 ${t.요청.해설} · 문답 ${t.요청.문답} · 성공 ${t.성공} · 실패 ${t.실패} · 예외 ${t.예외} · 본문초과 ${t.본문초과}
재시도율(시도 2회) ${율(t.시도2, 답)} · 둘째 답 채택 ${율(t.채택둘째, 답)} · 다시쓰기 섹션 ${t.다시쓰기.섹션} · 전체 ${t.다시쓰기.전체} · 실패 ${t.다시쓰기.실패}

| 오류 규칙 | 횟수 |\n|---|---|\n${표(t.오류규칙)}

| 경고 규칙 | 횟수 |\n|---|---|\n${표(t.경고규칙)}

| 「이해 안 됨」 절 | 횟수 |\n|---|---|\n${표(t.이해안됨)}

| 보강된 용어 | 횟수 |\n|---|---|\n${표(t.보강용어)}
`;
  };
  return `# /health 통계 누적 — ${new Date().toISOString().slice(0, 10)}

스냅샷 ${목록.length}건(${목록[0]?.때?.slice(0, 10) || '-'} ~ ${목록[목록.length - 1]?.때?.slice(0, 10) || '-'}). 서버 통계는 메모리라 재시작마다 0 이 되므로 서버 시작 시각별 마지막 값을 더했다. 명식·본문·IP 없음.
문턱 결정(60자×3·밀도 4·긴 문장·빽빽한 문장)은 2주 치가 쌓인 뒤 \`node scripts/stats_report.js\` 로 — 재시도율·규칙별 빈도를 보고 사람이 정한다.

${한덩이('최근 14일', 이주)}
${한덩이('전체', 전체)}`;
}

(async () => {
  const 목록 = 읽기();
  if (!process.argv.includes('--report')) {
    const res = await fetch(`${주소}/health`, { signal: AbortSignal.timeout(90000) });
    const h = await res.json();
    const 줄 = { 때: new Date().toISOString(), 커밋: h.커밋 || null, 모델: h.모델 || null, 통계: h.통계 || null };
    fs.mkdirSync(폴더, { recursive: true });
    fs.appendFileSync(파일, JSON.stringify(줄) + '\n');
    목록.push(줄);
    console.log('스냅샷', 줄.때, '커밋', 줄.커밋, '요청', JSON.stringify(h.통계?.요청));
  }
  fs.writeFileSync(요약, 보고서(목록));
  console.log('summary.md 다시 씀 —', 목록.length, '건');
})().catch(e => { console.log('::error::' + (e && e.message || e)); process.exit(1); });
