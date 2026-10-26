// TEST ONLY three-process recurrence gate. The GPU process owns initial-only
// inputs, never imports an original CPU world, and never opens expected.v8.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {serialize,deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,resolve,relative} from 'node:path';
import {processInvocationIdentity,assertSeparateTestProcesses} from './resident-candidate-invocation-identity.mjs';
import {MICROCODE_ISA as VM} from '../src/resident-candidate/microcode-isa.mjs';
import {WORLD_DEVICE_PC as PC} from '../src/resident-candidate/world-device-pc.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),SELF=fileURLToPath(import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex'),log=x=>console.log(JSON.stringify(x));
const read=(dir,name)=>readFileSync(join(dir,name)),json=(dir,name)=>JSON.parse(read(dir,name));
const save=(dir,name,value)=>{const bytes=serialize(value);writeFileSync(join(dir,name),bytes);return sha(bytes);};
export const RECURRENCE_WORK=Object.freeze([256,256,512,1024]);
function sourceHashes(){
 const paths=[];const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())walk(path);else if(/\.(?:m?js|cjs)$/.test(path))paths.push(path);}};
 walk(join(ROOT,'src'));paths.push(join(ROOT,'vendor/rapier.cjs'));
 for(const name of readdirSync(join(ROOT,'tests')))if(/^resident-candidate-.*\.(?:mjs|cjs)$/.test(name))paths.push(join(ROOT,'tests',name));
 return Object.fromEntries(paths.sort().map(path=>[relative(ROOT,path),sha(readFileSync(path))]));
}
function checked(dir){
 const manifest=json(dir,'manifest.json');assert.equal(manifest.kind,'resident-microcode-recurrence-gate-v1');
 const bytes=read(dir,'runtime.v8');assert.equal(sha(bytes),manifest.runtimeSha256);const runtime=deserialize(bytes);
 assert.equal(runtime.identity.bytecodeSha256,sha(runtime.vm.code));assert.equal(runtime.identity.vmShaderSha256,sha(runtime.vm.shader));
 assert.equal(runtime.identity.originalGeneration,manifest.originalGeneration);assert.deepEqual(manifest.work,RECURRENCE_WORK);return{manifest,runtime};
}
export async function prepareRecurrence(dir){
 mkdirSync(dir,{recursive:true});const before=sourceHashes(),head=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
 const[{createRawEightHFixture},{serializeRawPcRecurrenceRuntime},{composeWorldMicrocodeSource},{compileMicrocodeWGSL},{allocateMicrocodeLocals},{microcodeVmLayout,generateMicrocodeVmWGSL,generateMicrocodeExternalWGSL},{assertMicrocodeWorldRecurrenceRuntime}]=await Promise.all([
  import('./resident-candidate-microcode-recurrence-fixture.mjs'),import('./resident-candidate-isolated-runtime.mjs'),import('../src/resident-candidate/world-microcode-source.mjs'),import('../src/resident-candidate/microcode-compiler.mjs'),import('../src/resident-candidate/microcode-allocation.mjs'),import('../src/resident-candidate/microcode-vm.mjs'),import('./resident-candidate-microcode-world-runtime.mjs')]);
 const{plan,identity,expected}=await createRawEightHFixture({sourceHead:head,sourceHashes:before});
 const original=serializeRawPcRecurrenceRuntime(plan,identity),source=composeWorldMicrocodeSource(original.pc);
 const initial=compileMicrocodeWGSL(source.code,{entry:source.entry,intrinsics:'none',externalFunctions:['rc_cue_flat_advance','rc_num_eval','rc_world_broad_commit_collision'],allocationMetadata:true}),compiled=allocateMicrocodeLocals(initial,{mode:'call-frames-v1'}),entry=compiled.functions.find(f=>f.name===source.entry);
 assert.equal(entry.params.length,1);assert.equal(entry.params[0].words,3);
 const entrySlots=[{slot:entry.params[0].slot,candidateStride:1,value:0},{slot:entry.params[0].slot+1,value:0},{slot:entry.params[0].slot+2,value:0}],stackCapacity=Math.max(1,compiled.callDepth),layout=microcodeVmLayout({count:6,localWords:compiled.localWords,stackCapacity});
 const config={count:6,localWords:compiled.localWords,stackCapacity,instructionCount:compiled.instructions.length/8,entryPc:compiled.entryPc,instructionBudget:65536,initialSlots:entrySlots,workgroupSize:64,intrinsics:'none',controlMode:'invocation-cache-v1',vmStateDisjoint:true,intrinsicFunctions:[],externalFunctions:compiled.externalFunctions??[]};
 const shader=generateMicrocodeVmWGSL(config),handlers=[...config.externalFunctions].sort((a,b)=>a.id-b.id).map(f=>({id:f.id,name:f.name,code:generateMicrocodeExternalWGSL({...config,workgroupSize:1,macroId:f.id}),workgroupSize:1}));
 const vm={version:compiled.version,code:compiled.instructions,shader,instructionCount:config.instructionCount,instructionBudget:config.instructionBudget,dispatchChunks:RECURRENCE_WORK.reduce((a,b)=>a+b,0),localWords:compiled.localWords,stackCapacity,entryPc:compiled.entryPc,entrySlots,stride:layout.stride,totalWords:layout.totalWords,workgroupSize:64,intrinsics:'none',controlMode:config.controlMode,vmStateDisjoint:true,intrinsicFunctions:[],externalFunctions:config.externalFunctions,handlers};
 const runtime={kind:'resident-raw-microcode-recurrence-runtime-v1',original,vm,identity:{originalGeneration:identity.generationIdentity,sourceSha256:compiled.sourceSha256,bytecodeSha256:sha(compiled.instructions),vmShaderSha256:sha(shader)}};
 assertMicrocodeWorldRecurrenceRuntime(runtime);
 // The accepted two-h artifact contains initial-only authority, not a future
 // state. Use it only as a source/payload regression check, never as a restart.
 const twoHBytes=readFileSync('/workspace/scratch/f887f82f638e/resident-native-artifacts/control-pair-native-v2/invocation-cache-v1/runtime.v8');assert.equal(sha(twoHBytes),'05de29cab18f9743717769cb1b9a7c5a456ca1660ee553fd6251161d420ed356');const twoH=deserialize(twoHBytes);
 for(const key of['input','program','sharedGeometry','init'])assert.deepEqual(original[key],twoH.original[key],'same raw initial-only '+key);
 for(const key of['bytecode','pipelines'])assert.deepEqual(original.pc[key],twoH.original.pc[key],'same original source PC '+key);
 assert.deepEqual(vm.code,twoH.vm.code,'same entire scalar bytecode beyond h2');assert.equal(vm.shader,twoH.vm.shader,'same accepted cached VM shader');assert.deepEqual(vm.handlers,twoH.vm.handlers,'same source macro shader bytes');
 const sameTwoHSource={runtimeSha256:sha(twoHBytes),rawInitialInputsEqual:true,sourcePcBytecodeAndOwnersEqual:true,microcodeBytecodeEqual:true,vmShaderEqual:true,macroShadersEqual:true,previousGpuStateLoaded:false};
 assert.deepEqual(sourceHashes(),before,'source frozen during original fixture and microcode preparation');
 const runtimeSha256=save(dir,'runtime.v8',runtime),expectedSha256=save(dir,'expected.v8',expected);
 const manifest={kind:'resident-microcode-recurrence-gate-v1',sourceHead:head,sourceHashes:before,preparationInvocation:processInvocationIdentity(),runtimeSha256,originalGeneration:identity.generationIdentity,work:RECURRENCE_WORK,count:6,frames:8,rawParameters:true,controlMode:config.controlMode,sourceSha256:compiled.sourceSha256,bytecodeSha256:runtime.identity.bytecodeSha256,vmShaderSha256:runtime.identity.vmShaderSha256,functions:compiled.functions.length,instructions:config.instructionCount,localWords:compiled.localWords,stackCapacity,instructionBudget:config.instructionBudget,dispatchChunks:vm.dispatchChunks,handlers:handlers.map(h=>({id:h.id,name:h.name,sha256:sha(h.code)})),sameTwoHSource,physicalQueryHorizonUnchanged:true,futureStatesUploaded:false,fullRest:false,rawToStrike:false,native1024:false,hardwarePerformance:false};
 writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest,null,2));writeFileSync(join(dir,'expected-manifest.json'),JSON.stringify({kind:'resident-microcode-recurrence-expectations-v1',expectedSha256,originalGeneration:identity.generationIdentity},null,2));
 log({stage:'eight-h-recurrence-prepared',sourceHead:head,runtimeSha256,expectedSha256,bytecodeSha256:manifest.bytecodeSha256,vmShaderSha256:manifest.vmShaderSha256,work:RECURRENCE_WORK,count:6,frames:8,expectedOnly:'expected.v8'});return manifest;
}
export async function executeRecurrence(dir){
 assert.equal(process.env.RUN_RESIDENT_MICROCODE_RECURRENCE_GPU,'1','coordinator numerical slot required');assert.equal(process.env.REQUIRE_WEBGPU,'1');
 const{manifest:m,runtime}=checked(dir);assert.deepEqual(sourceHashes(),m.sourceHashes,'same frozen source before GPU compilation');
 for(const name of['PhysicsLab','LabController','ShotSearchCore','LabFourBallWorldExperimental'])assert.equal(globalThis[name],undefined,'lean runtime has no CPU world '+name);
 assert.notEqual(processInvocationIdentity().id,m.preparationInvocation.id);
 const[{createNativeOwner},{createRetainedNativePipelineCache},{assertMicrocodeWorldRecurrenceRuntime,microcodeWorldPipelineDescriptors,createMicrocodeWorldSession}]=await Promise.all([import('./resident-candidate-gpu-support.mjs'),import('./resident-candidate-native-session.mjs'),import('./resident-candidate-microcode-world-runtime.mjs')]);
 assertMicrocodeWorldRecurrenceRuntime(runtime);const owner=await createNativeOwner('retained raw six-row original eight-h recurrence'),cache=createRetainedNativePipelineCache(owner,{trace:log});let session,result,precompile;
 try{
  const at=performance.now(),set=microcodeWorldPipelineDescriptors(runtime);await cache.validateAll(set.descriptors);
  const broad=set.handlerDescriptors.find(d=>d.name.includes('rc_world_broad_commit_collision'));assert.ok(broad);const order=[broad,...set.descriptors.filter(d=>d!==broad)];for(const d of order)await cache.compile(d);
  precompile={wallMs:performance.now()-at,cache:cache.stats(),order:order.map(d=>d.name),beforeAnySourceVmAllocation:true};log({stage:'eight-h-all-pipelines-ready',...precompile});
  session=await createMicrocodeWorldSession({owner,cache,plan:runtime,maxCaptures:RECURRENCE_WORK.length,trace:log});await session.initialize();let cumulative=0;
  for(const cycles of RECURRENCE_WORK){await session.pump(cycles);cumulative+=cycles;await session.capture('fixed-cycles-'+cumulative);log({stage:'eight-h-fixed-work-copied',cumulativeCycles:cumulative,mapped:false,physicalBoundaryUnknown:true});}
  result=await session.finish();
 }finally{if(session)await session.dispose();owner.release();}
 const actual={kind:'resident-microcode-recurrence-mapped-v1',runtimeSha256:m.runtimeSha256,gpuInvocation:processInvocationIdentity(),adapter:owner.adapterInfo,precompile,result},actualSha256=save(dir,'actual.v8',actual);
 writeFileSync(join(dir,'actual-manifest.json'),JSON.stringify({actualSha256,runtimeSha256:m.runtimeSha256},null,2));log({stage:'eight-h-gpu-complete',actualSha256,expectedFileOpened:false,parity:'pending',stats:result.stats});return actual;
}
/** Transport-only assertions on already mapped diagnostics. Never selects GPU
 * work or labels a partial physics step as a successful shot or ordinary miss. */
