/**
 * verify_gungtong.js — 궁통보감 검증 하네스
 *
 * 검증 세트 두 층:
 * ① 원전 명례 — 여춘태본 본문에 여덟 글자가 명시된 6건.
 *    검사: 표의 용신 = 원문 취용 / analyze 소재판정.
 * ② 서락오 평주(造化元鑰評註) 명례 — 1948 몰, 저작권 만료.
 *    평주는 판정 규칙의 출처가 아니다(규칙은 원전 본문 고정).
 *    명조 + 서락오의 透/藏/無 진술만 가져와, 우리 analyze의
 *    소재판정이 같은 것을 읽어내는지 대조한다.
 */
const G = require('./gungtong');

/* ── ① 원전 명례 ─────────────────────────────────── */
const 원전 = [
  { 출처: '正月甲木', 평: '庚申戊寅甲寅丙寅 發進士 (丙 투출)',
    m:{yeonGan:'庚',yeonJi:'申',wolGan:'戊',wolJi:'寅',ilGan:'甲',ilJi:'寅',siGan:'丙',siJi:'寅'},
    원문용신:['丙','癸'], 글자:'丙', 기대:'천간에 드러남' },
  { 출처: '九月甲木', 평: '甲辰甲戌甲辰甲戌 天元一氣 (조후로는 丁 부재)',
    m:{yeonGan:'甲',yeonJi:'辰',wolGan:'甲',wolJi:'戌',ilGan:'甲',ilJi:'辰',siGan:'甲',siJi:'戌'},
    원문용신:['丁','癸','庚'] },
  { 출처: '九月甲木', 평: '庚申丙戌甲申壬申 功名顯達',
    m:{yeonGan:'庚',yeonJi:'申',wolGan:'丙',wolJi:'戌',ilGan:'甲',ilJi:'申',siGan:'壬',siJi:'申'},
    원문용신:['丁','癸','庚'] },
  { 출처: '三月戊土', 평: '丁未癸卯戊寅乙卯 武科探花',
    m:{yeonGan:'丁',yeonJi:'未',wolGan:'癸',wolJi:'卯',ilGan:'戊',ilJi:'寅',siGan:'乙',siJi:'卯'},
    원문용신:['丙','甲','癸'] },
  { 출처: '五月戊土', 평: '辛未甲午戊寅壬子 壬甲兩透 出將入相',
    m:{yeonGan:'辛',yeonJi:'未',wolGan:'甲',wolJi:'午',ilGan:'戊',ilJi:'寅',siGan:'壬',siJi:'子'},
    원문용신:['壬','甲','丙'], 글자:'壬', 기대:'천간에 드러남' },
  { 출처: '三月癸水', 평: '辛卯壬辰癸未丙辰 上半月 用丙顯達',
    m:{yeonGan:'辛',yeonJi:'卯',wolGan:'壬',wolJi:'辰',ilGan:'癸',ilJi:'未',siGan:'丙',siJi:'辰'},
    원문용신:['丙','辛','甲'], 글자:'丙', 기대:'천간에 드러남' },
];

