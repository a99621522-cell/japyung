/**
 * tonggeun.js — 통근(通根) · 득령(得令) · 세력 계량
 * 사주팔자집 · 자평진전 엔진 (2026-08-02)
 *
 * gyeokguk.js의 '글자 개수 세기'를 대체한다.
 * 자평진전은 재경비중·신강신약을 개수가 아니라 뿌리의 깊이로 보므로,
 * 지지 지장간까지 내려가 가중치를 매긴다.
 */

const { GAN, JIJANGGAN, jeonggi } = require('./jijanggan');

const SAENG = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' };
const GEUK  = { 木:'土', 土:'水', 水:'火', 火:'金', 金:'木' };

// ─────────────────────────────────────────────
// 가중치
// ─────────────────────────────────────────────
const W_JIJI     = { 월:1.00, 일:0.70, 시:0.50, 년:0.40 }; // 지지 자리
const W_JANGGAN  = { 정기:1.00, 중기:0.50, 여기:0.30 };     // 지장간 깊이
const W_CHEONGAN = { 월:0.60, 시:0.50, 년:0.40 };           // 천간 자리 (드러났으나 뿌리는 아님)

// 왕상휴수사 — 일간이 월령에서 얻는 기세
const W_WANGSANG = { 旺:1.00, 相:0.80, 休:0.40, 囚:0.25, 死:0.15 };

/**
 * 월령 대비 일간의 왕상휴수사
 *   旺 我=令 / 相 令生我 / 休 我生令 / 囚 我剋令 / 死 令剋我
 */
function wangsang(ilGan, wolJi) {
  const me  = GAN[ilGan].ohaeng;
  const ryeong = GAN[jeonggi(wolJi)].ohaeng;

  let state;
  if (me === ryeong)             state = '旺';
  else if (SAENG[ryeong] === me) state = '相';
  else if (SAENG[me] === ryeong) state = '休';
  else if (GEUK[me] === ryeong)  state = '囚';
  else                           state = '死';

  return { state, score: W_WANGSANG[state], deukryeong: state === '旺' || state === '相' };
}

/**
 * 특정 천간이 명식의 지지들에 내린 뿌리
 * @returns {{roots: Array, score: number}}
 */
function tonggeun(gan, jiPositions) {
  const target = GAN[gan].ohaeng;
  const roots = [];

  for (const [pos, ji] of jiPositions) {
    if (!ji) continue;
    for (const jg of JIJANGGAN[ji]) {
      if (GAN[jg.gan].ohaeng !== target) continue;
      const exact = jg.gan === gan;                    // 같은 글자면 뿌리가 더 확실
      const w = W_JIJI[pos] * W_JANGGAN[jg.wi] * (exact ? 1.15 : 1.0);
      roots.push({ 자리: pos, 지지: ji, 장간: jg.gan, 깊이: jg.wi, 점수: +w.toFixed(3) });
    }
  }

  const score = +roots.reduce((s, r) => s + r.점수, 0).toFixed(3);
  return { roots, score, 통근: score > 0 };
}

// ─────────────────────────────────────────────
// 오행 세력 → 십성 세력
// ─────────────────────────────────────────────
function sipseongGroup(ilGan, ohaeng) {
  const me = GAN[ilGan].ohaeng;
  if (ohaeng === me)            return '비겁';
  if (SAENG[me] === ohaeng)     return '식상';
  if (GEUK[me] === ohaeng)      return '재';
  if (GEUK[ohaeng] === me)      return '관살';
  if (SAENG[ohaeng] === me)     return '인';
  throw new Error('세력 분류 실패');
}

/**
 * 명식 전체의 가중 세력
 * @param {object} m { yeonGan, yeonJi, wolGan, wolJi, ilGan, ilJi, siGan, siJi }
 */
