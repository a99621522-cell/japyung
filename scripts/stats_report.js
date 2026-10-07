/**
 * scripts/stats_report.js — 문턱 결정 보고서 초안 (2026-10-07, docs/PROMPTS.md 5 「2주 뒤 문턱 결정 보고서」)
 *
 *   node scripts/stats_report.js [일수=14]  → docs/reports/threshold-YYYY-MM-DD.md
 *
 * data/stats/health.jsonl 의 최근 N일을 모아, 쉬운 말 층 검사 규칙(긴 문장·빽빽한 문장·60자×3·밀도 4·애매한 말·근거 한자…)이
 * 답 100건당 몇 번 걸리는지와 재시도율을 표로 내고, 「이해 안 됨」 절 분포를 붙인다.
 * 문턱을 바꾸라고 결정하지 않는다 — 수치와 선택지(올림·그대로·내림)만 적고, 결정은 사람이 한다(CLAUDE.md 「남긴 것」).
 */
const fs = require('fs');
const path = require('path');
const 일수 = +(process.argv[2] || 14);
const 파일 = path.join(__dirname, '..', 'data', 'stats', 'health.jsonl');
const 목록 = fs.existsSync(파일) ? fs.readFileSync(파일, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const 부터 = new Date(Date.now() - 일수 * 86400000).toISOString();
const 세션 = new Map();
for (const x of 목록) if (x.통계 && x.통계.시작 && x.때 >= 부터) 세션.set(x.통계.시작, x.통계);
const 합 = { 답: 0, 시도2: 0, 채택둘째: 0, 오류: {}, 경고: {}, 이해: {} };
const 더함 = (표, 추가) => { for (const [k, v] of Object.entries(추가 || {})) 표[k] = (표[k] || 0) + v; };
for (const t of 세션.values()) { 합.답 += (t.성공 || 0) + (t.실패 || 0); 합.시도2 += t.시도2 || 0; 합.채택둘째 += t.채택둘째 || 0; 더함(합.오류, t.오류규칙); 더함(합.경고, t.경고규칙); 더함(합.이해, t.이해안됨); }
const 백건당 = n => 합.답 ? (100 * n / 합.답).toFixed(1) : '-';
const 행 = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} | ${백건당(v)} |`).join('\n') || '| (없음) | 0 | - |';
const 문턱규칙 = ['긴 문장', '빽빽한 문장', '60자×3', '밀도 4', '한 줄 답 전문어', '애매한 말', '근거 한자', '용어 풀이'];
const 선택지 = 문턱규칙.map(k => {
  const n = (합.오류[k] || 0) + (합.경고[k] || 0); const r = 합.답 ? 100 * n / 합.답 : 0;
  const 제안 = !합.답 ? '자료 없음' : r >= 50 ? '거의 모든 답에 걸림 — 문턱이 너무 빡빡하거나 모범 답안·규칙 문구를 고쳐야 함(사람 결정)' : r >= 10 ? '열에 하나 이상 — 그대로 두고 2주 더 보거나, 오류라면 경고로 내리는 안' : '드묾 — 그대로';
  return `| ${k} | ${n} | ${백건당(n)} | ${제안} |`;
}).join('\n');
const 글 = `# 쉬운 말 층 문턱 결정 보고서 초안 — ${new Date().toISOString().slice(0, 10)} (최근 ${일수}일)

답 ${합.답}건 · 서버 세션 ${세션.size} · 재시도율(시도 2회) ${백건당(합.시도2)}% · 둘째 답 채택 ${백건당(합.채택둘째)}%

## 문턱이 있는 규칙 — 100건당 횟수와 선택지
| 규칙 | 횟수 | 100건당 | 선택지(결정은 사람) |
|---|---|---|---|
${선택지}

## 오류 규칙 전체
| 규칙 | 횟수 | 100건당 |
|---|---|---|
${행(합.오류)}

## 경고 규칙 전체
| 규칙 | 횟수 | 100건당 |
|---|---|---|
${행(합.경고)}

## 「이해 안 됨」 절
| 절 | 횟수 | 100건당 |
|---|---|---|
${행(합.이해)}

## 읽는 법
- 서버 통계는 메모리라 재시작마다 0 이 된다. 서버 시작 시각별 마지막 스냅샷을 더했다. 하루에 한 번 받으므로 하루 안에 두 번 재시작하면 앞 세션은 빠진다.
- 「이해 안 됨」은 절 이름만 세며 어느 답이었는지는 모른다. 절별 비율이 높은 곳의 규칙·모범 답안을 먼저 본다.
- 문턱 값(60자×3·밀도 4·긴 문장 60자·빽빽 4)은 \`swiunmal.js\` 검사에 있다. 바꾸면 \`scripts/easy_check.js\` 오탐 재현과 모범 답안 9개(\`scripts/check.js\` ③)가 함께 통과해야 한다.
`;
fs.mkdirSync(path.join(__dirname, '..', 'docs', 'reports'), { recursive: true });
const out = path.join(__dirname, '..', 'docs', 'reports', `threshold-${new Date().toISOString().slice(0, 10)}.md`);
fs.writeFileSync(out, 글);
console.log(out, '—', 합.답, '건');
