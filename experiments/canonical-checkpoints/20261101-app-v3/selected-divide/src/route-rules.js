/* Application goals only. This file never changes a rigid body or fabricates a path.
 * Traditional shot names overlap: the displayed contact constraint is authoritative.
 * In particular, three-cushion means >=3 contacts, not three different walls. */
(function(G){
'use strict';
const catalog=Object.freeze([
 {id:'turn',label:'돌리기 · 앞/뒤/옆 계열',short:'돌리기',group:'공 먼저',description:'첫 공 → 서로 다른 쿠션 3면을 돌아 → 둘째 공',rule:'첫 공 전 쿠션 0회, 이후 첫 3회가 서로 다른 면',prefix:0},
 {id:'grand',label:'대회전',short:'대회전',group:'공 먼저',description:'첫 공 → 쿠션 4회 이상, 3면 이상 돌아 → 둘째 공',rule:'첫 공 전 쿠션 0회, 이후 4회 이상·3면 이상',prefix:0},
 {id:'return',label:'되돌아오기 · 더블레일 계열',short:'되돌아오기',group:'공 먼저',description:'첫 공 → 같은 쿠션으로 되돌아오는 A–B–A 경로 → 둘째 공',rule:'첫 공 전 쿠션 0회, 이후 A–B–A 포함 (A≠B)',prefix:0},
 {id:'cross',label:'횡단 · 더블쿠션 계열',short:'횡단',group:'공 먼저',description:'첫 공 → 마주 보는 긴 쿠션을 번갈아 3회 이상 → 둘째 공',rule:'첫 공 전 쿠션 0회, 이후 첫 3회가 긴 쿠션 +Z/−Z/+Z 또는 반대',prefix:0},
 {id:'bank1',label:'원뱅크',short:'원뱅크',group:'쿠션 먼저',description:'쿠션 1회 → 첫 공 → 추가 쿠션 → 둘째 공',rule:'첫 공 전 정확히 1회, 둘째 공 전 총 3회 이상',prefix:1},
 {id:'bank2',label:'투뱅크',short:'투뱅크',group:'쿠션 먼저',description:'쿠션 2회 → 첫 공 → 추가 쿠션 → 둘째 공',rule:'첫 공 전 정확히 2회, 둘째 공 전 총 3회 이상',prefix:2},
 {id:'bank3',label:'쓰리뱅크 · 3쿠션 먼저',short:'쓰리뱅크',group:'쿠션 먼저',description:'쿠션 3회 → 첫 공 → 둘째 공을 연속으로',rule:'첫 공 전 정확히 3회, 두 공 사이 쿠션 0회',prefix:3},
 {id:'allWalls',label:'네 벽을 모두 먼저',short:'네 벽 먼저',group:'쿠션 먼저',description:'서로 다른 네 벽을 모두 맞힌 뒤 두 공을 연속으로',rule:'첫 공 전 4면 모두·4회 이상, 두 공 사이 쿠션 0회',prefix:4},
 {id:'any',label:'3쿠션 자유 경로',short:'자유 경로',group:'제한 없음',description:'쿠션과 공의 중간 순서를 제한하지 않고 3쿠션 성립',rule:'둘째 공 전 총 3회 이상',prefix:null}
]);
const direct={id:'direct',label:'두 공 바로 맞히기',short:'직접 두 공',group:'직접',description:'수구 → 첫 공 → 둘째 공, 완료 전 쿠션 접촉 없음',rule:'두 공에 닿기 전 쿠션 0회',prefix:0};
const carom={id:'carom',label:'쿠션 제한 없이 두 공',short:'자유 두 공',group:'제한 없음',description:'첫 공 → 둘째 공, 쿠션 횟수 제한 없음',rule:'두 공 순서만 판정',prefix:null};
const byId=new Map([...catalog,direct,carom].map(x=>[x.id,x]));
const railByLabel={'오른쪽 쿠션':'x+','왼쪽 쿠션':'x-','앞쪽 쿠션':'z+','뒤쪽 쿠션':'z-'};
function railId(c){return c.rail||railByLabel[c.label]||null;}
function features(contacts,firstId,secondId){
 const i=contacts.findIndex(e=>e.kind==='object');
 const before=i<0?contacts.filter(e=>e.kind==='cushion'):contacts.slice(0,i).filter(e=>e.kind==='cushion');
 const first=i<0?null:contacts[i];
 let end=-1,wrong=false;
 if(first&&first.id!==firstId)wrong=true;
 if(first&&!wrong)for(let j=i+1;j<contacts.length;j++){
  const e=contacts[j];if(e.kind==='object'&&e.id===secondId){end=j;break;}
  if(e.kind==='object'&&e.id!==firstId){wrong=true;break;}
 }
 const used=end<0?contacts:contacts.slice(0,end+1);
 const all=used.filter(e=>e.kind==='cushion'),after=i<0?[]:used.slice(i+1).filter(e=>e.kind==='cushion');
 const ids=after.map(railId),preIds=before.map(railId);
 const returning=ids.some((id,k)=>k>=2&&id&&id===ids[k-2]&&id!==ids[k-1]);
 const crossing=ids.length>=3&&ids.slice(0,3).every(x=>x==='z+'||x==='z-')&&ids[0]!==ids[1]&&ids[0]===ids[2];
 return{firstHit:!!first&&!wrong,complete:end>=0&&!wrong,wrong,firstIndex:i,endIndex:end,before:before.length,after:after.length,total:all.length,preIds,ids,returning,crossing,contacts:used};
}
function condition(method,f){
 switch(method){
  case 'direct':return f.total===0;
  case 'turn':return f.before===0&&f.ids.length>=3&&new Set(f.ids.slice(0,3).filter(Boolean)).size===3;
  case 'grand':return f.before===0&&f.after>=4&&new Set(f.ids.filter(Boolean)).size>=3;
  case 'return':return f.before===0&&f.returning;
  case 'cross':return f.before===0&&f.crossing;
  case 'bank1':return f.before===1;
  case 'bank2':return f.before===2;
  case 'bank3':return f.before===3&&f.after===0;
  case 'allWalls':return f.before>=4&&new Set(f.preIds.filter(Boolean)).size===4&&f.after===0;
  case 'any':case 'carom':return true;
  default:return false;
 }
}
function evaluate(contacts,{method='any',firstId,secondId,ambiguous=false,minCushions=0}={}){
 if(!byId.has(method)||!Number.isInteger(firstId)||!Number.isInteger(secondId)||firstId===secondId)throw new Error('잘못된 경로 판정 조건');
 const f=features(contacts,firstId,secondId),required=Math.max(minCushions,method==='direct'||method==='carom'?0:3);
 let invalid=f.wrong||ambiguous;
 if(method==='direct'&&f.total>0)invalid=true;
 const def=byId.get(method);
 // A fixed pre-contact cushion count cannot be recovered after it is exceeded.
 if(!f.firstHit&&def.prefix!==null&&method!=='allWalls'&&f.before>def.prefix)invalid=true;
 if(f.firstHit&&def.prefix!==null){
  if(method==='allWalls'){if(new Set(f.preIds.filter(Boolean)).size!==4)invalid=true;}
  else if(f.before!==def.prefix)invalid=true;
 }
 if((method==='bank3'||method==='allWalls')&&f.firstHit&&f.after>0)invalid=true;
 // No cushion can be retroactively counted after first touch of the second ball.
 const success=f.complete&&!invalid&&f.total>=required&&condition(method,f);
 if(f.complete&&!success)invalid=true;
 return{...f,method,success,invalid,missing:Math.max(0,required-f.total),reason:ambiguous?'동일 시간 단계의 접촉 순서를 확정할 수 없음':invalid?'접촉 순서·쿠션 조건 불충족':''};
}
function classify(contacts,firstId,secondId){return catalog.filter(d=>evaluate(contacts,{method:d.id,firstId,secondId}).success).map(d=>d.id);}
// A kiss is a new cue/object collision after the same pair separated, not
// merely the first impact with a moving object. Legacy setting keeps polarity.
function successIdentity(result){
 return JSON.stringify([result.firstId,result.secondId,result.settings,result.contacts?.map(e=>[e.kind,e.id??null,railId(e)])]);
}
function kissAllowed(options={}){
 return options.allowKiss??options.allowMovingTargets??true;
}
function createKissTracker(){return{pairs:new Map(),contacts:[]};}
function observeKiss(tracker,id,{impact,separated,time}){
 const pair=tracker.pairs.get(id)||{seen:false,active:false};
 if(separated)pair.active=false;
 if(impact&&!pair.active){
  if(pair.seen)tracker.contacts.push({id,time});
  pair.seen=true;pair.active=true;
 }
 tracker.pairs.set(id,pair);
 return tracker.contacts.length>0;
}
G.LabRouteRules={catalog,direct,carom,byId,railId,evaluate,classify,features,successIdentity,kissAllowed,createKissTracker,observeKiss};
})(globalThis);
