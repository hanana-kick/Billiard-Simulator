// HOST schema tests only. This does not execute or qualify altered source code.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {deserialize} from 'node:v8';
import {ISOLATED_RAW_PC_KIND,ISOLATED_RAW_PC_RECURRENCE_KIND,assertSerializedRawPcRuntime,assertSerializedRawPcRecurrenceRuntime,serializeRawPcRuntime,serializeRawPcRecurrenceRuntime} from './resident-candidate-isolated-runtime.mjs';
const old=()=>deserialize(readFileSync('/tmp/resident-raw-pc-isolated-native-v2/runtime.v8'));
function preparation(frames){const p=old(),pc={...p.pc,maxH:frames,begin:{...p.pc.begin,code:p.pc.begin.code.replace('rc_state[cb+6u]=2u;',`rc_state[cb+6u]=${frames}u;`)}},identity={...p.identity,frames};return{identity,g:{count:p.count,frames,sweeps:p.sweeps,sourceMode:p.sourceMode,dispatches:p.dispatches,source:{transport:p.transport},init:p.init,pc,program:p.program,input:p.input,template:{sharedGeometry:p.sharedGeometry}}};}
test('two-h public schema remains fixed and the distinct eight-h serializer has an explicit baked source horizon',()=>{
 const p=old();assert.equal(p.kind,ISOLATED_RAW_PC_KIND);assertSerializedRawPcRuntime(p);assert.throws(()=>assertSerializedRawPcRecurrenceRuntime(p));
 const two=preparation(2),eight=preparation(8),serialized2=serializeRawPcRuntime(two.g,two.identity),serialized8=serializeRawPcRecurrenceRuntime(eight.g,eight.identity);assert.deepEqual(serialized2,p);assert.equal(serialized8.kind,ISOLATED_RAW_PC_RECURRENCE_KIND);assert.equal(serialized8.frames,8);assertSerializedRawPcRecurrenceRuntime(serialized8);assert.throws(()=>assertSerializedRawPcRuntime(serialized8));assert.throws(()=>serializeRawPcRuntime(eight.g,eight.identity));assert.throws(()=>serializeRawPcRecurrenceRuntime(two.g,two.identity));
 assert.equal(p.frames,2);assert.equal(two.g.frames,2);assert.equal(eight.g.frames,8,'serializers never mutate input to pass the other public assertion');
});
test('recurrence refuses metadata-only horizon changes, future state payloads, unknown kinds and incompatible dimensions',()=>{
 const {g,identity}=preparation(8),p=serializeRawPcRecurrenceRuntime(g,identity);
 for(const mutate of[q=>q.frames=2,q=>q.frames=4,q=>q.pc.maxH=2,q=>q.identity.frames=2,q=>q.count=1024,q=>q.kind=ISOLATED_RAW_PC_KIND,q=>q.pc.begin.code=q.pc.begin.code.replace('rc_state[cb+6u]=8u;','rc_state[cb+6u]=2u;'),q=>q.pc.begin.code+='rc_state[cb+6u]=9u;',q=>q.expected=new Uint32Array(1),q=>q.init.resources.worldState=new Uint32Array(4),q=>q.pc.expectedBank=new Uint32Array(1)]){const q=structuredClone(p);mutate(q);assert.throws(()=>assertSerializedRawPcRecurrenceRuntime(q));}
 const two=old();two.kind=ISOLATED_RAW_PC_RECURRENCE_KIND;two.frames=two.pc.maxH=two.identity.frames=8;assert.throws(()=>assertSerializedRawPcRecurrenceRuntime(two),/baked as eight/,'relabeled h2 source cannot masquerade as an h8 program');
});
