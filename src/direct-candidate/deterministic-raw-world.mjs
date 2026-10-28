import {compileLiveWorldPipeline,prepareLiveWorldShader} from './experimental-live-world-pipeline-cache.mjs';
/** Opt-in raw strike → full PW1 roster. No host candidate physics between GPU phases.
 * Full immutable scene admission is conservative: sphere/hull AABBs may reject
 * feasible strikes; they never stand in for a collision response. */
import {CANONICAL_MODEL,CANONICAL_DEFAULT_PARAMETERS,validateCanonicalRequest,validateCanonicalCandidate,createCanonicalShotClock} from './canonical-engine-contract.mjs';
import {STRIKE_VERSION,STRIKE_MATERIAL_PROFILE,packStrikeScene,packRawStrikes,runRawStrikeCPU,createRawStrikeGPU,generateRawStrikePhases} from './deterministic-raw-strike.mjs';
import {PREPARED_WORLD_VERSION,PREPARED_WORLD_WORDS} from './deterministic-prepared-world.mjs';
import {canonicalPositionWithin,canonicalVelocitySpinWithin,CANONICAL_STATE_DOMAIN_WGSL} from './deterministic-state-domain.mjs';
import {createExperimentalChunkedRawStrikeGPU,generateChunkedRawStrikePhases} from './experimental-raw-strike-chunks.mjs';
import {CONTACT_MATH_WGSL} from './deterministic-contact-math.mjs';
const Q=2**24,R=Math.round(.03075*Q),M=Math.round(.210*Q),bindings=new WeakMap(),batches=new WeakMap();
export const RAW_WORLD_VERSION=0x52575701,RAW_WORLD_STATUS_WORDS=16,RAW_WORLD_STEP_TICKS=16;
export const RAW_WORLD_REASON=Object.freeze({none:0,rawFailure:1,identity:2,stateDomain:3,clock:4,candidateAdmission:5,support:6,durationBudget:7});
const uint=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const vector=o=>[o?.x,o?.y,o?.z];
const zero=o=>vector(o).every(x=>x===0);
const quant=x=>{const q=Math.round(x*Q);if(!Number.isFinite(x)||!Number.isSafeInteger(q)||Math.abs(q)>0x7fffffff)throw RangeError('Finite canonical coordinates, no wrapping');return q;};
const owned=x=>x instanceof Uint32Array&&Object.prototype.toString.call(x.buffer)!=='[object SharedArrayBuffer]';
function bindingData(binding){const data=bindings.get(binding);if(!data)throw TypeError('Owned admitted raw-world binding');return data;}
function batchData(batch){const data=batches.get(batch);if(!data)throw TypeError('Owned immutable raw-world batch');return data;}
function geometryBounds(item){
 if(!zero(item.v)||!zero(item.w)||!item.rotation||item.rotation.x!==0||item.rotation.y!==0||item.rotation.z!==0||Math.abs(item.rotation.w)!==1)throw RangeError('Only fixed unrotated complete statics');
 const p=vector(item.pos);if(!p.every(Number.isFinite))throw RangeError('Complete static position');
 let lo,hi;if(item.shape==='box'){const h=vector(item.half);if(!h.every(x=>Number.isFinite(x)&&x>0))throw RangeError('Positive complete static half extents');lo=p.map((x,j)=>x-h[j]);hi=p.map((x,j)=>x+h[j]);}
 else if(item.shape==='convex'){if(!Array.isArray(item.vertices)||item.vertices.length<12||item.vertices.length%3||!item.vertices.every(Number.isFinite)||!Array.isArray(item.indices)||item.indices.length<12||item.indices.some(x=>!uint(x)||x>=item.vertices.length/3))throw RangeError('Complete convex hull geometry');lo=[0,1,2].map(j=>p[j]+Math.min(...item.vertices.filter((_,i)=>i%3===j)));hi=[0,1,2].map(j=>p[j]+Math.max(...item.vertices.filter((_,i)=>i%3===j)));}
 else throw RangeError('Unsupported static shape');
 if([...lo,...hi].some(x=>Math.abs(x)>8))throw RangeError('Static outside raw geometry domain');return {min:lo.map(x=>Math.floor(x*Q)/Q),max:hi.map(x=>Math.ceil(x*Q)/Q)};
}
/** Consumes contract identities, not an arbitrary selected-body subset. No
 * source height is snapped: all bodies must already be at exact encoded support. */
