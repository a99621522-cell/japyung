/**
 * scripts/chanwei_un_check.js — 『滴天髓闡微』 명례 평의 운 길흉 진술(fixtures_chanwei_un.js)로 엔진 운 판정을 대조 (2026-10-09, 29차-3)
 *   node scripts/chanwei_un_check.js          표 + 기준값 검사(밑돌면 exit 1, check.js ⑭)
 *   node scripts/chanwei_un_check.js 격자     세운 戰·衝·和 문턱·가중 격자 탐색(세운 진술) + 무작위 600 명식 세운 판정 변화 수
 *   node scripts/chanwei_un_check.js 진단     빗나간 진술 목록
 *
 * 읽기
 *   (a) 통합   — 대운 길흉.점수(자평 취운 희기 + 합충·성격변격 가감, 천간·지지 합산)
 *   (b) 분할   — 한 글자 진술(丁运·交寅)은 그 글자의 분할 점수(천간5/지지5), 간지 진술은 두 글자 부호가 같거나 한쪽이 0 이면 그 부호, 엇갈리면 중립
 *   (c) 적천수식 — 대운 글자를 세운처럼 원국 희기로만: 천간 희기 ×2 + 지지(정기) 희기 ×1 (「太歲…重天干」 가중을 대운에 옮긴 것, 대운 자체는 「重地支」라 ×1·×2 도 함께 본다)
 *   (e) 억부   — 진단용(엔진 판정 아님): 자평 격 희기 대신 衰旺論 「旺則宜洩宜傷，衰則喜幫喜助」(181) — 신강(중화신강 포함)이면 식상·재·관살 +1·인·비겁 −1, 신약이면 반대.
 *               간지 진술은 천간+지지. 闡微 任氏가 용신을 억부로 잡는 일이 많아, 어긋남이 「희기 출처」 탓인지 보려는 대조
 *   (d) 세운   — 대운 안의 流年 진술(「丙戌运丙子年」)은 엔진 세운 머리 판정(滴天髓 歲運論 戰·衝·和)
 *   일치 = 점수 > 0 ↔ 길, < 0 ↔ 흉. 점수 0(뒤섞임)은 중립으로 따로 센다. 일치율 = 일치 ÷ (일치 + 어긋남).
 * 명례에는 성별이 없어 엔진 대운 첫 간지가 평의 대운 목록 첫 간지와 같아지는 성별을 고른다(둘 다 안 맞으면 뺀다).
 */
const path = require('path'); const 뿌리 = path.join(__dirname, '..');
const { FIXTURES } = require(path.join(뿌리, 'fixtures_chanwei_un'));
const { interpret } = require(path.join(뿌리, 'interpret'));
const chwiun = require(path.join(뿌리, 'chwiun'));
const J = require(path.join(뿌리, 'jeokcheonsu'));
const seun = require(path.join(뿌리, 'seun'));
const { GAN, jeonggi, sipseong } = require(path.join(뿌리, 'jijanggan'));
const hapchung = require(path.join(뿌리, 'hapchung'));
const manse = require(path.join(뿌리, 'manse'));

// 기준값(2026-10-09 측정, 조금 아래로) — 일치율이 이 아래로 내려가면 실패. 엔진 운 규칙을 바꿀 때 보고서와 함께 고친다
const 기준 = { 대운수: 340, 통합: 0.52, 분할: 0.53, 세운: 0.35 };   // 측정 354 · 54.1% · 55.2% · 40.0%(10건) — 우연 수준이라 품질 문턱이 아니라 회귀 감시선

const 오행 = g => GAN[g].ohaeng;
const 生 = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }, 剋 = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
const 양간of = { 木: '甲', 火: '丙', 土: '戊', 金: '庚', 水: '壬' };
const 부호 = x => x > 0 ? 1 : x < 0 ? -1 : 0;

const 캐시 = new Map();
function 엔진(f, 출생연도 = 1800, 세운시작 = null) {
  const 키 = f.팔자 + '|' + 출생연도 + '|' + 세운시작;
  if (캐시.has(키)) return 캐시.get(키);
  let 답 = null;
  for (const g of ['남', '여']) {
    const r = interpret(f.m, { gender: g, 출생연도, 세운: 세운시작 != null, 세운시작: 세운시작 ?? 2026, 세운개수: 1, 월운: false });
    const d = r.단계11_행운?.대운 ?? [];
    if (d[0] && d[0].간지 === f.대운[0]) { 답 = { r, 성별: g }; break; }
  }
  캐시.set(키, 답); return 답;
}
function 희기함수(r) {
  const ctx = r.ctx; const rule = chwiun.lookup(ctx.gyeok, r.결론.상신, ctx);
  const 속함 = (십성, 그룹) => 그룹 === '정관합거' ? false : (chwiun.群[그룹] ? chwiun.群[그룹].includes(십성) : 십성 === 그룹);
  return rule ? (십성 => rule.기.some(g => 속함(십성, g)) ? -1 : rule.희.some(g => 속함(십성, g)) ? 1 : 0) : null;
}

