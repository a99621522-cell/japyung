/**
 * hapchung.js — 형충회합 판정 및 해법
 * 사주팔자집 · 자평진전 1단계 (2026-08-02)
 *
 * 「論刑衝會合解法」
 *   격을 정하기 '전에' 합충을 푼다. 순서가 반대면 격 자체가 틀린다.
 *   충은 합으로 풀리고(탐합망충), 합은 충으로 풀린다.
 */

const { GAN, JIJANGGAN, jeonggi } = require('./jijanggan');

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const YUKHAP = [ // 육합 → 화하는 오행
  { ji:['子','丑'], hwa:'土' }, { ji:['寅','亥'], hwa:'木' },
  { ji:['卯','戌'], hwa:'火' }, { ji:['辰','酉'], hwa:'金' },
  { ji:['巳','申'], hwa:'水' }, { ji:['午','未'], hwa:'土' },
];

const SAMHAP = [
  { ji:['申','子','辰'], hwa:'水', wang:'子' },
  { ji:['亥','卯','未'], hwa:'木', wang:'卯' },
  { ji:['寅','午','戌'], hwa:'火', wang:'午' },
  { ji:['巳','酉','丑'], hwa:'金', wang:'酉' },
];

const BANGHAP = [
  { ji:['寅','卯','辰'], hwa:'木', wang:'卯' }, { ji:['巳','午','未'], hwa:'火', wang:'午' },
  { ji:['申','酉','戌'], hwa:'金', wang:'酉' }, { ji:['亥','子','丑'], hwa:'水', wang:'子' },
];

const CHUNG = { 子:'午', 午:'子', 丑:'未', 未:'丑', 寅:'申', 申:'寅',
                卯:'酉', 酉:'卯', 辰:'戌', 戌:'辰', 巳:'亥', 亥:'巳' };

const SAMHYEONG = [
  { ji:['寅','巳','申'], name:'무은지형' },
  { ji:['丑','戌','未'], name:'지세지형' },
];
const SANGHYEONG = [{ ji:['子','卯'], name:'무례지형' }];
const JAHYEONG = ['辰','午','酉','亥'];

const PA = [['子','酉'],['卯','午'],['辰','丑'],['戌','未'],['寅','亥'],['巳','申']];
const HAE = [['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']];

const GANHAP = [
  { gan:['甲','己'], hwa:'土' }, { gan:['乙','庚'], hwa:'金' },
  { gan:['丙','辛'], hwa:'水' }, { gan:['丁','壬'], hwa:'木' },
  { gan:['戊','癸'], hwa:'火' },
];
const GANCHUNG = [['甲','庚'],['乙','辛'],['丙','壬'],['丁','癸']];

const POS_ORDER = ['년','월','일','시'];

// ─────────────────────────────────────────────
function pairsOf(list) {
  const out = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
  return out;
}

/** 두 자리가 붙어 있는가 (떨어진 합은 「論十干合而不合」에서 약하게 본다) */
function adjacent(p1, p2) {
  return Math.abs(POS_ORDER.indexOf(p1) - POS_ORDER.indexOf(p2)) === 1;
}

