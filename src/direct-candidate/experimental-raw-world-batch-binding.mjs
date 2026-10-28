import {rawWorldBatchPrefixLimit} from './experimental-raw-world-batch-revision.mjs';
/** Frozen 0850a4d geometry/settings admission; separate owned experimental binding. */
import {validateCanonicalRequest,validateCanonicalShotClock} from './canonical-engine-contract.mjs';
import {packResidentScene} from './deterministic-resident-transition.mjs';
import {packCushionHull} from './deterministic-cushion-geometry.mjs';
import {snapshotRawWorldBatch} from './deterministic-raw-world.mjs';
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
/** Explicit local numerical/work settings remain distinct from the elapsed clock.
 * maxWorldSteps is a component work cap, NOT request.maximumWorkItems accounting.
 */
export function prepareExperimentalRawWorldBatchContinuation(request,shotClock,{sceneKey,requestKey,durationTicks,budgets,maxWorldSteps,tailMaxNodes=256,maxVelocityCorrectionQuanta,pipelineRevision='0850a4d'}={}){
 const prefixLimit=rawWorldBatchPrefixLimit(pipelineRevision);
 request=validateCanonicalRequest(request);shotClock=validateCanonicalShotClock(request,shotClock);
 // Frozen mixed-world CPU recipes reinterpret stable roster IDs as signed i32.
 // Reject that unsupported old-profile domain before any shader compilation.
 // Candidate IDs remain independent full-u32 identities; never rewrite either.
 if(request.slotToId.some(id=>id>0x7fffffff))throw RangeError('Frozen 0850a4d execution profile requires stable roster IDs <= 0x7fffffff; full-u32 candidate IDs remain supported');
 if(request.profileId!=='canonical-local-v1'||!uint(sceneKey)||!uint(requestKey))throw RangeError('Canonical-local identity keys required');
 if(!Number.isInteger(durationTicks)||durationTicks<1||durationTicks>65535||!Number.isInteger(maxWorldSteps)||maxWorldSteps<1||maxWorldSteps>prefixLimit||!Number.isInteger(tailMaxNodes)||tailMaxNodes<1||tailMaxNodes>256||!Array.isArray(budgets)||budgets.length!==7||budgets.some(x=>!Number.isInteger(x)||x<1||x>2**20))throw RangeError('Explicit bounded local accuracy/work settings required');
 if(maxVelocityCorrectionQuanta!==undefined&&(!Number.isInteger(maxVelocityCorrectionQuanta)||maxVelocityCorrectionQuanta<1||maxVelocityCorrectionQuanta>4096))throw RangeError('Explicit landing velocity correction limit must be 1..4096 quanta');
 const physical=request.scene.physical,statics=physical.statics,balls=physical.bodies;
 const cloths=statics.filter(x=>x.kind==='cloth'),cushions=statics.filter(x=>x.kind==='cushion');
 if(cloths.length!==1||cushions.length!==4||cloths[0].shape!=='box'||![3,4].includes(balls.length)||balls.some(b=>b.shape!=='sphere'||b.radius!==balls[0].radius||b.mass!==balls[0].mass))throw RangeError('Complete equal-sphere, finite-cloth, four-hull profile required');
 const geometry=statics.map(staticGeometry),cloth=cloths[0],foot=geometry[statics.indexOf(cloth)].bounds,top=foot[1][1],p=physical.parameters;
 const hulls=cushions.map((x,i)=>{const g=geometry[statics.indexOf(x)];if(!g.vertices)throw RangeError('Actual convex cushion required');return packCushionHull({id:i,vertices:g.vertices,indices:g.indices});});
 const scene=packResidentScene({provenance:'prepared-finite-cloth-and-static-bounds',ballCount:balls.length,radius:balls[0].radius,mass:balls[0].mass,y:top+balls[0].radius,z:0,clothTop:top,clothFootprint:[...foot[0],...foot[2]],restitution:p.ballRestitution,pairFriction:p.ballFriction,clothFriction:p.clothFriction,motionMaterial:{gravity:p.gravity,clothFriction:p.clothFriction,rollingLength:p.rollingLength,spinLength:p.spinLength},staticBounds:statics.flatMap((x,i)=>['cloth','cushion'].includes(x.kind)?[]:[geometry[i].bounds])});
 const options=Object.freeze({durationTicks,budgets:Object.freeze([...budgets]),maxWorldSteps,tailMaxNodes,maxVelocityCorrectionQuanta,executionProfile:'canonical-local-v1',clothRestitution:p.clothRestitution,deadlineTick:shotClock.deadlineTick});
 const binding=Object.freeze({kind:'experimental-raw-world-batch-binding-0850a4d',pipelineRevision,modelId:request.modelId,profileId:request.profileId,requestIdentity:request.requestKey,sceneIdentity:request.sceneId,epoch:request.epoch,sceneKey,requestKey,shotClock,scope:'elapsed-time admission plus bounded component continuation; not a gameplay verdict or cumulative work/event-budget certification',localOptions:options});
 bindings.set(binding,{request,shotClock,scene,hulls,options,pipelineRevision});return binding;
}

export function snapshotExperimentalRawWorldBatchBinding(binding){const d=data(binding);return {...d,scene:d.scene.slice(),hulls:d.hulls.map(h=>h.slice())};}
export function admitExperimentalRawWorldBatch(binding,batch){
 const d=data(binding),snapshot=snapshotRawWorldBatch(batch),b=batch.binding;
 if(batch.count<1||batch.count>1024||b.requestIdentity!==binding.requestIdentity||b.sceneId!==binding.sceneIdentity||b.epoch!==binding.epoch||b.sceneKey!==binding.sceneKey||b.requestKey!==binding.requestKey||b.shotClock.startingTick!==binding.shotClock.startingTick||b.shotClock.deadlineTick!==binding.shotClock.deadlineTick)throw RangeError('Owned raw tile with identical whole-shot binding required');
 const t=snapshot.template;
 if(t[2]!==d.request.slotToId.length||t[7]!==d.request.cueSlot||t[8]!==binding.sceneKey||t[9]!==binding.requestKey||d.request.slotToId.some((id,i)=>t[32+i*40]!==id))throw RangeError('Complete same immutable roster required');
 return snapshot;
}
