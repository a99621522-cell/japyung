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
  return text.split(/(?<=[.!?。])\s+/)
    .filter(문장 => !말.some(w => 문장.includes(w)))
    .join(' ').trim();
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
  const 프롬프트 = toLLMBrief(r, opt);

  if (!apiKey) {
    return { 성공: false, 사유: 'API 키 없음', 판정: r,
             본문: render(r, interpretOpt), 출처: '조문 리포트(폴백)' };
  }

  let 현재프롬프트 = 프롬프트, 마지막 = null;
  for (let 회 = 0; 회 <= 재시도; 회++) {
    let text;
    try {
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
      return { 성공: false, 사유: `호출 실패: ${e.message}`, 판정: r,
               본문: render(r, interpretOpt), 출처: '조문 리포트(폴백)' };
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
  return { 성공: false, 사유: '검사를 통과하지 못함', 판정: r,
           본문: render(r, interpretOpt), 출처: '조문 리포트(폴백)',
           문제: 마지막.v.문제 };
}

module.exports = { 해석, validate, 지어내기검사, 문제문장제거, toLLMBrief };

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
