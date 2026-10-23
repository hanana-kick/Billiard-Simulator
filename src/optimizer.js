/* Goal orchestration over the same full-resolution physical candidate evaluator.
 * A separate budget/beam is reserved for each chosen method and ball order. */
(function(G){
'use strict';
const Core=G.ShotSearchCore,Rules=G.LabRouteRules;
const modern=req=>req?.options?.mode==='direct'||Array.isArray(req?.options?.methods);
function methodIds(req){return req.options.mode==='direct'?['direct']:req.options.methods;}
function validate(req){
 const refs=Core.validate(req);if(!modern(req))return refs;
 const o=req.options,methods=methodIds(req);
 if(!['direct','three'].includes(o.mode)||!['fixed','either'].includes(o.order||'fixed'))throw new Error('목표와 공 순서를 확인하세요.');
 if(!Array.isArray(methods)||!methods.length||methods.length>Rules.catalog.length||new Set(methods).size!==methods.length||methods.some(m=>!Rules.byId.has(m)||(o.mode==='three'&&m==='direct')))throw new Error('계산할 경로 종류를 한 개 이상 선택하세요.');
 return refs;
}
function createSearch(R,req){
 validate(req);if(!modern(req))return Core.createSearch(R,req);
 const methods=methodIds(req),orders=[{first:req.options.targetId,second:req.options.secondId}];
 if(req.options.order==='either')orders.push({first:req.options.secondId,second:req.options.targetId});
 const groups=[];
 for(const method of methods)for(let k=0;k<orders.length;k++){
  const budget=Math.floor(req.options.budget/orders.length)+(k<req.options.budget%orders.length?1:0);if(!budget)continue;
  const request={...req,testBudget:true,options:{...req.options,methods:undefined,methodId:method,targetId:orders[k].first,secondId:orders[k].second,budget}};
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
 // Reserve up to two actual successes per selected method, not merely global top-three.
 for(const id of s.methods){const unique=[];for(const r of all.filter(r=>r.method===id))if(!unique.some(p=>p.firstId===r.firstId&&Math.abs(p.settings.angle-r.settings.angle)<.1&&Math.abs(p.settings.speed-r.settings.speed)<.12&&Math.abs(p.settings.tipX-r.settings.tipX)<.05&&Math.abs(p.settings.tipY-r.settings.tipY)<.05))unique.push(r);selected.push(...unique.slice(0,2));}
 selected.sort(compare);selected.forEach((r,i)=>r.id=i+1);
 return{...progress(s),results:selected,nearest:null,options:{...s.req.options},hz:Math.round(1/s.req.snapshot.dt),globalOptimal:false};
}
function finishSearch(s){return collectResults(s);}
function previewSearch(s){const result=collectResults(s);return{...result,partial:!s.finished};}
function disposeSearch(s){if(s.familySearch){s.groups.forEach(Core.disposeSearch);s.active=null;s.finished=true;}else Core.disposeSearch(s);}
G.LabOptimizer={...Core,validate,createSearch,advanceSearch,finishSearch,disposeSearch,progress,previewSearch};
})(globalThis);
