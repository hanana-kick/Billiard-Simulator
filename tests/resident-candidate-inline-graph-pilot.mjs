// Separate bounded HOST/native-preparation diagnostic. No production activation.
// The already-owned HOST h192 bank is explicitly this diagnostic's t0, never a
// future oracle used to initialize an authentic raw-shot acceptance run.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {serialize,deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {createMicrocodeVmReferenceForTest,generateMicrocodeVmWGSL,generateMicrocodeExternalWGSL} from '../src/resident-candidate/microcode-vm.mjs';
import {microcodeIntrinsicReference} from './resident-candidate-microcode-intrinsic-reference.mjs';
import {microcodeExternalReference} from './resident-candidate-microcode-external-reference.mjs';
import {COUPLED_MACRO_PROFILE} from './resident-candidate-macro-profile-contract.mjs';
import {summarizePostImpactCounters} from './resident-candidate-post-impact-profile.mjs';

export const INLINE_GRAPH_PROFILE='owned-host-post-impact-inline-graph-only-v1';
export const INLINE_GRAPH_PINS=Object.freeze({
 initial:'05f78ef994c2b69960e8e64c07d03cd17c0947656d573afee82820d764a5ff5e',
 sourceFile:'0100d54ceeffc33c7aa46c2da705d7fd6d036b9a3b1b977206df64dffbc03c5c',
 source:'5a18bbbbd646454f2e00f7b1422773b2851b64d5ff165626f2a9f835ff86c0e7',
 baselineResult:'413e4032cb6a4beb5da01a911f9ac41f4d95e26f57aaf4d6a4f02da8325e0152',
 baselineFinal:'893b7ed95bbf2881b4fb518421ef37339ca8857944603c898391237f125996a5',
});
const C=I.control,S=I.status,ROOT='rc_num_eval',EXTERNAL=['rc_cue_flat_advance','rc_world_broad_commit_collision','rc_coupled_transport_advance'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=(path,pin)=>{const b=readFileSync(path);assert.equal(sha(b),pin,'immutable input '+path);return deserialize(b);};
const log=x=>console.log(JSON.stringify(x));

/** Reuse existing compiler admission, including exact body/signature/transitive
 * closure/declarations and logical address spaces. Never match a name alone. */
export function compileInlineGraphSource(source,entry){
 return allocateMicrocodeLocals(compileMicrocodeWGSL(source,{entry,storageBindings:{...I.bindings,rc_event_audit:5},intrinsics:'source-numeric-v1',intrinsicFunctions:[ROOT],externalFunctions:EXTERNAL,allocationMetadata:true}),{mode:'call-frames-v1'});
}

export function prepareInlineGraphPilot({diagnosticDir,sourcePath,outDir}){
 assert.equal(existsSync(outDir),false,'fresh isolated diagnostic directory');
 const original=read(join(diagnosticDir,'initial.v8'),INLINE_GRAPH_PINS.initial),source=read(sourcePath,INLINE_GRAPH_PINS.sourceFile);
 assert.equal(sha(source.code),INLINE_GRAPH_PINS.source);assert.equal(original.kind,'owned-host-h192-one-h-diagnostic-v1');
 assert.equal(original.rawInput,false);assert.equal(original.gpuAdmission,false);assert.equal(original.bindings[0][5],192);
 const baselineBytes=readFileSync(join(diagnosticDir,'result.json'));assert.equal(sha(baselineBytes),INLINE_GRAPH_PINS.baselineResult);
 const baselineResult=JSON.parse(baselineBytes);assert.equal(baselineResult.status,'pass');assert.equal(baselineResult.allSixFinalBindingWordsEqual,true);
 // Compare-only terminal file is hashed here, not decoded or supplied to execution.
 assert.equal(sha(readFileSync(join(diagnosticDir,'four-final.v8'))),INLINE_GRAPH_PINS.baselineFinal);
 const baseline=allocateMicrocodeLocals(compileMicrocodeWGSL(source.code,{entry:source.entry,storageBindings:{...I.bindings,rc_event_audit:5},externalFunctions:[EXTERNAL[0],ROOT,EXTERNAL[1],EXTERNAL[2]],allocationMetadata:true}),{mode:'call-frames-v1'});
 assert.deepEqual(baseline.instructions,original.four.compiled.instructions);assert.deepEqual(baseline.externalFunctions,original.four.compiled.externalFunctions);
 const compiled=compileInlineGraphSource(source.code,source.entry),entry=compiled.functions.find(f=>f.name===source.entry);
 assert.deepEqual(compiled.intrinsicApproval.entries.map(x=>x.name),[ROOT]);assert.deepEqual(compiled.externalFunctions.map(x=>x.id).sort(),[0,2,3]);
 for(const next of compiled.externalFunctions){const old=baseline.externalFunctions.find(x=>x.name===next.name);assert.deepEqual(next.approval,old.approval,'unchanged external source closure '+next.name);}
 const graph=compiled.intrinsicApproval.entries[0],oldGraph=baseline.externalFunctions.find(x=>x.name===ROOT).approval;
 for(const key of ['signatureSha256','bodySha256','closureSha256','dependencies'])assert.deepEqual(graph[key],oldGraph[key],'same complete graph source '+key);
 const configuration={...original.four.configuration,localWords:compiled.localWords,stackCapacity:compiled.callDepth,instructionCount:compiled.instructions.length/8,entryPc:compiled.entryPc,intrinsics:'source-numeric-v1',intrinsicFunctions:[ROOT],externalFunctions:compiled.externalFunctions,initialSlots:[{slot:entry.params[0].slot,candidateStride:1},{slot:entry.params[0].slot+1,value:0},{slot:entry.params[0].slot+2,value:0}]};
 assert.equal(configuration.instructionBudget,65536);assert.equal(configuration.count,2);
 const core=generateMicrocodeVmWGSL(configuration),handlers=compiled.externalFunctions.toSorted((a,b)=>a.id-b.id).map(d=>({id:d.id,name:d.name,code:generateMicrocodeExternalWGSL({...configuration,workgroupSize:1,macroId:d.id})}));
 const initial={kind:INLINE_GRAPH_PROFILE,pins:INLINE_GRAPH_PINS,diagnosticT0H:192,additionalH:1,rawInput:false,gpuAdmission:false,originalBegin:original.begin,bindings:original.bindings,compiled,configuration,template:original.four.template,pc:original.four.pc,core,handlers};
 mkdirSync(outDir,{recursive:false});const bytes=serialize(initial);writeFileSync(join(outDir,'initial.v8'),bytes,{flag:'wx'});
 const manifest={kind:INLINE_GRAPH_PROFILE,initialSha256:sha(bytes),pins:INLINE_GRAPH_PINS,sourceSha256:sha(source.code),bytecodeSha256:sha(compiled.instructions),sourceClosureSha256:graph.closureSha256,initialBindingSha256:initial.bindings.map(sha),core:{bytes:Buffer.byteLength(core),sha256:sha(core)},handlers:handlers.map(({code,...d})=>({...d,bytes:Buffer.byteLength(code),sha256:sha(code)})),instructions:compiled.instructions.length/8,localWords:compiled.localWords,stackCapacity:compiled.callDepth,sourceDtCapsUnchanged:true,originalBegin:original.begin,baselineFinalPath:resolve(diagnosticDir,'four-final.v8'),rawInput:false,gpuExecuted:false,fullRest:false};
 writeFileSync(join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});log({stage:'inline-graph-prepared',...manifest});return manifest;
}

