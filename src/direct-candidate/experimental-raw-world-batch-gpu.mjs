/** Opt-in resident raw → generic world → journal/rules candidate-parallel bank.
 * Frozen 0850a4d semantics. No application routing or existing factory changes.
 */
import {createRawWorldGPU,validateRawWorldStrikeBackend} from './deterministic-raw-world.mjs';
import {packLandingChainCloth} from './deterministic-landing-chain.mjs';
import {deriveLandingVelocityCorrectionCap} from './deterministic-landing-3d.mjs';
import {packTubePrefixContext} from './deterministic-tube-prefix.mjs';
import {packRollingTailScene} from './deterministic-rolling-tail.mjs';
import {packRollingPairEntryConfig} from './deterministic-rolling-pair-entry.mjs';
import {packQtBridgeConfig} from './deterministic-qt-bridge.mjs';
import {packCanonicalRuleConfig} from './canonical-event-rules.mjs';
import {snapshotExperimentalRawWorldBatchBinding,admitExperimentalRawWorldBatch} from './experimental-raw-world-batch-binding.mjs';
import {buildRawWorldBatchSchedule,rawWorldBatchAllocationEnvelope} from './experimental-raw-world-batch-schedule.mjs';
import {verifyRawWorldBatchSources,verifyRawWorldBatchSchedule} from './experimental-raw-world-batch-audit.mjs';
import {rawWorldBatchPhaseSpec,liftRawWorldBatchPhase} from './experimental-raw-world-batch-phases.mjs';
const Q=2**24;
const CONTEXT_RESET=`@group(0) @binding(0) var<storage,read> original:array<u32>;@group(0) @binding(1) var<storage,read_write> output:array<u32>;@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){let b=id.y*160u;for(var k=0u;k<160u;k++){output[b+k]=select(original[b+k],0u,k==15u);}}`;
const COMPACT=`@group(0) @binding(0) var<storage,read> rules:array<u32>;@group(0) @binding(1) var<storage,read_write> output:array<u32>;@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let c=id.x;if(c*4u>=arrayLength(&output)){return;}for(var k=0u;k<4u;k++){output[c*4u+k]=rules[c*52u+48u+k];}}`;
function cancelled(signal){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');}
function phaseSpec(c,options){const first=c.list[0];return rawWorldBatchPhaseSpec(c.family,c.index,{...options,entryPoint:c.entryPoint??'main',combinedInput:c.family==='world'&&[6,7,8,17].includes(c.index)&&typeof first==='object'&&first.buffer==='combinedRows'});}
function key(c,options){return ['contextReset','compact'].includes(c.family)?c.family:JSON.stringify([c.family,c.index,c.entryPoint??'main',phaseSpec(c,options).ownership]);}
function diagnosticShader(strides){
 // Eight diagnostic inputs exceed some baseline binding limits. Instead use
 // one two-binding gather invocation per input, with fixed output offset.
 return strides.map((stride,i)=>{const at=strides.slice(0,i).reduce((a,b)=>a+b,0),total=strides.reduce((a,b)=>a+b,0);return `@group(0) @binding(0) var<storage,read> input:array<u32>;@group(0) @binding(1) var<storage,read_write> output:array<u32>;@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let k=id.x;let c=id.y;if(k<${stride}u){output[c*${total}u+${at}u+k]=input[c*${stride}u+k];}}`;});
}
export async function createExperimentalRawWorldBatchGPU(device,binding,{strikeBackend='staged',diagnostic=false,journalCapacity=128}={}){
 validateRawWorldStrikeBackend(strikeBackend);if(typeof diagnostic!=='boolean')throw TypeError('Explicit diagnostic flag');
 const d=snapshotExperimentalRawWorldBatchBinding(binding),sc=d.scene,o=d.options,B=sc[1],s=new Int32Array(sc.buffer),options={bodyCount:B,journalCapacity};
 const setup=packLandingChainCloth(sc,{...o,maxVelocityCorrectionQuanta:o.maxVelocityCorrectionQuanta??deriveLandingVelocityCorrectionCap(sc[17]),cycles:1,continuationTicks:o.durationTicks});
 setup.config[6]=o.maxWorldSteps;setup.config[5]=o.tailMaxNodes;setup.config[7]=o.deadlineTick;
 const ctx=packTubePrefixContext(sc,d.hulls,setup.options);ctx[14]=setup.config[4];ctx[24]=o.deadlineTick;ctx[25]=1;ctx[26]=o.durationTicks;
 const rctx=ctx.slice();rctx[13]=1;
 const c=new Int32Array(ctx.buffer),tailScene=packRollingTailScene({provenance:'actual-finite-table-roster',hulls:d.hulls,staticBounds:Array.from({length:sc[16]},(_,i)=>Array.from(s.slice(32+i*6,38+i*6),x=>x/Q)),clothTop:c[8]/Q,clothFootprint:Array.from(c.slice(9,13),x=>x/Q)});
 const pairMaterial=packRollingPairEntryConfig({provenance:'immutable-equal-sphere-pair-cloth-material',mass:s[3]/Q,pairRestitution:s[11]/Q,pairFriction:s[12]/Q,clothRestitution:o.clothRestitution,clothFriction:s[13]/Q});
 const plan=buildRawWorldBatchSchedule({...options,pipelineRevision:d.pipelineRevision,maxWorldSteps:o.maxWorldSteps,tailBytes:tailScene.byteLength});
 await verifyRawWorldBatchSources();verifyRawWorldBatchSchedule(plan,options);
 const rules=d.request.rules,slot=id=>d.request.scene.idToSlot[id],ruleConfig=packCanonicalRuleConfig({game:rules.game,n:rules.game,cue:d.request.cueSlot,first:slot(rules.firstId),second:slot(rules.secondId),opponent:rules.game===4?slot(rules.opponentId):slot(rules.firstId),threeCushion:rules.threeCushion,search:rules.search,method:rules.method,minCushions:rules.minCushions,allowKiss:rules.allowKiss,conditionOnly:rules.conditionOnly,capabilities:1});
 const diagnosticStrides=[256,256,128,128,32+8*journalCapacity,8*journalCapacity,52,16],diagnosticWords=diagnosticStrides.reduce((a,b)=>a+b,0);
 if(diagnostic){plan.allocations.push({name:'diagnostic',bytes:diagnosticWords*4,shared:false},{name:'diagnosticRead',bytes:diagnosticWords*4,shared:false});}
 const definitions=new Map();
 for(const command of plan.commands){if(command.kind!=='dispatch')continue;const k=key(command,options);if(definitions.has(k))continue;definitions.set(k,{code:command.family==='contextReset'?CONTEXT_RESET:command.family==='compact'?COMPACT:liftRawWorldBatchPhase(phaseSpec(command,options)),smooth:command.family==='world'&&command.index>=6&&command.index<=8||command.family==='micro'&&command.index>=4&&command.index<=6,journal:command.family==='journal'});}
 if(diagnostic)diagnosticShader(diagnosticStrides).forEach((code,i)=>definitions.set(`diagnostic${i}`,{code}));
 const smoothLayout=device.createBindGroupLayout({entries:[0,1,2,3].map(binding=>({binding,visibility:4,buffer:{type:binding===0?'read-only-storage':'storage'}}))}),journalLayout=device.createBindGroupLayout({entries:[0,1,2,3].map(binding=>({binding,visibility:4,buffer:{type:binding<2?'read-only-storage':'storage'}}))}),pipelines=new Map(),started=performance.now();
 device.pushErrorScope('validation');
 try{for(const [k,def]of definitions){const module=device.createShaderModule({code:def.code,label:`raw world batch ${k}`}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(`Batch phase ${k}: `+info.messages.map(x=>x.message).join('\n'));def.layout=def.smooth?smoothLayout:def.journal?journalLayout:null;pipelines.set(k,await device.createComputePipelineAsync({layout:def.layout?device.createPipelineLayout({bindGroupLayouts:[def.layout]}):'auto',compute:{module,entryPoint:'main'}}));}}
 finally{const error=await device.popErrorScope();if(error)throw Error(error.message);}
 const rawEngine=await createRawWorldGPU(device,{strikeBackend});
 return Object.freeze({strikeBackend,pipelineRevision:d.pipelineRevision,checkpoint:'0850a4d',compileMs:performance.now()-started,async run(batch,{signal,diagnostic:includeDiagnostic=diagnostic}={}){
  if(typeof includeDiagnostic!=='boolean'||includeDiagnostic&&!diagnostic)throw RangeError('Diagnostic pipelines require explicit factory opt-in');
  const runPlan=includeDiagnostic?plan:{...plan,allocations:plan.allocations.filter(a=>a.name!=='diagnostic'&&a.name!=='diagnosticRead')};
  const runStarted=performance.now();cancelled(signal);const snapshot=admitExperimentalRawWorldBatch(binding,batch),N=batch.count;
  if(N>device.limits.maxComputeWorkgroupsPerDimension)throw RangeError('Candidate dispatch dimension exceeds adapter limit');
  const envelope=rawWorldBatchAllocationEnvelope(runPlan,N,{rawSceneBytes:snapshot.rawScene.byteLength,strikeBackend,maxBufferSize:device.limits.maxBufferSize,maxStorageBufferBindingSize:device.limits.maxStorageBufferBindingSize});
  const buffers=new Map(),rawBank=rawEngine.createBank(batch);let readMapped=false,diagnosticMapped=false;
  try{
   for(const a of runPlan.allocations)buffers.set(a.name,device.createBuffer({size:a.bytes*(a.shared?1:N),usage:a.name==='readback'||a.name==='diagnosticRead'?9:140,label:`raw world batch ${a.name}`}));
   buffers.set('input',rawBank.preparedWorldBuffer);buffers.set('rawStatus',rawBank.handoffStatusBuffer);
   const upload=(name,words,repeat=false)=>{let data=words;if(repeat){data=new Uint32Array(words.length*N);for(let i=0;i<N;i++)data.set(words,i*words.length);}device.queue.writeBuffer(buffers.get(name),0,data);};
   for(const [name,words,repeat]of [['sceneBuffer',sc,false],['ctx',ctx,true],['rctx',rctx,true],['config',setup.config,true],['cloth',setup.cloth,false],['tailAsset',tailScene,false],['pairMaterial',pairMaterial,false],['qtSearchConfig',packQtBridgeConfig(),true],['qtFixedConfig',packQtBridgeConfig({durationMode:'fixed'}),true],['ruleConfig',ruleConfig,true]])upload(name,words,repeat);
   const iterations=new Uint32Array(o.maxWorldSteps*64);for(let i=0;i<o.maxWorldSteps;i++)iterations[i*64]=i;upload('iterations',iterations);
   const identities=new Uint32Array(N*6),prefixes=new Uint32Array(N*8),t=snapshot.template;
   for(let i=0;i<N;i++){const id=snapshot.rawRows[i*16];identities.set([id,t[2],t[3],t[8],t[9],t[7]],i*6);prefixes.set([0x52504a01,id,t[2],t[3],t[8],t[9],t[7],0x52575701],i*8);}upload('ruleIdentity',identities);upload('rawIdentity',prefixes);
   const encodeStarted=performance.now(),hostPrepareMs=encodeStarted-runStarted;const encoder=device.createCommandEncoder();rawBank.encode(encoder);let dispatches=rawBank.dispatches;
   const dispatch=(k,list,x,y=N)=>{const pipeline=pipelines.get(k),entries=list.map((r,binding)=>{const name=typeof r==='string'?r:r.buffer,buffer=buffers.get(name);const a=plan.allocations.find(a=>a.name===name);return {binding,resource:typeof r==='object'&&a?.shared?{buffer,offset:r.offset,size:r.size}:{buffer}};}),group=device.createBindGroup({layout:definitions.get(k).layout??pipeline.getBindGroupLayout(0),entries}),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(x,y);pass.end();dispatches++;};
   for(const command of plan.commands){if(command.kind==='clear')encoder.clearBuffer(buffers.get(command.buffer));else if(command.kind==='dispatch')dispatch(key(command,options),command.list,command.x==='candidateGroups32'?Math.ceil(N/32):command.x,command.family==='compact'?1:N);else if(command.kind==='readback')encoder.copyBufferToBuffer(buffers.get(command.source),0,buffers.get(command.target),0,16*N);}
   if(includeDiagnostic){const finish=plan.commands.findLast(x=>x.family==='journal'&&x.entryPoint==='finish'),gate=plan.commands.findLast(x=>x.family==='world'&&x.index===43),names=[finish.list[1],gate.list[2],'pairEntry','response','journal','aux','ruleOutput','rawStatus'];for(let i=0;i<names.length;i++)dispatch(`diagnostic${i}`,[names[i],'diagnostic'],Math.ceil(diagnosticStrides[i]/32));encoder.copyBufferToBuffer(buffers.get('diagnostic'),0,buffers.get('diagnosticRead'),0,diagnosticWords*4*N);}
   cancelled(signal);const commands=encoder.finish(),began=performance.now(),encodeMs=began-encodeStarted;device.queue.submit([commands]);await device.queue.onSubmittedWorkDone();const queueDone=performance.now();cancelled(signal);
   const read=buffers.get('readback');await read.mapAsync(1);readMapped=true;cancelled(signal);const compact=new Uint32Array(read.getMappedRange()).slice();read.unmap();readMapped=false;
   let words;if(includeDiagnostic){const b=buffers.get('diagnosticRead');await b.mapAsync(1);diagnosticMapped=true;cancelled(signal);words=new Uint32Array(b.getMappedRange()).slice();b.unmap();diagnosticMapped=false;}
   cancelled(signal);return {compact,...(words?{words,diagnosticWordStride:diagnosticWords}:{}),envelope:{candidateCount:N,pipelineRevision:d.pipelineRevision,checkpoint:'0850a4d',executionProfile:'canonical-local-v1',coverage:'frozen-0850a4d-no-later-cushion-or-kiss-extensions',cumulativeWorkBudgetEnforced:false,cumulativeEventBudgetEnforced:false},metrics:{...envelope,allocations:undefined,dispatches,readbackBytes:N*(16+(includeDiagnostic?diagnosticWords*4:0)),hostPrepareMs,encodeMs,submitToQueueDoneMs:queueDone-began,readbackMs:performance.now()-queueDone,submitToDoneMs:performance.now()-began}};
  }finally{if(readMapped)buffers.get('readback').unmap();if(diagnosticMapped)buffers.get('diagnosticRead').unmap();for(const [name,b]of buffers)if(name!=='input'&&name!=='rawStatus')b.destroy();rawBank.dispose();}
 }});
}
