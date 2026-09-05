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

const { 해석 } = require('./engine/gemini');
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
    return 보냄(res, 200, { 살아있음: true, 키: !!API_KEY, 모델: MODEL }, origin);

  if (길 !== '/해설' && 길 !== '/interpret' && 길 !== '/문답')
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
  req.on('data', c => { 몸 += c; if (몸.length > 몸한도) req.destroy(); });
  req.on('end', async () => {
    let 입력;
    try { 입력 = JSON.parse(몸); }
    catch { return 보냄(res, 400, { 오류: '읽을 수 없는 형식입니다' }, origin); }

    const 탈 = 명식검사(입력.명식);
    if (탈) return 보냄(res, 400, { 오류: 탈 }, origin);

    // ── 문답 모드 ──────────────────────────────
    // 첫 물음은 「묻는다」와 똑같은 상담글, 두 번째부터 소스 전체를 연 자유 문답.
    // 그 갈림은 mundap_route가 이력 길이로 스스로 판단한다.
    if (길 === '/문답') {
      try {
        const 답 = await 문답처리(입력, {
          apiKey: API_KEY, model: MODEL,
          온도: Number(process.env.TEMPERATURE || 0.7),
        });
        return 보냄(res, 200, 답, origin);
      } catch (e) {
        return 보냄(res, 200, { 성공: false, 사유: '답을 만들지 못했습니다', 본문: null }, origin);
      }
    }

    try {
      const interpretOpt = {
        관법: 입력.관법 === '궁통보감' ? '궁통보감' : undefined,   // 유파 토글
        출생연도: 입력.출생연도,          // 대운 나이 표기에만 쓴다
        gender: 입력.성별 === '여' ? '여' : '남',
        daysToJeolgi: 입력.절기날수,
        세운시작: 입력.세운시작,
        세운개수: 입력.세운개수 ?? 3,
        주제: 입력.주제,                  // '직업' 같은 것. 없으면 전체
      };
      const 부르기 = () => 해석(입력.명식, {
        apiKey: API_KEY, model: MODEL,
        온도: Number(process.env.TEMPERATURE || 0.7),
        재시도: 1, interpretOpt,
      });
      let r = await 부르기();
      // ── 답 검사기 (2026-09-03 규칙들은 부탁일 뿐 — 서버가 기계적으로 검사한다) ──
      let 검사 = null;
      try {
        const D = require('./engine/dapgeomsa');
        const 모드 = interpretOpt.관법 === '궁통보감' ? '궁통' : (/\[이어묻기\]/.test(입력.주제 || '') ? '문답' : '상담');
        if (r.성공 && r.본문) {
          검사 = D.검사(r.본문, { 브리프: interpretOpt.__브리프, 모드, 궁통있음: /\[궁통보감 조건절 —/.test(interpretOpt.__브리프 || '') });
          if (!검사.통과) {
            interpretOpt.검사지적 = 검사.다시쓰기지시;
            const r2 = await 부르기();
            if (r2.성공 && r2.본문) {
              const 검사2 = D.검사(r2.본문, { 브리프: interpretOpt.__브리프, 모드 });
              // 다시 쓴 것이 더 낫으면 바꾼다(오류 수가 줄었을 때). 같거나 나쁘면 첫 답 유지
              if (검사2.오류.length < 검사.오류.length) { r = r2; 검사 = 검사2; 검사.다시씀 = true; }
            }
          }
        }
      } catch (e) { /* 검사기가 없어도 답은 나가야 한다 */ }
      // 판정 전체를 돌려주지 않는다 — 앱이 이미 갖고 있고, 그만큼 응답이 가벼워진다
      보냄(res, 200, {
        성공: r.성공, 본문: r.본문, 출처: r.출처,
        격: r.판정?.결론?.격, 상신: r.판정?.결론?.상신, 성패: r.판정?.결론?.성패,
        사유: r.사유,
        검사: 검사 ? { 통과: 검사.통과, 다시씀: !!검사.다시씀, 오류: 검사.오류.map(x => x.규칙 + ': ' + x.내용), 경고: 검사.경고.map(x => x.규칙 + ': ' + x.내용) } : undefined,
      }, origin);
    } catch (e) {
      // 무엇이 터졌든 앱은 조문 리포트로 넘어갈 수 있어야 한다
      보냄(res, 200, { 성공: false, 사유: '해설을 만들지 못했습니다',
                      본문: null, 출처: '실패' }, origin);
    }
  });
});

서버.listen(PORT, () => {
  console.log(`간명 해설 중계 — 포트 ${PORT}`);
  console.log(`  모델 ${MODEL} · 키 ${API_KEY ? '있음' : '없음(조문 리포트로 대체됨)'}`);
  console.log(`  허용 출처 ${허용출처.length ? 허용출처.join(', ') : '전부(시험용)'}`);
  console.log(`  한도 IP당 한 시간 ${한도}번`);
});
