import test from 'node:test';
import assert from 'node:assert/strict';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {createMicrocodePointFixture,assertMicrocodePointFixture} from './resident-candidate-microcode-point-fixture.mjs';
test('authentic original twelve cushion projections run in one retained microcode control loop with exact feature words',async t=>{
 const f=await createMicrocodePointFixture(),p=f.compiled,vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,count:f.count,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,bindings:f.bindings,initialSlots:f.initialSlots});let maximumSteps=0,totalSteps=0,totalChunks=0;
 for(let lane=0;lane<f.count;lane++){vm.begin(lane);let status=1,chunks=0;while(status===1){status=vm.advance(lane,4096);assert.ok(++chunks<1000,'bounded authentic query continuation');}assert.equal(status,2,'source query must complete');const steps=vm.state[lane*vm.layout.stride+6];totalSteps+=steps;maximumSteps=Math.max(maximumSteps,steps);totalChunks+=chunks;}
 assertMicrocodePointFixture(f,f.bindings[0]);t.diagnostic(JSON.stringify({hostOnly:true,queries:f.count,sourceGjkCap:f.layout.gjkIterations,instructions:p.instructions.length/8,localWords:p.localWords,maximumSteps,totalSteps,totalChunks,nativeQualified:false,fullWorld:false}));
});