function strength(m) {
  const { ilGan } = m;
  const ganPos = [['년', m.yeonGan], ['월', m.wolGan], ['시', m.siGan]]; // 일간 제외
  const jiPos  = [['년', m.yeonJi], ['월', m.wolJi], ['일', m.ilJi], ['시', m.siJi]];

  const sery = { 비겁:0, 식상:0, 재:0, 관살:0, 인:0 };

  // 천간
  for (const [pos, g] of ganPos) {
    if (!g) continue;
    sery[sipseongGroup(ilGan, GAN[g].ohaeng)] += W_CHEONGAN[pos];
  }
  // 지지 (지장간 전부)
  for (const [pos, ji] of jiPos) {
    if (!ji) continue;
    for (const jg of JIJANGGAN[ji]) {
      sery[sipseongGroup(ilGan, GAN[jg.gan].ohaeng)] += W_JIJI[pos] * W_JANGGAN[jg.wi];
    }
  }
  for (const k of Object.keys(sery)) sery[k] = +sery[k].toFixed(3);

  // 일간의 자립도
  const ws = wangsang(ilGan, m.wolJi);
  const tg = tonggeun(ilGan, jiPos);

  const 아군 = sery.비겁 + sery.인;
  const 적군 = sery.식상 + sery.재 + sery.관살;

  const 득지 = ['비겁', '인'].includes(sipseongGroup(ilGan, GAN[jeonggi(m.ilJi)].ohaeng));
  const 득세 = 아군 > 적군;

  // 종합 점수: 월령 40% + 통근 30% + 세력비 30%
  const 세력비 = 아군 / (아군 + 적군 || 1);
  const 일간점수 = +(ws.score * 0.4 + Math.min(tg.score / 2, 1) * 0.3 + 세력비 * 0.3).toFixed(3);

  return {
    왕상휴수사: ws.state,
    득령: ws.deukryeong,
    득지,
    득세,
    통근: tg,
    세력: sery,
    아군, 적군,
    일간점수,
    신강: 일간점수 >= 0.5,
    판정: 일간점수 >= 0.65 ? '신강' : 일간점수 >= 0.5 ? '중화신강'
        : 일간점수 >= 0.35 ? '중화신약' : '신약',
  };
}

/** 두 세력의 우열 — 개수 대신 이걸 쓴다 (margin: 유의미한 차이의 하한) */
function dominates(sery, a, b, margin = 0.6) {
  return sery[a] - sery[b] >= margin;
}

// ─────────────────────────────────────────────
function selfTest() {
  const cases = [
    // 甲일간 寅월 — 월령이 비겁, 통근 깊음
    { name:'甲 寅월 건록', m:{ yeonGan:'甲', yeonJi:'寅', wolGan:'丙', wolJi:'寅', ilGan:'甲', ilJi:'子', siGan:'戊', siJi:'辰' },
      want:{ 왕상휴수사:'旺', 득령:true } },
    // 甲일간 酉월 — 월령이 관살
    { name:'甲 酉월 정관', m:{ yeonGan:'庚', yeonJi:'申', wolGan:'辛', wolJi:'酉', ilGan:'甲', ilJi:'子', siGan:'戊', siJi:'辰' },
      want:{ 왕상휴수사:'死', 득령:false } },
    // 甲일간 子월 — 월령이 인성
    { name:'甲 子월 인수', m:{ yeonGan:'壬', yeonJi:'子', wolGan:'壬', wolJi:'子', ilGan:'甲', ilJi:'寅', siGan:'丙', siJi:'午' },
      want:{ 왕상휴수사:'相', 득령:true } },
  ];

  let pass = 0;
  for (const c of cases) {
    const r = strength(c.m);
    const ok = r.왕상휴수사 === c.want.왕상휴수사 && r.득령 === c.want.득령;
    if (ok) pass++;
    console.log(`${ok ? '✓' : '✗'} ${c.name}`);
    console.log(`    ${r.왕상휴수사} 득령=${r.득령} 득지=${r.득지} 득세=${r.득세} → ${r.판정}(${r.일간점수})`);
    console.log(`    세력 ${JSON.stringify(r.세력)}`);
    console.log(`    일간 뿌리 ${r.통근.roots.map(x=>`${x.지지}/${x.장간}(${x.깊이})`).join(', ') || '없음'} = ${r.통근.score}`);
  }
  console.log(`\n통과 ${pass}/${cases.length}`);
  return pass === cases.length;
}

module.exports = { wangsang, tonggeun, sipseongGroup, strength, dominates,
                   W_JIJI, W_JANGGAN, W_CHEONGAN, W_WANGSANG, selfTest };

if (require.main === module) selfTest();
