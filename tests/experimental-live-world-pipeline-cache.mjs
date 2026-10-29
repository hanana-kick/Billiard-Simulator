import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLiveWorldPipeline as compile} from '../src/direct-candidate/experimental-live-world-pipeline-cache.mjs';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
function fake() {
 const loss=deferred(), counts={modules:0,infos:0,layouts:0,pipelines:0};
 let syntax=false,fail=false,infoWait=null,compileWait=null;
 const device={lost:loss.promise,
  createShaderModule(d){counts.modules++;return {d,async getCompilationInfo(){counts.infos++;if(infoWait)await infoWait;return {messages:syntax?[{type:'error',message:'syntax'}]:[]};}};},
  createBindGroupLayout(d){return {d};},createPipelineLayout(d){counts.layouts++;return {d};},
  async createComputePipelineAsync(d){counts.pipelines++;if(compileWait)await compileWait;if(fail)throw Error('compile failed');return {d};}
 };
 return {device,counts,loss,syntax:x=>syntax=x,fail:x=>fail=x,infoWait:x=>infoWait=x,compileWait:x=>compileWait=x};
}
const layout=(type='storage')=>({bindGroupLayouts:[{entries:[{binding:0,visibility:4,buffer:{type}}]}]});
test('exact source and owned layout reuse native pipeline without new allocation; descriptor snapshot',async()=>{
 const f=fake(),d=layout(),first=await compile(f.device,{code:'A',layout:d,label:'a'});
 assert.equal(await compile(f.device,{code:'A',layout:layout(),label:'b'}),first);
 assert.deepEqual(f.counts,{modules:1,infos:1,layouts:1,pipelines:1});
 for(const x of [{code:'A ' ,layout:layout()},{code:'A',layout:layout('read-only-storage')},{code:'A',layout:'auto'},{code:'A',layout:'auto',preflight:false}])await compile(f.device,x);
 assert.equal(f.counts.pipelines,5);
 const other=fake();assert.notEqual(await compile(other.device,{code:'A',layout:d}),first);assert.equal(other.counts.pipelines,1);
 const wait=deferred();f.infoWait(wait.promise);const input=layout(),p=compile(f.device,{code:'snapshot',layout:input});input.bindGroupLayouts[0].entries[0].buffer.type='uniform';wait.resolve();
 assert.equal((await p).d.layout.d.bindGroupLayouts[0].d.entries[0].buffer.type,'storage');
});
test('failed preflight and pipeline are never cached; retry succeeds',async()=>{
 const f=fake();f.syntax(true);await assert.rejects(compile(f.device,{code:'A'}),/syntax/);assert.equal(f.counts.pipelines,0);
 f.syntax(false);f.fail(true);await assert.rejects(compile(f.device,{code:'A'}),/compile failed/);
 f.fail(false);const p=await compile(f.device,{code:'A'});assert.equal(await compile(f.device,{code:'A'}),p);assert.equal(f.counts.modules,3);
});
test('cancel preflight skips pipeline; canceled pipeline does not populate restart cache',async()=>{
 const f=fake(),a=new AbortController(),wait=deferred();f.infoWait(wait.promise);
 const p=compile(f.device,{code:'A',signal:a.signal});a.abort();wait.resolve();await assert.rejects(p,{name:'AbortError'});assert.equal(f.counts.pipelines,0);
 f.infoWait(null);const hold=deferred();f.compileWait(hold.promise);const b=new AbortController(),q=compile(f.device,{code:'A',signal:b.signal});await Promise.resolve();await Promise.resolve();b.abort();hold.resolve();await assert.rejects(q,{name:'AbortError'});
 f.compileWait(null);await compile(f.device,{code:'A'});assert.equal(f.counts.modules,3);
 const c=new AbortController();c.abort();await assert.rejects(compile(f.device,{code:'A',signal:c.signal}),{name:'AbortError'});assert.equal(f.counts.modules,3);
});
test('device loss evicts hits, rejects pending work and ignores late native success',async()=>{
 const f=fake();await compile(f.device,{code:'cached'});const hold=deferred();f.compileWait(hold.promise);
 const p=compile(f.device,{code:'pending'}),rejected=assert.rejects(p,/device lost/);await Promise.resolve();await Promise.resolve();f.loss.resolve({message:'gone'});await rejected;
 hold.resolve();await Promise.resolve();await assert.rejects(compile(f.device,{code:'cached'}),/device lost/);await assert.rejects(compile(f.device,{code:'pending'}),/device lost/);
 assert.equal(f.counts.pipelines,2);
});
test('bounded completed LRU evicts oldest and refreshes hits',async()=>{
 const f=fake();for(let i=0;i<128;i++)await compile(f.device,{code:String(i)});
 await compile(f.device,{code:'0'});await compile(f.device,{code:'128'});await compile(f.device,{code:'0'});assert.equal(f.counts.pipelines,129);
 await compile(f.device,{code:'1'});assert.equal(f.counts.pipelines,130);
});
test('unsafe layout values reject rather than alias JSON keys',async()=>{
 const f=fake();for(const value of [undefined,NaN,-0,()=>{},Symbol('x')])await assert.rejects(compile(f.device,{code:'A',layout:{bindGroupLayouts:[{value}]}}),TypeError);
 assert.equal(f.counts.modules,0);
});

