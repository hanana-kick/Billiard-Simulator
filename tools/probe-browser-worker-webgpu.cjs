'use strict';
// Capability diagnostic, not a physics or application pass. No launch flags or fallback.
const {chromium}=require('@playwright/test');
const http=require('node:http'),fs=require('node:fs');
(async()=>{let browser,server;const result={kind:'worker-webgpu-capability-v1',pass:false,classification:'capability-failure',chromiumSandbox:true,physicalHardwareVerified:false};
try{
 server=http.createServer((q,r)=>r.end('<!doctype html><title>Worker capability probe</title>'));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
 result.browserVersion=browser.version();const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port);
 result.worker=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(new Blob([`self.onmessage=async()=>{let device;const evidence={requiredLimits:{maxStorageBuffersPerShaderStage:10}};try{if(!navigator.gpu)throw Error('Worker WebGPU unavailable');const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('Worker WebGPU adapter unavailable');const info=adapter.info;Object.assign(evidence,{maxStorageBuffersPerShaderStage:adapter.limits.maxStorageBuffersPerShaderStage,maxStorageBufferBindingSize:adapter.limits.maxStorageBufferBindingSize,maxBufferSize:adapter.limits.maxBufferSize,adapter:info?{vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description}:null});if(evidence.maxStorageBuffersPerShaderStage<10)throw Error('Worker requires ten storage bindings');device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:10}});device.destroy();postMessage({pass:true,...evidence});}catch(e){device?.destroy();postMessage({pass:false,...evidence,error:e.message});}};`],{type:'text/javascript'}));
  const worker=new Worker(url),timer=setTimeout(()=>{worker.terminate();URL.revokeObjectURL(url);reject(Error('Worker capability timeout'));},30000);
  worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);resolve(data);};
  worker.onerror=e=>{clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);reject(Error(e.message));};worker.postMessage(null);
 }));
 result.pass=result.worker.pass;result.classification=result.pass?'capability-pass':'capability-failure';
}catch(error){result.error=error.stack;}finally{await browser?.close();await new Promise(r=>server?server.close(r):r());fs.mkdirSync('worker-lifecycle-evidence',{recursive:true});fs.writeFileSync('worker-lifecycle-evidence/capability.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.pass)process.exitCode=2;}})();
