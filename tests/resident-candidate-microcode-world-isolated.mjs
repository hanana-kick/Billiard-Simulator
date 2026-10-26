// Coordinator-only three-process gate: compile immutable source -> lean GPU ->
// independent existing strict assertion. Future states are never runtime input.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {serialize,deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {microcodeUsedIntrinsicFunctions} from '../src/resident-candidate/microcode-isa.mjs';
import {processInvocationIdentity,assertSeparateTestProcesses} from './resident-candidate-invocation-identity.mjs';
import {assertControlCacheVariants,runControlVariantSession,compareControlVariantResults,controlVariantCompilationOrder,CONTROL_VARIANT_ORDER,CONTROL_VARIANT_MODES} from './resident-candidate-microcode-variant-contract.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),SELF=fileURLToPath(import.meta.url),ARCHIVE='/tmp/resident-raw-pc-isolated-native-v2';
const sha=x=>createHash('sha256').update(x).digest('hex'),log=x=>console.log(JSON.stringify(x)),read=(dir,name)=>readFileSync(join(dir,name)),json=(dir,name)=>JSON.parse(read(dir,name));
const save=(dir,name,value)=>{const bytes=serialize(value);writeFileSync(join(dir,name),bytes);return sha(bytes);};
const immutableFiles=['src/resident-candidate/microcode-isa.mjs','src/resident-candidate/microcode-source-intrinsics.mjs','src/resident-candidate/microcode-source-macros.mjs','src/resident-candidate/microcode-parser.mjs','src/resident-candidate/microcode-compiler.mjs','src/resident-candidate/microcode-allocation.mjs','src/resident-candidate/microcode-vm.mjs','src/resident-candidate/microcode-control-cache.mjs','src/resident-candidate/world-microcode-source.mjs','tests/resident-candidate-microcode-world-runtime.mjs','tests/resident-candidate-microcode-world-isolated.mjs','tests/resident-candidate-invocation-identity.mjs','tests/resident-candidate-microcode-variant-contract.mjs'];
const hashes=()=>Object.fromEntries(immutableFiles.map(name=>[name,sha(readFileSync(join(ROOT,name)))]));
function checkedRuntime(dir){const m=json(dir,'manifest.json'),bytes=read(dir,'runtime.v8');assert.equal(m.kind,'resident-microcode-world-gate-v1');assert.equal(sha(bytes),m.runtimeSha256);const runtime=deserialize(bytes);assert.equal(runtime.identity.sourceSha256,m.sourceSha256);assert.equal(runtime.identity.bytecodeSha256,sha(runtime.vm.code));assert.equal(runtime.identity.vmShaderSha256,sha(runtime.vm.shader));assert.deepEqual(runtime.vm.handlers.map(h=>({id:h.id,name:h.name,workgroupSize:h.workgroupSize,shaderBytes:h.code.length,shaderSha256:sha(h.code)})),m.handlers);return{m,runtime};}
export async function prepareMicrocodeWorld(dir,{instructionBudget=65536,dispatchChunks=512,workgroupSize=64,intrinsics='none',intrinsicFunctions,allocation='none',externalFunctions=[],controlMode='storage-v1'}={}){
 mkdirSync(dir,{recursive:true});const before=hashes(),bytes=read(ARCHIVE,'runtime.v8');assert.equal(sha(bytes),'4f2db833f116034d5ffe979b0d748418b4022f26c8906e0ed5cb13cf15b878dc','frozen accepted initial-only runtime');
 const original=deserialize(bytes),[{composeWorldMicrocodeSource},{compileMicrocodeWGSL},{microcodeVmLayout,generateMicrocodeVmWGSL,generateMicrocodeExternalWGSL},{assertMicrocodeWorldRuntime}]=await Promise.all([import('../src/resident-candidate/world-microcode-source.mjs'),import('../src/resident-candidate/microcode-compiler.mjs'),import('../src/resident-candidate/microcode-vm.mjs'),import('./resident-candidate-microcode-world-runtime.mjs')]);
 const source=composeWorldMicrocodeSource(original.pc),initial=compileMicrocodeWGSL(source.code,{entry:source.entry,intrinsics,intrinsicFunctions,externalFunctions,allocationMetadata:allocation!=='none'}),compiled=allocation==='none'?initial:(await import('../src/resident-candidate/microcode-allocation.mjs')).allocateMicrocodeLocals(initial,{mode:allocation}),entry=compiled.functions.find(f=>f.name===source.entry);assert.equal(entry.params.length,1);assert.equal(entry.params[0].words,3);
 const entrySlots=[{slot:entry.params[0].slot,candidateStride:1,value:0},{slot:entry.params[0].slot+1,value:0},{slot:entry.params[0].slot+2,value:0}],stackCapacity=Math.max(1,compiled.callDepth),layout=microcodeVmLayout({count:original.count,localWords:compiled.localWords,stackCapacity});
 const config={count:original.count,localWords:compiled.localWords,stackCapacity,instructionCount:compiled.instructions.length/8,entryPc:compiled.entryPc,instructionBudget,initialSlots:entrySlots,workgroupSize,intrinsics,controlMode,vmStateDisjoint:true,intrinsicFunctions:[...microcodeUsedIntrinsicFunctions(compiled.instructions)],externalFunctions:compiled.externalFunctions??[]},shader=generateMicrocodeVmWGSL(config),handlers=[...config.externalFunctions].sort((a,b)=>a.id-b.id).map(f=>({id:f.id,name:f.name,code:generateMicrocodeExternalWGSL({...config,workgroupSize:1,macroId:f.id}),workgroupSize:1}));
 const identity={originalGeneration:original.identity.generationIdentity,sourceSha256:compiled.sourceSha256,bytecodeSha256:sha(compiled.instructions),vmShaderSha256:sha(shader)},vm={version:compiled.version,code:compiled.instructions,shader,instructionCount:config.instructionCount,instructionBudget,dispatchChunks,localWords:compiled.localWords,stackCapacity,entryPc:compiled.entryPc,entrySlots,stride:layout.stride,totalWords:layout.totalWords,workgroupSize,intrinsics,controlMode,vmStateDisjoint:true,intrinsicFunctions:config.intrinsicFunctions,externalFunctions:config.externalFunctions,handlers},runtime={kind:'resident-raw-microcode-runtime-v1',original,vm,identity};
 assertMicrocodeWorldRuntime(runtime);assert.deepEqual(hashes(),before,'compiler/transport source stable during preparation');
 const runtimeSha256=save(dir,'runtime.v8',runtime),m={kind:'resident-microcode-world-gate-v1',processIsolationVersion:2,preparationInvocation:processInvocationIdentity(),sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),sourceHashes:before,...identity,runtimeSha256,count:6,frames:2,runs:2,originalRuntimeSha256:sha(bytes),functions:compiled.functions.length,bytecodeInstructions:config.instructionCount,bytecodeBytes:compiled.instructions.byteLength,localWords:compiled.localWords,stackCapacity,instructionBudget,dispatchChunks,workgroupSize,intrinsics,controlMode,vmStateDisjoint:true,intrinsicFunctions:config.intrinsicFunctions,compilerIntrinsicFunctions:intrinsicFunctions??null,allocation,allocationWordsBefore:initial.localWords,externalFunctions,externalMacroMetadata:config.externalFunctions,handlers:handlers.map(h=>({id:h.id,name:h.name,workgroupSize:h.workgroupSize,shaderBytes:h.code.length,shaderSha256:sha(h.code)})),intrinsicApproval:compiled.intrinsicApproval??null,shaderBytes:shader.length,sourceCapsUnchanged:true,expectedFileOpened:false,hardwarePerformance:false};
 writeFileSync(join(dir,'manifest.json'),JSON.stringify(m,null,2));log({stage:'microcode-world-prepared',directory:dir,...m});return m;
}
async function inspectCheckedMicrocodeWorld({m,runtime}){const{assertMicrocodeWorldRuntime}=await import('./resident-candidate-microcode-world-runtime.mjs');assertMicrocodeWorldRuntime(runtime);for(const key of['PhysicsLab','LabController','ShotSearchCore','LabFourBallWorldExperimental'])assert.equal(globalThis[key],undefined,'lean process has no CPU world '+key);const r={stage:'microcode-world-lean-inspection',count:m.count,frames:m.frames,expectedFileOpened:false,alreadyVerifiedInMemory:true,memory:process.memoryUsage()};log(r);return r;}
export async function inspectMicrocodeWorld(dir){return inspectCheckedMicrocodeWorld(checkedRuntime(dir));}
export async function executeMicrocodeWorld(dir){
 assert.equal(process.env.RUN_RESIDENT_MICROCODE_WORLD_GPU,'1','explicit coordinator numerical slot required');assert.equal(process.env.REQUIRE_WEBGPU,'1');const{m,runtime}=checkedRuntime(dir);assert.deepEqual(hashes(),m.sourceHashes,'compiler/transport checkpoint unchanged before any GPU compilation');await inspectCheckedMicrocodeWorld({m,runtime});
 const[{createNativeOwner},{createRetainedNativePipelineCache},{runMicrocodeWorld}]=await Promise.all([import('./resident-candidate-gpu-support.mjs'),import('./resident-candidate-native-session.mjs'),import('./resident-candidate-microcode-world-runtime.mjs')]);
 if(m.processIsolationVersion===2)assert.notEqual(processInvocationIdentity().id,m.preparationInvocation.id,'lean GPU process is separate from source preparation');
 const owner=await createNativeOwner('raw six rows source microcode two-h'),cache=createRetainedNativePipelineCache(owner,{trace:log}),runs=[];
 try{for(let run=1;run<=m.runs;run++){log({stage:'microcode-world-run-start',run});const result=await runMicrocodeWorld({owner,cache,plan:runtime,trace:log});runs.push(result);log({stage:'microcode-world-run-done',run,stats:result.stats,controls:result.controls,parity:'pending'});}}finally{owner.release();}
 const actual={kind:'resident-microcode-world-mapped-v1',runtimeSha256:m.runtimeSha256,sourceSha256:m.sourceSha256,runs,adapter:owner.adapterInfo,gpuPid:process.pid,processIsolationVersion:2,gpuInvocation:processInvocationIdentity()},actualSha256=save(dir,'actual.v8',actual);writeFileSync(join(dir,'actual-manifest.json'),JSON.stringify({actualSha256,runtimeSha256:m.runtimeSha256,gpuPid:process.pid}));log({stage:'microcode-world-gpu-complete',actualSha256,parity:'pending',expectedFileOpened:false});return actual;
}
export async function assertMicrocodeWorld(dir){
 const{m,runtime}=checkedRuntime(dir);assert.deepEqual(hashes(),m.sourceHashes,'same compiler/transport at comparison');const am=json(dir,'actual-manifest.json'),bytes=read(dir,'actual.v8');assert.equal(sha(bytes),am.actualSha256);const actual=deserialize(bytes);assert.equal(actual.runtimeSha256,m.runtimeSha256);if(m.processIsolationVersion===2){assert.equal(actual.processIsolationVersion,2);assertSeparateTestProcesses({gpu:actual.gpuInvocation,prepared:m.preparationInvocation});}else assert.notEqual(actual.gpuPid,process.pid,'legacy frozen gate uses historical PID-only guard');
 const expectedBytes=read(ARCHIVE,'expected.v8');assert.equal(sha(expectedBytes),'f68c428e2bd41c4c75733829f1a68457d86afe2bdeee631dff10b27bb529db67');const expected=deserialize(expectedBytes);assert.equal(expected.generationIdentity,runtime.original.identity.generationIdentity);
 const{compareRawWorldPcResult}=await import('./resident-candidate-raw-world-pc-compare.mjs');const fixture={frames:2,results:expected.results,plan:{preStrikeIdentity:runtime.original.identity.preStrikeIdentity}},plan={count:6,template:expected.template,pc:{...expected.pc,pipelines:{length:runtime.original.pc.pipelines.length}},sweeps:expected.sweeps,source:{transport:expected.transport},sourceMode:'microcode'};
 assert.equal(actual.runs.length,2);for(const [i,r]of actual.runs.entries()){
  assert.equal(r.stats.mappings,1);assert.equal(r.stats.copies,2);assert.deepEqual(r.stats.executionGroups.map(x=>x.name),['initialize','pump']);
  for(const c of r.controls){assert.equal(c[2],2,'VM transport incomplete/unsupported is never a physical miss');assert.equal(c[3],0);assert.equal(c[5],0);}
  compareRawWorldPcResult({fixture,plan,words:r.words,run:i+1,artifactPath:join(dir,'mismatch-'+i+'.bin'),trace:log});
  if(i){assert.equal(r.stats.cache.coldCompiles,0);assert.deepEqual(r.words,actual.runs[0].words);assert.deepEqual(r.vmWords,actual.runs[0].vmWords);}
 }
 const evidence={stage:'microcode-world-strict-gate-passed',runtimeSha256:m.runtimeSha256,actualSha256:am.actualSha256,count:6,frames:2,runs:2,strictOriginalComparisons:8,all11SourceGroups:true,rawParameters:true,expectedStatesUploaded:false,fullRest:false,native1024:false,hardwarePerformance:false};writeFileSync(join(dir,'assertion.json'),JSON.stringify(evidence,null,2));log(evidence);return evidence;
}
/** Same-source, same-device control-strategy comparison. Never loads an
 * expected state in preparation or the lean GPU process. */
