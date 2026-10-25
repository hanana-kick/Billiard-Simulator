'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/experimental-pair-contact-stage');
const h=index=>({index,generation:0});
function seed(){
 const mat=groups=>({groups,friction:1,restitution:1,frictionRule:2,restitutionRule:2,parentLocalIdentity:true,contactSkin:0,mass:0});
 const edges=[0,1,2,3].map(i=>({collider1:h(0),collider2:h(16+2*i),body1:h(0),body2:h(16+i),active:true}));
 edges.push({collider1:h(17),collider2:h(21),body1:h(16),body2:h(18),active:false});
 const cache={pairPresent:1,pointPresent:0,active:0,recycleValid:0,solverColor:255},hash='a'.repeat(64);
 return{kind:'original-placed-goal-four-ball-two-body-contact-phase',phase:'post-world-step-post-application',boundary:'goalStrikeCreated',initialSnapshotSha256:hash,floorBody:h(0),floorCollider:h(0),floorMaterial:mat((2<<16)|21),bodies:[0,2].map(i=>({bodyHandle:h(16+i),primaryCollider:h(16+2*i),pairCollider:h(17+2*i),primaryMaterial:mat((1<<16)|6),pairMaterial:mat((8<<16)|8)})),floorOrder:[0,1],pair:cache,globalEdges:edges,pairAdjacency:[[4],[4]],initialContactOrigin:{kind:'verified-original-placed-goal-initial-contacts',boundary:'goalStrikeCreated',initialSnapshotSha256:hash,edges,retainedCushions:[],retainedDynamicPairs:[{edgeId:4,...edges[4],cache}]}};
}
test('original empty retained pair validation remains idempotent across factory and owner',()=>{const original=seed(),before=structuredClone(original),first=P.validate(original),second=P.validate(first);assert.deepEqual(second,first);assert.deepEqual(original,before);assert.equal(second.pair.pairPresent,1);assert.equal(second.pair.pointPresent,0);assert.deepEqual(second.initialContactOrigin,original.initialContactOrigin);});
test('normalization cannot disguise a changed retained cache or missing original ownership',()=>{for(const mutate of[s=>{s.pair={...s.pair,impulse:1};},s=>{s.initialContactOrigin.retainedDynamicPairs=[];},s=>{s.initialContactOrigin.initialSnapshotSha256='b'.repeat(64);}]){const s=seed();mutate(s);assert.throws(()=>P.validate(s));}});
