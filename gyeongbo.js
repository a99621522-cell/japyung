/**
 * gyeongbo.js — 다가오는 해의 결 점검 (급소·회국 스캔)
 *
 * 원리는 전부 원문 연역이다:
 * ① 급소 = 격이 기대는 상신 글자 (조후 용신과 겹치면 이중 급소)
 * ② 지지는 모여야 動한다(必會而後動) — 원국 지지에 세운 지지가 더해져
 *    급소를 극하는 오행의 방국·삼합이 완성되는 해를 깃발로 세운다
 * ③ 통근이 얕은 급소일수록 위태롭다 — 무근이면 가중
 * 사전 예측력은 미검증이므로(2026-08 무자년 블라인드 스캔 1건 통과)
 * 화법은 "지키는 해" 수준을 넘지 않는다.
 */
const { JIJANGGAN, sipseong } = require('./jijanggan');
const GAN=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const JI=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const 오행={甲:'목',乙:'목',丙:'화',丁:'화',戊:'토',己:'토',庚:'금',辛:'금',壬:'수',癸:'수'};
const 극하는={목:'금',화:'수',토:'목',금:'화',수:'토'};
const 국={수:{방:['亥','子','丑'],합:['申','子','辰']},화:{방:['巳','午','未'],합:['寅','午','戌']},
        목:{방:['寅','卯','辰'],합:['亥','卯','未']},금:{방:['申','酉','戌'],합:['巳','酉','丑']},
        토:null};
const 년간지=y=>GAN[(y-4)%10]+JI[(y-4)%12];

function 급소찾기(m, 상신십성, 조후용){
  const 후보=GAN.filter(g=>sipseong(m.ilGan,g)===상신십성);
  const K=후보[0]; if(!K) return null;
  const ji=[m.yeonJi,m.wolJi,m.ilJi,m.siJi].filter(Boolean);
  const 뿌리=ji.filter(z=>(JIJANGGAN[z]||[]).some(jg=>(jg.gan||jg)===K));
  return { 글자:K, 십성:상신십성, 무근:뿌리.length===0, 뿌리,
           이중:(조후용||[]).includes(K) };
}
function 경보(m, 급소, 시작년, 몇해=6){
  if(!급소) return [];
  const 위협=극하는[오행[급소.글자]]; const 틀=국[위협]; if(!틀) return [];
  const ji=[m.yeonJi,m.wolJi,m.ilJi,m.siJi].filter(Boolean);
  const out=[];
  for(let y=시작년;y<시작년+몇해;y++){
    const gz=년간지(y); const all=[...ji,gz[1]]; const 사유=[];
    if(틀.방.every(x=>all.includes(x)) && !틀.방.every(x=>ji.includes(x))) 사유.push(위협+'의 방국 완성');
    if(틀.합.every(x=>all.includes(x)) && !틀.합.every(x=>ji.includes(x))) 사유.push(위협+'의 삼합 완성');
    if(사유.length) out.push({년:y, 간지:gz, 사유, 가중:급소.무근?'급소 무근':null});
  }
  return out;
}
module.exports={급소찾기,경보,년간지};