test('oversized exact source keys bypass retention without evicting small entries',async()=>{
 const f=fake(),small=await compile(f.device,{code:'small'}),code='x'.repeat(17*1024*1024);
 await compile(f.device,{code});await compile(f.device,{code});
 assert.equal(await compile(f.device,{code:'small'}),small);assert.equal(f.counts.pipelines,3);
});
test('opaque preflight receipts reuse only exact same-device checked modules',async()=>{
 const {prepareLiveWorldShader}=await import('../src/direct-candidate/experimental-live-world-pipeline-cache.mjs');
 const f=fake(),receipt=await prepareLiveWorldShader(f.device,{code:'checked'});
 await compile(f.device,{code:'checked',preflightShader:receipt});
 assert.deepEqual(f.counts,{modules:1,infos:1,layouts:0,pipelines:1});
 for(const options of [{code:'changed',preflightShader:receipt},{code:'checked',preflightShader:{}},{code:'checked',preflightShader:receipt,preflight:false}])await assert.rejects(compile(f.device,options),/receipt/);
 await assert.rejects(compile(fake().device,{code:'checked',preflightShader:receipt}),/receipt/);
 assert.equal(f.counts.modules,1);
});
test('concurrent cancellation does not poison independent caller or its completed cache',async()=>{
 const f=fake(),hold=deferred(),cancel=new AbortController();f.compileWait(hold.promise);
 const a=compile(f.device,{code:'shared',signal:cancel.signal}),b=compile(f.device,{code:'shared'});
 const rejected=assert.rejects(a,{name:'AbortError'});while(f.counts.pipelines<2)await new Promise(r=>setImmediate(r));cancel.abort();hold.resolve();
 await rejected;const good=await b;assert.equal(await compile(f.device,{code:'shared'}),good);assert.equal(f.counts.pipelines,2);
});


test('loss diagnostics preserve native reason and exact asynchronous compilation phase without shader source',async()=>{
 for(const stage of ['shader-info','pipeline-create']){
  const f=fake(),hold=deferred();if(stage==='shader-info')f.infoWait(hold.promise);else f.compileWait(hold.promise);
  const preparing=compile(f.device,{code:'secret WGSL source',label:'world-N3-7',entryPoint:'main'});
  const rejected=assert.rejects(preparing,error=>{
   assert.match(error.message,/A valid external Instance reference no longer exists/);assert.match(error.message,/reason=unknown/);
   assert.equal(error.cause.message,'Live pipeline cache device lost: A valid external Instance reference no longer exists.');
   assert.deepEqual(error.deviceLoss,{reason:'unknown',message:'A valid external Instance reference no longer exists.'});
   assert.equal(error.gpuPreparation.stage,stage);assert.equal(error.gpuPreparation.label,'world-N3-7');assert.equal(error.gpuPreparation.entryPoint,'main');assert.equal(error.gpuPreparation.shaderBytes,18);
   assert.ok(error.gpuPreparation.elapsedMs>=0);assert.ok(Object.isFrozen(error.gpuPreparation));assert.ok(!JSON.stringify(error.gpuPreparation).includes('secret'));return true;
  });
  await new Promise(resolve=>setImmediate(resolve));f.loss.resolve({reason:'unknown',message:'A valid external Instance reference no longer exists.'});await rejected;hold.resolve();
 }
});

test('abort releases unresolved shader/pipeline waiter promptly and late native completion never caches',async()=>{
 for(const phase of ['info','pipeline']){
  const f=fake(),hold=deferred(),a=new AbortController();if(phase==='info')f.infoWait(hold.promise);else f.compileWait(hold.promise);
  const p=compile(f.device,{code:'screen-off',signal:a.signal});await new Promise(r=>setImmediate(r));a.abort('screen hidden');
  await Promise.race([assert.rejects(p,{name:'AbortError'}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Cancellation waited for native compilation')),1000))]);
  assert.equal(f.counts.pipelines,phase==='info'?0:1);
  hold.resolve();await new Promise(r=>setImmediate(r));f.infoWait(null);f.compileWait(null);await compile(f.device,{code:'screen-off'});
  assert.equal(f.counts.modules,2);
 }
});