/* ── ② 평주 명례 — 국학전적망 수록 造化元鑰評註에서 채록 ── */
const 평주 = [
  // 甲木
  { 출처:'二月甲木', 평:'蕭耀南 乙亥己卯甲申乙亥 — 살(庚)이 申에 암장, 제인득력',
    m:{yeonGan:'乙',yeonJi:'亥',wolGan:'己',wolJi:'卯',ilGan:'甲',ilJi:'申',siGan:'乙',siJi:'亥'},
    글자:'庚', 기대:'지지에 숨음' },
  { 출처:'二月甲木', 평:'順治帝 戊寅乙卯甲午甲戌 — 화국에 물이 없어 戊로 설기(투출)',
    m:{yeonGan:'戊',yeonJi:'寅',wolGan:'乙',wolJi:'卯',ilGan:'甲',ilJi:'午',siGan:'甲',siJi:'戌'},
    글자:'戊', 기대:'천간에 드러남' },
  // 庚金 — 12개월
  { 출처:'正月庚金', 평:'王占元 辛酉庚寅庚子己卯 — 專用丙火(寅 암장)',
    m:{yeonGan:'辛',yeonJi:'酉',wolGan:'庚',wolJi:'寅',ilGan:'庚',ilJi:'子',siGan:'己',siJi:'卯'},
    글자:'丙', 기대:'지지에 숨음' },
  { 출처:'正月庚金', 평:'陳調元 丙寅庚寅庚戌乙酉 — 專用丙火(투출)',
    m:{yeonGan:'丙',yeonJi:'寅',wolGan:'庚',wolJi:'寅',ilGan:'庚',ilJi:'戌',siGan:'乙',siJi:'酉'},
    글자:'丙', 기대:'천간에 드러남' },
  { 출처:'二月庚金', 평:'庚申己卯庚寅丁丑 — 丁透甲藏, 지현·거부',
    m:{yeonGan:'庚',yeonJi:'申',wolGan:'己',wolJi:'卯',ilGan:'庚',ilJi:'寅',siGan:'丁',siJi:'丑'},
    글자:'丁', 기대:'천간에 드러남' },
  { 출처:'二月庚金', 평:'辛丑辛卯庚寅庚辰 — 無丁火 故貴輕(무거·가부)',
    m:{yeonGan:'辛',yeonJi:'丑',wolGan:'辛',wolJi:'卯',ilGan:'庚',ilJi:'寅',siGan:'庚',siJi:'辰'},
    글자:'丁', 기대:'없음' },
  { 출처:'二月庚金', 평:'張作霖 乙亥己卯庚辰丁丑 — 專用丁火(투출), 대원수',
    m:{yeonGan:'乙',yeonJi:'亥',wolGan:'己',wolJi:'卯',ilGan:'庚',ilJi:'辰',siGan:'丁',siJi:'丑'},
    글자:'丁', 기대:'천간에 드러남' },
  { 출처:'三月庚金', 평:'庚繼堯 庚辰庚辰庚辰丁亥 — 丁火出干 亥宮藏甲, 도독',
    m:{yeonGan:'庚',yeonJi:'辰',wolGan:'庚',wolJi:'辰',ilGan:'庚',ilJi:'辰',siGan:'丁',siJi:'亥'},
    글자:'甲', 기대:'지지에 숨음' },
  { 출처:'四月庚金', 평:'錢應溥 甲申己巳庚午戊寅 — 專用申宮壬水, 군기처',
    m:{yeonGan:'甲',yeonJi:'申',wolGan:'己',wolJi:'巳',ilGan:'庚',ilJi:'午',siGan:'戊',siJi:'寅'},
    글자:'壬', 기대:'지지에 숨음' },
  { 출처:'四月庚金', 평:'楊樹莊 壬午乙巳庚戌辛巳 — 壬水出干制火, 해군총장',
    m:{yeonGan:'壬',yeonJi:'午',wolGan:'乙',wolJi:'巳',ilGan:'庚',ilJi:'戌',siGan:'辛',siJi:'巳'},
    글자:'壬', 기대:'천간에 드러남' },
  { 출처:'五月庚金', 평:'庚申壬午庚寅壬午 — 兩干不雜 專用庚壬, 지부',
    m:{yeonGan:'庚',yeonJi:'申',wolGan:'壬',wolJi:'午',ilGan:'庚',ilJi:'寅',siGan:'壬',siJi:'午'},
    글자:'壬', 기대:'천간에 드러남' },
  { 출처:'六月庚金', 평:'丙辰乙未庚申丁亥 — 丁透甲藏, 일방·거부',
    m:{yeonGan:'丙',yeonJi:'辰',wolGan:'乙',wolJi:'未',ilGan:'庚',ilJi:'申',siGan:'丁',siJi:'亥'},
    글자:'丁', 기대:'천간에 드러남' },
  { 출처:'六月庚金', 평:'熊希齡 庚午癸未庚申丁亥 — 丁透 專用丁火, 총리',
    m:{yeonGan:'庚',yeonJi:'午',wolGan:'癸',wolJi:'未',ilGan:'庚',ilJi:'申',siGan:'丁',siJi:'亥'},
    글자:'丁', 기대:'천간에 드러남' },
  { 출처:'七月庚金', 평:'癸巳庚申庚申丁亥 — 用丁火, 부윤',
    m:{yeonGan:'癸',yeonJi:'巳',wolGan:'庚',wolJi:'申',ilGan:'庚',ilJi:'申',siGan:'丁',siJi:'亥'},
    글자:'丁', 기대:'천간에 드러남' },
  { 출처:'八月庚金', 평:'乾隆帝 辛卯丁酉庚午丙子 — 丁火出干 살인격, 60년 태평천자',
    m:{yeonGan:'辛',yeonJi:'卯',wolGan:'丁',wolJi:'酉',ilGan:'庚',ilJi:'午',siGan:'丙',siJi:'子'},
    글자:'丁', 기대:'천간에 드러남' },
  { 출처:'九月庚金', 평:'辛酉戊戌庚申甲申 — 戊土出干 用甲破土, 상서',
    m:{yeonGan:'辛',yeonJi:'酉',wolGan:'戊',wolJi:'戌',ilGan:'庚',ilJi:'申',siGan:'甲',siJi:'申'},
    글자:'甲', 기대:'천간에 드러남' },
  { 출처:'九月庚金', 평:'壬申庚戌庚戌戊寅 — 甲藏戊透 貴居中等, 양도',
    m:{yeonGan:'壬',yeonJi:'申',wolGan:'庚',wolJi:'戌',ilGan:'庚',ilJi:'戌',siGan:'戊',siJi:'寅'},
    글자:'甲', 기대:'지지에 숨음' },
  { 출처:'十月庚金', 평:'張凱嵩 庚辰丁亥庚子庚辰 — 丁火煅金, 순무',
    m:{yeonGan:'庚',yeonJi:'辰',wolGan:'丁',wolJi:'亥',ilGan:'庚',ilJi:'子',siGan:'庚',siJi:'辰'},
    글자:'丁', 기대:'천간에 드러남' },
  { 출처:'十一月庚金', 평:'甲子丙子庚午壬午 — 丙 투출·丁 午 암장, 무거',
    m:{yeonGan:'甲',yeonJi:'子',wolGan:'丙',wolJi:'子',ilGan:'庚',ilJi:'午',siGan:'壬',siJi:'午'},
    글자:'丁', 기대:'지지에 숨음' },
  { 출처:'十一月庚金', 평:'史量才 己卯丙子庚寅辛巳 — 有丙無丁 富而權(보도왕)',
    m:{yeonGan:'己',yeonJi:'卯',wolGan:'丙',wolJi:'子',ilGan:'庚',ilJi:'寅',siGan:'辛',siJi:'巳'},
    글자:'丁', 기대:'없음' },
  { 출처:'十二月庚金', 평:'李開先 辛未辛丑庚辰丁丑 — 有丁甲無丙 不富自貴, 순안사',
    m:{yeonGan:'辛',yeonJi:'未',wolGan:'辛',wolJi:'丑',ilGan:'庚',ilJi:'辰',siGan:'丁',siJi:'丑'},
    글자:'丙', 기대:'없음' },
  { 출처:'十二月庚金', 평:'張載陽 癸酉乙丑庚寅丙子 — 丙火通根於寅(투출), 성장',
    m:{yeonGan:'癸',yeonJi:'酉',wolGan:'乙',wolJi:'丑',ilGan:'庚',ilJi:'寅',siGan:'丙',siJi:'子'},
    글자:'丙', 기대:'천간에 드러남' },
];

