/**
 * verify_all.js — 전체 검증 한 번에
 * 사주팔자집 (2026-08-02)
 *
 * 지금까지 검증이 여러 스크립트로 흩어져 있어 무엇을 돌렸는지 헷갈렸다.
 * 코드를 고친 뒤에는 이것 하나만 돌리면 된다.
 *
 *   node verify_all.js          기본 (부록 78건 + 린트 + 전수 표본)
 *   node verify_all.js --full   전수 518,400건까지 (약 100초)
 */
const { judge, JOMUN } = require('./gyeokguk');
const { interpret } = require('./interpret');
const { render } = require('./haeseol');
const { lint, lintHyungdan, lintDeunggeup } = require('./sinsal');
const { FIXTURES } = require('./fixtures_zpjz');
const { OEGYEOK } = require('./fixtures_oegyeok');

const FULL = process.argv.includes('--full');
let 실패 = 0;
const 줄 = (ok, 이름, 값) => {
  if (!ok) 실패++;
  console.log(`  ${ok ? '✓' : '✗'} ${이름.padEnd(30)} ${값}`);
};

console.log('\n═══ 사주팔자집 자평진전 엔진 · 전체 검증 ═══\n');

// ── 1. 조문 무결성 ──────────────────────────────
console.log('[1] 조문');
{
  const seen = {}, dup = [];
  for (const j of JOMUN) { if (seen[j.id]) dup.push(j.id); seen[j.id] = 1; }
  줄(dup.length === 0, 'id 중복', dup.length ? [...new Set(dup)].join(',') : `없음 (총 ${JOMUN.length}개)`);
  const 해설없음 = JOMUN.filter(j => !j.해설키 && !j.기본).map(j => j.id);
  줄(해설없음.length === 0, '해설키 누락', 해설없음.length ? 해설없음.slice(0,3).join(',') : '없음');
  const 원문없음 = JOMUN.filter(j => !j.원문).map(j => j.id);
  줄(원문없음.length === 0, '원문 인용 누락', 원문없음.length ? 원문없음.slice(0,3).join(',') : '없음');
}

// ── 2. 부록 78건 ────────────────────────────────
console.log('\n[2] 附集原書命例 78건');
{
  // 부록은 격을 묶어 적는다(재=정재·편재, 인=정인·편인). verify_full.js와 같은 격군을 쓴다.
  const 격군 = { 정관:['정관'], 재:['정재','편재'], 인:['정인','편인'],
                식신:['식신'], 편관:['편관'], 상관:['상관'], 양인:['양인'], 건록:['건록'] };
  const 貴 = ['성격','패중유성','성중유패','인패득성'];
  let 격일치 = 0, 성패일치 = 0, 폴백 = 0, 상신없음 = 0;
  for (const f of FIXTURES) {
    const r = judge(f.m);
    if ((격군[f.격] ?? [f.격]).includes(r.격)) 격일치++;
    if (貴.includes(r.결론)) 성패일치++;
    if (r.상신폴백) 폴백++;
    if (!r.상신) 상신없음++;
  }
  줄(격일치 >= 77, '격 취용', `${격일치}/78`);
  줄(성패일치 === 78, '성격류', `${성패일치}/78`);
  줄(폴백 === 0, '상신 폴백 발동', `${폴백}건`);
  줄(true, '상신 없음(孤官無輔)', `${상신없음}건`);
}

// ── 3. 부록평 대조 (저자가 붙인 정답 라벨) ────────
console.log('\n[3] 부록평 대조');
{
  const 정답 = { 잡기정관:null, 楊侍郎:'식신', '무명(재인상생)':'정인', 汪學士:'상관',
    林尚書:'정관', 王太僕:'재', 茅狀元:'편관', 孫布政:'편관',
    牛監簿:'식신', 錢參政:'정인', 劉提督:'식신' };
  let 맞 = 0, 전 = 0;
  for (const f of FIXTURES) {
    if (!(f.이름 in 정답)) continue;
    전++;
    const 정 = 정답[f.이름], 현 = judge(f.m).상신;
    if (정 === null ? !현 : (현 === 정 || (정 === '재' && ['정재','편재'].includes(현)))) 맞++;
  }
  줄(맞 === 전, '본편 명시 상신', `${맞}/${전}`);
}

