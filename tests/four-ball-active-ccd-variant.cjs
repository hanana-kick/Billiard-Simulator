'use strict';
// Initial admission only. No world stepping, native restore, or GPU.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8');
const F=require('./four-ball-active-ccd-fixture.cjs'),W=require('./four-ball-world-seed.cjs'),V=require('../src/experimental-cue-created-variant'),Cue=require('../src/experimental-cue-created-stroke-stage');
const active=F.load(process.env.FOUR_BALL_ACTIVE_CCD_V8),seed=W.exportInitialSeed(active.initial),cue=seed.cueInitial;
test('actual source-created four-ball engine input has a distinct validated variant',()=>{
 assert.notEqual(V.FOUR_BALL_SOURCE_INPUT,V.SOURCE_INPUT);assert.equal(V.validateApplication(cue.application),V.FOUR_BALL_SOURCE_INPUT);assert.equal(V.validateCreatedInput(cue),V.FOUR_BALL_SOURCE_INPUT);assert.equal(Cue.validate(cue).application.fixtureVariant,V.FOUR_BALL_SOURCE_INPUT);assert.equal(cue.application.selectedId,1);assert.equal(cue.application.selectedIndex,0);
});
test('four-ball origin, selected identity and source pose/velocity/journal guards remain mandatory',()=>{
 for(const mutate of [x=>x.application.fixtureVariant=V.SOURCE_INPUT,x=>x.application.environmentContract='original-three-ball-constructor-layout',x=>x.application.selectedId=2,x=>x.application.selectedIndex=1,x=>x.sourceCreation.created.sourceSelectedId=2,x=>x.sourceCreation.created.sourceSelectedIndex=1,x=>x.sourceCreation.created.sourceSelectedBody.index++,x=>x.sourceCreation.created.originalFourBallCreation=false,x=>x.sourceCreation.created.boundary='firstH.postWorld',x=>delete x.sourceCreation.roles.freshBall,x=>x.cue.shaft.translation[0]+=.01,x=>x.cue.head.linear[0]+=.01,x=>x.initializationInputs.find(i=>i.role==='guide').rotation[0]+=.01,x=>x.sourceCreation.events.at(-1).linear[0]+=.01,x=>x.sourceCreation.events.at(-1).wakeUp=false,x=>x.application.strikeSettings.speed=9]){
  const bad=structuredClone(cue);mutate(bad);assert.throws(()=>Cue.validate(bad));
 }
});
test('original default four-ball source still admits through the explicit four-ball variant',()=>{
 const r=v8.deserialize(fs.readFileSync(process.env.FOUR_BALL_CREATION_V8)),s=W.exportInitialSeed({strikeCreated:r.boundaries.strikeCreated,modeCreationJournal:r.modeCreationJournal,strikeCreationJournal:r.strikeCreationJournal});assert.equal(Cue.validate(s.cueInitial).application.fixtureVariant,V.FOUR_BALL_SOURCE_INPUT);assert.equal(s.cueInitial.application.strikeSettings.speed,2);
});
test('existing three-ball source variant remains separate and unchanged',()=>{
 const a={fixtureVariant:V.SOURCE_INPUT,environmentContract:'original-three-ball-constructor-layout',selectedIndex:0,strikeSettings:{angle:12.905686665770533,elevation:35,tipX:.25,tipY:0,speed:10}};a.axis=V.sourcePose(a.strikeSettings,[0,0,0]).axis;assert.equal(V.validateApplication(a),V.SOURCE_INPUT);assert.throws(()=>V.validateApplication({...a,fixtureVariant:V.FOUR_BALL_SOURCE_INPUT}));
});
