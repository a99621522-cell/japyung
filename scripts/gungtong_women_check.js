/**
 * scripts/gungtong_women_check.js — 여명(女命)·질병(8차) 조문 검사 (2026-10-07)
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

// ── 질병·수명 조문 검사 (8차, 2026-10-07) ─────────────────────────────
//   ① 질병조문 11건: 조건을 맞춘 명식에서 성별과 무관하게 `질병[]` 에 걸리고, 주판정·그밖의판정에는 섞이지 않는다
//   ② 그 출력(질병 항목·브리프줄 전체·analyze 결과 전체)에 질병·수명 낱말(疾·病·目·盲·聾·啞·瞽·殘·夭·死·亡)이 없다 — 「死處逢生」「病不遇葯」류 격·흠 이름은 예외
//   ③ 칸 조문 가운데 원문·판정어에 그 낱말이 든 것은 전부 표시금지 플래그를 받았고(집합 고정), 그 조문이 걸린 출력에도 낱말이 없다
const 질병금지 = /疾|(?<!為|之|受|有)病(?!不遇葯|無葯)|目|盲|聾|啞|瞽|殘|夭|死(?!處逢生|金)|亡/;   // 「癸為病」「甲反受病」「有病無葯」「病不遇葯」은 흠이라는 뜻의 병
const 질병시험 = {
  'GT-記-甲春-01': { yeonGan:'庚', yeonJi:'寅', wolGan:'戊', wolJi:'寅', ilGan:'甲', ilJi:'午', siGan:'甲', siJi:'戌' },   // 寅午戌 火局
  'GT-記-甲酉-02': { yeonGan:'庚', yeonJi:'巳', wolGan:'乙', wolJi:'酉', ilGan:'甲', ilJi:'丑', siGan:'丁', siJi:'卯' },   // 巳酉丑 金局 · 庚 透 · 丁 透
  'GT-記-丙寅-03': { yeonGan:'癸', yeonJi:'巳', wolGan:'庚', wolJi:'寅', ilGan:'丙', ilJi:'午', siGan:'戊', siJi:'戌' },   // 無壬 · 癸 透無根
  'GT-記-丙午-04': { yeonGan:'癸', yeonJi:'巳', wolGan:'戊', wolJi:'午', ilGan:'丙', ilJi:'戌', siGan:'丁', siJi:'酉' },   // 癸 하나 · 無壬 · 火 多
  'GT-記-戊午-05': { yeonGan:'癸', yeonJi:'寅', wolGan:'戊', wolJi:'午', ilGan:'戊', ilJi:'戌', siGan:'庚', siJi:'申' },   // 火局 · 癸 透 · 壬 없음
  'GT-記-己夏-06': { yeonGan:'壬', yeonJi:'午', wolGan:'丁', wolJi:'巳', ilGan:'己', ilJi:'巳', siGan:'庚', siJi:'午' },   // 火 多 · 壬 透(無根) · 庚 透
  'GT-記-庚辰-07': { yeonGan:'丙', yeonJi:'寅', wolGan:'庚', wolJi:'辰', ilGan:'庚', ilJi:'午', siGan:'丁', siJi:'戌' },   // 火局 · 丙丁 透 · 無壬
  'GT-記-壬巳-08': { yeonGan:'癸', yeonJi:'巳', wolGan:'丁', wolJi:'巳', ilGan:'壬', ilJi:'午', siGan:'丙', siJi:'午' },   // 無壬 · 火 多 · 木 적음 · 癸 透
  'GT-記-壬巳-09': { yeonGan:'庚', yeonJi:'申', wolGan:'辛', wolJi:'巳', ilGan:'壬', ilJi:'寅', siGan:'庚', siJi:'申' },   // 金 多 · 寅 · 甲 不透
  'GT-記-癸寅-10': { yeonGan:'丙', yeonJi:'午', wolGan:'戊', wolJi:'寅', ilGan:'癸', ilJi:'巳', siGan:'己', siJi:'未' },   // 火 多 · 土 多
  'GT-記-癸巳-11': { yeonGan:'丙', yeonJi:'午', wolGan:'己', wolJi:'巳', ilGan:'癸', ilJi:'未', siGan:'戊', siJi:'戌' },   // 火土 多 · 辛 없음 · 비겁 없음
};
const 걸린id = r => [r.주판정, ...r.그밖의판정, ...r.바탕, ...r.흠, ...r.완화].filter(Boolean).map(x => x.id);
확인('질병조문 11건', GJ.질병조문.length === 11, String(GJ.질병조문.length));
for (const j of GJ.질병조문) {
  const m = 질병시험[j.id];
  if (!m) { 실패.push(`${j.id}: 시험 명식 없음`); continue; }
  for (const [이름, opt] of [['여', { 성별:'여' }], ['남', { 성별:'남' }], ['성별 없음', {}]]) {
    const r = GJ.analyze(m, opt);
    확인(`${j.id} ${이름}에서 질병[] 에 걸림`, r.질병.some(x => x.id === j.id), `질병 ${JSON.stringify(r.질병.map(x => x.id))} 보류 ${JSON.stringify(r.보류)}`);
    확인(`${j.id} ${이름} 주판정·그밖의판정 아님`, !걸린id(r).includes(j.id));
    const 출력 = JSON.stringify(r) + '\n' + GJ.브리프줄(r).join('\n');
    확인(`${j.id} ${이름} 출력에 질병·수명 낱말 없음`, !질병금지.test(출력), (출력.match(질병금지) || [])[0]);
    확인(`${j.id} ${이름} 브리프줄에 질병 항목 없음`, !/질병|비공개/.test(GJ.브리프줄(r).filter(l => !/판정:|함께 걸린|바탕:|흠:|완화:/.test(l)).join('\n')) && !GJ.브리프줄(r).some(l => l.includes(j.id)));
  }
  const 항목 = GJ.analyze(m).질병.find(x => x.id === j.id) || {};
  확인(`${j.id} 원문 비공개·결에 낱말 없음`, 항목.원문 === GJ.비공개원문 && 항목.표시금지 === true && 항목.유형 === '질병' && !질병금지.test(j.결) && 질병금지.test(j.근거));
}
// 칸 조문 표시금지 집합 — 원문·판정어에 질병·수명 낱말이 든 조문 전부(고정 목록). 조문을 더하거나 원문을 고치면 이 목록도 같이 고친다
const 기대표시금지 = ['GT-甲寅-05','GT-甲寅-06','GT-甲寅-11','GT-甲寅-16','GT-甲夏-06','GT-甲酉-15','GT-甲秋-04','GT-甲子-09','GT-乙辰-08','GT-乙巳-04','GT-乙午-03','GT-乙子-13','GT-丙戌-07','GT-丁寅-01','GT-丁辰-04','GT-戊辰-12','GT-己寅-06','GT-己辰-08','GT-庚寅-09','GT-辛辰-10','GT-癸子-07','GT-癸丑-10'];
const 월들 = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
const 실제 = new Map();
for (const 일 of Object.keys(GJ.표)) for (const 월 of 월들) for (const j of GJ.표[일][월].조문) {
  if (j.표시금지) 실제.set(j.id, j);
  else 확인(`${j.id} 표시금지 아닌 조문에 질병·수명 낱말 없음`, !질병금지.test(String(j.원문) + String(j.판정)), (String(j.원문) + String(j.판정)).match(질병금지)?.[0]);
}
확인('칸 조문 표시금지 집합 고정', JSON.stringify([...실제.keys()].sort()) === JSON.stringify(기대표시금지.slice().sort()), `실제 ${[...실제.keys()].sort()} / 기대 ${기대표시금지.slice().sort()}`);
for (const j of 실제.values()) { 확인(`${j.id} 유형`, /^(질병|수명|질병·수명)$/.test(j.유형), j.유형); 확인(`${j.id} 결 번역에 낱말 없음`, !질병금지.test(j.결), (String(j.결).match(질병금지) || [])[0]); }
// 표시금지 칸 조문이 걸린 출력 — 甲秋-04(殘疾)·丁寅-01(非貧即夭)·乙午-03(殘疾·夭)
for (const [id, m] of Object.entries({
  'GT-甲秋-04': { yeonGan:'庚', yeonJi:'申', wolGan:'甲', wolJi:'申', ilGan:'甲', ilJi:'辰', siGan:'戊', siJi:'辰' },
  'GT-丁寅-01': { yeonGan:'甲', yeonJi:'寅', wolGan:'壬', wolJi:'寅', ilGan:'丁', ilJi:'卯', siGan:'甲', siJi:'辰' },
  'GT-乙午-03': { yeonGan:'丙', yeonJi:'寅', wolGan:'甲', wolJi:'午', ilGan:'乙', ilJi:'巳', siGan:'丙', siJi:'戌' },
})) {
  const r = GJ.analyze(m); const 출력 = JSON.stringify(r) + '\n' + GJ.브리프줄(r).join('\n');
  확인(`${id} 걸림`, 걸린id(r).includes(id), `[${걸린id(r)}]`);
  확인(`${id} 걸린 출력에 질병·수명 낱말 없음`, !질병금지.test(출력), (출력.match(질병금지) || [])[0]);
  const x = [r.주판정, ...r.그밖의판정, ...r.흠].find(y => y && y.id === id);
  확인(`${id} 가린 꼴`, x && x.표시금지 && x.원문 === GJ.비공개원문 && (x.판정어 == null || x.판정어 === GJ.비공개판정), JSON.stringify(x));
}

// ── 10차(2026-10-07) 원문 그대로 보기 — analyze 는 그대로 가리고, 원문보기() 만 원문을 돌려준다 (화면 전문가 토글 전용)
{
  const 금 = /疾|瞽|損目|殘病|災病|夭|死無|而亡|淫賤|刑夫|剋子|長舌|不生長/;
  const m1 = { yeonGan:'庚', yeonJi:'申', wolGan:'甲', wolJi:'申', ilGan:'甲', ilJi:'辰', siGan:'戊', siJi:'辰' };   // 甲秋-04 殘疾
  const m2 = { yeonGan:'庚', yeonJi:'寅', wolGan:'戊', wolJi:'寅', ilGan:'甲', ilJi:'午', siGan:'甲', siJi:'戌' };   // GT-記-甲春-01
  const v1 = GJ.원문보기(m1), v2 = GJ.원문보기(m2);
  확인('원문보기 — 甲秋-04 원문·판정어 그대로', v1.항목.some(z => z.id === 'GT-甲秋-04' && z.원문 === '或庚多無丁，殘疾之人' && z.판정어 === '殘疾' && z.자리 === '함께 걸린 조건'), JSON.stringify(v1.항목));
  확인('원문보기 — 질병 기록 GT-記-甲春-01 근거 원문·줄', v2.항목.some(z => z.id === 'GT-記-甲春-01' && z.줄 === 44 && 금.test(z.원문) && z.자리 === '질병 기록'), JSON.stringify(v2.항목));
  확인('원문보기 — 안내문(진단 아님·의료)', /진단이나 예측이 아니|의료 전문가/.test(v1.안내));
  확인('원문보기 뒤에도 analyze 는 가림', !금.test(JSON.stringify(GJ.analyze(m1))) && !금.test(JSON.stringify(GJ.analyze(m2))) && !금.test(GJ.브리프줄(GJ.analyze(m1)).join('\n')));
  확인('원문보기 — 표시금지 아닌 조문은 넣지 않음', v1.항목.every(z => z.유형 === '질병' || z.유형 === '수명' || z.유형 === '질병·수명' || z.유형 === '여명'));
}

console.log(`여명·질병 조문 검사: 통과 ${통과} · 실패 ${실패.length}`);
실패.forEach(x => console.log('  실패:', x));
if (실패.length) process.exitCode = 1;
