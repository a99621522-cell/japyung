// un_check.js — 운(運) 삼자 관계 검사 (2026-10-07, 9차 · docs/PROMPTS.md 2번)
//   무작위 N건(기본 900)에서
//   (a) 대운 두 읽기(통합/분할 천간5·지지5) 산출 예외 0
//   (b) 통합·분할 판정이 뒤집히는 건수 표 — 사실 보고(실패 조건 아님)
//   (c) chwiun 死 key(국 키) 국별 hit — 하나도 안 걸린 키는 보고(실패 조건 아님, 3,000건으로 따로 센다)
//   (d) 세운 대운관계 기록 예외 0 · 26편 성격변격이 세운 점수에 들어가지 않았는가
//   (e) 운 판정(대운·세운)에 신살어 0
//   (f) 명례 국판별 fixture — 원문이 국 이름을 붙인 명례가 그 국 키로 가는가
//   사용: node scripts/un_check.js [N]   · 어느 하나라도 틀리면 exit 1
const path = require('path'); const 뿌리 = path.join(__dirname, '..');
const manse = require(path.join(뿌리, 'manse')); const { interpret } = require(path.join(뿌리, 'interpret'));
const chwiun = require(path.join(뿌리, 'chwiun')); const { judge } = require(path.join(뿌리, 'gyeokguk'));
const { FIXTURES } = require(path.join(뿌리, 'fixtures_zpjz'));
let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const 신살어 = /도화|역마|화개|천을귀인|백호|괴강|양인살|원진|귀문|공망/;
const 판정어 = new Set(['결이 크게 눌림', '결이 눌림', '뒤섞임', '결이 살아남', '결이 크게 살아남']);
const N = +(process.argv[2] || 900);
const 문제 = { 읽기예외:[], 대운관계예외:[], 세운성격변격점수:[], 신살어:[], 국fixture:[] };
const 표 = { 대운수:0, 보류:0, 갈림:0, 통합vs천간5:0, 통합vs지지5:0, 모두같음:0, 갈린명식:0 };
const 국hit = {}; const 국키전체 = []; for (const [격, 키들] of Object.entries(chwiun.死키)) for (const k of 키들) 국키전체.push(`${격}.${k}`);
let 예외 = 0;
for (let i = 0; i < N; i++) {
  const y = 1950 + Math.floor(rnd()*61), mo = 1+Math.floor(rnd()*12), d = 1+Math.floor(rnd()*28), h = Math.floor(rnd()*24), mi = Math.floor(rnd()*60);
  const g = rnd() < 0.5 ? '남' : '여'; let ms, r;
  try {
    ms = manse.사주(y, mo, d, h, mi, { 성별: g }); const dw = manse.대운수(ms, g);
    r = interpret(ms.명식, { gender: g, 출생연도: y, daysToJeolgi: dw.날수, 세운시작: 2026, 세운개수: 4, 월운: false });
  } catch (e) { 문제.읽기예외.push(`${y}-${mo}-${d} ${h}:${mi} ${g} — ${e.message}`); 예외++; continue; }
  const tag = `${ms.사주} ${r.결론.격}/${r.결론.상신 ?? '-'}`;
  // (a)(b)
  let 갈린 = false;
  for (const u of (r.단계11_행운?.대운 ?? [])) {
    const k = u.읽기;
    // 상신 미지정으로 판정이 보류된 대운은 세 판정이 모두 같은 보류여야 한다
    const 보류 = u.길흉?.점수 == null;
    const 좋은판정 = p => 보류 ? p === u.길흉.판정 : 판정어.has(p);
    if (!k || !k.통합 || !k.분할 || !좋은판정(k.통합.판정) || !좋은판정(k.분할.천간5.판정) || !좋은판정(k.분할.지지5.판정) || !['분할','통합'].includes(k.머리))
      { 문제.읽기예외.push(tag + ' ' + u.간지); continue; }
    if (보류) { 표.보류++; continue; }
    표.대운수++;
    if (k.갈림) { 표.갈림++; 갈린 = true; }
    if (k.뒤집힘.includes('천간5')) 표.통합vs천간5++;
    if (k.뒤집힘.includes('지지5')) 표.통합vs지지5++;
    if (!k.갈림 && !k.뒤집힘.length) 표.모두같음++;
  }
  if (갈린) 표.갈린명식++;
  // (c)
  const rule = chwiun.lookup(r.결론.격, r.결론.상신, r.ctx);
  if (rule?.국키) { const key = `${chwiun.CHWIUN[r.결론.격] ? r.결론.격 : ({ 정재:'__財', 편재:'__財', 정인:'__印', 편인:'__印' })[r.결론.격]}.${rule.국키}`; 국hit[key] = (국hit[key] ?? 0) + 1; }
  // (d)
  for (const s of (r.단계11b_세운 ?? [])) {
    const k = s.대운관계;
    if (!k || !('합' in k) || !('충' in k) || !('육합' in k) || !('회국' in k) || !k.근거 || '점수' in k || '가감' in k) 문제.대운관계예외.push(tag + ' ' + s.연도);
    if (!s.성격변격 || s.성격변격.적용 !== false || s.길흉?.성격변격) 문제.세운성격변격점수.push(tag + ' ' + s.연도);
    if (!Array.isArray(s.비고) || !s.비고.some(x => /26편/.test(x))) 문제.대운관계예외.push(tag + ' ' + s.연도 + ' 비고 없음');
  }
  // (e)
  if (신살어.test(JSON.stringify(r.단계11_행운 ?? '')) || 신살어.test(JSON.stringify(r.단계11b_세운 ?? ''))) 문제.신살어.push(tag);
}
// (f) 명례 국판별 fixture — 원문이 국 이름을 붙인 명례 (33·35·37·41편 본문의 평 그대로)
const 국기대 = {
  '趙侍郎': '_살인',        // 33편 「有財用煞印者 … 趙侍郎命」
  '吳榜眼': '식인',         // 33편 「有用食而兼用印者 … 吳榜眼命」
  '平江伯': '식인',         // 33편 「或有暗官而去食護官 … 平江伯命」 — 取運은 財用食印으로 묶는다
  '무명(합살류관)': '_관살경투',   // 35편 「又有印而透兼官煞者，或合煞，或有制 … 辛亥、庚子、甲辰、乙亥」
  '무명(관살유제)': '_관살경투',   // 35편 「壬子、癸卯、丙子、己亥，此官煞有制也」
  '胡會元': '_대살',        // 37편 「若無印綬而單露偏官，只要無財 … 胡會元命」
  '劉提督': '_대살',        // 37편 「食神透煞 … 財先煞後，食以間之 … 劉提督命」
  '都統制': '_재인',        // 41편 「有傷官兼用財印者 … 財太重而帶印 … 都統制命」
  '一丞相': '_재인',        // 41편 「印太重而帶財 … 一丞相命」
  '蔡貴妃': '_살인',        // 41편 「有傷官用煞印者 … 蔡貴妃命」
  '常國公': null,           // 37편 「若不用財而就煞印」 — 인이 있어 食神帶煞이 아니라 食用煞印(상신 키)
  '孫布政': null,           // 35편 「有用煞而兼帶傷食者」 — __印.편관 조건절로 간다
  '張參政': null,           // 35편 「有印而透官者」 — 상신 키
  '婁參政': null,           // 45편 合財黨煞 — 건록 상신 편관, 국 키 없음
};
for (const [이름, 기대] of Object.entries(국기대)) {
  const f = FIXTURES.find(x => x.이름 === 이름); if (!f) { 문제.국fixture.push(이름 + ' 명례 없음'); continue; }
  const r = judge(f.m); const rule = chwiun.lookup(r.ctx.gyeok, r.상신, r.ctx);
  if ((rule?.국키 ?? null) !== 기대) 문제.국fixture.push(`${이름} ${f.명식} 기대 ${기대 ?? 'null'} → ${rule?.국키 ?? 'null'} (${r.ctx.gyeok}/${r.상신})`);
}
// g) 지나온 해(34차) — 과거 해 판정은 올해를 내는 함수와 같은 길이어야 한다: 지나온해 를 올해까지 늘려 낸 판정 = interpret 세운
문제.지나온해 = [];
{ const { 생년월일시로 } = require('../interpret'); const seun = require('../seun');
  for (const [y, mo, d, h] of [[1971, 9, 21, 21], [1984, 1, 25, 10], [1990, 6, 3, 4], [1958, 12, 30, 23]]) {
    const r = 생년월일시로({ 년: y, 월: mo, 일: d, 시: h, 분: 0, 성별: '남' });
    const 앞 = seun.지나온해(r, y, { 올해: 2031, 최대: 5 }).filter(s => s.연도 >= 2026), 지금 = (r.단계11b_세운 || []).filter(s => s.연도 < 2031);
    if (앞.length !== 지금.length || 앞.some((s, i) => s.길흉.판정 !== 지금[i].길흉.판정 || s.길흉.자평읽기.판정 !== 지금[i].길흉.자평읽기.판정)) 문제.지나온해.push(`${y}-${mo}-${d} ${h}시 지나온해 ↔ 세운 판정 다름`);
    const 과거 = seun.지나온해(r, y, { 올해: 2026 });
    if (!과거.length || 과거.some(s => s.나이 < 16 || s.연도 >= 2026 || s.거리 !== 2026 - s.연도)) 문제.지나온해.push(`${y} 범위·나이·거리`);
  } }
