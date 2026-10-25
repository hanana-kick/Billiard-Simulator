'use strict';
// Independent unchanged-PhysicsLab oracle. This module never imports a candidate
// world/stepper; expected states remain assertion-only, never seed inputs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),crypto=require('node:crypto');
const F=require('./three-ball-scene-fixture.cjs'),V=require('../src/experimental-cue-created-variant'),family=require('../docs/parity/cue-input-family-v1.json');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),root=path.resolve(__dirname,'..'),schema='original-source-cue-input-through-clock-switch-v1';
const sources=['docs/parity/cue-input-family-v1.json','tests/cue-source-input-fixture.cjs','tests/cue-initialization-fixture.cjs','tests/cue-stroke-fixture.cjs','tests/three-ball-scene-fixture.cjs','src/physics.js','src/math.js','src/experimental-cue-joint-snapshot.js','vendor/rapier.cjs','tools/rapier-snapshot-decoder/index.cjs'];
function specification(id){const s=family.cases.find(x=>x.id===id);assert.ok(s,'Explicit preregistered case id required');return structuredClone(s);}
function sourceIdentity(id){
 assert.ok(process.env.RAPIER_SNAPSHOT_DECODER,'Explicit admitted native decoder required');
 return{schema,specification:specification(id),familySchema:family.schema,fixtureScope:family.layout,selectedIndex:family.selectedIndex,constructorNativeSettlingSteps:72,additionalApplicationSettlingSteps:0,node:process.version,v8:process.versions.v8,sourceRevision:F.D.SOURCE_REVISION,engineSha256:F.D.ENGINE_SHA256,decoderBinarySha256:hash(fs.readFileSync(process.env.RAPIER_SNAPSHOT_DECODER)),captureFunctionSha256:hash(F.captureThroughSwitch.toString()),sources:Object.fromEntries(sources.map(p=>[p,hash(fs.readFileSync(path.join(root,p)))]))};
}
function verifyRecord(record,spec){
 assert.equal(record.fixtureScope,family.layout);assert.equal(record.constructorNativeSettlingSteps,72);assert.equal(record.additionalApplicationSettlingSteps,0);assert.equal(record.selectedIndex,0);assert.equal(record.objects.length,3);
 assert.deepEqual(record.settings,spec.settings);assert.deepEqual(record.cueInitialization.application.strikeSettings,spec.settings);assert.equal(record.cueInitialization.application.initialElapsed,0);assert.equal(record.started,0);
 assert.deepEqual(record.sourceHashes,require('./cue-stroke-fixture.cjs').sourceHashes());
 for(const raw of[record.before,record.created,record.post]){assert.equal(raw.sourceRevision,F.D.SOURCE_REVISION);assert.equal(raw.engineSha256,F.D.ENGINE_SHA256);assert.equal(hash(raw.snapshot),raw.snapshotSha256,'Exact original snapshot bytes');}
 assert.equal(record.sceneRegistry.snapshotSha256,record.created.snapshotSha256);assert.deepEqual(record.roles.ball,record.objects[0].body);
 for(const [i,role]of['ball','otherBall1','otherBall2'].entries()){const a=record.created.bodies[role],b=record.before.bodies[role];assert.deepEqual(a.pos,b.pos,'Strike does not reposition original balls');assert.equal(a.pos.position.translation[0],Math.fround([-.66,.17,.84][i]));assert.equal(a.pos.position.translation[2],Math.fround([.10,.055,-.29][i]));}
 return record;
}
function cueInitial(record,spec){
 verifyRecord(record,spec);
 const out={...structuredClone(record.cueInitialization),sourceCreation:{created:record.created,roles:record.roles,events:record.events},initializationInputs:F.initializationInputs(record)};
 Object.assign(out.application,{fixtureVariant:V.SOURCE_INPUT,selectedIndex:record.selectedIndex});V.validateCreatedInput(out);return out;
}
function exportSeed(record,spec){
 const initial=cueInitial(record,spec),tagged={...record,fixtureVariant:V.SOURCE_INPUT,cueInitialization:{...structuredClone(record.cueInitialization),application:structuredClone(initial.application)}};
 const seed=require('./three-ball-contact-seed.cjs').exportContactSeed(tagged);seed.cueInitial=initial;return seed;
}
function verifyFrames(record,frames){
 assert.ok(Array.isArray(frames)&&frames.length>8&&frames.length<=1280);assert.ok(frames.some(x=>x.cuePresent&&!x.touching));assert.ok(frames.some(x=>x.touching));assert.equal(frames.filter(x=>x.separation).length,1);assert.equal(frames.filter(x=>x.h===1/960).length,2);assert.equal(frames.at(-1).cuePresent,false);assert.deepEqual(frames[0].raw.snapshot,record.post.snapshot,'Independently recreated original first h');
 for(const frame of frames){assert.equal(frame.balls.length,3);if(frame.raw){assert.equal(hash(frame.raw.snapshot),frame.raw.snapshotSha256);assert.equal(frame.raw.sourceRevision,F.D.SOURCE_REVISION);assert.equal(frame.raw.engineSha256,F.D.ENGINE_SHA256);}}
 return frames;
}
async function captureArtifact(file,id){
 assert.ok(path.isAbsolute(file),'Explicit isolated absolute output required');assert.ok(!fs.existsSync(file)&&!fs.existsSync(file+'.json'),'Frozen replay is never overwritten');const spec=specification(id),identity=sourceIdentity(id);
 await F.R.init();assert.equal(F.R.version(),'0.21.0');
 // Original clearance remains active. A source-rejected input is not silently
 // repositioned, lowered, slowed, or captured with ignoreObstruction.
 const preflight=new PhysicsLab(F.R);let accepted;try{accepted=preflight.strike(1,{...spec.settings},{saveSnapshot:false});}finally{preflight.dispose();}
 if(!accepted.ok){const result={identity,status:'original-strike-rejected',reason:accepted.reason,paritySuccess:false};fs.writeFileSync(file+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;}
 const record=verifyRecord(F.captureOriginalCreation({layout:'original-three-ball',selectedIndex:0,settings:{...spec.settings}}),spec),frames=verifyFrames(record,F.captureThroughSwitch(record));
 assert.deepEqual(sourceIdentity(id),identity,'Original source bytes frozen during native capture');const bytes=v8.serialize({record,frames}),manifest={identity,status:'native-cue-removal-and-clock-switch-complete',sha256:hash(bytes),bytes:bytes.length,initialSnapshotSha256:record.created.snapshotSha256,frames:frames.length,contactH:frames.filter(x=>x.touching).length,separationH:frames.findIndex(x=>x.separation)+1,scope:family.scope,paritySuccess:false};
 fs.writeFileSync(file,bytes,{flag:'wx'});fs.writeFileSync(file+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
function loadArtifact(file){
 assert.ok(file&&path.isAbsolute(file),'Existing absolute CUE_INPUT_REPLAY required; capture is never implicit');const bytes=fs.readFileSync(file),manifest=JSON.parse(fs.readFileSync(file+'.json','utf8')),id=manifest.identity.specification.id;
 assert.deepEqual(manifest.identity,sourceIdentity(id));assert.equal(manifest.sha256,hash(bytes));assert.equal(manifest.bytes,bytes.length);const payload=v8.deserialize(bytes),spec=specification(id);verifyRecord(payload.record,spec);verifyFrames(payload.record,payload.frames);assert.equal(manifest.initialSnapshotSha256,payload.record.created.snapshotSha256);assert.equal(manifest.frames,payload.frames.length);return{...payload,spec,manifest};
}
module.exports={F,V,family,schema,specification,sourceIdentity,verifyRecord,cueInitial,exportSeed,verifyFrames,captureArtifact,loadArtifact};
if(require.main===module)captureArtifact(process.argv[2],process.argv[3]).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
