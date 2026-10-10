/**
 * gemini.js — Gemini API 브리지
 * 사주팔자집 (2026-08-02)
 *
 * 판정은 엔진이 하고, Gemini는 그것을 사람이 읽을 문장으로 다듬기만 한다.
 *
 * ── 왜 출력을 검사하는가 ────────────────────────
 * 지금까지 만든 가드(신살·흉단·등급어)는 **엔진이 만든 리포트만** 검사했다.
 * LLM이 쓴 문장은 아무도 보지 않는다.
 *
 * 그런데 LLM은 학습 데이터에 신살 사주 텍스트가 압도적으로 많아서,
 * 프롬프트로 금지해도 「도화가 있어 인기가 많고」 같은 문장을 만들어낸다.
 * 21편이 「星辰無關格局」이라 못박은 것을 앱이 도로 들여놓는 셈이다.
 * 그래서 **프롬프트는 부탁이고, 검사가 보장**이다.
 *
 * 30편이 경계한 「以俗書無知妄作，誤依其說而深入迷途」가 여기에도 걸린다 —
 * 다른 책 규칙이 원문 대조를 거치지 않고 LLM을 통해 들어오는 길이기 때문이다.
 */

const { interpret } = require('./interpret');
const { render, toLLMBrief } = require('./haeseol');
const sinsal = require('./sinsal');
const yongeo = require('./yongeo');

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/**
 * 재료에 없는 것을 지어냈는지.
 *
 * 처음엔 판정에 없는 십성이 나오면 무조건 막았는데, 그러면 쓸 어휘가 너무 좁아져
 * 매번 같은 문장이 나온다. 원문 자체가 「格局比他格多，變化尤多」라 하고
 * 「其餘變化，不能盡述，類而推之可也」라며 미루어 넓히기를 권한다.
 *
 * 그래서 허용 범위를 원국 전체(지지 지장간 포함)와 운으로 넓히고,
 * **정말로 이 명식에 없는 것**만 막는다. 없는 것을 있다고 말하는 것은
 * 상상이 아니라 다른 사람의 사주를 말하는 것이기 때문이다.
 */
const 십성전체 = ['비견','겁재','식신','상관','정재','편재','정관','편관','정인','편인','칠살','양인'];

function 지어내기검사(text, r) {
  const c = r.결론;
  const { sipseong, JIJANGGAN } = require('./jijanggan');
  const m = r.명식 ?? r.ctx;
  const 허용 = new Set([
    c.격, c.상신,
    // 천간에 드러난 것
    ...십성전체.filter(x => (r.ctx?.cheongan?.[x]?.length ?? 0) > 0),
    // 지지 지장간까지 — 원국 안에 있는 것이면 말할 수 있다
    ...['yeonJi','wolJi','ilJi','siJi'].flatMap(k => {
      const j = m?.[k]; if (!j || !JIJANGGAN[j]) return [];
      return JIJANGGAN[j].map(x => sipseong(m.ilGan, x.gan));
    }),
    // 운에서 오는 것
    ...(r.단계11_행운?.대운 ?? []).flatMap(u => [u.천간십성, u.지지십성]),
    ...(r.단계11b_세운 ?? []).flatMap(u => [u.천간십성, u.지지십성]),
    ...(r.단계23_육친?.용신배속 ?? []).map(x => x.십성),
  ].filter(Boolean));
  // 칠살은 편관의 다른 이름
  if (허용.has('편관')) 허용.add('칠살');
  const 등장 = 십성전체.filter(x => text.includes(x));
  const 밖 = 등장.filter(x => !허용.has(x));

  // 지장간까지 넓히면 십성은 대개 다 허용된다. 실제로 위험한 것은 따로 있다 —
  // **격을 다르게 말하는 것**이다. 정관격 판정에 「식신격입니다」라고 쓰면
  // 해석이 통째로 다른 사주가 된다. 이쪽을 잡는다.
  const 격이름 = ['정관격','편관격','칠살격','정재격','편재격','재격','정인격','편인격',
                 '인수격','식신격','상관격','양인격','건록격','월겁격'];
  const 내격 = new Set([`${c.격}격`]);
  if (['정재','편재'].includes(c.격)) 내격.add('재격');
  if (['정인','편인'].includes(c.격)) 내격.add('인수격');
  if (c.격 === '편관') 내격.add('칠살격');
  if (c.격 === '건록') 내격.add('월겁격');
  const 격오기 = 격이름.filter(g => text.includes(g) && !내격.has(g));

  const 검출 = [...밖, ...격오기];
  return {
    통과: 검출.length === 0, 검출, 십성밖: 밖, 격오기,
    사유: 검출.length
      ? [밖.length ? `원국에 없는 십성: ${밖.join(', ')}` : null,
         격오기.length ? `격을 다르게 말함(판정은 ${c.격}격): ${격오기.join(', ')}` : null]
        .filter(Boolean).join(' / ')
      : '재료 밖 용어 없음',
  };
}

