/**
 * mundap_route.js — /문답 라우트
 *
 * server.js는 판정을 하지 않고 engine/gemini.js의 해석() 하나에 맡긴다.
 * 해석()은 안에서 interpret → haeseol.toLLMBrief → Gemini 호출을 다 한다.
 * 문답은 그 가운데 **브리프만** 바꾸면 되는데, 그 자리가 해석() 안이다.
 *
 * 그래서 gemini.js를 건드리지 않고 되도록:
 *   ① 여기서 직접 interpret을 돌려 r을 만들고
 *   ② 턴에 따라 브리프를 고르고 (첫 물음=상담글 / 이어지는 물음=자유 문답)
 *   ③ 만들어 둔 브리프를 그대로 모델에 보낼 창구를 찾는다
 *
 * ③이 문제다. gemini.js가 「완성된 브리프를 받아 보내는」 함수를 내보내면 그것을 쓰고,
 * 없으면 마지막 수단으로 이 파일이 직접 REST를 부른다(인증 3방식은 gemini.js와 같은 순서).
 *
 * ┌─ server.js에 이렇게 끼운다 ────────────────────────────────
 * │ const { 문답처리 } = require('./engine/mundap_route');
 * │ // 길 검사에 '/문답'을 넣고, 본문을 읽은 뒤:
 * │ if (길 === '/문답') {
 * │   const 답 = await 문답처리(입력, { apiKey: API_KEY, model: MODEL,
 * │                                    온도: Number(process.env.TEMPERATURE || 0.7) });
 * │   return 보냄(res, 200, 답, origin);
 * │ }
 * └───────────────────────────────────────────────────────────
 */
const mundap   = require('./mundap');
const haeseol  = require('./haeseol');
const gemini   = require('./gemini');
const oegyeok  = require('./oegyeok');    // 22편 — 외격을 빌려도 되는 자리인지
const japgyeok = require('./japgyeok');   // 47편 — 어느 잡격인지 이름을 대고 취운을 준다
let interpret = null;
try { interpret = require('./interpret'); } catch (e) {}

/**
 * interpret 결과에 22편·47편 외격 층을 얹는다.
 * 번들된 interpret.js는 단계22까지만 내므로 여기서 단계47을 덧붙인다.
 * (interpret.js 안에 직접 넣으면 이 함수는 없어도 된다)
 */
function 외격층(r, m) {
  try {
    // 22편 — 양인을 월령무용에 포함하도록 고친 판을 쓴다
    r.단계22_외격 = oegyeok.analyze({ ctx: r.ctx, 결론: r.결론.성패 }, m);
    r.단계47_잡격 = japgyeok.analyze(r.단계22_외격, m);
  } catch (e) {}
  return r;
}

// ── 브리프를 그대로 모델에 보낼 창구 찾기 ──────────────────
// gemini.js가 무엇을 내보내는지 모르므로, 있을 법한 이름을 순서대로 본다.
// (이 가운데 하나만 있으면 gemini.js는 손대지 않아도 된다)
const 후보이름 = ['보내기', '호출', '모델호출', '생성', 'callModel', 'generate', 'raw', '브리프로'];
function 모델창구() {
  for (const n of 후보이름) if (typeof gemini[n] === 'function') return gemini[n];
  return null;
}

// 마지막 수단 — 직접 REST. gemini.js와 같은 인증 3방식 순서로 시도한다.
let 성공방식 = null;
async function 직접호출(브리프, { apiKey, model, 온도 }) {
  if (!apiKey) throw new Error('API 키가 없습니다');
  const 주소 = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const 몸 = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 브리프 }] }],
    generationConfig: { temperature: 온도 ?? 0.7, maxOutputTokens: 8192 },
  });
  const 방식들 = [
    { 이름: 'header', url: 주소, 머리: { 'x-goog-api-key': apiKey } },
    { 이름: 'bearer', url: 주소, 머리: { Authorization: `Bearer ${apiKey}` } },
    { 이름: 'query',  url: `${주소}?key=${encodeURIComponent(apiKey)}`, 머리: {} },
  ];
  const 순서 = 성공방식
    ? [방식들.find(v => v.이름 === 성공방식), ...방식들.filter(v => v.이름 !== 성공방식)]
    : 방식들;
  const 사유 = [];
  for (const v of 순서) {
    try {
      const res = await fetch(v.url, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, v.머리), body: 몸 });
      if (!res.ok) { 사유.push(`${v.이름}:${res.status}`); continue; }
      const d = await res.json();
      const t = (d && d.candidates && d.candidates[0] && d.candidates[0].content
                 && d.candidates[0].content.parts || []).map(p => p.text || '').join('');
      if (t.trim()) { 성공방식 = v.이름; return t.trim(); }
      사유.push(`${v.이름}:빈응답`);
    } catch (e) { 사유.push(`${v.이름}:${String(e.message || e).slice(0, 40)}`); }
  }
  throw new Error('모델 호출 실패 — ' + 사유.join(', '));
}

