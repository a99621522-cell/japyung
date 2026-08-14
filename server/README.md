# 간명 해설 중계 서버

앱(정적 사이트)이 Gemini를 부를 수 없어 두는 서버입니다.
브라우저 자바스크립트는 다 들여다보이므로 API 키를 앱에 넣을 수 없습니다.
**이 서버가 하는 일은 키를 대신 들고 있는 것뿐**입니다.

## 하지 않는 것

- **판정하지 않습니다.** 격·상신·성패·운은 앱이 기기 안에서 이미 다 냅니다.
- **생년월일시를 받지 않습니다.** 받는 것은 명식 여덟 글자뿐입니다.
- **아무것도 저장하지 않습니다.** 로그에도 남기지 않습니다.

## Render에 올리기

1. Render → **New +** → **Web Service**
2. 깃허브 저장소 연결
3. 이렇게 채웁니다

| 칸 | 값 |
|---|---|
| Name | `ganmyeong-relay` |
| Runtime | `Node` |
| Root Directory | **`server`** |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Health Check Path | `/health` |
| Plan | Free (또는 Starter $7) |

4. **Environment** 탭에서 변수를 넣습니다

| Key | Value |
|---|---|
| `GEMINI_API_KEY` | 받으신 키 |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `ALLOW_ORIGIN` | 앱 주소. 예 `https://ganmyeong.onrender.com` |
| `RATE_LIMIT` | `20` (IP당 한 시간) |

> `ALLOW_ORIGIN`을 비워 두면 아무 데서나 부를 수 있습니다.
> 시험할 때만 비우고, 앱 주소가 정해지면 반드시 넣으세요.

`render.yaml`이 있으니 Blueprint로 올리셔도 됩니다.

## 무료 요금제의 잠듦

15분 동안 아무도 안 부르면 잠들고, 다시 깨는 데 30초쯤 걸립니다.
앱에서 화면을 열 때 `/health`를 한 번 두드려 미리 깨우면 견딜 만합니다.

```js
fetch(중계주소 + '/health').catch(() => {});   // 결과는 안 씁니다
```

## 주소

| | |
|---|---|
| `GET /health` | 살아 있는지. 잠든 서버를 깨울 때도 씀 |
| `POST /해설` | 해설을 만든다 (`/interpret`도 같음) |

### 보낼 것

```json
{
  "명식": {
    "yeonGan":"辛","yeonJi":"亥",
    "wolGan":"丁","wolJi":"酉",
    "ilGan":"己","ilJi":"酉",
    "siGan":"乙","siJi":"亥"
  },
  "출생연도": 1971,
  "성별": "남",
  "절기날수": 13.59,
  "주제": "직업"
}
```

`siGan`·`siJi`는 시각을 모르면 빼도 됩니다.
`주제`는 없으면 전체를 풉니다.

### 받을 것

```json
{
  "성공": true,
  "본문": "…해설…",
  "출처": "Gemini",
  "격": "식신", "상신": "편관", "성패": "패중유성"
}
```

`성공: false`면 `본문`에 **조문 리포트**가 들어옵니다.
키가 없거나 호출이 실패해도 앱은 무언가를 보여줄 수 있어야 하니까요.

## 가드

Gemini가 쓴 글을 여섯 가지로 검사합니다. 걸리면 무엇이 걸렸는지 알려주고
다시 시키고, 그래도 걸리면 그 문장만 덜어냅니다.

| | 근거 |
|---|---|
| 신살·여명 속설 | 21편 論星辰無關格局 |
| 배우자·자녀·수명 흉단 | 24편에서 배제한 범주 |
| 십성 개수로 품행 재기 | 21편 「貴人乃是天星，並非夫主」 |
| 사람에게 등급 매기기 | 12편 或一字而有千鈞之力 |
| 원문 한자 인용 | 읽는 사람이 처음 보는 분야다 |
| 재료에 없는 것 지어내기 | 판정에 없는 십성 |
| 같은 말 되풀이 | 읽는 사람이 「또 그 소리」로 느낀다 |

## 로컬에서 돌려보기

```bash
cd server
GEMINI_API_KEY=... node server.js
curl localhost:10000/health
```

## 엔진을 고쳤을 때

`engine/`은 상위 폴더 모듈의 복사본입니다. 원본을 고쳤으면 다시 복사하세요.

```bash
cd ..
node -e "
const fs=require('fs'),path=require('path');
const 필요=new Set();
(function 모으기(n){ if(필요.has(n))return; const f=n+'.js';
  if(!fs.existsSync(f))return; 필요.add(n);
  for(const m of fs.readFileSync(f,'utf8').matchAll(/require\(['\"]\.\/([\w-]+)['\"]\)/g)) 모으기(m[1]);
})('gemini');
for(const n of 필요) fs.copyFileSync(n+'.js','server/engine/'+n+'.js');
console.log(필요.size+'개 복사');
"
```
