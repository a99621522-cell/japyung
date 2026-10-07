/**
 * scripts/chanwei_fixtures.js — 『滴天髓闡微』 명례 표 만들기 (2026-10-07)
 *   node scripts/chanwei_fixtures.js  → fixtures_chanwei.js (루트 모듈, 자료)
 *
 * docs/chanwei_wonmun.txt(간체)에서 명례 묶음을 뽑는다. 위키문헌의 세로 배치는 줄마다 간지 하나로 풀려 있다:
 *   년주 / 월주 / 일주 / 「시주+첫 대운」(네 글자 한 줄) / 대운 7~8줄 / 任氏 평(산문). 시주가 없는 명례(세 줄 + 대운)도 있다.
 * 표 한 줄: { id, 장, 절, 줄, 팔자:'癸酉 甲子 癸亥 辛酉', m:{…}, 대운:[…], 평:'…' }. 평은 任氏 원문 그대로(간체). 라벨은 평에서 뽑지 않고 그대로 둔다 — 쓰는 쪽(jcs_check)이 장 이름·평 낱말로 읽는다.
 */
const fs = require('fs'), path = require('path');
const 뿌리 = path.join(__dirname, '..');
const 줄들 = fs.readFileSync(path.join(뿌리, 'docs', 'chanwei_wonmun.txt'), 'utf8').split('\n');
const 간 = '甲乙丙丁戊己庚辛壬癸', 지 = '子丑寅卯辰巳午未申酉戌亥';
const 간지식 = new RegExp(`^([${간}][${지}])$`), 두개식 = new RegExp(`^([${간}][${지}])([${간}][${지}])$`);
const 유효 = gz => (간.indexOf(gz[0]) % 2) === (지.indexOf(gz[1]) % 2);
let 장 = '', 절 = '';
const out = []; let i = 0, 버림 = 0;
while (i < 줄들.length) {
  const l = 줄들[i].trim();
  if (/^### /.test(l)) { const t = l.slice(4); if (/论$/.test(t) || /論$/.test(t)) 장 = t; else 절 = t; i++; continue; }
  if (간지식.test(l)) {
    // 간지 줄 묶음 모으기
    const 묶음 = []; let j = i, 시작줄 = i + 1;
    while (j < 줄들.length) {
      const t = 줄들[j].trim();
      if (!t) { j++; continue; }
      if (간지식.test(t)) { 묶음.push(t); j++; continue; }
      const m2 = t.match(두개식); if (m2) { 묶음.push(m2[1], m2[2]); j++; continue; }
      break;
    }
    const 평 = (j < 줄들.length && !/^### /.test(줄들[j].trim())) ? 줄들[j].trim() : '';
    if (묶음.length >= 6 && 묶음.length <= 14) {
      // 처음 넷(또는 셋)이 기둥. 대운 첫 글자가 월주와 간지 순서로 이어지는지로 시주 유무를 가른다
      const 순번 = gz => ((간.indexOf(gz[0]) * 6 + 지.indexOf(gz[1]) * 5) % 60 + 60) % 60;   // 60갑자 번호(甲子=0)
      const 이웃 = (a, b) => { const d = (순번(b) - 순번(a) + 60) % 60; return d === 1 || d === 59; };
      let 기둥수 = 4;
      if (묶음.length >= 4 && 이웃(묶음[1], 묶음[3]) && !이웃(묶음[1], 묶음[4] || '')) 기둥수 = 3;   // 네 번째가 월주의 이웃이면 그것이 첫 대운 → 시주 없음
      const 기둥 = 묶음.slice(0, 기둥수), 대운 = 묶음.slice(기둥수);
      if (기둥.every(유효) && 기둥.length >= 3) {
        const m = { yeonGan: 기둥[0][0], yeonJi: 기둥[0][1], wolGan: 기둥[1][0], wolJi: 기둥[1][1], ilGan: 기둥[2][0], ilJi: 기둥[2][1], siGan: 기둥[3] ? 기둥[3][0] : null, siJi: 기둥[3] ? 기둥[3][1] : null, daysFromJeolip: 15 };
        out.push({ id: `CW-${String(out.length + 1).padStart(3, '0')}`, 장, 절, 줄: 시작줄, 팔자: 기둥.join(' '), m, 대운, 평 });
      } else 버림++;
    } else 버림++;
    i = j; continue;
  }
  i++;
}
const 글 = `/** fixtures_chanwei.js — 『滴天髓闡微』 명례 ${out.length}건 (자동 생성: node scripts/chanwei_fixtures.js, ${new Date().toISOString().slice(0, 10)}). 직접 고치지 말 것.
 *  출처 docs/chanwei_wonmun.txt(wikisource, 간체). 각 항: id·장·절·줄·팔자·m(명식)·대운·평(任氏 평 원문). 라벨은 평·장에서 쓰는 쪽이 읽는다. */
module.exports = { FIXTURES: ${JSON.stringify(out)} };
`;
fs.writeFileSync(path.join(뿌리, 'fixtures_chanwei.js'), 글);
const 장수 = {}; for (const x of out) 장수[x.장 + '/' + x.절] = (장수[x.장 + '/' + x.절] || 0) + 1;
console.log(`명례 ${out.length}건(버림 ${버림}) → fixtures_chanwei.js · 시주 없음 ${out.filter(x => !x.m.siGan).length}`);
console.log(Object.entries(장수).map(([k, v]) => `${k} ${v}`).join(' | '));
