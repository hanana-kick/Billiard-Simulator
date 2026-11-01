// Explicit same-realm GPU evaluation only. No candidate proposal, native replay,
// CPU fallback, public backend selection, or worker transport.
import './math.js';
import './route-rules.js';
import './optimizer-core.js';
import './inverse-events.js';
import './experimental-four-ball-world.js';
import {createGpuBatchStepper} from './experimental-four-ball-batch-world.mjs';
import {createFourBallPhysicalScoring} from './experimental-four-ball-physical-scoring.mjs';
import {assertPreparedLiveFourBallCandidate} from './browser-initial-import/prepare-live-candidate.mjs';
import {equalData} from './browser-initial-import/exact-data.mjs';
const World=globalThis.LabFourBallWorldExperimental,Inverse=globalThis.LabInverseEvents,Core=globalThis.ShotSearchCore;
const copy=structuredClone, message=e=>String(e?.message??e);
const need=(ok,text)=>{if(!ok)throw new Error(text);};
function ownJob(job,index){
 need(job&&Object.keys(job).every(k=>['prepared','req','topology','settings','purpose'].includes(k)),'Explicit candidate job fields required');
 const req=copy(job.req),topology=copy(job.topology),settings=copy(job.settings),purpose=job.purpose??'evaluate';
 const prepared=assertPreparedLiveFourBallCandidate(job.prepared,req.snapshot);
 need(['evaluate','residual','jacobian','trial','verify'].includes(purpose),'Only original physical inverse purposes are supported');
 need(req.options?.gameMode==='four'&&req.options.mode==='carom','Only original four-ball carom search is supported');
 need(['angle','elevation','speed','tipX','tipY'].every(k=>Number.isFinite(settings?.[k])),'Finite candidate controls required');
 equalData(settings,prepared.admission.settings,'Candidate controls differ from prepared stroke');
 need(req.selectedId===prepared.admission.selectedId,'Selected cue differs from prepared source');
 need(req.options.fourBallThreeCushion===prepared.admission.rules.fourBallThreeCushion,'Per-shot rule differs from prepared stroke');
 const strictReq={...req,testBudget:true,settings:{...req.settings,elevation:settings.elevation},options:{...req.options,budget:1,elevationMode:'fixed',inputStrategy:'hybrid',targetId:topology.firstId??req.options.targetId,secondId:topology.secondId??req.options.secondId,methodId:topology.method??req.options.methodId,methods:undefined}};
 Core.validate(strictReq);
 const observation=Inverse.observation.create(topology,prepared.admission.time);
 Object.assign(observation,{req,settings,topologyId:topology.id||topology.topologyId||JSON.stringify(observation.expected),purpose,
  inequalities:[-prepared.admission.clearance.distance,...Inverse.inputInequalities(req,settings)],clearance:prepared.admission.clearance.distance});
 return {index,prepared,observation,request:{...strictReq,settings:copy(prepared.admission.settings)},scorer:null,done:false,steps:0};
}
/** getSourceRevision must read the caller's current visible source synchronously.
 * It is checked before dispatch and again before any final result publication.
 * A stale wave never returns candidate results for committing to the live source.
 */
