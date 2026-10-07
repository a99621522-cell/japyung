/**
 * jomun_trace.js — 전문가 모드 (2026-10-07, docs/PROMPTS.md 7)
 *
 *   추적(r, opt)        조문 추적 — 걸린 조문마다 id → 원문·원문 줄 번호(docs/*_wonmun.txt)·걸린 원시 조건의 성립 여부
 *   시주민감도(m, opt)  시각 모름 — 열두 시주를 다 넣어 격·상신·성패·조후 주판정이 어떻게 갈리는지 표
 *   비교표(rA, rB)      두 명식 나란히 — 판정 사실만. 궁합 판정·점수·어울림 표현은 두지 않는다(CLAUDE.md 「궁합 판정 금지」)
 *
 * 판정은 그대로 interpret·gyeokguk·gungtong_jomun 의 것이고, 이 모듈은 그 근거를 꺼내 보이기만 한다. 표시금지 조문의 원문은 여기서도 가린다.
 */
const { JOMUN, evalCond } = require('./gyeokguk');
const GJ = require('./gungtong_jomun');
const hapchung = require('./hapchung');
let 줄표 = {}; try { 줄표 = require('./jomun_lines'); } catch (e) { 줄표 = {}; }

const 이체 = { '衝':'沖','剋':'尅','克':'尅','殺':'煞','碍':'礙','強':'强','并':'並','為':'爲','禄':'祿','却':'卻','衆':'眾','隻':'只','製':'制','才':'財','塡':'填','値':'值','已':'己','緩':'綬','祗':'只','祇':'只','幹':'干','兇':'凶','醜':'丑' };
const 구두 = /[\s，。、；：！？「」『』（）()《》〈〉【】\[\]…·—\-－＿_\*＊~～'"‘’“”,.;:!?<>|│]/g;
const 정규 = s => String(s).replace(구두, '').replace(/./gu, c => 이체[c] ?? c);
const 줄of = (id, 원문) => (줄표[id] && 줄표[id].줄 && 줄표[id].줄.length) ? 줄표[id] : (원문 && 줄표['원문:' + 정규(원문)]) || 줄표[id] || null;

/** 자평진전 조문 조건을 키마다 따로 평가한다 — evalCond 와 같은 뜻, 성립/불성립을 낱낱이 */
function 조건풀이(cond, ctx) {
  if (!cond) return [];
  const map = ctx.cheongan || {}, jiji = ctx.jiji || {}, 합국 = ctx.합국 || {};
  const 간 = s => (map[s] || []).length > 0, 어디든 = s => 간(s) || (jiji[s] || []).length > 0;
  const 자리 = s => [...(map[s] || []).map(p => `${p}간`), ...((jiji[s] || []).map(p => `${p}지`))].join('·');
  const out = [];
  const 넣기 = (키, 값, 성립, 근거) => out.push({ 키, 값: Array.isArray(값) ? 값.join('·') : String(값), 성립, 근거 });
  if (cond.투간) 넣기('투간(모두 천간에)', cond.투간, cond.투간.every(간), cond.투간.map(s => `${s} ${간(s) ? '있음(' + 자리(s) + ')' : '없음'}`).join(', '));
  if (cond.투간_or) 넣기('투간(하나라도)', cond.투간_or, cond.투간_or.some(간), cond.투간_or.filter(간).map(s => `${s}(${자리(s)})`).join(', ') || '없음');
  if (cond.투간_or2) 넣기('투간(하나라도 ②)', cond.투간_or2, cond.투간_or2.some(간), cond.투간_or2.filter(간).map(s => `${s}(${자리(s)})`).join(', ') || '없음');
  if (cond.유) 넣기('있음(천간·지지 어디든)', cond.유, cond.유.every(어디든), cond.유.map(s => `${s} ${어디든(s) ? '있음(' + 자리(s) + ')' : '없음'}`).join(', '));
  if (cond.유_or) 넣기('있음(하나라도)', cond.유_or, cond.유_or.some(어디든), cond.유_or.filter(어디든).map(s => `${s}(${자리(s)})`).join(', ') || '없음');
  if (cond.무) 넣기('없음(어디에도)', cond.무, !cond.무.some(어디든), cond.무.filter(어디든).map(s => `${s} 있음(${자리(s)})`).join(', ') || '모두 없음');
  if (cond.천간무) 넣기('천간에 없음', cond.천간무, !cond.천간무.some(간), cond.천간무.filter(간).map(s => `${s} 천간에 있음(${자리(s)})`).join(', ') || '천간에 없음');
  if (cond.합국) 넣기('회국 있음', cond.합국, cond.합국.some(s => (합국[s] || []).length > 0), cond.합국.filter(s => (합국[s] || []).length).join(', ') || '없음');
  if (cond.합국무) 넣기('회국 없음', cond.합국무, !cond.합국무.some(s => (합국[s] || []).length > 0), cond.합국무.filter(s => (합국[s] || []).length).join(', ') || '없음');
  if (cond.충월지 !== undefined) 넣기('월지 충', cond.충월지 ? '있어야' : '없어야', cond.충월지 === !!ctx.chungWolji, `월지 충 ${ctx.chungWolji ? '있음' : '없음'}`);
  if (cond.fn) { let ok = null; try { ok = !!cond.fn(ctx); } catch (e) { ok = null; } 넣기('조건식(fn)', cond.fn.toString().replace(/\s+/g, ' ').slice(0, 160), ok, ok == null ? '평가 못함' : (ok ? '성립' : '불성립')); }
  return out;
}

/** 조문 추적 */
function 추적(r, opt = {}) {
  const m = r.명식, ctx = r.ctx || {};
  const 성별 = opt.성별 || opt.gender || null;
  const 자평 = [];
  const 조 = (r.결론 && r.결론.조문) || {};
  const 분류 = [['성격', 조.성격], ['패격', 조.패격], ['구응', 조.구응], ['대기', 조.대기]];
  const 본것 = new Set();
  for (const [판정, 목록] of 분류) for (const j of (목록 || [])) {
    if (본것.has(j.id)) continue; 본것.add(j.id);
    const 원 = JOMUN.find(x => x.id === j.id) || j;
    const 위치 = 줄of(j.id, 원.원문);
    자평.push({ id: j.id, 판정, 격: 원.격, 상신: 원.상신 ?? null, 기본: !!원.기본, 원문: 원.원문, 비고: 원.비고 || null, 책: '자평진전', 장: 위치 ? 위치.장 : null, 줄: 위치 ? 위치.줄 : [],
      성립: (() => { try { return evalCond(원.조건, ctx); } catch (e) { return null; } })(), 조건: 조건풀이(원.조건, ctx) });
  }
  // 걸리지 않은 같은 격 조문도 「왜 안 걸렸나」 — 전문가가 빠진 조문을 찾을 때 (opt.전체 일 때만)
  const 안걸림 = opt.전체 ? JOMUN.filter(x => (Array.isArray(x.격) ? x.격.includes(r.결론.격) : x.격 === r.결론.격) && !본것.has(x.id)).map(x => { const 위치 = 줄of(x.id, x.원문); return { id: x.id, 판정: x.판정, 원문: x.원문, 줄: 위치 ? 위치.줄 : [], 조건: 조건풀이(x.조건, ctx) }; }) : undefined;
  // 취운
  const 취 = (r.단계11_행운 || {}).취운조문 || null;
  const 취운 = 취 ? { 국: 취.국 || null, 희: 취.희 || [], 기: 취.기 || [], 원문: (취.원문 || []).map(s => { const w = 줄표['원문:' + 정규(s)]; return { 글: s, 줄: w ? w.줄 : [], 장: w ? w.장 : null }; }) } : null;
  // 궁통보감
  let 궁통 = null;
  try {
    const R = GJ.걸린조문(m, { 성별 });
    if (R) {
      const 꼴 = (j, 자리) => { const 위치 = 줄of(j.id, j.근거 || j.원문); const 가림 = !!j.표시금지; return { id: j.id, 자리, 종류: j.종류 || j.유형 || null, 층: j.층 || null, 원문: 가림 ? GJ.비공개원문 : j.원문, 판정어: 가림 ? (j.판정 ? GJ.비공개판정 : null) : (j.판정 || null), 결: j.결 || null, 표시금지: 가림, 줄: 위치 ? 위치.줄 : [], 조건식: j.조건 ? j.조건.toString().replace(/\s+/g, ' ').slice(0, 200) : null, 특수성: j.특수성 ?? null }; };
      궁통 = { 걸린: R.걸린.map(j => 꼴(j, R.주 && R.주.id === j.id ? '주판정' : (j.종류 === '판정' ? '함께 걸린 조건' : j.종류))), 여명: R.여명.map(j => 꼴(j, '여명 조문')), 질병수: R.질병.length, 보류: R.보류, 원시: '透·藏(중기·정기)·有·無·無藏·多·一派·支成局·合去·有根·透有根·透無根·上半月·下半月 — gungtong_jomun.js' };
    }
  } catch (e) { 궁통 = { 오류: String(e && e.message || e).slice(0, 120) }; }
  // 셋째 층 「흐름」(滴天髓, 2026-10-07) — 걸린 조문(십간·쇠왕·종화·성정)과 세운 戰衝和 조문
  let 흐름 = null;
  try {
    const jc = r.단계_흐름;
    if (jc && !jc.오류) {
      const 꼴 = (조문, 자리, 결) => { const 위치 = 줄of(조문.id, 조문.원문); return { id: 조문.id, 자리, 원문: 조문.원문, 줄: 위치 && 위치.줄 && 위치.줄.length ? 위치.줄 : (조문.줄 ? [조문.줄] : []), 장: 위치 ? 위치.장 : null, 결 }; };
      흐름 = { 걸린: [꼴(jc.십간.조문, '십간 성정', jc.십간.결), 꼴(jc.쇠왕.조문, `쇠왕 ${jc.쇠왕.상태}`, jc.쇠왕.결), ...(jc.종화.조문 ? [꼴(jc.종화.조문, `종화 후보 ${jc.종화.후보}`, jc.종화.근거.join(' / '))] : []), 꼴(jc.성정.조문, `성정${jc.성정.편중 ? ' ' + jc.성정.편중 + ' 편중' : ''}`, jc.성정.결)],
        세운: ((r.단계11b_세운 || []).slice(0, 3)).map(x => ({ 연도: x.연도, 간지: x.간지, 판정: x.길흉.판정, 전충화: (x.길흉.전충화 || []).map(e => ({ 종류: e.종류, 꼴: e.꼴, 가감: e.가감, 줄: e.줄, 원문: e.원문 })), 자평읽기: x.길흉.자평읽기 ? x.길흉.자평읽기.판정 : null })),
        안내: '원문 줄은 docs/jeokcheonsu_wonmun.txt(wikisource 滴天髓輯要), 출처 闡微 는 docs/chanwei_wonmun.txt(任鐵樵 평, 간체). 종·화는 후보일 뿐 자평 격을 바꾸지 않는다' };
    }
  } catch (e) { 흐름 = { 오류: String(e && e.message || e).slice(0, 120) }; }
  return { 자평, 안걸림, 취운, 궁통, 흐름, 안내: '줄 번호는 docs/japyeong_wonmun.txt(東里書齋 中州本)·docs/gungtong_wonmun.txt(wikisource 번체) 의 것. 조건 성립 여부는 엔진이 쓴 ctx 로 다시 평가한 값이다' };
}

/** 시각 모름 — 열두 시주 민감도 */
function 시주민감도(m, opt = {}) {
  const { interpret } = require('./interpret');
  const 간 = '甲乙丙丁戊己庚辛壬癸', 지 = '子丑寅卯辰巳午未申酉戌亥';
  const 시두 = { 甲: 0, 己: 0, 乙: 2, 庚: 2, 丙: 4, 辛: 4, 丁: 6, 壬: 6, 戊: 8, 癸: 8 }[m.ilGan];
  const 바탕 = { ...m, siGan: null, siJi: null };
  const 요약 = r => { let 궁 = null; try { const g = GJ.analyze(r.명식, { 성별: opt.gender || opt.성별 }); 궁 = g && g.주판정 ? g.주판정.id : null; } catch (e) {} const c = r.결론 || {}; return { 격: c.격, 상신: c.상신, 성패: c.성패, 최종성패: c.최종성패, 고저: c.고저, 궁통주판정: 궁 }; };
  const 기준 = 요약(interpret(바탕, { ...opt, 시주불확실: true }));
  const 행 = [];
  for (let i = 0; i < 12; i++) {
    const siJi = 지[i], siGan = 간[(시두 + i) % 10];
    let v; try { v = 요약(interpret({ ...m, siGan, siJi }, opt)); } catch (e) { v = { 오류: e.message }; }
    const 다른칸 = Object.keys(기준).filter(k => JSON.stringify(기준[k] ?? null) !== JSON.stringify(v[k] ?? null));
    행.push({ 시주: siGan + siJi, 시각: `${(i * 2 + 23) % 24}~${(i * 2 + 1) % 24}시`, ...v, 다른칸 });
  }
  const 갈림 = {}; for (const k of Object.keys(기준)) 갈림[k] = new Set(행.map(x => JSON.stringify(x[k] ?? null))).size;
  return { 기준, 행, 갈림, 안내: '시각을 몰라 시주 없이 판정한 값(기준)과 열두 시주를 넣었을 때의 값. 「다른칸」이 빈 시주는 시각이 그 두 시간 안이면 판정이 달라지지 않는다는 뜻이다. 시주는 늦은 때와 자녀 자리라 운·육친 읽기는 이 표 밖이다' };
}

/** 두 명식 비교표 — 사실만 */
function 비교표(rA, rB, opt = {}) {
  const 줄 = (이름, f) => ({ 항목: 이름, A: f(rA), B: f(rB) });
  const 명 = r => r.명식, c = r => r.결론 || {};
  const 궁 = r => { try { return GJ.analyze(r.명식, { 성별: r.참고 && r.참고.성별 }); } catch (e) { return null; } };
  const gA = 궁(rA), gB = 궁(rB);
  const 행 = [
    줄('사주', r => `${명(r).yeonGan}${명(r).yeonJi} ${명(r).wolGan}${명(r).wolJi} ${명(r).ilGan}${명(r).ilJi} ${명(r).siGan || '·'}${명(r).siJi || '·'}`),
    줄('일간', r => 명(r).ilGan), 줄('격', r => c(r).격), 줄('용법', r => c(r).용법), 줄('상신', r => c(r).상신 ?? '(없음)'), 줄('성패', r => c(r).성패), 줄('최종 성패', r => c(r).최종성패), 줄('순잡', r => c(r).순잡), 줄('고저', r => c(r).고저),
    { 항목: '궁통 필요 글자', A: gA && gA.용 ? gA.용.join('→') : '-', B: gB && gB.용 ? gB.용.join('→') : '-' },
    { 항목: '궁통 주판정', A: gA && gA.주판정 ? `${gA.주판정.id}(${gA.주판정.방향 || '-'})` : '-', B: gB && gB.주판정 ? `${gB.주판정.id}(${gB.주판정.방향 || '-'})` : '-' },
    줄('대운 방향', r => (r.단계11_행운 || {}).방향 || '-'),
  ];
  // 두 명식 사이의 글자 관계 — 간합·충·육합·삼합 묶음 **사실만**. 좋다·나쁘다·맞다 표현 없음
  const a = 명(rA), b = 명(rB), 관계 = [];
  const 간합 = hapchung.GANHAP.find(h => h.gan.includes(a.ilGan) && h.gan.includes(b.ilGan) && a.ilGan !== b.ilGan);
  관계.push(`일간 ${a.ilGan}·${b.ilGan}: ${간합 ? `간합(${간합.gan.join('')}→${간합.hwa})` : '간합 아님'}`);
  const 지들 = [['일지', a.ilJi, b.ilJi], ['월지', a.wolJi, b.wolJi], ['년지', a.yeonJi, b.yeonJi]];
  for (const [이름, x, y] of 지들) {
    if (!x || !y) continue;
    const 충 = hapchung.CHUNG[x] === y, 육 = hapchung.YUKHAP.find(h => h.ji.includes(x) && h.ji.includes(y) && x !== y), 삼 = hapchung.SAMHAP.find(h => h.ji.includes(x) && h.ji.includes(y) && x !== y);
    관계.push(`${이름} ${x}·${y}: ${충 ? '충' : 육 ? `육합(→${육.hwa})` : 삼 ? `삼합 묶음(${삼.ji.join('')}, 왕지 ${삼.wang}${[x, y].includes(삼.wang) ? ' 있음' : ' 없음 — 국 아님'})` : '합·충 없음'}`);
  }
  return { 행, 관계, 안내: '두 명식의 판정과 글자 관계를 나란히 둔 것일 뿐이다. 궁합·어울림·점수는 내지 않는다(자평진전·궁통보감에 궁합 조문이 없다)' };
}

module.exports = { 추적, 시주민감도, 비교표, 조건풀이, 정규 };
