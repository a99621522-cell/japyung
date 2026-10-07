/**
 * bundle.js — 루트 엔진 모듈 40개를 브라우저용 한 파일 `app/engine.bundle.js`로 묶는다.
 *
 * 배포본(2026-10-02)의 번들 머리글이 「상위 폴더에서 node bundle.js」라 했으나 그 스크립트가 저장소에 없어
 * 같은 모양으로 다시 만들었다(2026-10-07). 모듈 순서·감싸는 틀·끝의 한글 별칭은 배포본과 같다.
 *
 * 실행: node scripts/bundle.js   → app/engine.bundle.js 를 다시 쓴다. 그 뒤 app/sw.js 의 캐시판 번호를 올릴 것.
 */
const fs = require('fs'), path = require('path');
const 뿌리 = path.join(__dirname, '..');

// 배포본과 같은 순서. yukchin 은 끝에 온다(배포본 그대로).
const 모듈 = ['cheoja','chohu','chwiun','eumryeok','fixtures_zpjz','ganji','gemini','gukmyeong','gyeokguk','haengun',
  'haeseol','hapchung','ingwa','interpret','japgi','jari','jeoul','jijanggan','juje','manse','misonglip','myogo',
  'oegyeok','ohaeng_seosa','ohjeon','sangsin','sangsin_fallback','seonhu','seun','sinsal','sisol','sunjap','tonggeun',
  'tuchong','unbyeonhwa','unchung','wolun','yongeo','gungtong_jomun','yukchin','gungtong_un'];
const 별칭 = { 궁통조문:'gungtong_jomun', 지장간:'jijanggan', 서사:'ohaeng_seosa', 격국:'gyeokguk',
               해설:'haeseol', 만세력:'manse', 음력:'eumryeok' };

let out = `/* 간명 엔진 번들 — 모듈 ${모듈.length}개. 자동 생성물이니 직접 고치지 마세요.
   원본을 고친 뒤 저장소 루트에서 node scripts/bundle.js 를 다시 돌리십시오. */
(function(){
"use strict";
var __M = {}, __C = {};
function require(p){
  var n = String(p).replace(/^\\.\\//,'').replace(/\\.js$/,'');
  if (__C[n]) return __C[n].exports;
  if (!__M[n]) throw new Error('모듈 없음: ' + n);
  var m = { exports: {} };
  __C[n] = m;
  __M[n](m, m.exports, require);
  return m.exports;
}
`;
for (const n of 모듈) {
  const f = path.join(뿌리, n + '.js');
  if (!fs.existsSync(f)) throw new Error(`모듈 파일 없음: ${n}.js`);
  let src = fs.readFileSync(f, 'utf8');
  if (!src.endsWith('\n')) src += '\n';
  out += `__M["${n}"] = function(module, exports, require){\n${src}\n};\n`;
}
out += `var 간명엔진 = {};\n`;
for (const n of 모듈) out += `간명엔진["${n}"] = require("${n}");\n`;
for (const [k, v] of Object.entries(별칭)) out += `간명엔진["${k}"] = 간명엔진["${v}"];\n`;
out += `간명엔진.__모듈수 = ${모듈.length};
globalThis.간명엔진 = 간명엔진;
if (typeof module !== 'undefined' && module.exports) module.exports = 간명엔진;
})();
`;
const 대상 = path.join(뿌리, 'app', 'engine.bundle.js');
fs.writeFileSync(대상, out);
console.log(`app/engine.bundle.js ${out.length.toLocaleString()}자 · 모듈 ${모듈.length}개`);
