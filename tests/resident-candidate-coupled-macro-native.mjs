// TEST ONLY: three independent captured original-source calls, not a raw-world
// trajectory. The GPU role opens initial inputs only, never assertion outputs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {serialize,deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {microcodeVmLayout,generateMicrocodeVmWGSL,generateMicrocodeExternalWGSL,createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {approveSourceMacros} from '../src/resident-candidate/microcode-source-macros.mjs';
import {processInvocationIdentity,assertSeparateTestProcesses} from './resident-candidate-invocation-identity.mjs';
import {assertCoupledComponentInput as assertInputSchema,assertCoupledComponentAssertions} from './resident-candidate-coupled-component-schema.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url)),SELF=fileURLToPath(import.meta.url);
const TARGET='rc_coupled_transport_advance',sha=x=>createHash('sha256').update(x).digest('hex'),log=x=>console.log(JSON.stringify(x));
const read=(dir,name)=>readFileSync(join(dir,name)),json=(dir,name)=>JSON.parse(read(dir,name));
const save=(dir,name,value)=>{const b=serialize(value);writeFileSync(join(dir,name),b,{flag:'wx'});return sha(b);};
const types=['storage','read-only-storage','read-only-storage','storage','read-only-storage','read-only-storage','storage'];

/** Admission is deliberately narrow: measured three original calls, not a
 * general diagnostic importer or a hidden world-state continuation shortcut. */
export function assertCoupledComponentInput(p){
 assertInputSchema(p);
 const approval=approveSourceMacros(p.canonicalSource,{functionNames:[TARGET],storageBindings:{...I.bindings,rc_event_audit:5}}).entries[0];assert.equal(approval.id,3);assert.equal(approval.parameterWords.length,6);assert.equal(approval.resultWords,1);
 return approval;
}

export function buildCoupledComponentProgram(input){
 const approval=assertCoupledComponentInput(input);
 const compiled=allocateMicrocodeLocals(compileMicrocodeWGSL(input.canonicalSource,{entry:TARGET,storageBindings:{...I.bindings,rc_event_audit:5},intrinsics:'none',externalFunctions:[TARGET],allocationMetadata:true}),{mode:'call-frames-v1'});
 const root=compiled.functions.find(x=>x.name===TARGET);assert.deepEqual(compiled.externalFunctions.map(x=>x.name),[TARGET]);assert.equal(root.returnWords,1);
 const config={count:1,localWords:compiled.localWords,stackCapacity:compiled.callDepth,entryPc:compiled.entryPc,instructionCount:compiled.instructions.length/I.instructionWords,instructionBudget:4096,workgroupSize:1,intrinsics:'none',intrinsicFunctions:[],externalFunctions:compiled.externalFunctions,controlMode:'invocation-cache-v1',vmStateDisjoint:true,initialSlots:root.params.map((x,i)=>({slot:x.slot,value:input.cases[0].args[i]}))};
 const layout=microcodeVmLayout(config),core=generateMicrocodeVmWGSL(config),handler=generateMicrocodeExternalWGSL({...config,macroId:approval.id});
 // Audit is authenticated input but the exact target closure cannot access it.
 assert.doesNotMatch(handler,/rc_event_audit/);assert.doesNotMatch(core,/rc_event_audit/);
 const descriptors=[{name:'coupled complete exact source macro',code:handler,bindingTypes:types,entryPoint:'main'},{name:'coupled call VM begin',code:core,bindingTypes:types,entryPoint:'begin'},{name:'coupled call VM core',code:core,bindingTypes:types,entryPoint:'main'}];
 return {config,layout,code:compiled.instructions,root,approval,descriptors,sourceSha256:compiled.sourceSha256,bytecodeSha256:sha(compiled.instructions)};
}