// ── 4. 외격 관문 (22편) ─────────────────────────
console.log('\n[4] 22편 외격 관문');
{
  let 정격누출 = 0;
  for (const f of FIXTURES) if (interpret(f.m).단계22_외격.외격검토가능) 정격누출++;
  const 잡격통과 = OEGYEOK.filter(f => interpret(f.m).단계22_외격.외격검토가능).length;
  줄(정격누출 <= 5, '정격이 외격으로 새는 것', `${정격누출}건 (건록·양인이면 정상)`);
  줄(true, '잡격 13건 중 검토 가능', `${잡격통과}건 (원전 내적 긴장으로 5건이 정상)`);
}

// ── 5. 27편 준수 ────────────────────────────────
console.log('\n[5] 27편 간지 구별 준수');
{
  const { audit } = require('./ganji');
  const r = audit(judge);
  줄(r.every(x => x.통과), '지지는 혼잡·견관을 일으키지 않는다', `${r.filter(x=>x.통과).length}/${r.length}`);
}

// ── 6. 출력 가드 ────────────────────────────────
console.log('\n[6] 출력 가드');
{
  let 예외 = 0, 신살 = 0, 흉단 = 0, 등급 = 0, 소수점 = 0, 길이 = 0;
  for (const f of FIXTURES) {
    try {
      const t = render(interpret(f.m, { 세운시작: 2026, 세운개수: 2 }), { 세운수: 2 });
      길이 += t.length;
      if (!lint(t).통과) 신살++;
      if (!lintHyungdan(t).통과) 흉단++;
      if (!lintDeunggeup(t).통과) 등급++;
      if (/0\.\d{2,3}(?![0-9%])/.test(t)) 소수점++;
    } catch (e) { 예외++; }
  }
  줄(예외 === 0, '렌더 예외', `${예외}건`);
  줄(신살 === 0, '신살·여명 속설 (21편)', `${신살}건`);
  줄(흉단 === 0, '배우자·자녀·수명 흉단 (24편)', `${흉단}건`);
  줄(등급 === 0, '사람에게 매기는 등급어', `${등급}건`);
  줄(소수점 === 0, '내부 점수 노출', `${소수점}건`);
  줄(true, '리포트 평균 길이', `${Math.round(길이/78)}자`);
}

// ── 7. 30편 자기점검 ────────────────────────────
console.log('\n[7] 30편 자기점검');
{
  const { 자기점검 } = require('./ohjeon');
  const 미대응 = 자기점검.filter(x => x.상태 !== '대응함');
  줄(미대응.length === 0, '원문이 든 여섯 오류', `${자기점검.length - 미대응.length}/${자기점검.length} 대응`);
}

// ── 8. 취운 대조 상태 ───────────────────────────
console.log('\n[8] 취운');
{
  const { 대조상태 } = require('./chwiun');
  const 부분 = Object.entries(대조상태).filter(([, v]) => v !== '전문').map(([k]) => k);
  줄(부분.length === 0, '10격 전문 대조', 부분.length ? '부분: ' + 부분.join(',') : '전부 전문');
  let 미적용 = 0;
  for (const f of FIXTURES) if (!interpret(f.m).단계11_행운.취운조문) 미적용++;
  줄(미적용 <= 2, '부록 78건 조문 적용', `미적용 ${미적용}건`);
}

