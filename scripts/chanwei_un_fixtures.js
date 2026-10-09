/**
 * scripts/chanwei_un_fixtures.js — 『滴天髓闡微』 명례 평에서 「어느 운이 좋았다/나빴다」 진술 뽑기 (2026-10-09, 29차-3)
 *   node scripts/chanwei_un_fixtures.js [진단]  → fixtures_chanwei_un.js (루트 모듈, 자료)
 *
 * 입력: fixtures_chanwei.js(507건, 평은 任氏 원문 간체). 뽑는 법(보수적):
 *   ① 평을 문장(。！？；：)으로 자르고, 문장 안에서 「운 언급」을 찾는다
 *      - 간지 둘(丙午)이 그 명례 대운 목록에 있고, 뒤에 运이 붙거나 앞 세 글자 안에 交·至·到·入·行·初·运이 있거나 바로 앞 언급과 구두점만 사이에 둔 것
 *        (뒤에 年·日·月·时·岁 가 붙으면 세운·원국 기둥이라 뺀다)
 *      - 한 글자(丁运·交寅·至酉运)는 「交|至|到|入|行」 + 글자 + (运|，|、) 또는 간지가 아닌 자리의 「X运」. 그 글자가 대운 목록에서 정확히 한 대운에만 있어야 한다
 *   ② 언급마다 구간 = 그 언급부터 같은 문장의 다음 언급 앞까지. 구간에 길 낱말·흉 낱말을 센다(길 낱말 앞 세 글자 안에 不·未·难·无·非 면 흉으로).
 *      한쪽만 있으면 그 라벨, 둘 다 있으면 버림, 하나도 없고 구간이 간지·구두점뿐이면(「辛酉庚申，丁财并旺」) 다음 언급의 라벨을 물려받는다.
 *   ③ 같은 명례·같은 운이 길·흉 둘로 나오면 둘 다 버린다.
 * 표 한 줄: { id, 명례, 팔자, m, 대운, 운간지|null, 운자|null, 자리:'간지'|'천간'|'지지', 라벨:'길'|'흉', 줄, 인용, 낱말 }
 *   인용은 원문 구간 그대로(간체). 라벨은 내부 검증용 — 화면·브리프에 쓰지 않는다.
 */
const fs = require('fs'), path = require('path');
const 뿌리 = path.join(__dirname, '..');
const { FIXTURES } = require(path.join(뿌리, 'fixtures_chanwei'));
const 간 = '甲乙丙丁戊己庚辛壬癸', 지 = '子丑寅卯辰巳午未申酉戌亥';
const 길낱말 = ['发财', '财发', '发福', '发达', '发甲', '得意', '升', '名利', '顺遂', '科甲', '乡榜', '中举', '登科', '入泮', '甲榜', '青云', '丁财并旺', '丁财两旺',
  '温饱', '获利', '大利', '显', '荣', '捷', '仕路', '起家', '连登', '加官', '迁', '擢', '晋', '丰', '吉', '遂', '得志', '进士', '中式', '入学', '补廪', '生子', '富', '贵',
  '喜用合宜', '助起用神', '大发', '经营得意', '名利两全', '获', '捐', '出仕', '飞腾', '平顺', '顺遂', '顺利', '美', '佳', '亨', '宽裕', '兴', '旺财',
  '无亏', '有余', '裕', '其乐', '撞破烟楼', '高攀月桂', '鹿鸣宴罢', '琼林', '仕至', '无灾', '无祸', '无咎', '无破'];
const 흉낱말 = ['破耗', '刑耗', '刑丧', '刑伤', '不禄', '挫', '凶', '亡', '败', '困', '丁忧', '讼', '灾', '祸', '卒', '殁', '落职', '降职', '革职', '罢', '蹭蹬', '坎坷',
  '奔驰', '风霜', '有阻', '不利', '破财', '耗散', '倾', '起倒', '不测', '刑妻', '克妻', '克子', '刑克', '孤苦', '未遂', '不遂', '不售', '两伤', '受伤', '伤用', '有伤体用',
  '破', '耗', '丧', '死', '病', '亏', '劫难', '退职', '回籍', '削', '凋', '萧条', '碌碌', '无成', '一事无成', '大败', '大破', '损', '夭', '逝', '危'];
