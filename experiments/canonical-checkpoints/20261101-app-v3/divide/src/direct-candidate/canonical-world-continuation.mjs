import {mixedMotionRevision as validateMixedMotionRevision} from './deterministic-world-mixed-v2.mjs';
import {bindCanonicalJournalRules,reduceCanonicalJournalCPU} from './canonical-journal-rules.mjs';
import {createWorldJournalCPU} from './canonical-world-journal.mjs';
import {seedRawJournalPrefixCPU} from './canonical-raw-journal-prefix.mjs';
import {snapshotRawWorldBatch,runRawWorldCPU,createRawWorldGPU} from './deterministic-raw-world.mjs';
/** Request-bound elapsed-time admission for the experimental PW1 continuation.
 * This is not a rule verdict or a complete work/event-budget implementation.
 * The clock is the original raw-start binding, never the post-strike PW1 tick.
 */
import {validateCanonicalRequest,validateCanonicalShotClock,inspectCanonicalPhaseBudget} from './canonical-engine-contract.mjs';
import {packResidentScene} from './deterministic-resident-transition.mjs';
import {packCushionHull} from './deterministic-cushion-geometry.mjs';
import {validatePreparedWorld} from './deterministic-prepared-world.mjs';
import {runPreparedWorldCPU} from './deterministic-recurring-world.mjs';
import {createPreparedPairContinuationGPU} from './deterministic-prepared-world-gpu.mjs';
const bindings=new WeakMap(),Q=2**24;
const uint=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const vector=x=>[x.x,x.y,x.z];
function staticGeometry(x){
 if(!x.rotation||x.rotation.x!==0||x.rotation.y!==0||x.rotation.z!==0||Math.abs(x.rotation.w)!==1||[...vector(x.v),...vector(x.w)].some(v=>v!==0))throw RangeError('Fixed unrotated complete static geometry required');
 const p=vector(x.pos);let vertices;
 if(x.shape==='box'){const h=vector(x.half);if(h.some(v=>!Number.isFinite(v)||v<=0))throw RangeError('Positive box extents');return {bounds:p.map((v,i)=>[v-h[i],v+h[i]])};}
 if(x.shape!=='convex'||!Array.isArray(x.vertices)||!Array.isArray(x.indices))throw RangeError('Actual box or convex static required');
 vertices=x.vertices.map((v,i)=>v+p[i%3]);
 return {vertices,indices:x.indices,bounds:[0,1,2].map(i=>{const a=vertices.filter((_,k)=>k%3===i);return [Math.min(...a),Math.max(...a)];})};
}
function data(binding){const d=bindings.get(binding);if(!d)throw TypeError('Owned immutable world continuation binding required');return d;}
/** Copy-only current-input view. This does not authorize a fabricated binding or
 * expose mutable arrays retained by the source-owned continuation. */
export function snapshotCanonicalWorldContinuation(binding){
 const d=data(binding);
 return {request:structuredClone(d.request),shotClock:structuredClone(d.shotClock),
  scene:d.scene.slice(),hulls:d.hulls.map(hull=>hull.slice()),options:structuredClone(d.options)};
}
/** Explicit local numerical/work settings remain distinct from the elapsed clock.
 * maxWorldSteps is a component work cap, NOT request.maximumWorkItems accounting.
 */
