/**
 * jijanggan.js — 지장간 / 음양 / 십성 / 투출 / 격 취용
 * 사주팔자집 · 자평진전 엔진 기반 모듈 (2026-08-02)
 *
 * 코드리뷰 지적 반영:
 *  ① JIJI 음양 상수 제거 → 지지 음양을 '정기(본기) 천간'에서 도출 (子午=음, 巳亥=양이 자동으로 나옴)
 *  ② 지장간을 오행 기호가 아닌 '천간 글자' 단위로 저장 → 정관/편관 구분 가능
 *  ③ 투출 판정을 오행 일치가 아닌 '글자 일치'로 엄격화
 */

// ─────────────────────────────────────────────
// 1. 천간
// ─────────────────────────────────────────────
const GAN = {
  甲: { ohaeng: '木', eumyang: '양' },
  乙: { ohaeng: '木', eumyang: '음' },
  丙: { ohaeng: '火', eumyang: '양' },
  丁: { ohaeng: '火', eumyang: '음' },
  戊: { ohaeng: '土', eumyang: '양' },
  己: { ohaeng: '土', eumyang: '음' },
  庚: { ohaeng: '金', eumyang: '양' },
  辛: { ohaeng: '金', eumyang: '음' },
  壬: { ohaeng: '水', eumyang: '양' },
  癸: { ohaeng: '水', eumyang: '음' },
};

// ─────────────────────────────────────────────
// 2. 지장간 — 천간 글자 + 사령 일수
//    wi: 여기(餘氣) / 중기(中氣) / 정기(正氣)
//    子卯酉는 중기가 없어 2항목
// ─────────────────────────────────────────────
const JIJANGGAN = {
  子: [{ gan: '壬', days: 10, wi: '여기' }, { gan: '癸', days: 20, wi: '정기' }],
  丑: [{ gan: '癸', days: 9 , wi: '여기' }, { gan: '辛', days: 3 , wi: '중기' }, { gan: '己', days: 18, wi: '정기' }],
  寅: [{ gan: '戊', days: 7 , wi: '여기' }, { gan: '丙', days: 7 , wi: '중기' }, { gan: '甲', days: 16, wi: '정기' }],
  卯: [{ gan: '甲', days: 10, wi: '여기' }, { gan: '乙', days: 20, wi: '정기' }],
  辰: [{ gan: '乙', days: 9 , wi: '여기' }, { gan: '癸', days: 3 , wi: '중기' }, { gan: '戊', days: 18, wi: '정기' }],
  巳: [{ gan: '戊', days: 7 , wi: '여기' }, { gan: '庚', days: 7 , wi: '중기' }, { gan: '丙', days: 16, wi: '정기' }],
  午: [{ gan: '丙', days: 10, wi: '여기' }, { gan: '己', days: 9 , wi: '중기' }, { gan: '丁', days: 11, wi: '정기' }],
  未: [{ gan: '丁', days: 9 , wi: '여기' }, { gan: '乙', days: 3 , wi: '중기' }, { gan: '己', days: 18, wi: '정기' }],
  申: [{ gan: '戊', days: 7 , wi: '여기' }, { gan: '壬', days: 7 , wi: '중기' }, { gan: '庚', days: 16, wi: '정기' }],
  酉: [{ gan: '庚', days: 10, wi: '여기' }, { gan: '辛', days: 20, wi: '정기' }],
  戌: [{ gan: '辛', days: 9 , wi: '여기' }, { gan: '丁', days: 3 , wi: '중기' }, { gan: '戊', days: 18, wi: '정기' }],
  亥: [{ gan: '戊', days: 7 , wi: '여기' }, { gan: '甲', days: 7 , wi: '중기' }, { gan: '壬', days: 16, wi: '정기' }],
};

/** 지지의 정기(본기) 천간 */
function jeonggi(jiji) {
  return JIJANGGAN[jiji].find(x => x.wi === '정기').gan;
}

/**
 * ① 지지의 오행·음양 — 상수로 박지 않고 정기에서 도출한다.
 *    체(體) 기준이 아니라 용(用) 기준이 되므로 子午=음, 巳亥=양이 자동으로 나온다.
 */
