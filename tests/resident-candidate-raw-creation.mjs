import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import Init from '../src/experimental-cue-initialization.js';
import Graph from '../src/experimental-arithmetic-graph.js';
import {compileRawStrikeProgram,executeSourceNumberProgramReference} from '../src/resident-candidate/raw-strike.mjs';
import {generateRawCueBindingWGSL,bindRawCueForTest,RAW_CUE_BINDING_LAYOUT} from '../src/resident-candidate/raw-creation.mjs';
import {createCueProgramBundle,packCueInitialState} from '../src/resident-candidate/cue-orchestration.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
const require=createRequire(import.meta.url),H=require('./cue-obstacle-fixtures.cjs'),R=H.R;require('../src/game-rules.js');require('../src/controller.js');
const bits=x=>new Uint32Array(Float32Array.from(x).buffer),read=(x,a,n)=>Array.from(new Float32Array(x.buffer,x.byteOffset,x.length).slice(a,a+n));
function numerical(input){const s=Init.validate(input),a=new Float32Array(40);a.set(s.translation);a.set(s.rotation,3);a.set(s.localCom,7);a[10]=s.localInvMass;a.set(s.invPrincipalInertia,11);a.set(s.principalFrame,14);a[18]=+(s.bodyType==='Dynamic');a[19]=s.colliders.length;for(let i=0;i<2;i++){a[29+i*10]=1;const c=s.colliders[i];if(c)a.set([c.shape==='Cylinder'?2:1,c.radius,c.halfHeight,...c.localTranslation,...c.localRotation],20+i*10);}return Graph.execute(a,Init.buildPlan());}
function settings(){let x=0x434f4d;const rand=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};return [{angle:0,elevation:0,speed:.5,tipX:0,tipY:0},{angle:90,elevation:85,speed:4.5,tipX:.5,tipY:-.2},...Array.from({length:30},()=>({angle:rand()*720-360,elevation:rand()*85,speed:.5+rand()*4,tipX:(rand()-.5)*.8,tipY:(rand()-.5)*.8}))];}
test('raw candidate poses refresh actual created mass BEFORE lateral; invariant local attachment mass is retained',async()=>{
 await R.init();const{seed}=await originalRegisteredFixture(),bundle=createCueProgramBundle(),common=packCueInitialState(seed.cueInitial,bundle),program=compileRawStrikeProgram({clearanceGeometry:true}),lab=new globalThis.PhysicsLab(R);globalThis.LabController.prototype.setupGame.call({lab,state:{gameMode:'four',routeOptions:{}}});lab.world.propagateModifiedBodyPositionsToColliders();const selected=lab.objects[0],center=H.arr(selected.body.translation());let differentInertia=0;
 try{for(const s of settings()){
  // Test oracle only. Ignoring obstruction deliberately isolates creation fields;
  // production binding below requires the independently computed clear receipt.
  assert.equal(lab.strike(selected.id,s,{ignoreObstruction:true,saveSnapshot:false}).ok,true);
  const raw=executeSourceNumberProgramReference(program,[...['angle','elevation','speed','tipX','tipY'].map(k=>s[k]),...center]).raw;
  const initial=bindRawCueForTest({raw,clearance:1,cue:common,testOnly:true}),inputs=seed.cueInitial.initializationInputs.map((value,i)=>({...structuredClone(value),translation:read(initial,374+i*40,3),rotation:read(initial,377+i*40,4)})),numeric=new Float32Array(90);inputs.forEach((input,i)=>numeric.set(numerical(input),i*30));const state=bindRawCueForTest({raw,clearance:1,cue:common,numeric,testOnly:true});
  for(let i=0;i<3;i++){const role=['shaft','head','guide'][i],body=role==='shaft'?lab.cue.body:lab.cue[role],p=i<2?64+i*48+6:160;assert.deepEqual(bits(read(state,p,3)),bits(H.arr(body.translation())),role+' translation');assert.deepEqual(bits(read(state,p+3,4)),bits(H.quat(body.rotation())),role+' rotation');assert.deepEqual(bits(H.arr(body.localCom())),bits(inputs[i].localCom));assert.deepEqual(bits(H.arr(body.invPrincipalInertia())),bits(inputs[i].invPrincipalInertia));assert.deepEqual(bits(H.quat(body.principalInertiaLocalFrame())),bits(inputs[i].principalFrame));assert.equal(body.invMass(),inputs[i].localInvMass);
   if(i<2){const ii=Array.from(body.effectiveWorldInvInertia().elements).slice(0,6);assert.deepEqual(bits(read(state,64+i*48,3)),bits(H.arr(body.linvel())),role+' linear');assert.deepEqual(bits(read(state,248+i*3,3)),bits(H.arr(body.worldCom())),role+' created COM');assert.deepEqual(bits(read(state,64+i*48+16,3)),bits(H.arr(body.effectiveInvMass())),role+' created inverse mass');assert.deepEqual(bits(read(state,64+i*48+19,6)),bits(ii),role+' created world inertia');if(!bits(read(state,64+i*48+19,6)).every((x,j)=>x===common[64+i*48+19+j]))differentInertia++;}
  }
  // The original first-h user-change phase has NOT been consumed prematurely.
  for(const i of[5,6,7,13,47])assert.equal(state[i],0);assert.deepEqual(state.subarray(494,584),common.subarray(494,584));assert.deepEqual(state.subarray(1232,1238),raw.subarray(2,8));lab.removeCue();
 }}finally{lab.dispose();}
 assert.ok(differentInertia>0);assert.equal(RAW_CUE_BINDING_LAYOUT.nativeAllocation,false);
});
test('numerical binding refuses replay or uncleared raw rows; no allocator admission',async()=>{
 const{seed}=await originalRegisteredFixture(),bundle=createCueProgramBundle(),cue=packCueInitialState(seed.cueInitial,bundle),raw=new Uint32Array(128);raw[0]=1;
 assert.throws(()=>bindRawCueForTest({raw,clearance:1,cue}),/test-only/);assert.throws(()=>bindRawCueForTest({raw,clearance:2,cue,testOnly:true}),/clear source/);for(const index of[5,6,7,13,47]){const changed=cue.slice();changed[index]=1;assert.throws(()=>bindRawCueForTest({raw,clearance:1,cue:changed,testOnly:true}),/Fresh/);}
 assert.match(generateRawCueBindingWGSL(),/fn rc_raw_bind_created_mass/);assert.doesNotMatch(generateRawCueBindingWGSL(),/@binding|@compute/);
});
