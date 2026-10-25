'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../src/experimental-cue-created-variant'),Cue=require('../src/experimental-cue-created-stroke-stage');
const settings={angle:0,elevation:20,tipX:0,tipY:-.88,speed:2};
const application=()=>({fixtureVariant:V.PLACED_FOUR_BALL_SOURCE_INPUT,environmentContract:'original-controller-placed-goal-four-ball-layout',selectedId:1,selectedIndex:0,strikeSettings:{...settings},axis:V.sourcePose(settings,[0,0,0]).axis});
test('placed four-ball source controls use a distinct actual-origin admission',()=>{
 assert.equal(V.validateApplication(application()),V.PLACED_FOUR_BALL_SOURCE_INPUT);
 for(const patch of [{environmentContract:'original-controller-four-ball-created-layout'},{selectedId:2},{selectedIndex:1},{fixtureVariant:V.FOUR_BALL_SOURCE_INPUT},{axis:[1,0,0]}])assert.throws(()=>V.validateApplication({...application(),...patch}));
 for(const settings of [{...application().strikeSettings,speed:11},{...application().strikeSettings,elevation:86},{...application().strikeSettings,tipY:1}])assert.throws(()=>V.validateApplication({...application(),strikeSettings:settings}));
});
test('actual original placed source geometry, journals and selected body cannot be relabelled',{skip:!process.env.ELEVATED_FLIGHT_REFERENCE},()=>{
 const Ref=require('./elevated-flight-reference-memory.cjs'),E=require('./goal-four-world-seed.cjs'),p=Ref.load(process.env.ELEVATED_FLIGHT_REFERENCE,process.env.ELEVATED_FLIGHT_ORACLE),r=p.record;
 const s=E.exportInitialSeed({goalStrikeCreated:r.boundaries.goalStrikeCreated,strikeCreationJournal:r.strikeCreationJournal},E.placementProvenanceFromRecord(r)).cueInitial;
 assert.equal(Cue.validate(s).application.fixtureVariant,V.PLACED_FOUR_BALL_SOURCE_INPUT);
 for(const mutate of [x=>x.application.strikeSettings.speed=3,x=>x.application.strikeSettings.tipY=0,x=>x.sourceCreation.created.boundary='strikeCreated',x=>x.sourceCreation.created.sourceSelectedId=2,x=>x.sourceCreation.created.bodies.head.pos.position.translation[0]+=.01]){const x=structuredClone(s);mutate(x);assert.throws(()=>Cue.validate(x));}
});
