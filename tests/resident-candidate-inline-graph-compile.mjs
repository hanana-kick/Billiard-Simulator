// Lean compile-only native feasibility. No world/input/expected artifacts,
// command encoders, buffers, uploads, dispatches or mappings are permitted.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex');
export const GRAPH_COMPILE_PINS=Object.freeze({initial:'c83e9d8a897d97f7ebb9bb591107e44c4b8c66a606e0691ca66d12381429d2de',source:'5a18bbbbd646454f2e00f7b1422773b2851b64d5ff165626f2a9f835ff86c0e7',closure:'6a60bc2629e30add603ffdf23a77585291e5155d06f836bff456695da73c5fea',core:'d1b84f15ea4ec37630ef1c26c21b6c945ffb684d8314c82977bfbdb51b8da497'});
export function assertGraphCompilePayload(p){
 assert.deepEqual(Object.keys(p).sort(),['kind','pins','shader','shaderBytes','work'].sort());
 assert.equal(p.kind,'resident-inline-graph-core-compile-only-v1');assert.deepEqual(p.pins,GRAPH_COMPILE_PINS);assert.equal(typeof p.shader,'string');assert.equal(Buffer.byteLength(p.shader),52334);assert.equal(p.shaderBytes,52334);assert.equal(sha(p.shader),GRAPH_COMPILE_PINS.core);
 assert.deepEqual(p.work,{pipelines:1,entryPoint:'main',bindings:8,candidateCount:2,workgroupSize:64,instructionBudget:65536,initialUploads:0,computeDispatches:0,mappings:0});return p;
}
export function prepareGraphCompilePayload(initialPath,out){
 assert.equal(existsSync(out),false,'immutable new compile payload path');const b=readFileSync(initialPath);assert.equal(sha(b),GRAPH_COMPILE_PINS.initial);const initial=deserialize(b);assert.equal(initial.kind,'owned-host-post-impact-inline-graph-only-v1');assert.deepEqual(initial.configuration.intrinsicFunctions,['rc_num_eval']);assert.equal(initial.compiled.sourceSha256,GRAPH_COMPILE_PINS.source);
 const p=assertGraphCompilePayload({kind:'resident-inline-graph-core-compile-only-v1',pins:GRAPH_COMPILE_PINS,shader:initial.core,shaderBytes:Buffer.byteLength(initial.core),work:{pipelines:1,entryPoint:'main',bindings:8,candidateCount:2,workgroupSize:64,instructionBudget:65536,initialUploads:0,computeDispatches:0,mappings:0}});const bytes=JSON.stringify(p);writeFileSync(out,bytes,{flag:'wx'});return{payloadSha256:sha(bytes),payloadBytes:Buffer.byteLength(bytes),work:p.work};
}
export async function runGraphCompileOnly(payloadPath,payloadSha256,out){
 assert.equal(process.env.REQUIRE_WEBGPU,'1');assert.equal(process.env.RUN_RESIDENT_INLINE_GRAPH_COMPILE,'core-only-no-dispatch');assert.equal(existsSync(out),false);
 const b=readFileSync(payloadPath);assert.equal(sha(b),payloadSha256);const p=assertGraphCompilePayload(JSON.parse(b));for(const n of['PhysicsLab','LabController','ShotSearchCore'])assert.equal(globalThis[n],undefined,'lean compiler role');
 const {createNativeOwner}=await import('./resident-candidate-gpu-support.mjs'),owner=await createNativeOwner('narrow graph-only core compile feasibility'),d=owner.device;let scoped=false;
 mkdirSync(out,{recursive:false});const trace=x=>console.log(JSON.stringify(x));
 const fixed={kind:p.kind,payloadSha256,shaderSha256:p.pins.core,pins:p.pins,adapter:owner.adapterInfo,work:p.work};trace({stage:'compile-only-adapter-ready',...fixed,memory:process.memoryUsage()});
 try{
  assert.ok(d.limits.maxStorageBuffersPerShaderStage>=8);assert.ok(d.limits.maxComputeInvocationsPerWorkgroup>=64);assert.ok(d.limits.maxComputeWorkgroupSizeX>=64);
  d.pushErrorScope('validation');scoped=true;const module=d.createShaderModule({code:p.shader,label:p.kind}),info=await module.getCompilationInfo(),errors=info.messages.filter(x=>x.type==='error').map(x=>({lineNum:x.lineNum,linePos:x.linePos,message:x.message}));
  trace({stage:'all-shader-preflight',errors,computeDispatches:0});assert.deepEqual(errors,[],'syntax preflight before expensive pipeline');
  const layout=d.createPipelineLayout({bindGroupLayouts:[d.createBindGroupLayout({entries:Array.from({length:8},(_,binding)=>({binding,visibility:4,buffer:{type:[0,3,6,7].includes(binding)?'storage':'read-only-storage'}}))})]});
  trace({stage:'new-core-pipeline-start',computeDispatches:0,memory:process.memoryUsage(),resource:process.resourceUsage()});const began=performance.now();
  const pipeline=await d.createComputePipelineAsync({layout,compute:{module,entryPoint:'main'}}),compileWallMs=performance.now()-began;assert.ok(pipeline);
  const error=await d.popErrorScope();scoped=false;assert.equal(error,null);
  const report={...fixed,status:'compile-pass',compileWallMs,computeDispatches:0,initialUploads:0,mappings:0,allocatedBuffers:0,numericalParity:false,hardwarePerformance:false,processMemory:process.memoryUsage(),resource:process.resourceUsage()};writeFileSync(join(out,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});trace({stage:'compile-only-terminal',...report});return report;
 }finally{if(scoped)try{await d.popErrorScope();}catch{}owner.release();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const[mode,...a]=process.argv.slice(2);if(mode==='prepare'){assert.equal(a.length,2);console.log(JSON.stringify(prepareGraphCompilePayload(...a.map(x=>resolve(x)))));}else if(mode==='compile'){assert.equal(a.length,3);await runGraphCompileOnly(resolve(a[0]),a[1],resolve(a[2]));}else throw Error('Explicit prepare or compile-only required');}