function jijiInfo(jiji) {
  const g = jeonggi(jiji);
  return { ohaeng: GAN[g].ohaeng, eumyang: GAN[g].eumyang, jeonggi: g };
}

// ─────────────────────────────────────────────
// 3. 오행 관계
// ─────────────────────────────────────────────
const SAENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 生
const GEUK  = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }; // 剋

/**
 * ② 십성 산출 — 지장간이 천간 글자로 저장되어 있으므로
 *    정관/편관, 정재/편재, 정인/편인 구분이 온전히 살아난다.
 * @param {string} ilgan 일간 (천간 1글자)
 * @param {string} target 대상 천간 1글자
 */
function sipseong(ilgan, target) {
  const me = GAN[ilgan], it = GAN[target];
  if (!me || !it) throw new Error(`알 수 없는 천간: ${ilgan} / ${target}`);
  const same = me.eumyang === it.eumyang;

  if (it.ohaeng === me.ohaeng)          return same ? '비견' : '겁재';
  if (it.ohaeng === SAENG[me.ohaeng])   return same ? '식신' : '상관';
  if (it.ohaeng === GEUK[me.ohaeng])    return same ? '편재' : '정재';
  if (GEUK[it.ohaeng] === me.ohaeng)    return same ? '편관' : '정관';
  if (SAENG[it.ohaeng] === me.ohaeng)   return same ? '편인' : '정인';
  throw new Error('십성 판정 실패');
}

/** 지지의 십성 (정기 기준) */
function sipseongOfJiji(ilgan, jiji) {
  return sipseong(ilgan, jeonggi(jiji));
}

// ─────────────────────────────────────────────
// 4. 사령(司令) — 절입일로부터 경과일수로 판정
// ─────────────────────────────────────────────
/**
 * @param {string} woljiJi 월지
 * @param {number} daysFromJeolip 절입 후 경과일수 (0 이상)
 */
function saryeong(woljiJi, daysFromJeolip) {
  let acc = 0;
  for (const item of JIJANGGAN[woljiJi]) {
    acc += item.days;
    if (daysFromJeolip < acc) return item;
  }
  return JIJANGGAN[woljiJi].at(-1); // 일수 초과 시 정기
}

// ─────────────────────────────────────────────
// 5. ③ 투출(透出) 판정 — 글자 일치만 인정
// ─────────────────────────────────────────────
/**
 * 월지 지장간 중 천간에 '같은 글자'로 드러난 것을 찾는다.
 * 자평진전에서 일간은 나 자신이므로 격의 후보에서 제외한다.
 *
 * @param {object} myeongsik { yeonGan, wolGan, ilGan, siGan, wolJi }
 * @param {object} [opt] { includeIlgan: false }
 * @returns {Array} 투출한 지장간 목록 (정기 → 중기 → 여기 순)
 */
function tuchul(myeongsik, opt = {}) {  // 強透 — 글자 일치
  const { yeonGan, wolGan, ilGan, siGan, wolJi } = myeongsik;
  const pool = [yeonGan, wolGan, siGan];
  if (opt.includeIlgan) pool.push(ilGan);

  const order = { 정기: 0, 중기: 1, 여기: 2 };
  return JIJANGGAN[wolJi]
    .filter(x => pool.includes(x.gan))          // ← 오행이 아니라 글자 일치
    .map(x => ({ ...x, wiAt: pool.map((g, i) => g === x.gan ? i : -1).filter(i => i >= 0) }))
    .sort((a, b) => order[a.wi] - order[b.wi]);
}

/**
 * 弱透 — 지장간과 '같은 오행'의 천간이 드러난 경우.
 * 잡기월(辰戌丑未)에서만 쓴다. 「論雜氣如何取用」
 *   脫脫丞相 壬辰甲辰丙戌戊戌: 辰중 癸(官)를 壬(煞)으로 투출시켜 칠살격
 *   汪學士   甲子辛未辛酉壬辰: 未중 乙(財)을 甲으로 투출시켜 재격
 */