// ── 세운 戰·衝·和 복제(격자용). 기본값 P0 이면 jeokcheonsu.세운전충화 와 점수가 같아야 한다(아래에서 확인) ──
const P0 = { 천간: 2, 지지: 1, 戰: 1, 衝당: 2, 衝: 1, 和: 1 };
function 전충화P(un, 대운, 희기of, m, P) {
  const 원국천간 = [m.yeonGan, m.wolGan, m.siGan].filter(Boolean), 원국지지 = [m.yeonJi, m.wolJi, m.ilJi, m.siJi].filter(Boolean);
  const 오행수 = o => 원국천간.filter(g => 오행(g) === o).length + 원국지지.filter(j => 오행(jeonggi(j)) === o).length;
  const 희 = g => 희기of(sipseong(m.ilGan, g));
  let 점 = 희(un.천간) * P.천간 + 희(jeonggi(un.지지)) * P.지지;
  if (!대운) return 점;
  const S = 오행(un.천간), D = 오행(대운.천간);
  const 간합 = hapchung.GANHAP.find(h => h.gan.includes(un.천간) && h.gan.includes(대운.천간) && un.천간 !== 대운.천간);
  if (!간합 && (剋[D] === S || 剋[S] === D)) {
    const 운벌세 = 剋[D] === S; const 공격 = 운벌세 ? D : S, 피해 = 운벌세 ? S : D;
    const 희공격 = 희(운벌세 ? 대운.천간 : un.천간), 희피해 = 희(운벌세 ? un.천간 : 대운.천간);
    const 통관 = 원국천간.some(g => 오행(g) === 生[공격] && 生[오행(g)] === 피해);
    const 극설 = 원국천간.some(g => 剋[오행(g)] === 공격 || 生[공격] === 오행(g));
    const 공격지지힘 = 오행(jeonggi(운벌세 ? 대운.지지 : un.지지)) === 공격 || 生[오행(jeonggi(운벌세 ? 대운.지지 : un.지지))] === 공격;
    let 가감 = 0;
    if (희피해 > 0) 가감 = 극설 ? 1 : -1;
    else if (희공격 > 0) 가감 = 통관 || 공격지지힘 ? 1 : 0;
    점 += 가감 * P.戰;
  }
  if (hapchung.CHUNG[un.지지] === 대운.지지) {
    const s = jeonggi(un.지지), d = jeonggi(대운.지지), 희쪽 = 희(s) > 0 ? '세' : 희(d) > 0 ? '운' : null;
    if (희쪽) {
      const 희지 = 희쪽 === '세' ? un.지지 : 대운.지지, 기지 = 희쪽 === '세' ? 대운.지지 : un.지지;
      const 기당 = 오행수(오행(jeonggi(기지))), 희당 = 오행수(오행(jeonggi(희지))); const 간두 = 오행(un.천간);
      const 간두돕기 = 간두 === 오행(jeonggi(기지)) || 生[간두] === 오행(jeonggi(기지)), 간두제 = 剋[간두] === 오행(jeonggi(기지));
      if (기당 >= P.衝당 || 간두돕기) 점 -= P.衝; else if (간두제 || 희당 >= P.衝당) 점 += P.衝;
    }
  }
  if (간합) { const h = 희(양간of[간합.hwa]); 점 += 부호(h) * P.和; }
  const 육합 = hapchung.YUKHAP.find(h => h.ji.includes(un.지지) && h.ji.includes(대운.지지) && un.지지 !== 대운.지지);
  if (육합) { const h = 희(양간of[육합.hwa]); 점 += 부호(h) * P.和; }
  return 점;
}
const 간지of = gz => ({ 간지: gz, 천간: gz[0], 지지: gz[1] });
function 연도of(gz) { for (let y = 1984; y < 2044; y++) if (seun.연간지(y).간지 === gz) return y; return null; }

