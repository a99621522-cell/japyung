/**
 * scripts/gungtong_cells_review.js — 궁통보감 120칸 검토표 만들기 (8차, 2026-10-07)
 *
 *   node scripts/gungtong_cells_review.js [--top 10] [--out docs/gungtong_cells_review.md]
 *
 * 칸(일간 10 × 월 12)마다 현실 전수(scripts/gungtong_reach.js 와 같은 생성법 — 년간 10 × 년지·일지·시지, 월간은 월두법·시간은 시두법, 반월은 시지 홀짝으로 절입 5/20일 —
 * 에 더해 년주·일주가 60갑자이므로 년지는 년간과, 일지는 일간과 같은 음양만: 10 × 6 × 6 × 12 = 4,320/칸. reach 는 일지 12를 다 돌리므로 癸子 같은 없는 일주도 센다)를
 * 돌려 **주판정 조문별로 묶고** 가장 흔한 묶음 10개(기본)를 고른다. 묶음마다 대표 명식 하나(그 묶음에서 처음 나온 것)를
 * 적어, 운영자가 칸을 훑으며 「이 배합에 이 조문이 주판정인 것이 원문과 맞는가」를 보게 한다.
 * 표의 판정어는 표시금지(질병·수명·여명)·등급어·흉단어를 가린다(gungtong_jomun 의 표시금지 꼴과 gungtong_un.표시금지식 재사용 + 등급·흉단 목록).
 * 사람을 평가하는 문서가 아니다 — 지어낸 명식(월두·시두법만 맞춘 것)으로 엔진의 판정 분포를 보는 표다.
 */
const fs = require('fs'), path = require('path');
const 뿌리 = path.join(__dirname, '..');
const GJ = require(path.join(뿌리, 'gungtong_jomun'));
const G = require(path.join(뿌리, 'gungtong'));
const GU = require(path.join(뿌리, 'gungtong_un'));

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TOP = +opt('--top', 10);
const OUT = opt('--out', path.join(뿌리, 'docs', 'gungtong_cells_review.md'));

const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const JI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const 월지순 = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
const 월이름 = { 寅:'正月', 卯:'二月', 辰:'三月', 巳:'四月', 午:'五月', 未:'六月', 申:'七月', 酉:'八月', 戌:'九月', 亥:'十月', 子:'十一月', 丑:'十二月' };
const 월간of = (년간, 월지) => GAN[((GAN.indexOf(년간) % 5) * 2 + 2 + 월지순.indexOf(월지)) % 10];
const 같은음양 = (간, 지) => GAN.indexOf(간) % 2 === JI.indexOf(지) % 2;   // 60갑자 — 양간은 양지, 음간은 음지
const 시간of = (일간, 시지) => GAN[((GAN.indexOf(일간) % 5) * 2 + JI.indexOf(시지)) % 10];

// 판정어 가림 — 표시금지식(질병·수명·여명) + 등급어·흉단어. 가린 자리에는 방향만 남는다
const 가림식 = new RegExp(GU.표시금지식.source + '|上格|下格|上命|上上|中人|下品|下流|庸|愚|鄙|貧|孤|凶|兇|僧道|刑|淫|奸|狡|盜|嫖|酒色|無用|勞苦|困|寒|薄|殘|零丁|奔波|剛暴|敗德|不測|遭凶|無良|流蕩|離鄉|過繼|光棍|痞棍|小人|俗子|徒|皂隸|隸|奴|鰥|寡|乞');
const 보이는판정어 = j => {
  if (!j) return '';
  if (j.표시금지 || 가림식.test(String(j.판정어 || '')) || 가림식.test(String(j.원문 || ''))) return '(판정어 비공개 — 정책)';
  return j.판정어;
};
const 축표 = 축 => 축 ? `${축.부 ?? '·'}/${축.귀 ?? '·'}` : '·/·';
const 명조 = m => m.yeonGan + m.yeonJi + ' ' + m.wolGan + m.wolJi + ' ' + m.ilGan + m.ilJi + ' ' + m.siGan + m.siJi;
const 상태약 = { 투출통근:'투', 투출무근:'투(무근)', 암장:'장', 없음:'무' };
const 용신요약 = a => a.용신상태.filter(x => x.역할 !== '기').map(x => `${x.글자}${상태약[x.상태] || x.상태}${x.손상.length ? '!' : ''}`).join(' ');

