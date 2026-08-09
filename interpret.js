/**
 * interpret.js — 자평진전 12단계 조립층
 * 사주팔자집 (2026-08-02)
 *
 * 원전 편차 순서를 그대로 따른다.
 *
 *   0  명식 확립          (호출측 책임 — estimateHourPillar)
 *   1  형충회합           hapchung.js      ← 격 취용보다 앞
 *   2  격 취용            jijanggan.js
 *   3  순용/역용          jijanggan.js
 *   4  상신               gyeokguk.js
 *   5  성패·구응          gyeokguk.js
 *   6  용신변화           본 파일
 *   7  순잡               sunjap.js
 *   8  격국 고저          sunjap.js
 *   9  조후 배합          본 파일 (참고 층 — 성패를 바꾸지 않는다)
 *  10  궁위·육친          haengun.js
 *  11  행운               haengun.js
 */

const { judge } = require('./gyeokguk');
const { strength } = require('./tonggeun');
const { GAN, JIJANGGAN, jeonggi, sipseong, JIJANGGAN: JG } = require('./jijanggan');
const { sunjap, godo } = require('./sunjap');
const ingwa = require('./ingwa');
const chohu = require('./chohu');
const sangsin = require('./sangsin');
const japgi = require('./japgi');
const myogo = require('./myogo');
const seonhu = require('./seonhu');
const oegyeok = require('./oegyeok');
const misonglip = require('./misonglip');
const manse = require('./manse');
const yukchin23 = require('./yukchin');
const cheoja = require('./cheoja');
const ganji = require('./ganji');
const sisol = require('./sisol');
const ohjeon = require('./ohjeon');
const seun = require('./seun');
const wolun = require('./wolun');
const { haengun } = require('./haengun');

// ─────────────────────────────────────────────
// 9단계 · 조후 — 12지지 전부 (리뷰 지적 ④)
// ─────────────────────────────────────────────
const JOHU = {
  寅: { 기후:'한기 잔존', 필요:['火'], 정도:0.40, 비고:'입춘 직후는 아직 춥다' },
  卯: { 기후:'온화',      필요:[],     정도:0.00, 비고:'조후 부담 없음' },
  辰: { 기후:'습토',      필요:['火'], 정도:0.20, 비고:'습을 말릴 온기' },
  巳: { 기후:'난',        필요:['水'], 정도:0.50, 비고:'화기 시작' },
  午: { 기후:'극난',      필요:['水'], 정도:0.80, 비고:'수가 절실' },
  未: { 기후:'난조',      필요:['水'], 정도:0.60, 비고:'조토라 윤택이 필요' },
  申: { 기후:'한기 시작', 필요:['火'], 정도:0.30, 비고:'금이 왕해 온기가 필요' },
  酉: { 기후:'량',        필요:[],     정도:0.00, 비고:'조후 부담 없음' },
  戌: { 기후:'조토',      필요:['水'], 정도:0.20, 비고:'건조함을 적실 것' },
  亥: { 기후:'한',        필요:['火'], 정도:0.50, 비고:'한기 본격' },
  子: { 기후:'극한',      필요:['火'], 정도:0.80, 비고:'화가 절실' },
  丑: { 기후:'한습',      필요:['火'], 정도:0.60, 비고:'얼어붙은 습토' },
};

function johu(wolJi, jiPositions, ganList, daysFromJeolip = 15) {
  const base = JOHU[wolJi];
  if (!base) throw new Error(`알 수 없는 월지: ${wolJi}`);

  const 심천 = 1 - Math.abs(daysFromJeolip - 15) / 30;
  const 정도 = +(base.정도 * Math.max(0.6, 심천)).toFixed(3);

  const pool = [];
  for (const g of ganList) if (g) pool.push(GAN[g].ohaeng);
  for (const [, ji] of jiPositions) {
    if (!ji) continue;
    for (const jg of JIJANGGAN[ji]) pool.push(GAN[jg.gan].ohaeng);
  }

  const 충족 = base.필요.map(o => ({ 오행:o, 보유: pool.filter(x => x === o).length }));
  const 결핍 = 충족.filter(x => x.보유 === 0).map(x => x.오행);

  return { ...base, 정도, 충족, 결핍,
           상태: base.정도 === 0 ? '무관' : 결핍.length ? '조후 결핍' : '조후 충족' };
}

// ─────────────────────────────────────────────
// 6단계 · 용신변화
// ─────────────────────────────────────────────
/**
 * 월령 지장간이 여럿 투출하면 격이 하나로 고정되지 않는다.
 * 채택하지 않은 후보를 '변화 가능성'으로 병기한다.
 */