// ── 한 번 돌려 표 만들기 ──
function 표만들기() {
  const 칸 = () => ({ 일치: 0, 어긋남: 0, 중립: 0 });
  const T = { 통합: 칸(), 분할: 칸(), 적천수식21: 칸(), 적천수식12: 칸(), 억부: 칸(), 세운: 칸(), 세운자평: 칸(), 세운원국만: 칸() };
  const 자리별 = { 간지: { 통합: 칸(), 분할: 칸() }, 천간: { 통합: 칸(), 분할: 칸() }, 지지: { 통합: 칸(), 분할: 칸() } };
  const 종화별 = { '종화 후보': 칸(), '후보 없음': 칸() };
  const 라벨별 = { 길: { 통합: 칸(), 분할: 칸() }, 흉: { 통합: 칸(), 분할: 칸() } };
  const 넣기 = (c, 점, 라벨) => { const s = 부호(점); if (점 == null || s === 0) c.중립++; else if ((s > 0) === (라벨 === '길')) c.일치++; else c.어긋남++; };
  const 빗나감 = []; const 세운자료 = []; let 성별없음 = 0, 대운없음 = 0, 보류 = 0, 대운수 = 0;
  const 명례별 = {};   // 쌍 대조 — 같은 명례 안 길 진술 운 점수 > 흉 진술 운 점수 인가(명식마다 엔진이 한쪽으로 쏠리는 것을 지운다)
  for (const f of FIXTURES) {
    if (f.종류 === '세운') {
      const e0 = 엔진(f); if (!e0) { 성별없음++; continue; }
      const du = e0.r.단계11_행운.대운.find(u => u.간지 === f.운간지); if (!du) { 대운없음++; continue; }
      const Y = 연도of(f.세운간지); const 출생 = Y - (du.시작나이 + 4) + 1;
      const e = 엔진(f, 출생, Y); const s = e?.r.단계11b_세운?.[0];
      if (!s || s.대운?.간지 !== f.운간지) { 대운없음++; continue; }
      const 희기of = 희기함수(e.r); if (!희기of || s.길흉.점수 == null) { 보류++; continue; }
      const uc가감 = s.상호작용?.가감 ?? 0;
      const 실제 = J.세운전충화(간지of(f.세운간지), du, 희기of, e.r.ctx, f.m).점수;
      const 복제 = 전충화P(간지of(f.세운간지), du, 희기of, f.m, P0);
      if (실제 !== 복제) throw new Error(`복제 불일치 ${f.id}: ${실제} ≠ ${복제}`);
      넣기(T.세운, s.길흉.점수, f.라벨); 넣기(T.세운자평, s.길흉.자평읽기?.점수, f.라벨); 넣기(T.세운원국만, 전충화P(간지of(f.세운간지), null, 희기of, f.m, P0), f.라벨);
      세운자료.push({ f, du, 희기of, uc가감 });
      if (부호(s.길흉.점수) && (부호(s.길흉.점수) > 0) !== (f.라벨 === '길')) 빗나감.push(`${f.id} ${f.명례} ${f.팔자} 대운 ${f.운간지} 세운 ${f.세운간지} 라벨 ${f.라벨} 엔진 ${s.길흉.점수} | ${f.인용}`);
      continue;
    }
    const e = 엔진(f); if (!e) { 성별없음++; continue; }
    const du = e.r.단계11_행운.대운.find(u => u.간지 === f.운간지); if (!du) { 대운없음++; continue; }
    if (du.길흉?.점수 == null) { 보류++; continue; }
    대운수++;
    (명례별[f.명례] ||= []).push({ 라벨: f.라벨, 통합: du.길흉.점수, 분할: null });
    const 분 = du.읽기.분할; const 천 = 분.천간5.점수, 지 = 분.지지5.점수;
    const 분할점 = f.자리 === '천간' ? 천 : f.자리 === '지지' ? 지 : (부호(천) * 부호(지) < 0 ? 0 : 부호(천) + 부호(지));
    명례별[f.명례].at(-1).분할 = 분할점;
    넣기(T.통합, du.길흉.점수, f.라벨); 넣기(T.분할, 분할점, f.라벨); 넣기(종화별[e.r.단계_흐름?.종화?.후보 ? '종화 후보' : '후보 없음'], du.길흉.점수, f.라벨);
    넣기(자리별[f.자리].통합, du.길흉.점수, f.라벨); 넣기(자리별[f.자리].분할, 분할점, f.라벨);
    넣기(라벨별[f.라벨].통합, du.길흉.점수, f.라벨); 넣기(라벨별[f.라벨].분할, 분할점, f.라벨);
    const 희기of = 희기함수(e.r);
    if (희기of) {
      const hg = 희기of(sipseong(f.m.ilGan, du.천간)), hj = 희기of(sipseong(f.m.ilGan, jeonggi(du.지지)));
      const c21 = f.자리 === '천간' ? hg : f.자리 === '지지' ? hj : hg * 2 + hj;
      const c12 = f.자리 === '천간' ? hg : f.자리 === '지지' ? hj : hg + hj * 2;
      넣기(T.적천수식21, c21, f.라벨); 넣기(T.적천수식12, c12, f.라벨);
    } else { T.적천수식21.중립++; T.적천수식12.중립++; }
    const 강 = /신강/.test(e.r.ctx.신강판정 || '') ? 1 : /신약/.test(e.r.ctx.신강판정 || '') ? -1 : 0;
    const 억 = g => { const t = sipseong(f.m.ilGan, g); return (/비견|겁재|인/.test(t) ? -1 : 1) * 강; };
    넣기(T.억부, f.자리 === '천간' ? 억(du.천간) : f.자리 === '지지' ? 억(jeonggi(du.지지)) : 억(du.천간) + 억(jeonggi(du.지지)), f.라벨);
    if (부호(du.길흉.점수) && (부호(du.길흉.점수) > 0) !== (f.라벨 === '길')) 빗나감.push(`${f.id} ${f.명례} ${f.팔자} ${f.자리} ${f.운자 || f.운간지} 라벨 ${f.라벨} 통합 ${du.길흉.점수} 천간5 ${천} 지지5 ${지} | ${f.인용}`);
  }
  const 쌍 = { 통합: { 맞음: 0, 틀림: 0, 같음: 0 }, 분할: { 맞음: 0, 틀림: 0, 같음: 0 } };
  for (const xs of Object.values(명례별)) for (const a of xs) for (const b of xs) if (a.라벨 === '길' && b.라벨 === '흉')
    for (const k of ['통합', '분할']) { const d = a[k] - b[k]; if (d > 0) 쌍[k].맞음++; else if (d < 0) 쌍[k].틀림++; else 쌍[k].같음++; }
  return { 쌍, 종화별, T, 자리별, 라벨별, 빗나감, 세운자료, 성별없음, 대운없음, 보류, 대운수 };
}
const 율 = c => c.일치 + c.어긋남 ? c.일치 / (c.일치 + c.어긋남) : 0;
const 줄 = (이름, c) => `| ${이름} | ${c.일치} | ${c.어긋남} | ${c.중립} | ${(율(c) * 100).toFixed(1)}% |`;

