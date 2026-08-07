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
const { 해석 } = require('./engine/gemini');

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

  if (길 !== '/해설' && 길 !== '/interpret')
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
  req.on('data', c => { 몸 += c; if (몸.length > 20000) req.destroy(); });
  req.on('end', async () => {
    let 입력;
    try { 입력 = JSON.parse(몸); }
    catch { return 보냄(res, 400, { 오류: '읽을 수 없는 형식입니다' }, origin); }

    const 탈 = 명식검사(입력.명식);
    if (탈) return 보냄(res, 400, { 오류: 탈 }, origin);

    try {
      const r = await 해석(입력.명식, {
        apiKey: API_KEY,
        model: MODEL,
        온도: Number(process.env.TEMPERATURE || 0.7),
        재시도: 1,
        interpretOpt: {
          출생연도: 입력.출생연도,          // 대운 나이 표기에만 쓴다
          gender: 입력.성별 === '여' ? '여' : '남',
          daysToJeolgi: 입력.절기날수,
          세운시작: 입력.세운시작,
          세운개수: 입력.세운개수 ?? 3,
          주제: 입력.주제,                  // '직업' 같은 것. 없으면 전체
        },
      });
      // 판정 전체를 돌려주지 않는다 — 앱이 이미 갖고 있고, 그만큼 응답이 가벼워진다
      보냄(res, 200, {
        성공: r.성공, 본문: r.본문, 출처: r.출처,
        격: r.판정?.결론?.격, 상신: r.판정?.결론?.상신, 성패: r.판정?.결론?.성패,
        사유: r.사유,
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