export async function evaluateInverseGpuWave(options){
 need(options&&Object.keys(options).every(k=>['backend','device','candidates','getSourceRevision','signal'].includes(k)),'Unknown GPU wave option');
 const {backend,device,candidates,getSourceRevision,signal}=options;
 need(backend==='webgpu','Explicit webgpu backend required; no CPU fallback');
 need(device?.createBuffer&&device?.queue,'Actual GPUDevice required');
 need(Array.isArray(candidates)&&candidates.length>=1&&candidates.length<=4,'One to four prepared candidate jobs required');
 need(typeof getSourceRevision==='function','Current source revision reader required');
 need(!signal||(typeof signal.aborted==='boolean'&&typeof signal.addEventListener==='function'),'AbortSignal required');
 const outcomes=candidates.map((_,index)=>({index,status:'pending',result:null,committedSteps:0})),jobs=[];
 for(let i=0;i<candidates.length;i++)try{jobs.push(ownJob(candidates[i],i));}catch(error){Object.assign(outcomes[i],{status:'unsupported',reason:message(error)});}
 if(!jobs.length)return {backend,results:outcomes};
 const revision=jobs[0].prepared.admission.sourceRevision,source=jobs[0].observation.req.snapshot.world;
 for(const job of jobs){need(job.prepared.admission.sourceRevision===revision,'A wave requires one source revision');equalData(job.observation.req.snapshot.world,source,'A wave requires one original source snapshot');}
 const stale=()=>getSourceRevision()!==revision;
 const markRemaining=(status,reason)=>{for(const row of outcomes)if(row.status==='pending')Object.assign(row,{status,reason});};
 const cancelResults=()=>{for(const row of outcomes)if(['pending','evaluated'].includes(row.status))Object.assign(row,{status:'cancelled',result:null,reason:message(signal.reason??'Wave cancelled')});};
 const invalidate=()=>{for(const row of outcomes)if(row.status!=='unsupported')Object.assign(row,{status:'stale',result:null,reason:'Source revision changed'});};
 if(stale()){invalidate();return {backend,sourceRevision:revision,results:outcomes};}
 if(signal?.aborted){markRemaining('cancelled',message(signal.reason??'Wave cancelled'));return {backend,sourceRevision:revision,results:outcomes};}
 let batch=null,single=null;const execution={mode:jobs.length===1?'single':'batch'};
 const apply=(job,state)=>{
  const row=outcomes[job.index];job.steps=state.frame;row.committedSteps=state.frame;
  Inverse.observation.step(job.observation,state.inverseObservation);
  const status=job.scorer.consume(state);
  if(status.done){job.done=true;row.status='evaluated';row.result=Inverse.projectResult(job.observation,job.scorer.finish(),status.steps);row.worldStatus=state.shotComplete?'complete':'stopped';}
  else need(!state.shotComplete,'World completed before physical scoring boundary');
 };
 try{
  if(jobs.length===1){single=await World.createGpuStepper(device,jobs[0].prepared.seed,{observeInverse:true});}
  else batch=await createGpuBatchStepper(device,jobs.map(j=>j.prepared.seed),{ids:jobs.map(j=>'candidate-'+j.index),observeInverse:true});
  const initial=batch?batch.snapshot().slots: [{status:'ready',state:single.snapshot()}];
  for(let i=0;i<jobs.length;i++){
   const job=jobs[i],slot=initial[i];if(slot.status!=='ready'){job.done=true;Object.assign(outcomes[job.index],{status:slot.status==='unsupported'?'unsupported':'failed',reason:slot.reason});continue;}
   try{job.scorer=createFourBallPhysicalScoring({seed:job.prepared.seed,initial:slot.state,request:job.request,admission:job.prepared.admission});Inverse.observation.initial(job.observation,slot.state.inverseObservation);}
   catch(error){job.done=true;Object.assign(outcomes[job.index],{status:'unsupported',reason:message(error)});batch?.stopOwner('candidate-'+job.index,'Unsupported scoring admission');}
  }
  while(jobs.some(j=>!j.done)){
   if(stale()){invalidate();break;}
   if(signal?.aborted){markRemaining('cancelled',message(signal.reason??'Wave cancelled'));break;}
   if(batch){
    const out=await batch.step({signal});
    for(let i=0;i<jobs.length;i++){
     const job=jobs[i];if(job.done)continue;const slot=out.slots[i],row=outcomes[job.index];
     if(!['ready','complete'].includes(slot.status)){job.done=true;Object.assign(row,{status:slot.status==='cancelled'?'cancelled':slot.status==='unsupported'?'unsupported':'failed',reason:slot.reason??slot.status,committedSteps:slot.committedSteps});continue;}
     try{apply(job,slot.state);if(job.done&&slot.status==='ready')batch.stopOwner(slot.id,'Physical scorer reached original stopping boundary');}
     catch(error){job.done=true;Object.assign(row,{status:'failed',result:null,reason:message(error)});if(slot.status==='ready')batch.stopOwner(slot.id,'Observation/scoring failed');}
    }
   }else{
    const job=jobs[0];try{need(job.steps<65536,'Per-candidate committed step limit reached before scoring completion');const state=await single.step();if(signal?.aborted){job.done=true;Object.assign(outcomes[job.index],{status:'cancelled',reason:message(signal.reason??'Wave cancelled'),committedSteps:state.frame});}else apply(job,state);}
    catch(error){job.done=true;Object.assign(outcomes[job.index],{status:'failed',result:null,reason:message(error)});}
   }
  }
  if(stale())invalidate();else if(signal?.aborted)markRemaining('cancelled',message(signal.reason??'Wave cancelled'));
 }catch(error){markRemaining(signal?.aborted?'cancelled':'failed',message(error));}
 finally{if(batch){const stats=batch.stats?.().scheduler;if(stats)Object.assign(execution,{multiOwnerDispatches:stats.multiOwnerDispatches,maxDispatchOwners:stats.maxDispatchOwners});await batch.dispose();}single?.dispose();}
 // Source may change while async cancellation/resource draining completes.
 if(stale())invalidate();else if(signal?.aborted)cancelResults();
 return {backend,sourceRevision:revision,execution,results:outcomes};
}