// ── 9. 전수 검사 ────────────────────────────────
console.log(`\n[9] 전수 검사 ${FULL ? '(전량)' : '(표본 1/7)'}`);
{
  const { 전수, 검사_방향 } = require('./stress_test');
  const a = 검사_방향();
  줄(a.위반.length === 0, '대운 순행역행 (년간×성별 120)', a.위반.length ? a.위반[0] : JSON.stringify(a.매핑));

  const 간격 = FULL ? 1 : 7;
  const d = {}; let n = 0, i = 0, 예외 = 0;
  const t0 = Date.now();
  for (const m of 전수()) {
    if (i++ % 간격) continue;
    try { d[judge(m).결론] = (d[judge(m).결론] ?? 0) + 1; n++; } catch { 예외++; }
  }
  줄(예외 === 0, '격 취용 예외', `${예외}건 / ${n.toLocaleString()}건 검사 (${((Date.now()-t0)/1000).toFixed(1)}초)`);
  const 미성립 = (d['미성립'] ?? 0) / n * 100;
  줄(미성립 < 10, '미성립 비율', `${미성립.toFixed(1)}% (역용격에 제복이 없는 경우로 원문상 정당)`);
}

// ── 10. LLM 출력 검사기 ─────────────────────────
console.log('\n[10] LLM 출력 검사기 (Gemini 브리지)');
{
  const { validate } = require('./gemini');
  const r = interpret(FIXTURES[0].m);
  const 표본 = [
    ['정상 문장', '월령이 정관이라 규범이 중심에 놓인 구조입니다.', true],
    ['신살 섞임', '도화가 있어 인기가 많은 구조입니다.', false],
    ['흉단 섞임', '배우자와 해로하기 어려운 구조입니다.', false],
    ['등급어', '이 명식은 상격에 속합니다.', false],
    ['지어낸 십성', '양인이 강하게 서 있습니다.', false],
    ['개수로 품행 재기', '관성이 많으니 품행을 조심하셔야 합니다.', false],
  ];
  let ok = 0;
  for (const [, t, 기대] of 표본) if (validate(t, r).통과 === 기대) ok++;
  줄(ok === 표본.length, 'LLM 출력 차단 (6케이스)', `${ok}/${표본.length}`);
}

// ── 11. 주제별 재료 ─────────────────────────────
console.log('\n[11] 주제별 재료 (juje.js)');
{
  const { 주제표, analyze: 주제 } = require('./juje');
  let 예외 = 0, 재료있음 = 0, 전체 = 0;
  for (const f of FIXTURES) {
    try {
      const t = 주제(interpret(f.m, { 세운시작: 2026, 세운개수: 3 }));
      for (const k of Object.keys(주제표)) { 전체++; if (t[k].재료있음) 재료있음++; }
    } catch (e) { 예외++; }
  }
  줄(예외 === 0, '78건 × 7주제 추출', `예외 ${예외}건`);
  줄(true, '재료가 있는 주제 비율', `${(재료있음/전체*100).toFixed(0)}% (없으면 없다고 말하게 한다)`);
  const 무게 = Object.values(주제표).reduce((a,t)=>{a[t.무게]=(a[t.무게]??0)+1;return a;},{});
  줄(true, '근거 무게 분포', JSON.stringify(무게));
}

// ── 12. 오행 방위·시기별 결 ─────────────────────
console.log('\n[12] 오행·시기별 결 (ohaeng.js)');
{
  const { analyze: 오행, toBrief } = require('./ohaeng');
  const { validate } = require('./gemini');
  let 예외 = 0, 결있음 = 0, 전체 = 0;
  for (const f of FIXTURES) {
    try {
      const r = interpret(f.m, { 세운시작: 2026, 세운개수: 3 });
      const t = 오행(r);
      전체 += t.대운결.length;
      결있음 += t.대운결.filter(x => x.결).length;
    } catch (e) { 예외++; }
  }
  줄(예외 === 0, '78건 추출', `예외 ${예외}건`);
  줄(결있음 / 전체 > 0.9, '대운마다 결이 붙는 비율', `${(결있음/전체*100).toFixed(0)}%`);
  // 브리프가 스스로 가드를 어기지 않는지
  const b = toBrief(interpret(FIXTURES[0].m));
  const v = validate(b, null, { 한자검사: false, 반복검사: false });
  줄(v.통과, '브리프 자체가 가드 통과', v.통과 ? '통과' : v.문제.map(p=>p.검출.join(',')).join('/'));
  const { 안한것 } = 오행(interpret(FIXTURES[0].m));
  줄(/신체|질병/.test(안한것), '몸·질병 분류 배제 명시', '명시됨');
}

