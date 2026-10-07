/** scripts/tune_jonghwa.js — 滴天髓 종·화 문턱을 『滴天髓闡微』 명례(fixtures_chanwei.js)로 격자 탐색(2026-10-07 18차). 결과 P 를 jeokcheonsu.THRESH 에 옮긴다. 「진단」 인자면 빗나간 명례 목록. 양성 = 從象·化象·假從·假化 절, 음성 = 八格·官殺·傷官·體用·月令·精神·源流·通關 절 */
const {FIXTURES}=require(__dirname + '/../fixtures_chanwei'); const {interpret}=require(__dirname + '/../interpret');
const { GAN, JIJANGGAN, jeonggi } = require(__dirname + '/../jijanggan'); const hapchung=require(__dirname + '/../hapchung');
const 오행=g=>GAN[g].ohaeng; const 生={木:'火',火:'土',土:'金',金:'水',水:'木'}, 剋={木:'土',火:'金',土:'水',金:'木',水:'火'};
const 生我=Object.fromEntries(Object.entries(生).map(([a,b])=>[b,a])), 剋我=Object.fromEntries(Object.entries(剋).map(([a,b])=>[b,a]));
function 세력(m,여기){ const 세={木:0,火:0,土:0,金:0,水:0}; for(const g of [m.yeonGan,m.wolGan,m.siGan]) if(g) 세[오행(g)]+=1; for(const j of [m.yeonJi,m.wolJi,m.ilJi,m.siJi]) if(j) for(const x of JIJANGGAN[j]) 세[오행(x.gan)]+= x.wi==='정기'?1:x.wi==='중기'?0.5:여기; return 세; }
const 계절of=월지=>({寅:'春',卯:'春',辰:'四季',巳:'夏',午:'夏',未:'四季',申:'秋',酉:'秋',戌:'四季',亥:'冬',子:'冬',丑:'四季'})[월지]; const 化월령={土:'四季',金:'秋',水:'冬',木:'春',火:'夏'};
function 후보(m, ctx, P){
  const 일=m.ilGan, 나=오행(일); const 세=세력(m,P.여기); const 통근=ctx.통근?ctx.통근.score??0:0;
  const 생부=세[나]+세[生我[나]]; const 재=세[剋[나]],관살=세[剋我[나]],식상=세[生[나]]; const 전체=Object.values(세).reduce((a,b)=>a+b,0)+1;
  const 가장=[['재',재],['관살',관살],['식상',식상]].sort((a,b)=>b[1]-a[1])[0];
  const 합신=[m.wolGan,m.siGan].find(g=>g&&hapchung.GANHAP.some(h=>h.gan.includes(일)&&h.gan.includes(g)&&g!==일)); const 간합=합신?hapchung.GANHAP.find(h=>h.gan.includes(일)&&h.gan.includes(합신)):null;
  if(간합){ const 화=간합.hwa; const 월령=계절of(m.wolJi)===化월령[화]; const 화세=세[화]; const 방해=[m.yeonGan,m.wolGan,m.siGan].filter(g=>g&&g!==합신&&[生我[나],剋我[나]].includes(오행(g))).length; // 비겁은 任氏가 「不起爭妒」로 넘김 → 印·官만
    if((월령||화세>=P.화세)&&통근<=P.화뿌리&&방해<=P.화방해) return {후보:(월령&&방해===0&&통근<=P.진화뿌리)?'真化':'假化',종신:화}; }
  const 인투출=[m.yeonGan,m.wolGan,m.siGan].some(g=>g&&오행(g)===生我[나]);
  if((세[나]+1)/전체>=P.종왕비 && 관살<=P.종왕관살) return {후보:'從旺',종신:나};
  if(가장[0]==='식상'&&식상>=P.종아&&식상>=P.종아배*Math.max(재,관살,세[나],세[生我[나]])&&재>=0.5&&!인투출) return {후보:'從兒',종신:生[나]};
  const 종신=가장[0]==='재'?剋[나]:가장[0]==='관살'?剋我[나]:生[나];
  if(통근<=P.진종뿌리&&생부<=P.진종생부&&가장[1]>=P.세력) return {후보:'真從',종신};
  if(통근<=P.가종뿌리&&생부<=P.가종생부&&가장[1]>=P.세력) return {후보:'假從',종신};
  return {후보:null,종신:null};
}
const 양성=FIXTURES.filter(f=>/从象|化象|假从|假化/.test(f.절)); const 음성=FIXTURES.filter(f=>/八格|官杀|伤官|体用|月令|精神|源流|通关/.test(f.절));
const ctxs=new Map(); const C=m=>{const k=JSON.stringify(m); if(!ctxs.has(k)) ctxs.set(k, interpret(m,{gender:'남',출생연도:1800,세운:false}).ctx); return ctxs.get(k);};
const 기대류=f=>/化象|假化/.test(f.절)?'化':'從';
function 점수(P){ let tp=0,tn=0,종신맞=0; for(const f of 양성){ const x=후보(f.m,C(f.m),P); if(x.후보&&((기대류(f)==='化')===x.후보.includes('化'))) tp++; const w=f.평; const 기대종=/从财/.test(w)?剋[오행(f.m.ilGan)]:/从儿/.test(w)?生[오행(f.m.ilGan)]:/从杀|从官/.test(w)?剋我[오행(f.m.ilGan)]:null; if(기대종&&x.종신===기대종) 종신맞++; } for(const f of 음성){ const x=후보(f.m,C(f.m),P); if(!x.후보) tn++; } return {tp,tn,종신맞}; }
let best=null; const grid={여기:[0,0.3],진종뿌리:[0,0.3,0.6],진종생부:[0,0.6,1.0,1.5],가종뿌리:[0.6,1.0,1.5],가종생부:[1.5,2.3,3.0],세력:[2.5,3,3.5],종아:[3,3.5,4],종아배:[1.2,1.5],종왕비:[0.5,0.55,0.6],종왕관살:[0,0.3,0.6],화세:[2,3],화뿌리:[0.6,1.0,1.5],진화뿌리:[0.3,0.6],화방해:[0,1]};
const keys=Object.keys(grid); let n=0;
function rec(i,P){ if(i===keys.length){ const s=점수(P); n++; const tot=s.tp+s.tn; if(!best||tot>best.tot||(tot===best.tot&&s.tp>best.s.tp)) best={tot,s,P:{...P}}; return;} for(const v of grid[keys[i]]){ P[keys[i]]=v; rec(i+1,P);} }
rec(0,{}); if(process.argv[2]!=="진단") console.log('조합',n,'양성',양성.length,'음성',음성.length); console.log(JSON.stringify(best));
// ── 진단
const P=best.P;
console.log('\n[양성 빗나감]'); for (const f of 양성){ const x=후보(f.m,C(f.m),P); const ok=x.후보&&((기대류(f)==='化')===x.후보.includes('化')); if(!ok){ const c=C(f.m); const 세=세력(f.m,P.여기); console.log(f.절,f.팔자,'→',x.후보,x.종신,'뿌리',(c.통근?c.통근.score:0).toFixed(2),'세력',Object.entries(세).map(([k,v])=>k+v.toFixed(1)).join(''),'|',f.평.slice(0,60)); } }
console.log('\n[음성인데 후보]'); for (const f of 음성){ const x=후보(f.m,C(f.m),P); if(x.후보){ const c=C(f.m); const 세=세력(f.m,P.여기); console.log(f.절,f.팔자,'→',x.후보,x.종신,'뿌리',(c.통근?c.통근.score:0).toFixed(2),'세력',Object.entries(세).map(([k,v])=>k+v.toFixed(1)).join(''),'| 평에 从/化:',/从|化/.test(f.평),'|',f.평.slice(0,60)); } }
console.log('\n[从儿 라벨]'); for (const f of FIXTURES.filter(f=>/从儿/.test(f.평))){ const x=후보(f.m,C(f.m),P); const c=C(f.m); const 세=세력(f.m,P.여기); console.log(f.절,f.팔자,'→',x.후보,x.종신,'뿌리',(c.통근?c.통근.score:0).toFixed(2),'세력',Object.entries(세).map(([k,v])=>k+v.toFixed(1)).join(''),'|',f.평.slice(0,50)); }
console.log('\n[从杀/从官/从财 라벨 종신]'); for (const f of FIXTURES.filter(f=>/从杀|从官|从财/.test(f.평))){ const x=후보(f.m,C(f.m),P); const c=C(f.m); console.log(f.절,f.팔자,'→',x.후보,x.종신,'뿌리',(c.통근?c.통근.score:0).toFixed(2),'|',f.평.match(/从[杀官财]/)[0],'|',f.평.slice(0,40)); }
