/* Optional scalar continuation after a FOUR-BALL full replay proves the two
 * red contacts but rejects a later opponent/floor contact. The same root's
 * speed interval is narrowed to reduce post-goal motion. This is a heuristic
 * continuation, not a monotonicity or infeasibility proof. Other topology and
 * full-input solver states remain preserved. Every accepted shot gets another
 * independent, full-rest native verification.
 */
(function(G){
'use strict';
const base=G.LabEventInverseSearchWindow,keys=['angle','elevation','speed','tipX','tipY'];
function create(R,req,options={}){const s=base.create(R,req,options);s.tail=null;s.tailAttempted=new Set();s.tailProbes=0;s.tailVerifications=0;return s;}
function next(s){
 if(!s.tail||s.cancelled||s.finished||s.paused)return base.next(s);
 if(s.pending)return structuredClone(s.pending);
 if(performance.now()>=s.deadline){s.paused=true;return null;}
 const t=s.tail;
 if(t.phase==='trial'&&(t.iterations>=12||t.high-t.low<=.002)){s.tail=null;return base.next(s);}
 const settings=t.phase==='verify'?{...t.settings}:{...t.originalSettings,speed:(t.low+t.high)/2};
 s.pending={id:s.nextId++,solverId:null,tailContinuation:true,purpose:t.phase,settings,topology:t.branch,req:s.req};return structuredClone(s.pending);
}
function validate(s,job,out){
 if(!out||!Array.isArray(out.inequalities)||!out.inequalities.every(Number.isFinite))throw Error('Finite tail continuation inequalities required');
 if(out.topologyMatched&&(out.eventPrefix!==job.topology.events.length||out.mismatch))throw Error('Inconsistent tail event prefix');
 if(!out||out.id!==job.topology.id||out.purpose!==job.purpose||!keys.every(k=>out.settings?.[k]===job.settings[k]))throw Error('Tail continuation outcome identity mismatch');
 if(out.verified===true&&(job.purpose!=='verify'||out.prefixOnly||out.freshReplay!==true||out.physicalResult?.success!==true||out.topologyMatched!==true||!keys.every(k=>out.physicalResult?.settings?.[k]===job.settings[k])))throw Error('Missing independent full tail verification');
 if(out.physicalGoal===true&&(!out.prefixOnly||out.goalVerified||out.verified||out.physicalResult!==null||out.eventPrefix!==job.topology.events.length||out.topologyMatched!==true||out.mismatch))throw Error('Malformed tail candidate prefix');
}
function accept(s,id,outcome){
 const job=s.pending;if(!job||job.id!==id)throw Error('Unknown or stale tail search job');
 const out=structuredClone(outcome);
 if(!job.tailContinuation){
  base.accept(s,id,out);
  const key=JSON.stringify([job.topology.id,...keys.map(k=>job.settings[k])]);
  if(s.req.options.gameMode==='four'&&job.purpose==='verify'&&out.topologyMatched&&!out.verified&&out.physicalResult?.failureReason==='four-ball-opponent-or-off-table'&&!s.tailAttempted.has(key)){
   s.tailAttempted.add(key);s.tail={branch:structuredClone(job.topology),originalSettings:{...job.settings},low:s.req.options.minSpeed??.5,high:job.settings.speed,iterations:0,phase:'trial'};
  }
  return;
 }
 validate(s,job,out);
 const t=s.tail;s.pending=null;s.evaluations++;s.physicsSteps+=out.steps||0;
 s.trace.push({id,purpose:job.purpose,branchId:t.branch.id,settings:{...job.settings},prefix:out.eventPrefix,stage:out.residualStage,steps:out.steps,physicalGoal:out.physicalGoal===true,verified:out.verified===true,continuation:'post-goal-speed'});
 if(job.purpose==='trial'){
  t.iterations++;s.tailProbes++;
  if(out.topologyMatched&&out.inequalities.every(v=>Number.isFinite(v)&&v<=0)) {t.settings={...job.settings};t.phase='verify';}
  else t.low=job.settings.speed;
 }else{
  s.tailVerifications++;
  if(out.verified===true){s.results.push({...out.physicalResult,method:t.branch.method,inverseBranch:t.branch.id,searchModel:{stage:'event-aware-inverse-tail-solution',topologyId:t.branch.id}});s.tail=null;}
  else {t.high=job.settings.speed;t.phase='trial';}
 }
}
function result(s){return {...base.result(s),tailContinuationPending:!!s.tail,tailProbes:s.tailProbes,tailVerifications:s.tailVerifications};}
G.LabEventTailSearchWindow={...base,create,next,accept,result};
})(globalThis);
