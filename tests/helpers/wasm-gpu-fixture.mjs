/** Small structural GPU fixture; records host API calls, executes no physics. */
import assert from 'node:assert/strict';
import {planLiveWorldResources} from '../../src/direct-candidate/experimental-live-world-resources.mjs';
import {createWasmGpuEngineArtifact,loadWasmGpuEngineArtifact} from '../../src/wasm-gpu/engine-artifact.mjs';
export async function fixture({repeat=1,count=1,raw=false}={}){
 const sizes=[768,64,32],shared=[false,false,false],entries=sizes.map((size,binding)=>({binding,buffer:binding,offset:0,size}));
 const source=entries.map((e,i)=>`@group(0) @binding(${i}) var<storage,${i===2?'read_write':'read'}> b${i}:array<u32>;`).join('')+'@compute @workgroup_size(1) fn main(){}';
 const sourcePlan={kind:'experimental-live-mmq1-graph-v1',strikeBackend:'staged',sourceQualified:false,nativeQualified:false,allocations:sizes.map((size,i)=>({size,usage:140,initial:new Uint8Array(size),external:i===0?'prepared':i===1?'status':null})),readback:2,definitions:[{source,ownership:entries.map(e=>({stride:sizes[e.buffer]/4,base:0,length:e.size/4}))}],commands:[{kind:'dispatch',definition:0,x:1,entries},{kind:'clear',buffer:2,offset:0,size:32}]};
 const definitions=[{code:source+'@group(0) @binding(3) var<storage,read_write> fault:array<atomic<u32>>;',faultBinding:3,layout:'auto'}],commands=structuredClone(sourcePlan.commands);if(repeat>1){sourcePlan.commands=Array(repeat).fill(sourcePlan.commands[0]);commands.splice(0,commands.length,...Array(repeat).fill(commands[0]));}
 for(const c of commands)for(const e of c.entries||[])e.size*=count;
 const shape={strikeResult:[512,132],handoffInput:[64,136],rosterTemplate:[768,136],admitted:[4,136],budget:[16,136],prepared:[768,132],status:[64,132]};
 if(raw)Object.assign(shape,{scene:[64,136],strikeInput:[64,136],strikeScratch:[128,128]});
 for(const [role,value]of Object.entries(shape))if(!['scene','rosterTemplate','budget'].includes(role))value[0]*=count;
 const rawAllocations={strikeBackend:'staged',effectiveMaximumSteps:raw?1:0,sceneBytes:64,allocations:Object.entries(shape).map(([role,[bytes,usage]])=>({role,bytes,usage}))};
 const resources=planLiveWorldResources({plan:sourcePlan,shared,count,definitions,commands,rawAllocations});
 const structuralConfig={profile:'mmq1-no-cushion',strikeBackend:'staged'},sourceRevision='host-mock-structural-only';
 const {artifact}=await createWasmGpuEngineArtifact({count,lowered:{identity:'mock-host-only',sourcePlan,shared,definitions,commands,ownershipReport:{requiredStorageBuffersPerShaderStage:7}},rawAllocations,structuralConfig,sourceRevision});
 return loadWasmGpuEngineArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:sourceRevision,expectedStructuralConfig:structuralConfig,expectedCount:count});
}
export function mock(engine){
 let lossResolve;const lost=new Promise(resolve=>lossResolve=resolve),buffers=[],groups=[],writes=[],events=[],waiters=[];let compiled=0,held=false;
 const device={lost,pushErrorScope(){},async popErrorScope(){return null;},limits:{...engine.resources.requiredLimits,minStorageBufferOffsetAlignment:256},
 createShaderModule:({code})=>({code,getCompilationInfo:async()=>({messages:[]})}),
 createBindGroupLayout:x=>x,createPipelineLayout:x=>x,
 async createComputePipelineAsync(){compiled++;return{getBindGroupLayout:()=>({})};},
 createBuffer({size,usage}){const bytes=new Uint8Array(size);const b={size,usage,bytes,dead:false,destroy(){events.push('destroy');b.dead=true;},mapAsync:async()=>{},getMappedRange:()=>bytes.buffer,unmap(){}};buffers.push(b);return b;},
 createBindGroup(x){groups.push(x);return x;},
 createCommandEncoder(){const out=[];return{beginComputePass(){return{setPipeline(){},setBindGroup(i,g){for(const e of g.entries)assert.equal(e.resource.buffer.dead,false);},dispatchWorkgroups(x,y){out.push(['dispatch',x,y]);},end(){}};},clearBuffer(b){out.push(['clear',b]);},copyBufferToBuffer(...args){out.push(['copy',...args]);},finish(){return out;}};},
 queue:{writeBuffer(b,offset,data){writes.push([b,new Uint8Array(data.buffer,data.byteOffset,data.byteLength).slice()]);b.bytes.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),offset);},submit(batch){events.push(['submit',batch]);},onSubmittedWorkDone(){if(!held)return Promise.resolve();return new Promise(resolve=>waiters.push(resolve));}}
 };
 return {device,buffers,groups,writes,events,get compiled(){return compiled;},hold(){held=true;},release(){held=false;for(const resolve of waiters.splice(0))resolve();},lose(){lossResolve({message:'test loss'});}};
}

export async function rawFixture(engine){
 const {WASM_GPU_RAW_ARTIFACT_FORMAT,rawArtifactHash,loadWasmGpuRawArtifact}=await import('../../src/wasm-gpu/raw-artifact.mjs');
 const allocations=engine.rawAllocations.allocations.map(({role,bytes,usage})=>({role,bytes,sourceUsage:usage,usage:usage|8}));
 const roleIndex=role=>allocations.findIndex(a=>a.role===role),definitions=[],dictionary=[];
 for(let phase=0;phase<7;phase++){
  const roles=phase===6?['strikeResult','handoffInput','rosterTemplate','admitted','prepared','status','budget']:['scene','strikeInput','strikeResult','strikeScratch'];
  const code=roles.map((role,binding)=>`@group(0) @binding(${binding}) var<storage,read_write> b${binding}:array<u32>;`).join('')+`@compute @workgroup_size(32) fn main(){} // structural mock phase ${phase}`;
  definitions.push({code,layout:'auto',entryPoint:'main',constants:{}});
  dictionary.push({kind:'dispatch',definition:phase,x:Math.ceil(engine.count/32),entries:roles.map((role,binding)=>{const buffer=roleIndex(role);return{binding,buffer,offset:0,size:allocations[buffer].bytes};})});
 }
 const payload={count:engine.count,maximumSteps:1,sourceRevision:engine.sourceRevision,strikeBackend:'staged',allocations,definitions,commands:{dictionary,indices:[0,1,2,3,4,5,6]},outputs:{prepared:roleIndex('prepared'),status:roleIndex('status')},sourceHashes:await Promise.all(definitions.map(d=>rawArtifactHash(d.code)))};
 const artifact={format:WASM_GPU_RAW_ARTIFACT_FORMAT,sha256:await rawArtifactHash(payload),payload};
 const expectations={expectedArtifactSha256:artifact.sha256,expectedSourceRevision:engine.sourceRevision,expectedCount:engine.count,expectedMaximumSteps:1};
 return {engine:await loadWasmGpuRawArtifact(artifact,expectations),artifact,expectations};
}