function sourceHashes(){const paths=[];const walk=dir=>{for(const d of readdirSync(dir,{withFileTypes:true})){const p=join(dir,d.name);if(d.isDirectory())walk(p);else if(/\.(?:m?js|cjs)$/.test(p))paths.push(p);}};walk(join(ROOT,'src'));for(const name of ['resident-candidate-coupled-macro-native.mjs','resident-candidate-coupled-component-schema.mjs','resident-candidate-gpu-support.mjs','resident-candidate-native-session.mjs','resident-candidate-invocation-identity.mjs','native-gpu-test-owner.cjs'])paths.push(join(ROOT,'tests',name));return Object.fromEntries(paths.sort().map(p=>[relative(ROOT,p),sha(readFileSync(p))]));}
export function prepareCoupledComponent(inputDir,dir){
 assert.equal(existsSync(dir),false,'fresh component run directory required');const bytes=read(inputDir,'call-inputs.v8'),input=deserialize(bytes),program=buildCoupledComponentProgram(input),report=json(inputDir,'report.json');assert.equal(sha(bytes),report.callInputSha256);assert.equal(report.status,'pass');assert.equal(report.canonicalSourceSha256,input.canonicalSourceSha256);assert.equal(report.nativeQualification,false);
 mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'call-inputs.v8'),bytes,{flag:'wx'});
 const manifest={kind:'resident-coupled-native-component-manifest-v1',sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),sourceHashes:sourceHashes(),preparationInvocation:processInvocationIdentity(),inputSha256:sha(bytes),assertionSha256:report.assertionSha256,sourceSha256:input.sourceSha256,canonicalSourceSha256:input.canonicalSourceSha256,bytecodeSha256:program.bytecodeSha256,approval:program.approval,config:program.config,layout:program.layout,shaders:program.descriptors.map(d=>({name:d.name,entryPoint:d.entryPoint,sha256:sha(d.code),bytes:d.code.length})),passes:2,cases:3,dispatchesPerCase:6,sourceBudget:32768,componentOnly:true,independentCases:true,rawToImpact:false,fullRest:false,native1024:false,hardwarePerformance:false,expectedFilesRuntimeAuthority:false};
 writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});log({stage:'coupled-component-prepared',sourceHead:manifest.sourceHead,inputSha256:manifest.inputSha256,bytecodeSha256:manifest.bytecodeSha256,shaders:manifest.shaders,sourceBudget:manifest.sourceBudget,componentOnly:true,cases:3,passes:2});return manifest;
}
function checked(dir){const manifest=json(dir,'manifest.json');assert.equal(manifest.kind,'resident-coupled-native-component-manifest-v1');assert.deepEqual(sourceHashes(),manifest.sourceHashes,'immutable locally compiled source');const bytes=read(dir,'call-inputs.v8');assert.equal(sha(bytes),manifest.inputSha256);const input=deserialize(bytes),program=buildCoupledComponentProgram(input);assert.equal(program.bytecodeSha256,manifest.bytecodeSha256);assert.deepEqual(program.approval,manifest.approval);assert.deepEqual(program.config,manifest.config);assert.deepEqual(program.layout,manifest.layout);assert.deepEqual(program.descriptors.map(d=>({name:d.name,entryPoint:d.entryPoint,sha256:sha(d.code),bytes:d.code.length})),manifest.shaders);assert.equal(manifest.passes,2);assert.equal(manifest.cases,3);assert.equal(manifest.dispatchesPerCase,6);return{manifest,input,program};}

/** One fixed six-command call, then one combined final map. No host decisions
 * depend on intermediate state; no later-call bank is presented as recurrence. */
