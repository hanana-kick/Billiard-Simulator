'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs');
for(const name of ['math','physics','game-rules','forecast','next-shot-service'])require('../src/'+name+'.js');
before(()=>R.init());
function scene(four=false){const lab=new PhysicsLab(R);if(four)lab.addSphere({x:.64,y:LabDimensions.radius+.00005,z:.30},'red','#f00');const game=four?new FourBallGame([1,2],[3,4]):new ThreeBallGame([1,2],[1,2,3]);lab.onEvent=e=>game.contact(e);return{lab,game};}
for(const four of [false,true])test(`exact full-rest state, game score and turn match original ${four?'four':'three'}-ball replay`,()=>{
 const {lab,game}=scene(four),settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
 try{
  const snapshot=lab.snapshot({trails:false}),before=game.snapshot();
  const predicted=LabForecast.predict(R,{snapshot,selectedId:1,settings,horizon:30,nextShotGame:{kind:four?'four':'three',snapshot:before,shotRules:{threeCushion:false}}});
  assert.equal(predicted.rested,true);game.begin(1,{threeCushion:false});lab.strike(1,settings);
  for(let i=0;i<30000;i++){lab.step();if(!lab.cue&&lab.objects.every(o=>o.body.isSleeping()))break;}
  const result=game.finish();assert.deepEqual(game.snapshot(),predicted.nextShot.game);assert.equal(result.nextCue,predicted.nextShot.selectedId);
  assert.equal(NextShotState.snapshotEqual(lab.snapshot({trails:false}),predicted.nextShot.snapshot),true);
  const changed=structuredClone(predicted.nextShot.snapshot);changed.world[changed.world.length-1]^=1;assert.equal(NextShotState.snapshotEqual(changed,predicted.nextShot.snapshot),false);
  changed.world=predicted.nextShot.snapshot.world;changed.objects[0].w.x+=1e-15;assert.equal(NextShotState.snapshotEqual(changed,predicted.nextShot.snapshot),false);
  lab.step(1);assert.equal(NextShotState.snapshotEqual(lab.snapshot({trails:false}),predicted.nextShot.snapshot),false,'extra rest step must not silently match');
 }finally{lab.dispose();}
});
test('horizon exhaustion does not expose an unfinished future snapshot or game',()=>{
 const {lab,game}=scene();try{const forecast=LabForecast.predict(R,{snapshot:lab.snapshot({trails:false}),selectedId:1,settings:{angle:0,elevation:8,speed:4,tipX:0,tipY:0},horizon:.1,nextShotGame:{kind:'three',snapshot:game.snapshot(),shotRules:{}}});assert.equal(forecast.rested,false);assert.equal(forecast.nextShot,undefined);}finally{lab.dispose();}
});
test('target repair follows next cue and never mutates search settings',()=>{const options={targetId:2,secondId:3,searchAlgorithm:'cpu-event-window-inverse',mode:'direct',maxCushions:0};const original=structuredClone(options);assert.deepEqual(NextShotState.repairedOptions(options,{kind:'three',objectIds:[1,2,3]},2,{objects:[{id:1},{id:2},{id:3}]}),{...options,targetId:1});assert.deepEqual(options,original);});
test('prestrike source forecast retains late opponent foul until full rest',()=>{
 const {lab,game}=scene(true),settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
 try{
  for(const p of require('./four-ball-goal-late-opponent-input.json').placements)assert.equal(lab.move(p.id,{x:p.x,y:lab.get(p.id).radius+.00005,z:p.z}),true);
  for(let i=0;i<2000&&!lab.objects.every(o=>o.body.isSleeping());i++)lab.step();
  const snapshot=lab.snapshot({trails:false}),initial=game.snapshot(),forecast=LabForecast.predict(R,{snapshot,selectedId:1,settings,horizon:30,nextShotGame:{kind:'four',snapshot:initial,shotRules:{threeCushion:false}}});
  assert.equal(forecast.rested,true);assert.equal(forecast.nextShot.game.scores[1],-1);assert.equal(forecast.nextShot.selectedId,2);
  game.begin(1,{threeCushion:false});assert.equal(lab.strike(1,settings).ok,true);for(let i=0;i<30000&&(lab.cue||lab.objects.some(o=>!o.body.isSleeping()));i++)lab.step();game.finish();
  assert.deepEqual(game.snapshot(),forecast.nextShot.game);assert.equal(NextShotState.snapshotEqual(lab.snapshot({trails:false}),forecast.nextShot.snapshot),true);
 }finally{lab.dispose();}
});