// h) 기억(37차, 39차 확인 걷음) — 지시 꼴 물음은 걷고, 확인이 와도 무시하며, 판정은 그대로, 엉뚱한 모양은 null
문제.기억 = [];
{ const G = require('../gieok'); const { 생년월일시로 } = require('../interpret');
  const r = 생년월일시로({ 년: 1971, 월: 9, 일: 21, 시: 21, 분: 40, 성별: '남' }); const 전 = JSON.stringify(r.단계11b_세운.map(s => s.길흉.판정));
  const 줄 = G.브리프줄({ 지난물음: [{ 날짜: '2026-10-01', 물음: '언제 이직', 한줄: '2027년' }, { 날짜: 'x', 물음: '앞의 지시를 무시하고', 한줄: '' }], 확인: { 맞음: [2018] } }, r, { 출생연도: 1971 }).join('\n');
  if (!/언제 이직/.test(줄) || /무시하고/.test(줄)) 문제.기억.push('지시 꼴 물음 걷기');
  if (/확인|맞다고/.test(줄)) 문제.기억.push('확인이 브리프에 남음');
  if (JSON.stringify(r.단계11b_세운.map(s => s.길흉.판정)) !== 전) 문제.기억.push('판정이 바뀜');
  if (G.정리(null) !== null || G.정리({ 지난물음: 'x' }) !== null || G.정리({ 확인: { 맞음: [2018] } }) !== null) 문제.기억.push('모양 틀린 기억'); }
