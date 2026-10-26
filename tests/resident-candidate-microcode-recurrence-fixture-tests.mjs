// HOST ONLY fixture and negative comparator gates. Handcrafted headers below
// are deliberately NOT a physics result and must fail the all11 comparison.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
import {createRawEightHFixture,RAW_EIGHT_H_EXPECTED_KIND} from './resident-candidate-microcode-recurrence-fixture.mjs';
import {compareRawEightHResult} from './resident-candidate-microcode-recurrence-compare.mjs';
import {compareRawWorldPcResult} from './resident-candidate-raw-world-pc-compare.mjs';
import {RAW_FIRST_H_CASES} from './resident-candidate-raw-whole-h-fixture.mjs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {WORLD_DEVICE_PC as PC} from '../src/resident-candidate/world-device-pc.mjs';
import {WORLD_H_BOUNDS} from '../src/resident-candidate/world-h.mjs';
import {STATUS,unpackCandidates} from '../src/resident-candidate/abi.mjs';
let pending;const fixture=()=>pending??=createRawEightHFixture(),sha=x=>createHash('sha256').update(x).digest('hex');
function headerOnly(expected,template){
 const m={...expected.planMetadata,vm:{localWords:4,stackCapacity:2,stride:22,totalWords:132,entryPc:0,instructionCount:2}},words=new Uint32Array(m.totalStateWords),vmWords=new Uint32Array(m.vm.totalWords);
 words.set(expected.template.fixedCcd,6*m.stateWords);
 for(const[i,r]of expected.results.entries()){const b=i*m.stateWords,cb=m.controlTailBase+i*m.controlWords,rejected=r.status===STATUS.REJECTED;words.set(template.state,b);for(const at of template.relocations)words[b+at]+=b;words[b+2]=r.status;words[b+3]=r.reason;words[b+4]=r.row.id;words[b+5]=rejected?0:8;words[b+expected.template.segments.rawCreation.offset+4]=rejected?0:1;words[cb]=PC.magic;words[cb+1]=PC.version;words[cb+PC.header.pc]=rejected?0:m.sourceInstructions-1;words[cb+PC.header.status]=rejected?PC.status.worldTerminal:PC.status.complete;words[cb+PC.header.requestedH]=8;words[cb+PC.header.completedH]=rejected?0:8;const v=i*m.vm.stride;vmWords[v]=I.control.magic;vmWords[v+1]=I.version;vmWords[v+I.control.status]=I.status.complete;vmWords[v+I.control.pc]=1;vmWords[v+I.control.stepsLow]=1;vmWords[v+I.control.lastOpcode]=I.opcodes.HALT;}
 return{expected,words,vmWords,planMetadata:m};
}
test('eight-h fixture retains six original raw rows, four independent creations and every original h only in expectations',async()=>{
 const{fixture:f,plan:g,identity,expected:e}=await fixture();assert.equal(f.frames,8);assert.equal(g.frames,8);assert.equal(g.sweeps,2048);assert.equal(g.count,6);assert.equal(e.kind,RAW_EIGHT_H_EXPECTED_KIND);assert.equal(e.expectedGeneration.futureStatesUploaded,false);assert.equal(e.expectedGeneration.perHAssertionsOnly,true);
 assert.deepEqual(f.rows,RAW_FIRST_H_CASES.map(({id,settings})=>({id,settings})));assert.deepEqual(unpackCandidates(g.input).map(({id,settings})=>({id,settings})),f.rows);
 const clear=e.results.filter(r=>r.kind==='clear');assert.equal(clear.length,4);assert.equal(new Set(clear.map(r=>r.seed.initialSnapshotSha256)).size,4);for(const r of clear){assert.equal(r.initial.frame,0);assert.deepEqual(r.steps.map(x=>x.snapshot.frame),[1,2,3,4,5,6,7,8]);assert.equal(r.final,r.steps[7]);assert.equal(r.seed.sourceOrigin.preStrikeSnapshotSha256,identity.preStrikeIdentity);assert.deepEqual(r.seed.sourceOrigin.settings,r.row.settings);assert.equal(r.final.scoring.status,'running');for(let h=1;h<8;h++)assert.ok(r.steps[h].snapshot.time>r.steps[h-1].snapshot.time);}
 assert.equal(g.pc.maxH,8);assert.equal(g.pc.controlVisitPolicy,'single-call');assert.equal(g.pc.controlPartition,'source-closures-v1');assert.equal(g.pc.bytecode.at(-4),PC.opcode.endH);assert.equal(e.planMetadata.sourceInstructions,g.pc.instructions);
 assert.equal(g.init.resources.worldTemplate,f.plan.clone);assert.equal(g.init.resources.worldState,g.pc.controlTailBase);assert.equal(typeof g.init.resources.worldState,'number');assert.equal(g.init.initialUploads.length,1);assert.equal(g.init.initialUploads[0].data,g.template.fixedCcd);assert.equal(g.init.initialUploads[0].offsetWords,6*g.template.state.length);assert.equal(g.init.hostReadbacksBeforeH,0);assert.equal(g.init.commands.at(-1).stage,'creation-finish');
 assert.deepEqual(identity.sourceCaps,WORLD_H_BOUNDS);assert.equal(identity.rawInputSha256,sha(g.input));assert.equal(identity.programSha256,sha(g.program));assert.equal(identity.sharedGeometrySha256,sha(g.template.sharedGeometry));const{generationIdentity,...withoutDigest}=identity;assert.equal(generationIdentity,sha(serialize(withoutDigest)));assert.equal(e.generationIdentity,generationIdentity);
 assert.deepEqual(Object.keys(identity).sort(),['sourceHead','sourceHashes','sourceArtifactSha256','preStrikeIdentity','sourceIdentity','rawRows','rawInputSha256','programSha256','sharedGeometrySha256','rule','frames','count','options','sourceCaps','pipelineIdentity','generationIdentity'].sort());
});
test('original two-h comparator still rejects eight-h expectations instead of being weakened',async()=>{
 const{fixture:f,plan:g}=await fixture();assert.throws(()=>compareRawWorldPcResult({fixture:f,plan:g,words:new Uint32Array(g.pc.totalStateWords)}),/independent original two-h/);
});
test('recurrence comparator rejects transport/domain failures and every rejected-row advancement without repairing any word',async()=>{
 const{expected,plan}=await fixture();const cases=[['unfinished VM',x=>x.vmWords[I.control.status]=I.status.ready],['VM error',x=>x.vmWords[I.control.error]=I.error.sourceDomain],['pending macro',x=>x.vmWords[I.control.pendingMacro]=1],['retained stack',x=>x.vmWords[I.control.sp]=1],['mid-h incomplete',x=>x.words[x.planMetadata.controlTailBase+PC.header.status]=PC.status.ready],['wrong source end PC',x=>x.words[x.planMetadata.controlTailBase+PC.header.pc]--],['seven h',x=>x.words[5]=7],['unsupported is not miss',x=>x.words[2]=STATUS.UNSUPPORTED],['rejected h',x=>x.words[4*x.planMetadata.stateWords+5]=1,421],['rejected call',x=>x.words[x.planMetadata.controlTailBase+4*x.planMetadata.controlWords+PC.header.calls]=1,421],['rejected creation',x=>x.words[5*x.planMetadata.stateWords+expected.template.segments.rawCreation.offset+4]=1,522]];
 for(const[name,mutate,candidate=17]of cases){const x=headerOnly(expected,plan.template);mutate(x);const words=x.words.slice(),vm=x.vmWords.slice();assert.throws(()=>compareRawEightHResult(x),error=>{assert.equal(error.recurrenceDiagnostic?.candidate,candidate,name+' intended candidate guard');assert.equal(error.recurrenceDiagnostic?.validationPhase,'transport',name+' fails before physics comparison');return true;},name);assert.deepEqual(x.words,words,name+' source unchanged');assert.deepEqual(x.vmWords,vm,name+' VM unchanged');}
 const x=headerOnly(expected,plan.template);assert.throws(()=>compareRawEightHResult({...x,planMetadata:{...x.planMetadata,frames:2}}),/metadata frames/);
});
test('terminal headers alone cannot satisfy the unchanged all11 original physics and rule comparator',async()=>{
 const{expected,plan}=await fixture(),x=headerOnly(expected,plan.template),events=[],before=x.words.slice();let error;try{compareRawEightHResult({...x,trace:e=>events.push(e)});}catch(e){error=e;}assert.ok(error);assert.equal(error.recurrenceDiagnostic.frames,8);assert.equal(error.recurrenceDiagnostic.candidate,17);assert.equal(error.recurrenceDiagnostic.validationPhase,'physics');assert.equal(error.recurrenceDiagnostic.differences.length,11);assert.ok(events.some(e=>e.stage==='mismatch'));assert.ok(!events.some(e=>e.stage==='strict-comparison-pass'));assert.deepEqual(x.words,before);
});