// ── 13. 물상 대입 (희기 통과 여부) ───────────────
console.log('\n[13] 십성 물상 (mulsang.js)');
{
  const { analyze: 물상 } = require('./mulsang');
  const { toBrief } = require('./mulsang');
  const { validate } = require('./gemini');
  let 예외 = 0, 기신뒤집힘 = 0, 기신전체 = 0;
  for (const f of FIXTURES) {
    try {
      for (const x of 물상(interpret(f.m))) {
        if (x.희기 === '기신') {
          기신전체++;
          if (/덜어내는 쪽/.test(x.방향)) 기신뒤집힘++;
        }
      }
    } catch (e) { 예외++; }
  }
  줄(예외 === 0, '78건 대입', `예외 ${예외}건`);
  줄(기신뒤집힘 === 기신전체 && 기신전체 > 0,
     '기신 물상이 권유로 안 나감', `${기신뒤집힘}/${기신전체} 뒤집힘`);
  const v = validate(toBrief(interpret(FIXTURES[0].m)), null, { 한자검사: false, 반복검사: false });
  줄(v.통과, '브리프 자체가 가드 통과', v.통과 ? '통과' : v.문제.map(p=>p.검출.join(',')).join('/'));
}

// ── 14. 쉬운 말 / 한자 검사 ─────────────────────
console.log('\n[14] 쉬운 말 (yongeo.js)');
{
  const { lintHanja, 용어안내, 용어추출 } = require('./yongeo');
  const { toLLMBrief } = require('./haeseol');
  const 표본 = [
    ['우리말로 푼 글', '태어난 달이 준 중심은 만들어 내보내는 힘(식신)입니다.', true],
    ['간지 표기', '55세부터 辛卯 흐름에 들어섭니다.', true],
    ['원문 인용', '원문이 「棄食就煞而透印」이라 한 자리입니다.', false],
    ['한자어 남발', '身弱한 日干이 月令의 食神을 用하나 梟神이 奪食합니다.', false],
  ];
  let ok = 0;
  for (const [, t, 기대] of 표본) if (lintHanja(t).통과 === 기대) ok++;
  줄(ok === 표본.length, '한자·원문 인용 차단', `${ok}/${표본.length}`);
  // 브리프에 용어 안내가 붙는가
  const b = toLLMBrief(interpret(FIXTURES[0].m));
  줄(b.includes('용어를 이렇게 풀어 쓰세요'), '브리프에 쉬운 말 안내', '붙음');
  줄(b.includes('원문 한문을 답에 옮기지 마세요'), '한문 금지 규칙', '있음');
}