export function prepareRawWorldBinding(request,{absoluteTick,sceneKey,requestKey}={}){
 request=validateCanonicalRequest(request);
 if(request?.kind!=='canonical-request-v1'||request.modelId!==CANONICAL_MODEL.id||request.profileId!=='canonical-local-v1'||request.scene?.kind!=='canonical-scene-v1'||!request.scene.admitted||request.sceneId!==request.scene.sceneId)throw RangeError('Admitted complete canonical-local request required');
 if(!uint(absoluteTick)||absoluteTick>0x7fffffff||!uint(sceneKey)||!uint(requestKey))throw RangeError('Explicit signed-range common Q20 tick and opaque u32 binding keys');
 const shotClock=createCanonicalShotClock(request,absoluteTick);
 const physical=request.scene.physical,body=physical?.bodies,statics=physical?.statics;
 if(![3,4].includes(body?.length)||!Array.isArray(statics)||physical.modelId!==CANONICAL_MODEL.id||Object.keys(physical.parameters??{}).length!==Object.keys(CANONICAL_DEFAULT_PARAMETERS).length||Object.entries(CANONICAL_DEFAULT_PARAMETERS).some(([k,v])=>physical.parameters[k]!==v)||physical.sourceSettings?.dt!==1/960||physical.sourceSettings?.strokeSubsteps!==64)throw RangeError('Complete default model/material/source-settings binding');
 if(statics.filter(x=>x.kind==='cloth').length!==1||statics.filter(x=>x.kind==='cushion').length!==4||statics.some(x=>!['cloth','cushion','wood','floor'].includes(x.kind)))throw RangeError('Whole supported static roster required');
 const cloth=statics.find(x=>x.kind==='cloth');if(cloth.shape!=='box')throw RangeError('Only rectangular finite cloth supported');
 const allBounds=statics.map(geometryBounds),clothIndex=statics.indexOf(cloth),clothBounds=allBounds[clothIndex],top=quant(cloth.pos.y+cloth.half.y),foot=[Math.ceil((cloth.pos.x-cloth.half.x)*Q),Math.floor((cloth.pos.x+cloth.half.x)*Q),Math.ceil((cloth.pos.z-cloth.half.z)*Q),Math.floor((cloth.pos.z+cloth.half.z)*Q)];
 const template=new Uint32Array(PREPARED_WORLD_WORDS),signed=new Int32Array(template.buffer),selected=request.cueSlot;
 if(!uint(selected)||selected>=body.length||body[selected].id!==request.selectedId||body.some((x,i)=>x.id!==request.slotToId[i]||i>0&&x.id<=body[i-1].id))throw RangeError('Complete sorted stable-ID roster and selected slot');
 template.set([PREPARED_WORLD_VERSION,0,body.length,absoluteTick,1,1,1,selected,sceneKey,requestKey]);
 const fixed=allBounds.filter((_,i)=>i!==clothIndex);
 for(let i=0;i<body.length;i++){
  const x=body[i];if(!uint(x.id)||x.shape!=='sphere'||x.kind!=='ball'||x.radius!==.03075||x.mass!==.210||!zero(x.v)||!zero(x.w))throw RangeError('Every initial body must be equal stationary solid sphere; no reset/projection');
  const p=vector(x.pos).map(quant);if(!canonicalPositionWithin(p)||p[1]!==top+R||p[0]-R<=foot[0]||p[0]+R>=foot[1]||p[2]-R<=foot[2]||p[2]+R>=foot[3])throw RangeError('Every body must have exact supported height inside finite cloth');
  for(const box of fixed)if(!p.some((v,j)=>v+R<Math.floor(box.min[j]*Q)||v-R>Math.ceil(box.max[j]*Q)))throw RangeError('Initial body/static clearance unresolved by conservative AABB');
  for(let j=0;j<i;j++){const b=32+40*j,delta=p.map((v,k)=>BigInt(v-signed[b+4+k]));if(delta.reduce((s,v)=>s+v*v,0n)<=BigInt(2*R+256)**2n)throw RangeError('Initial sphere pair contact or unresolved guard');}
  const b=32+40*i;template.set([x.id,R,M],b);signed.set(p,b+4);
 }
 const obstacleOwners=statics.flatMap((x,i)=>i===clothIndex?[]:[Object.freeze({kind:'static',staticSlot:i,materialKind:x.kind})]);const obstacles=fixed.slice();for(let i=0;i<body.length;i++)if(i!==selected){const b=32+40*i,p=Array.from(signed.slice(b+4,b+7));obstacles.push({min:p.map(x=>(x-R)/Q),max:p.map(x=>(x+R)/Q)});obstacleOwners.push(Object.freeze({kind:'sphere',bodySlot:i,bodyId:body[i].id}));}
 // Excluded finite-support complement, not added collision surfaces. Thin top
 // slabs reject a ball crossing an edge at any microstep; cue/ball clearance is
 // otherwise the original canonical raw predicate. Bounds cover raw's ±8m domain.
 const f=foot.map(x=>x/Q),t=top/Q;obstacles.push({min:[-8,-8,-8],max:[f[0],t,8]},{min:[f[1],-8,-8],max:[8,t,8]},{min:[-8,-8,-8],max:[8,t,f[2]]},{min:[-8,-8,f[3]],max:[8,t,8]});
 for(const side of ['min-x','max-x','min-z','max-z'])obstacleOwners.push(Object.freeze({kind:'finite-support-exclusion',side}));
 const selectedBase=32+40*selected,rawScene=packStrikeScene({kind:'complete-isolated-sphere-fixed-aabbs',complete:true,materialProfile:STRIKE_MATERIAL_PROFILE,support:'cloth',center:Array.from(signed.slice(selectedBase+4,selectedBase+7),x=>x/Q),floorTop:top/Q,gravity:physical.parameters.gravity,obstacles});
 const binding=Object.freeze({kind:'canonical-raw-world-binding-v1',version:RAW_WORLD_VERSION,modelId:request.modelId,profileId:request.profileId,sceneId:request.sceneId,requestIdentity:request.requestKey,epoch:request.epoch,selectedId:request.selectedId,selectedSlot:selected,bodyCount:body.length,absoluteTick,shotClock,sceneKey,requestKey,obstacleCount:obstacles.length,ownedCloth:Object.freeze({staticSlot:clothIndex,canonicalOwner:'scene-static-slot:'+clothIndex,kind:'cloth',shape:'box',representation:'persistent support law plus finite footprint guards'}),obstacleOwners:Object.freeze(obstacleOwners),sourceRapierEquivalent:false,geometry:'all actual statics and other stationary spheres as conservative outward AABBs; finite-support exclusion guards',fullRawDomain:false});
 bindings.set(binding,{request,template,rawScene,foot,top,shotClock});return binding;
}
export function prepareRawWorldBatch(binding,candidates,{maximumSteps=4096}={}){
 const data=bindingData(binding);if(!Array.isArray(candidates)||!candidates.length)throw RangeError('Nonempty contract candidate batch');
 if(!Number.isInteger(maximumSteps)||maximumSteps<1||maximumSteps>4096)throw RangeError('Separate integer raw work cap1..4096');
 const durationStepCap=Math.floor(data.shotClock.maximumTicks/RAW_WORLD_STEP_TICKS),effectiveMaximumSteps=Math.min(maximumSteps,durationStepCap),boundByDuration=durationStepCap<=maximumSteps,budgetWords=Uint32Array.of(effectiveMaximumSteps,maximumSteps,data.shotClock.maximumTicks,boundByDuration?1:0),admitted=new Uint32Array(candidates.length),keys=[];
 const rawRows=packRawStrikes(candidates.map((candidate,i)=>{if(candidate?.requestKey!==binding.requestIdentity||candidate.sceneId!==binding.sceneId||candidate.epoch!==binding.epoch||candidate.modelId!==binding.modelId||candidate.profileId!==binding.profileId)throw RangeError('Candidate/request/scene/profile/epoch identity mismatch');const checked=validateCanonicalCandidate(data.request,candidate);if(checked.candidateKey!==candidate.candidateKey||checked.admitted!==candidate.admitted)throw RangeError('Candidate identity/admission mismatch');admitted[i]=checked.admitted?1:0;keys.push(checked.candidateKey);return {id:checked.candidateId,...checked.settings,maximumSteps:effectiveMaximumSteps||maximumSteps};}));
 const batch=Object.freeze({kind:'canonical-raw-world-batch-v1',binding,count:candidates.length,candidateKeys:Object.freeze(keys),maximumSteps,effectiveMaximumSteps,durationStepCap,boundByDuration,fixedStepTicks:RAW_WORLD_STEP_TICKS});batches.set(batch,{...data,rawRows,admitted,budgetWords});return batch;
}
/** Diagnostic copies only. Mutating these cannot affect the immutable bank. */
export function snapshotRawWorldBatch(batch){const d=batchData(batch);return {template:d.template.slice(),rawScene:d.rawScene.slice(),rawRows:d.rawRows.slice(),admitted:d.admitted.slice(),budgetWords:d.budgetWords.slice()};}
function handoffRawWorldCPU(batch,result){const d=batchData(batch),count=batch.count;if(!owned(result)||result.length!==count*128)throw RangeError('Complete owned raw result bank');const world=new Uint32Array(count*192),status=new Uint32Array(count*16),r=new Int32Array(result.buffer,result.byteOffset,result.length),templateI=new Int32Array(d.template.buffer),selected=d.template[7],bodyBase=32+40*selected;
 for(let i=0;i<count;i++){const b=i*128,o=i*16,w=i*192;let reason=0,kind=4;status.set([d.rawRows[i*16],4,0,result[b+1],result[b+2],result[b+6],PREPARED_WORLD_VERSION,result[b+7],d.template[8],d.template[9],0,RAW_WORLD_VERSION],o);
  if(!d.admitted[i])reason=5;
  else if(!batch.effectiveMaximumSteps){reason=7;kind=5;}
  else if(result[b]!==d.rawRows[i*16]||result[b+6]!==STRIKE_VERSION||Array.from(d.rawRows.subarray(i*16,i*16+16)).some((x,j)=>result[b+64+j]!==x)||result[b+3]>d.rawRows[i*16+2]||result[b+7]!==result[b+3]*16||[0,1,2].some(j=>r[b+125+j]!==templateI[bodyBase+4+j]))reason=2;
  else if(result[b+1]!==1){if([4,5].includes(result[b+1])){reason=result[b+1]===5&&batch.boundByDuration?7:1;kind=result[b+1];}else reason=2;}
  else if(result[b+2]||result[b+97])reason=2;
  else if(!canonicalPositionWithin(r.slice(b+8,b+11))||!canonicalVelocitySpinWithin(r.slice(b+12,b+15),r.slice(b+16,b+19)))reason=3;
  else if(result[b+96]!==1||r[b+9]!==templateI[bodyBase+5]||r[b+13]!==0)reason=6;
  else if(result[b+7]>d.shotClock.maximumTicks){reason=7;kind=5;}
  else if(d.template[3]+result[b+7]>0x7fffffff)reason=4;
  if(reason){status[o+1]=kind;status[o+2]=reason;continue;}
  world.set(d.template,w);world[w+1]=result[b];world[w+3]=d.template[3]+result[b+7];for(let j=0;j<3;j++){world[w+bodyBase+4+j]=result[b+8+j];world[w+bodyBase+8+j]=result[b+12+j];world[w+bodyBase+12+j]=result[b+16+j];}status[o+1]=1;status[o+10]=world[w+3];
 }return {world,status};}