function byeonhwa(ctx, m) {
  const 후보 = [];
  const pool = [m.yeonGan, m.wolGan, m.siGan].filter(Boolean);

  for (const jg of JIJANGGAN[m.wolJi]) {
    if (!pool.includes(jg.gan)) continue;
    const ss = sipseong(m.ilGan, jg.gan);
    후보.push({ 천간:jg.gan, 깊이:jg.wi, 격:ss, 채택: ss === ctx.gyeok });
  }

  // 월지가 합국으로 화한 경우도 변화 요인
  const 화 = ctx.합충?.월지?.화;

  return {
    변화여지: 후보.filter(x => !x.채택).length > 0 || !!화,
    후보,
    합화: 화 ? { 화한오행:화, 근거:ctx.합충.월지.화근거?.지지?.join('') } : null,
    비고: 후보.filter(x => !x.채택).length
      ? `${후보.filter(x=>!x.채택).map(x=>`${x.격}(${x.천간})`).join(', ')}으로도 볼 여지가 있다`
      : (화 ? `월지가 ${화}로 화해 격이 달라질 수 있다` : '격이 하나로 고정된다'),
  };
}

// ─────────────────────────────────────────────
// 조립
// ─────────────────────────────────────────────
function interpret(m, opt = {}) {
  const gender = opt.gender ?? '남';
  const jiPos   = [['년', m.yeonJi], ['월', m.wolJi], ['일', m.ilJi], ['시', m.siJi]];
  const ganList = [m.yeonGan, m.wolGan, m.ilGan, m.siGan];

  // 1~5단계
  const g  = judge(m);
  const ctx = g.ctx;

  // 6단계 — 격 취용 직후, 순잡·고저 이전 (편차 순서 그대로)
  const bh = byeonhwa(ctx, m);
  const v = ctx.변화;
  if (v?.발생) {
    bh.판정 = v.종류;
    bh.설명 = {
      변이불실본격:`${v.근거}. ${v.비고} 원문이 「變而不失本格」이라 한 형태입니다.`,
      화이불역격  :`${v.근거}. ${v.비고}`,
      변지이선    :`${v.근거} 원문은 이를 「變之而善，其格愈美」라 합니다.`,
      변지불선    :`${v.근거} 원문은 이를 「變之不善，其格遂壞」라 합니다.`,
      변화        :v.근거,
    }[v.종류] ?? v.근거;
  }

  // 13편 — 성패 판정 뒤 인과 역전을 한 겹 더 본다
  const iw = ingwa.analyze(g, m);

  // 7~8단계
  const sj = sunjap(ctx, m);
  ctx.m = m;   // 취운의 저울(jeoul.js)이 명식을 다시 봐야 하므로 실어 둔다
  ctx.순잡판정 = sj.판정;
  // 16편 — 잡기월이면 透干·會支 겸용과 유정무정을 따로 본다
  const jg16 = japgi.analyze(ctx, m);
  // 17편 — 사고를 충하면 土만 動한다. 動한 土가 재관이면 庫啟, 겁상이면 累
  const mg = myogo.analyze(ctx, m);

  // 22편 — 외격을 빌려도 되는 자리인지 먼저 막는다
  const og = oegyeok.analyze(g, m);

  // 20편 — 같은 글자라도 선후로 길흉이 갈린다
  const sh = seonhu.analyze(ctx, m);

  // 15편 — 상신이 다쳤으면 立敗其格이라 고저보다 먼저 본다
  const ss = sangsin.analyze(g, m);
  ctx.상신손상 = ss.입패;

  // 14편 — 격이 정해진 뒤의 가감이므로 고저 산출 직전에 얹는다
  const ch = chohu.analyze(ctx, g.상신, m);

  // ── 고저(12편)로 넘길 것들 ────────────────────────────
  // 성패(9편)는 조문이 정하므로 건드리지 않는다. 아래는 「고저」에만 반영된다.
  //   원문이 성패와 고저를 9편·12편으로 나눠 놓았으므로 그 경계를 지킨다.
  ctx.선후 = { 병이시: sh.병이시, 약이시: sh.약이시, 약이뒤: sh.약이뒤 };   // 20편
  ctx.상신참고손상 = ss.참고손상 ?? [];                                    // 15편
  ctx.묘고 = { 고계: mg.고계, 누: mg.누, 이미투출: mg.이미투출 };            // 17편
  ctx.기후 = {                                                           // 14편
    급함: (ch.항목 ?? []).length > 0,
    해소: (ch.항목 ?? []).some(x => x.해소 || x.충족),
  };
  // 27편 — 상신이 지지에만 있고 천간에 안 나왔으면 아직 나서지 않은 것이다
  ctx.상신지지only = (() => {
    if (!g.상신) return false;
    const 천간십성 = [m.yeonGan, m.wolGan, m.siGan]
      .filter(Boolean).map(x => sipseong(m.ilGan, x));
    if (천간십성.includes(g.상신)) return false;
    const 지지십성 = [m.yeonJi, m.wolJi, m.ilJi, m.siJi].filter(Boolean)
      .flatMap(j => JIJANGGAN[j].map(x => sipseong(m.ilGan, x.gan)));
    return 지지십성.includes(g.상신);
  })();

  const gd = godo(ctx, g.상신, m, { 고관무보: g.고관무보 });

  // 보조 (신강약)
  const st = strength(m);

  // 9단계 (참고)
  const jh = johu(m.wolJi, jiPos, ganList, m.daysFromJeolip);

  // 10~11단계
  const yc = yukchin23.analyze(g, m);   // 23편
  const cj = cheoja.analyze(g, m);      // 24편
  const gj = ganji.analyze(ctx, m);     // 27편
  const ss29 = sisol.analyze(ctx, m, g.격);  // 29편
  const oj = ohjeon.analyze(g, m, opt);      // 30편
  // 대운수 — 「순행이면 다음 절입까지, 역행이면 지난 절입 이후 일수 ÷ 3」
  //   opt.daysToJeolgi로 따로 주면 그것을 쓰고, 없으면 명식의 daysFromJeolip을 쓴다.
  //   ※ 명식의 daysFromJeolip은 **지난 절입 이후 일수**다.
  //     역행이면 그대로 쓰고, 순행이면 다음 절입까지(대략 30 - 그 값)로 환산한다.
  //     이 값을 안 넘기면 기본 15가 쓰여 대운수가 늘 5로 나온다 — 실제 나이와 어긋난다.
  const daysToJeolgi = (() => {
    if (opt.daysToJeolgi != null) return opt.daysToJeolgi;
    const d = m.daysFromJeolip;
    if (d == null) return 15;
    const 년간음양 = GAN[m.yeonGan]?.eumyang;
    const 순행 = (년간음양 === '양' && gender === '남') || (년간음양 === '음' && gender === '여');
    return 순행 ? Math.max(1, 30 - d) : d;
  })();
  const hu = haengun(m, ctx, g.상신, gender, daysToJeolgi, g);

  return {
    // 뒤에서 재료를 다시 뽑는 층(juje.js 등)을 위해 원국과 문맥을 담아 둔다
    명식: m, ctx,
    단계1_형충회합: ctx.합충,
    결론: {
      격: g.격, 용법: g.용법, 상신: g.상신, 성패: g.결론,
      근거: g.근거, 조문: g.조문,
      상신폴백: g.상신폴백 ?? null,
      순잡: sj.판정, 고저: gd.판정,
      인과역전: iw.인과역전, 최종성패: iw.최종결론,
    },
    단계6_용신변화: bh,
    단계13_인과역전: iw,
    단계7_순잡: sj,
    단계8_고저: gd,
    보조: {
      신강약: st.판정, 일간점수: st.일간점수,
      득령: st.득령, 득지: st.득지, 득세: st.득세,
      왕상휴수사: st.왕상휴수사, 뿌리: st.통근.roots, 세력: st.세력,
    },
    단계14_기후: ch,
    단계15_상신: ss,
    단계16_잡기: jg16,
    단계17_묘고: mg,
    단계20_선후: sh,
    단계22_외격: og,
      // 상신이 아직 안 나온 경우, 「어디를 더 봐야 하는가」를 함께 낸다.
      //   원문은 격이 안 섰다고 거기서 끝내지 않는다 — 13·22·27·26편이 네 갈래를 준다.
      단계상신미현: misonglip.analyze({ 결론: { 격: g.격, 성패: g.결론 } }, m),
    참고: { 조후: jh },
    단계23_육친: yc,
    단계24_처자: cj,
    단계27_간지구별: gj,
    단계29_속설: ss29,
    단계30_시주신뢰: oj,
    단계11_행운: hu,
    // 세운 — 출생연도를 주면 대운과 묶어 「此五年中」 구간까지 표시한다
    단계11b_세운: opt.세운 === false ? null : (() => {
      const se = seun.range(ctx, g, m, {
        시작연도: opt.세운시작 ?? new Date().getFullYear(),
        개수: opt.세운개수 ?? 10,
        대운목록: hu.대운, 출생연도: opt.출생연도,
      });
      // 월운 — 세운 각 해마다 붙인다.
      //   앞서는 첫 해에만 붙였는데, 그러면 「2026년 몇 월이 어떤가」를
      //   물었을 때 답할 수 없다. 세운이 있으면 그 달들도 함께 낸다.
      //   opt.월운연도를 주면 그 해만, 안 주면 전부.
      if (opt.월운 !== false) {
        const 대상 = opt.월운연도 ? [opt.월운연도] : se.map(x => x.연도);
        for (const y of 대상) {
          const 해 = se.find(x => x.연도 === y);
          if (해) 해.월운 = wolun.analyze(해, ctx, g, m);
        }
      }
      return se;
    })(),
    우선순위: '형충회합 → 격·상신 → 순잡·고저 → 신강약 → 조후',
    주의: [
      '조후는 격의 성패를 바꾸지 않는다.',
      '신살은 격국과 무관하다 (論星辰無關格局) — 자평진전 모드에서는 출력하지 말 것.',
      '행운의 길흉은 일간의 강약이 아니라 상신을 기준으로 본다.',
    ],
  };
}