/* ③ 존재 판정의 한계를 보여주는 평주 명례 — 통과 여부와 무관하게 기록 */
const 한계 = [
  { 출처:'八月庚金', 평:'癸丑辛酉庚子丁亥 — 丁이 떠 있으나 癸가 상해 刑克孤貧. ' +
    '존재로는 「온전」이지만 용신 손상(癸傷丁) 규칙이 아직 없어 이 흉을 못 읽는다.',
    m:{yeonGan:'癸',yeonJi:'丑',wolGan:'辛',wolJi:'酉',ilGan:'庚',ilJi:'子',siGan:'丁',siJi:'亥'} },
];

let 표일치=0, 표검사=0, 소재일치=0, 소재검사=0, 틀=[];
function 검사(f) {
  const r = G.analyze(f.m);
  if (!r) { 틀.push(`${f.출처}: analyze 실패`); return; }
  if (f.원문용신) {
    표검사++;
    if (JSON.stringify(r.칸.용)===JSON.stringify(f.원문용신)) 표일치++;
    else 틀.push(`${f.출처}: 표 [${r.칸.용}] vs 원문 [${f.원문용신}]`);
  }
  if (f.글자) {
    소재검사++;
    const e = r.평가.find(x=>x.글자===f.글자);
    if (!e) 틀.push(`${f.출처}: ${f.글자}가 표의 용신 목록에 없음 [${r.칸.용}]`);
    else if (e.상태===f.기대) 소재일치++;
    else 틀.push(`${f.출처}: ${f.글자} 소재 ${e.상태} (평주 기대 ${f.기대})`);
  }
}
원전.forEach(검사); 평주.forEach(검사);

