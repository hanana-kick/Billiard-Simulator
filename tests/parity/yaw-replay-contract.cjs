'use strict';
// Synthetic record/manifest validation, not physics parity evidence.
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Y=require('../three-ball-yaw-fixture.cjs'),S=require('../cue-stroke-fixture.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),copy=x=>structuredClone(x);
function fixture(){
 const raw=n=>{const snapshot=Uint8Array.of(n),bodies={};for(const [i,role]of['ball','otherBall1','otherBall2'].entries())bodies[role]={pos:{position:{translation:[Math.fround([-.66,.17,.84][i]),.03,Math.fround([.10,.055,-.29][i])],rotation:[0,0,0,1]}}};return {snapshot,snapshotSha256:hash(snapshot),bodies,sourceRevision:Y.F.D.SOURCE_REVISION,engineSha256:Y.F.D.ENGINE_SHA256};};
 const record={fixtureScope:'original-three-ball-constructor-layout',sourceHashes:S.sourceHashes(),constructorNativeSettlingSteps:72,additionalApplicationSettlingSteps:0,selectedIndex:0,settings:{...Y.V.SETTINGS},started:0,objects:[0,1,2].map(index=>({body:{index,generation:0}})),roles:{ball:{index:0,generation:0}},cueInitialization:{application:{strikeSettings:{...Y.V.SETTINGS},initialElapsed:0}},before:raw(1),created:raw(2),post:raw(3)};
 record.sceneRegistry={snapshotSha256:record.created.snapshotSha256};return record;
}
test('yaw exporter validates original layout, settings, provenance, and unmodified ball poses',()=>{
 const record=fixture();assert.equal(Y.verifyRecord(record),record);
 for(const mutate of[
  r=>r.selectedIndex=1,r=>r.additionalApplicationSettlingSteps=72,r=>r.objects.pop(),
  r=>r.settings.angle=0,r=>r.cueInitialization.application.strikeSettings.elevation=0,
  r=>r.created.snapshot[0]^=1,r=>r.created.sourceRevision='unverified',
  r=>r.sceneRegistry.snapshotSha256='wrong',r=>r.sourceHashes['src/physics.js']='wrong',
  r=>r.created.bodies.ball.pos.position.translation[0]=0,
  r=>{r.created.bodies.ball.pos.position.translation[2]=0;r.before.bodies.ball.pos.position.translation[2]=0;}
 ]){const bad=copy(record);mutate(bad);assert.throws(()=>Y.verifyRecord(bad));}
});
test('yaw replay rejects missing approach, contact, withdrawal, clock switch, or source-h1 identity',()=>{
 const record=fixture(),frames=Array.from({length:10},(_,i)=>({balls:[{},{},{}],cuePresent:i<8,touching:i===6,separation:i===8,h:i<8?1/61440:1/960,...(i===0?{raw:copy(record.post)}:{})}));
 assert.equal(Y.verifyFrames(record,frames),frames);
 for(const mutate of[
  f=>f.forEach(x=>x.cuePresent=false),f=>f.forEach(x=>x.touching=false),
  f=>f.forEach(x=>x.separation=false),f=>f.at(-1).h=1/61440,
  f=>f[0].raw=copy(record.before),f=>f[2].balls.pop(),f=>f[0].raw.engineSha256='wrong'
 ]){const bad=copy(frames);mutate(bad);assert.throws(()=>Y.verifyFrames(record,bad));}
});
test('missing yaw replay is an error and never triggers implicit native capture',()=>{
 assert.throws(()=>Y.loadArtifact(),/capture is never implicit/);
 assert.throws(()=>Y.loadArtifact('relative.v8'),/capture is never implicit/);
});

test('initial broad-phase exporter preserves the default guard and requires matching yaw15 metadata',()=>{
 const B=require('../cue-broad-phase-fixture.cjs'),record=fixture(),a=record.cueInitialization.application;
 const legacy=copy(record);legacy.settings.angle=0;
 assert.equal(B.validateRecord(legacy),legacy,'Existing exact default settings still admitted');
 assert.throws(()=>B.validateRecord(record),'Unmarked yaw15 record remains rejected');
 assert.throws(()=>B.exportSeed(record),'Unmarked yaw15 fails before any decoder call');
 record.fixtureVariant=Y.V.YAW15;
 Object.assign(a,{fixtureVariant:Y.V.YAW15,selectedIndex:0,environmentContract:'original-three-ball-constructor-layout',axis:[Math.cos(15*Math.PI/180)*Math.cos(8*Math.PI/180),-Math.sin(8*Math.PI/180),Math.sin(15*Math.PI/180)*Math.cos(8*Math.PI/180)]});
 assert.equal(B.validateRecord(record),record,'Matching explicit yaw15 record admitted');
 for(const mutate of[
  r=>delete r.fixtureVariant,r=>r.fixtureVariant='arbitrary-yaw',r=>delete r.cueInitialization.application.fixtureVariant,
  r=>r.cueInitialization.application.fixtureVariant='arbitrary-yaw',r=>r.selectedIndex=1,
  r=>r.cueInitialization.application.selectedIndex=1,r=>r.settings.angle=0,
  r=>r.cueInitialization.application.strikeSettings.angle=0,r=>r.cueInitialization.application.axis=[1,0,0],
  r=>r.created.snapshot[0]^=1,r=>r.created.sourceRevision='unverified',r=>r.additionalApplicationSettlingSteps=72
 ]){const bad=copy(record);mutate(bad);assert.throws(()=>B.validateRecord(bad));}
 assert.equal(record.settings.angle,15,'Admission never disguises yaw15 as the default');
});
