'use strict';
// Independent unchanged-PhysicsLab capture. Candidate world/stages are not oracle inputs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),crypto=require('node:crypto');
const F=require('./three-ball-scene-fixture.cjs'),V=require('../src/experimental-cue-created-variant');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const schema='original-three-ball-yaw15-through-clock-switch-v1';
const root=path.resolve(__dirname,'..'),sources=['tests/three-ball-yaw-fixture.cjs','tests/cue-broad-phase-fixture.cjs','tests/three-ball-contact-seed.cjs','tests/three-ball-initial-pair-seeds.cjs','tests/three-ball-scene-fixture.cjs','tests/cue-initialization-fixture.cjs','tests/cue-stroke-fixture.cjs','src/physics.js','src/math.js','src/experimental-cue-joint-snapshot.js','src/experimental-cue-created-variant.js','vendor/rapier.cjs','tools/rapier-snapshot-decoder/index.cjs'];
function sourceIdentity(){
 assert.ok(process.env.RAPIER_SNAPSHOT_DECODER,'Explicit admitted native decoder required');
 return {schema,variant:V.YAW15,settings:{...V.SETTINGS},selectedIndex:0,fixtureScope:'original-three-ball-constructor-layout',constructorNativeSettlingSteps:72,additionalApplicationSettlingSteps:0,node:process.version,v8:process.versions.v8,sourceRevision:F.D.SOURCE_REVISION,engineSha256:F.D.ENGINE_SHA256,decoderBinarySha256:hash(fs.readFileSync(process.env.RAPIER_SNAPSHOT_DECODER)),captureFunctionSha256:hash(F.captureThroughSwitch.toString()),sources:Object.fromEntries(sources.map(p=>[p,hash(fs.readFileSync(path.join(root,p)))]))};
}
function verifyRecord(record){
 assert.equal(record.fixtureScope,'original-three-ball-constructor-layout');
 assert.deepEqual(record.sourceHashes,require('./cue-stroke-fixture.cjs').sourceHashes(),'Creation probe exact source identity');
 assert.equal(record.constructorNativeSettlingSteps,72);assert.equal(record.additionalApplicationSettlingSteps,0);
 assert.equal(record.selectedIndex,0);assert.equal(record.objects.length,3);assert.deepEqual(record.settings,V.SETTINGS);
 assert.deepEqual(record.cueInitialization.application.strikeSettings,V.SETTINGS);
 assert.equal(record.cueInitialization.application.initialElapsed,0);assert.equal(record.started,0);
 for(const raw of[record.before,record.created,record.post]){
  assert.equal(raw.sourceRevision,F.D.SOURCE_REVISION);assert.equal(raw.engineSha256,F.D.ENGINE_SHA256);
  assert.equal(hash(raw.snapshot),raw.snapshotSha256,'Exact independent snapshot payload identity');
 }
 assert.equal(record.sceneRegistry.snapshotSha256,record.created.snapshotSha256);
 assert.deepEqual(record.roles.ball,record.objects[0].body);
 const roles=['ball','otherBall1','otherBall2'],x=[-.66,.17,.84],z=[.10,.055,-.29];
 for(let i=0;i<3;i++){
  const before=record.before.bodies[roles[i]],created=record.created.bodies[roles[i]];
  assert.deepEqual(created.pos,before.pos,'Strike creation never repositions balls');
  assert.equal(created.pos.position.translation[0],Math.fround(x[i]),'Original constructor x');
  assert.equal(created.pos.position.translation[2],Math.fround(z[i]),'Original constructor z');
 }
 return record;
}
function cueInitial(record){
 verifyRecord(record);
 const initial={...structuredClone(record.cueInitialization),sourceCreation:{created:record.created,roles:record.roles,events:record.events},initializationInputs:F.initializationInputs(record)};
 initial.application.fixtureVariant=V.YAW15;initial.application.selectedIndex=0;
 V.validateApplication(initial.application);return initial;
}
function exportSeed(record){
 verifyRecord(record);
 // Existing exporter consumes only record.created. No replay/native h1 becomes state.
 const initial=cueInitial(record),tagged={...record,fixtureVariant:V.YAW15,cueInitialization:{...structuredClone(record.cueInitialization),application:structuredClone(initial.application)}};
 const seed=require('./three-ball-contact-seed.cjs').exportContactSeed(tagged);
 seed.cueInitial=initial;return seed;
}
function verifyFrames(record,frames){
 assert.ok(Array.isArray(frames)&&frames.length>8&&frames.length<=1280);
 assert.ok(frames.some(x=>x.cuePresent&&!x.touching),'Real pre-contact approach');
 assert.ok(frames.some(x=>x.touching),'Real compliant contact');
 assert.equal(frames.filter(x=>x.separation).length,1,'One native cue withdrawal');
 assert.equal(frames.filter(x=>x.h===1/960).length,2,'Both ordinary source steps retained');
 assert.equal(frames.at(-1).cuePresent,false);
 assert.deepEqual(frames[0].raw.snapshot,record.post.snapshot,'Independently recreated first h equals original creation probe');
 for(const frame of frames){assert.equal(frame.balls.length,3);if(frame.raw){assert.equal(hash(frame.raw.snapshot),frame.raw.snapshotSha256);assert.equal(frame.raw.sourceRevision,F.D.SOURCE_REVISION);assert.equal(frame.raw.engineSha256,F.D.ENGINE_SHA256);}}
 return frames;
}
async function captureArtifact(file){
 assert.ok(path.isAbsolute(file),'Explicit absolute isolated artifact path required');
 assert.ok(!fs.existsSync(file)&&!fs.existsSync(file+'.json'),'Never overwrite a frozen replay');
 const identity=sourceIdentity();assert.equal(hash(fs.readFileSync(require.resolve('../vendor/rapier.cjs'))),F.D.ENGINE_SHA256);
 await F.R.init();assert.equal(F.R.version(),'0.21.0');
 const record=verifyRecord(F.captureOriginalCreation({layout:'original-three-ball',selectedIndex:0,settings:{...V.SETTINGS}}));
 const frames=verifyFrames(record,F.captureThroughSwitch(record));
 assert.deepEqual(sourceIdentity(),identity,'Oracle/source bytes frozen during capture');
 const payload={record,frames},bytes=v8.serialize(payload),manifest={identity,sha256:hash(bytes),bytes:bytes.length,initialSnapshotSha256:record.created.snapshotSha256,frames:frames.length,scope:'independent-native-yaw15-through-cue-withdrawal-and-two-ordinary-h; not whole-shot parity'};
 fs.writeFileSync(file,bytes,{flag:'wx'});fs.writeFileSync(file+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return manifest;
}
function loadArtifact(file){
 assert.ok(file&&path.isAbsolute(file),'YAW15_REPLAY must be an existing absolute artifact path; capture is never implicit');
 const bytes=fs.readFileSync(file),manifest=JSON.parse(fs.readFileSync(file+'.json','utf8'));
 assert.deepEqual(manifest.identity,sourceIdentity(),'Exact native variant/source provenance');
 assert.equal(manifest.sha256,hash(bytes));assert.equal(manifest.bytes,bytes.length);
 const payload=v8.deserialize(bytes);verifyRecord(payload.record);verifyFrames(payload.record,payload.frames);
 assert.equal(manifest.initialSnapshotSha256,payload.record.created.snapshotSha256);assert.equal(manifest.frames,payload.frames.length);
 return payload;
}
module.exports={V,F,schema,sourceIdentity,verifyRecord,cueInitial,exportSeed,verifyFrames,captureArtifact,loadArtifact};
if(require.main===module)captureArtifact(process.argv[2]).then(m=>console.log(JSON.stringify(m,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
