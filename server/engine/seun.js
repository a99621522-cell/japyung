/**
 * seun.js — 세운(歲運)
 * 사주팔자집 (2026-08-02)
 *
 * 자평진전에는 세운을 따로 다룬 편이 없다. 論行運이 말하는 것은 대운이다.
 * 그래서 **다른 책에서 太歲 규칙을 끌어오지 않는다.** 30편이 경계한
 * 「以俗書無知妄作，誤依其說而深入迷途」가 그 위험이다.
 *
 * 대신 이 책이 이미 세워둔 규칙을 한 해 단위에 그대로 적용한다.
 * 원문이 운을 보는 방법 자체를 「運中每運行一字，即必以此一字，配命中八字而統觀之」라고
 * 했으므로, 대운이든 한 해든 **한 글자씩 원국에 대어 보는 것**은 같다.
 *
 *   25편 論行運        — 희기 총론, 似喜實忌, 운간합, 충의 완급·경중, 逢沖而不沖, 一沖而得兩沖
 *   26편 行運成格變格   — 「成格變格，比之喜忌，禍福尤重」
 *   27편 喜忌干支有別   — 천간과 지지가 같은 오행이라도 달리 작용한다
 *   28편 支中喜忌逢運透清 — 지지에 잠자던 것이 운 천간으로 나오면 맑아진다.
 *                        그리고 「**此五年中**，亦能爲其禍福」
 *
 * 28편의 「此五年中」이 대운 열 해를 **천간 다섯 해·지지 다섯 해**로 나눠 보는 근거다.
 * 세운이 그 대운의 어느 쪽 다섯 해에 놓였는지를 함께 표시한다.
 *
 * ── 만들지 않은 것 ──────────────────────────
 * 세운과 대운이 서로 합·충하는 것을 따로 판정하지 않는다. 원문에 근거가 없다.
 * 「歲運並臨」「太歲沖合」류는 전부 淵海子平·三命通會 쪽 규칙이다.
 * 원문이 말한 것은 어디까지나 **운의 글자를 원국에 대어 보는 것**이다.
 */

const { 판정어로: __pj } = require('./chwiun');
const { GAN, JI, sipseong } = require('./jijanggan');
const chwiun = require('./chwiun');
const unchung = require('./unchung');
const unbyeonhwa = require('./unbyeonhwa');
const tuchong = require('./tuchong');

const 天干 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const 地支 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/**
 * 그 해의 간지. 1984년이 甲子다.
 * ※ 해가 바뀌는 기준은 입춘이므로, 1월~2월 초 생일은 앞 해로 봐야 한다.
 *   이 함수는 연도만 받으므로 그 보정은 호출부에서 한다.
 */
function 연간지(year) {
  const n = ((year - 1984) % 60 + 60) % 60;
  return { 천간: 天干[n % 10], 지지: 地支[n % 12], 간지: 天干[n % 10] + 地支[n % 12] };
}

/** 이 해가 대운의 어느 쪽 다섯 해인가 — 28편 「此五年中」 */
function 오년구간(year, 대운) {
  if (!대운) return null;
  const 경과 = year - 대운.시작연도;
  if (경과 < 0 || 경과 >= 10) return null;
  return 경과 < 5
    ? { 구간:'천간 쪽 다섯 해', 글자:대운.천간, 십성:대운.천간십성,
        설명:`이 대운 ${대운.간지}의 앞 다섯 해라 천간 ${대운.천간}이 앞서 작용하는 구간입니다` }
    : { 구간:'지지 쪽 다섯 해', 글자:대운.지지, 십성:대운.지지십성,
        설명:`이 대운 ${대운.간지}의 뒤 다섯 해라 지지 ${대운.지지}가 앞서 작용하는 구간입니다` };
}

/**
 * @param {number} year 서기 연도
 * @param {object} ctx  buildContext 결과
 * @param {object} r    judge() 결과
 * @param {object} m    명식
 * @param {object} 대운 그 해가 속한 대운 (없으면 null)
 */
