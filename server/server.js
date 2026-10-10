/**
 * server.js — 해설 중계 서버
 *
 * 왜 서버가 필요한가:
 *   브라우저 자바스크립트는 다 들여다보인다. 앱에 API 키를 넣으면
 *   누구나 꺼내 쓸 수 있고 요금은 키 주인이 낸다. 그래서 키를 들고 있을
 *   자리가 하나 필요하다. 이 서버가 하는 일은 그것뿐이다.
 *
 * 무엇을 하지 않는가:
 *   - **판정하지 않는다.** 격·상신·성패·운은 앱이 기기 안에서 이미 다 냈다.
 *     여기서 다시 계산하면 두 곳이 어긋날 수 있다.
 *   - **생년월일시를 받지 않는다.** 받는 것은 판정 결과(명식 여덟 글자와
 *     격·상신·운)뿐이다. 누구인지 알 수 없는 값이라 개인정보로 남지 않는다.
 *   - **아무것도 저장하지 않는다.** 로그에도 명식을 남기지 않는다.
 *
 * 흐름:
 *   앱 ──명식──▶ 이 서버 ──키 붙여──▶ Gemini
 *                   └── 가드 검사 ── 걸리면 다시 시키거나 그 문장만 덜어냄
 *   앱 ◀──해설──
 */
const http = require('http');

// ── 47편 외격 층을 interpret에 얹는다 ─────────────────────────
//   gemini.js가 안에서 interpret을 부르므로, **gemini를 require하기 전에**
//   감싸야 /해설(상담글)과 /문답 양쪽에 다 반영된다.
//   interpret.js 안에 직접 두 줄을 넣었다면 이 블록은 지워도 된다.
{
  const interpret = require('./engine/interpret');
  const oegyeok   = require('./engine/oegyeok');    // 22편 (양인을 월령무용에 포함한 판)
  const japgyeok  = require('./engine/japgyeok');   // 47편 論雜格
  // 관법 토글 (2026-09-05) — 입력.관법 === '궁통보감'이면 격국 브리프 대신 궁통보감 척추 브리프를 낸다.
  //   gemini.js가 haeseol.toLLMBrief(r, interpretOpt)를 부르므로 여기서 감싼다(gemini require 전).
  const haeseol = require('./engine/haeseol');
  if (typeof haeseol.궁통브리프 === 'function' && !haeseol.__관법) {
    const 원래브리프 = haeseol.toLLMBrief;
    haeseol.toLLMBrief = function (r, opt) {
      let b = (opt && opt.관법 === '궁통보감') ? haeseol.궁통브리프(r, opt) : 원래브리프(r, opt);
      // 답 검사기(2026-09-05): 앞 답이 검사에 걸렸으면 지적을 덧붙여 다시 쓰게 한다
      if (opt && opt.검사지적) b += '\n' + opt.검사지적;
      // 요청별 브리프 보관 — 검사기가 표 밖 간지·연도를 대조할 때 쓴다(opt는 요청마다 새 객체)
      if (opt) opt.__브리프 = b;
      return b;
    };
    haeseol.__관법 = true;
  }
  const 원래 = interpret.interpret;
  if (typeof 원래 === 'function' && !interpret.__외격층) {
    interpret.interpret = function (m, opt) {
      const r = 원래(m, opt);
      try {
        r.단계22_외격 = oegyeok.analyze({ ctx: r.ctx, 결론: r.결론.성패 }, m);
        r.단계47_잡격 = japgyeok.analyze(r.단계22_외격, m);
      } catch (e) {}
      return r;
    };
    interpret.__외격층 = true;
  }
}

const { 해석, 고쳐쓰기, 일일호출통계 } = require('./engine/gemini');
const { 문답처리 } = require('./engine/mundap_route');   // 문답 모드 (자유 문답 + 47편 외격)

const PORT     = process.env.PORT || 10000;
const API_KEY  = process.env.GEMINI_API_KEY;
const MODEL    = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// 쉼표로 여러 개. 비우면 전부 허용(로컬 시험용)
const 허용출처 = (process.env.ALLOW_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);

