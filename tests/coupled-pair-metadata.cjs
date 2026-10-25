'use strict';
// Pure metadata contract checks, not an original-engine parity oracle.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pairGeometryMetadata}=require('../src/experimental-coupled-contact-owner');
const Hint=require('../src/experimental-coupled-contact-hints');
const U=0xffffffff,prior=manifolds=>({hint:0,solverColor:0,manifolds}),m=(solverFlags,activeContactCount)=>({solverFlags,activeContactCount,graphPos:U});
const prepared=(refreshed,pairPresent=1,active=0)=>({prepared:true,refreshed,state:{pairPresent,active}});
test('unvisited and recycled dynamic pairs preserve exact zero/one-manifold lists',()=>{
 for(const manifolds of[[],[m(3,1)],[m(2,1)],[m(5,0)]])for(const active of[0,1])for(const data of[{prepared:false,pair:{pairPresent:1,active}},prepared(false,1,active)]){
  const before=prior(manifolds),saved=structuredClone(before),actual=pairGeometryMetadata(before,data);
  assert.deepEqual(actual,{refreshed:false,manifolds:manifolds.map(({solverFlags,activeContactCount})=>({solverFlags,activeContactCount}))});
  assert.deepEqual(before,saved);assert.notStrictEqual(actual.manifolds,manifolds);
 }
});
test('only actual full-refresh pair geometry may create the one-manifold list',()=>{
 for(const [pairPresent,active,count]of[[1,1,1],[1,0,0],[0,0,null]])assert.deepEqual(pairGeometryMetadata(prior([]),prepared(true,pairPresent,active)),{refreshed:true,manifolds:count===null?[]:[{solverFlags:1,activeContactCount:count}]});
 assert.throws(()=>pairGeometryMetadata(prior([]),{prepared:false,refreshed:true,pair:{pairPresent:1,active:1}}),/privately prepared geometry/);
});
test('recycled dynamic hints count actual source flags rather than pairPresent or active',()=>{
 for(const [manifolds,count]of[[[],0],[[m(3,1)],1],[[m(2,1)],0]]){
  const before=prior(manifolds),metadata=pairGeometryMetadata(before,prepared(false,1,1));
  const out=Hint.updateHint(before,{entryAwake:[true,true],entryDynamicAwake:[true,true],colliderNeedsNarrowPhaseUpdate:false,visited:true,...metadata});
  assert.equal(out.hint,32768|count);assert.equal(out.solverGraphDirty,count===1);assert.deepEqual(out.manifolds,metadata.manifolds);
 }
 assert.throws(()=>Hint.updateHint(null,{entryAwake:[true,true],entryDynamicAwake:[true,true],colliderNeedsNarrowPhaseUpdate:false,visited:true,...pairGeometryMetadata(null,prepared(false))}),/no recyclable cache/);
});
