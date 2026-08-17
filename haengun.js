/**
 * haengun.js — 궁위·육친(10단계) 및 행운(11단계)
 * 사주팔자집 · 자평진전 (2026-08-02)
 *
 * 「論宮分用神配六親」 궁위와 십성을 함께 본다
 * 「論行運」            대운의 길흉은 '상신'을 기준으로 판단한다
 * 「論喜忌干支有別」    천간과 지지의 희기는 다르다
 * 「論支中喜忌逢運透清」지지에 묻힌 글자는 운에서 투출할 때 작용한다
 */

const { 판정어로: __pj } = require('./chwiun');
const { GAN, JIJANGGAN, jeonggi, sipseong } = require('./jijanggan');
const chwiun = require('./chwiun');
const unchung = require('./unchung');
const unbyeonhwa = require('./unbyeonhwa');
const tuchong = require('./tuchong');

const CHEONGAN_SUN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const JIJI_SUN     = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// ─────────────────────────────────────────────
// ── 옛 궁위·육친 코드는 제거했다 ──────────────────
// 23편(yukchin.js)과 24편(cheoja.js)이 원문 대조를 거쳐 대체했다.
// 옛 코드는 月을 '부모·형제', 日을 '자신·배우자'로 뭉뚱그렸고 여명 매핑에 원문 근거가 없었다.

// ─────────────────────────────────────────────
// 11단계 · 대운 산출
// ─────────────────────────────────────────────
/**
 * 양남음녀 순행 / 음남양녀 역행
 * @param {object} m 명식
 * @param {string} gender '남' | '여'
 * @param {number} daysToJeolgi 순행이면 다음 절입까지, 역행이면 지난 절입 이후 일수
 * @param {number} count 산출할 대운 개수
 */
function daeun(m, gender = '남', daysToJeolgi = 15, count = 9) {
  const 년간음양 = GAN[m.yeonGan].eumyang;
  const 순행 = (년간음양 === '양' && gender === '남') || (년간음양 === '음' && gender === '여');

  const gi = CHEONGAN_SUN.indexOf(m.wolGan);
  const ji = JIJI_SUN.indexOf(m.wolJi);
  const 대운수 = Math.max(1, Math.round(daysToJeolgi / 3));

  const list = [];
  for (let n = 1; n <= count; n++) {
    const step = 순행 ? n : -n;
    const g = CHEONGAN_SUN[((gi + step) % 10 + 10) % 10];
    const j = JIJI_SUN[((ji + step) % 12 + 12) % 12];
    list.push({
      순번: n,
      시작나이: 대운수 + (n - 1) * 10,
      간지: g + j,
      천간: g, 지지: j,
      천간십성: sipseong(m.ilGan, g),
      지지십성: sipseong(m.ilGan, jeonggi(j)),
    });
  }
  return { 방향: 순행 ? '순행' : '역행', 대운수, 대운: list };
}

// ─────────────────────────────────────────────
// 11단계 · 행운 길흉 — 상신 기준
// ─────────────────────────────────────────────
const SAENG = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' };
const GEUK  = { 木:'土', 土:'水', 水:'火', 火:'金', 金:'木' };

/**
 * 「論喜忌干支有別」 — 천간과 지지를 따로 본다.
 * 「論支中喜忌逢運透清」 — 원국 지지에만 있던 글자가 운 천간에 투출하면 그때 발동.
 */
