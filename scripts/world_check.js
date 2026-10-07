/**
 * scripts/world_check.js — 세계 만세력 회귀 (2026-10-07, docs/PROMPTS.md 4)
 *
 *   node scripts/world_check.js [표본수=200]
 *
 *   ① 한국: 출생지 없음 ↔ 출생지 Asia/Seoul 명시가 같고, manseryeok(app/manseryeok.browser.js, KASI 절입표) 과 1945~1989 무작위 4,000건 년·월주 불일치 0
 *   ② 시간대 오프셋이 Intl 의 longOffset 과 같다(미·일·중 각 N건 + 서머타임 사례)
 *   ③ 같은 UTC 순간을 다른 시간대 시계로 넣으면 년주·월주가 같다(절입은 UTC 비교)
 *   ④ 일주·시주 = 출생지 진태양시(UTC + 경도×4분) 로 세운 손계산과 같다(균시차 없음), 야자시 정책 두 가지
 *   ⑤ manseryeok 가 있을 때 한국 밖 일주·시주가 자체 계산과 같다(라이브러리 경로 = 자체 경로, 균시차 없음)
 *   ⑥ 경계 사례: 뉴욕 2026-02-03 20:00 EST 는 입춘(KST 02-04 05:02) 뒤라 丙午년 庚寅월(시계 날짜로 읽으면 乙巳년 己丑월)
 */
const path = require('path');
const fs = require('fs');
const M = require(path.join(__dirname, '..', 'manse'));
const N = +(process.argv[2] || 200);
let 문제 = 0, 검사수 = 0;
const 확인 = (이름, ok, 덧) => { 검사수++; if (!ok) { 문제++; console.log('  실패', 이름, 덧 ?? ''); } };

// manseryeok 적재(브라우저 번들) — globalThis 에 둔다
try {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'manseryeok.browser.js'), 'utf8');
  globalThis.manseryeok = new Function(src + '\nreturn manseryeok;')();
} catch (e) { console.log('manseryeok 적재 실패 — ①⑤ 건너뜀:', e.message); }
const MS = globalThis.manseryeok;

let seed = 20261007;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const 한자 = k => ({갑:'甲',을:'乙',병:'丙',정:'丁',무:'戊',기:'己',경:'庚',신:'辛',임:'壬',계:'癸'})[k[0]] + ({자:'子',축:'丑',인:'寅',묘:'卯',진:'辰',사:'巳',오:'午',미:'未',신:'申',유:'酉',술:'戌',해:'亥'})[k[1]];
const 날짜 = (y, m, d) => { const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); return Math.min(d, dim); };

// ① 한국
{
  let 불일치 = 0, 같음 = 0;
  for (let i = 0; i < 4000; i++) {
    const y = ri(1945, 1989), m = ri(1, 12), d = 날짜(y, m, ri(1, 31)), h = ri(0, 23), min = ri(0, 59);
    const a = M.사주(y, m, d, h, min, {}), b = M.사주(y, m, d, h, min, { 출생지: { tz: 'Asia/Seoul', 경도: 127.5 } });
    if (a.사주 !== b.사주) { 불일치++; if (불일치 < 4) console.log('  한국 명시 ≠ 기본', y, m, d, h, min, a.사주, b.사주); }
    if (MS) {
      const o = MS.calculateFourPillars({ year: y, month: m, day: d, hour: h, minute: min, dayBoundary: 'jasi', trueSolarTime: { longitude: 127.5, applyEquationOfTime: false, applyHistoricalDst: true } }).toObject();
      if (한자(o.year) !== a.명식.yeonGan + a.명식.yeonJi || 한자(o.month) !== a.명식.wolGan + a.명식.wolJi) { 불일치++; if (불일치 < 8) console.log('  manseryeok 년·월주 불일치', y, m, d, h, min, a.사주, 한자(o.year), 한자(o.month)); } else 같음++;
    }
  }
  확인('① 한국 4,000건 년·월주 불일치 0', 불일치 === 0, `불일치 ${불일치}`);
  console.log(`  ① 한국 4,000건 — 불일치 ${불일치}${MS ? ` · manseryeok 년·월주 일치 ${같음}` : ' (manseryeok 없음)'}`);
}

