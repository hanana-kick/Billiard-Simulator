'use strict';
const {chromium}=require('@playwright/test'),fs=require('fs'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const out='idle-retention-evidence';fs.mkdirSync(out,{recursive:true});
const chromeCPU=()=>{try{return execFileSync('ps',['-C','chrome','-o','cputimes='],{encoding:'utf8'}).trim().split(/\s+/).reduce((n,v)=>n+Number(v||0),0)}catch{return null}};
(async()=>{const rows=[];let failures=0;
for(const arm of ['baseline','candidate'])for(let repeat=0;repeat<3;repeat++){
 const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});const page=await browser.newPage({viewport:repeat===2?{width:390,height:844}:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const row={arm,repeat,errors,start:Date.now(),chromeCpuStart:chromeCPU()};rows.push(row);
 try{
 await page.goto(arm==='baseline'?'http://127.0.0.1:8793/':'http://127.0.0.1:8794/');await page.waitForFunction(()=>globalThis.cueLab?.state.ready);
 await page.evaluate(()=>{const c=cueLab;globalThis.audit={events:[],frames:[]};const status=c.nextShot.status.bind(c.nextShot);c.nextShot.status=(phase,extra={})=>{audit.events.push({at:performance.now(),phase,...extra});return status(phase,extra)};const observe=c.nextShot.observeFrame.bind(c.nextShot);c.nextShot.observeFrame=d=>{audit.frames.push(d);return observe(d)};const old=c.nextShot.start.bind(c.nextShot);c.nextShot.start=(...args)=>{const r=old(...args);if(c.nextShot.job){audit.job=c.nextShot.job;audit.optimizer=c.nextShot.job.optimizer;}return r;};c.queuePrediction(true);});
 await page.waitForFunction(()=>cueLab.nextShot.job?.aiming&&cueLab.nextShot.job?.optimizer?.plan,null,{timeout:30000});
 row.before=await page.evaluate(()=>({phase:cueLab.state.nextShotPreparation,aiming:cueLab.nextShot.job.aiming,progress:cueLab.nextShot.job.progress}));
 // One genuine long renderer frame. No fabricated solver or physics result.
 await page.evaluate(()=>{audit.original=cueLab.nextShot.job;audit.originalOptimizer=audit.original.optimizer;const until=performance.now()+95;while(performance.now()<until){};});
 await page.waitForTimeout(250);
 row.afterPressure=await page.evaluate(()=>({same:cueLab.nextShot.job===audit.original,phase:cueLab.state.nextShotPreparation,suspended:cueLab.nextShot.job?.suspended,disposed:audit.originalOptimizer.disposed}));
 if(arm==='candidate')assert.equal(row.afterPressure.same,true);else assert.equal(row.afterPressure.same,false);
 if(arm==='candidate'){
 // Repeated pressure must not discard/restart; idle budget expiry must retain.
 for(let n=0;n<4;n++){await page.evaluate(()=>{const until=performance.now()+65;while(performance.now()<until){};});await page.waitForTimeout(100);}
 await page.waitForTimeout(5200);
 row.budget=await page.evaluate(()=>({same:cueLab.nextShot.job===audit.original,phase:cueLab.state.nextShotPreparation,suspended:cueLab.nextShot.job?.suspended}));assert.equal(row.budget.same,true);assert.equal(row.budget.suspended,true);assert.equal(row.budget.phase.aiming,true);
 await page.screenshot({path:`${out}/${arm}-${repeat}-retained.png`,fullPage:true});
 if(repeat===1){
 await page.evaluate(()=>{cueLab.changeSettings({angle:cueLab.state.settings.angle+1});audit.oldGeneration=cueLab.nextShot.generation;});
 row.invalidated=await page.evaluate(()=>({disposed:audit.originalOptimizer.disposed,same:cueLab.nextShot.job===audit.original}));assert.equal(row.invalidated.disposed,true);assert.equal(row.invalidated.same,false);
 }else{
 await page.locator('#strike').click();await page.waitForFunction(()=>cueLab.lab.shots===1);
 row.strike=await page.evaluate(()=>({same:cueLab.nextShot.job===audit.original,reused:cueLab.state.nextShotPreparation.prestrikeReused,aiming:cueLab.nextShot.job?.aiming}));assert.equal(row.strike.same,true);assert.equal(row.strike.aiming,false);
 await page.waitForFunction(()=>!cueLab.game.pending&&cueLab.nextShot.job?.promoted,null,{timeout:90000});
 row.rest=await page.evaluate(()=>({exact:NextShotState.snapshotEqual(cueLab.lab.snapshot({trails:false}),cueLab.nextShot.job.predicted.snapshot),phase:cueLab.state.nextShotPreparation,progress:cueLab.state.routeProgress}));assert.equal(row.rest.exact,true);await page.evaluate(()=>cueLab.stopSearch());
 }
 }
 assert.deepEqual(errors,[]);row.ok=true;
 }catch(e){row.ok=false;row.error=String(e.stack||e);failures++;try{await page.screenshot({path:`${out}/${arm}-${repeat}-failure.png`})}catch{}}
 finally{try{row.audit=await page.evaluate(()=>({events:globalThis.audit?.events,frames:globalThis.audit?.frames,statusText:document.querySelector('#nextShotStatus')?.textContent}));}catch{}row.elapsedMs=Date.now()-row.start;row.chromeCpuEnd=chromeCPU();row.chromeCpuSeconds=row.chromeCpuEnd-row.chromeCpuStart;await browser.close();fs.writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify({...row,before:undefined,rest:undefined,audit:undefined}));}
}
console.log('Failures:',failures);process.exitCode=failures?1:0;})();
