/**
 * mundap_route.js — /문답 라우트 (server.js에서 불러 쓴다)
 *
 * /해설 과 재료·모델은 똑같고 브리프만 다르다. 그리고 브리프는 턴에 따라 갈린다:
 *   첫 물음(이력 0)  → haeseol.toLLMBrief   … 「묻는다」와 똑같은 상담글(분야 모범답안)
 *   이어지는 물음     → mundap.toMundapBrief … 소스 전체를 연 노트북LM식 자유 문답
 *
 * 첫 답이 대화의 바닥이 된다. 처음부터 자유 문답으로 열면 상담글의 밀도를 잃고,
 * 계속 상담글로만 가면 「같은 대답만 한다」가 된다. 그래서 첫 턴만 상담글이다.
 *
 * 몸(요청) = { 명식, 출생연도, 성별, 절기날수, 질문, 이력:[{질문,답}] }
 * 응답     = { 성공:true, 본문 } | { 성공:false, 사유 }   — /해설과 같은 꼴이라 프론트가 그대로 읽는다
 *
 * ┌─ server.js에 이렇게 끼운다 ─────────────────────────────────────────
 * │ const { 문답처리 } = require('./engine/mundap_route');
 * │ …
 * │ if (req.method === 'POST' && url.pathname === '/문답') {
 * │   const 몸 = await 본문읽기(req);                       // /해설에서 쓰는 JSON 파서 그대로
 * │   const 답 = await 문답처리(몸, { 계산, 모델호출 });     // 아래 두 함수만 넘긴다
 * │   return json(res, 200, 답);                            // /해설에서 쓰는 응답 함수 그대로
 * │ }
 * └────────────────────────────────────────────────────────────────────
 *
 *   계산(몸)        : /해설이 몸.명식으로 r을 만드는 바로 그 함수. 대개
 *                     interpret.interpret(몸.명식, { 성별, 출생연도, 절기날수 }) 를 감싼 것
 *   모델호출(브리프): /해설이 Gemini에 브리프를 보내 문자열을 받는 바로 그 함수.
 *                     gemini.js 안의 실제 REST 호출 (해석()이 brief를 스스로 만들면, brief를 받는 안쪽 함수)
 *
 * 이 두 개를 /해설 것과 같은 것으로 넘기면 인증·모델명·재시도·예산 가드가 전부 그대로 적용된다.
 */
const mundap = require('./mundap');
const haeseol = require('./haeseol');

async function 문답처리(몸, { 계산, 모델호출 }) {
  try {
    if (!몸 || !몸.명식 || !몸.질문) return { 성공:false, 사유:'명식과 질문이 필요합니다' };
    const 질문 = String(몸.질문).trim().slice(0, 600);
    const 이력 = Array.isArray(몸.이력) ? 몸.이력.slice(-20) : [];   // 최근 20턴까지만 (이력은 프론트가 들고 있다)

    const r = await 계산(몸);
    if (!r || !r.결론) return { 성공:false, 사유:'판정을 만들지 못했습니다' };

    const 공통 = { 년도: new Date().getFullYear(), 출생연도: 몸.출생연도, 성별: 몸.성별 };

    // 첫 물음은 「묻는다」와 똑같이 — 분야 모범답안이 실린 상담글로 답한다.
    // 그 답이 대화의 바닥이 되고, 두 번째 물음부터 소스 전체를 연 자유 문답으로 간다.
    const 모드 = 이력.length === 0 ? '상담' : '문답';
    const 브리프 = 모드 === '상담'
      ? haeseol.toLLMBrief(r, Object.assign({ 주제: 질문 }, 공통))
      : mundap.toMundapBrief(r, Object.assign({ 질문, 이력 }, 공통));

    const 본문 = await 모델호출(브리프);
    if (!본문 || typeof 본문 !== 'string' || 본문.trim().length < 5)
      return { 성공:false, 사유:'모델이 빈 답을 돌려주었습니다' };
    return { 성공:true, 본문: 본문.trim(), 모드 };
  } catch (e) {
    return { 성공:false, 사유: String(e && e.message || e).slice(0, 200) };
  }
}

module.exports = { 문답처리 };