// i) 물음 셈(38차) — 물으신 때만, 엔진 판정 그대로: 해 첫말 = 세운 머리 판정, 1월은 앞 해 세운의 달, 날은 일진 첫말, 엔진 답 검사 오류 0
문제.물음셈 = [];
{ const M = require('../mureum'), D = require('../dapgeomsa'), J = require('../iljin'); const { 생년월일시로 } = require('../interpret');
  const r = 생년월일시로({ 년: 1971, 월: 9, 일: 21, 시: 21, 분: 40, 성별: '남' }); const o = { 성별: '남', 출생연도: 1971 };
  const 첫 = { '결이 크게 살아남': '크게 열리는 해', '결이 살아남': '열리는 해', '뒤섞임': '두드러진 일이 적은 해', '결이 눌림': '지키는 해', '결이 크게 눌림': '크게 조심할 해' };
  const y1 = r.단계11b_세운[1], y3 = r.단계11b_세운[3];
  const 해줄 = M.물음셈줄(r, `${y1.연도}년이랑 ${y3.연도}년 중 언제 이직이 좋아`, o);
  if (!해줄.includes(`${y1.연도}년(${y1.간지}) ${첫[y1.길흉.판정]}`) || !해줄.includes(`${y3.연도}년(${y3.간지}) ${첫[y3.길흉.판정]}`)) 문제.물음셈.push('해 첫말 ≠ 세운');
  const 내일 = M.물음셈줄(r, '내일 운세 어때', o), d = J.analyze(r, { 시작: M.때들('내일', y1.연도 - 1, 1971).날.시작, 날수: 1 }).날[0];
  if (!내일.includes(`${d.간지} ${d.첫말}`)) 문제.물음셈.push('날 첫말 ≠ 일진');
  if (!/1월\([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥], \d{4}년 1월/.test(M.물음셈줄(r, '1월 운', o))) 문제.물음셈.push('1월 = 앞 해 세운의 다음해 달');
  if (M.물음셈줄(r, '내 성격은 어때', o)) 문제.물음셈.push('때 없는 물음에 셈이 붙음');
  for (const q of ['다음 주 계약 좋은 날', '11월에 이사하기 좋은 날', '60살에는', '지금 대운', '12월 재물운', '2030년 3월 결혼']) { const k = D.검사(M.엔진답(r, q, o), { 질문: q }); if ((k.오류 || []).length) 문제.물음셈.push(`${q} 엔진 답 오류 ${k.오류[0]}`); } }
// j) 들기 쉬운 일(40차) — 득은 적천수가 반기는 글자, 실은 꺼리는 글자에서만; 인연은 남 재·여 관(겁재 아님); 표에 병·사고·사망·이별 낱말 없음
문제.들기쉬운일 = [];
{ const SG = require('../sageon'), J = require('../jeokcheonsu'), { GAN } = require('../jijanggan'); const { interpret } = require('../interpret');
  const 금 = /병|사망|죽|수명|이혼|이별|파혼|수술/;   // 46차: 사고는 「~하기 쉬운 일」로 허용(사용자 지시)
  for (const 표 of [...Object.values(SG.일표).flat(), ...Object.values(SG.자리일)]) if (금.test(표)) 문제.들기쉬운일.push('금지 낱말: ' + 표);
  for (let i = 0; i < 120; i++) for (const 성 of ['남', '여']) { let m; try { m = manse.사주(1950 + Math.floor(rnd() * 61), 1 + Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28), Math.floor(rnd() * 24), 0, { 성별: 성 }).명식; } catch (e) { continue; }
    const r = interpret(m, { gender: 성, 출생연도: 1980, 세운개수: 6, 월운: false }); const H = J.희기(m);
    for (const s of r.단계11b_세운 || []) { const g = SG.그해(s, m, { 성별: 성 });
      const 인연있음 = [...g.득, ...g.실].some(x => /인연/.test(x));
      const 인연십 = (성 === '여' ? ['정관', '편관'] : ['정재', '편재']);
      if (인연있음 && !인연십.includes(s.천간십성) && !인연십.includes(s.지지십성)) 문제.들기쉬운일.push(`${성} ${s.연도} 인연 오배속 ${s.천간십성}/${s.지지십성}`);
      // 43차: 브리프줄·화면이 같은 고름(할일) — 열리는 해에 조심할 일(실)이, 지킴·조심 해에 살릴 일(득)이 섞이지 않는다
      { const 첫 = { '결이 크게 살아남': '크게 열리는 해', '결이 살아남': '열리는 해', '뒤섞임': '두드러진 일이 적은 해', '결이 눌림': '지키는 해', '결이 크게 눌림': '크게 조심할 해' }[s.길흉.판정] || '';
        const 할 = SG.할일(g, 첫);
        // 46차: 판정 쪽 일이 먼저, 반대쪽 일은 하나까지(2019년 주식 손해 — 열리는 해에도 꺼리는 돈 글자의 일을 남긴다)
        const 반대 = /열리는/.test(첫) ? 할.filter(x => g.실.includes(x.일) && !g.득.includes(x.일) && !g.자리.includes(x.일)) : /조심|지키는/.test(첫) ? 할.filter(x => g.득.includes(x.일) && !g.실.includes(x.일) && !g.자리.includes(x.일)) : [];
        if (반대.length > 1) 문제.들기쉬운일.push(`${s.간지} 반대쪽 일이 ${반대.length}개`);
        if (/열리는/.test(첫) && g.득.length && !g.득.includes(할[0] && 할[0].일)) 문제.들기쉬운일.push(`${s.간지} 열리는 해인데 살릴 일이 먼저가 아님`);
        if (/조심|지키는/.test(첫) && g.실.length && !g.실.includes(할[0] && 할[0].일)) 문제.들기쉬운일.push(`${s.간지} 조심 해인데 조심할 일이 먼저가 아님`);
        if (/열리는/.test(첫) && g.실.length && !할.some(x => g.실.includes(x.일))) 문제.들기쉬운일.push(`${s.간지} 열리는 해의 꺼리는 일이 빠짐`);
        if (/두드러진/.test(첫) && g.득.length && g.실.length && !(할.some(x => g.득.includes(x.일)) && 할.some(x => g.실.includes(x.일)))) 문제.들기쉬운일.push(`${s.간지} 섞인 해에 한쪽만`);
        const 줄 = SG.브리프줄([s], m, { 성별: 성 }); for (const x of 할) if (!줄.includes(x.일)) 문제.들기쉬운일.push(`${s.간지} 브리프줄에 화면 일 없음`); }
      if (g.득.length && !(H.값(GAN[s.천간].ohaeng) > 0 || H.값(GAN[require('../jijanggan').jeonggi(s.지지)].ohaeng) > 0)) 문제.들기쉬운일.push(`득인데 반기는 글자 없음 ${s.간지}`); } } }
