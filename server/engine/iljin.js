/**
 * iljin.js — 일진(日辰): 그날의 간지를 이 명식에 대어 본다 (2026-10-09, 사용자 지시 「일진을 보기를 원하는 사람들이 많은데 구현해봐」)
 *
 * 원문에 일진 조문은 없다. 자평진전은 대운을 論行運으로 다루고, 세운은 28편 「此五年中」으로 한 해 단위를 인정할 뿐,
 * 달·날 단위를 다룬 대목이 없다. 그래서 이 모듈은 월운(wolun.js)과 똑같이 25편의 방법 — 「運中每運行一字，即必以此一字，
 * 配命中八字而統觀之」(운의 한 글자를 원국에 대어 본다) — 을 하루에 적용한 **참고**다.
 *   · 희기: chwiun.judgeByRule(격·상신의 취운 조문 희·기) — 월운과 같은 잣대
 *   · 원국과 맞물림: unchung.analyze(운간합·충·회합) — 일지(몸·배우자 자리) 충은 따로 표시
 *   · 밭(궁통보감): gungtong_un.조후운 의 필요·꺼림 — 점수에 섞지 않고 나란히(유파 병렬)
 * 사건을 못 박지 않는다. 날의 경계는 자정(달력 날짜, KST)이다 — 야자시 설은 생시 판정에만 쓴다.
 */
const chwiun = require('./chwiun');
const unchung = require('./unchung');
const { sipseong, jeonggi } = require('./jijanggan');

const 천간 = '甲乙丙丁戊己庚辛壬癸', 지지 = '子丑寅卯辰巳午未申酉戌亥';
const 첫말 = { '결이 크게 살아남': '크게 열리는 날', '결이 살아남': '열리는 날', '뒤섞임': '좋고 궂음이 섞인 날', '결이 눌림': '지키는 날', '결이 크게 눌림': '크게 조심할 날', '판단 보류': '판단 보류' };
const 판정어 = s => s >= 2 ? '결이 크게 살아남' : s >= 1 ? '결이 살아남' : s <= -2 ? '결이 크게 눌림' : s <= -1 ? '결이 눌림' : '뒤섞임';
const 요일 = '일월화수목금토';
const 그림 = { 甲: '큰 나무', 乙: '풀과 덩굴', 丙: '해', 丁: '등불', 戊: '큰 산', 己: '기름진 밭', 庚: '쇠', 辛: '보석', 壬: '강물', 癸: '단비' };
const 십성일 = {
  비견: '나와 같은 편 — 동료·경쟁', 겁재: '내 몫을 나누는 쪽 — 경쟁·지출',
  식신: '만들어 내놓는 일', 상관: '말과 재주가 앞서는 일',
  정재: '차곡차곡 드는 돈·살림', 편재: '크게 움직이는 돈·바깥일',
  정관: '자리와 규칙·약속', 편관: '책임과 압박',
  정인: '배움·문서·돕는 사람', 편인: '혼자 깊이 보는 공부·생각',
};
const 자리말 = { 년: '태어난 해', 월: '태어난 달', 일: '태어난 날', 시: '태어난 시각' };

/** 그레고리력 날짜의 율리우스 날 번호 */
function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), Y = y + 4800 - a, M = m + 12 * a - 3;
  return d + Math.floor((153 * M + 2) / 5) + 365 * Y + Math.floor(Y / 4) - Math.floor(Y / 100) + Math.floor(Y / 400) - 32045;
}
/** 그날의 간지 — manse.js 일주와 같은 셈(JD 정오 + 49) */
function 일간지(y, m, d) {
  const i = ((jdn(y, m, d) + 49) % 60 + 60) % 60;
  return { 간지: 천간[i % 10] + 지지[i % 12], 천간: 천간[i % 10], 지지: 지지[i % 12] };
}
/** KST 오늘 {y,m,d} */
function 오늘KST(now = Date.now()) { const t = new Date(now + 9 * 3600e3); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }
function 더하기(ymd, n) { const t = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }

/** 사건 하나를 일상어로 — 자리(년·월·일·시 × 위·아래)와 합/충만 */
function 사건말(e) {
  const k = String(e.대상 || '').match(/(년|월|일|시)(간|지)/);
  const 곳 = k ? `${자리말[k[1]]}의 ${k[2] === '간' ? '위' : '아래'} 글자` : '원국 글자';
  const 충 = /충/.test(e.종류 || '') || /충한다/.test(e.설명 || '');
  const 몸 = k && k[1] === '일' && k[2] === '지';
  if (충) return `${곳}와 부딪힘${몸 ? ' — 몸·생활 리듬이 흔들리기 쉬움' : ''}${/힘을 잃는다/.test(e.설명 || '') ? '(힘은 약함)' : ''}`;
  if (/합|회/.test(e.종류 || '')) return k ? `${곳}와 묶임` : '원국의 아래 글자들과 모여 다른 기운이 됨';
  return `${곳}와 맞물림`;
}

/**
 * @param {object} r interpret 결과
 * @param {object} [opt] { 시작:{y,m,d}, 날수:7, 지금:ms }
 */