const L = [];
L.push('# 궁통보감 120칸 검토표 (8차, 2026-10-07)');
L.push('');
L.push('`node scripts/gungtong_cells_review.js` 가 만든다. 손으로 고치지 말고, 의견은 맨 아래 「의견 적는 칸」에 적는다.');
L.push('');
L.push('## 읽는 법');
L.push('');
L.push('- 칸마다 **현실 전수 4,320 명식**(년간 10 × 년지 6 × 일지 6 × 시지 12 — 년주·일주는 60갑자라 년간·일간과 같은 음양의 지지만, 월간은 월두법·시간은 시두법: 실제로 있을 수 있는 명식 전부. 반월은 시지 홀짝으로 절입 5일/20일)을 돌려 **주판정 조문별로 묶고 가장 흔한 묶음 ' + TOP + '개**를 적었다. 「비율」은 그 칸 4,320 가운데 그 조문이 주판정인 명식의 비율, 「대표 명식」은 그 묶음에서 처음 나온 것이다(지어낸 명식, 실존 인물 아님).');
L.push('- **주판정** = `gungtong_jomun.analyze` 가 고른 조문(특수성 내림차순 → 원문 순). **판정어** = 원문 판정어 그대로 — 다만 질병·수명·여명 표시금지 조문과 등급어·흉단어가 든 판정어는 「(판정어 비공개 — 정책)」 로 가렸다(앱 원칙: 사람 등급·흉단은 어떤 출력에도 없다). 조문 id 로 `gungtong_jomun.js` 의 원문·결 번역을 찾아 읽을 것.');
L.push('- **방향** = 판정어의 결 열림 정도(으뜸·좋음·보통·평범·막힘, 사전에 없으면 「-」). **富/貴** = 두 축(+ 열림 · 0 그 쪽은 아님 · - 닫힘 · · 원문이 말하지 않음).');
L.push('- **갖춤** = `gungtong.analyze` 의 으뜸 글자 기준(온전·암장·손상·없음). **용신상태** = 용·보좌 글자마다 투(투출통근)·투(무근)·장(암장)·무(없음), `!` 는 손상(극·합거·설기) 있음.');
L.push('- 「주판정 없음」 묶음은 원문 조건절 어디에도 들지 않는 명식이다 — 그 칸의 조문이 원문 그대로 좁아서 생기는 것이지 오류가 아니다(reach 의 「주판정 없는 명식이 절반 넘는 칸」 참조).');
L.push('- 어긋난 판정을 찾으면: ① 그 행의 대표 명식과 조문 id ② 원문의 어느 줄이 다르게 읽히는지(docs/gungtong_wonmun.txt 줄 번호) ③ 바라는 주판정 — 을 「의견 적는 칸」에 적는다. 조문 조건·순서는 그 의견으로 고치고 verify_gungtong.js fixture 로 고정한다.');
L.push('');
L.push('## 의견 적는 칸');
L.push('');
L.push('| 칸 | 대표 명식 | 지금 주판정 | 원문 근거(줄) | 바라는 주판정 | 메모 |');
L.push('|---|---|---|---|---|---|');
L.push('| (예) 壬戌 | 丙申 戊戌 壬子 甲辰 | GT-壬戌-01 | 1915 | 그대로 | — |');
L.push('|  |  |  |  |  |  |');
L.push('|  |  |  |  |  |  |');
L.push('');
L.push('## 칸별 표');
L.push('');

const 요약 = [];
for (const 일간 of GAN) {
  L.push(`## ${일간} 일간`);
  L.push('');
  for (const 월지 of 월지순) {
    const 칸 = G.칸(일간, 월지);
    const 묶음 = new Map();   // 주판정 id → { n, 대표:m, 주, a }
    let n = 0;
    for (const 년간 of GAN) for (const 년지 of JI) for (const 일지 of JI) for (const 시지 of JI) {
      if (!같은음양(년간, 년지) || !같은음양(일간, 일지)) continue;   // 없는 년주·일주는 뺀다
      const m = { yeonGan: 년간, yeonJi: 년지, wolGan: 월간of(년간, 월지), wolJi: 월지, ilGan: 일간, ilJi: 일지, siGan: 시간of(일간, 시지), siJi: 시지, daysFromJeolip: JI.indexOf(시지) % 2 ? 20 : 5 };
      const r = GJ.analyze(m); n++;
      const key = r.주판정 ? r.주판정.id : '(주판정 없음)';
      if (!묶음.has(key)) 묶음.set(key, { n: 0, 대표: m, 주: r.주판정, r });
      묶음.get(key).n++;
    }
    const 순 = [...묶음.entries()].sort((a, b) => b[1].n - a[1].n);
    const 없음n = 묶음.get('(주판정 없음)')?.n || 0;
    요약.push({ 칸: 일간 + 월지, 묶음수: 묶음.size, 없음비율: 없음n / n });
    L.push(`### ${일간}${월지} (${월이름[월지]}${일간}) — 용 ${칸.용.join('→')}${칸.기.length ? ` · 기 ${칸.기.join('·')}` : ''} · 주판정 묶음 ${묶음.size}개 · 주판정 없음 ${(100 * 없음n / n).toFixed(0)}%`);
    L.push('');
    L.push(`> ${칸.요지}`);
    L.push('');
    L.push('| # | 대표 명식 | 비율 | 주판정 | 판정어 | 방향 | 富/貴 | 갖춤 | 용신상태 |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    순.slice(0, TOP).forEach(([key, v], i) => {
      const a = G.analyze(v.대표);
      const 주 = v.주;
      L.push(`| ${i + 1} | ${명조(v.대표)} | ${(100 * v.n / n).toFixed(1)}% | ${key} | ${주 ? 보이는판정어(주) : '—'} | ${주 ? (주.방향 || '-') : '—'} | ${주 ? 축표(주.축) : '—'} | ${a.갖춤} | ${용신요약(a)} |`);
    });
    L.push('');
  }
}
L.push('## 칸 요약');
L.push('');
L.push('| 칸 | 주판정 묶음 수 | 주판정 없음 |');
L.push('|---|---|---|');
for (const s of 요약) L.push(`| ${s.칸} | ${s.묶음수} | ${(100 * s.없음비율).toFixed(0)}% |`);
L.push('');
const 본문 = L.join('\n') + '\n';
// 마지막 그물 — 표 전체에 표시금지 낱말이 없어야 한다
const 남은 = 본문.match(new RegExp(GU.표시금지식.source, 'g'));
if (남은) { console.error('표시금지 낱말이 표에 남음:', [...new Set(남은)].join(' ')); process.exitCode = 1; }
fs.writeFileSync(OUT, 본문);
console.log(`${OUT} — 칸 ${요약.length} · 묶음 상위 ${TOP} · 표시금지 낱말 ${남은 ? 남은.length : 0}`);
