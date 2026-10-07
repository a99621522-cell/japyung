// wonmun_check.js — 엔진 속 『子平眞詮』 인용을 docs/japyeong_wonmun.txt 와 글자 단위로 대조 (2026-10-07)
//   대상: gyeokguk·chwiun·sangsin·sangsin_fallback·seonhu·ingwa·japgyeok·oegyeok·interpret·sunjap·jijanggan
//         (+ fixtures_zpjz_chapters 의 인용 줄)
//   인용 추출: ① `원문:`·`취운원문:` 키의 문자열 리터럴(삼항식 안의 것도)  ② 코드·주석 속 「…」 (한자만 든 것, 2자 이상)
//   비교: 원문 파일에서 【校：…】·【東里山人按：…】·（校：…）·장 머리·字數·目錄 줄을 떼고, 공백·구두점을 지우고
//         이체자(衝/沖·剋/尅·殺/煞·碍/礙·強/强·并/並·為/爲…)를 하나로 맞춘 뒤 부분 문자열로 찾는다.
//         「…」·「...」 생략 부호는 조각으로 나눠 조각마다 찾는다(한 장 안에 순서대로 있어야 한다).
//   결과: 정확 일치 / 공백·구두점·이체자 차이(보고만) / 불일치(원문에 없음 — 가장 비슷한 원문 자리를 함께 찍는다)
//   사용: node scripts/wonmun_check.js [--all]   (--all 이면 일치 항목도 모두 출력) · 불일치가 있으면 exit 1
const fs = require('fs'), path = require('path');
const 뿌리 = path.join(__dirname, '..');
const 파일들 = ['gyeokguk','chwiun','sangsin','sangsin_fallback','seonhu','ingwa','japgyeok','oegyeok','interpret','sunjap','jijanggan','fixtures_zpjz_chapters'];

// ── 원문 읽기 ─────────────────────────────────────────────
const 원문전체 = fs.readFileSync(path.join(뿌리, 'docs', 'japyeong_wonmun.txt'), 'utf8');
// 이체자·전자판 오자(製/制·才/財·塡/填·値/值·已/己·緩/綬 는 원문 파일 쪽 표기 흔들림)는 비교 때만 하나로 맞춘다
const 이체 = { '衝':'沖','剋':'尅','克':'尅','殺':'煞','碍':'礙','強':'强','并':'並','為':'爲','禄':'祿','却':'卻','衆':'眾','隻':'只','灾':'災','裏':'裡','顔':'顏','温':'溫','麽':'麼','説':'說','鬭':'鬥','恠':'怪','真':'眞','於':'于','舘':'館',
  '製':'制','才':'財','塡':'填','値':'值','已':'己','緩':'綬','祗':'只','祇':'只' };