/* ── ④ 조건절 머리(gungtong_jomun.js) ↔ 표(gungtong.js) 글자 집합 대조 (2026-10-07) ──
 *    조후표가 두 벌이라(표: 재고조사 / 조문: 조건절) 같은 명식에 다른 용신 목록이 나가면 안 된다.
 *    120칸 전부: 용 글자 집합이 같고, 기(忌)는 글자(+多)뿐이며 용과 겹치지 않는다. */
const GJ = require('./gungtong_jomun');
const 월들 = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
let 머리일치 = 0, 머리검사 = 0;
for (const 일간 of Object.keys(G.표)) for (const 월 of 월들) {
  머리검사++;
  const 칸 = GJ.표[일간]?.[월];
  if (!칸) { 틀.push(`${일간}${월}: 조문 머리 없음`); continue; }
  const a = [...칸.용].sort().join(''), b = [...G.표[일간][월].용].sort().join('');
  const 기 = (칸.기 || []).map(g => g.replace(/多$/, ''));
  const 기형식 = 기.every(g => g.length === 1);
  const 겹침 = 기.filter(g => 칸.용.includes(g));
  if (a === b && 기형식 && !겹침.length) 머리일치++;
  else 틀.push(`${일간}${월}: 조문 머리 용 [${칸.용}] vs 표 [${G.표[일간][월].용}]${기형식 ? '' : ' · 기에 글자 아닌 항목'}${겹침.length ? ' · 기∩용 ' + 겹침 : ''}`);
}