function 격자(세운자료) {
  // 무작위 600 명식 × 10해 (2026~2035) — 세운 판정어(±2 자름) 변화 수
  let seed = 2909; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const 표본 = [];
  for (let i = 0; i < 600; i++) {
    const y = 1950 + Math.floor(rnd() * 61), mo = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28), h = Math.floor(rnd() * 24);
    const g = rnd() < 0.5 ? '남' : '여';
    try {
      const ms = manse.사주(y, mo, d, h, 30, { 성별: g }); const dw = manse.대운수(ms, g);
      const r = interpret(ms.명식, { gender: g, 출생연도: y, daysToJeolgi: dw.날수, 세운시작: 2026, 세운개수: 10, 월운: false });
      const 희기of = 희기함수(r); if (!희기of) continue;
      for (const s of r.단계11b_세운) { const du = s.대운 ? r.단계11_행운.대운.find(u => u.간지 === s.대운.간지) : null; 표본.push({ m: ms.명식, s, du, 희기of, uc: s.상호작용?.가감 ?? 0 }); }
    } catch (e) { /* 건너뜀 */ }
  }
  const 자름 = x => Math.max(-2, Math.min(2, x));
  const 결과 = [];
  for (const 천간 of [1, 2, 3]) for (const 지지 of [0, 1, 2]) for (const 戰 of [0, 1, 2]) for (const 衝당 of [1, 2, 3]) for (const 衝 of [0, 1, 2]) for (const 和 of [0, 1, 2]) {
    const P = { 천간, 지지, 戰, 衝당, 衝, 和 };
    let 일 = 0, 어 = 0, 중 = 0;
    for (const x of 세운자료) { const 점 = 전충화P(간지of(x.f.세운간지), x.du, x.희기of, x.f.m, P) + x.uc가감; const s = 부호(점); if (!s) 중++; else if ((s > 0) === (x.f.라벨 === '길')) 일++; else 어++; }
    let 변화 = 0;
    for (const x of 표본) { const 기본 = 자름(전충화P(x.s, x.du, x.희기of, x.m, P0) + x.uc), 새 = 자름(전충화P(x.s, x.du, x.희기of, x.m, P) + x.uc); if (기본 !== 새) 변화++; }
    결과.push({ P, 일, 어, 중, 율: 일 + 어 ? 일 / (일 + 어) : 0, 변화 });
  }
  return { 결과, 표본수: 표본.length };
}

