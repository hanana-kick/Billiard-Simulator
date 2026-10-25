import test from 'node:test';import assert from 'node:assert/strict';
import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';
import {generateNumericLibraryWGSL} from '../src/resident-candidate/numeric-program.mjs';
import {generateSourceNumberWGSL} from '../src/resident-candidate/source-number.mjs';
test('phase linker preserves exact reachable arithmetic and removes only unreachable functions',()=>{
 const equation='fn ordered(a:f32,b:f32,c:f32)->f32 { let x=a*b; return x+c; }';const result=linkResidentWGSL([equation,'fn unused()->u32{return 9u;}',equation,'@compute @workgroup_size(1) fn main(){let x=ordered(1.0,2.0,3.0);}']);assert.equal(result.functions,2);assert.equal(result.removedFunctions,1);assert.ok(result.code.includes(equation));assert.doesNotMatch(result.code,/unused/);assert.match(result.code,/@compute @workgroup_size\(1\)/);
});
test('phase linker rejects conflicting reachable code, preserves nested comments and storage bindings',()=>{
 assert.throws(()=>linkResidentWGSL(['fn f()->u32{return 1u;}','fn f()->u32{return 2u;}','fn main(){let x=f();}']),/Conflicting reachable/);
 assert.throws(()=>linkResidentWGSL(['const N:u32=1u;const N:u32=2u;fn main(){}']),/Conflicting WGSL declaration/);
 const result=linkResidentWGSL(['/* fn nope(){ /* inner */ } */ @group(0) @binding(0) var<storage,read_write> state:array<u32>;fn f()->u32{return state[0];}','@compute @workgroup_size(1) fn main(){state[1]=f();}']);assert.match(result.code,/@group\(0\) @binding\(0\) var<storage,read_write>/);assert.equal(result.functions,2);
});
test('real numeric and software Number libraries link without altering primitive bodies',()=>{
 const source=generateSourceNumberWGSL(),numeric=generateNumericLibraryWGSL(),result=linkResidentWGSL([source,source,numeric,'@compute @workgroup_size(1) fn main(){let n=rc_f64_add(RcF64(0u),RcF64(0u));}']);assert.match(result.code,/fn rc_f64_add/);assert.ok(result.removedFunctions>10);assert.equal((result.code.match(/alias RcF64/g)||[]).length,1);
});
