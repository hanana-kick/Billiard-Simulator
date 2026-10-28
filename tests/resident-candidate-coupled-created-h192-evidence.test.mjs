import test from 'node:test';import assert from 'node:assert/strict';
import {compareCoupledFinalBindings} from './resident-candidate-coupled-created-h192-evidence.mjs';
const sample=()=>({bindings:Array.from({length:6},(_,i)=>new Uint32Array([i,0,0xffffffff])),vmState:new Uint32Array([7])});
test('every final source binding is compared; different VM lowering is not copied',()=>{const a=sample(),b=sample();b.vmState[0]=9;const r=compareCoupledFinalBindings(a,b);assert.equal(r.length,6);assert.equal(a.vmState[0],7);assert.equal(b.vmState[0],9);});
test('dirty scratch, read-only program/geometry/input, audit and state differences all fail',()=>{for(let i=0;i<6;i++){const a=sample(),b=sample();b.bindings[i][1]=1;assert.throws(()=>compareCoupledFinalBindings(a,b),/entire final source binding/);assert.equal(a.bindings[i][1],0);}});
test('missing or mistyped binding cannot qualify',()=>{const a=sample(),b=sample();a.bindings.pop();assert.throws(()=>compareCoupledFinalBindings(a,b));const c=sample();c.bindings[3]=[3,0,0xffffffff];assert.throws(()=>compareCoupledFinalBindings(c,b));});
