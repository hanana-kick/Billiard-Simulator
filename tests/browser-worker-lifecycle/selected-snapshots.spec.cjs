'use strict';
// Test-only replay observer; never an application acceptance or numerical pass.
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('exact actual selected inputs: baseline then bounded native snapshots',async({page,browser},testInfo)=>{
 fs.mkdirSync(testInfo.outputDir,{recursive:true});
 const root='worker-lifecycle-evidence/selected-inputs',input=JSON.parse(fs.readFileSync(root+'/manifest.json','utf8'));
 expect(input.kind).toBe('actual-app-selected-inputs-before-transfer-v1');expect(input.totalBytes).toBeLessThanOrEqual(12*1024*1024);
 const uploads=input.uploads.map(u=>{if(!/^index-\d+\.bin$/.test(u.file))throw Error('Flat captured input filename required');const bytes=fs.readFileSync(root+'/'+u.file);expect(bytes.length).toBe(u.byteLength);expect(sha(bytes)).toBe(u.sha256);return{index:u.index,base64:bytes.toString('base64')};});
 expect(input.uploads.reduce((n,u)=>n+u.byteLength,0)).toBe(input.totalBytes);
 await page.goto('/__selected-diagnostic/');
 const diagnostic=await (await page.request.get('/__selected-diagnostic/manifest.json')).json();
 expect(diagnostic.sourceRevision).toBe(input.sourceRevision);expect(diagnostic.programManifestSha256).toBe(input.programManifestSha256);
 for(const [file,digest]of [['worker.mjs',diagnostic.workerSha256],['baseline-worker.mjs',diagnostic.baselineWorkerSha256]]){const response=await page.request.get('/__selected-diagnostic/'+file);expect(response.ok()).toBe(true);expect(sha(await response.body())).toBe(digest);}
 const run=async name=>{
  console.log('SELECTED_SNAPSHOT_STAGE '+new Date().toISOString()+' '+name);
  const result=await page.evaluate(async({name,uploads,input})=>{
   const encode=bytes=>{let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(binary);};
   const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
   const initialUploads=uploads.map(u=>({index:u.index,initial:decode(u.base64)}));
   return new Promise((resolve,reject)=>{const gpuErrors=[];const worker=new Worker('/__selected-diagnostic/'+(name==='baseline'?'baseline-worker.mjs':'worker.mjs'),{type:'module'}),timer=setTimeout(()=>{worker.terminate();reject(Error('Bounded selected observer timeout'));},10*60*1000);
    worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};
    worker.onmessage=({data:m})=>{if(m.event==='gpu-error'){gpuErrors.push(m.error);return;}if(m.event==='progress')return;if(m.event==='error'){clearTimeout(timer);worker.terminate();reject(Error(JSON.stringify(m)));return;}if(m.event!=='result')return;clearTimeout(timer);const bytes=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);const result={gpuErrors,adapter:m.adapter,inputProvenance:m.inputProvenance,world:encode(bytes(m.world)),trace:encode(bytes(m.trace)),snapshots:m.snapshots?{plan:m.snapshots.plan,words:encode(bytes(m.snapshots.words))}:null};worker.terminate();resolve(result);};
    worker.postMessage({programBaseURL:new URL('/canonical-controller-assets/wasm-gpu-programs/',location.href).href,sourceRevision:input.sourceRevision,manifestSha256:input.programManifestSha256,initialUploads,inputProvenance:input});
   });
  },{name,uploads,input:{...input,uploads:input.uploads}});
  const unpack=(encoded,label)=>{const bytes=Buffer.from(encoded,'base64');fs.writeFileSync(testInfo.outputPath(name+'-'+label+'.bin'),bytes);return new Uint32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));};
  const world=unpack(result.world,'world'),trace=unpack(result.trace,'trace'),words=result.snapshots?unpack(result.snapshots.words,'snapshots'):null;
  fs.writeFileSync(testInfo.outputPath(name+'-receipt.json'),JSON.stringify({kind:'test-only-selected-native-observer-v1',applicationPass:false,browserVersion:browser.version(),gpuErrors:result.gpuErrors,adapter:result.adapter,inputProvenance:result.inputProvenance,sourceRevision:input.sourceRevision,worldSha256:sha(Buffer.from(world.buffer)),traceSha256:sha(Buffer.from(trace.buffer)),plan:result.snapshots?.plan??null},null,2));
  expect(result.gpuErrors).toEqual([]);return{world,trace,words,plan:result.snapshots?.plan};
 };
 const baseline=await run('baseline');
 // Match this actual application's pre-instrumentation refusal before interpretation.
 const actualManifest=JSON.parse(fs.readFileSync('worker-lifecycle-evidence/selected-output/manifest.json','utf8'));expect(actualManifest.sourceRevision).toBe(input.sourceRevision);
 for(const name of ['world','trace']){const file=actualManifest.files[name];expect(file.file).toBe(name+'.bin');const bytes=fs.readFileSync('worker-lifecycle-evidence/selected-output/'+file.file);expect(bytes.length).toBe(file.byteLength);expect(sha(bytes)).toBe(file.sha256);expect(Buffer.from(baseline[name].buffer).equals(bytes),'Actual app full '+name+' parity').toBe(true);}
 const observed=await run('instrumented');
 const {analyzeSelectedDiagnostic}=await import('../../tools/analyze-selected-diagnostic.mjs');
 let analysis;try{analysis=analyzeSelectedDiagnostic({plan:observed.plan,words:observed.words,baseline,observed});}catch(error){fs.writeFileSync(testInfo.outputPath('analysis.json'),JSON.stringify({classification:'observer-effect-or-invalid-capture',applicationPass:false,error:error.message},null,2));throw error;}
 fs.writeFileSync(testInfo.outputPath('analysis.json'),JSON.stringify(analysis,null,2));
 expect(Array.from(observed.world)).toEqual(Array.from(baseline.world));expect(Array.from(observed.trace)).toEqual(Array.from(baseline.trace));
 console.log('SELECTED_SNAPSHOT_STAGE '+new Date().toISOString()+' captured; application remains unqualified');
});