// ── 간이 요금 방어 ────────────────────────────
// 키가 새지 않아도 남이 이 서버를 두드리면 요금이 나간다.
// 무료 등급을 지키는 선에서 IP당 한도를 둔다. 계정을 붙이면 이 층은 걷어낸다.
const 창 = 60 * 60 * 1000;      // 한 시간
const 한도 = Number(process.env.RATE_LIMIT || 20);
const 기록 = new Map();
function 넘었나(ip) {
  const 이제 = Date.now();
  const a = (기록.get(ip) || []).filter(t => 이제 - t < 창);
  if (a.length >= 한도) { 기록.set(ip, a); return true; }
  a.push(이제); 기록.set(ip, a);
  if (기록.size > 5000) for (const [k, v] of 기록) if (!v.length || 이제 - v[v.length-1] > 창) 기록.delete(k);
  return false;
}

// ── 재시도 기록 (2026-10-07, C14) ───────────────
// 메모리 안 셈만. 명식·본문·IP는 넣지 않는다. GET /health 의 `통계` 로 보인다(재시작하면 0부터).
const 통계 = {
  시작: new Date().toISOString(),
  요청: { 해설: 0, 문답: 0 }, 성공: 0, 실패: 0, 예외: 0, 본문초과: 0,
  시도2: 0, 채택둘째: 0, 다시쓰기: { 섹션: 0, 전체: 0, 실패: 0 }, 섹션요청크기합: 0,
  오류규칙: {}, 경고규칙: {}, 보강용어: {}, 가드: {},
  이해안됨: {},   // 「이해 안 됨」 단추(2026-10-07, PROMPTS 5) — 절 이름만 센다. 명식·본문·IP 없음
  캐시: { 적중: 0, 비적중: 0 },   // 명식 해시 캐시(2026-10-07, PROMPTS 8)
};
const 이해안됨절 = ['한 줄로 말하면', '쉽게 풀어 보면', '왜 그렇게 보나요', '해마다 보면', '해 볼 만한 일', '이 답에 나온 말', '전체'];
const 셈 = (표, k) => { if (k) 표[k] = (표[k] || 0) + 1; };
const 규칙이름 = (x) => String(x || '').split(':')[0].trim();
function 통계반영(답) {
  if (!답) return;
  답.성공 ? 통계.성공++ : 통계.실패++;
  for (const k of 답.가드 || []) 셈(통계.가드, k);
  const 검 = 답.검사; if (!검) return;
  if ((검.시도 || 1) >= 2) 통계.시도2++;
  if (검.다시씀) 통계.채택둘째++;
  if (검.다시쓰기) { 셈(통계.다시쓰기, 검.다시쓰기.방식 || '실패'); 통계.섹션요청크기합 += 검.다시쓰기.요청크기 || 0; }
  // 규칙별 횟수는 첫 답 기준(다시 쓴 답을 채택했으면 재검사도 더한다)
  for (const x of 검.첫오류 || 검.오류 || []) 셈(통계.오류규칙, 규칙이름(x));   // 첫 답의 오류(다시 썼으면 첫오류에 따로 담겨 온다)
  for (const x of 검.경고 || []) 셈(통계.경고규칙, 규칙이름(x));
  if (검.재검사 && 검.재검사.오류) for (const x of 검.재검사.오류) 셈(통계.오류규칙, 규칙이름(x));
  for (const w of 검.보강된용어 || []) 셈(통계.보강용어, w);
}

