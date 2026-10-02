# 간명 (사주팔자집) — 에이전트 작업 안내

자평진전·궁통보감 원문 조문으로 사주를 **코드가 판정**하고, Gemini가 그 판정을 오늘의 말로 옮기는 앱.
기조: 「맞히는 것이 아니라 왜 그런지 답할 수 있게」. 대상은 명리를 공부하는 사람·종사자, 그리고 그들이 보여 주는 일반인.

## 구조
- **화면**: Cloudflare Workers 정적 PWA (`index.html` + `engine.bundle.js` + `manseryeok.browser.js` + `mundap_ui.js` + `sw.js`).
  명식(여덟 글자) 계산은 브라우저가 한다. **현재 화면 소스는 이 저장소에 없다**(`간명-웹앱-v8.zip`은 옛판). 배포는 zip을 Cloudflare 「새로운 배치」에 끌어놓는 수작업.
- **서버**: Render `ganmyeong-relay` (https://ganmyeong-relay.onrender.com), Root Directory `server/`, `node server.js`.
  라우트 `/health`(커밋 표시) · `/해설`(=`/interpret`, 상담글) · `/문답`(자유 문답). 판정은 서버가 interpret로 다시 내고 Gemini는 문장만 쓴다.
- **엔진 파일은 두 벌**: 저장소 루트(원본)와 `server/engine/`(Render가 실제로 쓰는 것). 루트를 고치고 **같은 파일을 `server/engine/`에 복사**한다. `scripts/check.js`가 두 벌이 같은지 본다.

## 주요 모듈
- `interpret.js` 판정 총괄 · `gyeokguk.js` 격 취용 · `sunjap.js` 순잡 · `chwiun.js` 취운 · `gungtong*.js` 궁통보감 조후·조건절
- `haeseol.js` 조문 리포트(`render`)와 Gemini 브리프(`toLLMBrief`, `궁통브리프`) — 분야 모범 답안·화법 규칙이 여기 있다
- `mundap.js` / `mundap_route.js` 자유 문답 브리프·라우트
- `swiunmal.js` **쉬운 말 층**(2026-10-02) — 브리프 맨 끝 규칙 + 답 모양 검사
- `dapgeomsa.js` 답 검사기(표 밖 간지·연도, 신살, 등급어, 사건 단정, 쉬운 말 층). 오류면 한 번 다시 쓰게 한다
- `gemini.js` Gemini 호출·출력 가드

## 꼭 지킬 것
- **판정은 코드, 문장은 Gemini.** Gemini에게 원문을 주고 다시 추론시키지 않는다(검증된 예외 규칙이 깨진다).
- **유파 병렬** — 자평진전과 궁통보감을 한 판정으로 섞지 않는다. 병합 함수를 두지 않는다.
- 해설 금지: 신살·파·해·원진, 수명·질병·사망, 배우자·자녀 흉단, 사람 등급(상격·귀격), 품행 낙인, 궁합 판정, 사건 못박기(「승진합니다」). 결은 단정, 사건은 금지.
- **쉬운 말 층의 답 모양**: `▶ 한 줄로 말하면` → `▶ 쉽게 풀어 보면` → `▶ 왜 그렇게 보나요` → `▶ 해 볼 만한 일`(+「정리하면」) → `▶ 이 답에 나온 말`. 사용자들이 화면을 캡처해 다른 AI에게 「무슨 말이야」라고 다시 묻는 문제 때문에 만들었다. 모범 답안을 바꿀 때도 이 모양과 말 높이(한 문장 한 가지, 한 문장 전문어 하나)를 지킨다.
- 부록 명례(자평진전 78건)는 저자의 정답 라벨이다. 어긋나면 엔진에 규칙이 빠진 것이지 예외로 넘기지 않는다.
- 비용 절감을 이유로 Gemini에게 주는 재료(세운·월운·조문 전체)를 줄이지 않는다(사용자 결정).

## 작업 순서
1. 루트 파일을 고친다 → 바뀐 파일을 `server/engine/`에 복사
2. `node scripts/check.js` — 전부 통과해야 한다
3. 브랜치에 커밋 → PR → main 병합. main에 `server/**`가 바뀌면 Render가 배포하고, GitHub Actions 「배포 확인」이 배포를 기다렸다가 `/해설`을 한 번 불러 답 전문을 로그에 남긴다.
   **결과 보기: 답 전문이 그 커밋의 댓글로 올라온다** — `gh api repos/a99621522-cell/japyung/commits/<sha>/comments --jq '.[-1].body'`. 이 작업 공간에서는 Actions 로그 파일 다운로드가 막혀 있으니 댓글로 읽는다.
   손으로 돌리기(서버 코드를 안 바꿨을 때): `gh api -X POST repos/a99621522-cell/japyung/actions/workflows/smoke.yml/dispatches -f ref=main` → main 맨 위 커밋의 댓글로 답이 온다.
4. **화면 보기**: `gh api -X POST repos/a99621522-cell/japyung/actions/workflows/look.yml/dispatches -f ref=main` → GitHub에서 브라우저로 앱을 열어 시험 명식을 넣고 물음을 보낸 뒤, 캡처·화면 글자·배포된 화면 파일(app/)을 `site-look-result` 브랜치에 올린다. `git fetch origin site-look-result` 후 `git show origin/site-look-result:look/3-답.png > 파일`로 꺼내 Read로 본다.
5. 이 작업 공간의 프록시는 onrender.com·workers.dev로 직접 나가지 못한다. 서버 확인은 위 Actions로 하거나, WebFetch로 `/health`만 본다.

## 알려진 것
- `manse.js`는 루트(KST 절입 보정판)와 `server/engine`(옛판)이 다르다 — 맞출지 사용자 결정 대기.
- 커밋 메시지는 한국어로.
