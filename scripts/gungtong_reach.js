/**
 * scripts/gungtong_reach.js — 궁통보감 조문 도달성 조사 (2026-10-07)
 *
 *   node scripts/gungtong_reach.js [--free N] [--json 파일] [--cell 甲寅]
 *
 * 120칸마다 조문 J(...)를 전부 세고, 명식을 체계적으로 만들어 조문마다
 *   ① 걸린 횟수(hit)  ② 주판정이 된 횟수(主)
 * 를 두 집합에서 센다.
 *   현실 전수: 년간 10 × 년지·일지·시지 12³ = 17,280/칸. 월간은 월두법(年上起月), 시간은 시두법(日上起時)으로
 *             정해지므로 실제로 있을 수 있는 명식 전부다(월지·일간은 칸이 고정).
 *   무제약 표본: 년·월·시간 10³ × 년·일·시지 12³ 가운데 --free 개(기본 60,000)를 고정 씨앗 난수로 뽑는다.
 *             월두법·시두법을 무시하므로 「조건 자체가 모순인가」를 본다.
 * 결과: 조문 표(칸·id·종류·hit·主 두 집합), 한 번도 안 걸린 조문, 걸리되 주판정이 못 되는 판정 조문(+가리는 조문).
 * 흠·완화·바탕은 설계상 주판정이 아니므로 「주판정 0」 목록에서 뺀다.
 */
const path = require('path');
const GJ = require(path.join(__dirname, '..', 'gungtong_jomun'));

const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const JI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const 월지순 = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FREE = +opt('--free', 60000);
const ONLY = opt('--cell', null);
const JSON_OUT = opt('--json', null);

// 월두법: 寅월 월간 = 甲己년 丙, 乙庚 戊, 丙辛 庚, 丁壬 壬, 戊癸 甲 → 이후 달은 순서대로
const 월간of = (년간, 월지) => GAN[((GAN.indexOf(년간) % 5) * 2 + 2 + 월지순.indexOf(월지)) % 10];
// 시두법: 甲己일 甲子시, 乙庚 丙子, 丙辛 戊子, 丁壬 庚子, 戊癸 壬子
const 시간of = (일간, 시지) => GAN[((GAN.indexOf(일간) % 5) * 2 + JI.indexOf(시지)) % 10];

let seed = 20261007;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];

function 조문목록(일간, 월지) {
  return GJ.표[일간][월지].조문.filter(j => !j.월 || j.월 === 월지);
}

// GJ.analyze와 같은 규칙으로 걸린 조문·주판정을 돌려준다(걸린 id 배열, 주판정 id)
function 평가(목록, m) {
  const c = GJ._ctx(m);
  const 걸린 = [];
  for (const j of 목록) { let ok = false; try { ok = !!j.조건(c); } catch (e) {} if (ok) 걸린.push(j); }
  const 주 = 걸린.find(j => j.종류 === '판정') || null;
  return { 걸린, 주 };
}

const 표 = [];   // 조문별 집계
const 가림 = {}; // id → {가리는 id: 횟수}
const 동시 = {}; // 'idA|idB' → 함께 걸린 횟수 (판정 조문끼리, 같은 칸)
const 칸결과 = [];
for (const 일간 of GAN) for (const 월지 of 월지순) {
  const 칸이름 = 일간 + 월지;
  if (ONLY && ONLY !== 칸이름) continue;
  const 목록 = 조문목록(일간, 월지);
  const 집계 = new Map(목록.map(j => [j.id, { 칸: 칸이름, id: j.id, 종류: j.종류, 판정: j.판정, 원문: j.원문, 현실hit: 0, 현실主: 0, 자유hit: 0, 자유主: 0 }]));
  const 세기 = (r, 키) => {
    for (const j of r.걸린) 집계.get(j.id)[키 + 'hit']++;
    if (r.주) 집계.get(r.주.id)[키 + '主']++;
    // 가려진 판정 조문 → 누구에게 가려졌나
    for (const j of r.걸린) if (j.종류 === '판정' && r.주 && r.주.id !== j.id) {
      (가림[j.id] = 가림[j.id] || {})[r.주.id] = (가림[j.id][r.주.id] || 0) + 1;
    }
    const 판 = r.걸린.filter(j => j.종류 === '판정');
    for (let a = 0; a < 판.length; a++) for (let b = a + 1; b < 판.length; b++) { const k = 판[a].id + '|' + 판[b].id; 동시[k] = (동시[k] || 0) + 1; }
  };
  let 현실n = 0, 현실주없음 = 0, 자유n = 0, 자유주없음 = 0;
  // ① 현실 전수
  for (const 년간 of GAN) for (const 년지 of JI) for (const 일지 of JI) for (const 시지 of JI) {
    const m = { yeonGan: 년간, yeonJi: 년지, wolGan: 월간of(년간, 월지), wolJi: 월지, ilGan: 일간, ilJi: 일지, siGan: 시간of(일간, 시지), siJi: 시지 };
    const r = 평가(목록, m); 세기(r, '현실'); 현실n++; if (!r.주) 현실주없음++;
  }
  // ② 무제약 표본
  for (let i = 0; i < FREE; i++) {
    const m = { yeonGan: pick(GAN), yeonJi: pick(JI), wolGan: pick(GAN), wolJi: 월지, ilGan: 일간, ilJi: pick(JI), siGan: pick(GAN), siJi: pick(JI) };
    const r = 평가(목록, m); 세기(r, '자유'); 자유n++; if (!r.주) 자유주없음++;
  }
  칸결과.push({ 칸: 칸이름, 조문수: 목록.length, 현실n, 현실주없음, 자유n, 자유주없음 });
  표.push(...집계.values());
}

