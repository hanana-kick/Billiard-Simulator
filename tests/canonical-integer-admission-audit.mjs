import test from 'node:test';
import assert from 'node:assert/strict';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {admitIntegerProgram} from '../src/canonical-integer-transport/kernel-common-guards.mjs';
const compile=()=>compileMicrocodeWGSL('@group(0) @binding(0) var<storage,read_write> out:array<u32>;fn main(){out[0u]=1u;}',{sourceStoragePolicy:[{name:'out',binding:0,scalar:'u32',access:'read_write'}]});
test('certification rejects forged, shared and mutated source bytecode before native upload',()=>{
 const c=compile();assert.doesNotThrow(()=>admitIntegerProgram(c));
 assert.throws(()=>admitIntegerProgram({...c}),/Owned canonical/);
 const shared=new Uint32Array(new SharedArrayBuffer(c.instructions.byteLength));shared.set(c.instructions);
 assert.throws(()=>admitIntegerProgram({...c,instructions:shared,words:shared}),/Owned canonical/);
 c.instructions[0]^=1;assert.throws(()=>admitIntegerProgram(c),/receipt mutated/);
});
test('certified metadata cannot silently alter readonly, binding, local or stack domains',()=>{
 const c=compile();for(const mutate of[()=>{c.localWords++;},()=>{c.callDepth++;},()=>{c.sourceStoragePolicy[0].binding=9;},()=>{c.sourceStoragePolicy[0].access='read';},()=>{c.instructions=new Uint32Array(c.instructions);}])assert.throws(mutate,TypeError);
 assert.doesNotThrow(()=>admitIntegerProgram(c));
});