const 부정 = /[不未难无非]/;
const 문장자르기 = t => t.split(/[。！？；：]/);
function 낱말세기(구간) {
  const 길 = [], 흉 = [];
  // 긴 낱말부터, 겹치는 자리는 한 번만
  const 덮임 = new Array(구간.length).fill(false);
  const 목록 = [...길낱말.map(w => [w, '길']), ...흉낱말.map(w => [w, '흉'])].sort((a, b) => b[0].length - a[0].length);
  for (const [w, k] of 목록) {
    let i = 구간.indexOf(w);
    while (i >= 0) {
      if (!덮임.slice(i, i + w.length).some(Boolean)) {
        for (let x = i; x < i + w.length; x++) 덮임[x] = true;
        if (k === '길') { const 앞 = 구간.slice(Math.max(0, i - 3), i); if (부정.test(앞)) 흉.push('(부정)' + w); else 길.push(w); }
        else 흉.push(w);
      }
      i = 구간.indexOf(w, i + 1);
    }
  }
  return { 길, 흉 };
}
function 언급찾기(문장, 대운) {
  const 목록 = [];
  const 간지집합 = new Set(대운);
  for (let i = 0; i < 문장.length; i++) {
    const a = 문장[i], b = 문장[i + 1];
    if (간.includes(a) && 지.includes(b) && 문장[i + 2] === '年' && (간.indexOf(a) % 2) === (지.indexOf(b) % 2)) {
      // 세운(流年) 언급 — 같은 문장에서 앞선 대운 언급이 있어야 대운을 안다
      const 앞운 = [...목록].reverse().find(x => x.종류 !== '세운');
      목록.push({ 시작: i, 끝: i + 3, 종류: '세운', 세운간지: a + b, 운간지: 앞운 ? 앞운.운간지 : null, 자리: '세운' });
      i += 2; continue;
    }
    if (간.includes(a) && 지.includes(b) && 간지집합.has(a + b)) {
      const 뒤 = 문장[i + 2] || '';
      if (/[年日月时岁]/.test(뒤)) { i++; continue; }
      const 앞 = 문장.slice(Math.max(0, i - 3), i);
      const 직전 = 목록[목록.length - 1];
      const 이어짐 = 직전 && /^[，、\s]*$/.test(문장.slice(직전.끝, i));
      if (뒤 === '运' || /[交至到入行初运]/.test(앞) || 이어짐) 목록.push({ 시작: i, 끝: i + 2, 운간지: a + b, 자리: '간지' });
      i++; continue;
    }
    // 한 글자
    if ((간.includes(a) || 지.includes(a))) {
      const 앞1 = 문장[i - 1] || '', 뒤1 = 문장[i + 1] || '';
      const 앞이간지 = 간.includes(앞1) || 지.includes(앞1);
      const 꼴1 = /[交至到入行]/.test(앞1) && /[运，、]/.test(뒤1);
      const 꼴2 = !앞이간지 && 뒤1 === '运' && !(지.includes(a) && 간.includes(앞1));
      if (!(꼴1 || 꼴2)) continue;
      if (간.includes(뒤1) || 지.includes(뒤1)) continue;
      const 자리 = 간.includes(a) ? '천간' : '지지';
      const 맞는 = 대운.filter(gz => 자리 === '천간' ? gz[0] === a : gz[1] === a);
      if (맞는.length !== 1) continue;
      목록.push({ 시작: i, 끝: i + 1, 운자: a, 운간지: 맞는[0], 자리 });
    }
  }
  return 목록;
}
function 뽑기() {
  const out = []; const 통계 = { 명례: 0, 언급: 0, 버림_섞임: 0, 버림_낱말없음: 0, 버림_모순: 0, 버림_세운대운모름: 0 };
  for (const f of FIXTURES) {
    if (!f.평 || !f.대운 || !f.대운.length || !f.m.siGan) continue;
    const 이번 = [];
    for (const 문장 of 문장자르기(f.평)) {
      const 언급 = 언급찾기(문장, f.대운);
      const 라벨들 = 언급.map((u, k) => {
        const 구간 = 문장.slice(u.시작, k + 1 < 언급.length ? 언급[k + 1].시작 : 문장.length);
        const n = 낱말세기(구간.slice(u.끝 - u.시작));
        const 빈 = /^[，、运\s]*$/.test(구간.slice(u.끝 - u.시작));
        return { u, 구간, n, 빈, 라벨: n.길.length && !n.흉.length ? '길' : n.흉.length && !n.길.length ? '흉' : null, 섞임: !!(n.길.length && n.흉.length) };
      });
      for (let k = 라벨들.length - 1; k >= 0; k--) if (!라벨들[k].라벨 && 라벨들[k].빈 && k + 1 < 라벨들.length && 라벨들[k + 1].라벨 && 라벨들[k].u.종류 !== '세운' && 라벨들[k + 1].u.종류 !== '세운') { 라벨들[k].라벨 = 라벨들[k + 1].라벨; 라벨들[k].물려받음 = true; 라벨들[k].n = 라벨들[k + 1].n; }
      for (const x of 라벨들) {
        통계.언급++;
        if (x.섞임) { 통계.버림_섞임++; continue; }
        if (!x.라벨) { 통계.버림_낱말없음++; continue; }
        if (x.u.종류 === '세운' && !x.u.운간지) { 통계.버림_세운대운모름++; continue; }
        이번.push({ id: null, 명례: f.id, 팔자: f.팔자, m: f.m, 대운: f.대운, 종류: x.u.종류 === '세운' ? '세운' : '대운', 세운간지: x.u.세운간지 ?? null,
          운간지: x.u.운간지, 운자: x.u.운자 ?? null, 자리: x.u.자리, 라벨: x.라벨, 줄: f.줄,
          인용: (x.물려받음 ? x.구간 + '…' : x.구간).trim(), 낱말: [...x.n.길, ...x.n.흉] });
      }
    }
    // 같은 운·같은 자리 길흉 모순은 버림, 중복은 하나만
    const 키 = x => `${x.종류}|${x.세운간지 ?? ''}|${x.운간지}|${x.자리}|${x.운자 ?? ''}`;
    const 묶 = {}; for (const x of 이번) (묶[키(x)] ||= []).push(x);
    let 들어감 = false;
    for (const xs of Object.values(묶)) {
      if (new Set(xs.map(x => x.라벨)).size > 1) { 통계.버림_모순 += xs.length; continue; }
      out.push(xs[0]); 들어감 = true;
    }
    if (들어감) 통계.명례++;
  }
  out.forEach((x, i) => x.id = 'CWU-' + String(i + 1).padStart(3, '0'));
  통계.세운 = out.filter(x => x.종류 === '세운').length;
  return { out, 통계 };
}
if (require.main === module) {
  const { out, 통계 } = 뽑기();
  const 길 = out.filter(x => x.라벨 === '길').length, 흉 = out.length - 길;
  const 머리 = `/** fixtures_chanwei_un.js — 『滴天髓闡微』 명례 평의 운(運) 길흉 진술 ${out.length}건 (자동 생성: node scripts/chanwei_un_fixtures.js, 2026-10-09). 직접 고치지 말 것.\n` +
    ` *  명례 ${통계.명례}건 · 길 ${길} · 흉 ${흉} · 자리 간지 ${out.filter(x => x.자리 === '간지').length} · 천간 ${out.filter(x => x.자리 === '천간').length} · 지지 ${out.filter(x => x.자리 === '지지').length} · 세운(대운 안의 流年) ${통계.세운}.\n` +
    ` *  라벨은 내부 검증용(엔진 대운 판정 대조) — 화면·브리프에 쓰지 않는다. 인용은 원문(간체) 구간 그대로. */\n`;
  fs.writeFileSync(path.join(뿌리, 'fixtures_chanwei_un.js'), 머리 + 'module.exports = { FIXTURES: ' + JSON.stringify(out) + ' };\n');
  console.log(`언급 ${통계.언급} · 섞임 버림 ${통계.버림_섞임} · 낱말 없음 ${통계.버림_낱말없음} · 모순 버림 ${통계.버림_모순} · 세운 대운 모름 ${통계.버림_세운대운모름} → ${out.length}건(세운 ${통계.세운})(명례 ${통계.명례}, 길 ${길}·흉 ${흉})`);
  if (process.argv[2] === '진단') for (const x of out) console.log(x.id, x.명례, x.팔자, x.종류, x.자리, x.운자 || x.운간지, x.세운간지 || '', x.라벨, x.낱말.join(','), '|', x.인용);
}
module.exports = { 뽑기 };
