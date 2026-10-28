// TEST resource owner only. Zeros/seeds are diagnostic, never physical state.
import assert from 'node:assert/strict';
import {createResidentCompactTransaction,ResidentBatchProtocolError} from '../src/resident-candidate/batch-protocol.mjs';
import {REASON as R} from '../src/resident-candidate/abi.mjs';
import {assertDiagnosticPayload,assertDiagnosticLimits} from './resident-candidate-1024-allocation-plan.mjs';
const sessions=new WeakMap(),identityEqual=(a,b)=>['sourceIdentity','preStrikeIdentity','generationIdentity'].every(k=>a?.[k]===b?.[k]);
const filters=['validation','out-of-memory','internal'];
async function scopes(s,fn){for(const f of filters)s.device.pushErrorScope(f);let result,error;try{result=await fn();}catch(e){error=e;}for(const f of [...filters].reverse()){try{const e=await s.device.popErrorScope();if(e&&!error)error=Object.assign(new Error(f+': '+e.message),{reason:f==='out-of-memory'?R.CAPACITY:R.INCOMPLETE_COMMIT});}catch(e){error??=e;}}if(error)throw error;return result;}
const lostError=s=>Object.assign(new Error('Actual device lost'),{reason:R.DEVICE_LOST,deviceLoss:s.lost});
const live=s=>{if(s.lost)throw lostError(s);assert.equal(s.poisoned,false,'invalid device/cache cannot be reused');};
const race=async(s,p)=>{const r=await Promise.race([Promise.resolve(p).then(value=>({value})),s.loss.then(()=>({lost:true}))]);if(r.lost)throw lostError(s);return r.value;};
export async function compileAllocationDiagnostic(device,payload,{progress=()=>{}}={}){
 const input=assertDiagnosticPayload(payload),limits=assertDiagnosticLimits(device,input),s={device,input,limits,active:false,poisoned:false,lost:null};
 s.loss=Promise.resolve(device.lost).then(info=>{s.lost=info??{reason:'unknown'};s.poisoned=true;},error=>{s.lost={reason:'rejected-loss-promise',message:String(error)};s.poisoned=true;});
 live(s);progress({phase:'preflight-start',limits,shaderSha256:input.shaderSha256});
 await scopes(s,async()=>{const module=device.createShaderModule({code:input.shader,label:'1024 diagnostic mask0 only'});const info=await race(s,module.getCompilationInfo());assert.deepEqual(info.messages.filter(x=>x.type==='error'),[],'integer WGSL preflight');live(s);progress({phase:'pipeline-start'});s.pipeline=await race(s,device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}));live(s);});
 const token=Object.freeze({kind:'test-only-1024-allocation-compiled-v1'});sessions.set(token,s);progress({phase:'compiled',buffers:0,dispatches:0});return token;
}
export async function runAllocationDiagnosticWave(token,{name,signal,getIdentity,progress=()=>{}}={}){
 const s=sessions.get(token);assert.ok(s,'same-device compiled ownership');live(s);assert.equal(s.active,false,'one serial wave');assert.ok(s.input.waves.includes(name));assert.equal(typeof getIdentity,'function');s.active=true;
 const p=s.input,d=s.device,resources=[],byName=new Map(),metrics={name,profileLabel:p.profileLabel,peakLiveBuffers:0,peakLiveBytes:0,resources:p.allocations.map(a=>({bank:a.bank,name:a.name,bytes:a.bytes,usage:a.usage,created:false,destroyed:false,clearedBytes:0,writtenBytes:0,copySourceBytes:0,copyDestinationBytes:0})),buffersCreated:0,buffersDestroyed:0,allocatedBytes:0,clearCommands:0,clearBytes:0,writes:0,writeBytes:0,dispatches:0,copies:0,copyBytes:0,submissions:0,maps:0,mapBytes:0,queueDrained:false,committed:false};
 const journal=createResidentCompactTransaction({input:Uint32Array.from(p.input),banks:p.banks,identity:p.identity,getIdentity});let pending=false,cleaned=false,actualWords=null;
 const check=()=>{live(s);if(signal?.aborted)throw Object.assign(new Error('Diagnostic cancelled'),{reason:R.CANCELLED});if(!identityEqual(getIdentity(),p.identity))throw Object.assign(new Error('Diagnostic source/generation stale'),{reason:R.STALE_SOURCE});};
 const drain=async()=>{await race(s,d.queue.onSubmittedWorkDone());pending=false;metrics.queueDrained=true;};
 const cleanup=async()=>{if(cleaned)return;let error;if(pending&&!s.lost)try{await drain();}catch(e){s.poisoned=true;error=e;}for(const b of resources){try{b.unmap();}catch{}try{b.destroy();metrics.resources[resources.indexOf(b)].destroyed=true;metrics.buffersDestroyed++;}catch(e){error??=e;}}cleaned=true;if(error)throw error;};
 const buffer=(bank,name)=>byName.get(bank+':'+name);
 try{
  check();assertDiagnosticLimits(d,p);
  await scopes(s,async()=>{for(const a of p.allocations){check();let b;try{b=d.createBuffer({label:'diagnostic '+a.bank+':'+a.name,size:a.bytes,usage:a.usage});}catch(e){throw Object.assign(e,{reason:R.CAPACITY});}resources.push(b);byName.set(a.bank+':'+a.name,b);metrics.buffersCreated++;metrics.allocatedBytes+=a.bytes;metrics.resources[metrics.buffersCreated-1].created=true;metrics.peakLiveBuffers=Math.max(metrics.peakLiveBuffers,metrics.buffersCreated-metrics.buffersDestroyed);metrics.peakLiveBytes=metrics.allocatedBytes;progress({phase:'allocated',index:metrics.buffersCreated,name:a.name});}check();});
  check();assert.equal(metrics.buffersCreated,25);assert.equal(metrics.allocatedBytes,p.peakBytes);
  await scopes(s,async()=>{
   for(let bank=0;bank<2;bank++)for(const[name,words]of [['inputs',Uint32Array.from(p.input.slice(bank*8192,(bank+1)*8192))],['compactResults',Uint32Array.from(p.seeds.slice(bank*2048,(bank+1)*2048))]]){check();d.queue.writeBuffer(buffer(bank,name),0,words);pending=true;metrics.writes++;metrics.writeBytes+=words.byteLength;metrics.resources.find(a=>a.bank===bank&&a.name===name).writtenBytes+=words.byteLength;}
   progress({phase:'uploaded'});check();const encoder=d.createCommandEncoder({label:'exact historical25 resource access'});
   for(const a of p.allocations)if(a.bank!==null&&!['inputs','compactResults'].includes(a.name)){encoder.clearBuffer(buffer(a.bank,a.name),0,a.bytes);metrics.clearCommands++;metrics.clearBytes+=a.bytes;metrics.resources.find(r=>r.bank===a.bank&&r.name===a.name).clearedBytes+=a.bytes;}
   if(name!=='cancel-after-clear'){
    for(let bank=0;bank<2;bank++){const group=d.createBindGroup({layout:s.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:buffer(bank,'inputs'),offset:0,size:32768}},{binding:1,resource:{buffer:buffer(bank,'compactResults'),offset:0,size:8192}}]});const pass=encoder.beginComputePass();pass.setPipeline(s.pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(16);pass.end();metrics.dispatches++;}
    for(let bank=0;bank<2;bank++){encoder.copyBufferToBuffer(buffer(bank,'compactResults'),0,buffer(null,'compactReadback'),bank*8192,8192);metrics.copies++;metrics.copyBytes+=8192;metrics.resources.find(a=>a.bank===bank&&a.name==='compactResults').copySourceBytes+=8192;metrics.resources.find(a=>a.bank===null).copyDestinationBytes+=8192;}
   }
   check();d.queue.submit([encoder.finish()]);pending=true;metrics.submissions++;await drain();progress({phase:'drained'});check();
  });check();
  if(name==='cancel-after-clear')throw new Error('Required harness cancellation was not observed');
  await scopes(s,async()=>{const read=buffer(null,'compactReadback');await race(s,read.mapAsync(1));metrics.maps++;try{actualWords=new Uint32Array(read.getMappedRange().slice(0));metrics.mapBytes=actualWords.byteLength;}finally{read.unmap();}progress({phase:'mapped'});check();assert.equal(actualWords.byteLength,16384);});check();
  for(let bank=0;bank<2;bank++){journal.stage(journal.bankReceipts[bank],actualWords.subarray(bank*2048,(bank+1)*2048));progress({phase:'bank-staged',bank});check();}
  await cleanup();progress({phase:'cleaned'});check();const result=journal.commit();metrics.committed=true;return{result,words:actualWords,metrics};
 }catch(error){let cleanupError;try{await cleanup();}catch(e){cleanupError=e;}const reason=s.lost?R.DEVICE_LOST:error instanceof ResidentBatchProtocolError?error.reason:[R.CANCELLED,R.STALE_SOURCE,R.DEVICE_LOST,R.CAPACITY,R.INCOMPLETE_COMMIT].includes(error.reason)?error.reason:R.INCOMPLETE_COMMIT;if(![R.CANCELLED,R.STALE_SOURCE,R.CAPACITY].includes(reason))s.poisoned=true;const outcome=error instanceof ResidentBatchProtocolError?error.outcome:journal.abort(reason);throw Object.assign(new Error('Allocation diagnostic wave failed: '+error.message,{cause:error}),{reason,outcome,metrics,cleanupError});
 }finally{s.active=false;}
}