// ── 명식 해시 캐시 (2026-10-07, PROMPTS 8 운영) ─────────────────────────
//   같은 명식·성별·출생연도·주제·관법·세운 범위의 /해설 답을 메모리에 CACHE_TTL_H 시간(기본 24, 0 이면 끔) 둔다 — Gemini 요금과 콜드스타트 뒤 첫 답 시간을 줄인다.
//   키는 sha256 한 값만 쓰고(명식 글자를 키로 두지 않는다), 디스크·로그에는 아무것도 적지 않는다. 재시작하면 빈다. 최대 CACHE_MAX(기본 500)건, 오래된 것부터 지운다.
const crypto = require('crypto');
const 캐시 = new Map();
const 캐시TTL = Math.max(0, Number(process.env.CACHE_TTL_H ?? 24)) * 3600 * 1000;
const 캐시MAX = Math.max(10, Number(process.env.CACHE_MAX || 500));
const 캐시키 = (입력, interpretOpt) => crypto.createHash('sha256').update(JSON.stringify([입력.명식 && ['yeonGan','yeonJi','wolGan','wolJi','ilGan','ilJi','siGan','siJi','daysFromJeolip'].map(k => 입력.명식[k] ?? null), interpretOpt.gender, interpretOpt.출생연도 ?? null, interpretOpt.주제 ?? null, interpretOpt.관법 ?? null, interpretOpt.세운시작 ?? null, interpretOpt.세운개수 ?? null, interpretOpt.daysToJeolgi ?? null, interpretOpt.기억 ?? null])).digest('hex');
function 캐시읽기(k) { if (!캐시TTL) return null; const v = 캐시.get(k); if (!v) return null; if (Date.now() - v.때 > 캐시TTL) { 캐시.delete(k); return null; } return v.응답; }
function 캐시쓰기(k, 응답) { if (!캐시TTL) return; 캐시.set(k, { 때: Date.now(), 응답 }); if (캐시.size > 캐시MAX) { const 이제 = Date.now(); for (const [kk, v] of 캐시) { if (캐시.size <= 캐시MAX) break; if (이제 - v.때 > 캐시TTL) 캐시.delete(kk); } while (캐시.size > 캐시MAX) 캐시.delete(캐시.keys().next().value); } }

const 필수 = ['yeonGan','yeonJi','wolGan','wolJi','ilGan','ilJi'];
const 천간 = '甲乙丙丁戊己庚辛壬癸';
const 지지 = '子丑寅卯辰巳午未申酉戌亥';

function 명식검사(m) {
  if (!m || typeof m !== 'object') return '명식이 없습니다';
  for (const k of 필수) {
    if (!m[k]) return `${k}이(가) 없습니다`;
    const 판 = k.endsWith('Gan') ? 천간 : 지지;
    if (!판.includes(m[k])) return `${k}이(가) 간지가 아닙니다`;
  }
  for (const k of ['siGan','siJi']) {
    if (m[k] == null) continue;
    const 판 = k.endsWith('Gan') ? 천간 : 지지;
    if (!판.includes(m[k])) return `${k}이(가) 간지가 아닙니다`;
  }
  return null;
}

function 머리(res, origin) {
  const h = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!허용출처.length || (origin && 허용출처.includes(origin))) {
    h['Access-Control-Allow-Origin'] = origin || '*';
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Vary'] = 'Origin';
  }
  return h;
}
const 보냄 = (res, code, obj, origin) => {
  res.writeHead(code, 머리(res, origin));
  res.end(JSON.stringify(obj));
};

