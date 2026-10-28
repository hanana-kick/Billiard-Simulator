// Fixed three-call HOST diagnostic from the owned h191 continuation.
// Never admitted as a raw-world initializer or a production CPU fallback.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {deserialize,serialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {generateRawStrikeProgramWGSL} from '../src/resident-candidate/raw-strike.mjs';
import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
import {microcodeExternalReference} from './resident-candidate-microcode-external-reference.mjs';
import {assertSegmentInput,decodeOwnedSegmentContinuation} from './resident-candidate-tip-impact-segment-cost.mjs';
import {compareCreatedTipImpactResult} from './resident-candidate-tip-impact-created-host.mjs';

const ROOT='rc_raw_program_step',C=I.control,S=I.status;
const sha=x=>createHash('sha256').update(x).digest('hex');
const steps=vm=>Number((BigInt(vm.state[C.stepsHigh])<<32n)+BigInt(vm.state[C.stepsLow]));
const hashes=bindings=>Object.fromEntries([1,2,3,4,5].map(i=>[i,sha(bindings[i])]));
const declarations='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>; @group(0) @binding(1) var<storage,read> rc_program:array<u32>; @group(0) @binding(2) var<storage,read> rc_geometry:array<u32>; @group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>; @group(0) @binding(4) var<storage,read> rc_inputs:array<u32>; @group(0) @binding(7) var<storage,read_write> rc_event_audit:array<u32>;';
export function compileCanonicalNumberProgramCall(){
 const source=linkResidentWGSL([declarations,generateRawStrikeProgramWGSL()],{entry:ROOT}).code;
 const compiled=allocateMicrocodeLocals(compileMicrocodeWGSL(source,{entry:ROOT,storageBindings:{...I.bindings,rc_event_audit:5},intrinsics:'none',allocationMetadata:true}),{mode:'call-frames-v1'});
 const root=compiled.functions.find(f=>f.name===ROOT);
 assert.equal(root.params.length,4);assert.ok(root.params.every(p=>p.words===1&&p.type==='u32'));assert.equal(root.returnWords,0);
 assert.deepEqual(compiled.externalFunctions,[]);assert.equal(compiled.intrinsicProfile,'none');
 return{source,compiled,root};
}
export function executeCanonicalNumberProgramCall({canonical,initialBindings,args,maxChunks=64}){
 assert.equal(args.length,4);assert.ok(args.every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff));
 assert.ok(Number.isInteger(maxChunks)&&maxChunks>0&&maxChunks<=64);
 const bindings=initialBindings.map(x=>x.slice()),before=hashes(bindings),{compiled:p,root}=canonical;
 const vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,count:1,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,eventAudit:true,intrinsics:'none',bindings,initialSlots:root.params.map((p,i)=>({slot:p.slot,value:args[i]}))});
 vm.begin();let chunks=0,status=S.ready;
 while(status===S.ready&&chunks<maxChunks){status=vm.advance(0,65536);chunks++;}
 assert.equal(status,S.complete,'component work exhaustion is not source completion');assert.equal(vm.state[C.error],0);
 assert.deepEqual(hashes(bindings),before,'every non-state binding, including dirty scratch/audit, remains unchanged');
 return{state:bindings[0],readonlyBefore:before,readonlyAfter:hashes(bindings),chunks,steps:steps(vm),control:Array.from(bindings[0].slice(args[2],args[2]+4))};
}
export function compareNumberProgramCallCapture({capture,actualState,readonlyBefore,readonlyAfter}){
 assert.equal(capture.kind,'resident-number-program-complete-call-assertion-v1');
 assert.deepEqual(actualState,capture.afterState,'every original state word, not just program outputs');
 assert.deepEqual(readonlyBefore,capture.readonlyIdentities);assert.deepEqual(readonlyAfter,readonlyBefore);return true;
}