export function prepareCanonicalWorldContinuation(request,shotClock,{sceneKey,requestKey,durationTicks,budgets,maxWorldSteps,tailMaxNodes=256,maxVelocityCorrectionQuanta,enableCushionContinuation=false,mixedMotionRevision='mmq1'}={}){
 validateMixedMotionRevision({mixedMotionRevision});request=validateCanonicalRequest(request);shotClock=validateCanonicalShotClock(request,shotClock);
 if(request.profileId!=='canonical-local-v1'||!uint(sceneKey)||!uint(requestKey))throw RangeError('Canonical-local identity keys required');
 if(!Number.isInteger(durationTicks)||durationTicks<1||durationTicks>65535||!Number.isInteger(maxWorldSteps)||maxWorldSteps<1||maxWorldSteps>128||!Number.isInteger(tailMaxNodes)||tailMaxNodes<1||tailMaxNodes>256||!Array.isArray(budgets)||budgets.length!==7||budgets.some(x=>!Number.isInteger(x)||x<1||x>2**20))throw RangeError('Explicit bounded local accuracy/work settings required');
 if(maxVelocityCorrectionQuanta!==undefined&&(!Number.isInteger(maxVelocityCorrectionQuanta)||maxVelocityCorrectionQuanta<1||maxVelocityCorrectionQuanta>4096))throw RangeError('Explicit landing velocity correction limit must be 1..4096 quanta');
 if(typeof enableCushionContinuation!=='boolean')throw TypeError('Explicit boolean cushion continuation option');
 const physical=request.scene.physical,statics=physical.statics,balls=physical.bodies;
 const cloths=statics.filter(x=>x.kind==='cloth'),cushions=statics.filter(x=>x.kind==='cushion');
 if(cloths.length!==1||cushions.length!==4||cloths[0].shape!=='box'||![3,4].includes(balls.length)||balls.some(b=>b.shape!=='sphere'||b.radius!==balls[0].radius||b.mass!==balls[0].mass))throw RangeError('Complete equal-sphere, finite-cloth, four-hull profile required');
 if(enableCushionContinuation&&(!request.scene.admitted||cushions.some(x=>x.unsupportedFields)))throw RangeError('Actual admitted uniform cushion materials required; per-hull overrides unsupported');
 const geometry=statics.map(staticGeometry),cloth=cloths[0],foot=geometry[statics.indexOf(cloth)].bounds,top=foot[1][1],p=physical.parameters;
 const hulls=cushions.map((x,i)=>{const g=geometry[statics.indexOf(x)];if(!g.vertices)throw RangeError('Actual convex cushion required');return packCushionHull({id:i,vertices:g.vertices,indices:g.indices});});
 const scene=packResidentScene({provenance:'prepared-finite-cloth-and-static-bounds',ballCount:balls.length,radius:balls[0].radius,mass:balls[0].mass,y:top+balls[0].radius,z:0,clothTop:top,clothFootprint:[...foot[0],...foot[2]],restitution:p.ballRestitution,pairFriction:p.ballFriction,clothFriction:p.clothFriction,motionMaterial:{gravity:p.gravity,clothFriction:p.clothFriction,rollingLength:p.rollingLength,spinLength:p.spinLength},staticBounds:statics.flatMap((x,i)=>['cloth','cushion'].includes(x.kind)?[]:[geometry[i].bounds])});
 const options=Object.freeze({durationTicks,budgets:Object.freeze([...budgets]),maxWorldSteps,tailMaxNodes,maxVelocityCorrectionQuanta,enableCushionContinuation,mixedMotionRevision,cushionRestitution:p.cushionRestitution,cushionFriction:p.cushionFriction,executionProfile:'canonical-local-v1',clothRestitution:p.clothRestitution,deadlineTick:shotClock.deadlineTick});
 const binding=Object.freeze({kind:'canonical-world-time-binding-v1',modelId:request.modelId,profileId:request.profileId,requestIdentity:request.requestKey,sceneIdentity:request.sceneId,epoch:request.epoch,sceneKey,requestKey,shotClock,scope:'elapsed-time admission plus bounded component continuation; not a gameplay verdict or cumulative work/event-budget certification',localOptions:options});
 bindings.set(binding,{request,shotClock,scene,hulls,options});return binding;
}
function admit(binding,world){
 const d=data(binding);validatePreparedWorld(world,d.scene);
 if(world[8]!==binding.sceneKey||world[9]!==binding.requestKey||world[7]!==d.request.cueSlot||world[2]!==d.request.slotToId.length||d.request.slotToId.some((id,i)=>world[32+i*40]!==id))throw RangeError('PW1 scene/request/selected-slot/full-roster binding mismatch');
 inspectCanonicalPhaseBudget(d.request,d.shotClock,world[3],1);
 return d;
}
function receipt(binding,result){return {...result,shotClock:binding.shotClock,elapsedTicks:result.state[5]-binding.shotClock.startingTick,remainingTicks:binding.shotClock.deadlineTick-result.state[5],timeBudgetEnforced:true,cumulativeWorkBudgetEnforced:false,cumulativeEventBudgetEnforced:false,gameplayVerdict:null};}
export function runCanonicalWorldContinuationCPU(binding,world,{signal,selectedTraceCapture,selectedTraceMaxRecords}={}){
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');const d=admit(binding,world);
 return receipt(binding,runPreparedWorldCPU(world,d.scene,d.hulls,{...d.options,signal,selectedTraceCapture,selectedTraceMaxRecords}));
}
function admitRaw(binding,batch){const d=data(binding),snapshot=snapshotRawWorldBatch(batch),b=batch.binding;if(batch.count!==1||b.requestIdentity!==binding.requestIdentity||b.sceneId!==binding.sceneIdentity||b.sceneKey!==binding.sceneKey||b.requestKey!==binding.requestKey||b.shotClock.startingTick!==binding.shotClock.startingTick||b.shotClock.deadlineTick!==binding.shotClock.deadlineTick)throw RangeError('One owned raw batch with identical original shot/scene/request binding required');const template=snapshot.template;template[1]=snapshot.rawRows[0];admit(binding,template);return {...d,template};}
function scoredReceipt(binding,result){const r=receipt(binding,result),compact=result.compactResult;return {...r,ruleTimeBasis:'shot-relative-q20',ruleTimeOrigin:binding.shotClock.startingTick,kissCoverage:result.ruleState?.[39]===1&&result.ruleState[38]===result.state[5]-binding.shotClock.startingTick,gameplayVerdict:compact&&compact[3]!==0x80000000?{status:'complete',score:compact[3]|0}:null};}
/** Decode/receipt seam for the original GPU raw chain. This validates owned
 * input bindings and packet shape; it does not manufacture physics authority.
 * The selected session still checks output identity, roster, clock and trace. */