/**
 * LLM이 쓴 문장을 검사한다. 엔진 리포트에 쓰던 가드를 그대로 적용한다.
 * @returns {{통과:boolean, 문제:Array}}
 */
/**
 * @param {object} opt { 한자검사, 반복검사 } — 브리프(LLM 입력)를 검사할 때는 둘 다 끈다.
 *   브리프에는 원문 한문이 근거로 들어가야 하고, 지시문이라 같은 말이 되풀이된다.
 *   막아야 할 것은 **LLM의 출력**이지 그것에 주는 지시가 아니다.
 */
function validate(text, r, opt = {}) {
  const 문제 = [];
  const a = sinsal.lint(text);
  if (!a.통과) 문제.push({ 종류: '신살·여명 속설', 검출: a.검출, 근거: '21편 論星辰無關格局' });
  const b = sinsal.lintHyungdan(text);
  if (!b.통과) 문제.push({ 종류: '배우자·자녀·수명 흉단', 검출: b.검출, 근거: '24편에서 배제하기로 한 범주' });
  const p2 = sinsal.lintPumhaeng(text);
  if (!p2.통과) 문제.push({ 종류: '십성 개수로 품행 재기', 검출: p2.검출,
                          근거: '21편 「貴人乃是天星，並非夫主」 — 원문이 직접 논파' });
  const c = sinsal.lintDeunggeup(text);
  if (!c.통과) 문제.push({ 종류: '사람에게 매기는 등급', 검출: c.검출, 근거: '12편 或一字而有千鈞之力' });
  const h = opt.한자검사 === false ? { 통과: true } : yongeo.lintHanja(text);
  if (!h.통과) 문제.push({ 종류: '한자·원문 인용', 검출: h.덩어리.length ? h.덩어리 : [`한자 ${h.한자수}자`],
                          근거: '읽는 사람이 처음 보는 분야다' });
  if (r) {
    const d = 지어내기검사(text, r);
    if (!d.통과) 문제.push({ 종류: '재료에 없는 것', 검출: d.검출, 근거: '판정에 없는 십성' });
  }
  if (opt.반복검사 !== false) {
    const e = 반복검사(text);
    if (!e.통과) 문제.push({ 종류: '같은 말 되풀이', 검출: e.검출,
                            근거: '읽는 사람이 「또 그 소리」로 느낀다' });
  }
  return { 통과: 문제.length === 0, 문제 };
}

/**
 * 같은 말을 되풀이했는가.
 *   LLM은 재료가 많으면 요약 대신 나열한다. 그러면 절마다 같은 판정이 다시 나와
 *   읽는 사람은 「또 그 소리」로 느낀다. 이것이 이 종류의 글에서 가장 흔한 실패다.
 *   ① 방법 자체를 설명하는 문장 — 누구에게나 같아서 이 사람 이야기가 아니다
 *   ② 같은 문장이 두 번 나온 것
 */
