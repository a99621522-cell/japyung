/**
 * scripts/answer_metrics_check.js — answer_metrics 의 지표가 제대로 세는지 (Gemini 없이, 2026-10-09 29차-4)
 *   평가 세트 앞 5건마다 브리프의 [해마다 표 뼈대]를 그대로 옮긴 「좋은 답」을 만들어 첫말 어긋남 0·금지 0 을 확인하고,
 *   첫말을 하나 뒤집은 답·육친 흉단을 넣은 답이 기준값 대비 「나빠짐」으로 잡히는지 본다. 종료 코드 0/1.
 */
const path = require('path');
const 뿌리 = path.join(__dirname, '..');
const interpret = require(path.join(뿌리, 'interpret')), haeseol = require(path.join(뿌리, 'haeseol'));
const { 재기, 묶기, 견주기 } = require('./answer_metrics');
const { cases } = require(path.join(뿌리, 'docs', 'eval', 'cases.json'));
let 실패 = 0; const 확인 = (조건, 말) => { console.log(`${조건 ? '통과' : '실패'}  ${말}`); if (!조건) 실패++; };

function 좋은답(c) {
  const opt = { gender: c.성별 === '여' ? '여' : '남', 출생연도: c.출생연도, daysToJeolgi: c.명식.daysFromJeolip, 주제: c.주제 };
  const b = haeseol.toLLMBrief(interpret.interpret(c.명식, opt), opt).split('\n');
  const i = b.findIndex(l => l.startsWith('[해마다 표 뼈대'));
  const 표 = []; for (let j = i + 1; j < b.length && b[j].startsWith('|'); j++) 표.push(b[j].replace('…', '일을 차분히 이어 가면 좋습니다.'));
  return ['▶ 한 줄로 말하면', '스스로 만든 것을 내보내며 사는 분입니다.', '', '▶ 쉽게 풀어 보면', '가을 밭에 열매가 많이 열린 모습입니다. 거둘 것이 많아 손이 바쁩니다.', '',
    '▶ 왜 그렇게 보나요', '- 그릇(자평진전): 만들어 내보내는 힘이 중심입니다.', '- 밭(궁통보감): 이 계절에 필요한 비가 적습니다.', '- 흐름(적천수): 스스로 버틸 힘이 얇은 쪽입니다.', '',
    '▶ 해마다 보면', ...표, '', '▶ 해 볼 만한 일', '배움을 꾸준히 이어 가세요. 정리하면, 쉬는 때를 정해 두는 것이 좋습니다.', '', '▶ 이 답에 나온 말', '- 식신: 만들어 내놓는 힘'].join('\n');
}
const 고른 = cases.slice(0, 5);
const 좋은 = 고른.map(c => 재기(c, 좋은답(c), null));
확인(좋은.every(x => x.표줄 >= 7), `좋은 답 5건 — 해마다 표 줄 ${좋은.map(x => x.표줄).join(',')}`);
확인(좋은.every(x => x.첫말어긋남 === 0 && x.표밖해 === 0), '좋은 답 — 첫말 어긋남 0·표 밖 해 0');
확인(좋은.every(x => x.금지 === 0 && x.머리말빠짐 === 0), '좋은 답 — 금지 0·머리말 빠짐 0');
const 기준 = 묶기(좋은);
const 나쁜 = 고른.map((c, k) => {
  let 글 = 좋은답(c);
  if (k === 0) 글 = 글.replace(/(\| \d{4}년\([^)]*\) \| )(크게 열리는 해|열리는 해|좋고 궂음이 섞인 해)/, '$1크게 조심할 해').replace(/(\| \d{4}년\([^)]*\) \| )(크게 조심할 해|지키는 해)/, '$1크게 열리는 해');
  if (k === 1) 글 = 글.replace('가을 밭에', '배우자는 기신이라 해롭습니다. 가을 밭에');
  return 재기(c, 글, null);
});
확인(나쁜[0].첫말어긋남 >= 1, `첫말 뒤집은 답 — 어긋남 ${나쁜[0].첫말어긋남}`);
확인(나쁜[1].금지 >= 1, `육친 흉단 넣은 답 — 금지 ${나쁜[1].금지}`);
const 견 = 견주기(묶기(나쁜), 기준);
확인(견.나쁨.some(x => x.includes('첫말어긋남')) && 견.나쁨.some(x => x.includes('금지')), `기준값 대비 나빠짐으로 잡힘: ${견.나쁨.join(' · ')}`);
확인(견주기(기준, 기준).나쁨.length === 0, '같은 값끼리는 나빠짐 없음');
console.log(실패 ? `\n실패 ${실패}` : '\n전부 통과'); process.exit(실패 ? 1 : 0);