/* ── ⑤ 조문 fixture — 2026-10-07 점검에서 고친 조문이 실제로 걸리는지 (명식은 조건을 맞추려 지은 것, 실존 인물 아님) ── */
const 걸린id = r => r && !r.해당없음 ? [r.주판정, ...r.그밖의판정, ...r.바탕, ...r.흠, ...r.완화].filter(Boolean).map(x => x.id) : [];
const 조문fx = [
  { 이름:'乙申-02 己·丙 투출 → 上命(이전엔 !透己라 己 쓰는 조문이 己 없음을 요구)',
    m:{yeonGan:'丙',yeonJi:'子',wolGan:'甲',wolJi:'申',ilGan:'乙',ilJi:'亥',siGan:'己',siJi:'卯'}, 주판정:'GT-乙申-02' },
  { 이름:'乙申-01 丙 투출+巳 → 科甲(己 요구 제거)',
    m:{yeonGan:'丙',yeonJi:'寅',wolGan:'甲',wolJi:'申',ilGan:'乙',ilJi:'巳',siGan:'丁',siJi:'亥'}, 주판정:'GT-乙申-01' },
  { 이름:'乙夏-11 一派戊土·不見比肩 → 富屋貧人(이전엔 비겁 있음을 요구)',
    m:{yeonGan:'戊',yeonJi:'戌',wolGan:'戊',wolJi:'午',ilGan:'乙',ilJi:'丑',siGan:'己',siJi:'巳'}, 포함:'GT-乙夏-11' },
  { 이름:'乙午-02 년간 庚 + 시간 癸 → 科甲',
    m:{yeonGan:'庚',yeonJi:'申',wolGan:'壬',wolJi:'午',ilGan:'乙',ilJi:'未',siGan:'癸',siJi:'未'}, 포함:'GT-乙午-02' },
  { 이름:'乙午-02 년간 庚인데 시간 癸 없음 → 안 걸림(이전엔 년간만 보고 걸렸다)',
    m:{yeonGan:'庚',yeonJi:'申',wolGan:'壬',wolJi:'午',ilGan:'乙',ilJi:'未',siGan:'丁',siJi:'丑'}, 불포함:'GT-乙午-02' },
  { 이름:'辛巳-03 壬癸皆藏·戊己亦藏 → 略富(이전엔 癸가 藏이 아닐 것을 요구)',
    m:{yeonGan:'甲',yeonJi:'申',wolGan:'丁',wolJi:'巳',ilGan:'辛',ilJi:'亥',siGan:'乙',siJi:'未'}, 포함:'GT-辛巳-03' },
  { 이름:'辛酉-05 一派辛金·一位壬水·無庚 → 富中取貴(이전엔 壬 투출 0을 요구)',
    m:{yeonGan:'辛',yeonJi:'丑',wolGan:'丁',wolJi:'酉',ilGan:'辛',ilJi:'卯',siGan:'壬',siJi:'辰'}, 포함:'GT-辛酉-05' },
  { 이름:'癸申-04 一丁坐午 — 丁 하나가 년간, 午는 시지(이전엔 일지 午만)',
    m:{yeonGan:'丁',yeonJi:'卯',wolGan:'庚',wolJi:'申',ilGan:'癸',ilJi:'丑',siGan:'乙',siJi:'午'}, 포함:'GT-癸申-04' },
  { 이름:'戊戌-01 見金·癸丙 투출 → 雲程(이전엔 甲丙癸 삼투를 요구)',
    m:{yeonGan:'癸',yeonJi:'酉',wolGan:'丙',wolJi:'戌',ilGan:'戊',ilJi:'子',siGan:'辛',siJi:'酉'}, 주판정:'GT-戊戌-01' },
  { 이름:'庚亥 丁甲 투출+丙 藏+물국 아님 → 桃浪이 주판정(이전엔 -01 一榜에 가려짐)',
    m:{yeonGan:'丁',yeonJi:'巳',wolGan:'辛',wolJi:'亥',ilGan:'庚',ilJi:'申',siGan:'甲',siJi:'申'}, 주판정:'GT-庚亥-02' },
  { 이름:'丙卯-07 판정어 없는 조문 — 주판정은 되되 방향 null·결말 문자열',
    m:{yeonGan:'戊',yeonJi:'辰',wolGan:'戊',wolJi:'卯',ilGan:'丙',ilJi:'戌',siGan:'戊',siJi:'戌'}, 주판정:'GT-丙卯-07', 판정어없음:true },
  { 이름:'甲巳 머리 — 庚이 용에 있고 기에 없음 (이전엔 기 庚多·용에 庚 없음인데 GT-甲巳-01이 庚透를 요구)',
    m:{yeonGan:'癸',yeonJi:'卯',wolGan:'丁',wolJi:'巳',ilGan:'甲',ilJi:'子',siGan:'庚',siJi:'午'}, 주판정:'GT-甲巳-01', 용포함:'庚' },
];
let fx일치 = 0;
for (const f of 조문fx) {
  const r = GJ.analyze(f.m); const ids = 걸린id(r); let ok = true;
  if (f.주판정 && r.주판정?.id !== f.주판정) { ok = false; 틀.push(`${f.이름}: 주판정 ${r.주판정?.id} (기대 ${f.주판정})`); }
  if (f.포함 && !ids.includes(f.포함)) { ok = false; 틀.push(`${f.이름}: ${f.포함} 안 걸림 [${ids}]`); }
  if (f.불포함 && ids.includes(f.불포함)) { ok = false; 틀.push(`${f.이름}: ${f.불포함} 이 걸림`); }
  if (f.판정어없음 && !(r.주판정 && /원문 판정어 없음/.test(r.주판정.판정어) && r.주판정.방향 === null && typeof r.주판정.결말 === 'string')) { ok = false; 틀.push(`${f.이름}: 판정어/방향/결말 처리 다름`); }
  if (f.용포함 && !(r.용.includes(f.용포함) && !r.기.some(g => g.replace(/多$/, '') === f.용포함))) { ok = false; 틀.push(`${f.이름}: 용 [${r.용}] 기 [${r.기}]`); }
  if (ok) fx일치++;
}
// 인용문 교체 확인 — 丁午-06 은 「支成火局」 조문이지 「無火局」이 아니다
{ const j = GJ.표.丁.午.조문.find(x => x.id === 'GT-丁午-06');
  if (!j || !/支成火局/.test(j.원문) || /無火局/.test(j.원문)) 틀.push('丁午-06: 인용문이 원문 두 문장을 잘못 이은 옛 것'); else fx일치++; }
const fx검사 = 조문fx.length + 1;

console.log('══════════════════════════════════════════');
console.log(`궁통보감 — 표 대조 ${G.진행().됨}/120칸 (판본 2종 일치)`);
console.log(`원전 명례 ${원전.length}건 · 평주 명례 ${평주.length}건`);
console.log(`  표일치 ${표일치}/${표검사} · 소재판정(透/藏/無) ${소재일치}/${소재검사}`);
console.log(`  조문 머리↔표 글자 집합 ${머리일치}/${머리검사}칸 · 조문 fixture ${fx일치}/${fx검사}`);
틀.forEach(x=>console.log('  불일치:', x));
for (const f of 한계) {
  const r = G.analyze(f.m);
  console.log(`  [한계 기록] ${f.출처}: 갖춤=${r.갖춤} — ${f.평}`);
}
if (틀.length) process.exitCode = 1;