export function assertRetainedRecurrenceDiagnostics(runtime,result){
 const {pc,count}=runtime.original,{vm}=runtime,cs=result.checkpoints;assert.equal(count,6);assert.equal(pc.maxH,8);assert.equal(cs.length,RECURRENCE_WORK.length);let cumulative=0;
 for(let k=0;k<cs.length;k++){
  const c=cs[k];cumulative+=RECURRENCE_WORK[k];assert.equal(c.name,'fixed-cycles-'+cumulative);assert.equal(c.pumpCycles,cumulative);assert.ok(c.words instanceof Uint32Array&&c.words.length===pc.totalStateWords);assert.ok(c.vmWords instanceof Uint32Array&&c.vmWords.length===vm.totalWords);assert.equal(c.controls.length,count);
  for(let lane=0;lane<count;lane++){
   const b=lane*pc.stateWords,cb=pc.controlTailBase+lane*pc.controlWords,v=lane*vm.stride,h=c.words[b+5];
   assert.equal(c.words[b+4],runtime.original.identity.rawRows[lane].id);assert.ok(h<=8,'bounded requested h');
   assert.equal(c.words[cb+PC.header.magic],PC.magic);assert.equal(c.words[cb+PC.header.version],1);assert.equal(c.words[cb+PC.header.initialH],0);assert.equal(c.words[cb+PC.header.requestedH],8,'no host horizon rewrite');assert.equal(c.words[cb+PC.header.error],0);assert.ok([PC.status.ready,PC.status.complete,PC.status.worldTerminal].includes(c.words[cb+PC.header.status]));
   assert.equal(c.vmWords[v+VM.control.magicWord],VM.control.magic);assert.equal(c.vmWords[v+VM.control.versionWord],1);assert.equal(c.vmWords[v+VM.control.error],0);assert.ok([VM.status.ready,VM.status.waiting,VM.status.complete].includes(c.vmWords[v+VM.control.status]),'invalid/unsupported VM is not a miss');
   assert.deepEqual(c.controls[lane],Array.from(c.vmWords.slice(v,v+VM.control.words)));
   if(k){const prior=cs[k-1],steps=x=>(BigInt(x.vmWords[v+VM.control.stepsHigh])<<32n)+BigInt(x.vmWords[v+VM.control.stepsLow]);assert.ok(h>=prior.words[b+5],'source h never reset');assert.ok(c.words[cb+PC.header.completedH]>=prior.words[cb+PC.header.completedH],'PC request never reset');assert.ok(steps(c)>=steps(prior),'VM continuation counter never reset');}
  }
  if(k&&cs[k-1].controls.every(x=>x[VM.control.status]===VM.status.complete)){assert.deepEqual(c.words,cs[k-1].words,'completed source world remains unchanged under unused fixed work');assert.deepEqual(c.vmWords,cs[k-1].vmWords,'completed VM remains unchanged under unused fixed work');}
 }
 assert.equal(result.stats.mappings,1);assert.equal(result.stats.copies,2*cs.length);assert.equal(result.stats.initialWrites,8);assert.equal(result.stats.pumpCycles,vm.dispatchChunks);assert.equal(result.stats.executionGroups.filter(g=>g.name==='initialize').length,1);
 return{initializations:1,hostStateReadbacksDuringContinuation:0,transportSnapshots:cs.length,sourceParity:'final independent original comparator required'};
}
export async function assertRecurrence(dir){
 const{manifest:m,runtime}=checked(dir);assert.deepEqual(sourceHashes(),m.sourceHashes,'frozen source at original independent assertion');
 const am=json(dir,'actual-manifest.json'),bytes=read(dir,'actual.v8');assert.equal(sha(bytes),am.actualSha256);const actual=deserialize(bytes);assert.equal(actual.runtimeSha256,m.runtimeSha256);assertSeparateTestProcesses({gpu:actual.gpuInvocation,prepared:m.preparationInvocation});
 const em=json(dir,'expected-manifest.json'),expectedBytes=read(dir,'expected.v8');assert.equal(sha(expectedBytes),em.expectedSha256);assert.equal(em.originalGeneration,m.originalGeneration);const expected=deserialize(expectedBytes);
 const{compareRawEightHResult}=await import('./resident-candidate-microcode-recurrence-compare.mjs');
 const transport=assertRetainedRecurrenceDiagnostics(runtime,actual.result),checkpoints=actual.result.checkpoints;
 const p=expected.planMetadata;for(const [key,value]of Object.entries({generationIdentity:runtime.original.identity.generationIdentity,preStrikeIdentity:runtime.original.identity.preStrikeIdentity,sourceIdentity:runtime.original.identity.sourceIdentity,count:6,frames:8,stateWords:runtime.original.pc.stateWords,totalStateWords:runtime.original.pc.totalStateWords,controlTailBase:runtime.original.pc.controlTailBase,controlWords:runtime.original.pc.controlWords,ownerPipelines:runtime.original.pc.pipelines.length,maxH:8,sourceInstructions:runtime.original.pc.instructions}))assert.equal(p[key],value,'original expectation/runtime metadata '+key);
 const final=checkpoints.at(-1);const compared=compareRawEightHResult({expected,words:final.words,vmWords:final.vmWords,planMetadata:{...expected.planMetadata,vm:runtime.vm},trace:log});
 assert.equal(actual.result.stats.mappings,1);assert.equal(actual.result.stats.copies,2*checkpoints.length);assert.equal(actual.result.stats.initialWrites,8);assert.equal(actual.result.stats.pumpCycles,runtime.vm.dispatchChunks);
 const evidence={kind:'resident-microcode-eight-h-assertion-v1',status:'pass',runtimeSha256:m.runtimeSha256,actualSha256:am.actualSha256,expectedSha256:em.expectedSha256,count:6,frames:8,work:RECURRENCE_WORK,compared,transport,diagnostics:checkpoints.map(c=>({name:c.name,pumpCycles:c.pumpCycles,vmControls:c.controls,worldControls:Array.from({length:6},(_,i)=>Array.from(c.words.slice(runtime.original.pc.controlTailBase+i*runtime.original.pc.controlWords,runtime.original.pc.controlTailBase+i*runtime.original.pc.controlWords+16)))})),initializations:1,hostStateReadbacksDuringContinuation:0,cpuFutureStateUploads:false,intermediateSnapshotsAreNotExactHClaims:true,fullRest:false,rawToStrike:false,native1024:false,hardwarePerformance:false};
 writeFileSync(join(dir,'assertion.json'),JSON.stringify(evidence,null,2));log(evidence);return evidence;
}
if(process.argv[1]&&resolve(process.argv[1])===SELF){const[mode,path]=process.argv.slice(2);try{assert.ok(path,'explicit local artifact directory');const dir=resolve(path);if(mode==='prepare')await prepareRecurrence(dir);else if(mode==='gpu')await executeRecurrence(dir);else if(mode==='assert')await assertRecurrence(dir);else throw Error('prepare|gpu|assert');}catch(error){console.error(error);process.exitCode=1;}}