async function runCase(owner,cache,p,input,c){
 const device=owner.device,owned=[],stats={dispatches:0,submissions:0,initialWrites:0,copies:0,mappings:0,encodeWallMs:0,submitWallMs:0,queueDrainWallMs:0,mapWallMs:0};let submitted=false,scope=true;
 const data=[c.before.state,input.readonlyBindings[1],input.readonlyBindings[2],c.before.scratch,input.readonlyBindings[4],p.code,new Uint32Array(p.layout.totalWords)];
 const allocate=(bytes,usage)=>{assert.ok(bytes>0&&bytes<=device.limits.maxBufferSize);const b=device.createBuffer({size:bytes,usage});owned.push(b);return b;};
 device.pushErrorScope('validation');
 try{
  const bound=data.map((words,i)=>{assert.ok(words.byteLength<=device.limits.maxStorageBufferBindingSize);const b=allocate(words.byteLength,128|4|8);if(i!==6){device.queue.writeBuffer(b,0,words);stats.initialWrites++;}return b;});
  const stages=[];for(const d of p.descriptors){const compiled=await cache.compile(d),group=device.createBindGroup({layout:compiled.groupLayout,entries:bound.map((b,binding)=>({binding,resource:{buffer:b}}))});stages.push({...compiled,group});}
  const totalWords=data.reduce((s,x)=>s+x.length,0),readback=allocate(totalWords*4,1|8),at=performance.now(),encoder=device.createCommandEncoder({label:'exact coupled captured-call'}),pass=encoder.beginComputePass();
  // begin, core to waiting, exact source macro, core return/HALT, then two
  // inert repeats. Full VM word comparison catches any duplicate execution.
  for(const i of [1,2,0,2,0,2]){const stage=stages[i];pass.setPipeline(stage.pipeline);pass.setBindGroup(0,stage.group);pass.dispatchWorkgroups(1);stats.dispatches++;}pass.end();let offset=0;
  for(let i=0;i<bound.length;i++){encoder.copyBufferToBuffer(bound[i],0,readback,offset*4,data[i].byteLength);offset+=data[i].length;stats.copies++;}const command=encoder.finish();stats.encodeWallMs=performance.now()-at;
  const submitAt=performance.now();device.queue.submit([command]);submitted=true;stats.submissions++;stats.submitWallMs=performance.now()-submitAt;const drainedAt=performance.now();await device.queue.onSubmittedWorkDone();stats.queueDrainWallMs=performance.now()-drainedAt;const validation=device.popErrorScope();scope=false;
  const mapAt=performance.now();await readback.mapAsync(1);stats.mapWallMs=performance.now()-mapAt;stats.mappings++;const all=new Uint32Array(readback.getMappedRange().slice(0));readback.unmap();assert.equal(await validation,null,'native source-call validation');offset=0;const arrays=data.map(x=>{const a=all.slice(offset,offset+x.length);offset+=x.length;return a;});
  return{index:c.index,sourceBindings:arrays.slice(0,5),bytecode:arrays[5],vmState:arrays[6],auditInputSha256:sha(input.readonlyBindings[5]),stats};
 }finally{if(scope)await device.popErrorScope();if(submitted)await device.queue.onSubmittedWorkDone();for(const b of owned){try{b.unmap();}catch{}b.destroy();}}
}
export async function executeCoupledComponent(dir){
 assert.equal(process.env.RUN_RESIDENT_COUPLED_MACRO_GPU,'1','explicit serialized numerical slot required');assert.equal(process.env.REQUIRE_WEBGPU,'1');const{manifest:m,input,program:p}=checked(dir);assert.equal(existsSync(join(dir,'actual.v8')),false,'fresh GPU invocation');assert.notEqual(processInvocationIdentity().id,m.preparationInvocation.id);
 for(const n of ['PhysicsLab','LabController','ShotSearchCore','LabFourBallWorldExperimental'])assert.equal(globalThis[n],undefined,'lean GPU process has no original CPU forward world');
 const[{createNativeOwner},{createRetainedNativePipelineCache}]=await Promise.all([import('./resident-candidate-gpu-support.mjs'),import('./resident-candidate-native-session.mjs')]);
 const owner=await createNativeOwner('three genuine coupled post-impact call components'),cache=createRetainedNativePipelineCache(owner,{trace:log});
 try{const started=performance.now();await cache.validateAll(p.descriptors);for(const d of p.descriptors)await cache.compile(d);const precompile={wallMs:performance.now()-started,cache:cache.stats(),order:p.descriptors.map(x=>x.name),allBeforeSourceBuffers:true};log({stage:'coupled-component-all-pipelines-ready',precompile});
  const runs=[];for(let pass=0;pass<m.passes;pass++)for(const c of input.cases){const at=performance.now(),before=cache.stats(),r=await runCase(owner,cache,p,input,c);r.pass=pass;r.wallMs=performance.now()-at;r.cacheBefore=before;r.cacheAfter=cache.stats();runs.push(r);log({stage:'coupled-component-case-mapped',pass,index:c.index,stats:r.stats,wallMs:r.wallMs,parity:'pending independent assertion'});}
  const actual={kind:'resident-coupled-native-component-actual-v1',inputSha256:m.inputSha256,gpuInvocation:processInvocationIdentity(),adapter:owner.adapterInfo,limits:{maxBufferSize:owner.device.limits.maxBufferSize,maxStorageBufferBindingSize:owner.device.limits.maxStorageBufferBindingSize},precompile,runs,expectedFilesOpened:false,independentCases:true,rawToImpact:false,hardwarePerformance:false},actualSha256=save(dir,'actual.v8',actual);writeFileSync(join(dir,'actual-manifest.json'),JSON.stringify({actualSha256,inputSha256:m.inputSha256},null,2),{flag:'wx'});log({stage:'coupled-component-native-terminal',actualSha256,parity:'pending',runs:runs.length});return actual;
 }finally{owner.release();}
}