function judgeUn(un, 상신, ctx, m) {
  if (!상신) return { 판정:'평가 보류', 사유:'상신 미지정' };

  const 상신오행 = ohaengOf(상신, m.ilGan);
  const 격오행   = ohaengOf(ctx.gyeok, m.ilGan);

  const eval1 = (ohaeng, label) => {
    if (ohaeng === 상신오행)          return { v: 2, t:`${label}이 상신을 그대로 돕는다` };
    if (SAENG[ohaeng] === 상신오행)   return { v: 1, t:`${label}이 상신을 생한다` };
    if (GEUK[ohaeng] === 상신오행)    return { v:-2, t:`${label}이 상신을 극한다 — 가장 꺼리는 자리` };
    if (GEUK[상신오행] === ohaeng)    return { v:-1, t:`${label}이 상신에게 극당해 기운이 흩어진다` };
    return { v: 0, t:`${label}은 상신과 직접 관계가 없다` };
  };

  const g = eval1(GAN[un.천간].ohaeng, '운의 천간');
  const j = eval1(GAN[jeonggi(un.지지)].ohaeng, '운의 지지');

  // 투출 발동 — 원국 지지에만 있던 십성이 운 천간에 드러남
  const 투출발동 = !(ctx.cheongan[un.천간십성]?.length) && (ctx.jiji[un.천간십성]?.length > 0);

  const 합 = g.v + j.v;
  const 판정 = __pj(합 >= 3 ? 2 : 합 >= 1 ? 1 : 합 === 0 ? 0 : 합 >= -2 ? -1 : -2);

  return {
    판정, 점수: 합,
    천간: g.t, 지지: j.t,
    간지불일치: (g.v > 0 && j.v < 0) || (g.v < 0 && j.v > 0),
    투출발동,
    비고: [
      (g.v > 0 && j.v < 0) || (g.v < 0 && j.v > 0)
        ? '천간과 지지의 희기가 엇갈린다 — 10년을 통으로 보지 말 것'
        : null,
      투출발동 ? `원국 지지의 ${un.천간십성}이 운 천간에 투출해 드러난다` : null,
    ].filter(Boolean),
  };
}

/** 십성명 → 오행 */
function ohaengOf(sipseongName, ilGan) {
  const me = GAN[ilGan].ohaeng;
  const 역 = Object.keys(GEUK).find(k => GEUK[k] === me);
  const 인 = Object.keys(SAENG).find(k => SAENG[k] === me);
  const map = {
    비견:me, 겁재:me, 건록:me, 양인:me,
    식신:SAENG[me], 상관:SAENG[me], 식상:SAENG[me],
    정재:GEUK[me], 편재:GEUK[me], 재:GEUK[me], 재관:GEUK[me],
    정관:역, 편관:역, 관살:역,
    정인:인, 편인:인, 인:인, 인수:인,
  };
  return map[sipseongName] ?? null;
}

function haengun(m, ctx, 상신, gender = '남', daysToJeolgi = 15, r = null) {
  const d = daeun(m, gender, daysToJeolgi);

  // 격별 취운 조문(chwiun.js)이 있으면 그것을 쓰고, 없으면 상신 일반규칙으로 폴백한다.
  const rule = chwiun.lookup(ctx.gyeok, 상신, ctx);

  return {
    ...d,
    대운: d.대운.map(un => {
      const 길흉 = rule ? chwiun.judgeByRule(un, rule, ctx) : judgeUn(un, 상신, ctx, m);
      // 25편 후반 — 운 간지가 원국과 어떻게 맞물리는지 한 글자씩 대어 본다
      const uc = unchung.analyze(un, ctx, m, 길흉.판정);
      // 26편 — 「成格變格，比之喜忌，禍福尤重」이므로 희기보다 먼저·무겁게 얹는다
      const ub = unbyeonhwa.analyze(un, ctx, r ?? { 상신 }, m);
      if (ub.가감) {
        const 점 = (길흉.점수 ?? 0) + ub.가감;
        길흉.점수 = 점;
        길흉.판정 = __pj(Math.max(-2, Math.min(2, 점)));
        길흉.성격변격 = ub.판정;
      }
      if (uc.가감) {
        const 점 = (길흉.점수 ?? 0) + uc.가감;
        길흉.점수 = 점;
        길흉.판정 = __pj(Math.max(-2, Math.min(2, 점)));
      }
      길흉.비고 = [...(길흉.비고 ?? []), ...uc.사건.map(x => x.설명)];
      // 28편 — 지지에 잠자던 것이 운에서 맑아진다. 성패·고저는 안 건드리고 5년의 화복만 본다
      const tc = tuchong.analyze(un, ctx, m);
      길흉.비고 = [...(길흉.비고 ?? []), ...ub.사건.map(x => x.설명), ...tc.사건.map(x => x.설명)];
      return { ...un, 길흉, 운상호작용: uc, 운성격변격: ub, 투청: tc };
    }),
    취운조문: rule ? { 국:`${rule.격}격 用${rule.상신}`, 희:rule.희, 기:rule.기,
                     원문:rule.원문, 대조:rule.대조 } : null,
    기준: rule
      ? `${ctx.gyeok}격 用${rule.상신} — 원문 취운 조문 적용 (${rule.대조} 대조)`
      : `상신 ${상신 ?? '미지정'} — 격별 취운 조문 미확보라 일반규칙으로 판정`,
  };
}

module.exports = { daeun, haengun };