function analyze(r, opt = {}) {
  const m = r.명식, ctx = r.ctx;
  const rule = chwiun.lookup(ctx.gyeok, r.결론 && r.결론.상신, ctx);
  let GU = null; try { GU = require('./gungtong_un'); } catch (e) {}
  const 시작 = opt.시작 || 오늘KST(opt.지금);
  const 날수 = Math.max(1, Math.min(opt.날수 || 7, 62));
  const 날 = [];
  for (let i = 0; i < 날수; i++) {
    const ymd = 더하기(시작, i), g = 일간지(ymd.y, ymd.m, ymd.d);
    const un = { 간지: g.간지, 천간: g.천간, 지지: g.지지, 천간십성: sipseong(m.ilGan, g.천간), 지지십성: sipseong(m.ilGan, jeonggi(g.지지)) };
    let 길흉 = rule ? chwiun.judgeByRule(un, rule, ctx) : { 판정: '판단 보류', 점수: null, 비고: ['격의 희기가 정해지지 않았다'] };
    let uc = { 사건: [], 가감: 0 };
    try { uc = unchung.analyze(un, ctx, m, 길흉.판정); } catch (e) {}
    if (rule && uc.가감) { const s = Math.max(-2, Math.min(2, (길흉.점수 ?? 0) + uc.가감)); 길흉 = { ...길흉, 점수: s, 판정: 판정어(s) }; }
    let 밭 = null;
    if (GU) try {
      const z = GU.조후운(m.ilGan, m.wolJi, { 천간: g.천간, 지지: g.지지 });
      if (z && !z.해당없음) {
        // 지지는 그 속 정기(본기)로 판정된다 — 「아래 글자 辰 속의 큰 산(戊)」처럼 그림 이름으로
        const 이름 = (t, 위) => 위 ? `${그림[t.글자] || t.글자}(${t.글자})` : `${그림[t.정기 || jeonggi(t.글자)] || t.글자}(${t.글자} 속 ${t.정기 || jeonggi(t.글자)})`;
        const 고르기 = 식 => [[z.천간, true], [z.지지, false]].filter(([t]) => t && 식.test(t.판정 || ''));
        const 필요 = 고르기(/필요/), 꺼림 = 고르기(/꺼림/);
        밭 = { 필요: 필요.map(([t]) => t.글자), 꺼림: 꺼림.map(([t]) => t.글자),
          말: 필요.length ? `이 달의 밭에 필요한 ${필요.map(([t, 위]) => 이름(t, 위)).join('·')}이 오는 날` : 꺼림.length ? `이 달의 밭이 꺼리는 ${꺼림.map(([t, 위]) => 이름(t, 위)).join('·')}이 오는 날` : null };
      }
    } catch (e) {}
    const 사건들 = (uc.사건 || []).map(사건말);
    const 일지충 = (uc.사건 || []).some(e => /충/.test(e.종류 || e.설명 || '') && /\(일지\)|일지/.test(e.대상 || ''));
    날.push({
      날짜: `${ymd.y}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`, 요일: 요일[new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay()],
      간지: g.간지, 천간: g.천간, 지지: g.지지, 천간십성: un.천간십성, 지지십성: un.지지십성,
      판정: 길흉.판정, 점수: 길흉.점수 ?? null, 첫말: 첫말[길흉.판정] || 길흉.판정,
      결: `${그림[g.천간]}(${g.천간})의 날 — ${십성일[un.천간십성] || un.천간십성}`,
      사건: 사건들, 일지충, 밭,
    });
  }
  return {
    날,
    기준: rule ? `${ctx.gyeok}격 用${r.결론.상신 ?? '미정'}의 반기는 글자·꺼리는 글자` : '격의 희기가 정해지지 않아 판정 보류',
    한계: [
      '자평진전·궁통보감·적천수 어디에도 일진(하루 운)을 다룬 대목은 없다. 이 판정은 25편의 방법(운의 한 글자를 원국에 대어 본다)을 하루에 적용한 참고다',
      '하루는 해(세운)·달(월운)·열 해(대운) 안에서 가장 작은 단위다 — 큰 흐름을 뒤집는 것으로 읽지 않는다',
      '날의 경계는 자정(달력 날짜)이다',
      '무슨 일이 생긴다고 못 박지 않는다 — 그날 무엇에 마음을 두면 좋은지의 결만 말한다',
    ],
  };
}

/** 브리프에 넣을 한 줄 — 오늘부터 7일 */
function 브리프줄(r, opt = {}) {
  try {
    const a = analyze(r, { 날수: 7, ...opt });
    return `[일진 — 오늘부터 7일, 월운과 같은 방법(25편)을 하루에 적용한 참고. 「오늘·내일·이번 주·○일」을 물으면 이 첫말을 그대로 쓰고, 원문에 일진 조문이 없다는 것을 한 문장으로 밝힐 것] ` +
      a.날.map(d => `${d.날짜.slice(5).replace('-', '/')}(${d.요일}) ${d.간지} ${d.첫말}${d.일지충 ? '·몸 자리 흔들림' : ''}`).join(' · ');
  } catch (e) { return ''; }
}

module.exports = { 일간지, 오늘KST, analyze, 브리프줄, 첫말 };