const 원리투 = [
  /상신(이란|은)\s*(격|중심)/, /격(이란|은)\s*(태어난|월령)/,
  /십성(이란|은)/, /대운(이란|은)\s*(십|10)\s*년/, /세운(이란|은)\s*(한|1)\s*해/,
  /자평진전(에서는|은|이라는)/, /원문(에서는|은)\s*이를/,
  /(월령|태어난 달)에서\s*(격|용신)을\s*(구|잡)/,
];
function 반복검사(text) {
  const 검출 = [];
  const 문장 = text.split(/(?<=[.!?。])\s+/).map(x => x.trim()).filter(x => x.length > 8);
  for (const 문 of 문장)
    for (const p of 원리투)
      if (p.test(문)) { 검출.push(문.slice(0, 34)); break; }
  // 같은 문장이 두 번
  const 셈 = {};
  for (const 문 of 문장) {
    const k = 문.replace(/[\s,.·—「」]/g, '');
    if (k.length < 14) continue;
    셈[k] = (셈[k] ?? 0) + 1;
    if (셈[k] === 2) 검출.push(문.slice(0, 34));
  }
  return { 통과: 검출.length === 0, 검출: [...new Set(검출)].slice(0, 5) };
}

/** 검사에 걸린 문장만 덜어낸다. 통째로 버리는 것보다 낫다 */
function 문제문장제거(text, 문제) {
  const 말 = 문제.flatMap(x => x.검출);
  // 줄 단위로 본다 — 문단·▶ 머리말 줄이 보존된다 (2026-10-02 join(' ') 뭉개짐 수정 → 2026-10-07 줄 단위로:
  //   「▶ 한 줄로 말하면\n도화가 …」처럼 머리말 줄 뒤에 마침표 없이 이어지면 머리말까지 같이 잘려 나갔다)
  const 줄들 = String(text).split('\n').map(줄 => {
    if (/^\s*▶/.test(줄) || !말.some(w => 줄.includes(w))) return 줄;
    const 남김 = 줄.split(/(?<=[.!?。])\s+/).filter(문장 => !말.some(w => 문장.includes(w)));
    return 남김.join(' ').trim();
  });
  // 비게 된 줄은 지운다(원래 빈 줄은 둔다)
  const 원래줄 = String(text).split('\n');
  return 줄들.filter((l, i) => l.trim() || !원래줄[i].trim()).join('\n').trim();
}

/** 재요청 프롬프트 — 무엇이 걸렸는지 알려준다 */
function 재요청프롬프트(원프롬프트, 문제) {
  return [
    원프롬프트, '',
    '앞선 답에 다음이 섞여 있어 다시 요청합니다. 이번에는 반드시 빼 주세요:',
    ...문제.map(p => `- ${p.종류}: ${p.검출.join(', ')} (${p.근거})`),
  ].join('\n');
}

/**
 * @param {object} m 명식
 * @param {object} opt { apiKey, model, 온도, 재시도, interpretOpt, fetchImpl }
 */
// ── Gemini 호출 단위 상한 (2026-10-07, PROMPTS 8 운영) ─────────────────────────
//   하루(KST) 호출 수가 GEMINI_DAILY_CAP(기본 500, 0 이면 없음)에 닿으면 모델을 부르지 않고 실패로 돌려 폴백(조문 리포트)이 나간다.
//   해석()·보내기() 두 창구가 다 센다(문답·섹션 다시 쓰기도 보내기를 쓴다). 메모리라 재시작하면 0 — 상한은 요금 방어선이지 정확한 계량이 아니다.
const 일일 = { 날짜: null, 호출: 0, 막힘: 0 };
const KST날짜 = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
function 일일상한() { const v = Number(process.env.GEMINI_DAILY_CAP ?? 500); return Number.isFinite(v) && v > 0 ? v : 0; }
function 호출허용() {
  const d = KST날짜(); if (일일.날짜 !== d) { 일일.날짜 = d; 일일.호출 = 0; 일일.막힘 = 0; }
  const 상한 = 일일상한();
  if (상한 && 일일.호출 >= 상한) { 일일.막힘++; return false; }
  일일.호출++; return true;
}
function 일일호출통계() { const d = KST날짜(); if (일일.날짜 !== d) { 일일.날짜 = d; 일일.호출 = 0; 일일.막힘 = 0; } return { 날짜: 일일.날짜, 호출: 일일.호출, 막힘: 일일.막힘, 상한: 일일상한() || null }; }