export async function prepareControlCacheVariants(dir,options={}){
 assert.equal(options.controlMode,undefined,'pair owns its two exact modes');
 for(const controlMode of CONTROL_VARIANT_MODES)await prepareMicrocodeWorld(join(dir,controlMode),{...options,controlMode});
 const entries=CONTROL_VARIANT_MODES.map(mode=>checkedRuntime(join(dir,mode)));assertControlCacheVariants(entries);
 const result={stage:'control-variants-prepared',modes:CONTROL_VARIANT_MODES,order:CONTROL_VARIANT_ORDER,entireInitialPayloadEqual:true,bytecodeEqual:true,macroShadersEqual:true,sourceCapsAndBudgetEqual:true,runtimeIdentities:entries.map(({m})=>({mode:m.controlMode,sourceHead:m.sourceHead,runtimeSha256:m.runtimeSha256,vmShaderSha256:m.vmShaderSha256}))};
 writeFileSync(join(dir,'matched-inputs.json'),JSON.stringify(result,null,2));log(result);return result;
}
export async function executeControlCacheVariants(dir){
 assert.equal(process.env.RUN_RESIDENT_MICROCODE_WORLD_GPU,'1','explicit coordinator numerical slot required');assert.equal(process.env.REQUIRE_WEBGPU,'1');
 const dirs=CONTROL_VARIANT_MODES.map(mode=>join(dir,mode)),entries=dirs.map(checkedRuntime);assertControlCacheVariants(entries);
 for(let i=0;i<entries.length;i++){assert.deepEqual(hashes(),entries[i].m.sourceHashes,'both artifacts frozen before any GPU compilation');await inspectCheckedMicrocodeWorld(entries[i]);assert.notEqual(processInvocationIdentity().id,entries[i].m.preparationInvocation.id,'lean GPU process is separate from preparation');}
 // Equality was checked before deduplication. These immutable HOST inputs are
 // shared only to avoid retaining duplicate deserialization buffers; each run
 // still clones the plan and allocates independent GPU source/VM banks.
 entries[1].runtime.original=entries[0].runtime.original;entries[1].runtime.vm.code=entries[0].runtime.vm.code;entries[1].runtime.vm.handlers=entries[0].runtime.vm.handlers;assertControlCacheVariants(entries);
 log({stage:'control-variants-identical-inputs-shared',memory:process.memoryUsage(),gpuStateShared:false});
 const[{createNativeOwner},{createRetainedNativePipelineCache},{runMicrocodeWorld,microcodeWorldPipelineDescriptors}]=await Promise.all([import('./resident-candidate-gpu-support.mjs'),import('./resident-candidate-native-session.mjs'),import('./resident-candidate-microcode-world-runtime.mjs')]);
 const owner=await createNativeOwner('same-device raw6 control strategies two-h'),cache=createRetainedNativePipelineCache(owner,{trace:log});let runs,precompile;
 try{runs=await runControlVariantSession({entries,owner,cache,preflight:async()=>{
  const at=performance.now(),sets=entries.map(({runtime})=>microcodeWorldPipelineDescriptors(runtime));
  await cache.validateAll(sets.flatMap((set,i)=>set.descriptors.map(d=>({...d,name:CONTROL_VARIANT_MODES[i]+' '+d.name}))));
  // All driver compilation, including the new cache core, precedes source/VM
  // allocations and timing. Only pipelines survive between fresh executions.
  const preparationOrder=[];for(const descriptor of controlVariantCompilationOrder(sets)){const mode=sets.findIndex(set=>set.descriptors.includes(descriptor)),name=descriptor.name.startsWith('microcode ')?CONTROL_VARIANT_MODES[mode]+' '+descriptor.name:descriptor.name;preparationOrder.push(name);await cache.compile({...descriptor,name});}
  precompile={hostWallMs:performance.now()-at,cache:cache.stats(),beforeAnySourceVmAllocation:true,preparationOrder,orderPolicy:'broad-first-then-both-small-core-variants; execution order unchanged'};log({stage:'control-variants-all-pipelines-ready',...precompile});
 },run:runMicrocodeWorld,trace:log});}finally{owner.release();}
 const variantSession={kind:'resident-control-cache-abba-v1',order:CONTROL_VARIANT_ORDER,modes:CONTROL_VARIANT_MODES,deviceOwners:1,sharedPipelineCache:true,allPipelinesWarmBeforeRuns:true,precompile,processInvocationId:processInvocationIdentity().id};
 const receipts=[];
 for(let i=0;i<entries.length;i++){
  const {m}=entries[i],actual={kind:'resident-microcode-world-mapped-v1',runtimeSha256:m.runtimeSha256,sourceSha256:m.sourceSha256,runs:runs[i],adapter:owner.adapterInfo,gpuPid:process.pid,processIsolationVersion:2,gpuInvocation:processInvocationIdentity(),variantSession},actualSha256=save(dirs[i],'actual.v8',actual);
  writeFileSync(join(dirs[i],'actual-manifest.json'),JSON.stringify({actualSha256,runtimeSha256:m.runtimeSha256,gpuPid:process.pid}));receipts.push({mode:m.controlMode,actualSha256,runtimeSha256:m.runtimeSha256});
 }
 const receipt={stage:'control-variants-gpu-complete',variantSession,receipts,parity:'pending',expectedFileOpened:false};writeFileSync(join(dir,'gpu-session.json'),JSON.stringify(receipt,null,2));log(receipt);return receipt;
}
export async function assertControlCacheVariantGate(dir){
 const dirs=CONTROL_VARIANT_MODES.map(mode=>join(dir,mode));
 // Retain the complete existing independent original comparator, not only the
 // new same-bank transport comparison. Failure in either aborts publication.
 const originalAssertions=[];for(const path of dirs)originalAssertions.push(await assertMicrocodeWorld(path));
 const entries=dirs.map(checkedRuntime),actual=dirs.map(path=>deserialize(read(path,'actual.v8'))),result={...compareControlVariantResults(entries,actual),stage:'control-variants-strict-gate-passed',originalAssertions,strictOriginalComparisons:16,all11SourceGroups:true};
 writeFileSync(join(dir,'comparison.json'),JSON.stringify(result,null,2));log(result);return result;
}
if(process.argv[1]&&resolve(process.argv[1])===SELF){
 const[mode,arg]=process.argv.slice(2),dir=arg&&resolve(arg);
 try{
  assert.ok(dir,'explicit local artifact directory');
  const options={instructionBudget:Number(process.env.RESIDENT_MICROCODE_BUDGET??65536),dispatchChunks:Number(process.env.RESIDENT_MICROCODE_CHUNKS??512),workgroupSize:Number(process.env.RESIDENT_MICROCODE_WORKGROUP??64),intrinsics:process.env.RESIDENT_MICROCODE_INTRINSICS??'none',intrinsicFunctions:process.env.RESIDENT_MICROCODE_INTRINSIC_FUNCTIONS===undefined?undefined:JSON.parse(process.env.RESIDENT_MICROCODE_INTRINSIC_FUNCTIONS),allocation:process.env.RESIDENT_MICROCODE_ALLOCATION??'none',externalFunctions:process.env.RESIDENT_MICROCODE_EXTERNAL_FUNCTIONS===undefined?[]:JSON.parse(process.env.RESIDENT_MICROCODE_EXTERNAL_FUNCTIONS)};
  if(mode==='prepare')await prepareMicrocodeWorld(dir,{...options,controlMode:process.env.RESIDENT_MICROCODE_CONTROL_MODE??'storage-v1'});
  else if(mode==='prepare-variants')await prepareControlCacheVariants(dir,options);
  else if(mode==='inspect')await inspectMicrocodeWorld(dir);
  else if(mode==='gpu')await executeMicrocodeWorld(dir);
  else if(mode==='gpu-variants')await executeControlCacheVariants(dir);
  else if(mode==='assert')await assertMicrocodeWorld(dir);
  else if(mode==='assert-variants')await assertControlCacheVariantGate(dir);
  else throw Error('prepare|prepare-variants|inspect|gpu|gpu-variants|assert|assert-variants');
 }catch(error){console.error(error);process.exitCode=1;}
}