const 서버 = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  // 한글 주소는 브라우저가 퍼센트 인코딩해서 보낸다. 풀어서 견준다.
  const url = new URL(req.url, 'http://x');
  let 길 = url.pathname;
  try { 길 = decodeURIComponent(길); } catch { /* 잘못된 인코딩이면 그대로 */ }

  if (req.method === 'OPTIONS') { res.writeHead(204, 머리(res, origin)); return res.end(); }

  // 살아 있는지 — Render가 잠들지 않게 앱이 미리 깨울 때도 쓴다
  if (길 === '/health')
    // 커밋 — Render가 넣어 주는 RENDER_GIT_COMMIT. 배포가 끝났는지 밖에서 확인할 때 쓴다(scripts/smoke.js)
    return 보냄(res, 200, { 살아있음: true, 키: !!API_KEY, 모델: MODEL, 커밋: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || null, 통계: { ...통계, 캐시: { ...통계.캐시, 건수: 캐시.size, ttl시간: 캐시TTL / 3600000 }, gemini: 일일호출통계() } }, origin);

  // 「이해 안 됨」 — 앱이 절 이름 하나만 보낸다(POST /이해안됨 {절}). 명식·본문·IP 는 받지도 적지도 않는다. (2026-10-07, PROMPTS 5)
  if (길 === '/이해안됨') {
    if (req.method !== 'POST') return 보냄(res, 405, { 오류: 'POST로 보내 주세요' }, origin);
    if (허용출처.length && origin && !허용출처.includes(origin)) return 보냄(res, 403, { 오류: '허용되지 않은 출처입니다' }, origin);
    let b = '';
    req.on('data', c => { if (b.length < 2000) b += c; });
    req.on('end', () => {
      let 절 = null; try { 절 = String((JSON.parse(b) || {}).절 || '').trim(); } catch { /* 모양이 틀려도 세지만 않는다 */ }
      if (!이해안됨절.includes(절)) return 보냄(res, 400, { 오류: '절 이름이 아닙니다', 절목록: 이해안됨절 }, origin);
      셈(통계.이해안됨, 절);
      return 보냄(res, 200, { 받음: true, 절 }, origin);
    });
    return;
  }

  if (길 !== '/해설' && 길 !== '/interpret' && 길 !== '/문답' && 길 !== '/판정')
    return 보냄(res, 404, { 오류: '없는 주소입니다' }, origin);
  if (req.method !== 'POST')
    return 보냄(res, 405, { 오류: 'POST로 보내 주세요' }, origin);

  if (허용출처.length && origin && !허용출처.includes(origin))
    return 보냄(res, 403, { 오류: '허용되지 않은 출처입니다' }, origin);

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
           || req.socket.remoteAddress || 'unknown';
  if (넘었나(ip))
    return 보냄(res, 429, { 오류: '잠시 뒤에 다시 시도해 주세요',
      안내: `한 시간에 ${한도}번까지 볼 수 있습니다` }, origin);

  let 몸 = '';
  // 문답은 대화 이력을 함께 보내므로 20KB로는 모자란다
  const 몸한도 = (길 === '/문답') ? 200000 : 20000;
  // 2026-10-07: 한도를 넘으면 끊지(req.destroy) 않고 400 JSON 으로 답한다 — 앱이 사유를 보여 줄 수 있게
  let 넘침 = false;
  req.on('data', c => {
    if (넘침) return;
    몸 += c;
    if (몸.length > 몸한도) { 넘침 = true; 몸 = ''; 통계.본문초과++; 보냄(res, 400, { 성공: false, 사유: '본문이 너무 큽니다', 본문: null }, origin); req.resume(); }
  });
  req.on('end', async () => {
    if (넘침) return;
    let 입력;
    try { 입력 = JSON.parse(몸); }
    catch { return 보냄(res, 400, { 오류: '읽을 수 없는 형식입니다' }, origin); }

    // ── /판정 JSON API (2026-10-07, PROMPTS 7 전문가 모드) — Gemini 없이 엔진 판정과 조문 추적만 JSON 으로 ──────────
    //   몸: { 명식 } 또는 { 입력:{년,월,일,시,분,성별,시모름,출생지,야자시,균시차} }, 성별, 출생연도, 절기날수, 전체(안 걸린 조문까지), 민감도(시주 없을 때 열두 시주 표)
    //   답: { 명식, 결론, 추적, 궁통, 대운, 만세력, 민감도 } — 표시금지 조문 원문은 여기서도 가린다. 통계 요청.판정 만 센다
    if (길 === '/판정') {
      통계.요청.판정 = (통계.요청.판정 || 0) + 1;
      try {
        const T = require('./engine/jomun_trace');
        const { interpret, 생년월일시로 } = require('./engine/interpret');
        const GJ = require('./engine/gungtong_jomun');
        const 성별 = 입력.성별 === '여' ? '여' : '남';
        let r;
        if (입력.입력 && 입력.입력.년) r = 생년월일시로({ ...입력.입력, 성별 });
        else { const 탈 = 명식검사(입력.명식); if (탈) return 보냄(res, 400, { 오류: 탈 }, origin); r = interpret(입력.명식, { gender: 성별, 출생연도: 입력.출생연도, daysToJeolgi: 입력.절기날수 }); }
        const 추 = T.추적(r, { 성별, 전체: !!입력.전체 });
        let 궁 = null; try { 궁 = GJ.analyze(r.명식, { 성별 }); } catch (e) {}
        const 대운 = ((r.단계11_행운 || {}).대운 || []).map(u => ({ 간지: u.간지, 시작나이: u.시작나이, 판정: u.길흉 && u.길흉.판정, 두읽기: u.읽기 && u.읽기.분할 ? { 천간5: u.읽기.분할.천간5 && u.읽기.분할.천간5.판정, 지지5: u.읽기.분할.지지5 && u.읽기.분할.지지5.판정 } : null }));
        const 민감도 = (입력.민감도 && !r.명식.siJi) ? T.시주민감도(r.명식, { gender: 성별, 출생연도: 입력.출생연도 }) : null;
        return 보냄(res, 200, { 성공: true, 명식: r.명식, 결론: r.결론, 추적: 추, 궁통: 궁, 대운, 만세력: r.만세력 || null, 민감도, 안내: '판정은 코드가 낸 것이고 문장(상담)은 /해설 로. 표시금지 조문 원문은 내지 않는다' }, origin);
      } catch (e) {
        통계.예외++;
        return 보냄(res, 500, { 성공: false, 사유: String(e && e.message || '판정을 만들지 못했습니다').slice(0, 200) }, origin);
      }
    }

    const 탈 = 명식검사(입력.명식);
    if (탈) return 보냄(res, 400, { 오류: 탈 }, origin);

    // ── 문답 모드 ──────────────────────────────
    // 첫 물음은 「묻는다」와 똑같은 상담글, 두 번째부터 소스 전체를 연 자유 문답.
    // 그 갈림은 mundap_route가 이력 길이로 스스로 판단한다.
    // 49차 — 물음에 기업 이름이 있으면 채용 일정을 인터넷에서 찾아 재료로(실패해도 답은 그대로 진행)
    if ((길 === '/문답' || 길 === '/해설' || 길 === '/interpret') && !입력.채용일정) {
      try { const C = require('./engine/chaeyong'); const 물음 = 길 === '/문답' ? 입력.질문 : 입력.주제; const 기업 = C.기업of(물음);
        if (기업) { 통계.채용검색 = (통계.채용검색 || 0) + 1; const G = require('./engine/gemini'); 입력.채용일정 = await G.채용일정검색(기업, { apiKey: API_KEY, model: MODEL }); if (!입력.채용일정) 통계.채용검색실패 = (통계.채용검색실패 || 0) + 1; }
      } catch (e) { 입력.채용일정 = null; }
    }
    const 출처붙임 = 답 => { try { if (답 && 입력.채용일정 && typeof 답.본문 === 'string' && !답.본문.includes('채용 일정 출처')) 답.본문 += require('./engine/chaeyong').출처줄(입력.채용일정); } catch (e) {} return 답; };
    if (길 === '/문답') {
      통계.요청.문답++;
      try {
        const 답 = await 문답처리(입력, {
          apiKey: API_KEY, model: MODEL,
          온도: Number(process.env.TEMPERATURE || 0.7),
        });
        if (답 && 답.오류) {   // 문답처리 안에서 예외가 났다 — 500, 사유만(스택 없음)
          통계.예외++; console.log(`[문답] 예외 — ${답.사유}`);
          return 보냄(res, 500, { 성공: false, 사유: 답.사유 || '답을 만들지 못했습니다', 본문: null }, origin);
        }
        통계반영(답);
        return 보냄(res, 200, 출처붙임(답), origin);
      } catch (e) {
        통계.예외++; console.log(`[문답] 예외 — ${String(e && e.message || e).slice(0, 120)}`);
        return 보냄(res, 500, { 성공: false, 사유: String(e && e.message || '답을 만들지 못했습니다').slice(0, 200), 본문: null }, origin);
      }
    }
    통계.요청.해설++;

    try {
      const interpretOpt = {
        관법: 입력.관법 === '궁통보감' ? '궁통보감' : undefined,   // 유파 토글
        출생연도: 입력.출생연도,          // 대운 나이 표기에만 쓴다
        gender: 입력.성별 === '여' ? '여' : '남',
        daysToJeolgi: 입력.절기날수,
        세운시작: 입력.세운시작,
        세운개수: 입력.세운개수,          // 비우면 interpret 기본 — 올해부터 2070년까지 (2026-10-09 사용자 지시, 전 8)
        주제: 입력.주제,                  // '직업' 같은 것. 없으면 전체
        기억: 입력.기억,                  // 37차 — 앱이 이 기기에 적어 둔 지난 물음(서버는 저장 안 함, 브리프 재료만)
        채용일정: 입력.채용일정,          // 49차 — 서버가 인터넷에서 찾은 기업 채용 일정(없으면 null)
      };
      // 캐시 적중이면 Gemini 를 부르지 않는다(검사·보강이 끝난 응답 그대로, 캐시:true 만 붙여서)
      const 키 = 캐시키(입력, interpretOpt);
      const 적중 = 캐시읽기(키);
      if (적중) { 통계.캐시.적중++; 통계반영(적중); return 보냄(res, 200, { ...적중, 캐시: true }, origin); }
      통계.캐시.비적중++;
      const 부르기 = () => 해석(입력.명식, {
        apiKey: API_KEY, model: MODEL,
        온도: Number(process.env.TEMPERATURE || 0.7),
        재시도: 1, interpretOpt,
      });
      let r = await 부르기();
      // ── 답 검사기 (2026-09-03 규칙들은 부탁일 뿐 — 서버가 기계적으로 검사한다) ──
      //   2026-10-07: ① 글자 치환으로 끝나는 오류(「100%」)는 자동 교정 ② 빠진 용어 풀이는 엔진 사전으로 자동 보강 —
      //   둘 다 Gemini를 다시 부르지 않는다 ③ 그래도 오류면 한 번 다시 쓰게 하되, 재검사는 지적을 붙이기 전 브리프로
      //   ④ 재검사 결과·보강된 용어·시도 횟수를 응답에 넣는다(전에는 다시 쓴 답이 왜 버려졌는지 알 길이 없었다)
      let 검사 = null, 보강된용어 = [], 재검사 = null, 시도 = 1, 다시쓰기 = null, 가드 = [], 첫오류이름 = [];
      try {
        const D = require('./engine/dapgeomsa');
        const SW = require('./engine/swiunmal');
        // 설명 요청(「이게 무슨 말이야」)은 상담글 모양(▶ 다섯 머리말)을 요구하지 않는다 (2026-10-02)
        let 설명 = false;
        try { 설명 = SW.설명요청인가(입력.주제); } catch (e) {}
        const 모드 = interpretOpt.관법 === '궁통보감' ? '궁통' : 설명 ? '설명' : (/\[이어묻기\]/.test(입력.주제 || '') ? '문답' : '상담');
        const 원브리프 = interpretOpt.__브리프;   // 검사지적이 붙기 전 — 재검사도 이것으로(지적 안의 간지·연도가 허용 목록에 새지 않게)
        const 검사ctx = { 브리프: 원브리프, 모드, 궁통있음: /\[궁통보감 조건절 —/.test(원브리프 || ''), 질문: 입력.주제 };
        // 답 하나를 다듬어 검사한다: 자동 교정 → 용어 보강 → 검사
        const 다듬기 = (글) => {
          let 교정 = D.자동교정 ? D.자동교정(글).본문 : 글;
          try { 교정 = SW.채용판정보강(교정, 검사ctx.브리프).본문; } catch (e) {}   // 50차: 채용 일정 판정 첫말은 코드가 넣는다
          const 검사 = D.검사(교정, 검사ctx);   // 보강 **전** 본문으로 — 서버가 덧붙인 「속에 숨은 壬」이 「표 밖 간지」로 잡히면 고칠 수 없는 재호출이 된다
          let 본문 = 교정, 보강 = [];
          try { const b = SW.용어보강(교정, r.판정); 본문 = b.본문; 보강 = b.보강; } catch (e) {}
          if (보강.length && SW.안풀린목록) {   // 용어 풀이 경고만 최종 본문 기준으로 다시 센다
            검사.경고 = 검사.경고.filter(x => x.규칙 !== '용어 풀이');
            const 남은 = SW.안풀린목록(본문);
            if (남은.length) 검사.경고.push({ 규칙: '용어 풀이', 내용: `본문에 쓰고 풀이에 없는 말: ${남은.slice(0, 6).join('·')}` });
          }
          return { 본문, 보강, 검사 };
        };
        if (r.제거사유) 가드.push(...r.제거사유.map(p => p.종류));   // 해석() 안 validate 가 걸려 문장을 덜어낸 경우
        if (r.성공 && r.본문) {
          const 원답 = r.본문;
          const 첫 = 다듬기(r.본문);
          r.본문 = 첫.본문; 검사 = 첫.검사; 보강된용어 = 첫.보강; 첫오류이름 = 첫.검사.오류.map(x => x.규칙);
          if (!검사.통과) {
            시도 = 2;
            // C16: 걸린 절만 짧은 요청으로 고쳐 쓰게 한다. 그 요청이 실패하면만 옛 방식(브리프 전체 + 지적)
            const { 보내기 } = require('./engine/gemini');
            const g = await 고쳐쓰기({
              원답, 검사, 브리프: 원브리프, 모드, 주제: 입력.주제, 판정: r.판정,
              보내기짧게: (p) => 보내기(p, { apiKey: API_KEY, model: MODEL, 온도: Number(process.env.TEMPERATURE || 0.7) }),
              보내기전체: async () => { interpretOpt.검사지적 = 검사.다시쓰기지시; const r2 = await 부르기(); return (r2.성공 && r2.본문) ? r2.본문 : ''; },
              다듬기,
            });
            재검사 = g.재검사; 가드.push(...(g.가드 || []));
            다시쓰기 = { 방식: g.방식, 요청크기: g.요청크기, 채택: g.채택 };
            if (g.채택) { r.본문 = g.본문; 검사 = g.검사; 검사.다시씀 = true; 보강된용어 = g.보강; }
            // 로그에는 규칙 이름만 — 명식·본문은 남기지 않는다
            console.log(`[검사] 첫 답 오류 ${첫.검사.오류.map(x => x.규칙).join('·') || '없음'} / 다시 쓴 답(${g.방식 || '실패'}·요청 ${g.요청크기}자) ${재검사 && 재검사.오류 ? (재검사.오류.length ? 재검사.오류.map(x => x.split(':')[0]).join('·') : '오류 없음') : '실패'} / 채택 ${검사.다시씀 ? '둘째' : '첫째'}`);
          }
        }
      } catch (e) { /* 검사기가 없어도 답은 나가야 한다 */ }
      // 판정 전체를 돌려주지 않는다 — 앱이 이미 갖고 있고, 그만큼 응답이 가벼워진다
      const 응답 = {
        성공: r.성공, 본문: r.본문, 출처: r.출처,
        격: r.판정?.결론?.격, 상신: r.판정?.결론?.상신, 성패: r.판정?.결론?.성패,
        사유: r.사유, 가드: 가드.length ? 가드 : undefined,
        검사: 검사 ? { 통과: 검사.통과, 다시씀: !!검사.다시씀, 시도, 보강된용어, 재검사: 재검사 || undefined, 다시쓰기: 다시쓰기 || undefined, 첫오류: 검사.다시씀 ? 첫오류이름 : undefined, 오류: 검사.오류.map(x => x.규칙 + ': ' + x.내용), 경고: 검사.경고.map(x => x.규칙 + ': ' + x.내용) } : undefined,
      };
      통계반영(응답);
      출처붙임(응답);
      if (응답.성공 && /^Gemini/.test(응답.출처 || '')) 캐시쓰기(키, 응답);   // 성공한 Gemini 답만 — 폴백·실패는 다음에 다시 시도하게 둔다
      보냄(res, 200, 응답, origin);
    } catch (e) {
      // 예외 — 500 과 사유만(스택 없음). 앱은 짧은 알림을 띄우고 조문 리포트로 넘어간다
      통계.예외++; console.log(`[해설] 예외 — ${String(e && e.message || e).slice(0, 120)}`);
      보냄(res, 500, { 성공: false, 사유: '해설을 만들지 못했습니다: ' + String(e && e.message || e).slice(0, 160),
                      본문: null, 출처: '실패' }, origin);
    }
  });
});

if (require.main === module) {
  서버.listen(PORT, () => {
    console.log(`간명 해설 중계 — 포트 ${PORT}`);
    console.log(`  모델 ${MODEL} · 키 ${API_KEY ? '있음' : '없음(조문 리포트로 대체됨)'}`);
    console.log(`  허용 출처 ${허용출처.length ? 허용출처.join(', ') : '전부(시험용)'}`);
    console.log(`  한도 IP당 한 시간 ${한도}번`);
  });
}
// 시험(scripts/server_check.js)이 포트 없이 불러 쓴다
module.exports = { 서버, 통계 };
