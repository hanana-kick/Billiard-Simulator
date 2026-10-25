'use strict';
// Pure source metadata checks, not a native/GPU or trajectory parity oracle.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {cushionGeometryMetadata}=require('../src/experimental-coupled-contact-owner');
const Hint=require('../src/experimental-coupled-contact-hints');
const U=0xffffffff;
const prior=(manifolds=[],hint=0)=>({hint,solverColor:255,manifolds});
const manifold=(solverFlags=1,activeContactCount=1)=>({solverFlags,activeContactCount,graphPos:U});
const prepared=(refreshed=false,pairPresent=1,active=0)=>({prepared:true,refreshed:[refreshed],state:{cushions:[{pairPresent,active}]}});
const observation=(metadata,awake=true)=>({entryAwake:[false,awake],entryDynamicAwake:[false,awake],colliderNeedsNarrowPhaseUpdate:false,visited:awake,...metadata});
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

test('dormant and prepared-but-recycled cushions retain an imported zero-manifold list',()=>{
 const before=prior(),dormant={prepared:false,cushions:[{pairPresent:1,active:0}]};
 for(const data of[dormant,prepared()]){
  const metadata=cushionGeometryMetadata(before,data,0);
  assert.deepEqual(metadata,{refreshed:false,manifolds:[]});
  const result=Hint.updateHint(before,observation(metadata,data.prepared));
  assert.deepEqual(result.manifolds,[]);
  assert.equal(result.outcome,data.prepared?'recycled':'skipped');
 }
});

test('recycled one-manifold flags and count are copied rather than derived from phase activity',()=>{
 for(const [solverFlags,activeContactCount,active]of[[3,1,0],[2,1,0],[5,0,1]]){
  const before=prior([manifold(solverFlags,activeContactCount)]);
  for(const data of[{prepared:false,cushions:[{pairPresent:1,active}]},prepared(false,1,active)]){
   assert.deepEqual(cushionGeometryMetadata(before,data,0),{refreshed:false,manifolds:[{solverFlags,activeContactCount}]});
  }
 }
});

test('the per-cushion refresh flag selects actual prepared full-refresh shape',()=>{
 const before=prior([manifold(3,1)]);
 for(const [pairPresent,active,expected]of[[1,1,[{solverFlags:1,activeContactCount:1}]],[1,0,[{solverFlags:1,activeContactCount:0}]],[0,0,[]]]){
  const metadata=cushionGeometryMetadata(before,prepared(true,pairPresent,active),0);
  assert.deepEqual(metadata,{refreshed:true,manifolds:expected});
  assert.deepEqual(Hint.updateHint(before,observation(metadata)).manifolds,expected);
 }
 const data={prepared:true,refreshed:[true,false],state:{cushions:[{pairPresent:1,active:1},{pairPresent:1,active:0}]}};
 assert.deepEqual(cushionGeometryMetadata(prior(),data,1),{refreshed:false,manifolds:[]},'another cushion refreshing cannot change this recycled list');
 assert.throws(()=>cushionGeometryMetadata(before,{prepared:false,refreshed:[true],cushions:[{pairPresent:1,active:1}]},0),/privately prepared geometry/);
});

test('Hint.updateHint count-zero repair preserves actual empty or nonempty recycled lists',()=>{
 for(const [manifolds,expectedCount,dirty]of[[[],0,false],[[manifold(3,1)],1,true],[[manifold(2,1)],0,false]]){
  const before=prior(manifolds),metadata=cushionGeometryMetadata(before,prepared(),0);
  const result=Hint.updateHint(before,observation(metadata));
  assert.equal(result.hint,32768|expectedCount);
  assert.equal(result.hintCount,expectedCount);
  assert.equal(result.updated,true);
  assert.equal(result.solverGraphDirty,dirty);
  assert.equal(result.outcome,dirty?'recycled-requalified':'recycled');
  assert.deepEqual(result.manifolds,manifolds.map(({solverFlags,activeContactCount})=>({solverFlags,activeContactCount})));
 }
});

test('metadata projection and count-zero repair do not mutate or alias their inputs',()=>{
 for(const data of[prepared(false),prepared(true)]){
  const before=freeze(prior([manifold(3,1)])),saved=structuredClone({before,data});freeze(data);
  const metadata=cushionGeometryMetadata(before,data,0);
  assert.notStrictEqual(metadata.manifolds,before.manifolds);
  assert.notStrictEqual(metadata.manifolds[0],before.manifolds[0]);
  Hint.updateHint(before,observation(metadata));
  metadata.manifolds[0].solverFlags=7;
  metadata.manifolds.push({solverFlags:1,activeContactCount:0});
  assert.deepEqual({before,data},saved);
 }
});

test('existing Hint guards still reject fresh-cache recycling and unsupported source metadata',()=>{
 assert.throws(()=>Hint.updateHint(null,observation(cushionGeometryMetadata(null,prepared(),0))),/no recyclable cache/);
 for(const manifolds of[[manifold(1,2)],[manifold(),manifold()]]){
  const before=prior(manifolds);
  assert.throws(()=>Hint.updateHint(before,observation(cushionGeometryMetadata(before,prepared(),0))),/zero\/one/);
 }
});