// ── 보고 ──
const pad = (s, n) => (s + '').padEnd(n);
console.log(`조문 ${표.length}개 · 칸 ${칸결과.length} · 현실 전수 17,280/칸 · 무제약 표본 ${FREE.toLocaleString()}/칸`);
console.log('\n[조문별] 칸 id 종류 판정 | 현실 hit/主 | 자유 hit/主');
for (const t of 표) console.log(`${pad(t.칸, 3)} ${pad(t.id, 12)} ${pad(t.종류, 3)} ${pad(t.판정, 10)} | ${pad(t.현실hit, 6)}/${pad(t.현실主, 6)} | ${pad(t.자유hit, 6)}/${t.자유主}`);

const 안걸림 = 표.filter(t => t.자유hit === 0);
const 현실안걸림 = 표.filter(t => t.자유hit > 0 && t.현실hit === 0);
const 주못됨 = 표.filter(t => t.종류 === '판정' && t.자유hit > 0 && t.자유主 === 0 && t.현실主 === 0);
console.log(`\n[한 번도 안 걸림 — 무제약 표본에서도 0] ${안걸림.length}개`);
안걸림.forEach(t => console.log(`  ${t.칸} ${t.id} ${t.종류} 「${t.원문}」`));
console.log(`\n[무제약에서는 걸리나 현실 전수(월두법·시두법)에서는 0] ${현실안걸림.length}개`);
현실안걸림.forEach(t => console.log(`  ${t.칸} ${t.id} ${t.종류} 자유hit ${t.자유hit} 「${t.원문}」`));
console.log(`\n[걸리되 주판정이 된 적 없음 — 판정 조문만] ${주못됨.length}개`);
for (const t of 주못됨) {
  const g = Object.entries(가림[t.id] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${id}×${n}`).join(', ');
  console.log(`  ${t.칸} ${t.id} 「${t.판정}」 hit 현실 ${t.현실hit}/자유 ${t.자유hit} — 가린 조문: ${g}`);
}
// 藏X 조문과 無X·乏X·不見X 조문이 함께 걸리는 쌍 — 有/無↔藏 비대칭(머리 주석 ㄱ)의 실제 발현
const 원문of = Object.fromEntries(표.map(t => [t.id, t.원문]));
const 충돌쌍 = [];
for (const [k, n] of Object.entries(동시)) {
  const [a, b] = k.split('|');
  for (const [x, y] of [[a, b], [b, a]]) {
    const 장 = [...(원문of[x].match(/([甲乙丙丁戊己庚辛壬癸])藏|藏([甲乙丙丁戊己庚辛壬癸])/g) || [])].map(s => s.replace('藏', ''));
    for (const g of new Set(장)) if (new RegExp(`(無|乏|不見)[甲乙丙丁戊己庚辛壬癸]{0,2}${g}`).test(원문of[y]) && !new RegExp(`${g}(透|出)`).test(원문of[y])) 충돌쌍.push(`${x}(藏${g}) ↔ ${y}(無${g}) ×${n}`);
  }
}
console.log(`\n[藏X 조문 ↔ 無X 조문 동시 발동] ${충돌쌍.length}쌍`);
충돌쌍.forEach(x => console.log('  ' + x));
const 주없음칸 = 칸결과.filter(k => k.현실주없음 / k.현실n > 0.5).sort((a, b) => b.현실주없음 / b.현실n - a.현실주없음 / a.현실n);
console.log(`\n[현실 전수에서 주판정이 없는 명식이 절반 넘는 칸] ${주없음칸.length}개`);
주없음칸.forEach(k => console.log(`  ${k.칸} 조문 ${k.조문수} · 주판정 없음 ${(100 * k.현실주없음 / k.현실n).toFixed(0)}%`));
if (JSON_OUT) require('fs').writeFileSync(JSON_OUT, JSON.stringify({ 표, 가림, 동시, 칸결과 }, null, 1));