// ② 오프셋 ↔ Intl longOffset
const 지역 = {
  미국: [['America/New_York', -74.0], ['America/Chicago', -87.6], ['America/Los_Angeles', -118.2], ['America/Denver', -105.0]],
  일본: [['Asia/Tokyo', 139.7], ['Asia/Tokyo', 135.5]],
  중국: [['Asia/Shanghai', 116.4], ['Asia/Shanghai', 121.5], ['Asia/Shanghai', 87.6]],
};
const longOffset = (tz, ms) => {
  const v = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date(ms)).find(x => x.type === 'timeZoneName').value;
  const m = v.match(/GMT([+-])(\d{2}):?(\d{2})?/); if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + (+(m[3] || 0)));
};
const 표본 = [];
for (const [나라, tzs] of Object.entries(지역)) {
  let 오프셋틀림 = 0, 년월틀림 = 0, 일시틀림 = 0, 라이브러리틀림 = 0, 서머 = 0;
  for (let i = 0; i < N; i++) {
    const [tz, 경도] = tzs[i % tzs.length];
    const y = ri(1930, 2030), m = ri(1, 12), d = 날짜(y, m, ri(1, 31)), h = ri(0, 23), min = ri(0, 59);
    const 야자시 = rnd() < 0.5 ? '밤11시' : '자정';
    const r = M.사주(y, m, d, h, min, { 출생지: { tz, 경도, 이름: 나라 }, 야자시 });
    const off = r.시각.오프셋분;
    // ② Intl 로 그 순간(UTC) 의 오프셋
    const utcMs = Date.UTC(y, m - 1, d, h, min) - off * 60000;
    const lo = longOffset(tz, utcMs);
    if (lo !== off) { 오프셋틀림++; if (오프셋틀림 < 3) console.log('  오프셋', 나라, tz, y, m, d, h, min, off, lo); }
    if (off !== longOffset(tz, Date.UTC(y, 0, 1, 12))) 서머++;
    // ③ 같은 UTC 순간을 KST 시계로 넣으면 년·월주 같음 (일·시주는 경도가 달라 다를 수 있음)
    const k = r.시각.KST;
    const r2 = M.사주(k.y, k.m, k.d, k.h, k.min, {});
    if (r2.명식.yeonGan + r2.명식.yeonJi !== r.명식.yeonGan + r.명식.yeonJi || r2.명식.wolGan + r2.명식.wolJi !== r.명식.wolGan + r.명식.wolJi) { 년월틀림++; if (년월틀림 < 3) console.log('  년월', 나라, y, m, d, h, min, r.사주, r2.사주); }
    // ④ 손계산 — 진태양시 = UTC + 경도×4분, 야자시 정책
    const jdUTC = M.toJD(y, m, d, h, min) - off / 1440;
    const jd진 = jdUTC + 경도 * 4 / 1440;
    const t = M.fromJD(jd진);
    let JDN = Math.floor(jd진 + 0.5); if (야자시 === '밤11시' && t.h >= 23) JDN += 1;
    const di = (JDN + 49) % 60;
    const 일 = '甲乙丙丁戊己庚辛壬癸'[di % 10] + '子丑寅卯辰巳午未申酉戌亥'[di % 12];
    const 시idx = Math.floor(((t.h + t.min / 60 + 1) % 24) / 2);
    const 시두 = { 甲:0, 己:0, 乙:2, 庚:2, 丙:4, 辛:4, 丁:6, 壬:6, 戊:8, 癸:8 };
    const 시 = '甲乙丙丁戊己庚辛壬癸'[(시두[일[0]] + 시idx) % 10] + '子丑寅卯辰巳午未申酉戌亥'[시idx];
    const 라이브러리경고 = r.경고.some(x => x.startsWith('출생지 진태양시 계산이 경계'));
    if (라이브러리경고) 라이브러리틀림++;
    else if (r.명식.ilGan + r.명식.ilJi !== 일 || r.명식.siGan + r.명식.siJi !== 시) { 일시틀림++; if (일시틀림 < 3) console.log('  일시', 나라, y, m, d, h, min, 야자시, r.사주, 일, 시, JSON.stringify(t)); }
    if (i < 2) 표본.push(`${나라} ${tz} ${y}-${m}-${d} ${h}:${String(min).padStart(2, '0')} → ${r.사주} (UTC${off >= 0 ? '+' : ''}${off / 60}, 진태양시 ${t.h}:${String(t.min).padStart(2, '0')})`);
  }
  확인(`② ${나라} ${N}건 오프셋 = Intl`, 오프셋틀림 === 0, 오프셋틀림);
  확인(`③ ${나라} ${N}건 같은 UTC 순간 년·월주 같음`, 년월틀림 === 0, 년월틀림);
  확인(`④ ${나라} ${N}건 일·시주 = 진태양시 손계산`, 일시틀림 === 0, 일시틀림);
  if (MS) 확인(`⑤ ${나라} ${N}건 라이브러리 ≠ 자체 (경계 알림) 는 ${N} 의 2% 이하`, 라이브러리틀림 <= N * 0.02, 라이브러리틀림);
  console.log(`  ${나라} ${N}건 — 오프셋 틀림 ${오프셋틀림} · 년월 틀림 ${년월틀림} · 일시 틀림 ${일시틀림} · 라이브러리 경계 알림 ${라이브러리틀림} · 서머타임 표본 ${서머}`);
}
console.log('  표본: ' + 표본.join(' / '));