function toPrompt(r) {
  const c = r.결론, b = r.보조, j = r.참고.조후, h = r.단계1_형충회합;
  const 대운3 = r.단계11_행운.대운.slice(0, 3)
    .map(u => `${u.시작나이}세 ${u.간지}(${u.길흉.판정})`).join(' / ');
  return [
    `[합충] ${h.요약}${h.월지.경고.length ? ` ※ ${h.월지.경고.join('; ')}` : ''}`,
    `[격] ${c.격}(${c.용법}) · ${c.성패} · 상신 ${c.상신 ?? '미정'}`,
    `[취용] ${c.근거}`,
    `[조문] ${[...c.조문.성격, ...c.조문.패격, ...c.조문.구응].map(x => x.id).join(', ') || '없음'}`,
    `[순잡] ${c.순잡}${r.단계7_순잡.항목.length ? ` — ${r.단계7_순잡.항목.map(x=>x.종류).join(', ')}` : ''}`,
    `[고저] ${c.고저} — ${r.단계8_고저.축?.유력?.사유 ?? ''}`,
    `[변화] ${r.단계6_용신변화.비고}`,
    `[강약] ${b.신강약}(${b.일간점수}) 득령=${b.득령} 득지=${b.득지}`,
    `[조후] ${j.기후} / ${j.상태}${j.결핍.length ? ` (결핍 ${j.결핍.join('·')})` : ''}`,
    `[행운] ${r.단계11_행운.방향} · ${대운3}`,
    `※ 해설은 격·상신을 축으로 쓸 것. 조후는 부연, 신살은 언급 금지.`,
  ].join('\n');
}