// k) 지나온 해 물음(44차, 사용자 「지난 10년 뭘 조심해야 했어라고 물었는데 엉뚱한 대답」) — 물음 감지, 브리프 뼈대가 지나온 해로, 앞날 해 고르기 줄 없음,
//    엔진 답의 표 = 지나온 해·첫말 = seun.지나온해, 검사 오류 0, 앞날 표면 「지나온 해 물음」 오류, 앞날 물음은 그대로
문제.지나온물음 = [];
{ const U = require('../mureum'), M = require('../mundap'), D = require('../dapgeomsa'), S = require('../seun'), I = require('../interpret');
  for (const [q, 기대] of [['지난 10년 뭘 조심해야 했어', 10], ['작년엔 어땠어?', 1], ['지난 5년 돌아보면 어땠나요', 5], ['그동안 뭘 조심했어야 했나요', 10], ['지난번에 물은 이직 다시', null], ['내년 이직 어때', null], ['언제 결혼할까', null]]) {
    const x = U.지난물음(q); if ((x ? x.해수 : null) !== 기대) 문제.지나온물음.push(`감지 「${q}」 ${x && x.해수} ≠ ${기대}`); }
  const 첫 = { '결이 크게 살아남': '크게 열리는 해', '결이 살아남': '열리는 해', '뒤섞임': '두드러진 일이 적은 해', '결이 눌림': '지키는 해', '결이 크게 눌림': '크게 조심할 해' };
  for (let i = 0; i < 12; i++) { const 성 = i % 2 ? '여' : '남', 년 = 1950 + Math.floor(rnd() * 50);
    let r; try { r = I.생년월일시로({ 년, 월: 1 + Math.floor(rnd() * 12), 일: 1 + Math.floor(rnd() * 28), 시: Math.floor(rnd() * 24), 분: 0, 성별: 성 }); } catch (e) { continue; }
    const q = '지난 10년 뭘 조심해야 했어', b = M.toMundapBrief(r, { 질문: q, 성별: 성, 출생연도: 년 });
    if (!/\[해마다 표 뼈대 — 지나온 해\(/.test(b)) { 문제.지나온물음.push(`${년} 뼈대가 지나온 해 아님`); continue; }
    if (/\[물음에 맞춘 해|\[해마다 들기 쉬운 일/.test(b)) 문제.지나온물음.push(`${년} 앞날 고르기 줄이 남음`);
    const a = U.엔진답(r, q, { 성별: 성, 출생연도: 년 }); if (!a) { 문제.지나온물음.push(`${년} 엔진 답 없음`); continue; }
    const 지 = S.지나온해(r, 년, { 최대: 10 });
    for (const m of a.matchAll(/^\| (\d{4})년\([^)]*\) \| ([^.]+)\./gm)) { const p = 지.find(z => z.연도 === +m[1]); if (!p || 첫[p.길흉.판정] !== m[2]) 문제.지나온물음.push(`${년} ${m[1]} 첫말 ${m[2]} ≠ ${p && 첫[p.길흉.판정]}`); }
    const o = D.검사(a, { 모드: '상담', 브리프: b }); if ((o.오류 || []).length) 문제.지나온물음.push(`${년} 엔진 답 오류 ${o.오류.map(e => e.규칙).join(',')}`);
    const 미래 = a.replace(/(\| 해 \|[^\n]*\n\|---\|---\|\n)[\s\S]*?\n\n/, `$1| ${r.단계11b_세운[0].연도}년(${r.단계11b_세운[0].간지}) | ${첫[r.단계11b_세운[0].길흉.판정]}. 앞날. |\n\n`);
    if (!(D.검사(미래, { 모드: '상담', 브리프: b }).오류 || []).some(e => e.규칙 === '지나온 해 물음')) 문제.지나온물음.push(`${년} 앞날 표가 안 걸림`);
    // 배포 답의 세 빈틈(이번 달 줄·다른 기간·해 볼 만한 일에 해마다 줄 없음)이 걸리는가, 다시 쓰기 요청에 지나온 재료가 실리는가
    { const 범 = b.match(/지나온 해\((\d{4})~(\d{4})년\)/); const 틈 = a.replace(/(\| \d{4}년[^\n]*\n)(\n)/, `$1| 이번 달(10월) | 지키는 달. |\n$2`).replace('▶ 쉽게 풀어 보면\n', `▶ 쉽게 풀어 보면\n지난 10년(${+범[1] - 2}~${+범[2] - 2}년)을 봅니다.\n`).replace(/(▶ 해 볼 만한 일\n)[\s\S]*?(\n정리하면)/, '$1앞으로 조심하세요.$2');
      const 걸 = (D.검사(틈, { 모드: '상담', 브리프: b }).오류 || []).filter(e => e.규칙 === '지나온 해 물음').length; if (걸 < 3) 문제.지나온물음.push(`${년} 세 빈틈 중 ${걸}개만 걸림`);
      const p = require('../gemini').섹션다시쓰기프롬프트(틈, [{ 규칙: '지나온 해 물음', 내용: '' }], { 브리프: b, 모드: '상담' }); if (!p.includes('[지나온 해 — 무엇을')) 문제.지나온물음.push(`${년} 다시 쓰기에 지나온 재료 없음`); }
    const b2 = M.toMundapBrief(r, { 질문: '내년 이직 어때', 성별: 성, 출생연도: 년 }); if (/지나온 해\(/.test(b2.split('\n').find(l => l.startsWith('[해마다 표 뼈대')) || '')) 문제.지나온물음.push(`${년} 앞날 물음에 지나온 뼈대`); } }
// l) 날짜가 정해진 시험(47차, 사용자 「올해 수능 잘 볼까 물어 보면 양력 11월달의 인의 운세를 알려주면 되지」) — 수능 → 공부·시험 갈래, 11월 달 셈(섞임 없이 가름), 그해 배움 글자 줄, 브리프 지시, 엔진 답 한 줄에 수능 달, 검사 오류 0, 「…일어납니다」 단정은 걸림
문제.수능 = [];
{ const U = require('../mureum'), D = require('../dapgeomsa'), I = require('../interpret');
  if (U.갈래of('올해 수능 잘 볼까?').갈래 !== '공부·시험') 문제.수능.push('갈래가 공부·시험이 아님');
  for (let i = 0; i < 8; i++) { const 년 = 1990 + Math.floor(rnd() * 20); let r; try { r = I.생년월일시로({ 년, 월: 1 + Math.floor(rnd() * 12), 일: 1 + Math.floor(rnd() * 28), 시: Math.floor(rnd() * 24), 분: 0, 성별: i % 2 ? '여' : '남' }); } catch (e) { continue; }
    const 셈 = U.물음셈(r, '올해 수능 잘 볼까?', { 출생연도: 년 }); if (!셈 || !셈.때.시험) { 문제.수능.push(`${년} 시험 때 없음`); continue; }
    const 달줄 = 셈.줄.find(z => /^\d{4}년 11월\(/.test(z)); if (!달줄) 문제.수능.push(`${년} 11월 줄 없음`); else if (/섞임/.test(달줄)) 문제.수능.push(`${년} 11월이 섞임`);
    if (!셈.줄.some(z => z.startsWith('[수능'))) 문제.수능.push(`${년} 배움 글자 줄 없음`);
    if (!/수능\(\d{4}년 양력 11월\)을 물으셨으니/.test(U.브리프줄(r, '올해 수능 잘 볼까?', { 출생연도: 년 }))) 문제.수능.push(`${년} 브리프 지시 없음`);
    const a = U.엔진답(r, '올해 수능 잘 볼까?', { 출생연도: 년 }); if (!/수능이 든 11월/.test(a || '')) 문제.수능.push(`${년} 엔진 답에 수능 달 없음`);
    const o = D.검사(a || '', { 모드: '상담' }); if ((o.오류 || []).length) 문제.수능.push(`${년} 엔진 답 오류 ${o.오류.map(e => e.규칙)}`); }
  if (!(D.검사('합격하여 자리를 잡는 일은 2027년에 일어납니다.', {}).오류 || []).some(e => e.규칙 === '사건 단정')) 문제.수능.push('「…일어납니다」 단정이 안 걸림'); }
// m) 직업 결 맞댐·시기(48차, docs/PROMPTS.md 11·12) — 낱말 겹침 없음, 세 책 결과가 다 있고 점수 합산 필드가 없음, 좋은해 = 글자 옴(반김) ∩ 열리는 해, 달은 그 해의 월운, 브리프 지시·시험 달, 엔진 답 오류 0, 물상·순위 말은 걸림
문제.직업 = [];
{ const J = require('../jikeop'), U = require('../mureum'), D = require('../dapgeomsa'), I = require('../interpret'), M = require('../mundap');
  for (const a of J.직업표) for (const b of J.직업표) if (a !== b && a.낱말.source === b.낱말.source) 문제.직업.push(`낱말 같음 ${a.이름}/${b.이름}`);
  for (const [q, 기대] of [['공무원 준비하는 게 맞을까', '공무원(행정·일반직)'], ['경찰 시험 볼까', '경찰·소방·군'], ['유튜버 해도 될까', '유튜버·크리에이터'], ['연구원이 맞나요', '연구원·대학원']]) { const g = J.고르기(q); if (!g || g.직업들[0].이름 !== 기대) 문제.직업.push(`고르기 「${q}」 → ${g && g.직업들[0].이름}`); }
  if (!J.고르기('나한테 맞는 직업은?').전체) 문제.직업.push('적성 전체 물음이 전체가 아님');
  if (J.고르기('내년 운세 어때')) 문제.직업.push('직업 없는 물음이 걸림');
  for (let i = 0; i < 20; i++) { const 년 = 1975 + Math.floor(rnd() * 30); let r; try { r = I.생년월일시로({ 년, 월: 1 + Math.floor(rnd() * 12), 일: 1 + Math.floor(rnd() * 28), 시: Math.floor(rnd() * 24), 분: 0, 성별: i % 2 ? '여' : '남' }); } catch (e) { continue; }
    for (const j of J.직업표) { const x = J.맞댐(r, j); if (!x.자평 || !x.적천수 || '점수' in x || '합' in x) 문제.직업.push(`${년} ${j.이름} 맞댐 모양`);
      const t = J.시기(r, j, {}); for (const h of t.좋은해) { const s = r.단계11b_세운.find(z => z.연도 === h.연도); if (!/열리는/.test(h.첫말) || !h.옴.length || !s) 문제.직업.push(`${년} ${j.이름} ${h.연도} 좋은해 조건`); } }
    if (i < 6) for (const q of ['공무원 시험 준비하는 게 나한테 맞을까?', '경찰 시험 2027년에 볼까?', '유튜브 시작하기 좋은 때는?']) {
      const a = U.엔진답(r, q, { 출생연도: 년 }); const o = D.검사(a || '', { 모드: '상담' }); if ((o.오류 || []).length) 문제.직업.push(`${년} 「${q}」 엔진 답 오류 ${o.오류.map(e => e.규칙)}`);
      const b = M.toMundapBrief(r, { 질문: q, 출생연도: 년 }); if (!b.includes('[직업 결 맞댐')) 문제.직업.push(`${년} 브리프에 직업 줄 없음`);
      if (/시험/.test(q) && !/\[(국가직|경찰)[^\]]*양력 \d+월\]/.test(b)) 문제.직업.push(`${년} 시험 달 줄 없음 「${q}」`); } }
  for (const t of ['IT는 불의 기운에 속하는 직업입니다.', '공무원이 1순위 직업입니다.']) if (!(D.검사(t, {}).오류 || []).some(e => /직업/.test(e.규칙))) 문제.직업.push(`안 걸림: ${t}`);
  if ((D.검사('경찰은 이 명식과 맞닿는 일입니다.', {}).오류 || []).some(e => /직업/.test(e.규칙))) 문제.직업.push('맞댐 문장이 걸림'); }
let 실패 = 0;
for (const [k, v] of Object.entries(문제)) { console.log(`  ${v.length ? '실패' : '통과'}  ${k} ${v.length}건${v.length ? ' — ' + v.slice(0,3).join(' / ') : ''}`); if (v.length) 실패++; }
console.log(`  [두 읽기 뒤집힘 표 — 사실 보고] 대운 ${표.대운수}개: 천간5↔지지5 갈림 ${표.갈림} · 통합↔천간5 어긋남 ${표.통합vs천간5} · 통합↔지지5 어긋남 ${표.통합vs지지5} · 모두 같은 결 ${표.모두같음} · 갈림이 하나라도 있는 명식 ${표.갈린명식}/${N - 예외} · 판정 보류(상신 미지정) 대운 ${표.보류}`);
console.log(`  [국 키 hit] ` + 국키전체.map(k => `${k}:${국hit[k] ?? 0}`).join(' ') + (국키전체.some(k => !국hit[k]) ? `  — 안 걸린 키: ${국키전체.filter(k => !국hit[k]).join(', ')}` : '  — 전부 도달'));
console.log(`무작위 ${N}건 · 문제 항목 ${실패}`);
if (실패) process.exit(1);