// 서머타임 사례 — 알려진 값
{
  const 사례 = [['Asia/Tokyo', 1949, 7, 1, 12, 0, 600], ['Asia/Shanghai', 1988, 7, 1, 12, 0, 540], ['Asia/Shanghai', 1992, 7, 1, 12, 0, 480], ['America/New_York', 1975, 7, 1, 12, 0, -240], ['America/New_York', 1975, 1, 15, 12, 0, -300], ['Asia/Kolkata', 2000, 1, 1, 12, 0, 330], ['Asia/Pyongyang', 2016, 1, 1, 12, 0, 510]];
  for (const [tz, y, m, d, h, min, 기대] of 사례) 확인(`서머타임·표준시 ${tz} ${y}-${m}-${d}`, M.시간대오프셋분(tz, y, m, d, h, min) === 기대, M.시간대오프셋분(tz, y, m, d, h, min));
  확인('모르는 tz 는 null', M.시간대오프셋분('Nowhere/Nowhere', 2000, 1, 1) === null);
}

// ⑥ 경계 사례
{
  const a = M.사주(2026, 2, 3, 20, 0, { 출생지: { tz: 'America/New_York', 경도: -74.0, 이름: '뉴욕' } });
  확인('⑥ 뉴욕 2026-02-03 20:00 EST → 丙午 庚寅 (입춘 뒤)', a.사주.startsWith('丙午 庚寅'), a.사주);
  const b = M.사주(2026, 2, 3, 20, 0, {});   // 같은 시계 숫자를 한국으로 읽으면 입춘 전
  확인('⑥ 같은 숫자 한국 → 乙巳 己丑 (입춘 전)', b.사주.startsWith('乙巳 己丑'), b.사주);
  const c = M.사주(1988, 7, 1, 0, 30, { 출생지: { tz: 'Asia/Shanghai', 경도: 121.5 }, 야자시: '자정' });
  const d = M.사주(1988, 7, 1, 0, 30, { 출생지: { tz: 'Asia/Shanghai', 경도: 121.5 }, 야자시: '밤11시' });
  확인('⑥ 상하이 1988 서머타임 00:30 → 진태양시 6/30 23:36, 자정 정책 일주 ≠ 밤11시 정책 일주', c.시각.진태양시.d === 30 && c.시각.진태양시.h === 23 && c.명식.ilGan + c.명식.ilJi !== d.명식.ilGan + d.명식.ilJi, `${c.사주} / ${d.사주}`);
  const e = M.사주(2000, 6, 15, 12, 0, { 출생지: { tz: 'Asia/Tokyo', 경도: 139.7 }, 균시차: true });
  확인('⑥ 균시차 켜면 진태양시에 균시차(±16분 안)가 든다', Math.abs(e.시각.진태양시.균시차) <= 16.5 && e.시각.균시차 === true, e.시각.진태양시.균시차);
  const f = M.사주(2000, 6, 15, 12, 0, { 출생지: { tz: 'Asia/Tokyo' } });
  확인('⑥ 경도 없으면 시계 오프셋으로 시주 + 경고', f.경고.some(x => x.includes('경도가 없어')) && f.시각.진태양시.시계와차이 === 0, f.경고.join('|'));
  확인('⑥ 결과 시각 칸(시계·UTC·KST·진태양시·출생지)', a.시각 && a.시각.UTC && a.시각.KST && a.시각.진태양시 && a.시각.출생지.tz === 'America/New_York');
}

console.log(`세계 만세력 검사: 검사 ${검사수} · 문제 항목 ${문제}`);
process.exit(문제 ? 1 : 0);
