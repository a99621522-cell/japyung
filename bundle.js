/**
 * bundle.js — Node 모듈을 브라우저용 한 파일로 묶는다
 *
 * 번들러를 쓰지 않고 직접 묶는 까닭:
 *   외부 도구를 붙이면 그것까지 관리해야 한다. 여기서 쓰는 모듈은
 *   순수 함수뿐이고 require 그래프도 얕으므로, 각 모듈을 함수로 감싸고
 *   가짜 require를 하나 두면 그대로 돈다.
 */
const fs = require('fs');
const path = require('path');

const 뿌리 = ['interpret', 'haeseol', 'manse', 'ohaeng_seosa'];
const 본 = new Map();

function 모으기(이름) {
  if (본.has(이름)) return;
  const 파일 = 이름 + '.js';
  if (!fs.existsSync(파일)) return;
  const src = fs.readFileSync(파일, 'utf8');
  본.set(이름, src);
  // require('./xxx') 를 찾아 재귀
  for (const m of src.matchAll(/require\(['"]\.\/([\w-]+)['"]\)/g)) 모으기(m[1]);
}
뿌리.forEach(모으기);

const 조각 = [];
for (const [이름, src] of 본) {
  조각.push(`__mods[${JSON.stringify('./' + 이름)}] = function(module, exports, require){\n${src}\n};`);
}

const out = `/* 자평진전 간명 엔진 — ${본.size}개 모듈 · 자동 생성 (bundle.js) */
(function(global){
'use strict';
var __mods = {}, __cache = {};
function require(p){
  if (p.slice(0,2) !== './') p = './' + p;
  if (__cache[p]) return __cache[p].exports;
  var f = __mods[p];
  if (!f) throw new Error('모듈 없음: ' + p);
  var m = { exports: {} };
  __cache[p] = m;
  f(m, m.exports, require);
  return m.exports;
}
${조각.join('\n')}
global.간명엔진 = {
  interpret: require('./interpret'),
  haeseol:   require('./haeseol'),
  manse:     require('./manse'),
  서사:      require('./ohaeng_seosa'),
  지장간:    require('./jijanggan'),
};
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.writeFileSync('engine.bundle.js', out);
console.log(`묶음 완료 — ${본.size}개 모듈, ${(out.length/1024).toFixed(0)}KB`);
console.log('포함:', [...본.keys()].join(' '));