function analyze(year, ctx, r, m, 대운 = null) {
  const gz = 연간지(year);
  const un = {
    간지: gz.간지, 천간: gz.천간, 지지: gz.지지,
    천간십성: sipseong(m.ilGan, gz.천간),
    지지십성: sipseong(m.ilGan, require('./jijanggan').jeonggi(gz.지지)),
  };

  // 25편 앞부분 — 격이 이룬 국의 희기로 이 해를 잰다
  const rule = chwiun.lookup(ctx.gyeok, r.상신, ctx);
  const 길흉 = rule ? chwiun.judgeByRule(un, rule, ctx) : { 판정: '판단 보류', 비고: ['격의 희기가 정해지지 않았다'] };

  // 26편 — 희기보다 무거우므로 먼저 얹는다
  const ub = unbyeonhwa.analyze(un, ctx, r, m);
  if (ub.가감) {
    const 점 = (길흉.점수 ?? 0) + ub.가감;
    길흉.점수 = 점;
    길흉.판정 = __pj(Math.max(-2, Math.min(2, 점)));
    길흉.성격변격 = ub.판정;
  }

  // 25편 뒷부분 — 운 간지가 원국과 맞물리는 자리
  const uc = unchung.analyze(un, ctx, m, 길흉.판정);
  if (uc.가감) {
    const 점 = (길흉.점수 ?? 0) + uc.가감;
    길흉.점수 = 점;
    길흉.판정 = __pj(Math.max(-2, Math.min(2, 점)));
  }

  // 28편 — 지지에 잠자던 것이 맑아지는가
  const tc = tuchong.analyze(un, ctx, m);

  길흉.비고 = [
    ...(길흉.비고 ?? []),
    ...ub.사건.map(x => x.설명),
    ...uc.사건.map(x => x.설명),
    ...tc.사건.map(x => x.설명),
  ];

  return {
    연도: year, ...un,
    길흉,
    오년구간: 오년구간(year, 대운),
    대운: 대운 ? { 간지: 대운.간지, 시작나이: 대운.시작나이 } : null,
    성격변격: ub, 상호작용: uc, 투청: tc,
    한계: '자평진전에는 세운을 따로 논한 편이 없다. 이 판정은 이 책이 대운에 대해 세운 규칙(25·26·27·28편)을 한 해에 그대로 적용한 것이며, 세운과 대운이 서로 합충하는 것은 원문에 근거가 없어 다루지 않았다',
  };
}

/**
 * 여러 해를 한 번에.
 * @param {object} opt { 시작연도, 개수, 대운목록, 출생연도 }
 */
function range(ctx, r, m, opt = {}) {
  const 시작 = opt.시작연도 ?? new Date().getFullYear();
  const 개수 = opt.개수 ?? 10;
  const 대운목록 = opt.대운목록 ?? [];
  const 출생 = opt.출생연도;

  const out = [];
  for (let y = 시작; y < 시작 + 개수; y++) {
    let 대운 = null;
    if (출생 && 대운목록.length) {
      const 나이 = y - 출생 + 1;                       // 세는 나이
      대운 = 대운목록.find(d => 나이 >= d.시작나이 && 나이 < d.시작나이 + 10) ?? null;
      if (대운 && 대운.시작연도 == null) 대운 = { ...대운, 시작연도: 출생 + 대운.시작나이 - 1 };
    }
    out.push(analyze(y, ctx, r, m, 대운));
  }
  return out;
}

module.exports = { 연간지, 오년구간, analyze, range };

if (require.main === module) {
  const { judge } = require('./gyeokguk');
  const m = { yeonGan:'甲', yeonJi:'申', wolGan:'壬', wolJi:'申', ilGan:'乙', ilJi:'巳', siGan:'戊', siJi:'寅', daysFromJeolip:15 };
  const r = judge(m);
  console.log('── 연간지 확인 ──');
  [1984, 2024, 2026, 2027].forEach(y => console.log(' ', y, 연간지(y).간지));
  console.log('\n── 薛相公 2026~2030 ──');
  for (const s of range(r.ctx, r, m, { 시작연도: 2026, 개수: 5 })) {
    console.log(` ${s.연도} ${s.간지} (${s.천간십성}·${s.지지십성}) — ${s.길흉.판정}`);
    (s.길흉.비고 ?? []).slice(0, 2).forEach(x => console.log('     ·', x));
  }
}