const 구두 = /[\s，。、；：！？「」『』（）()《》〈〉【】\[\]…·—\-－＿_\*＊~～'"‘’“”,.;:!?<>|│]/g;
const 정규 = s => s.replace(구두, '').replace(/./gu, c => 이체[c] ?? c);

// 장별로 나눠 교감 주를 뗀 본문(정규화)과 원본 줄 번호 대응을 만든다
const 장들 = [];
{
  const 줄 = 원문전체.split('\n'); let 현재 = null;
  for (let i = 0; i < 줄.length; i++) {
    const l = 줄[i];
    const h = l.match(/^## (.+?) \(chapter\/(\d+)\)/);
    if (h) { 현재 = { 제목: h[1], id: h[2], 시작: i + 1, 줄들: [] }; 장들.push(현재); continue; }
    if (!현재 || !l.trim() || /^(字數：|上一篇|下一篇|【目錄】)/.test(l) || /^#/.test(l)) continue;
    현재.줄들.push({ 번호: i + 1, 원: l });
  }
  for (const 장 of 장들) {
    let 본문 = ''; const 대응 = []; let 주 = '';
    for (const { 번호, 원 } of 장.줄들) {
      for (const m of 원.matchAll(/【([^】]*)】|（校([^）]*)）/g)) 주 += 정규(m[1] ?? m[2] ?? '') + '\u0000';
      const 뗀 = 원.replace(/【[^】]*】/g, '').replace(/（校[^）]*）/g, '');
      const n = 정규(뗀);
      for (let k = 0; k < n.length; k++) 대응.push(번호);
      본문 += n;
    }
    장.본문 = 본문; 장.대응 = 대응; 장.주 = 주;
  }
}
const 전체본문 = 장들.map(z => z.본문).join('\u0000');
const 주본문 = 장들.map(z => z.주).join('\u0000');   // 【校：…】·【東里山人按：…】 교감 주 — 인용이 주를 가리키면 '교감주' 로 보고

// ── 인용 추출 ─────────────────────────────────────────────
const 한자만 = s => /^[㐀-鿿\u{20000}-\u{2a6df}]+$/u.test(정규(s).replace(/[　-〿]/g, ''));
function 추출(파일) {
  const p = path.join(뿌리, 파일 + '.js');
  if (!fs.existsSync(p)) return [];
  const 줄 = fs.readFileSync(p, 'utf8').split('\n'); const out = [];
  const 본 = new Set();
  const 넣기 = (문, 번호, 종류) => {
    // （…） 는 엔진의 덧말(비고)이라 비교에서 뺀다. ASCII 공백·쉼표·~ 가 든 것은 인용이 아니라 메모다
    const 핵심 = 문.replace(/\*\*/g, '').replace(/（[^）]*）/g, '').trim();
    if (핵심.length < 2 || /[ ,~]/.test(핵심)) return;
    const 조각 = 핵심.split(/…+|\.{3,}|……/).map(x => x.trim()).filter(Boolean);
    if (!조각.length || !조각.every(한자만)) return;
    if (정규(핵심).length < 2) return;
    const 키 = 파일 + ':' + 번호 + ':' + 핵심; if (본.has(키)) return; 본.add(키);
    out.push({ 파일, 번호, 종류, 문: 핵심, 조각 });
  };
  for (let i = 0; i < 줄.length; i++) {
    const l = 줄[i];
    if (/(원문|취운원문|인용)\s*:/.test(l)) {
      const 뒤 = l.slice(l.search(/(원문|취운원문|인용)\s*:/));
      for (const m of 뒤.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) 넣기(m[1] ?? m[2] ?? m[3] ?? '', i + 1, '원문');
    }
    for (const m of l.matchAll(/「([^「」]+)」/g)) 넣기(m[1], i + 1, '「」');
  }
  return out;
}

// ── 비슷한 자리 찾기(불일치 보고용): 조각과 원문 창의 공통 부분 문자열이 가장 긴 곳 ──
function 최장공통(a, b) {
  let best = 0, bi = 0; const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) { const tmp = prev[j]; prev[j] = a[i-1] === b[j-1] ? diag + 1 : 0; if (prev[j] > best) { best = prev[j]; bi = j; } diag = tmp; }
  }
  return { 길이: best, 끝: bi };
}
function 비슷한자리(조각) {
  let best = null;
  for (const 장 of 장들) {
    if (!장.본문.length) continue;
    // 장 전체와의 최장 공통 부분문자열
    const r = 최장공통(조각, 장.본문);
    if (!best || r.길이 > best.길이) best = { 길이: r.길이, 장, 끝: r.끝 };
  }
  if (!best || best.길이 < Math.max(3, Math.ceil(조각.length * 0.4))) return null;
  const s = Math.max(0, best.끝 - best.길이 - 8), e = Math.min(best.장.본문.length, best.끝 + Math.max(8, 조각.length));
  return { 장: best.장.제목, 줄: best.장.대응[Math.max(0, best.끝 - 1)], 본: best.장.본문.slice(s, e), 공통: best.길이 };
}

// ── 대조 ─────────────────────────────────────────────────
const all = process.argv.includes('--all');
const 결과 = { 정확: [], 차이: [], 불일치: [] };
for (const 파일 of 파일들) {
  for (const c of 추출(파일)) {
    const 조각정규 = c.조각.map(정규).filter(x => x.length >= 2);
    if (!조각정규.length) continue;
    // 한 장 안에서 순서대로 찾히는가
    let 자리 = null;
    for (const 장 of 장들) {
      let pos = 0, ok = true, 첫 = -1;
      for (const 조 of 조각정규) { const k = 장.본문.indexOf(조, pos); if (k < 0) { ok = false; break; } if (첫 < 0) 첫 = k; pos = k + 조.length; }
      if (ok) { 자리 = { 장: 장.제목, 줄: 장.대응[첫] }; break; }
    }
    if (!자리) {
      // 교감 주(【校】·【按】)에서 찾히는가
      const 주장 = 장들.find(z => 조각정규.every(조 => z.주.includes(조)));
      if (주장) { 결과.차이.push({ ...c, 자리: { 장: 주장.제목, 줄: 주장.시작 }, 사유: '본문이 아니라 【校】·【東里山人按】 교감 주의 글자' }); continue; }
      // 장을 넘나드는 생략 인용(두 편을 이은 것)은 조각마다 아무 장에서나 찾히면 '차이'로 둔다
      const 각각 = 조각정규.every(조 => 전체본문.includes(조));
      if (각각) { 결과.차이.push({ ...c, 사유: '조각이 서로 다른 장(또는 순서가 다른 자리)에 있음' }); continue; }
      const 없는 = 조각정규.filter(조 => !전체본문.includes(조));
      결과.불일치.push({ ...c, 없는, 후보: 없는.map(비슷한자리) });
      continue;
    }
    // 정확 일치인가(원문 파일 줄에 공백·구두점까지 그대로 있는가)
    const 원줄 = 원문전체.split('\n')[자리.줄 - 1] ?? '';
    const 그대로 = c.조각.every(조 => 원줄.replace(/【[^】]*】/g, '').includes(조.replace(/\*\*/g, '')));
    if (그대로) 결과.정확.push({ ...c, 자리 });
    else 결과.차이.push({ ...c, 자리, 사유: '공백·구두점·이체자(衝/沖·剋/尅·殺/煞 등) 차이 — 글자는 같다' });
  }
}

const 줄요약 = c => `${c.파일}.js:${c.번호} [${c.종류}] ${c.문}`;
console.log(`인용 ${결과.정확.length + 결과.차이.length + 결과.불일치.length}건 — 정확 ${결과.정확.length} · 구두점·이체자 차이 ${결과.차이.length} · 불일치 ${결과.불일치.length}`);
if (all) { console.log('\n[정확 일치]'); for (const c of 결과.정확) console.log('  ✓', 줄요약(c), `← ${c.자리.장} ${c.자리.줄}줄`); }
if (결과.차이.length) { console.log('\n[차이 — 보고만]'); for (const c of 결과.차이) console.log('  ~', 줄요약(c), c.자리 ? `← ${c.자리.장} ${c.자리.줄}줄` : '', `(${c.사유})`); }
if (결과.불일치.length) {
  console.log('\n[불일치 — 원문에 없는 글자]');
  for (const c of 결과.불일치) {
    console.log('  ✗', 줄요약(c));
    c.없는.forEach((조, i) => { const h = c.후보[i]; console.log(`      없음: ${조}` + (h ? `\n      비슷: ${h.장} ${h.줄}줄 …${h.본}… (공통 ${h.공통}자)` : '\n      비슷한 자리 없음')); });
  }
}
process.exit(결과.불일치.length ? 1 : 0);