// ── 15. 「언제」 물음 (sigi.js) ──────────────────
console.log('\n[15] 「언제」 물음 (sigi.js)');
{
  const { 물음표, analyze: 시기, toBrief } = require('./sigi');
  const { validate } = require('./gemini');
  let 예외 = 0;
  for (const f of FIXTURES) {
    try {
      const r = interpret(f.m, { 세운시작: 2026, 세운개수: 5 });
      for (const k of Object.keys(물음표)) 시기(r, k);
    } catch (e) { 예외++; }
  }
  줄(예외 === 0, `78건 × ${Object.keys(물음표).length}물음`, `예외 ${예외}건`);
  // 시점 예언을 막는 문구가 모든 브리프에 있는가
  const r0 = interpret(FIXTURES[0].m, { 세운시작: 2026, 세운개수: 5 });
  const 전부 = Object.keys(물음표).map(k => toBrief(r0, k));
  const 못박기금지 = 전부.every(b => b.includes('라고 쓰지 마세요'));
  줄(못박기금지, '시점 못박기 금지 문구', '전 물음에 있음');
  // 상대·시장이 있는 일에는 단서가 붙는가
  const 결혼 = toBrief(r0, '결혼'), 집 = toBrief(r0, '집');
  줄(결혼.includes('상대가 있는 일') && 집.includes('시장이 있는 일'),
     '혼인·부동산 단서', '붙음');
  줄(집.includes('원문은 부동산을 다루지 않는다'), '원문 밖임을 밝힘', '명시');
  // 「언제」만이 아니라 「어떤 쪽」도 나오는가
  const 일보임 = ['취직','재물','독립','공부'].filter(k => 시기(r0, k)?.어떤쪽?.맞물리는쪽?.length);
  줄(일보임.length === 4, '「어떤 쪽」이 함께 나옴', `${일보임.length}/4 물음`);
  줄(전부.some(b => b.includes('「언제」만 답하지 말고')), '어떤 쪽 말하기 지시', '있음');
  const v = validate(전부.join('\n'), null, { 한자검사: false, 반복검사: false });
  줄(v.통과, '브리프 자체가 가드 통과', v.통과 ? '통과' : v.문제.map(p=>p.검출.join(',')).join('/'));
}

// ── 16. 오늘의 일 (jikeop.js) ───────────────────
console.log('\n[16] 오늘의 일 (jikeop.js)');
{
  const { 찾기, 맞물림, 닿는일, toBrief } = require('./jikeop');
  const { validate } = require('./gemini');
  const 물음 = ['택배', '벤처', '개발자', '유튜버', '공무원', '간호', '주식', '식당'];
  const 찾음 = 물음.filter(q => 찾기(q));
  줄(찾음.length === 물음.length, '오늘의 말로 찾기', `${찾음.length}/${물음.length}`);

  let 예외 = 0, 판정어 = 0;
  for (const f of FIXTURES) {
    try {
      const r = interpret(f.m);
      닿는일(r);
      for (const q of 물음) {
        // **금지 문구가 들어 있는 '쓰는 법' 단은 검사에서 뺀다.**
        // 거기엔 금지어가 예시로 들어갈 수밖에 없어 오탐이 난다(21·24·28편에서 겪은 것과 같은 함정)
        const b = toBrief(r, q).split('쓰는 법:')[0];
        if (/이 직업이 맞|천직|적성에 맞지 않/.test(b)) 판정어++;
      }
    } catch (e) { 예외++; }
  }
  줄(예외 === 0, `78건 × ${물음.length}물음`, `예외 ${예외}건`);
  줄(판정어 === 0, '직업 맞다/안맞다 단정 없음', `${판정어}건`);

  const b = toBrief(interpret(FIXTURES[0].m), '택배');
  줄(b.includes('맞다/안 맞다') && b.includes('흔들기'), '「안 맞는다」 금지 문구', '있음');
  // 갈래를 짚는가 — 「이 일이 어떻다」로 끝나면 앱이 쓸 답이 안 된다
  const { 일: 일표 } = require('./jikeop');
  const 갈래없음 = Object.entries(일표).filter(([, v]) =>
    !v.갈래 || Object.keys(v.갈래).length !== v.결.length).map(([k]) => k);
  줄(갈래없음.length === 0, '일마다 결별 갈래', 갈래없음.length ? 갈래없음.join(',') : `${Object.keys(일표).length}종 전부`);
  const m = 맞물림(interpret(FIXTURES[0].m), '벤처');
  줄(typeof m.취운근거 === 'string' || m.취운근거 === null, '취운 조문 문자열', typeof m.취운근거);
  줄(b.includes('갈래를 반드시 짚어'), '갈래 짚기 지시', '있음');
  const v = validate(b, null, { 한자검사: false, 반복검사: false });
  줄(v.통과, '브리프 자체가 가드 통과', v.통과 ? '통과' : v.문제.map(p=>p.검출.join(',')).join('/'));
}

