'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs');
for(const name of ['math','render-cadence','physics','game-rules','forecast','controller','next-shot-service'])require('../src/'+name);
for(const four of [false,true])test(`actual controller adopts idle frontier and matches full rest ${four?'four':'three'}`,async()=>{
 await R.init();globalThis.Worker=class{};Object.defineProperty(globalThis,'navigator',{value:{hardwareConcurrency:8},configurable:true});globalThis.LabInversePlanner={validate(){}};
 const all=[];globalThis.NextShotOptimizer=class{constructor(onProgress,onResult,onError){Object.assign(this,{onProgress,onResult,onError,worker:{}});all.push(this);}request(req){this.req=req;}dispose(){this.disposed=true;}promoteToForeground(){return true;}suspend(){return true;}};
 const c=new LabController();c.lab=new PhysicsLab(R);if(four)c.state.gameMode='four';c.setupGame();c.notify=()=>{};c.queuePrediction=()=>{};c.nextShot=new NextShotService(c);
 try{
  const before=c.captureHistory(),request={snapshot:before.world,selectedId:c.state.selectedId,settings:{...c.state.settings},horizon:30,nextShotGame:{kind:four?'four':'three',snapshot:before.game,shotRules:{threeCushion:false}}};
  const result=LabForecast.predict(R,request);assert.equal(result.rested,true);c.forecastReceipt={request,result};c.nextShot.prepareAim(c.forecastReceipt);
  const deadline=performance.now()+10000;while(!c.nextShot.job?.optimizer&&performance.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.ok(c.nextShot.job?.optimizer,'optimizer must initialize within bounded test deadline');const job=c.nextShot.job;assert.ok(job?.aiming);assert.equal(all.length,1);const opt=job.optimizer;
  opt.onResult({results:[{id:'cache'}],continuable:false});assert.notEqual(c.state.routeResult?.results?.[0]?.id,'cache');
  assert.equal(c.fire(),true);assert.equal(c.nextShot.job,job);assert.equal(job.aiming,false);assert.equal(opt.disposed,undefined);assert.equal(all.length,1);
  for(let i=0;i<30000&&(c.lab.cue||c.lab.objects.some(o=>!o.body.isSleeping()));i++)c.lab.step();c.finishGameShot();
  assert.equal(job.promoted,true);assert.equal(c.optimizer,opt);assert.equal(c.state.routeResult.results[0].id,'cache');assert.equal(NextShotState.snapshotEqual(c.lab.snapshot({trails:false}),result.nextShot.snapshot),true);
 }finally{c.nextShot.dispose();c.lab.dispose();clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);}
});

test('toggle-on requests existing forecast once; repeated on does not replace work; off cancels',()=>{
 const c=new LabController(),calls=[];c.notify=()=>{};c.forecastReceipt={id:'current'};c.state.nextShotPrecompute=false;
 c.nextShot={warm(){calls.push('warm')},prepareAim(r){calls.push(r)},cancel(reason){calls.push(reason)}};
 c.option('nextShotPrecompute',true);assert.deepEqual(calls,['warm',c.forecastReceipt]);
 c.option('nextShotPrecompute',true);assert.equal(calls.length,2);
 c.option('nextShotPrecompute',false);assert.equal(calls[2],'disabled');
 c.forecastReceipt=null;c.option('nextShotPrecompute',true);assert.equal(calls.at(-1),null);
});
