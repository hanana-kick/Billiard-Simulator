/** Opt-in raw input -> ORIGINAL cue/3D solver -> all-body rest -> source rules.
 * No prepared projection and no success authority from unqualified acceleration.
 */
import '../math.js';import '../physics.js';import '../game-rules.js';import '../route-rules.js';import '../optimizer-core.js';
import '../source-query-finalization-policy.js';import '../source-finalization-request.js';
import {advanceExperimentalRetainedSupport} from './source-law-retained-advance.mjs';
import {stepPreparedSpinWorld} from './source-law-normal-spin.mjs';
const freeze=x=>{if(x&&typeof x==='object'&&!ArrayBuffer.isView(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const clone=structuredClone;
const bytes=x=>new TextEncoder().encode(JSON.stringify(x)).byteLength;
// One diagnostic sample at the actual first post-cue admission attempt. It
// neither grants preparation provenance nor changes load/height/velocity.
function sampleLiveAdmission(lab,lastNativeDt){
 const cloth=lab.statics.find(o=>o.kind==='cloth'),top=cloth.collider.translation().y+cloth.collider.halfExtents().y;
 const rows=lab.objects.map(o=>{const p=o.body.translation(),v=o.body.linvel(),w=o.body.angvel(),r=o.collider.radius();let normalImpulse=0,contactPoints=0;
  lab.world.contactPair(o.collider,cloth.collider,m=>{contactPoints+=m.numContacts();for(let k=0;k<m.numContacts();k++)normalImpulse+=Math.max(0,m.contactImpulse(k));});
  return {id:o.id,supportGap:p.y-top-r,verticalVelocity:v.y,horizontalSpeed:Math.hypot(v.x,v.z),tangentialAngularSpeed:Math.hypot(w.x,w.z),normalAngular:w.y,slipSpeed:Math.hypot(v.x+r*w.z,v.z-r*w.x),strictAxial:(v.z===0&&w.x===0)||(v.x===0&&w.z===0),sleeping:o.body.isSleeping(),contactPoints,normalImpulse};});
 const count=predicate=>rows.filter(predicate).length,g=lab.world.gravity;
 return {sampleTime:lab.time,lastNativeDt,cachedManifoldImpulsesAreNotFutureLoadCertificate:true,cuePresent:!!lab.cue,preparedBoundaryCertified:false,nativeGravity:[g.x,g.y,g.z],parameterGravity:lab.params.gravity,gravityExactlyMatchesParameter:g.x===0&&g.y===-lab.params.gravity&&g.z===0,gravityMatchesNativeF32:g.x===0&&g.y===Math.fround(-lab.params.gravity)&&g.z===0,counts:{balls:rows.length,supportHeightMismatch:count(b=>b.supportGap!==0),verticalMotion:count(b=>b.verticalVelocity!==0),translating:count(b=>b.horizontalSpeed!==0),tangentialSpin:count(b=>b.tangentialAngularSpeed!==0),nonaxial:count(b=>!b.strictAxial),slipZero:count(b=>b.slipSpeed===0),cachedPositiveClothImpulse:count(b=>b.normalImpulse>0)},rows,scope:'single-actual-post-cue-sample-not-whole-shot-admission-survey'};
}
async function runRawSourceCandidate(R,input,{enabled=false,purpose='full-rest',maxNativeSteps=30000,maxOuterSteps=30000,maxWallMs=10000,maxJournalEvents=2048,maxJournalBytes=262144,signal,includeJournal=false}={},experiment=null){
 const start=performance.now(),work={nativeSteps:0,outerSteps:0,skippedSourceSteps:0,admissionAttempts:0,admissionReason:null,rhsEvaluations:0,geometryTests:0},journal=[];
 let lab=null,game=null,req=null,policy=null,trial=null,journalBytes=2,overflow=false,firstGoalTime=null,firstFoulTime=null,lastNativeDt=null,queryStopped=false;
 const basic=(status,reason)=>({status,reason,evaluationPurpose:purpose,success:null,physicalRest:false,physicalResult:null,finishedGameResult:null,work:{...work},wallMs:performance.now()-start,authority:work.skippedSourceSteps?'unverified-experimental-shadow':'original-source-only',accelerationQualified:false,firstGoalTime,firstFoulTime,memory:{sourceSnapshotBytes:req?.snapshot?.world?.byteLength??0,journalEvents:journal.length,journalSerializedBytes:journalBytes,nativeHeapMeasured:false}});
 if(!['full-rest','condition-only'].includes(purpose))return basic('unsupported','invalid-evaluation-purpose');
 if(!enabled)return basic('unsupported','opt-in-required');
 if(![maxNativeSteps,maxOuterSteps,maxJournalEvents,maxJournalBytes].every(x=>Number.isInteger(x)&&x>0)||maxJournalBytes<2||!Number.isFinite(maxWallMs)||maxWallMs<=0)return basic('unsupported','invalid-work-budget');
 if(signal?.aborted)return basic('cancelled','cancelled-before-strike');
 const core=globalThis.ShotSearchCore,F=globalThis.LabSourceFinalizationRequest,P=globalThis.LabSourceFinalizationPolicy;
 const stop=(status,reason)=>{const r=basic(status,reason);if(policy){const execution=status==='incomplete'?'request-timeout':status;const d=P.decideSourceFinalization(policy,{sourceIdentity:policy.sourceIdentity,execution:{status:execution,reason},route:null,physical:null,game:null});r.status=d.status;}return r;};
 const limit=()=>{if(signal?.aborted)throw {candidateStop:'cancelled',reason:'cancelled'};if(performance.now()-start>=maxWallMs)throw {candidateStop:'incomplete',reason:'wall-budget'};if(work.nativeSteps>=maxNativeSteps)throw {candidateStop:'incomplete',reason:'native-step-budget'};};
 try{
  if(!input||!['three','four'].includes(input.gameKind))return basic('unsupported','explicit-game-kind-required');
  const gameKind=input.gameKind;
  const raw={snapshot:clone(input.snapshot),selectedId:input.selectedId,settings:clone(input.settings),testBudget:true,options:{...clone(input.options),budget:1,elevationMode:'fixed'}};
  core.validate(raw);
  req=await F.bind(raw,{gameKind,snapshot:clone(input.gameSnapshot),worldObjectIds:raw.snapshot.objects.map(o=>o.id),shotRules:{threeCushion:gameKind==='three'?true:raw.options.fourBallThreeCushion}});
  const token=await F.admit(req);policy=F.policyFor(token,req,null,'verify');freeze(req.options);freeze(req.settings);limit();
  // Own the partial instance BEFORE restore allocates native resources.
  lab=Object.create(globalThis.PhysicsLab.prototype);lab.R=R;lab.onEvent=null;lab.lastSnapshot=null;lab.restore(req.snapshot);
  if(lab.cue||!lab.objects.every(o=>o.body.isSleeping()))return stop('unsupported','source-not-ready-at-all-body-rest');
  game=gameKind==='three'?new globalThis.ThreeBallGame():new globalThis.FourBallGame();game.restore(clone(policy.gameBinding.snapshot));
  trial=core.createPhysicalAccumulator(req.settings,undefined,lab.time,lab.get(req.selectedId).body.translation());const sourceInput=core.physicalInputs(lab);
  lab.onEvent=e=>{
   const row=freeze(clone(e)),n=bytes(row)+(journal.length?1:0);
   if(journal.length>=maxJournalEvents||journalBytes+n>maxJournalBytes)overflow=true;else{journal.push(row);journalBytes+=n;}
   core.observePhysicalEvent(req,trial,e);game.contact(e);
   if(game.pending?.reds.length===2&&firstGoalTime===null)firstGoalTime=e.time;
   if(game.pending?.foul&&firstFoulTime===null)firstFoulTime=e.time;
  };
  const sourceStep=lab.world.step.bind(lab.world);lab.world.step=(...args)=>{limit();work.nativeSteps++;lastNativeDt=lab.world.integrationParameters.dt;return sourceStep(...args);};
  limit();const strike=lab.strike(req.selectedId,req.settings,{saveSnapshot:false});
  if(!strike.ok)return {...basic('rejected-strike',strike.reason),success:false};
  if(!game.begin(req.selectedId,{threeCushion:gameKind==='three'?true:req.options.fourBallThreeCushion}))return stop('unsupported','source-game-rejected-begin');
  const horizonSteps=Math.round(req.options.horizon/lab.dt);
  while(lab.cue||!lab.objects.every(o=>o.body.isSleeping())){
   limit();if(work.outerSteps>=maxOuterSteps||work.outerSteps>=horizonSteps)return stop('incomplete','outer-or-physical-horizon');
   // A live source state has NO manufactured prepared-boundary provenance.
   // One real guard attempt composes the adapter, then terminal fallback avoids
   // repeating a guaranteed provenance refusal on every source frame.
   if(!lab.cue&&work.admissionAttempts===0){
    work.admissionAttempts++;work.admissionDiagnostics=sampleLiveAdmission(lab,lastNativeDt);
    if(experiment){
     if(work.outerSteps+experiment.frames>Math.min(maxOuterSteps,horizonSteps))return stop('incomplete','experimental-prefix-exceeds-outer-budget');
     const result=advanceExperimentalRetainedSupport(lab,experiment.frames,{enabled:true,errorBudget:experiment.errorBudget,maxEvaluations:experiment.maxEvaluations});
     work.rhsEvaluations+=result.rhsEvaluations??((result.domain?.domainRHSEvaluations??0)+(result.solution?.rhsEvaluations??0));work.geometryTests+=result.geometryTests??result.domain?.geometryTests??0;work.admissionReason=result.reason??'experimental-retained-native-support';
     if(result.advanced){work.skippedSourceSteps+=result.frames;work.outerSteps+=result.frames-1;trial.steps+=result.frames-1;work.experimentalBridge={frames:result.frames,wallMs:result.wallMs,qualifiedForScoring:false,nativeObserverBookkeepingEquivalent:false};}else lab.step(1);
    }else{
     const result=stepPreparedSpinWorld(lab,1,{enabled:true,preparedBoundary:false});work.admissionReason=result.reason;
     if(result.path!=='original'||result.sourceStepsSkipped!==0)return stop('unsupported','unqualified-acceleration-cannot-score');
    }
   }else lab.step(1);
   work.outerSteps++;queryStopped=core.observePhysicalStep(req,trial,sourceInput)||queryStopped;
   if(overflow)return stop('incomplete','contact-journal-budget');
   if(lab.objects.some(o=>[o.body.translation(),o.body.linvel(),o.body.angvel()].some(v=>![v.x,v.y,v.z].every(Number.isFinite))))return stop('unsupported','nonfinite-source-state');
   // Exact condition-only negative proof from the existing source policy.
   // Operational interruption wins; successful goals never take this exit.
   if(signal?.aborted)return stop('cancelled','cancelled-before-condition-proof');
   if(performance.now()-start>=maxWallMs)return stop('incomplete','wall-budget-before-condition-proof');
   if((purpose==='condition-only'||(experiment&&work.skippedSourceSteps===0))&&game.pending?.foul){
    const physical={cuePresent:!!lab.cue,objects:lab.objects.map(o=>({id:o.id,sleeping:o.body.isSleeping()}))};
    const decision=P.decideSourceFinalization(policy,{sourceIdentity:policy.sourceIdentity,execution:{status:'running',reason:null},route:{complete:queryStopped,goalSatisfied:trial.success&&!trial.invalid,irreversiblyRejected:false},physical,game:{snapshot:game.snapshot(),finalResult:null}});
    if(decision.status==='evaluated-negative'&&decision.reason==='irreversible-source-game-foul')return freeze({...basic(decision.status,decision.reason),success:false,physicalRest:decision.physicalRest,sourceIdentity:policy.sourceIdentity,sourceTime:lab.time,firstGoalTime,firstFoulTime,goalDidNotTerminate:firstGoalTime!==null&&lab.time>firstGoalTime,terminationProof:{policy:policy.policy,reason:decision.reason,queryTerminal:decision.queryTerminal,pendingSourceGameFoul:true},journal:includeJournal?journal:undefined,journalScope:'source-emission-prefix',finalTrajectoryClaim:false,finalScoreClaim:false});
   }
   if(work.outerSteps%128===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(signal?.aborted)return stop('cancelled','cancelled-before-finalization');
  if(performance.now()-start>=maxWallMs)return stop('incomplete','wall-budget-before-finalization');
  const finishedGameResult=game.finish(),physicalResult=core.physicalResult(req.options,trial,lab.time);
  const decision=P.decideSourceFinalization(policy,{sourceIdentity:policy.sourceIdentity,execution:{status:'running',reason:null},route:{complete:true,goalSatisfied:physicalResult.success,irreversiblyRejected:!physicalResult.success},physical:{cuePresent:false,objects:lab.objects.map(o=>({id:o.id,sleeping:o.body.isSleeping()}))},game:{snapshot:game.snapshot(),finalResult:finishedGameResult}});
  return freeze({evaluationPurpose:purpose,status:decision.status,reason:decision.reason,success:decision.gameplayVerified,physicalRest:true,physicalResult,finishedGameResult,sourceIdentity:policy.sourceIdentity,settings:clone(req.settings),work:{...work},wallMs:performance.now()-start,firstGoalTime,firstFoulTime,goalDidNotTerminate:firstGoalTime!==null&&lab.time>firstGoalTime,sourceTime:lab.time,endpoint:lab.objects.map(o=>({id:o.id,position:clone(o.body.translation()),velocity:clone(o.body.linvel()),angular:clone(o.body.angvel()),sleeping:o.body.isSleeping()})),journal:includeJournal?journal:undefined,journalScope:'full-source-shot-emissions',memory:{sourceSnapshotBytes:req.snapshot.world.byteLength,journalEvents:journal.length,journalSerializedBytes:journalBytes,journalCapBytes:maxJournalBytes,nativeHeapMeasured:false},authority:work.skippedSourceSteps?'unverified-experimental-shadow':'original-source-only',accelerationQualified:false});
 }catch(error){return stop(error?.candidateStop??'unsupported',error?.reason??String(error?.message??error));}
 finally{if(lab){lab.removeCue();lab.queue?.free();lab.world?.free();}}
}

/** Default source-backed authority, unchanged by experimental options. */
export function evaluateRawSourceCandidate(R,input,options){return runRawSourceCandidate(R,input,options);}
/** One unverified retained-support shadow prefix, followed by mandatory SOURCE
 * verification when any physics was advanced experimentally. Combined budgets
 * and cost include both; this is not a claimed acceleration of final authority.
 */
export async function evaluateExperimentalRetainedCandidate(R,input,{enabled=false,prefixFrames=24,errorBudget,maxEvaluations=512,...options}={}){
 const start=performance.now();
 if(!enabled||!Number.isInteger(prefixFrames)||prefixFrames<1||prefixFrames>96)return {status:'unsupported',reason:'explicit-valid-retained-experiment-required',success:null};
 let ownedInput,ownedBudget;try{ownedInput=clone(input);ownedBudget=freeze(clone(errorBudget));}catch{return {status:'unsupported',reason:'uncloneable-experiment-input',success:null};}
 const shadow=await runRawSourceCandidate(R,ownedInput,{...options,enabled:true,purpose:'full-rest'},{frames:prefixFrames,errorBudget:ownedBudget,maxEvaluations});
 if(shadow.work.skippedSourceSteps===0)return {...shadow,verificationReplayRequired:false,combinedWork:{nativeSteps:shadow.work.nativeSteps,outerSteps:shadow.work.outerSteps,rhsEvaluations:shadow.work.rhsEvaluations,geometryTests:shadow.work.geometryTests},combinedMemory:{journalSerializedBytes:shadow.memory.journalSerializedBytes,journalPerRunCapBytes:options.maxJournalBytes??262144,nativeHeapMeasured:false},combinedWallMs:performance.now()-start};
 const remaining={maxNativeSteps:(options.maxNativeSteps??30000)-shadow.work.nativeSteps,maxOuterSteps:(options.maxOuterSteps??30000)-shadow.work.outerSteps,maxWallMs:(options.maxWallMs??10000)-(performance.now()-start)};
 const unverified={status:'unverified-experimental-shadow',completedFullRest:shadow.physicalRest,observedGameResult:shadow.finishedGameResult,sourceTime:shadow.sourceTime,firstGoalTime:shadow.firstGoalTime,firstFoulTime:shadow.firstFoulTime,endpoint:shadow.endpoint,journal:shadow.journal,memory:shadow.memory,work:shadow.work,wallMs:shadow.wallMs,physicalAcceptance:false,observerPathComplete:false};
 if(Object.values(remaining).some(x=>x<=0))return {status:'incomplete',reason:'combined-verification-budget',success:null,shadow:unverified,verificationReplayRequired:true,combinedWork:{nativeSteps:shadow.work.nativeSteps,outerSteps:shadow.work.outerSteps,rhsEvaluations:shadow.work.rhsEvaluations,geometryTests:shadow.work.geometryTests},combinedMemory:{journalSerializedBytes:shadow.memory.journalSerializedBytes,journalPerRunCapBytes:options.maxJournalBytes??262144,nativeHeapMeasured:false},combinedWallMs:performance.now()-start};
 const source=await runRawSourceCandidate(R,ownedInput,{...options,...remaining,enabled:true,purpose:options.purpose??'condition-only'});
 return {...source,shadow:unverified,verificationReplayRequired:true,verificationAuthority:'original-source-replay',combinedWork:{nativeSteps:shadow.work.nativeSteps+source.work.nativeSteps,outerSteps:shadow.work.outerSteps+source.work.outerSteps,rhsEvaluations:shadow.work.rhsEvaluations+source.work.rhsEvaluations,geometryTests:shadow.work.geometryTests+source.work.geometryTests},combinedMemory:{journalSerializedBytes:shadow.memory.journalSerializedBytes+source.memory.journalSerializedBytes,journalPerRunCapBytes:options.maxJournalBytes??262144,maxTwoRunJournalBytes:2*(options.maxJournalBytes??262144),nativeHeapMeasured:false},combinedWallMs:performance.now()-start};
}