// ─────────────────────────────────────────────
// 지지 관계 탐지
// ─────────────────────────────────────────────
function detectJiji(jiPos) {
  const present = jiPos.filter(([, j]) => j);
  const found = { 육합:[], 삼합:[], 반합:[], 공합:[], 방합:[], 충:[], 형:[], 파:[], 해:[] };

  // 육합
  for (const [[pa, ja], [pb, jb]] of pairsOf(present)) {
    const h = YUKHAP.find(x => x.ji.includes(ja) && x.ji.includes(jb) && ja !== jb);
    if (h) found.육합.push({ 자리:[pa,pb], 지지:[ja,jb], 화:h.hwa, 인접:adjacent(pa,pb) });
  }

  // 삼합 / 반합
  for (const s of SAMHAP) {
    const hit = present.filter(([, j]) => s.ji.includes(j));
    const uniq = [...new Set(hit.map(([, j]) => j))];
    if (uniq.length === 3) {
      found.삼합.push({ 자리:hit.map(([p]) => p), 지지:uniq, 화:s.hwa, 왕지:s.wang });
    } else if (uniq.length === 2 && uniq.includes(s.wang)) {
      found.반합.push({ 자리:hit.map(([p]) => p), 지지:uniq, 화:s.hwa, 왕지:s.wang });
    } else if (uniq.length === 2) {
      // 拱合 — 왕지 없이 生地와 墓地 둘만 모인 경우.
      //   원문 41편 나장원 「干頭之甲，通根於亥，然又**會未成局**，化水爲木」
      //   亥와 未 둘로 국을 이룬다고 명시한다. 왕지 卯가 없어도 局이 선다.
      //   다만 왕지가 있는 반합보다 약하므로 따로 표시한다.
      //   그리고 천간에 그 오행이 투출해 있어야 한다 — 「干頭之甲」이 그 조건이다.
      found.공합.push({ 자리:hit.map(([p]) => p), 지지:uniq, 화:s.hwa,
                        왕지없음:true, 빠진왕지:s.wang });
    }
  }

  // 방합
  for (const b of BANGHAP) {
    const hit = present.filter(([, j]) => b.ji.includes(j));
    const uniq = [...new Set(hit.map(([, j]) => j))];
    if (uniq.length === 3) found.방합.push({ 자리:hit.map(([p]) => p), 지지:uniq, 화:b.hwa, 왕지:b.wang });
  }

  // 충
  for (const [[pa, ja], [pb, jb]] of pairsOf(present))
    if (CHUNG[ja] === jb) found.충.push({ 자리:[pa,pb], 지지:[ja,jb], 인접:adjacent(pa,pb) });

  // 형
  for (const s of SAMHYEONG) {
    const hit = present.filter(([, j]) => s.ji.includes(j));
    const uniq = [...new Set(hit.map(([, j]) => j))];
    if (uniq.length === 3) found.형.push({ 종류:'삼형', name:s.name, 지지:uniq, 자리:hit.map(([p])=>p) });
    else if (uniq.length === 2) found.형.push({ 종류:'삼형 일부', name:s.name, 지지:uniq, 자리:hit.map(([p])=>p) });
  }
  for (const s of SANGHYEONG) {
    const hit = present.filter(([, j]) => s.ji.includes(j));
    if ([...new Set(hit.map(([, j]) => j))].length === 2)
      found.형.push({ 종류:'상형', name:s.name, 지지:s.ji, 자리:hit.map(([p])=>p) });
  }
  for (const z of JAHYEONG) {
    const hit = present.filter(([, j]) => j === z);
    if (hit.length >= 2) found.형.push({ 종류:'자형', name:`${z}${z}형`, 지지:[z,z], 자리:hit.map(([p])=>p) });
  }

  // 파 / 해
  for (const [[pa, ja], [pb, jb]] of pairsOf(present)) {
    if (PA.some(p => p.includes(ja) && p.includes(jb) && ja !== jb))
      found.파.push({ 자리:[pa,pb], 지지:[ja,jb] });
    if (HAE.some(p => p.includes(ja) && p.includes(jb) && ja !== jb))
      found.해.push({ 자리:[pa,pb], 지지:[ja,jb] });
  }

  return found;
}

// ─────────────────────────────────────────────
// 천간 관계
// ─────────────────────────────────────────────
function detectCheongan(ganPos) {
  const present = ganPos.filter(([, g]) => g);
  const 합 = [], 충 = [];

  for (const [[pa, ga], [pb, gb]] of pairsOf(present)) {
    const h = GANHAP.find(x => x.gan.includes(ga) && x.gan.includes(gb) && ga !== gb);
    if (h) 합.push({ 자리:[pa,pb], 천간:[ga,gb], 화:h.hwa, 인접:adjacent(pa,pb) });
    if (GANCHUNG.some(c => c.includes(ga) && c.includes(gb) && ga !== gb))
      충.push({ 자리:[pa,pb], 천간:[ga,gb], 인접:adjacent(pa,pb) });
  }

  // 쟁합·투합 — 한 글자를 둘이 다투면 합이 온전하지 않다 (論十干合而不合)
  const count = {};
  for (const h of 합) for (const g of h.천간) count[g] = (count[g] ?? 0) + 1;
  for (const h of 합) h.쟁합 = h.천간.some(g => count[g] > 1);

  return { 합, 충 };
}