export function assertCoupledComponent(dir,inputDir){
 const{manifest:m,input,program:p}=checked(dir),am=json(dir,'actual-manifest.json'),bytes=read(dir,'actual.v8');assert.equal(sha(bytes),am.actualSha256);assert.equal(am.inputSha256,m.inputSha256);const actual=deserialize(bytes);assert.equal(actual.kind,'resident-coupled-native-component-actual-v1');assert.equal(actual.inputSha256,m.inputSha256);assertSeparateTestProcesses({gpu:actual.gpuInvocation,prepared:m.preparationInvocation});assert.equal(actual.expectedFilesOpened,false);assert.equal(actual.independentCases,true);assert.equal(actual.rawToImpact,false);assert.equal(actual.runs.length,6);
 const expectedBytes=read(inputDir,'assertions.v8');assert.equal(sha(expectedBytes),m.assertionSha256);const expected=deserialize(expectedBytes);assertCoupledComponentAssertions(expected,{input,inputSha256:m.inputSha256});
 for(const [n,r]of actual.runs.entries()){
  assert.equal(r.pass,Math.floor(n/3));assert.equal(r.index,n%3);const c=input.cases[r.index],e=expected.captures[r.index];assert.deepEqual(c.args,e.args);assert.deepEqual(c.before,e.before,'exact diagnostic t0, never later output');
  assert.deepEqual(r.sourceBindings[0],e.after.state,'every source state word');assert.deepEqual(r.sourceBindings[3],e.after.scratch,'every dirty scratch word');for(const i of[1,2,4]){assert.deepEqual(r.sourceBindings[i],input.readonlyBindings[i],'readonly source words unchanged');assert.equal(sha(r.sourceBindings[i]),e.readonlyIdentities[i]);}assert.equal(r.auditInputSha256,e.readonlyIdentities[5]);assert.deepEqual(r.bytecode,p.code,'immutable program unchanged');
  const v=createMicrocodeVmReferenceForTest({testOnly:true,...p.config,code:p.code});v.begin();assert.equal(v.advance(),I.status.waiting);v.serviceExternal(0,3,()=>Uint32Array.of(e.result));assert.equal(v.advance(),I.status.complete);v.serviceExternal(0,3,()=>{throw Error('duplicate handler must be inert');});assert.equal(v.advance(),I.status.complete);assert.deepEqual(r.vmState,v.state,'all VM control, CALL stack, locals, counters and return words');
  assert.equal(r.stats.dispatches,6);assert.equal(r.stats.submissions,1);assert.equal(r.stats.initialWrites,6);assert.equal(r.stats.copies,7);assert.equal(r.stats.mappings,1);assert.equal(r.cacheAfter.coldCompiles,r.cacheBefore.coldCompiles,'immutable pipelines reused');
 }
 const report={kind:'resident-coupled-native-component-assertion-v1',status:'pass',sourceHead:m.sourceHead,inputSha256:m.inputSha256,assertionSha256:m.assertionSha256,actualSha256:am.actualSha256,approval:m.approval,adapter:actual.adapter,precompile:actual.precompile,cases:3,passes:2,sourceReturns:expected.captures.map(x=>x.result),originalSourceBudget:32768,entireSourceAndDirtyScratchExact:true,entireVmProtocolExact:true,readOnlyWordsExact:true,expectedFilesOpenedByGpu:false,sourceCallsOnly:true,independentCases:true,rawToImpact:false,fullRest:false,native1024:false,hardwarePerformance:false,timingKind:'host wall / queue drain, not GPU timestamp or calibrated ratio',runs:actual.runs.map(({pass,index,stats,wallMs})=>({pass,index,stats,wallMs}))};writeFileSync(join(dir,'assertion.json'),JSON.stringify(report,null,2),{flag:'wx'});log({stage:'coupled-component-strict-pass',report});return report;
}
if(process.argv[1]&&resolve(process.argv[1])===SELF){const[mode,a,b]=process.argv.slice(2);try{if(mode==='prepare')prepareCoupledComponent(resolve(a),resolve(b));else if(mode==='gpu')await executeCoupledComponent(resolve(a));else if(mode==='assert')assertCoupledComponent(resolve(a),resolve(b));else throw Error('prepare INPUT_DIR RUN_DIR | gpu RUN_DIR | assert RUN_DIR INPUT_DIR');}catch(error){console.error(error);process.exitCode=1;}}
