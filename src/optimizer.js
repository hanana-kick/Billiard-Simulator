/* Goal orchestration over the same full-resolution physical candidate evaluator.
 * A separate budget/beam is reserved for each chosen method and ball order. */
(function(G){
'use strict';
const Core=G.ShotSearchCore,Rules=G.LabRouteRules;
const modern=req=>req?.options?.mode==='direct'||Array.isArray(req?.options?.methods);
function methodIds(req){return req.options.mode==='direct'?['direct']:req.options.mode==='carom'?['carom']:req.options.methods;}
function validate(req){
 const refs=Core.validate(req);if(req.partition){const {index,count}=req.partition;if(!Number.isInteger(index)||!Number.isInteger(count)||count<1||count>8||index<0||index>=count)throw new Error('잘못된 병렬 탐색 분할');}if(!modern(req))return refs;
 const o=req.options,methods=methodIds(req);
 if(!['direct','carom','three'].includes(o.mode)||!['fixed','either'].includes(o.order||'fixed'))throw new Error('목표와 공 순서를 확인하세요.');
 if(!Array.isArray(methods)||!methods.length||methods.length>Rules.catalog.length||new Set(methods).size!==methods.length||methods.some(m=>!Rules.byId.has(m)||(o.mode==='three'&&m==='direct')))throw new Error('계산할 경로 종류를 한 개 이상 선택하세요.');
 return refs;
}
function createSearch(R,req){
 validate(req);if(!modern(req))return Core.createSearch(R,req);
 const methods=methodIds(req),orders=[{first:req.options.targetId,second:req.options.secondId}];
 if(req.options.order==='either')orders.push({first:req.options.secondId,second:req.options.targetId});
 const groups=[],groupCount=methods.length*orders.length;let groupIndex=0;
 for(const method of methods)for(let k=0;k<orders.length;k++,groupIndex++){
  let partition=req.partition;
  if(partition){
   const {index,count}=partition;
   if(groupCount<=count){
    if(index%groupCount!==groupIndex)continue;
    partition={index:Math.floor(index/groupCount),count:Math.floor((count-1-groupIndex)/groupCount)+1};
   }else{if(groupIndex%count!==index)continue;partition=undefined;}
  }
  const budget=Math.floor(req.options.budget/orders.length)+(k<req.options.budget%orders.length?1:0);if(!budget)continue;
  const request={...req,partition,testBudget:true,options:{...req.options,methods:undefined,methodId:method,targetId:orders[k].first,secondId:orders[k].second,budget}};
  const core=Core.createSearch(R,request);core.method=method;groups.push(core);
 }
 return{familySearch:true,R,req,groups,methods,index:0,active:null,finished:false,started:performance.now(),pool:[]};
}
function advanceSearch(s,budget=240){
 if(!s.familySearch)return Core.advanceSearch(s,budget);
 if(s.finished)return true;
 let attempts=0;
 while(attempts++<s.groups.length&&s.groups[s.index].finished)s.index=(s.index+1)%s.groups.length;
 if(s.groups.every(g=>g.finished)){s.finished=true;s.active=null;return true;}
 const group=s.groups[s.index],done=Core.advanceSearch(group,budget);s.active=group.active;
 if(done||!group.active){s.index=(s.index+1)%s.groups.length;s.active=null;}
 return false;
}
function progress(s){
 if(!s.familySearch)return Core.progress(s);
 const methods=s.methods.map(id=>{
  const parts=s.groups.filter(g=>g.method===id).map(Core.progress);
  return{id,label:Rules.byId.get(id).label,tested:parts.reduce((n,p)=>n+p.tested,0),total:parts.reduce((n,p)=>n+p.total,0),found:parts.reduce((n,p)=>n+p.found,0),evaluated:parts.reduce((n,p)=>n+p.evaluated,0),rejected:parts.reduce((n,p)=>n+p.rejected,0),fraction:parts.reduce((n,p)=>n+(p.fraction||0),0),nearestGap:Math.min(...parts.map(p=>p.nearestGap??Infinity))};
 });
 return{tested:methods.reduce((n,p)=>n+p.tested,0),total:methods.reduce((n,p)=>n+p.total,0),found:methods.reduce((n,p)=>n+p.found,0),evaluated:methods.reduce((n,p)=>n+p.evaluated,0),rejected:methods.reduce((n,p)=>n+p.rejected,0),elapsedMs:performance.now()-s.started,methods,activeMethod:s.groups[s.index]?.method,activeSeconds:Core.progress(s.groups[s.index]).activeSeconds,fraction:methods.reduce((n,p)=>n+p.fraction,0)};
}
function collectResults(s){
 if(!s.familySearch)return Core.finishSearch(s);
 const compare=s.req.options.objective==='gentle'?(a,b)=>a.settings.speed-b.settings.speed||a.distance-b.distance:(a,b)=>a.distance-b.distance||a.settings.speed-b.settings.speed;
 const all=s.groups.flatMap(g=>Core.finishSearch(g).results.map(r=>({...r,method:g.method,methodLabel:Rules.byId.get(g.method).label}))).sort(compare),selected=[];
 // Preserve every distinct verified success; display pagination is a UI concern.
 for(const id of s.methods){const unique=[];for(const r of all.filter(r=>r.method===id))if(!unique.some(p=>p.firstId===r.firstId&&p.secondId===r.secondId&&G.LabRouteRules.successIdentity(p)===G.LabRouteRules.successIdentity(r)))unique.push(r);selected.push(...unique);}
 selected.sort(compare);selected.forEach((r,i)=>r.id=i+1);
 return{...progress(s),results:selected,nearest:null,options:{...s.req.options},hz:Math.round(1/s.req.snapshot.dt),globalOptimal:false,exhaustive:false,seedCushionRange:s.req.options.mode==='carom'?[0,Math.max(0,...s.groups.map(g=>g.seedMaxOrder??0))]:s.req.options.methods?.includes('any')?[3,Math.max(3,...s.groups.map(g=>g.seedMaxOrder??3))]:null,seedMaxOrder:Math.max(0,...s.groups.map(g=>g.seedMaxOrder??0)),searchModel:'inverse-root-and-damped-physical-solver',feasibilityStats:s.groups.reduce((a,g)=>{for(const k of ['checked','blocked','restored'])a[k]+=(g.feasibilityStats?.[k]||0);return a;},{checked:0,blocked:0,restored:0}),feasibilityStatus:selected.length?'verified-feasible-shot':'not-found-within-budget',physicsSteps:s.groups.reduce((n,g)=>n+(g.physicsSteps||0),0),solverStats:s.groups.reduce((a,g)=>{for(const k of ['probes','steps','accepted','rejected'])a[k]+=(g.solverStats?.[k]||0);return a;},{probes:0,steps:0,accepted:0,rejected:0}),terminationReason:s.finished?'candidate-budget-exhausted':'partial'};
}
function finishSearch(s){return collectResults(s);}
function previewSearch(s){const result=collectResults(s);return{...result,partial:!s.finished};}
function disposeSearch(s){if(s.familySearch){s.groups.forEach(Core.disposeSearch);s.active=null;s.finished=true;}else Core.disposeSearch(s);}
G.LabOptimizer={...Core,validate,createSearch,advanceSearch,finishSearch,disposeSearch,progress,previewSearch};
})(globalThis);