// ── 17. 관성 변화 (gwanbyeon.js) ────────────────
console.log('\n[17] 관성 변화 (gwanbyeon.js)');
{
  const { analyze: 관변, toBrief } = require('./gwanbyeon');
  const { validate } = require('./gemini');
  let 예외 = 0, 사건있음 = 0;
  for (const f of FIXTURES) {
    try {
      const t = 관변(interpret(f.m, { 세운시작: 2026, 세운개수: 5 }));
      if (t.사건.length) 사건있음++;
    } catch (e) { 예외++; }
  }
  줄(예외 === 0, '78건 추출', `예외 ${예외}건`);
  줄(사건있음 > 0, '변화가 잡히는 명식', `${사건있음}/78`);

  const b = toBrief(interpret(FIXTURES[0].m, { 세운시작: 2026, 세운개수: 5 }));
  줄(b.includes('남편으로 읽지 마세요'), '여명 관=남편 금지', '있음');
  줄(b.includes('다른 사람의 마음·행실·외도'), '상대 행실 금지', '있음');
  줄(b.includes('정하지 마세요'), '영역 단정 금지', '있음');
  const v = validate(b, null, { 한자검사: false, 반복검사: false });
  줄(v.통과, '브리프 자체가 가드 통과', v.통과 ? '통과' : v.문제.map(p=>p.검출.join(',')).join('/'));
}

// ── 18. 오행 물상 (mulsang5.js) ─────────────────
console.log('\n[18] 오행 물상 (mulsang5.js)');
{
  const { 오행물상, analyze: 오행, toBrief } = require('./mulsang5');
  const { validate } = require('./gemini');
  const 필드 = ['자리','몸','먹는것','결','일','빛깔'];
  const 빠진 = Object.entries(오행물상).filter(([, v]) => 필드.some(f => !v[f])).map(([k]) => k);
  줄(빠진.length === 0, '오행 5종 항목 갖춤', 빠진.length ? 빠진.join(',') : `${필드.length}항목 × 5행`);
  // 출처가 모두 적혀 있는가
  const 출처없음 = Object.entries(오행물상).filter(([, v]) =>
    ['자리','몸','먹는것','결','일'].some(f => !v[f].출처)).map(([k]) => k);
  줄(출처없음.length === 0, '항목마다 출처 표시', 출처없음.length ? 출처없음.join(',') : '전부 있음');

  let 예외 = 0, 치우침있음 = 0;
  for (const f of FIXTURES) {
    try { const t = 오행(interpret(f.m)); if (t.살필것.length) 치우침있음++; }
    catch (e) { 예외++; }
  }
  줄(예외 === 0, '78건 치우침 계산', `예외 ${예외}건`);
  줄(치우침있음 > 0, '치우침이 잡히는 명식', `${치우침있음}/78`);

  const b = toBrief(interpret(FIXTURES[0].m));
  줄(b.includes('살펴두시라') && b.includes('진단하지 마세요'), '몸 — 살피기까지만', '있음');
  줄(b.includes('의사에게 보이시는 것이 먼저'), '의사 우선 문구', '있음');
  줄(b.includes('격에서 그것이 반기는 것인지'), '희기가 먼저', '있음');
  const v = validate(b, null, { 한자검사: false, 반복검사: false });
  줄(v.통과, '브리프 자체가 가드 통과', v.통과 ? '통과' : v.문제.map(p=>p.검출.join(',')).join('/'));
}

