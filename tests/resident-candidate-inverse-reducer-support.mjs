// TEST ONLY. Evaluates generated WGSL through the existing scalar VM plus
// independently modeled exact f64 primitives. Never imported by a GPU runtime.
import assert from 'node:assert/strict';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {microcodeIntrinsicReference} from './resident-candidate-microcode-intrinsic-reference.mjs';
import {generateInverseObservationWGSL} from '../src/resident-candidate/inverse-observation-reducer.mjs';
import {initializeInverseObservationState,packInverseObservationFrame,decodeInverseObservationState} from '../src/resident-candidate/inverse-observation-layout.mjs';
export function createInverseReducerTestDriver(layout,start=0){
 const entries={};for(const entry of ['observe','project']){const source=generateInverseObservationWGSL(layout,{entry}),compiled=compileMicrocodeWGSL(source,{intrinsics:'source-f64-v1'});entries[entry]={source,compiled};}
 const state=initializeInverseObservationState(layout,start),frames=new Uint32Array(layout.frameWords),output=new Uint32Array(24),bindings=[state,layout.config,new Uint32Array(1),output,frames];let steps=0;
 const run=entry=>{const c=entries[entry].compiled,p=c.functions.find(f=>f.name==='main').params[0],vm=createMicrocodeVmReferenceForTest({testOnly:true,code:c.instructions,localWords:c.localWords,stackCapacity:c.callDepth,entryPc:c.entryPc,bindings,intrinsics:'source-f64-v1',intrinsicHandler:microcodeIntrinsicReference,initialSlots:[{slot:p.slot,value:0},{slot:p.slot+1,value:0},{slot:p.slot+2,value:0}]});vm.begin();let chunks=0;while(vm.advance(0,65536)===1)assert.ok(++chunks<16,'bounded reducer-only program');assert.equal(vm.state[2],2,'generated reducer VM completed');steps+=vm.state[6];};
 return {state,frames,bindings,entries,output,frame(frame){frames.set(packInverseObservationFrame(layout,frame));run('observe');return decodeInverseObservationState(layout,state);},raw(){run('observe');return decodeInverseObservationState(layout,state);},project(){run('project');return output.slice();},get steps(){return steps;}};
}
