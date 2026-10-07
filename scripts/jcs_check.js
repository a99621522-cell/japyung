/**
 * scripts/jcs_check.js — 셋째 층 「흐름」(滴天髓) 회귀 (2026-10-07)
 *   node scripts/jcs_check.js [표본수=600]
 *   ① 조문 27건의 원문이 docs/jeokcheonsu_wonmun.txt 에 있다(글자 그대로) ② 종화 fixture(원문 조건 그대로 만든 명식) ③ 세운 戰衝和: 간합 짝은 和 로만, 극은 戰, 충은 衝, 사건 없으면 가감 0
 *   ④ 무작위 N건 불변식: 흐름 출력에 금지어(질병·수명·등급어·품행어) 없음, 종화 후보는 일간 뿌리 ≤1.0 일 때만(從兒 제외), 세운 판정이 판정어 다섯 가운데 하나, 자평읽기 보존
 */
const fs = require('fs'), path = require('path');
const 뿌리 = path.join(__dirname, '..');
const J = require(path.join(뿌리, 'jeokcheonsu'));
const { interpret } = require(path.join(뿌리, 'interpret'));
const N = +(process.argv[2] || 600);
let 검사 = 0, 문제 = 0; const 확인 = (이름, ok, 덧) => { 검사++; if (!ok) { 문제++; console.log('  실패', 이름, 덧 ?? ''); } };

// ① 원문 대조
const 원 = fs.readFileSync(path.join(뿌리, 'docs', 'jeokcheonsu_wonmun.txt'), 'utf8').replace(/[\s，。、；：！？「」（）()]/g, '');
for (const j of J.JOMUN) { const 조각 = j.원문.split('…').map(x => x.replace(/[\s，。、；：！？「」（）()]/g, '')).filter(x => x.length >= 2); 확인(`원문 ${j.id}`, 조각.every(c => 원.includes(c)), j.원문.slice(0, 30)); }

// ② 종화 fixture
const 사례 = [
  ['真從 — 甲 일간, 지지 戌巳午巳(水木 없음), 천간 戊丁己', { yeonGan:'戊', yeonJi:'戌', wolGan:'丁', wolJi:'巳', ilGan:'甲', ilJi:'午', siGan:'己', siJi:'巳', daysFromJeolip:10 }, x => x.후보 === '真從' || x.후보 === '從兒'],
  ['종화 아님 — 운영자 명식(己, 丁 편인 투출)', { yeonGan:'辛', yeonJi:'亥', wolGan:'丁', wolJi:'酉', ilGan:'己', ilJi:'酉', siGan:'乙', siJi:'亥', daysFromJeolip:13 }, x => x.후보 === null],
  ['假化 — 甲己 월간 합, 未월, 壬 방해', { yeonGan:'壬', yeonJi:'辰', wolGan:'己', wolJi:'未', ilGan:'甲', ilJi:'戌', siGan:'戊', siJi:'辰', daysFromJeolip:10 }, x => x.후보 === '假化' && x.종신 === '土'],
  ['종화 아님 — 건록(甲 寅월)', { yeonGan:'甲', yeonJi:'子', wolGan:'丙', wolJi:'寅', ilGan:'甲', ilJi:'子', siGan:'丙', siJi:'寅', daysFromJeolip:10 }, x => x.후보 === null],
];
for (const [이름, m, f] of 사례) { const r = interpret(m, { gender: '남', 출생연도: 1980, 세운: false }); const x = J.종화(m, r.ctx); 확인(`종화 ${이름}`, f(x), `${x.후보} ${x.종신} 통근 ${x.통근} 생부 ${x.생부}`); }

// ③ 세운 戰衝和 규칙
{
  const m = { yeonGan:'辛', yeonJi:'亥', wolGan:'丁', wolJi:'酉', ilGan:'己', ilJi:'酉', siGan:'乙', siJi:'亥' };
  const 희기 = s => ({ 정인: 1, 편인: 1, 정재: -1, 편재: -1 })[s] ?? 0;
  const e1 = J.세운전충화({ 천간:'丙', 지지:'午' }, { 천간:'辛', 지지:'卯' }, 희기, null, m);
  확인('丙辛 은 和 로만(戰 없음)', e1.사건.some(x => x.종류 === '和') && !e1.사건.some(x => x.종류 === '戰'), JSON.stringify(e1.사건.map(x => x.종류)));
  const e2 = J.세운전충화({ 천간:'丁', 지지:'未' }, { 천간:'辛', 지지:'卯' }, 희기, null, m);
  확인('丁剋辛 은 戰', e2.사건.some(x => x.종류 === '戰' && x.꼴 === '歲伐運'), JSON.stringify(e2.사건.map(x => x.종류 + x.꼴)));
  const e3 = J.세운전충화({ 천간:'己', 지지:'酉' }, { 천간:'辛', 지지:'卯' }, 희기, null, m);
  확인('酉卯 는 衝', e3.사건.some(x => x.종류 === '衝'));
  const e4 = J.세운전충화({ 천간:'戊', 지지:'申' }, { 천간:'辛', 지지:'卯' }, 희기, null, m);
  확인('戊申↔辛卯 사건 없음 · 점수 = 천간×2+지지', e4.사건.length === 0 && e4.점수 === 희기('겁재') * 2 + 희기('상관'), JSON.stringify(e4));
  const e5 = J.세운전충화({ 천간:'庚', 지지:'子' }, { 천간:'乙', 지지:'丑' }, s => (s === '상관' || s === '식신') ? 1 : 0, null, m);   // 庚(상관)·乙 → 金 和, 子丑 → 土 和
  확인('乙庚 간합 + 子丑 육합 둘 다 和', e5.사건.filter(x => x.종류 === '和').length === 2, JSON.stringify(e5.사건.map(x => x.꼴)));
}