// ── 19. 십성×오행 격자 (gyeokja.js) ─────────────
console.log('\n[19] 십성×오행 격자 (gyeokja.js)');
{
  const { 곱하기, analyze: 격자, toBrief } = require('./gyeokja');
  const { validate } = require('./gemini');
  const 십성 = ['비견','겁재','식신','상관','정재','편재','정관','편관','정인','편인'];
  const 오행 = ['木','火','土','金','水'];
  let 빈칸 = 0, 중복이름 = new Set(), 전체 = 0;
  for (const s of 십성) for (const o of 오행) {
    const v = 곱하기(s, o); 전체++;
    if (!v || !v.이름 || !v.풀이)빈칸++; else 중복이름.add(v.이름);
  }
  줄(빈칸 === 0, '50칸 전부 채워짐', `${전체 - 빈칸}/${전체}`);
  줄(중복이름.size === 전체, '칸마다 이름이 다름', `${중복이름.size}/${전체}`);

  let 예외 = 0;
  for (const f of FIXTURES) { try { 격자(interpret(f.m)); } catch (e) { 예외++; } }
  줄(예외 === 0, '78건 격자 적용', `예외 ${예외}건`);

  const b = toBrief(interpret(FIXTURES[0].m));
  줄(b.includes('격은 개수로 정하지 않습니다'), '개수로 격 정하기 금지', '있음');
  줄(b.includes('오행의 성질을 함께'), '오행 성질 함께 말하기', '있음');
  const v = validate(b, null, { 한자검사: false, 반복검사: false });
  줄(v.통과, '브리프 자체가 가드 통과', v.통과 ? '통과' : v.문제.map(p=>p.검출.join(',')).join('/'));
}

// ── 20. 국의 비유 (gukmyeong.js) ────────────────
console.log('\n[20] 국의 비유');
{
  const { 국명 } = require('./gukmyeong');
  const { toLLMBrief } = require('./haeseol');
  const 없음 = Object.entries(국명).filter(([, v]) => !v.비유 || !v.비유설명).map(([k]) => k);
  줄(없음.length === 0, '국마다 오늘의 비유', 없음.length ? 없음.join(',') : `${Object.keys(국명).length}종 전부`);
  const 중복 = new Set(Object.values(국명).map(v => v.비유));
  줄(중복.size === Object.keys(국명).length, '비유가 서로 다름', `${중복.size}/${Object.keys(국명).length}`);
  const b = toLLMBrief(interpret(FIXTURES[0].m));
  줄(b.includes('오늘의 말로'), '브리프에 비유 실림', '있음');
  줄(b.includes('비유를 살려 쓰세요'), '비유 살리기 지시', '있음');
}

// ── 21. 자리와 간격 (jari.js) ───────────────────
console.log('\n[21] 자리와 간격 (jari.js)');
{
  const { analyze: 자리, 관계, toBrief } = require('./jari');
  const { validate } = require('./gemini');
  // 원문이 갈라놓은 두 사례가 실제로 갈리는가
  const 설 = interpret({ yeonGan:'甲',yeonJi:'申',wolGan:'壬',wolJi:'申',
                        ilGan:'乙',ilJi:'巳',siGan:'戊',siJi:'寅',daysFromJeolip:15 });
  const 무 = interpret({ yeonGan:'乙',yeonJi:'未',wolGan:'己',wolJi:'卯',
                        ilGan:'庚',ilJi:'寅',siGan:'辛',siJi:'巳',daysFromJeolip:15 });
  const 설격리 = 자리(설).상극짝.some(x => x.판정 === '격리');
  const 무붙음 = 자리(무).상극짝.some(x => x.판정 === '붙음');
  줄(설격리, '薛相公 — 격리로 잡힘', '원문 「以乙隔之」 大貴');
  줄(무붙음, '무명 — 붙음으로 잡힘', '원문 「財印相並」 小富');

  let 예외 = 0;
  for (const f of FIXTURES) { try { 자리(interpret(f.m)); } catch (e) { 예외++; } }
  줄(예외 === 0, '78건 자리·간격 읽기', `예외 ${예외}건`);

  const b = toBrief(interpret(FIXTURES[0].m));
  줄(b.includes('사이에 낀 글자가 있으면 반드시'), '격리 짚기 지시', '있음');
  줄(b.includes('자리와 거리로 읽어'), '자리·거리로 읽기 지시', '있음');
  const v = validate(b, null, { 한자검사: false, 반복검사: false });
  줄(v.통과, '브리프 자체가 가드 통과', v.통과 ? '통과' : v.문제.map(p=>p.검출.join(',')).join('/'));
}

