// HOST-only fixed first-h diagnostic. All reference copies are assertion-only;
// neither a saved continuation nor a CPU future is an execution input.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';import {deserialize} from 'node:v8';import {createHash} from 'node:crypto';import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {PREPARATION_DESCRIPTOR as D,PREPARATION_PROFILE,approvePreparationSource,preparationSourceWGSL,preparationNativeWGSL,preparationSpans,assertPreparationInputs} from '../src/resident-candidate/microcode-preparation.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {createPreparationSourceReference} from './resident-candidate-preparation-source-reference.mjs';
import {assertCoupledH1Initial,originalOwnerReturnPCs,assertFirstCommittedBoundary} from './resident-candidate-coupled-h1-cost.mjs';
import {microcodeExternalReference} from './resident-candidate-microcode-external-reference.mjs';import {COUPLED_MACRO_PROFILE} from './resident-candidate-macro-profile-contract.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),C=I.control,S=I.status;
export const preparationBindings='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(2) var<storage,read> rc_geometry:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;';
const copyMutable=b=>b.map((a,i)=>[0,3,5].includes(i)?a.slice():a);
export function createPreparationCheckedHostHandler(){
 const reference=createPreparationSourceReference({testOnly:true,code:preparationNativeWGSL()});
 return(spec,values,{bindings})=>{
  assert.equal(spec.name,D.name);const args=values.map(a=>{assert.equal(a.length,1);return a[0];});assertPreparationInputs(args,bindings);
  const out=reference.execute(args,{bindings,before:{entry:'rc_gp_begin',args:[args[0]]}});
  assert.equal(out.beforeResult,true);assert.equal(out.status,'complete','checked helper never exposes a raw unguarded OOB');
  if(out.globals.rc_gp_error){assert.equal(out.globals.rc_gp_error,I.error.storageRange);return{kind:'source-preparation-failure',error:I.error.storageRange,status:S.invalid};}
  return Uint32Array.of(out.result);
 };
}
export function runPreparationFirstH({initialPath,sourcePath,outPath,onPreparationCall}){
 if(onPreparationCall!==undefined)assert.equal(typeof onPreparationCall,'function','TEST-only capture callback');
 assert.notEqual(resolve(initialPath),resolve(outPath));assert.notEqual(resolve(sourcePath),resolve(outPath));
 const initialBytes=readFileSync(initialPath),initial=assertCoupledH1Initial(initialBytes),sourceBytes=readFileSync(sourcePath),source=deserialize(sourceBytes);
 assert.equal(sha(source.code),D.sourceSha256);approvePreparationSource(source.code,{storageBindings:{...I.bindings,rc_event_audit:5}});
 const options={entry:source.entry,storageBindings:{...I.bindings,rc_event_audit:5},externalFunctions:initial.compiled.externalFunctions.map(f=>f.name),allocationMetadata:true};
 const baseline=allocateMicrocodeLocals(compileMicrocodeWGSL(source.code,options),{mode:'call-frames-v1'});assert.deepEqual(baseline.instructions,initial.compiled.instructions,'fresh lowering equals admitted original bytecode');assert.equal(baseline.localWords,initial.compiled.localWords);
 const optimized=allocateMicrocodeLocals(compileMicrocodeWGSL(source.code,{...options,intrinsics:PREPARATION_PROFILE}),{mode:'call-frames-v1'});
 const scalar=compileMicrocodeWGSL(preparationBindings+preparationSourceWGSL(),{entry:D.name}),scalarRoot=scalar.functions.find(f=>f.name===D.name),originalReference=createPreparationSourceReference({testOnly:true,code:preparationSourceWGSL()}),checked=createPreparationCheckedHostHandler();
 const evidence={kind:'resident-preparation-in-core-first-h-host-v1',initialSha256:sha(initialBytes),sourcePayloadSha256:sha(sourceBytes),sourceSha256:sha(source.code),profile:PREPARATION_PROFILE,descriptor:D,noGpuAdmission:true,gpuExecuted:false,fullRest:false,queryComplete:false,wallSpeedCalibration:false,captures:0,kinds:{},returns:{},scalarComponentInstructions:0,sourceReads:0,sourceWrites:0,allCapturesFullWordEqual:false,retention:{fixedPcCounters:false,bulkTrace:false,retainedCallSnapshots:0,transientMutableCopies:3,sourceBankCount:1,vmStateCount:1}};
 let finalBaseline;
 function run(p,optimizedRun){
  const bindings=initial.bindings.map(a=>a.slice()),entry=p.functions.find(f=>f.name===source.entry),config={...initial.configuration,localWords:p.localWords,stackCapacity:p.callDepth,instructionCount:p.instructions.length/8,externalFunctions:p.externalFunctions,intrinsics:p.intrinsicProfile,initialSlots:[{slot:entry.params[0].slot,candidateStride:1},{slot:entry.params[0].slot+1,value:0},{slot:entry.params[0].slot+2,value:0}],...(optimizedRun?{preparationApproval:D}:{})};
  const returns=originalOwnerReturnPCs(p),root=p.functions.find(f=>f.name===D.name);let vm,boundary=null,capture=null,advanceCalls=0,prepCalls=0,macros={};
  const handler=(d,args)=>{macros[d.name]=(macros[d.name]??0)+1;return microcodeExternalReference(d,args,{bindings:bindings.slice(0,5),macroProfile:COUPLED_MACRO_PROFILE});};
  const onCall=event=>{if(optimizedRun||event.targetPc!==root.entryPc)return;assert.equal(capture,null);const args=root.params.map(x=>vm.local(0,x.slot)),expected=copyMutable(bindings),prepared=copyMutable(bindings),reference=copyMutable(bindings);
   const primitive=createMicrocodeVmReferenceForTest({testOnly:true,code:scalar.instructions,localWords:scalar.localWords,stackCapacity:scalar.callDepth,entryPc:scalar.entryPc,bindings:expected,eventAudit:true,initialSlots:args.map((value,i)=>({slot:scalarRoot.params[i].slot,value}))});primitive.begin();assert.equal(primitive.advance(0,65536),S.complete);evidence.scalarComponentInstructions+=primitive.state[C.stepsLow];
   const ref=originalReference.execute(args,{bindings:reference,spans:preparationSpans(args[0])});assert.equal(ref.status,'complete');evidence.sourceReads+=ref.reads.length;evidence.sourceWrites+=ref.writes.length;
   const value=checked(D,args.map(x=>Uint32Array.of(x)),{bindings:prepared});assert.ok(value instanceof Uint32Array);assert.equal(value[0],ref.result);assert.equal(value[0],primitive.local(0,scalarRoot.returnSlot));assert.deepEqual(prepared,expected);assert.deepEqual(reference,expected);
   capture={expected,result:value[0],returnPc:event.pc+1,args,sourceReads:ref.reads.length,sourceWrites:ref.writes.length,...(onPreparationCall?{before:copyMutable(bindings)}:{})};evidence.captures++;evidence.kinds[args[5]]=(evidence.kinds[args[5]]??0)+1;evidence.returns[value[0]]=(evidence.returns[value[0]]??0)+1;
  };
  const onReturn=event=>{if(capture&&event.targetPc===capture.returnPc){assert.equal(vm.local(0,root.returnSlot),capture.result);assert.deepEqual(bindings,capture.expected,'all source/dirty scratch/audit/readonly words at actual original return');if(onPreparationCall)onPreparationCall({ordinal:evidence.captures,args:[...capture.args],before:capture.before,after:capture.expected,result:capture.result,returnPc:capture.returnPc,sourceReads:capture.sourceReads,sourceWrites:capture.sourceWrites});capture=null;}if(assertFirstCommittedBoundary({initial,words:bindings[0],lane:event.lane,returnPc:event.pc,ownerReturns:returns})){assert.equal(boundary,null);boundary={owner:returns.get(event.pc),returnPc:event.pc,targetPc:event.targetPc};}};
  vm=createMicrocodeVmReferenceForTest({testOnly:true,...config,code:p.instructions,bindings,onCall,onReturn,intrinsicHandler:(d,a,c)=>{prepCalls++;return checked(d,a,c);}});vm.begin(0);vm.begin(1);const started=performance.now();
  while(!boundary&&advanceCalls<8000000&&performance.now()-started<120000){let status=vm.advance(0,1);advanceCalls++;if(status===S.waiting)status=vm.serviceExternal(0,vm.state[C.pendingMacro]-1,handler);assert.ok([S.ready,S.waiting].includes(status),'resource/unsupported/invalid is not a miss');}
  assert.ok(boundary,'bounded first-h must reach actual committed owner boundary');assert.equal(capture,null);assert.equal(vm.state[C.pc],boundary.targetPc);assert.equal(vm.state[C.lastOpcode],I.opcodes.RET);assert.equal(vm.state[C.error],0);assert.equal(vm.state[C.pendingMacro],0);assert.equal(vm.state[vm.layout.stride+C.stepsLow],0);assert.equal(bindings[0][5],1);
  const result={bytecodeSha256:sha(p.instructions),instructionCount:p.instructions.length/8,localWords:p.localWords,callDepth:p.callDepth,successfulInstructions:vm.state[C.stepsLow],advanceCalls,prepCalls,macros,boundary,sourceAndAuditSha256:bindings.map(sha),sourceH:1,originalRequestedH:192,vmError:0,returnPcCommitted:true};
  if(optimizedRun){assert.deepEqual(bindings,finalBaseline);assert.equal(prepCalls,evidence.captures);}else finalBaseline=bindings;
  return result;
 }
 evidence.baseline=run(baseline,false);evidence.optimized=run(optimized,true);assert.equal(evidence.captures,216,'observed fixture count, not general physics assumption');assert.deepEqual(evidence.optimized.macros,evidence.baseline.macros);evidence.allCapturesFullWordEqual=true;evidence.finalFullSourceAndAuditEqual=true;evidence.scalarInstructionsRemoved=evidence.baseline.successfulInstructions-evidence.optimized.successfulInstructions;evidence.externalHandoffs=Object.values(evidence.baseline.macros).reduce((a,b)=>a+b,0);evidence.additionalHandoffs=0;
 assert.equal(sha(readFileSync(initialPath)),sha(initialBytes));assert.equal(sha(readFileSync(sourcePath)),sha(sourceBytes));writeFileSync(outPath,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});return evidence;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const[initialPath,sourcePath,outPath]=process.argv.slice(2);const r=runPreparationFirstH({initialPath,sourcePath,outPath});console.log(JSON.stringify({captures:r.captures,kinds:r.kinds,removed:r.scalarInstructionsRemoved,externalHandoffs:r.externalHandoffs,baseline:r.baseline.successfulInstructions,optimized:r.optimized.successfulInstructions}));}