// ④ 무작위 불변식
const 간 = '甲乙丙丁戊己庚辛壬癸', 지 = '子丑寅卯辰巳午未申酉戌亥';
let seed = 1007; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const 금지 = /疾|瞽|損目|殘病|災病|夭|而亡|淫賤|刑夫|剋子|長舌|不生長|상격|귀격|천격|하격|빈천|음란|간사|교활|포악|게으르|천박|貴賤|富貴/;   // 조문 원문의 「亦可貴」 한 글자는 원문 인용이라 두고, 등급어 낱말만 잡는다
const 판정어 = new Set(['결이 크게 눌림', '결이 눌림', '뒤섞임', '결이 살아남', '결이 크게 살아남', '판단 보류']);
let 금지수 = 0, 뿌리위반 = 0, 판정어위반 = 0, 자평없음 = 0, 후보수 = { 真從: 0, 假從: 0, 從兒: 0, 真化: 0, 假化: 0 }, 사건수 = 0;
for (let i = 0; i < N; i++) {
  const 일간 = 간[ri(0, 9)], 일지 = 지[(ri(0, 5) * 2 + 간.indexOf(일간) % 2) % 12], 년간 = 간[ri(0, 9)], 년지 = 지[(ri(0, 5) * 2 + 간.indexOf(년간) % 2) % 12];
  const 월지 = 지[ri(0, 11)], 월두 = { 甲: 2, 己: 2, 乙: 4, 庚: 4, 丙: 6, 辛: 6, 丁: 8, 壬: 8, 戊: 0, 癸: 0 }[년간], 월간 = 간[(월두 + ((지.indexOf(월지) - 2 + 12) % 12)) % 10];
  const 시지 = 지[ri(0, 11)], 시두 = { 甲: 0, 己: 0, 乙: 2, 庚: 2, 丙: 4, 辛: 4, 丁: 6, 壬: 6, 戊: 8, 癸: 8 }[일간], 시간 = 간[(시두 + 지.indexOf(시지)) % 10];
  const m = { yeonGan: 년간, yeonJi: 년지, wolGan: 월간, wolJi: 월지, ilGan: 일간, ilJi: 일지, siGan: 시간, siJi: 시지, daysFromJeolip: ri(1, 29) };
  let r; try { r = interpret(m, { gender: i % 2 ? '여' : '남', 출생연도: ri(1960, 2005), 세운시작: 2026, 세운개수: 3, 월운: false }); } catch (e) { 확인(`interpret 예외 ${i}`, false, e.message); continue; }
  const jc = r.단계_흐름; if (!jc || jc.오류) { 확인(`흐름 예외 ${i}`, false, jc && jc.오류); continue; }
  const 글 = JSON.stringify(jc);
  if (금지.test(글)) { 금지수++; if (금지수 < 3) console.log('  금지어', m, 글.match(금지)[0]); }
  if (jc.종화.후보) { 후보수[jc.종화.후보]++; if (jc.종화.후보 !== '從兒' && jc.종화.통근 > 1.0) 뿌리위반++; }
  for (const s of r.단계11b_세운 || []) { if (!판정어.has(s.길흉.판정)) 판정어위반++; if (s.길흉.읽기 === '적천수 歲運論' && !s.길흉.자평읽기) 자평없음++; 사건수 += (s.길흉.전충화 || []).length; }
}
확인(`무작위 ${N}건 흐름 출력 금지어 0`, 금지수 === 0, 금지수);
확인('종화 후보(從兒 제외)는 일간 뿌리 ≤1.0', 뿌리위반 === 0, 뿌리위반);
확인('세운 판정어 다섯 가운데 하나', 판정어위반 === 0, 판정어위반);
확인('적천수 읽기에 자평읽기 보존', 자평없음 === 0, 자평없음);
console.log(`  종화 후보 분포 ${JSON.stringify(후보수)} · 세운 戰衝和 사건 ${사건수}건/${N * 3}해`);
console.log(`흐름 층 검사: 검사 ${검사} · 문제 항목 ${문제}`);
process.exit(문제 ? 1 : 0);