async function 해석(m, opt = {}) {
  const {
    apiKey = process.env.GEMINI_API_KEY,
    model = 'gemini-2.5-flash',
    온도 = 0.7,
    재시도 = 1,
    interpretOpt = {},
    fetchImpl = globalThis.fetch,
  } = opt;

  const r = interpret(m, interpretOpt);
  // 브리프에는 **interpretOpt**를 넘겨야 한다. 바깥 opt에는 apiKey·model만 있고
  // 주제·성별·출생연도는 interpretOpt 안에 있다. 여기를 opt로 두면 주제가 통째로 새고,
  // 「금년 직장운」을 물어도 브리프에 그 말이 안 실려 엉뚱한 글이 나온다.
  const 프롬프트 = toLLMBrief(r, interpretOpt);
  // 2026-10-10(31차, 사용자 「언제 결혼 가능할까라고 물으면 그에 맞는 답을 해야지」): Gemini 가 답하지 못하면(호출 실패·상한·HTTP 402 등)
  //   물음과 상관없는 조문 리포트 전체 대신, 코드가 물음에 맞춰 쓴 짧은 답(mureum.엔진답 — 엔진 세운 판정·그 일의 글자가 오는 해)을 낸다.
  //   궁통보감 관법이거나 물음이 없으면 예전대로 조문 리포트.
  const 폴백 = (사유, 덧) => {
    let 본 = null;
    try { if (interpretOpt.주제 && interpretOpt.관법 !== '궁통보감') 본 = require('./mureum').엔진답(r, interpretOpt.주제, { 성별: interpretOpt.gender, 출생연도: interpretOpt.출생연도 }); } catch (e) {}
    return 본 ? { 성공: false, 사유, 판정: r, 본문: 본, 출처: '엔진 답', ...덧 } : { 성공: false, 사유, 판정: r, 본문: render(r, interpretOpt), 출처: '조문 리포트(폴백)', ...덧 };
  };

  if (!apiKey) {
    return 폴백('API 키 없음');
  }

  let 현재프롬프트 = 프롬프트, 마지막 = null;
  for (let 회 = 0; 회 <= 재시도; 회++) {
    let text;
    try {
      if (!호출허용()) throw new Error(`오늘 Gemini 호출 상한(${일일상한()}회)에 닿았습니다 — 조문 리포트로 대신합니다`);
      const res = await fetchImpl(`${ENDPOINT(model)}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 현재프롬프트 }] }],
          generationConfig: { temperature: 온도 },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      text = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '';
    } catch (e) {
      return 폴백(`호출 실패: ${e.message}${/HTTP 402/.test(e.message) ? ' (Gemini 결제·크레딧 확인 필요)' : ''}`);
    }

    const v = validate(text, r);
    마지막 = { text, v };
    if (v.통과) return { 성공: true, 판정: r, 본문: text, 출처: 'Gemini', 시도: 회 + 1 };
    현재프롬프트 = 재요청프롬프트(프롬프트, v.문제);
  }

  // 재시도해도 걸리면 문제 문장만 덜어낸다. 그래도 너무 짧아지면 엔진 리포트로 간다.
  const 정리 = 문제문장제거(마지막.text, 마지막.v.문제);
  if (정리.length >= 200)
    return { 성공: true, 판정: r, 본문: 정리, 출처: 'Gemini(일부 문장 제거)',
             제거사유: 마지막.v.문제 };
  return 폴백('검사를 통과하지 못함', { 문제: 마지막.v.문제 });
}

/**
 * 완성된 브리프를 그대로 모델에 보낸다 (2026-10-07). mundap_route의 모델창구()가 이 이름을 찾는다.
 * @returns {Promise<string>} 본문(빈 문자열이면 실패)
 */
async function 보내기(브리프, opt = {}) {
  const { apiKey = process.env.GEMINI_API_KEY, model = 'gemini-2.5-flash', 온도 = 0.7, fetchImpl = globalThis.fetch } = opt;
  if (!apiKey) throw new Error('API 키가 없습니다');
  if (!호출허용()) throw new Error(`오늘 Gemini 호출 상한(${일일상한()}회)에 닿았습니다`);
  const res = await fetchImpl(`${ENDPOINT(model)}?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 브리프 }] }], generationConfig: { temperature: 온도 } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return (j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '').trim();
}

