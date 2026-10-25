// Explicit opt-in service. The original planner owns topology order, solver
// continuation and budgets. Native work here is static preparation only.
import './math.js';
import './route-rules.js';
import './optimizer-core.js';
import './optimizer.js';
import './inverse-geometry.js';
import './inverse-solver.js';
import './inverse-planner.js';
import {inspectOriginalInverseInput} from './inspect-inverse-native-input.mjs';
import {prepareLiveFourBallCandidate} from './browser-initial-import/prepare-live-candidate.mjs';
import {evaluateInverseGpuWave} from './evaluate-inverse-gpu-wave.mjs';
import {equalData} from './browser-initial-import/exact-data.mjs';
const Planner=globalThis.LabInversePlanner,leases=new WeakMap(),copy=structuredClone;
const reason=e=>String(e?.message??e),need=(ok,message)=>{if(!ok)throw new Error(message);};
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
export function createInverseGpuSearchCoordinator(options){
 need(options&&Object.keys(options).every(k=>['backend','R','controller','decoder','device','req','onProgress'].includes(k)),'Unknown GPU search coordinator option');
 const {backend,R,controller,decoder,device,onProgress}=options,req=copy(options.req);
 need(backend==='webgpu','Explicit webgpu backend required; no CPU physical fallback');
 need(device?.createBuffer&&device?.queue&&typeof decoder?.decodeSnapshot==='function','GPU device and admitted decoder required');
 need(req?.options?.searchAlgorithm==='inverse-constraints'&&req.options.gameMode==='four'&&req.options.mode==='carom','Only explicit four-ball inverse search is supported');
 need(Number.isFinite(Number(req.options.solveTimeMs??20000))&&Number(req.options.solveTimeMs??20000)>0,'Finite positive original solve-time budget required');
 need(onProgress===undefined||typeof onProgress==='function','Progress callback required');
 const sourceLab=controller?.lab;
 need(sourceLab&&controller.state?.selectedId===req.selectedId&&controller.state.gameMode==='four'&&controller.state.paused&&!controller.windup&&performance.now()>=(controller.cooldownUntil??0)&&!sourceLab.cue&&!controller.game?.pending&&!sourceLab.anyMotion(),'Current source must be ready and motionless');
 equalData(req.snapshot,sourceLab.snapshot({trails:false}),'Request is not the current original source');
 const current=()=>controller.lab===sourceLab&&controller.state.selectedId===req.selectedId&&controller.state.gameMode==='four'&&controller.state.paused&&!controller.windup&&!sourceLab.cue&&!controller.game?.pending&&['revision','time','steps','shots'].every(k=>sourceLab[k]===req.snapshot[k]);
 const search=Planner.createStagedSearch(R,req),outcomes=new Map();
 let jobs=[],active=null,abort=null,status='ready',failure=null,lastGpuWave=null,disposed=false,timer=null,stopCause=null,restartRequired=false,physicalRestarts=0,physicalBatchPending=false;
 const accounting={staticInspections:0,clearanceOnly:0,rejectedStrikes:0,preparedPhysical:0,gpuEvaluations:0,gpuWaves:0,nativeForwardSteps:0};
 function snapshot(){
  const result=Planner.stagedResult(search),interrupted=['cancelled','time-limit','stale','unsupported','failed'].includes(status);
  const out={...result,backend:'webgpu',executionMode:'same-realm-inverse-gpu',workerCount:0,evaluatedInWave:outcomes.size,gpuCoordinator:{status,stopCause,physicalStateRetained:false,resumeMode:'planner-continuation-physical-restart',restartRequired,physicalRestarts,failure:failure?copy(failure):null,lastGpuWave:copy(lastGpuWave),...accounting},physicalBackend:'webgpu',preparationBackend:'original-cpu-static-only'};
  if(interrupted)Object.assign(out,{partial:true,continuable:['cancelled','time-limit'].includes(status)&&!restartRequired,terminationReason:status==='stale'?'source-changed':['cancelled','time-limit'].includes(status)?status:'gpu-'+status,feasibilityStatus:status==='stale'?'stale-source':status==='time-limit'?'unconverged-time-limit':'gpu-evaluation-unavailable'});
  if(status==='stale')Object.assign(out,{results:[],resultCount:0,found:0,continuable:false});
  return copy(out);
 }
 const requestStop=(cause,why)=>{
  if(abort.signal.aborted)return;stopCause=cause;status=cause;if(physicalBatchPending)restartRequired=true;
  if(cause==='time-limit'){search.finished=true;search.paused=true;}
  Planner.pause(search);abort.abort(new Error(why));
 };
 const check=()=>{if(!current()){status='stale';throw new Error('Source changed');}if(!abort.signal.aborted&&performance.now()>=search.deadline)requestStop('time-limit','Original solve-time budget elapsed');if(abort.signal.aborted){status=stopCause??'cancelled';throw abort.signal.reason??new Error('Search cancelled');}};
 const report=()=>{check();onProgress?.(snapshot());};
 async function execute(){
  try{
   while(true){
    check();if(!jobs.length){jobs=Planner.planWave(search);outcomes.clear();}
    if(!jobs.length){if(search.finished){status=search.paused?'time-limit':'finished';break;}report();await yieldTask();continue;}
    let group=[];
    const flush=async()=>{
     if(!group.length)return;check();const pending=group;group=[];physicalBatchPending=true;
     const wave=await evaluateInverseGpuWave({backend:'webgpu',device,candidates:pending.map(x=>x.input),getSourceRevision:()=>current()?req.snapshot.revision:NaN,signal:abort.signal});
     accounting.gpuWaves++;if(abort.signal.aborted)restartRequired=true;if(wave.results.some(row=>row.status==='cancelled'))restartRequired=true;lastGpuWave={execution:copy(wave.execution),rows:wave.results.map(row=>({index:row.index,status:row.status,committedSteps:row.committedSteps??0}))};if(!current()){status='stale';throw new Error('Source changed');}
     need(wave.results.length===pending.length,'GPU wave outcome count mismatch');
     for(let i=0;i<pending.length;i++){
      const {job,inspection}=pending[i],row=wave.results[i];need(row.index===i,'GPU wave changed original candidate order');
      if(row.status!=='evaluated'){status=row.status==='cancelled'?(stopCause??'cancelled'):row.status==='stale'?'stale':row.status==='unsupported'?'unsupported':'failed';failure={jobId:job.id,phase:'gpu-physical',status:row.status,reason:row.reason??'Physical evaluation unavailable'};throw new Error(failure.reason);}
      // Do not silently substitute prestrike admission for the original inverse
      // post-creation static clearance if a source exposes a different value.
      equalData(row.result.clearance,inspection.clearance,'Original inverse clearance phase differs');equalData(row.result.inequalities,inspection.inequalities,'Original inverse input inequalities differ');
      outcomes.set(job.id,row.result);accounting.gpuEvaluations++;
     }
     physicalBatchPending=false;report();await yieldTask();
    };
    for(const job of jobs){
     check();if(outcomes.has(job.id))continue;
     need(job.kind==='inverse-constraint','Planner emitted non-inverse work');
     const inspection=inspectOriginalInverseInput(R,job.req,job.topology,job.settings,job.purpose);accounting.staticInspections++;
     need(inspection.nativeForwardSteps===0,'Native physical fallback prohibited');
     if(inspection.kind!=='physical'){
      need(['clearance','rejected'].includes(inspection.kind)&&inspection.outcome,'Original static outcome missing');outcomes.set(job.id,inspection.outcome);accounting[inspection.kind==='clearance'?'clearanceOnly':'rejectedStrikes']++;continue;
     }
     const prepared=await prepareLiveFourBallCandidate({controller,decoder,candidate:{settings:job.settings,rules:{fourBallThreeCushion:job.req.options.fourBallThreeCushion}},signal:abort.signal});check();accounting.preparedPhysical++;
     group.push({job,inspection,input:{prepared,req:job.req,topology:job.topology,settings:job.settings,purpose:job.purpose}});
     if(group.length===4)await flush();
    }
    await flush();check();
    Planner.commitWave(search,jobs.map(job=>({id:job.id,outcome:outcomes.get(job.id)})));
    jobs=[];outcomes.clear();report();if(search.finished){status=search.paused?'time-limit':'finished';break;}await yieldTask();
   }
  }catch(error){if(!['cancelled','time-limit','stale','unsupported','failed'].includes(status))status=abort.signal.aborted?(stopCause??'cancelled'):!current()?'stale':'failed';failure??={phase:'preparation-or-coordination',reason:reason(error)};Planner.pause(search);}
  finally{clearTimeout(timer);timer=null;if(!current())status='stale';else if(abort.signal.aborted&&status!=='failed'&&status!=='unsupported')status=stopCause??'cancelled';if(leases.get(device)===api)leases.delete(device);}
  return snapshot();
 }
 const api=Object.freeze({
  snapshot,
  run(){
   need(!disposed&&!active,'GPU search is disposed or already running');need(!['failed','unsupported','stale','cancelled'].includes(status),'Resume cancellation or create a new supported search');
   if(search.finished)return Promise.resolve(snapshot());need(!leases.has(device),'GPU device already has an active inverse coordinator');leases.set(device,api);abort=new AbortController();stopCause=null;failure=null;status='running';
   timer=setTimeout(()=>{requestStop('time-limit','Original solve-time budget elapsed');try{onProgress?.(snapshot());}catch(error){failure??={phase:'budget-progress-callback',reason:reason(error)};}},Math.max(0,search.deadline-performance.now()));
   const operation=execute();active=operation;operation.finally(()=>{active=null;}).catch(()=>{});return operation;
  },
  cancel(why='GPU search cancelled'){if(active)requestStop('cancelled',reason(why));else if(!disposed&&!['finished','time-limit','unsupported','failed','stale'].includes(status)){stopCause='cancelled';status='cancelled';Planner.pause(search);}},
  resume(resumeOptions={}){need(resumeOptions&&Object.keys(resumeOptions).every(k=>k==='restartPhysicalJobs')&&(resumeOptions.restartPhysicalJobs===undefined||typeof resumeOptions.restartPhysicalJobs==='boolean'),'Explicit boolean restartPhysicalJobs option required');need(!disposed&&!active,'Cannot resume an active/disposed search');if(!current()){status='stale';return false;}if(!['cancelled','time-limit','finished'].includes(status))return false;if(restartRequired&&!resumeOptions.restartPhysicalJobs)return false;if(!Planner.resume(search))return false;if(restartRequired)physicalRestarts++;restartRequired=false;status='ready';return true;},
  async dispose(){if(disposed)return;api.cancel('GPU search disposed');try{await active;}finally{Planner.disposeSearch(search);disposed=true;}}
 });
 return api;
}
