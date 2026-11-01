/** Opt-in current-state candidate-window evaluator. No production selection.
 * Event PREDICTION and physically ADMITTED advancement are separate decisions.
 * Supported normal spin advances analytically. A SECOND explicit opt-in permits
 * certified fixed-axis pre-contact prefixes; original physics resolves all contacts.
 */
import {capturePreparedSpinWorld,inspectSupportedSpinState,stepPreparedSpinWorld} from './source-law-normal-spin.mjs';
import {advancePreparedAxialPrefix} from './source-law-axial-advance.mjs';
import {predictSourcePreparedCollinearEvent} from './source-geometry-horizon.mjs';
const vector=v=>[v.x,v.y,v.z];
export function precomputeSourceCandidateEvent(lab,{duration,preparedBoundary=false}={}){
 const bodies=lab.objects.map(o=>({id:o.id,position:vector(o.body.translation()),velocity:vector(o.body.linvel()),angular:vector(o.body.angvel()),radius:o.radius,mass:o.mass,provenance:'prepared-flat-constant-load'}));
 return predictSourcePreparedCollinearEvent(lab,bodies,{duration,preparedBoundary});
}
export function evaluatePreparedSourceLawCandidate(lab,{frames,enabled=false,preparedBoundary=false,advanceTranslation=false,minAnalyticFrames=0,maxChunks=32,diagnostics=false}={}){
 if(!Number.isInteger(minAnalyticFrames)||minAnalyticFrames<0||minAnalyticFrames>4096||!Number.isInteger(frames)||frames<0||frames>4096||!Number.isInteger(maxChunks)||maxChunks<1||maxChunks>4096||!Number.isFinite(lab.dt)||lab.dt<=0||lab.dt>1/120)throw RangeError('Bounded source candidate window required');
 const started=performance.now();
 const counters={requestedFrames:frames,analyticFrames:0,axialFrames:0,originalFrames:0,actualWorldStepCalls:0,eventPredictions:0,pairRootCalls:0,geometryBoundEvaluations:0,geometryStaticTests:0,axialAttempts:0,costGateFallbacks:0,prefixPairBoundTests:0,prefixStaticBoundTests:0,chunks:0};
 const records=[];let remaining=frames;
 const sourceWorldStep=lab.world.step;
 // Count REAL original solver calls, including cue subdivisions, rather than
 // equating outer frames with physical substeps. Restore even on an exception.
 lab.world.step=function(...args){counters.actualWorldStepCalls++;return sourceWorldStep.apply(this,args);};
 const local=(count,reason,prediction)=>{
  lab.step(count);counters.originalFrames+=count;remaining-=count;
  if(diagnostics)records.push({path:'original',frames:count,reason,...(prediction?{predictedEvent:prediction.event}:{})});
 };
 try{
  while(remaining>0){
   counters.chunks++;
   if(!enabled||!preparedBoundary){local(remaining,!enabled?'disabled':'unverified-boundary');break;}
   if(counters.chunks>maxChunks){local(remaining,'controller-budget-original-fallback');break;}
   const spin=inspectSupportedSpinState(capturePreparedSpinWorld(lab,{preparedBoundary:true}));
   if(spin.eligible){
    const result=stepPreparedSpinWorld(lab,remaining,{enabled:true,preparedBoundary:true});
    if(result.path==='analytic'){counters.analyticFrames+=remaining;if(diagnostics)records.push(result);remaining=0;break;}
    // Guard failure already delegated the whole window to original physics.
    counters.originalFrames+=remaining;remaining=0;if(diagnostics)records.push(result);break;
   }
   let prediction;
   if(advanceTranslation){
    const axial=advancePreparedAxialPrefix(lab,remaining,{preparedBoundary:true,minAnalyticFrames});prediction=axial.prediction;
    counters.axialAttempts++;counters.geometryBoundEvaluations+=axial.boundEvaluations??0;counters.prefixPairBoundTests+=axial.pairBoundTests??0;counters.prefixStaticBoundTests+=axial.staticBoundTests??0;
    if(axial.reason==='short-prefix-original-window'){
     counters.costGateFallbacks++;counters.eventPredictions++;counters.pairRootCalls+=prediction?.pairRootCalls??0;counters.geometryBoundEvaluations+=prediction?.geometry?.boundEvaluations??0;counters.geometryStaticTests+=prediction?.geometry?.staticTests??0;
     // Deliberately terminal: repeated tiny predictions would defeat this gate.
     local(remaining,axial.reason,prediction);break;
    }
    if(axial.advanced){
     counters.eventPredictions++;counters.pairRootCalls+=prediction.pairRootCalls??0;counters.geometryBoundEvaluations+=prediction.geometry?.boundEvaluations??0;counters.geometryStaticTests+=prediction.geometry?.staticTests??0;
     counters.analyticFrames+=axial.frames;counters.axialFrames+=axial.frames;remaining-=axial.frames;
     if(diagnostics){const {prediction:ignored,...record}=axial;records.push({path:'axial-analytic',...record,nextEvent:prediction.event});}
     continue;
    }
   }
   prediction??=precomputeSourceCandidateEvent(lab,{duration:remaining*lab.dt,preparedBoundary:true});
   counters.eventPredictions++;counters.pairRootCalls+=prediction.pairRootCalls??0;counters.geometryBoundEvaluations+=prediction.geometry?.boundEvaluations??0;counters.geometryStaticTests+=prediction.geometry?.staticTests??0;
   if(!prediction.eligible){local(remaining,prediction.reason);break;}
   // This schedules ORIGINAL solver work through the predicted boundary; it
   // does not substitute predicted states, attitudes or collision impulses.
   const chunk=Math.max(1,Math.min(remaining,Math.ceil(prediction.event.time/lab.dt)));
   local(chunk,'translating-advancement-unqualified',prediction);
  }
 }finally{lab.world.step=sourceWorldStep;}
 return {profile:'source-law-prepared-candidate-window-v1',status:'evaluated-window',pass:null,rawShot:false,fullShot:false,productionEnabled:false,sourceReportsRest:!lab.cue&&!lab.anyMotion(),wallMs:performance.now()-started,counters,...(diagnostics?{records}:{})};
}