// ── 기업 채용 일정 검색 (2026-10-10, 49차) ─────────────────────
//   운영자 「어떤 기업을 언급하면 언제 시험과 면접·합격자 발표가 있는지 인터넷에서 검색해서 답변해」.
//   Gemini 의 Google 검색 도구(grounding)로 공개 공고의 날짜만 JSON 으로 받는다 — 판정은 엔진(chaeyong.일정줄).
//   하루 호출 상한에 함께 센다. 같은 기업은 12시간 메모리 캐시(명식·물음은 키에 넣지 않는다 — 기업 이름만).
const 채용캐시 = new Map();
async function 채용일정검색(기업, opt = {}) {
  const { apiKey = process.env.GEMINI_API_KEY, model = 'gemini-2.5-flash', fetchImpl = globalThis.fetch } = opt;
  const C = require('./chaeyong');
  if (!기업 || !apiKey) return null;
  const 올해 = new Date(Date.now() + 9 * 3600e3).getUTCFullYear();
  const 키 = `${기업}|${올해}`, 있 = 채용캐시.get(키);
  if (있 && Date.now() - 있.t < 12 * 3600e3) return 있.v;
  if (!호출허용()) return null;
  try {
    const res = await fetchImpl(`${ENDPOINT(model)}?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: C.검색프롬프트(기업, 올해) }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0 } }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const 글 = (j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '');
    const v = C.정리(글, 기업);
    // 출처는 모델이 적은 것보다 검색 도구가 돌려준 것을 먼저
    // 검색 도구의 출처는 중계 주소(vertexaisearch…)라 읽을 수 없다 — 모델이 적은 실제 주소를 앞에, 없으면 사이트 이름(web.title)을
    const 근거 = (j?.candidates?.[0]?.groundingMetadata?.groundingChunks || []).map(c => c?.web?.title).filter(Boolean);
    if (v) { const 실 = v.출처.filter(u => !/vertexaisearch|grounding-api-redirect/.test(u)); v.출처 = [...new Set([...실, ...근거])].slice(0, 4); }
    if (채용캐시.size > 200) 채용캐시.clear();
    채용캐시.set(키, { t: Date.now(), v });
    return v;
  } catch (e) { return null; }
}

// ── 섹션별 다시 쓰기 (2026-10-07, C16) ─────────────────────────
//   답이 검사에 걸리면 전에는 브리프 전체(5만 자)에 지적을 붙여 처음부터 다시 쓰게 했다.
//   이제는 짧은 요청 — 원래 답 + 오류 목록 + 쉬운 말 규칙(swiunmal에서 가져옴) + 허용 간지·연도(dapgeomsa.허용목록) —
//   으로 걸린 절(▶ 단락)만 고치게 한다. 그 요청이 예외·빈 답으로 실패할 때만 옛 방식으로 돌아간다.

/** 모드에 맞는 쉬운 말 규칙 줄 — swiunmal의 것을 그대로 쓴다(복사하지 않는다) */
function 규칙줄고르기(모드, opt = {}) {
  const SW = require('./swiunmal');
  if (모드 === '궁통') return SW.궁통규칙줄();
  if (모드 === '설명') return SW.설명규칙줄();
  if (모드 === '문답') return SW.문답규칙줄();
  return SW.상담규칙줄({ 주제: opt.주제 });
}

/**
 * @param {string} 원답   검사에 걸린 답(자동 교정·보강 전 원문이 좋지만 다듬은 본문이어도 된다)
 * @param {Array}  오류   dapgeomsa.검사().오류  [{규칙, 내용}]
 * @param {object} opt    { 브리프, 모드, 주제, 규칙줄 } — 규칙줄을 주면 그것을, 없으면 모드로 고른다
 */
function 지나온재료(브리프) {
  const 줄 = String(브리프 || '').split('\n'); const i = 줄.findIndex(l => l.startsWith('[해마다 표 뼈대 — 지나온 해')); if (i < 0) return [];
  const L = ['', '─── 지나온 해 재료(엔진 셈 — 이것만 옮길 것) ───', 줄[i]];
  for (let k = i + 1; k < 줄.length && /^\|/.test(줄[k]); k++) L.push(줄[k]);
  L.push(...줄.filter(l => l.startsWith('[지나온 해 — 무엇을') || l.startsWith('[이 물음의 답 차례')));
  return L;
}
function 섹션다시쓰기프롬프트(원답, 오류, opt = {}) {
  const D = require('./dapgeomsa');
  const 허용 = D.허용목록(opt.브리프 || '');
  const 간지 = [...허용.간지].sort();
  const 연도 = [...허용.연도].map(Number).sort((a, b) => a - b);
  const 규칙 = opt.규칙줄 || 규칙줄고르기(opt.모드, opt);
  return [
    '═══ **[답 고쳐 쓰기 — 걸린 절만]** ═══',
    '아래 「원래 답」은 서버 검사에서 다음에 걸렸습니다.',
    ...(오류 || []).map(x => `- (${x.규칙}) ${x.내용}`),
    '',
    '**할 일:** 걸린 부분이 든 절(「▶ …」 머리말 아래 한 단락)만 고치고, 걸리지 않은 절은 글자 하나 바꾸지 말고 그대로 옮겨, **답 전체를 같은 ▶ 머리말·같은 차례로** 다시 내 주세요.',
    '- 새 근거·새 글자·새 연도를 지어내지 마세요. 고칠 때는 내용은 두고 말만 바꾸세요(전문어 → 실제로 무슨 일이 되는지, 긴 문장 → 짧은 문장, 빠진 갈래 → 그 갈래 문단 추가).',
    '- 답 밖의 말(「고쳤습니다」 같은 설명)은 붙이지 마세요. 머리말은 글자 그대로 두세요.',
    간지.length ? `- 쓸 수 있는 간지(원국·대운·세운·월운에 있는 것만): ${간지.join(' ')}` : '- 간지는 원래 답에 있는 것만 쓰세요.',
    연도.length ? `- 쓸 수 있는 연도: ${연도[0]}~${연도[연도.length - 1]} 가운데 원래 답과 운 표에 있는 해만` : '',
    ...(Array.isArray(규칙) ? 규칙 : [String(규칙)]),
    // 44차: 지나온 해 물음에 걸리면 고칠 재료(지나온 표 뼈대·무엇을 → 어떻게·답 차례)를 함께 — 없으면 「→ 어떻게」를 지어내거나 비운다
    ...((오류 || []).some(x => x.규칙 === '지나온 해 물음') ? 지나온재료(opt.브리프) : []),
    '',
    '─── 원래 답 (여기부터) ───',
    String(원답 || ''),
    '─── 원래 답 (여기까지) ───',
    '위 답을 고쳐 전체를 다시 쓰세요.',
  ].filter(l => l != null).join('\n');
}

/**
 * 검사에 걸린 답을 고쳐 쓴다 — /해설·/문답이 같이 쓴다.
 *   ① 섹션 다시 쓰기(짧은 요청) → ② 실패(예외·빈 답)면 전체 브리프 재요청(옛 방식)
 *   돌아온 답마다 validate(신살·흉단·한자·지어내기) → 걸린 문장 덜어내기 → 다듬기(자동교정→검사→보강)
 *   오류 수가 줄었을 때만 채택한다.
 * @param {object} a
 *   원답, 검사(첫 답의 dapgeomsa 결과), 브리프, 모드, 주제, 판정(interpret 결과 — validate용),
 *   보내기짧게(prompt)→text, 보내기전체()→text, 다듬기(text)→{본문, 보강, 검사}
 * @returns {{채택:boolean, 방식:string|null, 요청크기:number, 재검사:object, 본문?:string, 검사?:object, 보강?:Array, 가드?:Array}}
 */
async function 고쳐쓰기(a) {
  const 결과 = { 채택: false, 방식: null, 요청크기: 0, 재검사: null, 가드: [] };
  const 가드 = (t) => {
    if (!a.판정) return t;
    const v = validate(t, a.판정);
    if (v.통과) return t;
    결과.가드.push(...v.문제.map(p => p.종류));
    const 정리 = 문제문장제거(t, v.문제);
    return 정리.length >= 200 ? 정리 : '';
  };
  let 둘 = null;
  // ① 섹션 다시 쓰기
  try {
    const p = 섹션다시쓰기프롬프트(a.원답, a.검사.오류, { 브리프: a.브리프, 모드: a.모드, 주제: a.주제, 규칙줄: a.규칙줄 });
    결과.요청크기 = p.length;
    let t = await a.보내기짧게(p);
    t = (t && typeof t === 'string') ? 가드(t.trim()) : '';
    if (t && t.length >= 5) { 둘 = a.다듬기(t); 결과.방식 = '섹션'; }
  } catch (e) { 결과.섹션실패 = String(e && e.message || e).slice(0, 80); }
  // ② 옛 방식 — 섹션 다시 쓰기가 실패했을 때만
  if (!둘 && typeof a.보내기전체 === 'function') {
    try {
      let t = await a.보내기전체();
      t = (t && typeof t === 'string') ? 가드(t.trim()) : '';
      if (t && t.length >= 5) { 둘 = a.다듬기(t); 결과.방식 = '전체'; }
    } catch (e) { 결과.전체실패 = String(e && e.message || e).slice(0, 80); }
  }
  if (!둘) { 결과.재검사 = { 통과: false, 실패: '다시 쓴 답이 없음', 오류: [], 경고: [] }; return 결과; }
  결과.재검사 = { 통과: 둘.검사.통과, 방식: 결과.방식, 오류: 둘.검사.오류.map(x => x.규칙 + ': ' + x.내용), 경고: 둘.검사.경고.map(x => x.규칙 + ': ' + x.내용) };
  if (둘.검사.오류.length < a.검사.오류.length) { 결과.채택 = true; 결과.본문 = 둘.본문; 결과.검사 = 둘.검사; 결과.보강 = 둘.보강; }
  return 결과;
}

module.exports = { 채용일정검색, 해석, validate, 지어내기검사, 문제문장제거, 재요청프롬프트, 보내기, 섹션다시쓰기프롬프트, 규칙줄고르기, 고쳐쓰기, toLLMBrief, 일일호출통계 };

if (require.main === module) {
  const m = { yeonGan:'甲', yeonJi:'申', wolGan:'壬', wolJi:'申',
              ilGan:'乙', ilJi:'巳', siGan:'戊', siJi:'寅', daysFromJeolip:15 };
  const r = interpret(m);

  console.log('── 출력 검사기 ──');
  const 표본 = [
    ['정상', '월령이 정관이라 규범이 중심에 놓인 구조입니다. 재가 관을 생해주니 실질적인 성과가 자리로 이어집니다.'],
    ['신살 섞임', '도화가 있어 인기가 많고 천을귀인이 도와주는 구조입니다.'],
    ['흉단 섞임', '배우자와 해로하기 어려운 구조이니 조심해야 합니다.'],
    ['등급어', '이 명식은 상격에 속하는 귀격입니다.'],
    ['지어내기', '양인이 강하게 서 있어 결단력이 뛰어난 구조입니다.'],
  ];
  for (const [이름, t] of 표본) {
    const v = validate(t, r);
    console.log(` ${v.통과 ? '통과' : '차단'}  ${이름.padEnd(8)} ${v.통과 ? '' : v.문제.map(p=>`${p.종류}(${p.검출.join(',')})`).join(' / ')}`);
  }

  console.log('\n── 문제 문장만 덜어내기 ──');
  const 섞인 = '월령이 정관이라 규범이 중심에 놓인 구조입니다. 도화가 있어 인기가 많습니다. 재가 관을 생해줍니다.';
  const v = validate(섞인, r);
  console.log(' 전:', 섞인);
  console.log(' 후:', 문제문장제거(섞인, v.문제));

  console.log('\n── API 키 없을 때 ──');
  해석(m).then(x => console.log(` 출처: ${x.출처} / 사유: ${x.사유} / 본문 ${x.본문.length}자`));
}