// ── 22. 상담 순서와 재료 ────────────────────────
console.log('\n[22] 상담 순서 (브리프)');
{
  const { toLLMBrief } = require('./haeseol');
  const b = toLLMBrief(interpret(FIXTURES[0].m, { 세운시작: 2026, 세운개수: 3 }));
  // 지시 8단계가 다 있는가
  const 단계 = ['나 자신부터', '격이 나온 과정', '그 격의 성질', '떠받치는 글자',
                '이 사람의 글자로 옮기기', '자리와 거리', '합과 충', '언제 오는지'];
  const 빠진지시 = 단계.filter(x => !b.includes(x));
  줄(빠진지시.length === 0, '순서 지시 8단계', 빠진지시.length ? 빠진지시.join(',') : '전부 있음');
  // 그 지시를 따르려면 있어야 할 재료가 실렸는가
  const 재료 = [['여덟 글자', '[여덟 글자]'], ['일간', '[나 자신]'],
                ['지장간·투출', '지지 속에 든 글자'], ['월령 표시', '격은 여기서 나온다'],
                ['합충', '[합과 충]'], ['자리·거리', '[서로 치는 글자]']];
  const 빠진재료 = 재료.filter(([, k]) => !b.includes(k)).map(([n]) => n);
  줄(빠진재료.length === 0, '지시를 따를 재료', 빠진재료.length ? '★없음: ' + 빠진재료.join(',') : '전부 실림');
  줄(b.includes('왜 그렇게 보는지'), '근거 붙이기 지시', '있음');

  let 예외 = 0, 재료없음 = 0;
  for (const f of FIXTURES) {
    try {
      const t = toLLMBrief(interpret(f.m));
      if (!t.includes('[여덟 글자]') || !t.includes('지지 속에 든 글자')) 재료없음++;
    } catch (e) { 예외++; }
  }
  줄(예외 === 0 && 재료없음 === 0, '78건 브리프 생성', `예외 ${예외} / 재료누락 ${재료없음}`);
}

// ── 23. 모듈 selfTest ───────────────────────────
console.log('\n[23] 모듈');
{
  const 목록 = ['jijanggan','tonggeun','hapchung','gyeokguk','sunjap','chwiun','haengun',
    'interpret','schools','haeseol','ingwa','chohu','sangsin','japgi','myogo','seonhu',
    'sinsal','oegyeok','yukchin','cheoja','unchung','unbyeonhwa','ganji','tuchong',
    'sisol','ohjeon','gukmyeong','sangsin_fallback','seun','wolun','jeokcheonsu','gemini','juje','ohaeng','mulsang','yongeo','sigi','jikeop','gwanbyeon','mulsang5','gyeokja','jari'];
  let 실패목록 = [];
  for (const f of 목록) { try { require('./' + f); } catch (e) { 실패목록.push(f); } }
  줄(실패목록.length === 0, '전 모듈 로드', 실패목록.length ? 실패목록.join(',') : `${목록.length}개 정상`);
}

console.log(`\n${'═'.repeat(45)}`);
console.log(실패 === 0 ? '  전부 통과' : `  ⚠ ${실패}개 항목 실패`);
console.log(`${'═'.repeat(45)}\n`);
process.exit(실패 === 0 ? 0 : 1);
