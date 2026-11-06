'use strict';
const {chromium}=require('@playwright/test'),fs=require('fs'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const cpu=()=>{try{return execFileSync('ps',['-C','chrome','-o','cputimes='],{encoding:'utf8'}).trim().split(/\s+/).reduce((n,v)=>n+Number(v||0),0)}catch{return null}};
const out='idle-toggle-evidence';fs.mkdirSync(out,{recursive:true});
(async()=>{const rows=[];let failures=0;for(const arm of ['baseline','candidate'])for(let repeat=0;repeat<3;repeat++){
 const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true}),page=await browser.newPage({viewport:repeat===2?{width:390,height:844}:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const row={arm,repeat};rows.push(row);
 try{
 await page.goto(arm==='baseline'?'http://127.0.0.1:8793/':'http://127.0.0.1:8794/');await page.waitForFunction(()=>globalThis.cueLab?.state.ready);
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
 const toggle=page.getByRole('checkbox',{name:'타격 중 다음 경로 미리 계산',exact:true});await toggle.uncheck();
 await page.waitForFunction(()=>cueLab.forecastReceipt?.result?.rested&&!cueLab.nextShot.job);
 await page.evaluate(()=>{globalThis.toggleAudit={receipt:cueLab.forecastReceipt,start:performance.now()};});
 row.cpuBefore=cpu();row.windowStart=Date.now();await toggle.check();await page.waitForTimeout(2500);row.windowMs=Date.now()-row.windowStart;row.chromeCpuSeconds=cpu()-row.cpuBefore;
 if(arm==='baseline'){row.started=await page.evaluate(()=>!!cueLab.nextShot.job);assert.equal(row.started,false);}
 else{
 await page.waitForFunction(()=>cueLab.nextShot.job?.aiming&&cueLab.nextShot.job.optimizer,null,{timeout:15000});
 row.start=await page.evaluate(()=>{toggleAudit.job=cueLab.nextShot.job;toggleAudit.optimizer=toggleAudit.job.optimizer;return {elapsedMs:performance.now()-toggleAudit.start,sameReceipt:toggleAudit.job.aimReceipt===toggleAudit.receipt,phase:cueLab.state.nextShotPreparation}});assert.equal(row.start.sameReceipt,true);
 await page.evaluate(()=>{cueLab.option('nextShotPrecompute',true);cueLab.option('nextShotPrecompute',true)});assert.equal(await page.evaluate(()=>cueLab.nextShot.job===toggleAudit.job),true);
 await page.screenshot({path:`${out}/${arm}-${repeat}-enabled.png`,fullPage:true});
 await toggle.uncheck();row.off=await page.evaluate(()=>({disposed:toggleAudit.optimizer.disposed,job:!!cueLab.nextShot.job,enabled:cueLab.state.nextShotPrecompute}));assert.deepEqual(row.off,{disposed:true,job:false,enabled:false});
 await toggle.check();await page.waitForFunction(()=>cueLab.nextShot.job?.aiming&&cueLab.nextShot.job.optimizer,null,{timeout:15000});row.reenabled=await page.evaluate(()=>cueLab.nextShot.job!==toggleAudit.job);assert.equal(row.reenabled,true);
 await toggle.uncheck();
 }
 assert.deepEqual(errors,[]);row.ok=true;
 }catch(e){row.ok=false;row.error=String(e.stack||e);failures++;}finally{row.errors=errors;await browser.close();fs.writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(row));}
 }process.exitCode=failures?1:0;})();
