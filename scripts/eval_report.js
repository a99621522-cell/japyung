/**
 * scripts/eval_report.js — 평가 세트 50건 판정 스냅샷과 변화 표 (2026-10-07, docs/PROMPTS.md 6)
 *
 *   node scripts/eval_report.js                       # docs/eval/baseline.json 과 견줘 변화 표를 찍고, 변화가 있으면 종료 코드 1
 *   node scripts/eval_report.js --update              # 지금 판정을 기준값으로 저장(엔진을 일부러 바꿨을 때 — PR 설명에 변화 표를 붙인다)
 *   node scripts/eval_report.js --baseline 파일 --md 파일 --no-fail   # 다른 기준값(예: main 의 것)과 견줘 마크다운 표를 파일로 (PR 워크플로)
 *
 * 스냅샷 칸(사례마다): 격·상신·성패·최종성패·순잡·고저 / 궁통 주판정 id·갖춤·용신상태 / 대운 머리 판정(앞 8개) / 금지어(render·브리프에 표시금지·등급어 낱말) 수.
 * 블라인드 평가(사람)는 docs/eval/README.md 의 평가표로 — 이 스크립트는 엔진 판정의 변화만 기계로 잡는다.
 */
const fs = require('fs');
const path = require('path');
const 뿌리 = path.join(__dirname, '..');
const { interpret, 생년월일시로 } = require(path.join(뿌리, 'interpret'));
const H = require(path.join(뿌리, 'haeseol'));
const GJ = require(path.join(뿌리, 'gungtong_jomun'));
let GU = null; try { GU = require(path.join(뿌리, 'gungtong_un')); } catch (e) {}
const D = require(path.join(뿌리, 'dapgeomsa'));

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };
const 기준파일 = typeof opt('--baseline') === 'string' ? opt('--baseline') : path.join(뿌리, 'docs', 'eval', 'baseline.json');
const md파일 = typeof opt('--md') === 'string' ? opt('--md') : null;
const 갱신 = !!opt('--update'), 실패안함 = !!opt('--no-fail');

const { cases } = JSON.parse(fs.readFileSync(path.join(뿌리, 'docs', 'eval', 'cases.json'), 'utf8'));
const 금지식 = GU ? GU.표시금지식 : /淫賤|刑夫|剋子|長舌|不生長|賤|疾|瞽|損目|殘病|災病|夭|而亡/;
const 등급어 = /상격|귀격|천격|하격|下格|上格|貴格|賤格/;

function 스냅(c) {
  const o = { gender: c.성별, 출생연도: c.출생연도 };
  const r = c.갈래 === '날짜' ? 생년월일시로(c.입력) : interpret(c.명식, o);
  const 결 = r.결론 || {};
  let 궁 = null; try { 궁 = GJ.analyze(r.명식, { 성별: c.성별 }); } catch (e) {}
  let 궁2 = null; try { 궁2 = require(path.join(뿌리, 'gungtong')).analyze(r.명식, { 성별: c.성별 }); } catch (e) {}
  const 대운 = ((r.단계11_행운 || {}).대운 || []).slice(0, 8).map(u => `${u.간지}:${(u.길흉 || {}).판정 || '-'}`);
  let 글 = '', 브 = '';
  try { 글 = H.render(r); } catch (e) { 글 = '(render 예외 ' + e.message + ')'; }
  try { 브 = H.toLLMBrief(r, { ...o, 주제: c.주제 }); } catch (e) { 브 = '(brief 예외 ' + e.message + ')'; }
  // 금지어 = 표시금지 낱말(질병·수명·여명 품행어)이 간명서·브리프에 나온 수 — 0 이어야 한다.
  // 등급어는 간명서(render)만 센다 — 브리프에는 「상격·귀격 같은 등급어를 쓰지 말 것」 규칙 문장이 있어 늘 잡히고,
  //   간명서의 「上格·下格」 2건은 궁통 원문 인용(CLAUDE.md 남긴 것: 등급어 린트 ↔ 궁통 인용 충돌)이라 기록만 한다
  const 금지 = (글.match(new RegExp(금지식.source, 'g')) || []).length + (브.match(new RegExp(금지식.source, 'g')) || []).length;
  const 등급 = (글.match(new RegExp(등급어.source, 'g')) || []).length;
  return {
    사주: `${r.명식.yeonGan}${r.명식.yeonJi} ${r.명식.wolGan}${r.명식.wolJi} ${r.명식.ilGan}${r.명식.ilJi} ${r.명식.siGan || '·'}${r.명식.siJi || '·'}`,
    격: 결.격 ?? null, 상신: 결.상신 ?? null, 성패: 결.성패 ?? null, 최종성패: 결.최종성패 ?? null, 순잡: 결.순잡 ?? null, 고저: 결.고저 ?? null,
    궁통주판정: 궁 && 궁.주판정 ? 궁.주판정.id : null, 궁통방향: 궁 && 궁.주판정 ? 궁.주판정.방향 : null,
    갖춤: 궁2 && 궁2.갖춤 != null ? 궁2.갖춤 : null,
    용신상태: 궁2 && Array.isArray(궁2.용신상태) ? 궁2.용신상태.map(x => `${x.글자}(${x.역할}):${x.상태}${x.손상 && x.손상.length ? '·손상' : ''}`).join(' ') : null,
    대운, 금지어: 금지, 등급어: 등급, 브리프자: 브.length,
  };
}