function selfTest() {
  const cases = [
    { name:'甲 酉월 정관격', m:{ yeonGan:'庚', yeonJi:'申', wolGan:'辛', wolJi:'酉', ilGan:'甲', ilJi:'子', siGan:'戊', siJi:'辰', daysFromJeolip:12 } },
    { name:'甲 卯월 양인격', m:{ yeonGan:'甲', yeonJi:'寅', wolGan:'丁', wolJi:'卯', ilGan:'甲', ilJi:'午', siGan:'丙', siJi:'寅', daysFromJeolip:20 } },
    { name:'丙 子월 (합충 다발)', m:{ yeonGan:'壬', yeonJi:'午', wolGan:'壬', wolJi:'子', ilGan:'丙', ilJi:'申', siGan:'癸', siJi:'辰', daysFromJeolip:15 } },
  ];
  for (const c of cases) {
    console.log(`── ${c.name}`);
    console.log(toPrompt(interpret(c.m)));
    console.log();
  }
  const 지지 = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const 누락 = 지지.filter(j => !JOHU[j]);
  console.log(누락.length ? `✗ 조후 누락: ${누락}` : '✓ 12지지 조후 전부 정의됨');
  return 누락.length === 0;
}

module.exports = { JOHU, johu, byeonhwa, interpret, toPrompt, selfTest };

if (require.main === module) selfTest();

/**
 * 생년월일시로 바로 간명한다 — 만세력을 거쳐 interpret으로 넘긴다.
 *   앱에서 쓰는 입구는 이쪽이다. 사용자는 간지를 몰라도 된다.
 *
 * @param {object} p { 년, 월, 일, 시, 분, 성별, 진태양시보정 }
 */
function 생년월일시로(p) {
  const r = manse.사주(p.년, p.월, p.일, p.시 ?? 12, p.분 ?? 0,
                       { 진태양시보정: p.진태양시보정 });
  const d = manse.대운수(r, p.성별 ?? '남');
  const out = interpret(r.명식, {
    출생연도: r.명식.yeonGan && p.년,
    gender: p.성별 ?? '남',
    daysToJeolgi: d.날수,          // 방향에 맞는 날수를 그대로 넘긴다
    ...p.opt,
  });
  out.만세력 = { 사주: r.사주, 절기: r.절기, 보정: r.보정, 경고: r.경고, 대운: d };
  return out;
}

module.exports.생년월일시로 = 생년월일시로;
