import test from 'node:test';import assert from 'node:assert/strict';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {packCreatedGeometry,GEOMETRY_CATALOG as C} from '../src/resident-candidate/geometry-state.mjs';
import {packFloorNarrow} from '../src/resident-candidate/narrowphase.mjs';
import CushionContact from '../src/experimental-cushion-contact-stage.js';

test('authenticated registered world packs actual four bodies and every ball contact cache once',async()=>{
 const {seed}=await originalRegisteredFixture(),p=packCreatedGeometry(seed);assert.deepEqual(p.counts,{balls:4,floors:4,pairs:6,convex:16,sharedHulls:4});assert.equal(p.bodyWords.length,256);assert.equal(p.catalog.length,26*C.stride);assert.equal(p.sourceIdentity,seed.initialSnapshotSha256);assert.equal(p.completeCueCacheRoster,false);
 let next=0;for(let i=0;i<26;i++){const r=p.catalog.subarray(i*C.stride,(i+1)*C.stride);assert.equal(r[C.cache],next);next+=r[C.cacheWords];assert.equal(r[C.reserved],0);assert.ok(r[C.normal]>=r[C.cache]&&r[C.impulse]<next);if(i<4)assert.deepEqual(p.caches.subarray(r[C.cache],next),packFloorNarrow(seed.balls[i].state));}
 assert.equal(next,p.caches.length);const second=packCreatedGeometry(seed);assert.deepEqual(second,p,'immutable source import is deterministic');p.bodyWords.fill(0);assert.notDeepEqual(p.bodyWords,second.bodyWords,'caller buffers own no source references');
});

test('absent convex cache imports the unchanged source owner defaults before first h',async()=>{
 const{seed}=await originalRegisteredFixture(),p=packCreatedGeometry(seed),bits=a=>new Uint32Array(Float32Array.from(a).buffer);
 for(let i=0;i<4;i++){const normalized=CushionContact.validate(seed.cushionSeeds[i]);for(let k=0;k<4;k++){const row=(10+i*4+k)*16,base=p.catalog[row+C.cache],cache=normalized.cushions[k].cache;
  assert.deepEqual(p.caches.slice(base+307,base+310),bits(cache.recycleTranslation));
  assert.deepEqual(p.caches.slice(base+310,base+314),bits(cache.recycleRotation));
  assert.equal(p.caches[base+313],0x3f800000,'source absent-pair identity quaternion');
  assert.equal(p.caches[base+384],cache.feature1);assert.equal(p.caches[base+385],cache.feature2);assert.equal(p.caches[base+386],cache.contactId);
 }}
});
