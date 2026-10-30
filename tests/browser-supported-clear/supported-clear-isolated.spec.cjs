'use strict';
const{test,expect}=require('@playwright/test');const fs=require('node:fs');const{createHash}=require('node:crypto');
test('captured supported-clear original versus exact early guard and invocation controls',async({page,browser},testInfo)=>{
 await page.goto('/__supported-clear/');const manifest=await(await page.request.get('/__supported-clear/manifest.json')).json();
 for(const[file,key]of[['fixture.json','fixtureSHA256'],['worker.mjs','workerSHA256']]){const r=await page.request.get('/__supported-clear/'+file);expect(r.ok()).toBe(true);expect(createHash('sha256').update(await r.body()).digest('hex')).toBe(manifest[key]);}
 const result=await page.evaluate(()=>new Promise((resolve,reject)=>{const worker=new Worker('/__supported-clear/worker.mjs',{type:'module'}),timer=setTimeout(()=>{worker.terminate();reject(Error('Isolated kernel diagnostic timeout'));},180000);worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.onmessage=({data:m})=>{if(m.event==='progress'){console.log('SUPPORTED_CLEAR_CASE '+m.case);return;}if(!['result','error'].includes(m.event))return;clearTimeout(timer);worker.terminate();resolve(m.result);};worker.postMessage({run:true});}));
 fs.mkdirSync(testInfo.outputDir,{recursive:true});fs.writeFileSync(testInfo.outputPath('isolated-supported-clear.json'),JSON.stringify({...result,browserVersion:browser.version(),manifest},null,2));
 expect(result.error).toBeUndefined();expect(result.gpuErrors).toEqual([]);expect(result.cases.map(c=>c.name)).toEqual(['original-auto','original-explicit','early-guard-explicit','binding-invocation-probe']);
 for(const c of result.cases)expect(c.differences,JSON.stringify({case:c.name,adapter:result.adapter,classification:'isolated-kernel-only-not-application-pass'})).toEqual([]);
});
