/* Ordered physical-event residuals for cue-input inversion.
 * Residuals are geometric observations, never fabricated contacts or trajectories.
 * Only the currently reachable event stage is differentiated. Missing later stages
 * stay null; eventPrefix/residualStage must accompany every Jacobian probe.
 */
(function(G){
'use strict';
const axes=['x','y','z'];
const zero=()=>[0,0,0];
const norm=v=>Math.hypot(...v);
function expectedEvents(topology){
 const source=topology?.events||topology?.topology?.events;
 if(!Array.isArray(source)||!source.length)throw new Error('An explicit ordered contact topology is required');
 return source.map(e=>{
  if(e.kind==='object'&&Number.isInteger(e.id))return{kind:'object',id:e.id};
  if(e.kind==='cushion'&&['x+','x-','z+','z-'].includes(e.rail))return{kind:'cushion',rail:e.rail};
  throw new Error('Invalid inverse event');
 });
}
function same(a,b){return a.kind===b.kind&&(a.kind==='object'?a.id===b.id:a.rail===b.rail);}
function inputInequalities(req,s){
 const o=req.options;
 return [ (o.minSpeed??.5)-s.speed,s.speed-(o.maxSpeed??4.5),
  (o.elevationMode==='search'?(o.minElevation??0):req.settings.elevation)-s.elevation,
  s.elevation-(o.elevationMode==='search'?(o.maxElevation??85):req.settings.elevation),
  Math.abs(s.tipX)-.55,Math.abs(s.tipY)-.45,Math.hypot(s.tipX,s.tipY)-.6,
  o.spin?-1:Math.hypot(s.tipX,s.tipY) ];
}
// Signed Cartesian vector to the spherical contact boundary. Unlike a scalar
// unsigned miss this retains side and height for finite-difference correction.
function surfaceResidual(v,radius){
 const d=norm(v),gap=Math.max(0,d-radius);
 return d>1e-14?v.map(x=>x*gap/d):zero();
}
function sphereResidual(cue,target){
 const p=cue.body.translation(),q=target.body.translation();
 return surfaceResidual(axes.map(k=>p[k]-q[k]),cue.radius+target.radius);
}
// Measurement only: a straight chord through two observed relative positions.
// It never creates an event, changes the simulation, or certifies a contact.
function relativeSegmentResidual(cue0,target0,cue1,target1,radius){
 const r0=axes.map(k=>cue0[k]-target0[k]),r1=axes.map(k=>cue1[k]-target1[k]);
 const d=r1.map((v,i)=>v-r0[i]),dd=d.reduce((sum,v)=>sum+v*v,0);
 const u=dd>1e-24?Math.max(0,Math.min(1,-r0.reduce((sum,v,i)=>sum+v*d[i],0)/dd)):0;
 return surfaceResidual(r0.map((v,i)=>v+u*d[i]),radius);
}
function railResidual(cue,rail){
 // Query the actual convex cushion, not an ideal reflected table plane. This
 // includes the cushion crown and rejects apparent 2D contacts above the rail.
 const p=cue.body.translation(),projection=rail.collider.projectPoint(p,true);
 const v=axes.map(k=>p[k]-projection.point[k]),d=norm(v),gap=Math.max(0,d-cue.radius);
 return d>1e-14?v.map(x=>x*gap/d):zero();
}
function sampleObservation(e,frame,continuous=false){
 if(e.mismatch||e.eventPrefix>=e.expected.length)return;
 const i=e.eventPrefix,wanted=e.expected[i],cue=frame.cue;
 let residual,measurement=null;
 if(wanted.kind==='object'){
  const target=frame.objects.find(o=>o.id===wanted.id);if(!target){e.unavailable='missing-target';return;}
  measurement={stage:i,cue:{...cue.position},target:{...target.position},radius:cue.radius+target.radius};
  residual=surfaceResidual(axes.map(k=>measurement.cue[k]-measurement.target[k]),measurement.radius);
 }else{
  const rail=frame.rails.find(o=>o.rail===wanted.rail);
  if(!rail?.projection){e.unavailable='missing-cushion-geometry';return;}
  const v=axes.map(k=>cue.position[k]-rail.projection.point[k]),d=norm(v),gap=Math.max(0,d-cue.radius);
  residual=d>1e-14?v.map(x=>x*gap/d):zero();
 }
 if(!residual.every(Number.isFinite))throw new Error('Nonfinite inverse event residual');
 // A consecutive repeat means leave and RETURN, not remain on the previous
 // contact boundary. Do not make its residual zero during persistent contact,
 // or minimize over the initially departing leg just after separation.
 if(i>0&&same(wanted,e.expected[i-1])){
  const key=wanted.kind==='object'?'object:'+wanted.id:'cushion:'+wanted.rail;
  if(e.pairs.get(key)?.active){e.previousMeasurement=null;return;}
  const gap=norm(residual),previous=e.returnStages.get(i);
  if(!previous){e.returnStages.set(i,{gap,returning:false});e.previousMeasurement=null;return;}
  if(gap<previous.gap-1e-10)previous.returning=true;
  previous.gap=gap;if(!previous.returning){e.previousMeasurement=null;return;}
 }
 const previous=e.previousMeasurement;
 if(measurement&&continuous&&previous?.stage===i){
  const segment=relativeSegmentResidual(previous.cue,previous.target,measurement.cue,measurement.target,measurement.radius);
  if(norm(segment)<norm(residual))residual=segment;
 }
 e.previousMeasurement=measurement;
 const old=e.stageResiduals[i];
 if(!old||norm(residual)<norm(old))e.stageResiduals[i]=residual;
}
// Contact episodes come from solver impulses, not PhysicsLab's presentation
// log (which intentionally suppresses repeated contacts within 120 ms).
function observeEpisodes(e,frame){
 const cue=frame.cue,p=cue.position;
 for(const other of [...frame.objects,...frame.rails]){
  const cushion=other.rail!=null,rail=other.rail,key=cushion?'cushion:'+rail:'object:'+other.id;
  const pair=e.pairs.get(key)||{active:false},impact=other.impact;
  if(!pair.active&&!impact)continue;
  let separation;
  if(cushion){const projection=other.projection;separation=projection.isInside?-cue.radius:Math.hypot(...axes.map(k=>p[k]-projection.point[k]))-cue.radius;}
  else{const q=other.position;separation=Math.hypot(...axes.map(k=>p[k]-q[k]))-cue.radius-other.radius;}
  if(separation>.00005)pair.active=false;
  if(impact&&!pair.active){
   const event=cushion?{kind:'cushion',rail,time:frame.time-e.observationStart}:{kind:'object',id:other.id,time:frame.time-e.observationStart};
   event.stepDt=frame.stepDt;event.stepIndex=e.observedSubsteps;
   e.pending.push(event);
   if(!cushion&&!e.firstImpact)e.firstImpact=event;
   pair.active=true;
  }
  e.pairs.set(key,pair);
 }
}
// Plain, detached data only. This is an observation boundary, not proof that a
// producer used GPU physics. GPU transactions must publish only after commit.
const OBSERVATION_PHASE='after-world-step-before-application';
function createObservation(topology,start=0){
 if(!Number.isFinite(start))throw Error('Finite observation start time required');
 const expected=expectedEvents(topology);
 return {expected,observationStart:start,eventPrefix:0,stageResiduals:expected.map(()=>null),
  events:[],pending:[],pairs:new Map(),returnStages:new Map(),mismatch:null,observedSubsteps:0,lastObservationTime:start,initialObserved:false};
}
function validateObservation(frame,initial){
 const vector=v=>v&&axes.every(k=>Number.isFinite(v[k]));
 if(!frame||frame.phase!==(initial?'initial-before-world-step':OBSERVATION_PHASE)||!Number.isFinite(frame.time)||
  !(initial?frame.stepDt===0:Number.isFinite(frame.stepDt)&&frame.stepDt>0)||!vector(frame.cue?.position)||!(Number.isFinite(frame.cue?.radius)&&frame.cue.radius>0)||
  !Array.isArray(frame.objects)||!Array.isArray(frame.rails))throw Error('Exact post-world-step observation required');
 const ids=new Set(),rails=new Set();
 for(const o of frame.objects){if(!Number.isInteger(o.id)||ids.has(o.id)||!vector(o.position)||!(Number.isFinite(o.radius)&&o.radius>0)||typeof o.impact!=='boolean')throw Error('Invalid object observation');ids.add(o.id);}
 for(const r of frame.rails){if(!['x+','x-','z+','z-'].includes(r.rail)||rails.has(r.rail)||typeof r.impact!=='boolean'||
  r.projection!==null&&(!vector(r.projection?.point)||typeof r.projection.isInside!=='boolean')||r.impact&&!r.projection)throw Error('Invalid cushion observation');rails.add(r.rail);}
}
function observeInitial(e,frame){validateObservation(frame,true);if(e.initialObserved||frame.sequence!==0||e.observedSubsteps!==0||frame.time!==e.observationStart)throw Error('Initial observation boundary mismatch');sampleObservation(e,frame);e.lastObservationTime=frame.time;e.initialObserved=true;}
function observeSubstep(e,frame){
 validateObservation(frame,false);
 if(frame.sequence!==e.observedSubsteps+1||frame.time<=e.lastObservationTime)throw Error('Stale or out-of-order observation');
 for(const r of frame.rails)if(e.pairs.get('cushion:'+r.rail)?.active&&!r.projection)throw Error('Active cushion requires projection');
 reduceSubstep(e,frame);
}
function reduceSubstep(e,frame){
 e.observedSubsteps++;e.lastObservationTime=frame.time;
 observeEpisodes(e,frame);
 // Never interpolate across an impact or event-prefix transition.
 if(e.pending.length){sampleObservation(e,frame);consume(e);e.previousMeasurement=null;sampleObservation(e,frame);}
 else sampleObservation(e,frame,true);
}
function readNativeObservation(e,time,stepDt,initial=false){
 const lab=e.trial.lab,cue=e.cue,p={...cue.body.translation()},objects=[],rails=[];
 for(const {other,cushion,rail,cueCollider,otherCollider} of e.episodeTargets){
  let impact=false;
  if(!initial)lab.world.contactPair(cueCollider,otherCollider,m=>{
   for(let i=0;i<m.numContacts();i++)if(m.contactImpulse(i)>0)impact=true;
  });
  if(cushion){let sampled=false,projection;rails.push({rail,impact,get projection(){if(!sampled){const result=other.collider.projectPoint?.(p,true);projection=result?{point:{...result.point},isInside:!!result.isInside}:null;sampled=true;}return projection;}});}
  else objects.push({id:other.id,radius:other.radius,position:{...other.body.translation()},impact});
 }
 return {phase:initial?'initial-before-world-step':OBSERVATION_PHASE,sequence:initial?0:e.observedSubsteps+1,time,stepDt,cue:{radius:cue.radius,position:p},objects,rails};
}

function consume(e){
 const pending=e.pending.splice(0).sort((a,b)=>a.time-b.time);
 for(let k=0;k<pending.length;){
  let j=k+1;while(j<pending.length&&Math.abs(pending[j].time-pending[k].time)<1e-9)j++;
  const group=pending.slice(k,j).filter((x,i,a)=>a.findIndex(y=>same(x,y))===i);
  e.events.push(...group);
  if(!e.mismatch&&e.eventPrefix<e.expected.length){
   if(group.length!==1)e.mismatch={stage:e.eventPrefix,reason:'ambiguous-simultaneous-events',actual:group};
   else if(!same(group[0],e.expected[e.eventPrefix]))e.mismatch={stage:e.eventPrefix,reason:'unexpected-event',expected:e.expected[e.eventPrefix],actual:group[0]};
   else{e.stageResiduals[e.eventPrefix]=zero();e.eventPrefix++;}
  }
  k=j;
 }
}
function begin(R,req,topology,settings,options={}){
 if(!settings||!['angle','elevation','speed','tipX','tipY'].every(k=>Number.isFinite(settings[k])))throw new Error('Finite cue inputs required');
 let finalizationPolicy=null;
 if(req.finalization!==undefined){
  if(req.finalization?.kind!=='source-finalization-request-v1'||!['source-route-query-v1','source-gameplay-finalization-v1'].includes(req.finalization.policy))throw new Error('Unknown explicit source finalization policy');
  if(req.finalization.policy==='source-gameplay-finalization-v1'&&options.purpose==='verify'){
   if(!G.LabSourceFinalizationRequest)throw new Error('Explicit source finalization admission is unavailable');
   finalizationPolicy=G.LabSourceFinalizationRequest.policyFor(options.finalizationAdmission,req,topology,'verify');
   if(finalizationPolicy?.effective!=='final-gameplay-verify'||!G.LabSourceGameplayFinalizationOwner||!G.ThreeBallGame||!G.FourBallGame||!G.ShotSearchCore.stepTrialOuter)throw new Error('Admitted original gameplay continuation modules are required');
  }
 }
 const expected=expectedEvents(topology),strictReq={...req,testBudget:true,settings:{...req.settings,elevation:settings.elevation},options:{...req.options,budget:1,elevationMode:'fixed',inputStrategy:'hybrid',targetId:topology.firstId??req.options.targetId,secondId:topology.secondId??req.options.secondId,methodId:topology.method??req.options.methodId,methods:undefined}};
 G.ShotSearchCore.validate(strictReq);
 const e={...createObservation(topology),req,settings:{...settings},expected,topologyId:topology.id||topology.topologyId||JSON.stringify(expected),purpose:options.purpose||'evaluate',done:false,disposed:false,inequalities:inputInequalities(req,settings)};
 if(finalizationPolicy?.effective==='final-gameplay-verify'){e.finalizationPolicy=finalizationPolicy;e.finalizationIdentity=G.LabSourceFinalizationRequest.evaluationBindingFor(options.finalizationAdmission,req,topology,settings,'verify');}
 // A feasibility query observes geometry only. It never launches a candidate
 // or certifies a shot; an independent normal stroke/replay remains required.
 if(e.purpose==='clearance'){
  const lab=G.PhysicsLab.fromSnapshot(R,req.snapshot);
  try{
   const clearance=lab.cueClearance(lab.get(req.selectedId),e.settings);
   e.clearance=clearance.distance;e.inequalities.unshift(-clearance.distance);
   e.blockedReason=clearance.clear?'clearance-feasible':'cue-clearance';e.done=true;
  }finally{lab.dispose();}
  return e;
 }
 // beginTrial's automatic pose restoration is disabled only in its private
 // request. The caller's input constraints above remain authoritative.
 const search={R,req:strictReq,count:1,pool:[],successes:[],evaluated:0,rejected:0,successCount:0,started:performance.now()};
 e.search=search;e.trial=G.ShotSearchCore.beginTrial(search,e.settings);
 if(!e.trial){e.done=true;e.clearance=search.feasibility?.distance??null;e.inequalities.unshift(e.clearance===null?1:-e.clearance);e.blockedReason=e.clearance===null?'strike-rejected':'cue-clearance';if(e.finalizationPolicy)e.finalizationReceipt=G.LabSourceGameplayFinalizationOwner.rejected(e.finalizationPolicy,e.blockedReason,e.finalizationIdentity);return e;}
 if(e.finalizationPolicy){try{e.finalizationOwner=G.LabSourceGameplayFinalizationOwner.create(e.finalizationPolicy,search,e.trial,e.finalizationIdentity);}catch(error){dispose(e);throw error;}}
 const lab=e.trial.lab,clearance=lab.cueClearance(lab.get(req.selectedId),e.settings);
 e.clearance=clearance.distance;e.inequalities.unshift(-clearance.distance);
 // Keep the core's physical event handler intact. Its scoring remains
 // authoritative; the inverse topology has an independent impulse stream.
 // Instrument only this fresh world's instance. The original solver call,
 // collision queue and PhysicsLab callback order are left completely intact.
 // PhysicsLab increments lab.time immediately AFTER world.step returns.
 e.cue=lab.get(req.selectedId);
 e.episodeTargets=[...lab.objects.filter(o=>o.id!==e.cue.id&&o.shape==='sphere'),...lab.statics.filter(o=>o.kind==='cushion')].map(other=>{
  const cushion=other.kind==='cushion',rail=cushion?G.LabRouteRules.railId(other):null;
  return{other,cushion,rail,key:cushion?'cushion:'+rail:'object:'+other.id,cueCollider:cushion?e.cue.collider:(e.cue.pairCollider||e.cue.collider),otherCollider:cushion?other.collider:(other.pairCollider||other.collider)};
 });
 e.originalWorldStep=lab.world.step;e.observedSubsteps=0;e.observationStart=e.trial.start;
 e.observedWorldStep=function(...args){
  const stepDt=lab.world.integrationParameters.dt,time=lab.time+stepDt;
  const result=e.originalWorldStep.apply(this,args);
  // Private native frame keeps exact demand-driven convex queries. It never
  // crosses the public plain-data boundary or escapes into retained state.
  reduceSubstep(e,readNativeObservation(e,time,stepDt));
  return result;
 };
 try{lab.world.step=e.observedWorldStep;if(lab.world.step!==e.observedWorldStep)throw new Error('World step instrumentation unavailable');}
 catch(error){dispose(e);throw error;}
 sampleObservation(e,readNativeObservation(e,lab.time,0,true));e.lastObservationTime=lab.time;e.initialObserved=true;return e;
}
function advance(e,stepBatch=240){
 if(e.done)return true;
 if(!Number.isInteger(stepBatch)||stepBatch<1)throw new Error('Positive step batch required');
 try{
  for(let i=0;i<stepBatch&&!e.done;i++){
   e.done=e.finalizationOwner?G.LabSourceGameplayFinalizationOwner.advance(e.finalizationOwner,complete=>finalizationRoute(e,complete)):G.ShotSearchCore.stepTrial(e.search,e.trial,1);
   if(e.finalizationOwner&&e.unavailable){e.finalizationReceipt=G.LabSourceGameplayFinalizationOwner.interrupt(e.finalizationOwner,'unsupported',e.unavailable);e.done=true;}
   // Observation already ran after EACH underlying solver step, including
   // every cue substep. Never replay the final impulse at the outer boundary.
  }
 }catch(error){dispose(e);throw error;}
 return e.done;
}
function finish(e){
 if(e.result)return e.result;
 if(!e.done)throw new Error('Inverse event evaluation is still running');
 if(e.disposed)throw new Error('Inverse event evaluation was disposed without completion');
 let physicalResult=null;
 if(e.trial){
  restoreObserver(e);
  if(e.finalizationOwner){
   physicalResult=G.ShotSearchCore.physicalResult(e.search.req.options,e.trial,e.trial.lab.time);
   e.finalizationReceipt=e.finalizationReceipt||G.LabSourceGameplayFinalizationOwner.result(e.finalizationOwner);
   G.LabSourceGameplayFinalizationOwner.restore(e.finalizationOwner);e.trial.lab.dispose();
  }else physicalResult=G.ShotSearchCore.finishTrial(e.search,e.trial);
  e.disposed=true;
 }
 const result=projectResult(e,physicalResult,e.trial?.steps||0);
 if(!e.finalizationPolicy)return e.result=result;
 const finalization=e.finalizationReceipt,qualified=finalization?.status==='verified-final-gameplay'&&finalization.gameplayVerified===true;
 if(!finalization)throw new Error('Missing terminal gameplay decision');
 if(qualified&&(!result.goalVerified||!result.physicalResult?.success))throw new Error('Final gameplay proof disagrees with original route projection');
 if(['incomplete','cancelled','stale','unsupported','failed'].includes(finalization.status)){
  // A retained query prefix is diagnostic data only, not an evaluated terminal
  // solver residual. In particular do not invent unavailable-zero carriers.
  return e.result={id:e.topologyId,settings:e.settings,purpose:e.purpose,steps:e.trial?.steps||0,
   status:finalization.status,reason:finalization.reason,finalization,verification:{finalization},
   verified:false,goalVerified:false,physicalResult:null,incomplete:finalization.status==='incomplete',
   unsupported:finalization.status==='unsupported',routeQueryObservation:result};
 }
 // Preserve the original route-query values separately. A pending foul or
 // unfinished gameplay is NOT a fabricated original physical miss/score.
 return e.result={...result,routeQueryPhysicalResult:result.physicalResult,routeQueryGoalVerified:result.goalVerified,
  physicalResult:qualified?result.physicalResult:null,goalVerified:qualified,verified:qualified,
  status:finalization.status,reason:finalization.reason,finalization,verification:{finalization},
  incomplete:finalization.status==='incomplete',unsupported:finalization.status==='unsupported'};
}
function finalizationRoute(e,complete){
 const t=e.trial,matched=!e.mismatch&&e.eventPrefix===e.expected.length,feasible=e.inequalities.every(v=>Number.isFinite(v)&&v<=0);
 const rejected=!!e.mismatch||!feasible||!!t.invalid&&!t.verificationIncomplete;
 return{complete:complete||rejected,goalSatisfied:t.success&&!t.invalid&&matched&&feasible,irreversiblyRejected:rejected};
}
// Optional explicit interruption publishes no successful result and cannot
// convert cancellation, request timeout, or an unfinished horizon into a miss.
function interrupt(e,status,reason=null){
 if(!e.finalizationOwner||e.done||e.disposed)throw new Error('Active admitted gameplay verification required');
 e.finalizationReceipt=G.LabSourceGameplayFinalizationOwner.interrupt(e.finalizationOwner,status,reason);e.done=true;
 return finish(e);
}
// Pure final-result projection shared by native trials and committed GPU observations.
function projectResult(e,physicalResult,steps){
 const topologyMatched=!e.mismatch&&e.eventPrefix===e.expected.length;
 const active=topologyMatched?e.expected.length:e.eventPrefix;
 const residual=topologyMatched?zero():e.stageResiduals[active];
 const goalVerified=!!physicalResult?.success&&topologyMatched&&e.inequalities.every(v=>Number.isFinite(v)&&v<=0);
 const firstImpactTime=e.firstImpact?.time??null;
 const firstImpactCell=e.firstImpact?JSON.stringify([e.firstImpact.id,e.firstImpact.stepDt,Math.round(e.firstImpact.time/e.firstImpact.stepDt)]):null;
 const status=goalVerified?'goal-verified':e.blockedReason||e.unavailable||(e.mismatch?'topology-mismatch':topologyMatched?(physicalResult?.failureReason||'physical-goal-rejected'):'missing-event');
 return {id:e.topologyId,settings:e.settings,residual,residuals:residual||zero(),residualAvailable:!!residual,
  residualStage:e.blockedReason?'clearance':active,eventPrefix:e.eventPrefix,stageResiduals:e.stageResiduals,
  inequalities:e.inequalities,clearance:e.clearance,topologyMatched,goalVerified,verified:e.purpose==='verify'&&goalVerified,
  purpose:e.purpose,status,firstImpactCell,contactCell:firstImpactCell,firstImpactTime,physicalResult,steps,events:e.events,mismatch:e.mismatch,
  unsupported:!!e.unavailable,missingEvent:topologyMatched?null:e.expected[active],freshReplay:true,eventResolution:'solver-substep',substepOrderResolved:true,observedSubsteps:e.observedSubsteps||0};
}
function restoreObserver(e){if(e.originalWorldStep&&e.trial?.lab?.world)e.trial.lab.world.step=e.originalWorldStep;}
function dispose(e){if(e.trial&&!e.disposed){restoreObserver(e);if(e.finalizationOwner)G.LabSourceGameplayFinalizationOwner.restore(e.finalizationOwner);e.trial.lab.dispose();e.disposed=true;}e.done=true;}
G.LabInverseEvents={observation:Object.freeze({phase:OBSERVATION_PHASE,create:createObservation,initial:observeInitial,step:observeSubstep}),projectResult,begin,advance,finish,interrupt,dispose,expectedEvents,inputInequalities,sphereResidual,relativeSegmentResidual,railResidual};
})(globalThis);