export function decorateCanonicalRawWorldGPUResult(binding,batch,result){
 admitRaw(binding,batch);
 const words=(value,length)=>value instanceof Uint32Array&&value.length===length&&Object.prototype.toString.call(value.buffer)!=='[object SharedArrayBuffer]';
 if(!result||!words(result.rawHandoffStatus,16))throw TypeError('Complete original GPU raw handoff packet required');
 if(result.rawHandoffStatus[1]!==1)return {rawHandoffStatus:result.rawHandoffStatus,continuation:null};
 if(!words(result.state,256)||!words(result.dense,256)||!words(result.words,768)||!words(result.firstPairEntry,128)||!words(result.firstPairResponse,128)||!words(result.ruleState,48)||!words(result.compactResult,4)||result.nominalRest!==(result.state[1]===9))throw TypeError('Complete original GPU continuation readback required');
 if(result.selectedTraceGPU!==undefined&&(!['gpu-selected-world-source-v1','gpu-selected-world-source-v2'].includes(result.selectedTraceGPU?.kind)||result.selectedTraceGPU.gpuProduced!==true||!Array.isArray(result.selectedTraceGPU.records)))throw TypeError('Decoded original GPU selected source capture required');
 return {rawHandoffStatus:result.rawHandoffStatus,continuation:scoredReceipt(binding,result)};
}
export function runCanonicalRawWorldContinuationCPU(binding,batch,{signal,selectedTraceCapture,selectedTraceMaxRecords}={}){const d=admitRaw(binding,batch);if(signal?.aborted)throw new DOMException('Cancelled','AbortError');const raw=runRawWorldCPU(batch);if(raw.status[1]!==1)return {rawHandoffStatus:raw.status,continuation:null};const journal=createWorldJournalCPU(raw.world);seedRawJournalPrefixCPU(journal.words,batch,raw);const result=runPreparedWorldCPU(raw.world,d.scene,d.hulls,{...d.options,signal,selectedTraceCapture,selectedTraceMaxRecords},journal),rules=reduceCanonicalJournalCPU(bindCanonicalJournalRules(d.request,batch),result.journalWords,result.journalAuxWords),continuation=scoredReceipt(binding,{...result,ruleState:rules.state,compactResult:rules.result});return {rawHandoffStatus:raw.status,continuation};}
export async function createCanonicalWorldContinuationGPU(device,binding,{strikeBackend='staged'}={}){
 if(!['staged','chunked-16'].includes(strikeBackend))throw RangeError('Explicit staged or chunked-16 raw backend');
 const d=data(binding),engine=await createPreparedPairContinuationGPU(device,d.hulls,{mixedMotionRevision:d.options.mixedMotionRevision});let rawEngine;
 return {compileMs:engine.compileMs,strikeBackend,async run(world,{signal,selectedTrace,selectedTraceMaxRecords}={}){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');admit(binding,world);const result=await engine.run(world,d.scene,{...d.options,signal,selectedTrace,selectedTraceMaxRecords});return receipt(binding,result);},async runRaw(batch,{signal,selectedTrace,selectedTraceMaxRecords}={}){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');const admitted=admitRaw(binding,batch);rawEngine??=await createRawWorldGPU(device,{strikeBackend});if(signal?.aborted)throw new DOMException('Cancelled','AbortError');const bank=rawEngine.createBank(batch);try{const ruleBinding=bindCanonicalJournalRules(d.request,batch),result=await engine.run(admitted.template,d.scene,{...d.options,signal,selectedTrace,selectedTraceMaxRecords},bank,ruleBinding);return decorateCanonicalRawWorldGPUResult(binding,batch,result);}finally{bank.dispose();}}};
}
