'use strict';
// Artifact-only admission and negative guards. No native/WASM stepping or GPU.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8');
const F=require('./four-ball-active-ccd-fixture.cjs'),C=require('./four-ball-created-fixture.cjs'),I=require('./four-ball-initialization-seed.cjs'),W=require('./four-ball-world-seed.cjs');
const a=F.load(process.env.FOUR_BALL_ACTIVE_CCD_V8),seed=I.exportInitialSeed(a.initial);
test('source-only initial creation journal exports four-ball input without future states',()=>{
 assert.equal(a.identity.controllerSettingsAccepted,false);assert.equal(a.identity.manualSpeedMaximum,5);assert.equal(a.identity.settings.speed,10);assert.equal(a.initial.strikeCreated.state.integration_parameters.max_ccd_substeps,4);
 assert.equal(seed.numericInputs.length,4);assert.equal(W.exportInitialSeed(a.initial).balls.length,4);assert.equal(seed.provenance.expectedFirstHStateIncluded,false);assert.equal(a.setterCalls.length,0);assert.equal(a.frames.length,394);assert.equal(a.worldFrames.length,394);
 assert.throws(()=>I.exportInitialSeed({...a.initial,expected:a.boundaries.h389}));
});
test('observed source settings must match original pose, body descriptors and both velocity setters',()=>{
 const bads=[x=>x.strikeCreated.application.controller.settings.speed=11,x=>x.strikeCreated.application.controller.settings.speed=9,x=>x.strikeCreated.application.controller.settings.angle+=1,x=>x.strikeCreated.application.controller.settings.elevation=NaN,x=>x.strikeCreated.application.controller.settings.tipX=1,x=>x.strikeCreated.application.cue.pose.tip.x+=1,x=>x.strikeCreationJournal.at(-1).args[0].fields.x+=1,x=>x.strikeCreationJournal[0].args[0].fields.translation.fields.x+=1];
 for(const mutate of bads){const bad=structuredClone(a.initial);mutate(bad);assert.throws(()=>I.exportInitialSeed(bad));}
});
test('default frozen four-ball fixture retains exact existing initial seed acceptance',()=>{
 const file=process.env.FOUR_BALL_CREATION_V8,bytes=fs.readFileSync(file),m=JSON.parse(fs.readFileSync(file+'.json'));assert.equal(C.hash(bytes),m.sha256);const r=C.verifyRecord(v8.deserialize(bytes));assert.deepEqual(r.settings,C.SETTINGS);assert.equal(I.exportInitialSeed({strikeCreated:r.boundaries.strikeCreated,modeCreationJournal:r.modeCreationJournal,strikeCreationJournal:r.strikeCreationJournal}).numericInputs.length,4);
});
test('seven native post-withdrawal boundaries retain full differences and positive clamp witness',()=>{
 const file=process.env.FOUR_BALL_ACTIVE_CCD_SOURCE,bytes=fs.readFileSync(file),m=JSON.parse(fs.readFileSync(file+'.json'));assert.equal(C.hash(bytes),m.sha256);const p=JSON.parse(bytes);assert.equal(p.inputSha256,a.manifest.sha256);assert.equal(p.manualInputAccepted,false);assert.equal(p.paritySuccess,false);assert.deepEqual(p.rows.map(r=>r.h),[388,389,390,391,392,393,394]);
 assert.deepEqual(p.rows.map(r=>r.differences.length),[4,4,3,2,0,0,0]);assert.ok(p.rows.every(r=>r.observedUnobservedEqual&&r.differences.every(d=>d.signedZeroOnly)));const selected=p.rows.find(r=>r.h===389);assert.equal(selected.clamps.length,1);assert.ok(selected.clamps[0].fraction>0&&selected.clamps[0].fraction<1&&selected.clamps[0].changedNextPose);
});
