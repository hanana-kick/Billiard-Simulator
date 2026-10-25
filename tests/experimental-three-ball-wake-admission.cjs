'use strict';
// Read-only original-created snapshot projection, plus fail-closed factory tests.
// No native stepping/restore or later native state seeds candidate recurrence.
const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8');
const Pair=require('../src/experimental-pair-contact-stage');
const source=process.env.THREE_BALL_CREATION_V8??'/tmp/billiard-v3-cue-three-ball-creation-registry.v8';
const enabled=!!process.env.RAPIER_SNAPSHOT_DECODER&&fs.existsSync(source);let seed;
before(()=>{if(enabled)seed=require('./three-ball-contact-seed.cjs').exportContactSeed(v8.deserialize(fs.readFileSync(source)));});
test('initial N3 geometry is a distinct initial-only source-bound factory',{skip:!enabled},async()=>{
 for(const binding of seed.pairSeeds){
  const flats=binding.ballIndices.map(i=>seed.balls[i].state),phase=Pair.createReferenceInitialThreeBallStage(binding.seed,flats),generic=Pair.createReferenceStage(binding.seed,flats),token={};
  try{phase.claim(token);generic.claim(token);const before=phase.snapshot();
   await assert.rejects(()=>phase.prepareInitialThreeBallGeometry(flats,{globalEdges:binding.seed.globalEdges,otherNewPairCandidates:[]},token),/distinct factory and live journal/);
   await assert.rejects(()=>phase.prepareGeometry(flats,{globalEdges:binding.seed.globalEdges,otherNewPairCandidates:[]},token),/original N4/);
   await assert.rejects(()=>phase.prepare(flats,{globalEdges:binding.seed.globalEdges,otherNewPairCandidates:[]},token),/exact original live source journal/);
   await assert.rejects(()=>generic.prepareInitialThreeBallGeometry(flats,{globalEdges:binding.seed.globalEdges,otherNewPairCandidates:[]},token),/distinct factory and live journal/);
   assert.deepEqual(phase.snapshot(),before);
  }finally{phase.abort(token);generic.abort(token);phase.release(token);generic.release(token);phase.dispose();generic.dispose();}
 }
});
test('N3 initial factory rejects later clocks, sleep, absent origin and N4 identities',{skip:!enabled},()=>{
 const binding=seed.pairSeeds[0],flats=binding.ballIndices.map(i=>seed.balls[i].state);
 for(const mutate of[s=>{delete s.initialSnapshotSha256;},s=>{s.kind='original-initial-four-ball-two-body-contact-phase';s.boundary='strikeCreated';},s=>{s.bodies[1].bodyHandle.index=19;s.bodies[1].primaryCollider.index=22;s.bodies[1].pairCollider.index=23;}]){
  const s=structuredClone(binding.seed);mutate(s);assert.throws(()=>Pair.createReferenceInitialThreeBallStage(s,flats));
 }
 for(const mutate of[s=>{s.sleeping=true;s.activation.sleeping=true;},s=>{s.dt=Math.fround(1/960);},s=>{s.ccdEnabled=false;},s=>{s.gravity[1]=Math.fround(-1);}]){
  const states=structuredClone(flats);mutate(states[0]);assert.throws(()=>Pair.createReferenceInitialThreeBallStage(binding.seed,states));
 }
 const asN4={...structuredClone(binding.seed),kind:'original-initial-four-ball-two-body-contact-phase',boundary:'strikeCreated'},four=Pair.createReferenceInitialFourBallStage(asN4,flats),token={};four.claim(token);
 return assert.rejects(()=>four.prepareInitialThreeBallGeometry(flats,{globalEdges:asN4.globalEdges,otherNewPairCandidates:[]},token),/distinct factory and live journal/).finally(()=>{four.abort(token);four.release(token);four.dispose();});
});
test('private source-wake floor selection cannot be fabricated for N3 or N4',()=>{
 const I=require('../src/experimental-cloth-island-world');
 for(const forged of[{}, {kind:'source-active-wake-floor-selection'}, {floorOrder:[0],entryAwake:[true,false],sourceFloorHintSelection:'entry-asleep-count-cleared-until-next-narrow'}])assert.throws(()=>I.createReferenceSourceWakeMathStage(forged),/Private source active-wake geometry receipt/);
});

test('actual initial-N3 source phases abort on final preflight failure and retry identically',{skip:!enabled,timeout:30000},async()=>{
 const Module=require('node:module'),file=require.resolve('../src/experimental-three-ball-world'),source=fs.readFileSync(file,'utf8'),baseRequire=Module.createRequire(file),m=new Module(file,module),phases=[];let fail=true;
 m.filename=file;m.paths=module.paths;m.require=id=>{
  const actual=baseRequire(id);if(!['./experimental-pair-contact-stage','./experimental-scene-activation'].includes(id))return actual;
  return Object.fromEntries(Object.entries(actual).map(([name,value])=>{
   if(!['createReferenceInitialThreeBallStage','createReferenceStage'].includes(name)||typeof value!=='function')return[name,value];
   return[name,(...args)=>{const stage=value(...args);if(id==='./experimental-scene-activation')return Object.freeze({...stage,assertPrepared(token){stage.assertPrepared(token);if(fail){fail=false;throw Error('Injected final N3 preflight failure');}}});phases.push({stage,before:stage.snapshot()});return stage;}];
  }));
 };m._compile(source,file);
 const own=await m.exports.createReferenceStepper(seed),control=await baseRequire('./experimental-three-ball-world').createReferenceStepper(seed);
 try{const before=own.snapshot();await assert.rejects(()=>own.step(),/Injected final N3 preflight failure/);assert.deepEqual(own.snapshot(),before);assert.equal(phases.length,3);for(const p of phases)assert.deepEqual(p.stage.snapshot(),p.before);assert.deepEqual(await own.step(),await control.step());}
 finally{own.dispose();control.dispose();}
});
