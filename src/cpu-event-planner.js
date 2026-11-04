/* Staged adapter for the existing CPU Worker service. A one-job dependency
 * wave lets the numerical coordinator immediately promote contact acquisition
 * to fresh verification. Worker generation/cancel guards remain authoritative.
 */
(function(G){
'use strict';
const api=G.LabCPUEventSearch;
function createStagedSearch(R,req){const core=api.create(R,req);return {core,req:core.req,pending:[],finished:false,pausedAt:null,idleMs:0,firstSuccessCost:null,stopReason:null,rootIterations:0};}
function planWave(s){
 if(s.pending.length)throw Error('Commit the event-search job before planning another');
 if(s.finished)return [];
 const job=api.next(s.core);
 if(!job){if(s.core.paused||s.core.finished){s.finished=true;s.stopReason=s.core.paused?'time-limit':'topology-domain-finished';pause(s);}return [];}
 s.pending=[{...job,kind:'inverse-constraint',eventPrefixOnly:true}];return structuredClone(s.pending);
}
function commitWave(s,outcomes){
 if(outcomes.length!==s.pending.length||new Set(outcomes.map(o=>o.id)).size!==outcomes.length||s.pending.some(j=>!outcomes.some(o=>o.id===j.id)))throw Error('Incomplete event-search wave');
 for(const j of s.pending){const out=outcomes.find(o=>o.id===j.id).outcome;const before=[...s.core.roots,...s.core.dormant].map(e=>({e,iterations:e.state.iterations||0}));api.accept(s.core,j.id,out);s.rootIterations+=before.reduce((n,{e,iterations})=>n+Math.max(0,(e.state.iterations||0)-iterations),0);}
 s.pending=[];
 if(s.core.results.length&&!s.firstSuccessCost)s.firstSuccessCost={elapsedMs:performance.now()-s.core.started,physicsSteps:s.core.physicsSteps,evaluations:s.core.evaluations,scope:'cpu-event-search'};
 if(s.core.results.length>s.resultsAtResume||s.core.paused||s.core.finished){s.finished=true;s.stopReason=s.core.results.length>s.resultsAtResume?'first-feasible-shot':s.core.paused?'time-limit':'topology-domain-finished';pause(s);}
}
function stagedResult(s){
 const r=api.result(s.core),seen=new Set(),results=r.results.filter(x=>{const k=G.LabRouteRules.successIdentity(x);if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>s.req.options.objective==='gentle'?a.settings.speed-b.settings.speed||a.distance-b.distance:a.distance-b.distance||a.settings.speed-b.settings.speed).map((x,i)=>({...x,id:i+1,methodLabel:G.LabRouteRules.byId.get(x.method)?.label}));
 const elapsedMs=Math.max(0,(s.pausedAt??performance.now())-s.core.started),roots=[...s.core.roots,...s.core.dormant];
 return {...r,results,resultCount:results.length,found:results.length,tested:r.evaluations,evaluated:r.evaluations,total:null,elapsedMs,options:{...s.req.options},partial:true,continuable:!s.core.finished&&!s.core.cancelled,terminationReason:s.stopReason||'running',domain:s.core.domain,domainExhausted:s.core.exhausted,firstSuccessCost:s.firstSuccessCost,globalOptimal:false,exhaustive:false,inputStrategy:'cpu-event-inverse',searchModel:'event-aware-topology-inverse-root-solve',rootIterations:s.rootIterations,topologiesResolved:s.core.admitted-roots.length,activeTopologies:s.core.roots.length,resumableBranches:s.core.dormant.length,statusCounts:{verified:results.length,unconverged:s.core.dormant.length,unsupported:r.unsupportedBranches+r.unresolvedBranches,infeasible:0},candidatePlan:{version:'cpu-event-search-1',workerIndependent:true,dependencyWaveWidth:1},hz:Math.round(1/s.req.snapshot.dt),feasibilityStatus:results.length?'verified-feasible-shot':'unconverged-or-unsupported'};
}
function pause(s){if(s.pausedAt===null)s.pausedAt=performance.now();s.core.paused=true;}
function resume(s){if(s.pausedAt!==null){s.core.started+=performance.now()-s.pausedAt;s.pausedAt=null;}if(!api.resume(s.core))return false;s.resultsAtResume=s.core.results.length;s.finished=false;s.stopReason=null;return true;}
function disposeSearch(s){api.cancel(s.core);s.pending=[];s.finished=true;}
const originalCreate=createStagedSearch;
G.LabCPUEventPlanner={createStagedSearch(...args){const s=originalCreate(...args);s.resultsAtResume=0;return s;},planWave,commitWave,stagedResult,pause,resume,disposeSearch,validate:G.LabInversePlanner.validate};
})(globalThis);