export async function captureNumberProgramHandoffs({artifactDir,finalPath,sourcePath,outDir}){
 assert.equal(existsSync(outDir),false,'fresh owned diagnostic directory');
 const paths={initial:join(artifactDir,'initial.v8'),continuation:join(artifactDir,'host-continuations/7d5f264cb6e73ebb4c437d0582bbf34407ea91901ba4cf7884ce2eb73c637efa.v8'),receipt:join(artifactDir,'h191-receipt.json'),expected:join(artifactDir,'expected.v8'),final:finalPath,source:sourcePath};
 for(const p of Object.values(paths))assert.equal(resolve(p).startsWith(resolve(outDir)+'/'),false);
 const files=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,readFileSync(p)])),inputHashes=Object.fromEntries(Object.entries(files).map(([k,b])=>[k,sha(b)]));
 const initial=deserialize(files.initial),prior=decodeOwnedSegmentContinuation(files.continuation),receipt=JSON.parse(files.receipt),expected=deserialize(files.expected),final=deserialize(files.final),fullSource=deserialize(files.source).code;
 assert.equal(inputHashes.continuation,'7d5f264cb6e73ebb4c437d0582bbf34407ea91901ba4cf7884ce2eb73c637efa');
 assertSegmentInput({initial,continuation:prior,receipt,initialBytes:files.initial,continuationBytes:files.continuation});
 assert.equal(expected.referenceAuthority,'original-js-number-v1');assert.equal(sha(fullSource),initial.identity.sourceSha256);
 const p=initial.compiled,root=p.functions.find(f=>f.name===ROOT),ordered=[...p.functions].sort((a,b)=>a.entryPc-b.entryPc),end=ordered.find(f=>f.entryPc>root.entryPc)?.entryPc??p.instructions.length/8;
 assert.equal(root.params.length,4);assert.equal(root.returnWords,0);
 const bindings=prior.bindings,captures=[],externalCalls={};let pending=null,vm;
 const onCall=({lane,targetPc,pc})=>{
  if(targetPc!==root.entryPc)return;assert.equal(lane,0);assert.equal(pending,null);assert.ok(captures.length<3,'exactly three bounded source calls, no open trace');
  const args=root.params.map(x=>vm.local(lane,x.slot));
  pending={kind:'resident-number-program-complete-call-assertion-v1',index:captures.length,args,callPc:pc,startCoreStep:steps(vm)+1,readonlyIdentities:hashes(bindings),beforeState:bindings[0].slice(),beforeControl:Array.from(bindings[0].slice(args[2],args[2]+4)),readonlyBindings:Object.fromEntries([1,2,3,4,5].map(i=>[i,bindings[i].slice()]))};
 };
 const onReturn=({lane,pc})=>{
  if(pc<root.entryPc||pc>=end)return;assert.equal(lane,0);assert.ok(pending);assert.deepEqual(hashes(bindings),pending.readonlyIdentities);
  Object.assign(pending,{returnPc:pc,endCoreStep:steps(vm)+1,afterState:bindings[0].slice(),afterControl:Array.from(bindings[0].slice(pending.args[2],pending.args[2]+4))});
  pending.coreSteps=pending.endCoreStep-pending.startCoreStep;captures.push(pending);pending=null;
 };
 vm=createMicrocodeVmReferenceForTest({testOnly:true,...initial.configuration,code:p.instructions,bindings,state:prior.vmState,onCall,onReturn});const began=performance.now();let pumps=0;
 while(pumps<2048&&performance.now()-began<300000){
  let live=false;for(let lane=0;lane<2;lane++){let status=vm.state[lane*vm.layout.stride+C.status];if(status===S.ready||status===S.waiting){live=true;status=vm.advance(lane,65536);if(status===S.waiting)status=vm.serviceExternal(lane,vm.state[lane*vm.layout.stride+C.pendingMacro]-1,(descriptor,args)=>{externalCalls[descriptor.name]=(externalCalls[descriptor.name]??0)+1;return microcodeExternalReference(descriptor,args,{bindings:bindings.slice(0,5)});});}assert.ok([S.ready,S.waiting,S.complete].includes(status));}if(!live)break;pumps++;
 }
 assert.equal(pending,null);assert.equal(captures.length,3);assert.equal(vm.state[C.status],S.complete);assert.equal(vm.state[vm.layout.stride+C.status],S.complete);
 assert.deepEqual(bindings,final.bindings);assert.deepEqual(vm.state,final.vmState);const comparison=compareCreatedTipImpactResult({initial,expected,bindings,vm});
 const canonical=compileCanonicalNumberProgramCall(),originalAst=new Map(parseMicrocodeWGSL(fullSource).functions.map(x=>[x.name,x]));
 for(const f of parseMicrocodeWGSL(canonical.source).functions)assert.deepEqual(f,originalAst.get(f.name),'independently regenerated original Number interpreter closure '+f.name);
 const callReports=[];for(const capture of captures){
  const input=[capture.beforeState,...[1,2,3,4,5].map(i=>capture.readonlyBindings[i])];
  const actual=executeCanonicalNumberProgramCall({canonical,initialBindings:input,args:capture.args});compareNumberProgramCallCapture({capture,actualState:actual.state,readonlyBefore:actual.readonlyBefore,readonlyAfter:actual.readonlyAfter});
  callReports.push({index:capture.index,args:capture.args,beforeControl:capture.beforeControl,afterControl:capture.afterControl,worldCoreSteps:capture.coreSteps,canonicalCoreSteps:actual.steps,canonicalChunks:actual.chunks,allStateAndUnwrittenBindingsExact:true});
 }
 const component={kind:'resident-number-program-call-inputs-v1',componentOnly:true,rawWorldInput:false,gpuExecuted:false,worldResidentSequenceQualified:false,sourceSha256:initial.identity.sourceSha256,canonicalSource:canonical.source,canonicalSourceSha256:sha(canonical.source),root:ROOT,cases:captures.map(c=>({index:c.index,args:c.args,state:c.beforeState,readonlyBindings:c.readonlyBindings}))};
 const componentBytes=serialize(component),assertions={kind:'resident-number-program-assertions-only-v1',expectedNeverRuntimeInput:true,inputSha256:sha(componentBytes),captures:captures.map(({readonlyBindings,...c})=>c),comparison},assertionBytes=serialize(assertions);
 const report={kind:'resident-number-program-h191-h192-handoff-host-v1',status:'pass',diagnosticOnly:true,rawWorldInput:false,gpuExecuted:false,sourceSha256:initial.identity.sourceSha256,bytecodeSha256:initial.identity.bytecodeSha256,inputHashes,canonicalSourceSha256:sha(canonical.source),canonicalSourceBytes:Buffer.byteLength(canonical.source),canonicalBytecodeSha256:sha(canonical.compiled.instructions),canonicalFunctions:canonical.compiled.functions.length,canonicalInstructions:canonical.compiled.instructions.length/8,canonicalLocals:canonical.compiled.localWords,callReports,segmentPumps:pumps,segmentCoreSteps:steps(vm)-674724316,externalCalls,comparison,componentInputSha256:sha(componentBytes),assertionSha256:sha(assertionBytes),totalHostWallMs:performance.now()-began,retention:{calls:3,fullStatePerInstruction:false,unboundedTrace:false},nativeCompilation:false,wholeWorldQualified:false};
 for(const[k,path]of Object.entries(paths))assert.equal(sha(readFileSync(path)),inputHashes[k],'immutable inputs unchanged');
 mkdirSync(outDir,{recursive:false});writeFileSync(join(outDir,'call-inputs.v8'),componentBytes,{flag:'wx'});writeFileSync(join(outDir,'assertions.v8'),assertionBytes,{flag:'wx'});writeFileSync(join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const[artifactDir,finalPath,sourcePath,outDir]=process.argv.slice(2);try{console.log(JSON.stringify(await captureNumberProgramHandoffs({artifactDir,finalPath,sourcePath,outDir})));}catch(error){console.error(error);process.exitCode=1;}
}
