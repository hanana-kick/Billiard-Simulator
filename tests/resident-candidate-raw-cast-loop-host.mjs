// HOST-only source-loop differential. Starts from authenticated common prestrike
// input, never a saved future world or a convenience pose reconstruction.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {RAW_FIRST_H_CASES} from './resident-candidate-raw-whole-h-fixture.mjs';
import {createWorldInitializationPlan,packWorldInitializationRows} from '../src/resident-candidate/world-initialization.mjs';
import Query from '../src/experimental-cue-obstacle-contact.js';
import {generateRawCastQueryWGSL} from '../src/resident-candidate/raw-strike.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {microcodeIntrinsicReference} from './resident-candidate-microcode-intrinsic-reference.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),C=I.control,S=I.status;
const rule={cueId:2,firstId:3,secondId:4,opponentId:1,method:'none',threeCushion:false,allowKiss:true,maxOuterSteps:15360};
const bindingMap={rc_state:0,rc_program:1,rc_geometry:2,rc_scratch:3,rc_inputs:4};
class Bound extends Error{constructor(message){super(message);this.name='HostDiagnosticBound';}}
export function castLoopSource(staged){
 const old=generateRawCastQueryWGSL(Query,'contact-gjk'),loop=generateRawCastQueryWGSL(Query,'contact-gjk',{storageLoop:true});
 assert.equal(staged.split(old).length,2,'exact one original cast adapter, not numeric/global replacement');
 return staged.replace(old,loop);
}
// TEST admission only. The original staged helper ignores malformed cap words,
// whereas the bounded-loop source diagnoses them. Do not assert equivalence
// outside the genuine post-contact-init domain; no writes occur in this check.
export function assertAuthenticCastLoopDomain(state,scratch,layout){
 assert.ok(state instanceof Uint32Array&&state.length===layout.stateWords);
 assert.ok(scratch instanceof Uint32Array&&scratch.length===layout.scratchWords);
 const cb=layout.clearance,mb=layout.metadata;
 assert.ok(Number.isInteger(cb)&&cb>=0&&cb+16<=state.length&&Number.isInteger(mb)&&mb>=0&&mb+16<=state.length);
 const active=state[cb]===0&&!(Math.floor(state[cb+1]/3)===state[cb+3]&&state[cb+1]%3===2);
 if(active)assert.equal(state[mb+15],256,'authentic contact-init cap required; malformed metadata is not equivalent');
 return active;
}
export function compileRawStageForHost(source){
 const p=allocateMicrocodeLocals(compileMicrocodeWGSL(source,{entry:'main',storageBindings:bindingMap,intrinsics:'source-f64-v1',allocationMetadata:true}),{mode:'call-frames-v1'}),root=p.functions.find(f=>f.name==='main');
 assert.equal(root.params.length,1);assert.equal(root.params[0].type,'vec3<u32>');assert.equal(root.returnWords,0);assert.deepEqual(p.externalFunctions,[]);
 return{p,root,sourceSha256:sha(source),bytecodeSha256:sha(p.instructions)};
}
function stageVm(compiled,bindings){const{p,root}=compiled;return createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,count:1,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,bindings,intrinsics:p.intrinsicProfile,intrinsicHandler:microcodeIntrinsicReference,initialSlots:[{slot:root.params[0].slot,value:0}]});}
const steps=vm=>Number((BigInt(vm.state[C.stepsHigh])<<32n)+BigInt(vm.state[C.stepsLow]));
export async function runRawCastLoopHost({rowId=219,pairs=60,maxMilliseconds=120000,maxInstructions=200000000,trace=()=>{}}={}){
 assert.ok(RAW_FIRST_H_CASES.some(r=>r.id===rowId),'declared authentic roster only');assert.ok(Number.isInteger(pairs)&&pairs>=1&&pairs<=60);assert.ok(Number.isSafeInteger(maxMilliseconds)&&maxMilliseconds>0&&maxMilliseconds<=600000);assert.ok(Number.isSafeInteger(maxInstructions)&&maxInstructions>0&&maxInstructions<=1000000000);
 const original=await originalRegisteredFixture(),plan=await createWorldInitializationPlan({decoder:original.decoder,input:original.raw,rule}),raw=plan.raw,row=RAW_FIRST_H_CASES.find(r=>r.id===rowId),input=packWorldInitializationRows(plan,[{id:row.id,settings:row.settings}]);
 assert.equal(raw.pairCount,60);assert.equal(raw.dispatches,68301);assert.equal(raw.layout.scratchWords,13632);
 const bindings=[new Uint32Array(raw.layout.stateWords),raw.program.words.slice(),raw.geometry.words.slice(),new Uint32Array(raw.layout.scratchWords),input],initialHashes=bindings.map(sha),source={...raw.stages,'cast-contact-gjk-loop':castLoopSource(raw.stages['cast-contact-gjk'])},compiled={},vms={};
 for(const[name,code]of Object.entries(source)){compiled[name]=compileRawStageForHost(code);vms[name]=stageVm(compiled[name],bindings);trace({phase:'compiled',stage:name,instructions:compiled[name].p.instructions.length/8,locals:compiled[name].p.localWords});}
 const began=performance.now(),stats={sourceInstructions:0,loopInstructions:0,sourceDispatches:0,loopDispatches:0,captures:0,activeFallbacks:0,activeNonterminalFallbacks:0,terminalNoopRemainders:0,completedPairs:0},captures=[];let current=null;
 const call=(name,vm=vms[name],loop=false)=>{current={stage:name,vm};vm.begin();let status=S.ready;while(status===S.ready){if(performance.now()-began>maxMilliseconds||stats.sourceInstructions+stats.loopInstructions+steps(vm)>maxInstructions)throw new Bound('explicit HOST resource bound, source not completed');status=vm.advance(0,65536);}assert.equal(status,S.complete,'original source stage must complete: '+name+' error '+vm.state[C.error]);assert.equal(vm.state[C.error],0);stats[loop?'loopInstructions':'sourceInstructions']+=steps(vm);stats[loop?'loopDispatches':'sourceDispatches']++;current=null;};
 const report=(status,extra={})=>({kind:'resident-raw-cast-loop-host-v1',status,diagnosticOnly:true,gpuExecuted:false,productionLoopEnabled:false,physicalH:0,fullClearanceCompleted:stats.completedPairs===60,sourceArtifactSha256:original.artifactSha256,sourceIdentity:plan.sourceIdentity,preStrikeIdentity:plan.preStrikeIdentity,row:{id:row.id,settings:row.settings},requestedPairs:pairs,bounds:{maxMilliseconds,maxInstructions},layout:raw.layout,initialHashes,stageIdentities:Object.fromEntries(Object.entries(compiled).map(([k,c])=>[k,{sourceSha256:c.sourceSha256,bytecodeSha256:c.bytecodeSha256,instructions:c.p.instructions.length/8,locals:c.p.localWords}])),...stats,captureCount:stats.captures,captures,finalHashes:bindings.map(sha),rawStatus:bindings[0][raw.layout.raw],clearance:Array.from(bindings[0].slice(raw.layout.clearance,raw.layout.clearance+16)),retention:{liveSourceBanks:1,temporaryComparisonBanks:1,copiesRetainedAcrossPairs:0,perInstructionTrace:false},hostWallMs:performance.now()-began,ownedPeakRssKiB:process.resourceUsage().maxRSS,...extra});
 try{
  for(const command of raw.initialSchedule)for(let i=0;i<command.repeat;i++)call(command.stage);
  trace({phase:'raw-number-initialized',rawStatus:bindings[0][raw.layout.raw],sourceInstructions:stats.sourceInstructions});
  for(let pair=0;pair<pairs;pair++){
   for(const command of raw.pairSchedule){
    if(command.stage!=='cast-contact-gjk'){for(let i=0;i<command.repeat;i++)call(command.stage);continue;}
    assert.equal(command.repeat,256);
    const cb=raw.layout.clearance,mb=raw.layout.metadata,sb=0,clearanceActive=assertAuthenticCastLoopDomain(bindings[0],bindings[3],raw.layout),metadata=Array.from(bindings[0].slice(mb,mb+16)),before=bindings.map(x=>x.slice()),comparison=before.map(x=>x.slice()),fallback=clearanceActive&&metadata[3]!==0;
    if(clearanceActive)assert.equal(metadata[15],256,'authentic contact-init enforces the bounded loop domain');
    const baselineBefore=sha(bindings[0]),scratchBefore=sha(bindings[3]);let firstTerminal=null;
    for(let i=0;i<256;i++){call(command.stage);if(firstTerminal===null&&(!fallback||bindings[3][sb]!==0))firstTerminal=i+1;}
    const loopVm=stageVm(compiled['cast-contact-gjk-loop'],comparison);call('cast-contact-gjk-loop',loopVm,true);
    for(let i=0;i<5;i++)assert.deepEqual(comparison[i],bindings[i],'every raw/state/scratch/readonly word, pair '+pair+' binding '+i);
    for(const i of[1,2,4])assert.deepEqual(bindings[i],before[i],'source readonly binding '+i);
    if(firstTerminal!==null&&firstTerminal<256){const terminalState=bindings[0].slice(),terminalScratch=bindings[3].slice();call(command.stage);assert.deepEqual(bindings[0],terminalState,'terminal source invocation state no-op');assert.deepEqual(bindings[3],terminalScratch,'terminal source invocation dirty scratch no-op');stats.terminalNoopRemainders++;}
    stats.captures++;if(fallback)stats.activeFallbacks++;if(fallback&&before[3][sb]===0)stats.activeNonterminalFallbacks++;
    const receipt={pair,clearanceActive,fallback,initialScratchStatus:before[3][sb],finalScratchStatus:bindings[3][sb],sourceBound:metadata[15],firstTerminal,sourceStateSha256Before:baselineBefore,sourceScratchSha256Before:scratchBefore,sourceStateSha256After:sha(bindings[0]),sourceScratchSha256After:sha(bindings[3]),allFiveBindingsExact:true};captures.push(receipt);
   }
   stats.completedPairs++;trace({phase:'pair-complete',pair:pair+1,sourceInstructions:stats.sourceInstructions,activeFallbacks:stats.activeFallbacks,hostWallMs:performance.now()-began});
  }
  return report(stats.completedPairs===60?'pass':'bounded-prefix-pass',{arbitraryMalformedMetadataQualified:false,nativeCompilerQualified:false});
 }catch(error){if(error instanceof Bound)return report('incomplete',{reason:error.message,current:current?{stage:current.stage,status:current.vm.state[C.status],error:current.vm.state[C.error],pc:current.vm.state[C.pc],instructions:steps(current.vm)}:null});error.diagnosticReport=report('failed',{error:{name:error.name,message:error.message},current:current?{stage:current.stage,status:current.vm.state[C.status],error:current.vm.state[C.error],pc:current.vm.state[C.pc]}:null});throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const[row,pairs,path]=process.argv.slice(2);try{const report=await runRawCastLoopHost({rowId:Number(row??219),pairs:Number(pairs??60),trace:x=>console.log(JSON.stringify(x))});if(path)writeFileSync(path,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));}catch(error){if(path&&error.diagnosticReport)writeFileSync(path,JSON.stringify(error.diagnosticReport,null,2)+'\n',{flag:'wx'});console.error(error);process.exitCode=1;}
}
