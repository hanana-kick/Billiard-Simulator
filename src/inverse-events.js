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
function sample(e,continuous=false){
 if(e.mismatch||e.eventPrefix>=e.expected.length||!e.trial)return;
 const i=e.eventPrefix,wanted=e.expected[i],lab=e.trial.lab,cue=lab.get(e.req.selectedId);
 let residual,measurement=null;
 if(wanted.kind==='object'){
  const target=lab.get(wanted.id);if(!target){e.unavailable='missing-target';return;}
  measurement={stage:i,cue:{...cue.body.translation()},target:{...target.body.translation()},radius:cue.radius+target.radius};
  residual=surfaceResidual(axes.map(k=>measurement.cue[k]-measurement.target[k]),measurement.radius);
 }else{
  const rail=lab.statics.find(o=>o.kind==='cushion'&&G.LabRouteRules.railId(o)===wanted.rail);
  if(!rail?.collider?.projectPoint){e.unavailable='missing-cushion-geometry';return;}
  residual=railResidual(cue,rail);
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
function observeEpisodes(e,time,stepDt){
 const cue=e.cue,p=cue.body.translation(),world=e.trial.lab.world;
 for(const {other,cushion,rail,key,cueCollider,otherCollider} of e.episodeTargets){
  const pair=e.pairs.get(key)||{active:false};let impact=false;
  world.contactPair(cueCollider,otherCollider,m=>{
   for(let i=0;i<m.numContacts();i++)if(m.contactImpulse(i)>0)impact=true;
  });
  if(!pair.active&&!impact)continue;
  let separation;
  if(cushion){const projection=other.collider.projectPoint(p,true);separation=projection.isInside?-cue.radius:Math.hypot(...axes.map(k=>p[k]-projection.point[k]))-cue.radius;}
  else{const q=other.body.translation();separation=Math.hypot(...axes.map(k=>p[k]-q[k]))-cue.radius-other.radius;}
  if(separation>.00005)pair.active=false;
  if(impact&&!pair.active){
   const event=cushion?{kind:'cushion',rail,time:time-e.trial.start}:{kind:'object',id:other.id,time:time-e.trial.start};
   event.stepDt=stepDt;event.stepIndex=e.observedSubsteps;
   e.pending.push(event);
   if(!cushion&&!e.firstImpact)e.firstImpact=event;
   pair.active=true;
  }
  e.pairs.set(key,pair);
 }
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
 const expected=expectedEvents(topology),strictReq={...req,testBudget:true,settings:{...req.settings,elevation:settings.elevation},options:{...req.options,budget:1,elevationMode:'fixed',inputStrategy:'hybrid',targetId:topology.firstId??req.options.targetId,secondId:topology.secondId??req.options.secondId,methodId:topology.method??req.options.methodId,methods:undefined}};
 G.ShotSearchCore.validate(strictReq);
 const e={req,settings:{...settings},expected,topologyId:topology.id||topology.topologyId||JSON.stringify(expected),purpose:options.purpose||'evaluate',eventPrefix:0,stageResiduals:expected.map(()=>null),events:[],pending:[],pairs:new Map(),returnStages:new Map(),mismatch:null,done:false,disposed:false,inequalities:inputInequalities(req,settings)};
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
 if(!e.trial){e.done=true;e.clearance=search.feasibility?.distance??null;e.inequalities.unshift(e.clearance===null?1:-e.clearance);e.blockedReason=e.clearance===null?'strike-rejected':'cue-clearance';return e;}
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
 e.originalWorldStep=lab.world.step;e.observedSubsteps=0;
 e.observedWorldStep=function(...args){
  const stepDt=lab.world.integrationParameters.dt,time=lab.time+stepDt;
  const result=e.originalWorldStep.apply(this,args);
  e.observedSubsteps++;
  observeEpisodes(e,time,stepDt);
  // An impact ends the old smooth segment. Endpoint geometry may be observed,
  // but never interpolate across a collision or an event-prefix transition.
  if(e.pending.length){sample(e);consume(e);e.previousMeasurement=null;sample(e);}
  else sample(e,true);
  return result;
 };
 try{lab.world.step=e.observedWorldStep;if(lab.world.step!==e.observedWorldStep)throw new Error('World step instrumentation unavailable');}
 catch(error){dispose(e);throw error;}
 sample(e);return e;
}
function advance(e,stepBatch=240){
 if(e.done)return true;
 if(!Number.isInteger(stepBatch)||stepBatch<1)throw new Error('Positive step batch required');
 try{
  for(let i=0;i<stepBatch&&!e.done;i++){
   e.done=G.ShotSearchCore.stepTrial(e.search,e.trial,1);
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
 if(e.trial){restoreObserver(e);physicalResult=G.ShotSearchCore.finishTrial(e.search,e.trial);e.disposed=true;}
 const topologyMatched=!e.mismatch&&e.eventPrefix===e.expected.length;
 const active=topologyMatched?e.expected.length:e.eventPrefix;
 const residual=topologyMatched?zero():e.stageResiduals[active];
 const goalVerified=!!physicalResult?.success&&topologyMatched&&e.inequalities.every(v=>Number.isFinite(v)&&v<=0);
 const firstImpactTime=e.firstImpact?.time??null;
 const firstImpactCell=e.firstImpact?JSON.stringify([e.firstImpact.id,e.firstImpact.stepDt,Math.round(e.firstImpact.time/e.firstImpact.stepDt)]):null;
 const status=goalVerified?'goal-verified':e.blockedReason||e.unavailable||(e.mismatch?'topology-mismatch':topologyMatched?(physicalResult?.failureReason||'physical-goal-rejected'):'missing-event');
 e.result={id:e.topologyId,settings:e.settings,residual,residuals:residual||zero(),residualAvailable:!!residual,
  residualStage:e.blockedReason?'clearance':active,eventPrefix:e.eventPrefix,stageResiduals:e.stageResiduals,
  inequalities:e.inequalities,clearance:e.clearance,topologyMatched,goalVerified,verified:e.purpose==='verify'&&goalVerified,
  purpose:e.purpose,status,firstImpactCell,contactCell:firstImpactCell,firstImpactTime,physicalResult,steps:e.trial?.steps||0,events:e.events,mismatch:e.mismatch,
  unsupported:!!e.unavailable,missingEvent:topologyMatched?null:e.expected[active],freshReplay:true,eventResolution:'solver-substep',substepOrderResolved:true,observedSubsteps:e.observedSubsteps||0};
 return e.result;
}
function restoreObserver(e){if(e.originalWorldStep&&e.trial?.lab?.world)e.trial.lab.world.step=e.originalWorldStep;}
function dispose(e){if(e.trial&&!e.disposed){restoreObserver(e);e.trial.lab.dispose();e.disposed=true;}e.done=true;}
G.LabInverseEvents={begin,advance,finish,dispose,expectedEvents,inputInequalities,sphereResidual,relativeSegmentResidual,railResidual};
})(globalThis);
