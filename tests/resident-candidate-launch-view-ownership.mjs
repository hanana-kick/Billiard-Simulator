import test from 'node:test';import assert from 'node:assert/strict';
import {assertImmutableRuntimeViewAliases} from '../src/resident-candidate/launch-view-ownership.mjs';
const view=()=>Object.preventExtensions(new Uint32Array([3,7,11]));
const freeze=x=>{if(x&&typeof x==='object'&&!ArrayBuffer.isView(x)){for(const y of Object.values(x))freeze(y);Object.freeze(x);}return x;};
test('only identical runtime views under frozen metadata pass structural alias audit',()=>{
 const words=view(),runtime=freeze({words,nested:{same:words}}),launch=freeze({shader:'immutable source',uploads:[{data:words}],duplicate:words});assert.equal(assertImmutableRuntimeViewAliases(launch,runtime),undefined);
 assert.throws(()=>{launch.uploads[0].data=view();},TypeError);assert.throws(()=>assertImmutableRuntimeViewAliases(freeze({data:view()}),runtime),/identity-equal/);
 assert.throws(()=>assertImmutableRuntimeViewAliases(freeze({data:Object.preventExtensions(new Uint32Array(words.buffer))}),runtime),/identity-equal/,'same backing store is not the same admitted view');
 assert.throws(()=>assertImmutableRuntimeViewAliases(launch,freeze({words:view()})),/identity-equal/,'equal bytes in another runtime do not count');
});
test('unfrozen metadata, accessor tricks, extensible/shared/detached views reject',()=>{
 const words=view(),runtime=freeze({words});assert.throws(()=>assertImmutableRuntimeViewAliases({data:words},runtime),/frozen plain/);assert.throws(()=>assertImmutableRuntimeViewAliases(freeze({data:new Uint32Array([3,7,11])}),runtime),/nonextensible/);
 let touched=false;const accessor=Object.freeze(Object.defineProperty({},'data',{get(){touched=true;return words;}}));assert.throws(()=>assertImmutableRuntimeViewAliases(accessor,runtime),/data properties/);assert.equal(touched,false);
 const shared=Object.preventExtensions(new Uint32Array(new SharedArrayBuffer(12)));assert.throws(()=>assertImmutableRuntimeViewAliases(freeze({data:shared}),runtime),/non-shared/);
 const detached=view(),r=freeze({detached}),l=freeze({data:detached});structuredClone(detached,{transfer:[detached.buffer]});assert.throws(()=>assertImmutableRuntimeViewAliases(l,r));
});
