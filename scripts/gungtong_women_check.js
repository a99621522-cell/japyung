/**
 * scripts/gungtong_women_check.js — 여명(女命) 조문 검사 (2026-10-07)
 *
 *   node scripts/gungtong_women_check.js
 *
 * 원문 「女命」 줄 7곳(docs/gungtong_wonmun.txt grep 女命 — 1523행은 명례 표의 꼬리표라 제외)을 옮긴 gungtong_jomun.여명조문 마다
 *   ① 조건을 맞춘 명식(지어낸 것, 실존 인물 아님)으로 성별 '여' 에서 걸리고 '남' 에서는 걸리지 않는지
 *   ② analyze 결과(여명 항목)·브리프줄·haeseol 이 읽을 모든 문자열에 금지 낱말(淫·賤·長舌·刑夫·剋子·不生長·酒色·奸詐·多疑·忌妒)이 없는지
 *   ③ 표시금지 조문의 원문이 「(원문 비공개 — 정책)」 로 바뀌는지
 * 를 본다. 시주 조건(時)이 있는 조문은 시주가 없을 때 보류로 가는지도 본다.
 */
const path = require('path');
const GJ = require(path.join(__dirname, '..', 'gungtong_jomun'));

const 금지 = /淫|賤|長舌|刑夫|剋子|不生長|酒色|奸詐|多疑|忌妒|淫惡/;
// 조문별 시험 명식 — 조건을 맞추려 지은 것
const 시험 = {
  'GT-女-甲辰-01': { yeonGan:'戊', yeonJi:'寅', wolGan:'戊', wolJi:'辰', ilGan:'甲', ilJi:'寅', siGan:'乙', siJi:'亥' },      // 戊 透 · 비겁(乙 천간 + 寅寅 정기 甲) ≥ 2
  'GT-女-甲夏-02': { yeonGan:'丙', yeonJi:'寅', wolGan:'甲', wolJi:'午', ilGan:'甲', ilJi:'子', siGan:'丁', siJi:'卯' },      // 火 투출
  'GT-女-甲未-03': { yeonGan:'壬', yeonJi:'辰', wolGan:'己', wolJi:'未', ilGan:'甲', ilJi:'子', siGan:'丙', siJi:'寅' },      // 六月 · 辰 · 월간 己
  'GT-女-丙寅-04': { yeonGan:'辛', yeonJi:'亥', wolGan:'庚', wolJi:'寅', ilGan:'丙', ilJi:'子', siGan:'辛', siJi:'卯' },      // 辛年辛時
  'GT-女-丙酉-05': { yeonGan:'辛', yeonJi:'丑', wolGan:'丁', wolJi:'酉', ilGan:'丙', ilJi:'子', siGan:'戊', siJi:'子' },      // 辛 透 · 丁 하나
  'GT-女-丁寅-06': { yeonGan:'丁', yeonJi:'卯', wolGan:'壬', wolJi:'寅', ilGan:'丁', ilJi:'巳', siGan:'壬', siJi:'寅' },      // 丁年壬月丁日壬時
  'GT-女-土-07':   { yeonGan:'戊', yeonJi:'戌', wolGan:'丙', wolJi:'戌', ilGan:'戊', ilJi:'辰', siGan:'戊', siJi:'午' },      // 土 多 · 無水 · 無木 · 火 透 (論土 — 달 무관)
};
let 통과 = 0, 실패 = [];
const 확인 = (이름, ok, 설명) => { if (ok) 통과++; else 실패.push(`${이름}: ${설명 || ''}`); };

for (const j of GJ.여명조문) {
  const m = 시험[j.id];
  if (!m) { 실패.push(`${j.id}: 시험 명식 없음`); continue; }
  const 여 = GJ.analyze(m, { 성별: '여' }), 남 = GJ.analyze(m, { 성별: '남' }), 없음 = GJ.analyze(m);
  확인(`${j.id} 여에서 걸림`, 여.여명.some(x => x.id === j.id), `여명 ${JSON.stringify(여.여명.map(x => x.id))} 보류 ${JSON.stringify(여.보류)}`);
  확인(`${j.id} 남에서 안 걸림`, !남.여명.some(x => x.id === j.id) && !없음.여명.length);
  const 항목 = 여.여명.find(x => x.id === j.id) || {};
  const 출력 = [JSON.stringify(항목), ...GJ.브리프줄(여).filter(l => /여명 조문/.test(l))].join('\n');
  확인(`${j.id} 출력에 금지 낱말 없음`, !금지.test(출력), 출력.match(금지) && 출력.match(금지)[0]);
  확인(`${j.id} 결 번역에 금지 낱말 없음`, !금지.test(j.결));
  // 근거(원문 전체)는 어떤 출력에도 안 나간다. 보이는 원문(j.원문)은 금지 낱말이 없어야 하고, 금지 낱말이 든 조문은 표시금지로 「(원문 비공개 — 정책)」
  확인(`${j.id} 보이는 원문에 금지 낱말 없음`, !금지.test(j.원문));
  if (j.표시금지) 확인(`${j.id} 표시금지면 원문 비공개`, 항목.원문 === '(원문 비공개 — 정책)', 항목.원문);
  else 확인(`${j.id} 표시 가능 원문 그대로`, 항목.원문 === j.원문 && !금지.test(항목.원문));
  if (금지.test(j.근거) && !j.표시금지) 확인(`${j.id} 근거에 금지 낱말이 있으면 보이는 원문은 그 앞부분만`, !금지.test(j.원문) && j.근거.startsWith(j.원문.replace(/…$/, '').slice(0, 8)));
  // 時 조건 조문은 시주가 없으면 보류
  if (/時\(/.test(j.조건.toString())) {
    const 무시 = GJ.analyze({ ...m, siGan: null, siJi: null }, { 성별: '여' });
    // 월간 己처럼 時 앞에서 조건이 끝나면 걸려도 된다(단락 평가). 時 까지 가면 보류여야 한다
    const 걸림 = 무시.여명.some(x => x.id === j.id), 보류 = 무시.보류.some(x => x.id === j.id && x.사유 === '시간 미상');
    확인(`${j.id} 시주 없으면 보류(또는 時 전에 성립)`, 걸림 !== 보류, JSON.stringify(무시.보류));
  }
}
// 조문 수 — 원문 女命 줄 8곳 가운데 명례 꼬리표(1523행) 하나를 뺀 7
확인('여명 조문 7건', GJ.여명조문.length === 7, String(GJ.여명조문.length));
// 여명 조문은 주판정·그밖의판정에 섞이지 않는다
for (const j of GJ.여명조문) { const r = GJ.analyze(시험[j.id], { 성별: '여' }); 확인(`${j.id} 주판정 아님`, (!r.주판정 || !r.주판정.id.startsWith('GT-女')) && !r.그밖의판정.some(x => x.id.startsWith('GT-女'))); }

console.log(`여명 조문 검사: 통과 ${통과} · 실패 ${실패.length}`);
실패.forEach(x => console.log('  실패:', x));
if (실패.length) process.exitCode = 1;
