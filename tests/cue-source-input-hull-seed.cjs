'use strict';
// Initial-only optional cache geometry projection. Keeping this separate from
// the immutable capture helper preserves all previously frozen native identities.
const assert=require('node:assert/strict');
const Inputs=require('./cue-source-input-fixture.cjs'),T=require('../src/experimental-cue-convex-topology');
const F=Inputs.F;
function exportSeed(record,spec){
 const seed=Inputs.exportSeed(record,spec),decoded=F.decode(record,'created');
 seed.cueEmptyConvexHulls=record.created.colliders.filter(c=>c.shape.variant==='ConvexPolyhedron'&&record.sceneRegistry.statics.some(s=>F.same(s.collider.handle,c.handle))).map(c=>{
  const hull=T.exportNativeHull(decoded,F.nativeHandle(c.handle),F.D);
  assert.equal(hull.snapshot.inputSha256,record.created.snapshotSha256);
  return{collider:structuredClone(c.handle),body:structuredClone(c.parent.handle),hull};
 });
 assert.equal(seed.cueEmptyConvexHulls.length,8,'All eight original static hulls, preserving source vertex order');
 return seed;
}
module.exports={exportSeed};
