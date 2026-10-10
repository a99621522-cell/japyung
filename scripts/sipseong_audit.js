#!/usr/bin/env node
/**
 * sipseong_audit.js — 십성 배속 전수 감사 (2026-10-10, 52차)
 *
 * 사용자 「다른 일간도 각자의 10성을 년간·월간 제대로 반영하고 있는지 조사하고 고쳐 — 년·월·일 단위로」.
 * 엔진 함수(jijanggan.sipseong)와 따로 세운 기준표(오행 생극·음양)로, 엔진이 내는 모든 글(브리프·문답 브리프·간명서·엔진 답·
 * 해마다/지나온/물음 셈/일진/직업 줄)과 결과 객체(세운·월운·일진·대운)에 나온 「글자 ↔ 십성」 짝을 열 일간 모두에서 대조한다.
 * 모범 답안(일간 己 예시 명식)과 그 주의 줄은 뺀다(51차).
 */
const I = require('../interpret'), H = require('../haeseol');
const 천간 = '甲乙丙丁戊己庚辛壬癸', 지지 = '子丑寅卯辰巳午未申酉戌亥';
const 정기 = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
const 같 = ['비견', '식신', '편재', '편관', '편인'], 다 = ['겁재', '상관', '정재', '정관', '정인'];
// 기준표 — 엔진과 따로: 오행 = 순번/2, 음양 = 순번%2, 관계 = (상대 오행 − 내 오행) mod 5
function 기준(일, g) { if (지지.includes(g)) g = 정기[g]; const a = 천간.indexOf(일), b = 천간.indexOf(g); const d = ((b >> 1) - (a >> 1) + 5) % 5; return ((a & 1) === (b & 1) ? 같 : 다)[d]; }
const 십 = '비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인';
const 짝들 = 글 => require('../dapgeomsa').십성짝들(글);   // 답 검사기와 같은 꼴로 찾고, 대조는 따로 세운 기준표로
function 걷기(o, 일, 길, 틀) {   // 결과 객체: 같은 객체에 글자·십성 칸이 있으면 대조
  if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach((x, i) => 걷기(x, 일, `${길}[${i}]`, 틀)); return; }
  const g = o.gan || o.간 || o.천간 || o.글자, n = o.십성 || o.sipseong || o.ss;
  if (typeof g === 'string' && typeof n === 'string' && g.length === 1 && (천간 + 지지).includes(g) && new RegExp(`^(${십})$`).test(n) && 기준(일, g) !== n) 틀.push(`${길}: ${g}=${n} (기준 ${기준(일, g)})`);
  for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') 걷기(v, 일, `${길}.${k}`, 틀);
}
function 감사(N = 120, 씨 = 7) {
  let s = 씨; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const 함수틀 = []; let sp = null; try { sp = require('../jijanggan').sipseong; } catch (e) {}
  for (const a of 천간) for (const b of 천간) if (sp && sp(a, b) !== 기준(a, b)) 함수틀.push(`${a}→${b}: ${sp(a, b)} (기준 ${기준(a, b)})`);
  const 물음들 = ['올해 운세 어때', '2027년 3월 시험 붙을까', '내일 면접 어때', '이번 주 언제가 좋아', '결혼 언제 할까', '재물운', '지난 10년 뭘 조심해야 했어', '11월 15일 계약 괜찮을까', '공무원 맞을까', '대운 어때'];
  const 틀 = {}, 셈 = { 명식: 0, 짝: 0 }, 일간별 = {};
  const 본것 = new Set();
  const 적 = (곳, 일, x, 열쇠) => { 일간별[일] = (일간별[일] || 0) + 1; const kk = 곳 + '|' + (열쇠 || x); if (본것.has(kk)) return; 본것.add(kk); (틀[곳] = 틀[곳] || []).push(`일간 ${일}: ${x}`); };
  for (let i = 0; i < N; i++) {
    const y = 1950 + Math.floor(rnd() * 60), mo = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28), h = Math.floor(rnd() * 24), 성 = rnd() < .5 ? '남' : '여';
    let r; try { r = I.생년월일시로({ 년: y, 월: mo, 일: d, 시: h, 분: 0, 성별: 성 }); } catch (e) { continue; }
    const 일 = r.명식.ilGan; 셈.명식++;
    const 글들 = [];
    for (const q of 물음들) {
      try { 글들.push(['브리프', H.toLLMBrief(r, { 주제: q, 출생연도: y, gender: 성 })]); } catch (e) {}
      try { 글들.push(['문답 브리프', require('../mundap').toMundapBrief(r, { 질문: q, 출생연도: y, 성별: 성, gender: 성 })]); } catch (e) {}
      try { const U = require('../mureum'); const a = U.엔진답(r, q, { 성별: 성, 출생연도: y }); if (a) 글들.push(['엔진 답', typeof a === 'string' ? a : (a.본문 || '')]); } catch (e) {}
    }
    try { 글들.push(['간명서', H.render(r, { 출생연도: y, gender: 성 })]); } catch (e) {}
    try { 글들.push(['일진 줄', require('../iljin').브리프줄(r)]); } catch (e) {}
    try { 글들.push(['일진 결과', JSON.stringify(require('../iljin').analyze(r, { 날수: 31 }))]); } catch (e) {}
    for (const [곳, 글0] of 글들) {
      const 글 = String(글0 || '').replace(/\*\*이 분야의 모범 답안[\s\S]*?〔예시 끝〕/g, '').replace(/\*\*\[예시 명식 주의\][^\n]*/g, '');
      for (const p of 짝들(글)) { 셈.짝++; if (기준(일, p.g) !== p.이름) 적(곳, 일, `${p.이름} ${p.g} (기준 ${기준(일, p.g)}) …${p.곳}…`, p.곳.replace(new RegExp(`[${천간}${지지}]`, 'g'), '·').replace(/(비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인)/g, '十').slice(0, 30)); }
    }
    const 객틀 = []; 걷기({ 세운: r.단계11b_세운, 대운: r.단계11_대운 || r.대운, 월운: r.단계11c_월운 || r.월운 }, 일, '결과', 객틀);
    try { 걷기(require('../iljin').analyze(r, { 날수: 31 }), 일, '일진', 객틀); } catch (e) {}
    for (const x of 객틀) 적('결과 객체', 일, x);
  }
  return { 함수틀, 틀, 셈, 일간별 };
}
// 답 쪽 시험 — 열 일간마다 해(세운)·달(월운)·날(일진) 글자에 틀린 십성 이름을 붙인 답이 「십성 배속」에 걸리고, 교정하면 기준표 이름이 되는가.
//   모범 답안(일간 己)은 다른 일간 브리프에서 글자가 ○ 로 가려지는가
function 답시험() {
  const D = require('../dapgeomsa'), 문제 = []; const 본 = new Set();
  for (let k = 0; k < 80 && 본.size < 10; k++) {
    const r = I.생년월일시로({ 년: 1990, 월: 3, 일: 1 + (k % 28), 시: 14, 분: 0, 성별: k % 2 ? '남' : '여', ...(k >= 28 ? { 년: 1991 + Math.floor(k / 28) } : {}) });
    const 일 = r.명식.ilGan; if (본.has(일)) continue; 본.add(일);
    const m = r.명식, 브 = `[여덟 글자] ${m.yeonGan}${m.yeonJi} ${m.wolGan}${m.wolJi} ${m.ilGan}${m.ilJi} ${m.siGan || '?'}${m.siJi || '?'}`;
    const 해 = r.단계11b_세운[0].천간, 달 = '庚';   // 달: 2026년 2월 庚寅월의 위 글자
    let 날 = '甲'; try { 날 = require('../iljin').analyze(r, { 날수: 1 }).날[0].천간; } catch (e) {}
    for (const [단위, g] of [['해', 해], ['달', 달], ['날', 날]]) {
      const 맞 = 기준(일, g), 틀 = 같.concat(다).find(x => x !== 맞);
      const 답 = `${단위} 글자인 ${틀} ${g}이 옵니다. ${g}(${틀})의 ${단위}.`;
      if (!D.검사(답, { 브리프: 브, 모드: '문답' }).오류.some(e => e.규칙 === '십성 배속')) 문제.push(`일간 ${일} ${단위} ${틀} ${g} 안 걸림`);
      const c = D.십성이름교정(답, 브); if (c.고침 !== 2 || !c.본문.includes(`${맞} ${g}`) || !c.본문.includes(`${g}(${맞})`)) 문제.push(`일간 ${일} ${단위} 교정 → ${c.본문}`);
      if (D.검사(`${맞} ${g}, ${g}(${맞})`, { 브리프: 브, 모드: '문답' }).오류.some(e => e.규칙 === '십성 배속')) 문제.push(`일간 ${일} ${단위} 맞는 짝이 걸림`);
    }
    if (일 !== '己') { const b = H.toLLMBrief(r, { 주제: '시험 언제 붙을까', 출생연도: 1990, gender: '여' }); const ex = (b.match(/\*\*이 분야의 모범 답안[\s\S]*?〔예시 끝〕/) || [''])[0];
      const 남 = 짝들(ex.replace(/^[^\n]*\n/, '')).filter(p => p.g !== '○'); if (남.length) 문제.push(`일간 ${일} 모범 답안에 가려지지 않은 짝 ${남.slice(0, 3).map(p => p.곳).join(' / ')}`); }
  }
  if (본.size < 10) 문제.push(`일간 ${본.size}가지만 시험됨`);
  return 문제;
}
if (require.main === module) {
  const N = +(process.argv[2] || 120); const o = 감사(N);
  console.log(`십성 함수 기준표 대조: ${o.함수틀.length ? '틀림 ' + o.함수틀.join(', ') : '100칸 모두 같음'}`);
  console.log(`명식 ${o.셈.명식} · 대조한 짝 ${o.셈.짝}`);
  const 곳 = Object.keys(o.틀); if (!곳.length) console.log('틀린 짝 0');
  for (const k of 곳) { console.log(`\n[${k}]`); o.틀[k].forEach(x => console.log('  ' + x.slice(0, 260))); }
  if (곳.length) console.log('\n일간별 틀림:', JSON.stringify(o.일간별));
  const 답문제 = 답시험(); console.log(`답 검사·교정·예시 가림(열 일간 × 해·달·날): ${답문제.length ? '문제 ' + 답문제.length + ' — ' + 답문제.slice(0, 5).join(' / ') : '통과'}`);
  process.exit(o.함수틀.length || 곳.length || 답문제.length ? 1 : 0);
}
module.exports = { 기준, 짝들, 감사 };
