/**
 * scripts/jomun_lines.js — 조문 id → 원문 줄 번호 표를 만든다 (2026-10-07, docs/PROMPTS.md 7 「조문 추적」)
 *
 *   node scripts/jomun_lines.js   → jomun_lines.js (루트 모듈, 번들에 들어가 화면에서도 쓴다)
 *
 * 자평진전 조문(gyeokguk JOMUN·chwiun 취운원문)은 docs/japyeong_wonmun.txt, 궁통보감 조문(gungtong_jomun 표·여명·질병)은 docs/gungtong_wonmun.txt 에서
 * scripts/wonmun_check.js 와 같은 정규화(공백·구두점 제거, 이체자 통일, 「…」 조각 나눔)로 찾는다. 못 찾으면 줄 [] — 전수 대조는 wonmun_check 몫이고 여기서는 자리만 적는다.
 */
const fs = require('fs'), path = require('path');
const 뿌리 = path.join(__dirname, '..');
const 이체 = { '衝':'沖','剋':'尅','克':'尅','殺':'煞','碍':'礙','強':'强','并':'並','為':'爲','禄':'祿','却':'卻','衆':'眾','隻':'只','製':'制','才':'財','塡':'填','値':'值','已':'己','緩':'綬','祗':'只','祇':'只','幹':'干','兇':'凶','醜':'丑' };
const 구두 = /[\s，。、；：！？「」『』（）()《》〈〉【】\[\]…·—\-－＿_\*＊~～'"‘’“”,.;:!?<>|│]/g;
const 정규 = s => String(s).replace(구두, '').replace(/./gu, c => 이체[c] ?? c);

function 색인(파일, 장머리식) {
  const 줄 = fs.readFileSync(파일, 'utf8').split('\n');
  const 장들 = []; let 현재 = { 제목: '(머리)', 본문: '', 대응: [] };
  const 밀기 = () => { if (현재.본문) 장들.push(현재); };
  for (let i = 0; i < 줄.length; i++) {
    const l = 줄[i];
    const h = 장머리식 ? l.match(장머리식) : null;
    if (h) { 밀기(); 현재 = { 제목: h[1], 본문: '', 대응: [] }; continue; }
    if (!l.trim() || /^(字數：|上一篇|下一篇|【目錄】)/.test(l) || /^#/.test(l)) continue;
    const 뗀 = l.replace(/【[^】]*】/g, '').replace(/（校[^）]*）/g, '');
    const n = 정규(뗀);
    for (let k = 0; k < n.length; k++) 현재.대응.push(i + 1);
    현재.본문 += n;
  }
  밀기();
  return 장들;
}
function 찾기(장들, 인용) {
  const 조각 = String(인용).split(/…|\.\.\./).map(정규).filter(x => x.length >= 2);
  if (!조각.length) return null;
  for (const 장 of 장들) {
    let pos = 0; const 줄집합 = new Set(); let ok = true;
    for (const c of 조각) { const i = 장.본문.indexOf(c, pos); if (i < 0) { ok = false; break; } for (let k = i; k < i + c.length; k += Math.max(1, Math.floor(c.length / 3))) 줄집합.add(장.대응[k]); 줄집합.add(장.대응[i + c.length - 1]); pos = i + c.length; }
    if (ok) return { 장: 장.제목, 줄: [...줄집합].sort((a, b) => a - b) };
  }
  return null;
}

const 자평 = 색인(path.join(뿌리, 'docs', 'japyeong_wonmun.txt'), /^## (.+?) \(chapter\/\d+\)/);
const 궁통 = 색인(path.join(뿌리, 'docs', 'gungtong_wonmun.txt'), null);
const out = {};
let 자평수 = 0, 자평못 = 0, 궁통수 = 0, 궁통못 = 0;
const 넣기 = (id, 책, 인용) => {
  if (!인용) return;
  const r = 찾기(책 === '자평진전' ? 자평 : 궁통, 인용);
  out[id] = { 책, 줄: r ? r.줄 : [], 장: r ? r.장 : null };
  if (책 === '자평진전') { 자평수++; if (!r) 자평못++; } else { 궁통수++; if (!r) 궁통못++; }
};
const { JOMUN } = require(path.join(뿌리, 'gyeokguk'));
for (const j of JOMUN) 넣기(j.id, '자평진전', j.원문);
const GJ = require(path.join(뿌리, 'gungtong_jomun'));
for (const g of Object.keys(GJ.표)) for (const w of Object.keys(GJ.표[g])) for (const j of GJ.표[g][w].조문) if (!out[j.id]) 넣기(j.id, '궁통보감', j.원문);
for (const j of GJ.여명조문) 넣기(j.id, '궁통보감', j.근거 || j.원문);
for (const j of GJ.질병조문) { 넣기(j.id, '궁통보감', j.근거); if (out[j.id] && !out[j.id].줄.length && j.줄) out[j.id].줄 = [j.줄]; }
// 滴天髓 셋째 층 조문(jeokcheonsu JOMUN, 2026-10-07) — docs/jeokcheonsu_wonmun.txt 에서 찾고, 못 찾으면 모듈에 적힌 줄 번호를 쓴다
let 적천수수 = 0, 적천수못 = 0;
try {
  const 적천 = 색인(path.join(뿌리, 'docs', 'jeokcheonsu_wonmun.txt'), /^## (.+?) \(wiki\//);
  const JC = require(path.join(뿌리, 'jeokcheonsu'));
  for (const j of JC.JOMUN) { const r = 찾기(적천, j.원문); out[j.id] = { 책: j.출처 === '闡微' ? '闡微' : '적천수', 줄: r ? r.줄 : (j.줄 ? [j.줄] : []), 장: r ? r.장 : (j.장 || null) }; 적천수수++; if (!r) 적천수못++; }
} catch (e) { console.log('적천수 조문 색인 건너뜀:', e.message); }

// 취운 조문(chwiun CHWIUN 의 취운원문·원문 문자열)은 id 가 없어 정규화한 원문을 키로 둔다 — jomun_trace 가 같은 정규화로 찾는다
let 취운수 = 0, 취운못 = 0;
try {
  const C = require(path.join(뿌리, 'chwiun'));
  const 모으기 = (v, acc) => { if (!v) return; if (typeof v === 'string') acc.push(v); else if (Array.isArray(v)) v.forEach(x => 모으기(x, acc)); else if (typeof v === 'object') for (const k of Object.keys(v)) if (/원문/.test(k)) 모으기(v[k], acc); else 모으기(v[k], acc); };
  const acc = []; 모으기(C.CHWIUN, acc);
  for (const 원 of new Set(acc)) { const key = '원문:' + 정규(원); if (out[key]) continue; const r = 찾기(자평, 원); out[key] = { 책: '자평진전', 줄: r ? r.줄 : [], 장: r ? r.장 : null }; 취운수++; if (!r) 취운못++; }
} catch (e) { console.log('취운 원문 색인 건너뜀:', e.message); }

const 글 = `/** jomun_lines.js — 조문 id → 원문 줄 번호 (자동 생성: node scripts/jomun_lines.js, ${new Date().toISOString().slice(0, 10)}). 직접 고치지 말 것.
 *  자평진전 ${자평수}건(못 찾음 ${자평못}) · 궁통보감 ${궁통수}건(못 찾음 ${궁통못}) · 취운 원문 ${취운수}건(못 찾음 ${취운못}, 키 '원문:'+정규화 글자). 줄 번호는 docs/japyeong_wonmun.txt · docs/gungtong_wonmun.txt 의 것. */
module.exports = ${JSON.stringify(out)};
`;
fs.writeFileSync(path.join(뿌리, 'jomun_lines.js'), 글);
console.log(`자평진전 ${자평수}건(못 찾음 ${자평못}) · 궁통보감 ${궁통수}건(못 찾음 ${궁통못}) · 취운 원문 ${취운수}건(못 찾음 ${취운못}) · 적천수 ${적천수수}건(못 찾음 ${적천수못}) → jomun_lines.js`);
if (자평못) console.log('자평 못 찾음:', Object.entries(out).filter(([, v]) => v.책 === '자평진전' && !v.줄.length).map(([k]) => k).join(' '));
if (궁통못) console.log('궁통 못 찾음:', Object.entries(out).filter(([, v]) => v.책 === '궁통보감' && !v.줄.length).map(([k]) => k).slice(0, 30).join(' '));
