/**
 * ganji.js — 27편 「論喜忌干支有別」
 * 사주팔자집 (2026-08-02)
 *
 * 「命中喜忌，雖干支俱有，而**干主天，動而有爲；支主地，靜以待用**。
 *  且**干主一而支藏多**，爲福爲禍，安得不殊？」
 *
 * 천간은 하나만 품고 움직이며, 지지는 여럿을 감춘 채 쓰이기를 기다린다.
 * 그래서 같은 십성이라도 천간에 있느냐 지지에 있느냐로 화복이 달라진다.
 *
 * 원문이 든 세 가지 — 모두 **지지는 그 일을 일으키지 않는다**는 쪽이다.
 *   ① 甲用酉官에 **逢庚辛則官煞雜，而申酉不作此例**
 *      申은 辛의 왕지이니, 辛이 申酉에 앉은 것은 지방관이 도장까지 쥔 격이다
 *   ② **逢二辛則官犯重，而二酉不作此例**
 *      辛이 두 酉에 앉은 것은 한 관원이 두 고을을 겸한 격이다
 *   ③ **透丁則傷官，而逢午不作此例**
 *      丁은 動하고 午는 靜하며, 午 속에는 丁과 己가 함께 감춰져 있으니
 *      그것이 재로 쓰이지 않으리라 어찌 단정하겠는가
 *
 * 다만 예외가 있다 — **「必會有動」**
 *   甲用酉官에 午 하나로는 관을 상하지 못하나,
 *   寅·戌이 와 회국해 **불이 動하면** 상할 수 있다.
 *   甲生申月에 午 하나로는 살을 제어하지 못하나, 寅戌이 회국하면 제어할 수 있다.
 *   **지지는 회국해야 비로소 動한다.** 이것이 천간과 다른 점이다.
 *
 * 이 모듈은 새 판정을 만들지 않는다. 엔진이 이 규칙을 지키는지 **검사**하고,
 * 지지의 십성을 어떻게 읽어야 하는지 설명을 붙인다.
 */

const { GAN, JIJANGGAN, jeonggi, sipseong } = require('./jijanggan');

/** 지지 단독으로는 일으키지 못하는 일들 */
const 지지불가 = [
  { 항목:'관살혼잡', 설명:'천간에 관과 살이 함께 나와야 혼잡이다. 지지의 申酉는 혼잡으로 세지 않는다',
    원문:'逢庚辛則官煞雜，而申酉不作此例' },
  { 항목:'중관(重官)', 설명:'같은 관이 천간에 둘 나와야 무겁다. 지지에 酉가 둘 있는 것은 그렇게 보지 않는다',
    원문:'逢二辛則官犯重，而二酉不作此例' },
  { 항목:'상관견관', 설명:'상관이 천간에 나와야 관을 친다. 지지의 午는 그 자체로 관을 상하지 않는다',
    원문:'透丁則傷官，而逢午不作此例' },
];

/**
 * 지지가 動했는가 — 회국해야 비로소 動한다
 * @returns {Array} 動한 회국 목록
 */
function 동한지지(ctx, m) {
  const out = [];
  for (const h of [...(ctx.합충?.지지?.삼합 ?? []), ...(ctx.합충?.지지?.방합 ?? [])]) {
    if (h.해소 || !h.왕지) continue;
    out.push({
      지지: h.지지.join(''), 화: h.화,
      십성: sipseong(m.ilGan, jeonggi(h.왕지)),
      설명: `${h.지지.join('')}이 모여 ${h.화}로 動하니, 이 십성은 천간에 나온 것처럼 작용할 수 있다`,
      원문: '會寅會戌，二者合而火動，亦能傷矣 … 然必會有動',
    });
  }
  return out;
}

function analyze(ctx, m) {
  const 動 = 동한지지(ctx, m);

  // 지지에만 있고 천간에 없는 십성 — 원문에 따르면 靜하다
  const 간십성 = new Set([m.yeonGan, m.wolGan, m.siGan].filter(Boolean)
    .map(g => sipseong(m.ilGan, g)));
  const 지십성 = {};
  for (const [p, j] of [['년',m.yeonJi],['월',m.wolJi],['일',m.ilJi],['시',m.siJi]]) {
    if (!j) continue;
    for (const jg of JIJANGGAN[j]) {
      const ss = sipseong(m.ilGan, jg.gan);
      (지십성[ss] ??= []).push(`${j}(${p})`);
    }
  }
  const 정적 = Object.entries(지십성)
    .filter(([ss]) => !간십성.has(ss) && !動.some(x => x.십성 === ss))
    .map(([ss, 자리]) => ({ 십성:ss, 자리:[...new Set(자리)] }));

  return {
    원칙: '천간은 하늘을 맡아 움직이고, 지지는 땅을 맡아 쓰이기를 기다린다. 천간은 하나를 품고 지지는 여럿을 감춘다',
    지지불가,
    동한지지: 動,
    정적인십성: 정적,
    설명: 動.length
      ? `${動.map(x => x.지지).join('·')}이 회국해 動했으므로, 그 자리는 지지라도 천간처럼 작용한다`
      : '회국한 지지가 없으므로, 지지에만 있는 십성은 아직 조용히 쓰이기를 기다리는 상태다',
    원문: '干主天，動而有爲；支主地，靜以待用 … 然必會有動，是正與干有別也',
  };
}

/**
 * 엔진이 27편을 지키는지 검사한다.
 * 지지에만 관살·상관이 있는 명식이 혼잡·견관으로 잘못 잡히면 위반이다.
 */
function audit(judgeFn) {
  const cases = [
    { 이름:'甲用酉官 + 지지 申酉 (혼잡 아님)',
      m:{ yeonGan:'丙', yeonJi:'申', wolGan:'辛', wolJi:'酉', ilGan:'甲', ilJi:'子', siGan:'戊', siJi:'辰' },
      금지:['관살혼잡','편관'] },
    { 이름:'甲用酉官 + 지지 午 (견관 아님)',
      m:{ yeonGan:'丙', yeonJi:'午', wolGan:'辛', wolJi:'酉', ilGan:'甲', ilJi:'子', siGan:'戊', siJi:'辰' },
      금지:['상관'] },
    { 이름:'甲用酉官 + 寅午戌 회국 (견관 성립)',
      m:{ yeonGan:'丙', yeonJi:'午', wolGan:'辛', wolJi:'酉', ilGan:'甲', ilJi:'寅', siGan:'戊', siJi:'戌' },
      기대패격:true },
  ];
  return cases.map(c => {
    const r = judgeFn({ ...c.m, daysFromJeolip: 15 });
    const 파괴자 = r.조문.패격.map(p => p.파괴자).filter(Boolean);
    const 위반 = c.금지 ? 파괴자.some(x => c.금지.includes(x)) : false;
    const 기대 = c.기대패격 ? r.조문.패격.length > 0 : true;
    return { 이름:c.이름, 격:r.격, 결론:r.결론, 파괴자, 통과: !위반 && 기대 };
  });
}

module.exports = { 지지불가, 동한지지, analyze, audit };

if (require.main === module) {
  const { judge } = require('./gyeokguk');
  console.log('── 27편 준수 검사 ──');
  let ok = 0;
  for (const r of audit(judge)) {
    console.log(r.통과 ? '✓' : '✗', r.이름.padEnd(30), r.격 + '격', r.결론,
                r.파괴자.length ? `(${r.파괴자.join(',')})` : '');
    if (r.통과) ok++;
  }
  console.log(`통과 ${ok}/3`);
}