function yakTuchul(myeongsik) {
  const { yeonGan, wolGan, siGan, wolJi } = myeongsik;
  const pool = [yeonGan, wolGan, siGan].filter(Boolean);
  const order = { 정기: 0, 중기: 1, 여기: 2 };
  const out = [];
  for (const jg of JIJANGGAN[wolJi]) {
    for (const g of pool) {
      if (g === jg.gan) continue;                      // 강투는 별도 처리
      if (GAN[g].ohaeng !== GAN[jg.gan].ohaeng) continue;
      out.push({ ...jg, gan: g, 원장간: jg.gan, 약투: true });
    }
  }
  return out.sort((a, b) => order[a.wi] - order[b.wi]);
}

const JAPGI = ['辰', '戌', '丑', '未'];   // 잡기월

// ─────────────────────────────────────────────
// 6. 건록 / 양인
// ─────────────────────────────────────────────
const GEONROK = { 甲:'寅', 乙:'卯', 丙:'巳', 丁:'午', 戊:'巳', 己:'午', 庚:'申', 辛:'酉', 壬:'亥', 癸:'子' };
// 양인은 양간에만 세운다 (자평진전 論陽刃)
const YANGIN  = { 甲:'卯', 丙:'午', 戊:'午', 庚:'酉', 壬:'子' };

// ─────────────────────────────────────────────
// 7. 격 취용 (자평진전)
// ─────────────────────────────────────────────
const SUNYONG = ['정관', '정재', '편재', '정인', '식신'];        // 四吉神 — 생조·보호
const YEOKYONG = ['편관', '상관', '양인', '건록'];               // 四凶神 — 제복·전화

/**
 * @param {object} myeongsik { yeonGan, wolGan, ilGan, siGan, wolJi, daysFromJeolip }
 */
function chwiyongGyeok(myeongsik) {
  const { ilGan, wolJi, daysFromJeolip } = myeongsik;

  // (1) 건록 / 양인은 투출과 무관하게 먼저 잡는다
  if (GEONROK[ilGan] === wolJi) {
    return { gyeok: '건록', yongbeop: '역용', geunGeo: '월지가 일간의 록', sangsinHint: null };
  }
  if (YANGIN[ilGan] === wolJi) {
    return { gyeok: '양인', yongbeop: '역용', geunGeo: '월지가 일간의 인', sangsinHint: '편관 또는 정관' };
  }

  // (2) 격 취용 — 잡기월이냐 아니냐로 갈린다.
  //   비잡기월: 월령 정기(본기)가 격이다. 투출은 상신·변화 후보일 뿐.
  //             薛相公·李參政 둘 다 정기 미투출인데 정관격인 것이 근거.
  //   잡기월(辰戌丑未): 지장간이 셋이라 투출한 것을 우선한다. 「論雜氣如何取用」
  //             글자 일치(強透)를 먼저 보고, 없으면 오행 일치(弱透)까지 인정한다.
  const tu = tuchul(myeongsik);
  const jg = JIJANGGAN[wolJi].find(x => x.wi === '정기');
  const 비겁인가 = g => ['비견', '겁재'].includes(sipseong(ilGan, g));

  let picked, geunGeo;
  const 잡기 = JAPGI.includes(wolJi);

  const 후보 = 잡기 ? [...tu, ...yakTuchul(myeongsik)].filter(x => !비겁인가(x.gan))
                    : tu.filter(x => !비겁인가(x.gan));

  if (잡기 && 후보.length > 0) {
    picked = 후보[0];
    geunGeo = picked.약투
      ? `잡기 ${wolJi}월 — ${picked.원장간}(${picked.wi})과 같은 오행인 ${picked.gan}이 투출해 취용`
      : `잡기 ${wolJi}월 — ${picked.wi} ${picked.gan}이 투출해 취용`;
  } else if (!비겁인가(jg.gan)) {
    picked = jg;
    geunGeo = tu.length
      ? `월지 ${wolJi}의 정기 ${jg.gan}으로 취용 (${tu.map(x=>x.gan).join('·')} 투출은 상신·변화 후보)`
      : `월지 ${wolJi}의 정기 ${jg.gan}으로 취용`;
  } else if (후보.length > 0) {
    // 정기가 비겁이면 **격 이름은 건록·월겁**이고, 투출한 재관살식은 상신이다.
    //   45편 「日與月同，本身不可爲用，必看四柱有無財官煞食透干會支，另取用神」
    //   ─ '따로 용신을 취한다'는 것이지 격 이름이 바뀐다는 뜻이 아니다.
    //   원문 29편이 든 「乙逢寅月，時遇丙子 → 木火通明」이 곧 건록에 식상을 쓴 것이며,
    //   같은 배치를 甲일간이면 건록으로 잡으면서 乙일간이면 상관격으로 잡던 어긋남을 여기서 바로잡는다.
    return { gyeok: '건록', yongbeop: '역용',
             geunGeo: `월지 ${wolJi}의 정기 ${jg.gan}이 비겁이라 격이 서지 못하니 월겁격이며, 투출한 ${후보[0].gan}(${sipseong(ilGan, 후보[0].gan)})을 상신 후보로 삼는다`,
             tuchulList: tu, sangsinHint: sipseong(ilGan, 후보[0].gan) };
  } else {
    return { gyeok: '건록', yongbeop: '역용',
             geunGeo: `월지 ${wolJi}의 정기가 비겁이고 취용할 투출도 없어 월겁격`,
             tuchulList: [], sangsinHint: null };
  }

  const ss = sipseong(ilGan, picked.gan);
  const gyeok = ss === '비견' || ss === '겁재' ? '건록' : ss;   // 월겁격 처리

  return {
    gyeok,
    yongbeop: SUNYONG.includes(gyeok) ? '순용' : YEOKYONG.includes(gyeok) ? '역용' : '미분류',
    geunGeo,
    tuchulList: tu.map(x => `${x.gan}(${x.wi})`),
    sangsinHint: null,   // 상신은 조문 엔진에서 판정
  };
}