const 지금 = {};
for (const c of cases) { try { 지금[c.id] = 스냅(c); } catch (e) { 지금[c.id] = { 예외: String(e && e.message || e).slice(0, 120) }; } }

if (갱신) {
  fs.writeFileSync(path.join(뿌리, 'docs', 'eval', 'baseline.json'), JSON.stringify({ 만든날: new Date().toISOString().slice(0, 10), 스냅: 지금 }, null, 1));
  console.log(`기준값 저장 — ${Object.keys(지금).length}건 → docs/eval/baseline.json`);
}

let 기준 = null;
try { 기준 = JSON.parse(fs.readFileSync(기준파일, 'utf8')).스냅; } catch (e) { console.log('기준값 없음 —', 기준파일); }

const 칸들 = ['사주', '격', '상신', '성패', '최종성패', '순잡', '고저', '궁통주판정', '궁통방향', '갖춤', '용신상태', '대운', '금지어', '등급어'];
const 같다 = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const 변화 = [];
if (기준) for (const c of cases) {
  const a = 기준[c.id] || {}, b = 지금[c.id] || {};
  for (const k of 칸들) if (!같다(a[k], b[k])) 변화.push({ id: c.id, 칸: k, 전: a[k], 후: b[k], 사주: b.사주 || a.사주 });
}
const 금지합 = Object.values(지금).reduce((s, x) => s + (x.금지어 || 0), 0);
const 예외 = Object.entries(지금).filter(([, x]) => x.예외);

const 표 = ['| 사례 | 사주 | 칸 | 전 | 후 |', '|---|---|---|---|---|', ...변화.map(v => `| ${v.id} | ${v.사주} | ${v.칸} | ${JSON.stringify(v.전 ?? null)} | ${JSON.stringify(v.후 ?? null)} |`)].join('\n');
const 요약 = `평가 세트 ${cases.length}건 — 판정 변화 ${변화.length}칸(${new Set(변화.map(v => v.id)).size}건) · 금지어 ${금지합} · 예외 ${예외.length}`;
const md = `### 평가 세트 판정 변화\n\n${요약}\n\n${변화.length ? 표 : '변화 없음'}\n${예외.length ? '\n예외: ' + 예외.map(([id, x]) => `${id} ${x.예외}`).join(' / ') : ''}\n\n<sub>scripts/eval_report.js — 기준값 ${path.basename(기준파일)}. 칸: 격·상신·성패·최종성패·순잡·고저·궁통 주판정·갖춤·용신상태·대운 머리 판정(앞 8)·금지어</sub>\n`;
if (md파일) fs.writeFileSync(md파일, md);
console.log(요약);
if (변화.length) console.log(표);
if (예외.length) console.log('예외:', 예외.map(([id, x]) => `${id} ${x.예외}`).join(' / '));
const 나쁨 = (기준 && 변화.length && !갱신 && !실패안함) || 금지합 > 0 || 예외.length > 0;
process.exit(나쁨 ? 1 : 0);
