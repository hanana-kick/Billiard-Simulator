'use strict';
// Configured four-ball layout, real built app, native physics and real Workers.
// This reports whether preparation finishes before rest; it is not a speed guarantee.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,chromiumSandbox:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.APP_URL);await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
  await page.evaluate(()=>{
   cueLab.setGameMode('four');const a={...cueLab.lab.get(1).body.translation()},b={...cueLab.lab.get(2).body.translation()};
   if(!cueLab.move(1,{x:-1,y:a.y,z:-.45})||!cueLab.move(2,a)||!cueLab.move(1,b))throw Error('Fixture move refused');
   cueLab.changeSettings({angle:90,speed:.8,elevation:8,tipX:0,tipY:0});cueLab.routeOption('searchAlgorithm','cpu-event-window-inverse');cueLab.option('rate',.25);
  });
  await page.waitForFunction(()=>!cueLab.state.predictionBusy&&cueLab.forecastReceipt?.result?.rested,null,{timeout:30000});
  const before=await page.evaluate(()=>({game:cueLab.game.snapshot(),predictedGame:cueLab.forecastReceipt.result.nextShot.game,seconds:cueLab.forecastReceipt.result.seconds}));
  await page.locator('#strike').click();
  await page.waitForFunction(()=>cueLab.nextShot.job?.result?.results?.length||cueLab.state.routeResult?.results?.length||cueLab.state.routeStatus==='error'||cueLab.state.nextShotPreparation.phase==='unavailable',null,{timeout:60000});
  const cached=await page.evaluate(()=>({phase:cueLab.state.nextShotPreparation,pending:!!cueLab.game.pending,result:cueLab.nextShot.job?.result||cueLab.state.routeResult}));
  assert.ok(cached.result?.results?.length>0,'the cache must contain a real verified route');
  await page.evaluate(()=>cueLab.option('rate',4));
  await page.waitForFunction(()=>!cueLab.game.pending&&cueLab.state.routeStatus==='done',null,{timeout:30000});
  const adoption=await page.evaluate(()=>({exact:NextShotState.snapshotEqual(cueLab.lab.snapshot({trails:false}),cueLab.nextShot.job.predicted.snapshot),selectedId:cueLab.state.selectedId,score:cueLab.game.scores[cueLab.state.selectedId],status:cueLab.state.nextShotPreparation}));
  const shot=cached.result.results[0];
  await page.evaluate(id=>{
   cueLab.option('nextShotPrecompute',false);cueLab.applyRoute(id);
   const selected=cueLab.state.selectedId,original=cueLab.lab.onEvent;
   globalThis.__cacheReplay={contacts:[],worldStep:cueLab.lab.world.step,start:cueLab.lab.time};
   cueLab.lab.onEvent=function(event){
    original?.call(this,event);if(event.kind!=='contact'||!event.a||!event.b)return;
    const other=event.a.id===selected?event.b:event.b.id===selected?event.a:null;if(!other)return;
    if(other.kind==='cushion'||other.id!=null)__cacheReplay.contacts.push({kind:other.kind==='cushion'?'cushion':'object',id:other.id??null,rail:LabRouteRules.railId(other),time:event.time-__cacheReplay.start});
   };
   if(!cueLab.fire())throw Error('Cached route strike refused');
  },shot.id);
  await page.waitForFunction(()=>cueLab.lab.shots===2&&!cueLab.game.pending&&cueLab.lab.objects.every(o=>o.body.isSleeping()),null,{timeout:30000});
  const after=await page.evaluate(()=>({game:cueLab.game.snapshot(),shots:cueLab.lab.shots,contacts:__cacheReplay.contacts,native:cueLab.lab.world.step===__cacheReplay.worldStep,fullRest:!cueLab.lab.cue&&cueLab.lab.objects.every(o=>o.body.isSleeping())}));
  const contacts=after.contacts.slice(0,shot.contacts.length),scoreDelta=after.game.scores[adoption.selectedId]-adoption.score;
  assert.equal(adoption.exact,true);assert.equal(scoreDelta,1);assert.equal(after.native,true);assert.equal(after.fullRest,true);assert.equal(contacts.length,shot.contacts.length);
  for(let i=0;i<contacts.length;i++){
   const actual=contacts[i],predicted=shot.contacts[i];assert.equal(actual.kind,predicted.kind);
   if(actual.kind==='object')assert.equal(actual.id,predicted.id);else assert.equal(actual.rail,predicted.rail);
   assert.ok(Math.abs(actual.time-predicted.time)<1e-8,'cached route contact time matches normal live replay');
  }
  assert.deepEqual(errors,[]);
  const report={passed:true,before,cached,adoption,after,scoreDelta,predictedContactsMatch:true,errors};
  fs.writeFileSync(process.env.OUT||'next-shot-cache-route.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
