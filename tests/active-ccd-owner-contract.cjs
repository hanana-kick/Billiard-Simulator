'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),World=require('../src/experimental-three-ball-ccd-world');
test('bounded CCD metadata does not advertise generic CCD support',()=>{
 assert.equal(World.CAPABILITY.activeCcd,false);
 assert.equal(World.CAPABILITY.generalActiveCcdIntegrationPending,true);
 assert.deepEqual(World.CAPABILITY.boundedActiveCcd,{postCueOnly:true,originalThreeBallOnly:true,ownedSourceBvhFixedTargets:true,positivePostClamp:true});
 assert.ok(Object.isFrozen(World.CAPABILITY.boundedActiveCcd));
});
test('missing graph ownership is rejected before constructing runtime stages',async()=>{
 for(const seed of [undefined,{}, {cueBroadSeed:{}}, {contactGraphSeed:{}}]){
  assert.throws(()=>World.validate(seed),/requires the complete initial contact graph/);
  await assert.rejects(World.createReferenceStepper(seed),/requires the complete initial contact graph/);
 }
});