if (require.main === module) {
  const 모드 = process.argv[2];
  const R = 표만들기();
  const 대운fx = FIXTURES.filter(x => x.종류 !== '세운').length, 세운fx = FIXTURES.length - 대운fx;
  console.log(`진술 ${FIXTURES.length}건(대운 ${대운fx} · 세운 ${세운fx}) · 성별 못 정함 ${R.성별없음} · 엔진 대운에 없음 ${R.대운없음} · 판정 보류 ${R.보류} · 대조한 대운 진술 ${R.대운수}`);
  console.log('| 읽기 | 일치 | 어긋남 | 중립(0) | 일치율 |\n|---|---|---|---|---|');
  for (const [k, v] of Object.entries(R.T)) console.log(줄(k, v));
  for (const [k, v] of Object.entries(R.쌍)) console.log(`쌍 대조(${k}) 같은 명례 길·흉 쌍 ${v.맞음 + v.틀림 + v.같음} — 길 쪽이 높음 ${v.맞음} · 낮음 ${v.틀림} · 같음 ${v.같음} → ${(v.맞음 / Math.max(1, v.맞음 + v.틀림) * 100).toFixed(1)}%`);
  console.log('\n자리별'); for (const [k, v] of Object.entries(R.자리별)) { console.log(줄(k + ' 통합', v.통합)); console.log(줄(k + ' 분할', v.분할)); }
  console.log('\n적천수 종화 후보 여부별(통합)'); for (const [k, v] of Object.entries(R.종화별)) console.log(줄(k, v));
  console.log('\n라벨별'); for (const [k, v] of Object.entries(R.라벨별)) { console.log(줄(k + ' 통합', v.통합)); console.log(줄(k + ' 분할', v.분할)); }
  if (모드 === '진단') { console.log('\n빗나감'); for (const l of R.빗나감) console.log(l); }
  if (모드 === '격자') {
    const { 결과, 표본수 } = 격자(R.세운자료);
    const 기본 = 결과.find(x => JSON.stringify(x.P) === JSON.stringify(P0));
    console.log(`\n격자 ${결과.length}조합 · 세운 진술 ${R.세운자료.length} · 무작위 세운 표본 ${표본수}`);
    console.log(`기본 ${JSON.stringify(P0)} 일치 ${기본.일}/${기본.일 + 기본.어} (중립 ${기본.중}) ${(기본.율 * 100).toFixed(1)}%`);
    결과.sort((a, b) => b.율 - a.율 || a.변화 - b.변화);
    console.log('상위 15'); for (const x of 결과.slice(0, 15)) console.log(JSON.stringify(x.P), `일치 ${x.일}/${x.일 + x.어} 중립 ${x.중} ${(x.율 * 100).toFixed(1)}% · 무작위 판정 변화 ${x.변화}/${표본수}`);
    const 최대 = 결과[0].율; const 같은최대 = 결과.filter(x => x.율 === 최대);
    console.log(`최대 일치율 ${(최대 * 100).toFixed(1)}% 조합 ${같은최대.length}개 · 그 가운데 변화 최소 ${Math.min(...같은최대.map(x => x.변화))}`);
  }
  if (!모드) {
    const 문제 = [];
    if (R.대운수 < 기준.대운수) 문제.push(`대조한 대운 진술 ${R.대운수} < ${기준.대운수}`);
    if (율(R.T.통합) < 기준.통합) 문제.push(`통합 일치율 ${율(R.T.통합).toFixed(3)} < ${기준.통합}`);
    if (율(R.T.분할) < 기준.분할) 문제.push(`분할 일치율 ${율(R.T.분할).toFixed(3)} < ${기준.분할}`);
    if (율(R.T.세운) < 기준.세운) 문제.push(`세운 일치율 ${율(R.T.세운).toFixed(3)} < ${기준.세운}`);
    console.log(`\n문제 항목 ${문제.length}`); for (const p of 문제) console.log(' - ' + p);
    process.exit(문제.length ? 1 : 0);
  }
}
module.exports = { 표만들기, 전충화P, P0 };