export function runInlineGraphPilot(dir,{maxPumps=2048,maxWallMs=180000}={}){
 assert.ok(Number.isInteger(maxPumps)&&maxPumps>0&&maxPumps<=2048);assert.ok(Number.isInteger(maxWallMs)&&maxWallMs>0&&maxWallMs<=180000);
 const m=JSON.parse(readFileSync(join(dir,'manifest.json'))),initial=read(join(dir,'initial.v8'),m.initialSha256);
 assert.equal(initial.kind,INLINE_GRAPH_PROFILE);assert.deepEqual(initial.pins,INLINE_GRAPH_PINS);assert.deepEqual(initial.bindings.map(sha),m.initialBindingSha256);
 const bindings=initial.bindings.map(x=>x.slice()),counters=new Uint32Array(initial.compiled.instructions.length/8),calls={};
 const vm=createMicrocodeVmReferenceForTest({testOnly:true,...initial.configuration,code:initial.compiled.instructions,bindings,pcCounters:counters,intrinsicHandler:(d,args)=>{assert.equal(d.name,ROOT);calls[d.name]=(calls[d.name]??0)+1;return microcodeIntrinsicReference(d,args,{bindings:bindings.slice(0,5)});}});
 for(let lane=0;lane<2;lane++)vm.begin(lane);let pumps=0;const started=performance.now();
 while(![0,1].every(lane=>vm.state[lane*vm.layout.stride+C.status]===S.complete)){
  assert.ok(pumps++<maxPumps,'bounded HOST pumps, no automatic extension');assert.ok(performance.now()-started<maxWallMs,'bounded HOST diagnostic wall');
  for(let lane=0;lane<2;lane++){vm.advance(lane,65536);for(const d of initial.compiled.externalFunctions.toSorted((a,b)=>a.id-b.id))vm.serviceExternal(lane,d.id,(desc,args)=>{calls[desc.name]=(calls[desc.name]??0)+1;return microcodeExternalReference(desc,args,{bindings:bindings.slice(0,5),macroProfile:COUPLED_MACRO_PROFILE});});assert.ok(![S.invalid,S.unsupported].includes(vm.state[lane*vm.layout.stride+C.status]),'no source-domain failure hidden as miss');}
 }
 const hostWallMs=performance.now()-started;assert.equal(bindings[0][5],193);assert.equal(bindings[0][initial.template.state.length+5],0);
 for(const bi of[1,2,4])assert.deepEqual(bindings[bi],initial.bindings[bi]);
 // Only now decode expected-only terminal state, after execution is complete.
 const baseline=read(m.baselineFinalPath,INLINE_GRAPH_PINS.baselineFinal);assert.deepEqual(bindings,baseline.bindings,'all six final source bindings exact including dirty scratch and event audit');
 const coreSteps=[0,1].map(lane=>Number((BigInt(vm.state[lane*vm.layout.stride+C.stepsHigh])<<32n)+BigInt(vm.state[lane*vm.layout.stride+C.stepsLow]))),summary=summarizePostImpactCounters(initial.compiled,counters);
 assert.equal(summary.total,coreSteps.reduce((a,b)=>a+b,0));assert.equal(calls[ROOT],77);
 const bytes=serialize({kind:INLINE_GRAPH_PROFILE,initialSha256:m.initialSha256,bindings,vmState:vm.state,counters});writeFileSync(join(dir,'final.v8'),bytes,{flag:'wx'});
 const result={kind:INLINE_GRAPH_PROFILE,status:'pass',initialSha256:m.initialSha256,finalSha256:sha(bytes),pins:INLINE_GRAPH_PINS,pumps,coreSteps,calls,hostWallMs,theoreticalFixedCommands:pumps*4,summary,allSixFinalBindingWordsEqual:true,sourceClosureSha256:m.sourceClosureSha256,rawInput:false,gpuExecuted:false,fullRestQualified:false,nativePhysicsLabH193Qualified:false};
 writeFileSync(join(dir,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});log({stage:'inline-graph-host-terminal',...result,summary:{...summary,functions:summary.functions.slice(0,10)}});return result;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const[mode,...args]=process.argv.slice(2);if(mode==='prepare'){assert.equal(args.length,3);prepareInlineGraphPilot({diagnosticDir:resolve(args[0]),sourcePath:resolve(args[1]),outDir:resolve(args[2])});}else if(mode==='run'){assert.equal(args.length,1);runInlineGraphPilot(resolve(args[0]));}else throw Error('Explicit prepare or run required');}