export function runRawWorldCPU(batch){const d=batchData(batch),raw=batch.effectiveMaximumSteps?runRawStrikeCPU(d.rawScene,d.rawRows):new Uint32Array(batch.count*128);return {...handoffRawWorldCPU(batch,raw),raw};}
export const RAW_WORLD_HANDOFF_WGSL=CONTACT_MATH_WGSL+CANONICAL_STATE_DOMAIN_WGSL+`
@group(0) @binding(0) var<storage,read> raw:array<u32>;
@group(0) @binding(1) var<storage,read> expected:array<u32>;
@group(0) @binding(2) var<storage,read> rosterTemplate:array<u32>;
@group(0) @binding(3) var<storage,read> admitted:array<u32>;
@group(0) @binding(4) var<storage,read_write> world:array<u32>;
@group(0) @binding(5) var<storage,read_write> status:array<u32>;
@group(0) @binding(6) var<storage,read> budget:array<u32>;
fn rv(b:u32)->vec3<i32>{return vec3<i32>(bitcast<i32>(raw[b]),bitcast<i32>(raw[b+1u]),bitcast<i32>(raw[b+2u]));}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){let i=gid.x;if(i>=arrayLength(&admitted)){return;}let b=i*128u;let o=i*16u;let w=i*192u;let a=32u+40u*rosterTemplate[7u];for(var j=0u;j<192u;j++){world[w+j]=0u;}for(var j=0u;j<16u;j++){status[o+j]=0u;}status[o]=expected[i*16u];status[o+1u]=4u;status[o+3u]=raw[b+1u];status[o+4u]=raw[b+2u];status[o+5u]=raw[b+6u];status[o+6u]=${PREPARED_WORLD_VERSION}u;status[o+7u]=raw[b+7u];status[o+8u]=rosterTemplate[8u];status[o+9u]=rosterTemplate[9u];status[o+11u]=${RAW_WORLD_VERSION}u;
 var mismatch=raw[b]!=expected[i*16u]||raw[b+6u]!=${STRIKE_VERSION}u||raw[b+3u]>expected[i*16u+2u]||raw[b+7u]!=raw[b+3u]*16u;
 for(var j=0u;j<16u;j++){if(raw[b+64u+j]!=expected[i*16u+j]){mismatch=true;}}for(var j=0u;j<3u;j++){if(raw[b+125u+j]!=rosterTemplate[a+4u+j]){mismatch=true;}}
 var reason=0u;var kind=4u;if(admitted[i]==0u){reason=5u;}else if(budget[0u]==0u){reason=7u;kind=5u;}else if(mismatch){reason=2u;}else if(raw[b+1u]!=1u){reason=2u;if(raw[b+1u]==4u||raw[b+1u]==5u){reason=select(1u,7u,raw[b+1u]==5u&&budget[3u]!=0u);kind=raw[b+1u];}}else if(raw[b+2u]!=0u||raw[b+97u]!=0u){reason=2u;}else if(!canonicalPositionWithin(rv(b+8u),67108864)||!canonicalVelocitySpinWithin(rv(b+12u),rv(b+16u))){reason=3u;}else if(raw[b+96u]!=1u||raw[b+9u]!=rosterTemplate[a+5u]||raw[b+13u]!=0u){reason=6u;}else if(raw[b+7u]>budget[2u]){reason=7u;kind=5u;}else if(raw[b+7u]>2147483647u-rosterTemplate[3u]){reason=4u;}
 if(reason!=0u){status[o+1u]=kind;status[o+2u]=reason;return;}for(var j=0u;j<192u;j++){world[w+j]=rosterTemplate[j];}world[w+1u]=raw[b];world[w+3u]=rosterTemplate[3u]+raw[b+7u];for(var j=0u;j<3u;j++){world[w+a+4u+j]=raw[b+8u+j];world[w+a+8u+j]=raw[b+12u+j];world[w+a+12u+j]=raw[b+16u+j];}status[o+1u]=1u;status[o+10u]=world[w+3u];}
`;
export const RAW_WORLD_STRIKE_BACKENDS=Object.freeze(['staged','chunked-16']);
export function validateRawWorldStrikeBackend(value){if(!RAW_WORLD_STRIKE_BACKENDS.includes(value))throw RangeError('Explicit raw strike backend: staged or chunked-16');return value;}
export async function createRawWorldGPU(device,{onCompileStage=()=>{},strikeBackend='staged',signal,reusePipelines=false}={}){
 validateRawWorldStrikeBackend(strikeBackend);
 if(typeof reusePipelines!=='boolean')throw TypeError('Explicit pipeline reuse flag');
 if(typeof onCompileStage!=='function')throw TypeError('Compile-stage observer');
 // Pre-validate every module before any heavy pipeline lowering. Raw numerical
 // sources remain unchanged; its factory compiles the same preflighted code.
 const parseStarted=performance.now(),sources=[...(strikeBackend==='staged'?generateRawStrikePhases():generateChunkedRawStrikePhases()),{name:'raw_world_handoff',code:RAW_WORLD_HANDOFF_WGSL}];let module;const nativeCache=reusePipelines&&typeof device?.lost?.then==='function',preflightShaders=new Map();
 for(const source of sources){const started=performance.now();let candidate;if(nativeCache){candidate=await prepareLiveWorldShader(device,{code:source.code,label:source.name,signal});preflightShaders.set(source.name,candidate);}else{candidate=device.createShaderModule({code:source.code,label:source.name});const info=await candidate.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(source.name+': '+info.messages.map(x=>x.message).join('\n'));}onCompileStage({name:source.name,phase:'parse-complete',parseMs:performance.now()-started});if(source.name==='raw_world_handoff')module=candidate;}
 const parseMs=performance.now()-parseStarted,raw=await (strikeBackend==='staged'?createRawStrikeGPU(device,{onCompileStage,preflightShaders,signal,reusePipelines:nativeCache}):createExperimentalChunkedRawStrikeGPU(device,{onCompileStage})),start=performance.now(),pipeline=await (nativeCache?compileLiveWorldPipeline(device,{code:RAW_WORLD_HANDOFF_WGSL,preflightShader:module,signal}):device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}})),compileMs=performance.now()-start;onCompileStage({name:'raw_world_handoff',phase:'complete',compileMs});return Object.freeze({strikeBackend,compileMs,parseMs,rawCompileMs:raw.compileMs,shaderBytes:new TextEncoder().encode(RAW_WORLD_HANDOFF_WGSL).length,
 createBank(batch){
  const d=batchData(batch),ownedBuffers=[],make=(size,usage)=>{const b=device.createBuffer({size,usage});ownedBuffers.push(b);return b;};
  // No raw pose, force, or integration invocation when the elapsed duration
  // contains no full canonical step. The zero buffer has no raw provenance.
  const source=batch.effectiveMaximumSteps?raw.createBank(d.rawScene,d.rawRows,{chunkSize:16}):{resultBuffer:make(batch.count*128*4,132),dispatches:0,encode(){},async encodeCooperatively(){},dispose(){}},input=make(d.rawRows.byteLength,136),template=make(d.template.byteLength,136),admitted=make(d.admitted.byteLength,136),budgetBuffer=make(d.budgetWords.byteLength,136),world=make(batch.count*192*4,132),status=make(batch.count*16*4,132);
  device.queue.writeBuffer(input,0,d.rawRows);device.queue.writeBuffer(template,0,d.template);device.queue.writeBuffer(admitted,0,d.admitted);device.queue.writeBuffer(budgetBuffer,0,d.budgetWords);
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[source.resultBuffer,input,template,admitted,world,status,budgetBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))});let disposed=false;
  return Object.freeze({strikeBackend,count:batch.count,preparedWorldBuffer:world,preparedWorldWordStride:192,handoffStatusBuffer:status,handoffStatusWordStride:16,rawResultBuffer:source.resultBuffer,rawResultWordStride:128,identity:batch,dispatches:source.dispatches+1,rawPhysicsDispatches:source.dispatches,effectiveMaximumSteps:batch.effectiveMaximumSteps,
   encode(encoder){if(disposed)throw Error('Disposed raw-world bank');source.encode(encoder);const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(batch.count/32));pass.end();},
   async encodeCooperatively({getEncoder,afterCommand,signal}={}){
    if(typeof getEncoder!=='function'||typeof afterCommand!=='function')throw TypeError('Owned encoder and completed-command callback required');
    const current=()=>{if(disposed)throw Error('Disposed raw-world bank');if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};
    current();if(typeof source.encodeCooperatively!=='function')throw Error('Cooperative encoding requires staged raw backend');
    await source.encodeCooperatively({getEncoder,afterCommand:async()=>{await afterCommand();current();},signal});current();
    const pass=getEncoder().beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(batch.count/32));pass.end();await afterCommand();current();
   },
   dispose(){if(!disposed){disposed=true;source.dispose();ownedBuffers.forEach(b=>b.destroy());}}});
 }
 });}
