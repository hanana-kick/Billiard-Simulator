// Assertion-only created boundary projection. Never accepts resident words or
// a post-h snapshot; never uses the resident scene encoder/decoder as oracle.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
import '../src/experimental-live-registered-origin.js';
const Native=globalThis.LabLiveRegisteredOriginExperimental,clone=structuredClone,key=h=>h.index+':'+h.generation;
export const ORIGINAL_T0_CREATED_SCENE_PROFILE='original-native-created-scene-t0-v1';
export function originalT0CreatedScene(seed){
 assert.equal(seed.kind,'original-live-registered-four-ball-created-world');const record=seed.cueInitial.sourceCreation;Native.validateCreatedSource(record);const created=record.created;
 assert.equal(created.snapshotSha256,seed.initialSnapshotSha256);assert.equal(seed.sceneRegistry.snapshotSha256,seed.initialSnapshotSha256);assert.equal(seed.boundary,'liveRegisteredStrikeCreated');assert.equal(record.events.length,13,'actual no-step original construction journal');
 // These are direct fields of the independently captured native created scene,
 // before the original first-h initializer consumes changes/registers the cue.
 const bodies=[],seen=new Set();for(const[role,body]of Object.entries(created.bodies)){const handle=record.roles[role];assert.ok(handle);assert.equal(seen.has(key(handle)),false);seen.add(key(handle));bodies.push({handle:clone(handle),type:body.body_type,enabled:body.enabled,changes:body.changes,ids:clone(body.ids),activation:clone(body.activation),maxExtent:body.mprops.max_extent});}
 for(const body of seed.bodyRegistry){if(seen.has(key(body.handle)))continue;assert.equal(body.type,'Fixed');assert.equal(body.enabled,true);assert.equal(body.changes,0);seen.add(key(body.handle));bodies.push(Object.fromEntries(['handle','type','enabled','changes','ids','activation','maxExtent'].map(name=>[name,clone(body[name])])));}
 assert.equal(bodies.length,23);assert.equal(bodies.filter(b=>b.type==='Dynamic').length,6);for(const role of['shaft','head','guide']){const body=bodies.find(b=>key(b.handle)===key(record.roles[role]));assert.equal(body.changes,255);assert.ok(Object.values(body.ids).every(x=>x===0xffffffff),'genuinely created/unregistered cue');}
 return{phase:'source-created-pre-user-changes',manager:clone(created.islands),bodies,modifiedBodies:clone(created.modifiedBodies),consumedModifiedBodies:[]};
}
export function originalT0ComparisonSnapshot(initial,seed){
 assert.equal(initial.frame,0);assert.equal(initial.outerStep,0);assert.equal(initial.outerSubstep,0);assert.equal(initial.scene,null,'only original lazy scene sentinel is completed');assert.equal(initial.time,seed.cueInitial.application.initialTime);const scene=originalT0CreatedScene(seed);
 return{snapshot:{...initial,scene},derivation:{profile:ORIGINAL_T0_CREATED_SCENE_PROFILE,nativeCreatedSnapshotSha256:seed.initialSnapshotSha256,sceneSha256:createHash('sha256').update(serialize(scene)).digest('hex'),sourceFields:'independently captured native created islands/bodies/modified queue plus original static body registry',createdBeforeUserChanges:true,sourceSteps:0,residentWordsRead:false,residentEncoderUsed:false,otherT0OwnersUnchanged:true}};
}
