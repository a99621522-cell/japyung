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
const 본기={子:'癸',丑:'己',寅:'甲',卯:'乙',辰:'戊',巳:'丙',午:'丁',未:'己',申:'庚',酉:'辛',戌:'戊',亥:'壬'};
const 충짝={子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳'};
const 육합짝={子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
const 간합짝={甲:'己',己:'甲',乙:'庚',庚:'乙',丙:'辛',辛:'丙',丁:'壬',壬:'丁',戊:'癸',癸:'戊'};
function 지지대조(m, 지){
  const 자리들=[['년지',m.yeonJi],['월지',m.wolJi],['일지',m.ilJi],['시지',m.siJi]];
  const 충=자리들.filter(([n,z])=>z===충짝[지]).map(([n,z])=>n+' '+z+'와 충');
  const 합=자리들.filter(([n,z])=>z===육합짝[지]).map(([n,z])=>n+' '+z+'와 합');
  return [...충,...합];
}
function 간대조(m, 간){
  const 자리들=[['년간',m.yeonGan],['월간',m.wolGan],['시간',m.siGan]];
  return 자리들.filter(([n,g])=>g===간합짝[간]).map(([n,g])=>n+' '+g+'을 합');
}
/** 앞으로 올 해들의 간지·십성·원국과의 충을 한 줄씩 — 연도별 답의 재료 */
function 세운표(m, 시작년, 몇해=16, 급소){
  const ji=[m.yeonJi,m.wolJi,m.ilJi,m.siJi].filter(Boolean);
  const rows=[];
  for(let y=시작년;y<시작년+몇해;y++){
    const gz=년간지(y);
    const 대조=[...간대조(m,gz[0]),...지지대조(m,gz[1])];
    const 깃발=급소?경보(m,급소,y,1):[];
    rows.push({년:y,간지:gz,천간:sipseong(m.ilGan,gz[0]),지지:sipseong(m.ilGan,본기[gz[1]]),
      대조:대조.length?대조.join(', '):null, 깃발:깃발.length?깃발[0].사유.join('·'):null});
  }
  return rows;
}
/** 절기월 간지 (오호둔) — 그 해의 열두 달, 대략의 양력 달 표기와 함께 */
const 첫월간={甲:'丙',己:'丙',乙:'戊',庚:'戊',丙:'庚',辛:'庚',丁:'壬',壬:'壬',戊:'甲',癸:'甲'};
function 월운표(m, 년){
  const ji=[m.yeonJi,m.wolJi,m.ilJi,m.siJi].filter(Boolean);
  const 월지열=['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
  const 양력=['2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월','1월(익년)'];
  const 년간=년간지(년)[0]; let gi=GAN.indexOf(첫월간[년간]);
  const rows=[];
  for(let i=0;i<12;i++){
    const 간=GAN[(gi+i)%10], 지=월지열[i];
    const 대조=[...간대조(m,간),...지지대조(m,지)];
    rows.push({달:양력[i]+' '+간+지+'월', 천간:sipseong(m.ilGan,간), 지지:sipseong(m.ilGan,본기[지]), 대조:대조.length?대조.join(', '):null});
  }
  return rows;
}
module.exports={급소찾기,경보,년간지,세운표,월운표};