// ─────────────────────────────────────────────
// 해법 — 탐합망충 / 충으로 합을 푼다
// ─────────────────────────────────────────────
function resolve(ji) {
  const 해소 = [];

  // ① 충하는 두 글자 중 하나가 다른 것과 합하면 충이 풀린다
  for (const c of ji.충) {
    const 합목록 = [...ji.육합, ...ji.삼합, ...ji.반합, ...ji.방합];
    const 걸림 = 합목록.find(h => h.지지.some(j => c.지지.includes(j)));
    if (걸림) {
      c.해소 = true;
      해소.push({ 종류:'탐합망충', 대상:`${c.지지.join('')}충`, 근거:`${걸림.지지.join('')}합에 걸려 충이 풀림` });
    }
  }

  // ② 합하는 두 글자 중 하나가 충당하면 합이 풀린다
  for (const h of [...ji.육합, ...ji.반합]) {
    const 걸림 = ji.충.find(c => !c.해소 && c.지지.some(j => h.지지.includes(j)));
    if (걸림) {
      h.해소 = true;
      해소.push({ 종류:'충으로 합을 품', 대상:`${h.지지.join('')}합`, 근거:`${걸림.지지.join('')}충으로 합이 풀림` });
    }
  }

  return 해소;
}

// ─────────────────────────────────────────────
// 월지 상태 — 격 취용에 직접 영향
// ─────────────────────────────────────────────
function woljiStatus(ji, wolJi, ganList) {
  const has = arr => arr.filter(x => x.지지?.includes(wolJi) && !x.해소);

  const 충 = has(ji.충);
  const 삼합 = has(ji.삼합);
  const 방합 = has(ji.방합);
  const 육합 = has(ji.육합);
  const 반합 = has(ji.반합);
  const 공합 = has(ji.공합 ?? []);

  // 자평진전은 월령이 합해도 쉽게 화하지 않는다고 본다.
  // 삼합·방합처럼 국을 이룬 경우만 '화(化)'로 취급한다.
  //
  // 拱合(왕지 없는 두 자)은 원문 41편 나장원 대목이 근거다 —
  //   「干頭之甲，通根於亥，然又會未成局，化水爲木」
  // 다만 조건이 있다. **천간에 그 오행이 투출**해 있어야 한다.
  //   甲이 천간에 있고 亥에 통근했기에 亥未가 木局으로 선 것이다.
  //   투출이 없으면 왕지도 없고 이끌 글자도 없으니 국이 서지 않는다.
  const OHAENG_GAN = { 木:['甲','乙'], 火:['丙','丁'], 土:['戊','己'], 金:['庚','辛'], 水:['壬','癸'] };
  const 공합유효 = 공합.filter(x =>
    (ganList ?? []).some(g => (OHAENG_GAN[x.화] ?? []).includes(g)));

  const 화 = [...삼합, ...방합, ...공합유효][0] ?? null;

  const 경고 = [];
  if (충.length) 경고.push('월지가 충당함 — 격이 깨질 수 있음 (패격 조문 참조)');
  if (화) 경고.push(`월지가 ${화.지지.join('')} 국을 이뤄 ${화.화}로 화함 — 격 재취용 검토`);
  if (육합.length) 경고.push('월지가 육합에 걸림 — 화하지는 않으나 작용이 둔해짐');

  return {
    충: 충.length > 0,
    화: 화 ? 화.화 : null,
    화근거: 화 ?? null,
    합걸림: 육합.length > 0 || 반합.length > 0,
    경고,
    취용가능: true, // 화해도 원 격을 우선 제시하고 변화를 병기한다
  };
}

// ─────────────────────────────────────────────
function analyze(m) {
  const jiPos  = [['년', m.yeonJi], ['월', m.wolJi], ['일', m.ilJi], ['시', m.siJi]];
  const ganPos = [['년', m.yeonGan], ['월', m.wolGan], ['일', m.ilGan], ['시', m.siGan]];

  const 지지 = detectJiji(jiPos);
  const 천간 = detectCheongan(ganPos);
  const 해소 = resolve(지지);
  const 월지 = woljiStatus(지지, m.wolJi, [m.yeonGan, m.wolGan, m.siGan].filter(Boolean));

  const 요약 = [];
  for (const k of ['삼합','방합','반합','육합','충','형','파','해']) {
    const live = (지지[k] ?? []).filter(x => !x.해소);
    if (live.length) 요약.push(`${k} ${live.map(x => x.지지.join('')).join(', ')}`);
  }
  if (천간.합.length) 요약.push(`간합 ${천간.합.map(x => x.천간.join('')).join(', ')}`);
  if (천간.충.length) 요약.push(`간충 ${천간.충.map(x => x.천간.join('')).join(', ')}`);

  return { 지지, 천간, 해소, 월지, 요약: 요약.join(' / ') || '해당 없음' };
}

module.exports = { analyze, detectJiji, detectCheongan, resolve, woljiStatus,
                   YUKHAP, SAMHAP, BANGHAP, CHUNG, GANHAP };