/**
 * @param {object} 입력  { 명식, 출생연도, 성별, 절기날수, 질문, 이력:[{질문,답}] }
 * @param {object} 설정  { apiKey, model, 온도 }
 * @returns {{성공:boolean, 본문?:string, 사유?:string, 모드?:string}}
 */
async function 문답처리(입력, 설정 = {}) {
  try {
    if (!입력 || !입력.명식) return { 성공: false, 사유: '명식이 없습니다' };
    const 질문 = String(입력.질문 || '').trim().slice(0, 600);
    if (!질문) return { 성공: false, 사유: '질문이 없습니다' };
    const 이력 = Array.isArray(입력.이력) ? 입력.이력.slice(-20) : [];

    // ① 판정 — 앱이 보낸 여덟 글자로 서버에서 다시 낸다(해석()이 하던 것과 같은 호출)
    if (!interpret || typeof interpret.interpret !== 'function')
      return { 성공: false, 사유: 'interpret 모듈을 찾지 못했습니다' };
    let r = interpret.interpret(입력.명식, {
      출생연도: 입력.출생연도,
      gender: 입력.성별 === '여' ? '여' : '남',
      daysToJeolgi: 입력.절기날수,
      세운개수: 입력.세운개수 ?? 3,
    });
    if (!r || !r.결론) return { 성공: false, 사유: '판정을 만들지 못했습니다' };
    r = 외격층(r, 입력.명식);   // 22편·47편

    // ② 모드 결정
    //   첫 물음은 「묻는다」와 똑같이 상담글로, 두 번째부터 자유 문답 — 이것이 기본이다.
    //   다만 **질문 자체가 설명을 달라는 것**이면 첫 물음이라도 문답으로 간다.
    //   조문 리포트를 읽다가 「반기는 것은 실물… 이게 무슨 말이야」라고 물었는데
    //   명식을 처음부터 펼치는 900자 상담글이 나오면 답이 아니다. (2026-09-03 실측)
    //   설명 요청의 신호: 무슨 말·무슨 뜻·뭐야·이해가 안·쉽게·풀어서·왜 그런·근거·조문·원문
    const 공통 = { 년도: new Date().getFullYear(), 출생연도: 입력.출생연도, 성별: 입력.성별 };
    const 설명신호 = /무슨\s*(말|뜻|의미)|뭐(야|예요|죠|냐|니)|뭔\s*(뜻|말|소리)|이해가?\s*(안|잘)|모르겠|쉽게|풀어|왜\s*그(런|렇)|근거|조문|원문|출처|어디서\s*나(온|와)|설명해|알려\s*줘|이란|란\s*무엇|이게\s*뭐|그게\s*뭐|무엇인가|어떤\s*뜻/;
    const 설명요청 = 설명신호.test(질문);
    const 모드 = (이력.length === 0 && !설명요청) ? '상담' : '문답';
    const 브리프 = 모드 === '상담'
      ? haeseol.toLLMBrief(r, Object.assign({ 주제: 질문 }, 공통))
      : mundap.toMundapBrief(r, Object.assign({ 질문, 이력 }, 공통));

    // ③ 모델에 보낸다 — gemini.js의 창구가 있으면 그것을, 없으면 직접
    const 창구 = 모델창구();
    let 본문;
    if (창구) {
      본문 = await 창구(브리프, { apiKey: 설정.apiKey, model: 설정.model, 온도: 설정.온도 });
      if (본문 && typeof 본문 === 'object') 본문 = 본문.본문 || 본문.text || '';
    } else {
      본문 = await 직접호출(브리프, 설정);
    }
    if (!본문 || typeof 본문 !== 'string' || 본문.trim().length < 5)
      return { 성공: false, 사유: '모델이 빈 답을 돌려주었습니다' };

    return { 성공: true, 본문: 본문.trim(), 모드, 설명요청, 출처: 'gemini' };
  } catch (e) {
    return { 성공: false, 사유: String((e && e.message) || e).slice(0, 200) };
  }
}

module.exports = { 문답처리 };
