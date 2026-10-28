import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {deserialize} from 'node:v8';import {join} from 'node:path';
import {compileCanonicalNumberProgramCall,executeCanonicalNumberProgramCall,compareNumberProgramCallCapture} from './resident-candidate-number-program-handoff.mjs';
const canonical=compileCanonicalNumberProgramCall(),dir=process.env.RESIDENT_NUMBER_PROGRAM_HANDOFF_DIR;
function basic(){const state=new Uint32Array(64).fill(0x12345678),program=new Uint32Array(32);state.fill(0,20,24);program[3]=1;program[4]=1;program[5]=16;program[12]=1;program[13]=100;program[16]=27;return[state,program,Uint32Array.of(17),Uint32Array.of(19,23),Uint32Array.of(29),Uint32Array.of(31)];}
test('original Number call closure has the exact four-u32/void signature and no substituted arithmetic',()=>{
 assert.equal(canonical.root.params.length,4);assert.equal(canonical.root.returnWords,0);assert.deepEqual(canonical.compiled.externalFunctions,[]);assert.equal(canonical.compiled.intrinsicProfile,'none');
 assert.equal(canonical.compiled.instructions.length/8,4824);assert.equal(canonical.compiled.localWords,1255);assert.match(canonical.source,/fn rc_f64_div\(/);assert.match(canonical.source,/fn rc_f64_sqrt\(/);
});
test('original zero budget and already terminal state preserve every dirty word',()=>{
 for(const prior of[0,1,2,3]){const input=basic();input[0][21]=prior;const r=executeCanonicalNumberProgramCall({canonical,initialBindings:input,args:[0,0,20,0]});assert.deepEqual(r.state,input[0]);assert.deepEqual(r.readonlyAfter,r.readonlyBefore);}
});
test('original halt, malformed PC and source instruction cap retain exact status/counter writes',()=>{
 for(const mode of['halt','bad-pc','source-cap']){const input=basic(),expected=input[0].slice();if(mode==='bad-pc'){input[0][20]=expected[20]=2;}if(mode==='source-cap'){input[0][22]=expected[22]=100;expected[21]=3;}else{expected[22]++;expected[21]=mode==='halt'?1:2;if(mode==='halt')expected[20]=1;}
 const before=input.map(x=>x.slice()),r=executeCanonicalNumberProgramCall({canonical,initialBindings:input,args:[0,0,20,20000]});assert.deepEqual(r.state,expected);assert.deepEqual(input,before,'component caller input is immutable');}
});
test('complete-state comparator rejects unrelated state and any unchanged binding identity drift',()=>{
 const capture={kind:'resident-number-program-complete-call-assertion-v1',afterState:Uint32Array.of(1,2,3),readonlyIdentities:{1:'p',2:'g',3:'dirty scratch',4:'raw input',5:'audit'}};
 const args={capture,actualState:capture.afterState.slice(),readonlyBefore:{...capture.readonlyIdentities},readonlyAfter:{...capture.readonlyIdentities}};assert.equal(compareNumberProgramCallCapture(args),true);
 for(const mutate of[x=>x.actualState[2]++,x=>x.readonlyBefore[3]='other',x=>x.readonlyAfter[5]='future']){const bad=structuredClone(args);mutate(bad);assert.throws(()=>compareNumberProgramCallCapture(bad));}
});
test('three actual post-impact source calls retain original20000 budget and every state effect',{skip:!dir},()=>{
 const input=deserialize(readFileSync(join(dir,'call-inputs.v8'))),expected=deserialize(readFileSync(join(dir,'assertions.v8'))),report=JSON.parse(readFileSync(join(dir,'report.json')));
 assert.equal(input.rawWorldInput,false);assert.equal(input.worldResidentSequenceQualified,false);assert.equal(expected.expectedNeverRuntimeInput,true);assert.equal(input.cases.length,3);
 assert.deepEqual(report.callReports.map(c=>c.args[3]),[20000,20000,20000]);assert.deepEqual(report.callReports.map(c=>c.worldCoreSteps),[11400,880310,1211247]);assert.deepEqual(report.callReports.map(c=>c.afterControl[2]),[7,256,174]);
 assert.equal(report.comparison.all11SourceGroups,true);assert.equal(report.comparison.nativePhysicsLabOuter,true);assert.equal(report.comparison.fullAcceptedEmissionTapeQualified,true);
 for(const c of input.cases){const r=executeCanonicalNumberProgramCall({canonical,initialBindings:[c.state,...[1,2,3,4,5].map(i=>c.readonlyBindings[i])],args:c.args});compareNumberProgramCallCapture({capture:expected.captures[c.index],actualState:r.state,readonlyBefore:r.readonlyBefore,readonlyAfter:r.readonlyAfter});}
});