// ─────────────────────────────────────────────
// 8. 자체 점검
// ─────────────────────────────────────────────
function selfTest() {
  const ok = [];
  const fail = [];
  const chk = (label, got, want) =>
    (String(got) === String(want) ? ok : fail).push(`${label}: ${got}${got === want ? '' : ` (기대 ${want})`}`);

  // ① 지지 음양 — 체가 아니라 용
  chk('子 음양', jijiInfo('子').eumyang, '음');
  chk('午 음양', jijiInfo('午').eumyang, '음');
  chk('巳 음양', jijiInfo('巳').eumyang, '양');
  chk('亥 음양', jijiInfo('亥').eumyang, '양');

  // ② 정관/편관 구분
  chk('甲일간 → 辛', sipseong('甲', '辛'), '정관');
  chk('甲일간 → 庚', sipseong('甲', '庚'), '편관');
  chk('甲일간 → 酉', sipseongOfJiji('甲', '酉'), '정관');
  chk('甲일간 → 申', sipseongOfJiji('甲', '申'), '편관');

  // ③ 투출 — 글자 일치
  const m1 = { yeonGan:'乙', wolGan:'癸', ilGan:'丁', siGan:'壬', wolJi:'未', daysFromJeolip: 12 };
  chk('未월 투출', JSON.stringify(tuchul(m1).map(x=>x.gan)), JSON.stringify(['乙']));

  // 격 취용
  const g1 = chwiyongGyeok(m1);
  chk('丁일간 未월(잡기·乙 투출)', `${g1.gyeok}/${g1.yongbeop}`, '편인/미분류');

  const m2 = { yeonGan:'甲', wolGan:'丙', ilGan:'甲', siGan:'戊', wolJi:'寅', daysFromJeolip: 3 };
  chk('甲일간 寅월', chwiyongGyeok(m2).gyeok, '건록');

  console.log(`통과 ${ok.length} / 실패 ${fail.length}`);
  ok.forEach(s => console.log('  ✓', s));
  fail.forEach(s => console.log('  ✗', s));
  return fail.length === 0;
}

module.exports = {
  GAN, JIJANGGAN, GEONROK, YANGIN, SUNYONG, YEOKYONG, JAPGI, yakTuchul,
  jeonggi, jijiInfo, sipseong, sipseongOfJiji,
  saryeong, tuchul, chwiyongGyeok, selfTest,
};

if (require.main === module) selfTest();
