// TEST ONLY retained native-device infrastructure. No physics implementation,
// CPU state advance, or candidate acceptance lives here. The caller retains the
// globally serialized GPU slot and releases the native owner after all runs.
import assert from 'node:assert/strict';
const TYPES=new Set(['storage','read-only-storage','uniform']);
const positive=(n,label)=>assert.ok(Number.isSafeInteger(n)&&n>0,label+' positive safe integer');
export function createRetainedNativePipelineCache(owner,{trace=()=>{}}={}){
 const device=owner.device;assert.ok(device);const entries=new Map(),modules=new Map(),stats={requests:0,coldCompiles:0,warmHits:0,inflightHits:0,failures:0,compileWallMs:0,validationRequests:0,validationCold:0,validationWarm:0,validationFailures:0};
 const descriptor=({name='native stage',code,bindingTypes,entryPoint='main'})=>{assert.equal(typeof code,'string');assert.ok(code.length);assert.ok(Array.isArray(bindingTypes)&&bindingTypes.length&&bindingTypes.every(t=>TYPES.has(t)));assert.match(entryPoint,/^[A-Za-z_]\w*$/);const types=[...bindingTypes];return{name,code,types,entryPoint,key:JSON.stringify([code,types,entryPoint])};};
 const checkedModule=async d=>{const module=device.createShaderModule({code:d.code,label:d.name}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(m=>m.type==='error').map(m=>`${m.lineNum}:${m.linePos} ${m.message}`),[],d.name+' WGSL');return module;};
 return Object.freeze({device,stats:()=>Object.freeze({...stats,entries:entries.size}),
  async validateAll(descriptors){
   // Validate the complete descriptor batch before creating even one module.
   // Parse ALL WGSL before any expensive native pipeline compilation. Exact
   // source modules are then reused on this same live device, never a failed
   // device or a different source/binding/entry identity.
   const rows=descriptors.map(descriptor);for(const d of rows){stats.validationRequests++;if(entries.has(d.key)||modules.has(d.key)){stats.validationWarm++;continue;}stats.validationCold++;trace({stage:'shader-preflight-start',name:d.name,bytes:d.code.length});try{modules.set(d.key,await checkedModule(d));trace({stage:'shader-preflight-ready',name:d.name});}catch(error){stats.validationFailures++;trace({stage:'shader-preflight-failed',name:d.name});throw error;}}
   trace({stage:'shader-preflight-complete',descriptors:rows.length,newPipelineCompiles:0});
  },
  async compile({name='native stage',code,bindingTypes,entryPoint='main'}){
   const d=descriptor({name,code,bindingTypes,entryPoint});
   // Full strings, not a lossy/hash-only identity. Names and buffer addresses
   // are deliberately absent: they cannot change a compute pipeline's meaning.
   const {types,key}=d;stats.requests++;
   const prior=entries.get(key);if(prior){stats.warmHits++;if(!prior.ready)stats.inflightHits++;trace({stage:'pipeline-cache-hit',name,ready:prior.ready});return prior.promise;}
   const row={ready:false,promise:null};stats.coldCompiles++;const started=performance.now();
   row.promise=(async()=>{
    trace({stage:'compile-start',name,bytes:code.length,cached:false});
    const groupLayout=device.createBindGroupLayout({entries:types.map((type,binding)=>({binding,visibility:4,buffer:{type}}))}),layout=device.createPipelineLayout({bindGroupLayouts:[groupLayout]}),module=modules.get(key)??await checkedModule(d);modules.delete(key);trace({stage:'pipeline-start',name});
    const pipeline=await device.createComputePipelineAsync({layout,compute:{module,entryPoint}});row.ready=true;const ms=performance.now()-started;stats.compileWallMs+=ms;trace({stage:'pipeline-ready',name,compileWallMs:ms,timingKind:'host-wall-not-gpu-timestamp',cached:false});
    return Object.freeze({pipeline,groupLayout,key,bindingTypes:Object.freeze(types),entryPoint});
   })().catch(error=>{stats.failures++;entries.delete(key);throw error;});entries.set(key,row);return row.promise;
  }
 });
}
export function nativeCacheDelta(after,before){const out={};for(const key of Object.keys(after))out[key]=after[key]-(before[key]??0);return out;}

/** Fresh GPU-zeroed allocations per independent run; pipelines alone survive.
 * Initial writes are sealed before ANY dispatch. Captures stay on device until
 * finish maps ONE diagnostic buffer after every requested continuation block.
 */
export function createOwnedNativeTestRun(owner,cache,{label='retained native run',maxCheckpoints=1,trace=()=>{}}={}){
 const device=owner.device;assert.equal(cache.device,device,'Pipeline cache belongs to this exact native device');positive(maxCheckpoints,'checkpoint count');
 const buffers=new Map(),owned=[],captures=[];let sealed=false,finished=false,disposed=false,submitted=false,readback=null,readWords=0;
 const stats={dispatches:0,submissions:0,initialWrites:0,copies:0,mappings:0,encodeWallMs:0,queueDrainWallMs:0};
 const live=()=>assert.equal(disposed,false,'Owned run already disposed'),writable=()=>{live();assert.equal(sealed,false,'Initial-only uploads are sealed');};
 const allocate=(words,usage,name,storage=true)=>{positive(words,'buffer words');assert.ok(words*4<=device.limits.maxBufferSize,name+' buffer capacity');if(storage)assert.ok(words*4<=device.limits.maxStorageBufferBindingSize,name+' binding capacity');const b=device.createBuffer({size:words*4,usage,label:name});owned.push(b);return b;};
 const get=name=>{live();assert.ok(buffers.has(name),'Known owned buffer '+name);return buffers.get(name);};
 const submitEncoder=async encoder=>{device.queue.submit([encoder.finish()]);submitted=true;stats.submissions++;const started=performance.now();await device.queue.onSubmittedWorkDone();stats.queueDrainWallMs+=performance.now()-started;};
 return Object.freeze({device,stats:()=>({...stats}),
  create(name,words,{input,usage=128|8|4}={}){writable();assert.equal(buffers.has(name),false);const row={buffer:allocate(words,usage,name),words};buffers.set(name,row);if(input!==undefined){assert.ok(input instanceof Uint32Array&&input.length<=words);device.queue.writeBuffer(row.buffer,0,new Uint32Array(input));stats.initialWrites++;}return row.buffer;},
  alias(name,other){writable();assert.equal(buffers.has(name),false);buffers.set(name,get(other));},
  writeInitial(name,offsetWords,data){writable();const row=get(name);assert.ok(Number.isSafeInteger(offsetWords)&&offsetWords>=0&&data instanceof Uint32Array&&offsetWords+data.length<=row.words);device.queue.writeBuffer(row.buffer,offsetWords*4,new Uint32Array(data));stats.initialWrites++;},
  seal(){live();assert.equal(sealed,false);sealed=true;},
  async stage(descriptor,names,workgroups){live();positive(workgroups,'workgroups');assert.equal(names.length,descriptor.bindingTypes.length);const cached=await cache.compile(descriptor),group=device.createBindGroup({layout:cached.groupLayout,entries:names.map((name,binding)=>({binding,resource:{buffer:get(name).buffer}}))});return Object.freeze({pipeline:cached.pipeline,group,workgroups});},
  async dispatch(stages,{chunkSize=1024}={}){
   live();assert.equal(sealed,true);assert.equal(finished,false,'No GPU work after final host mapping');positive(chunkSize,'fixed dispatch chunk');let encoder=null,pass=null,n=0;
   const flush=async()=>{if(!n)return;pass.end();await submitEncoder(encoder);encoder=null;pass=null;n=0;};
   for(const stage of stages){const started=performance.now();if(!pass){encoder=device.createCommandEncoder({label});pass=encoder.beginComputePass();}pass.setPipeline(stage.pipeline);pass.setBindGroup(0,stage.group);pass.dispatchWorkgroups(stage.workgroups);n++;stats.dispatches++;stats.encodeWallMs+=performance.now()-started;if(n===chunkSize)await flush();}await flush();
  },
  async capture(name,resource){live();assert.equal(sealed,true);assert.equal(finished,false);assert.ok(captures.length<maxCheckpoints,'Predeclared checkpoint capacity');assert.equal(captures.some(x=>x.name===name),false,'Unique checkpoint label');const row=get(resource);if(!readback){readWords=row.words;readback=allocate(readWords*maxCheckpoints,1|8,label+' final-only checkpoints',false);}assert.equal(row.words,readWords,'Same resident allocation at every checkpoint');const encoder=device.createCommandEncoder({label:name});encoder.copyBufferToBuffer(row.buffer,0,readback,captures.length*readWords*4,readWords*4);await submitEncoder(encoder);captures.push({name,words:readWords});stats.copies++;trace({stage:'checkpoint-copied',name,mapped:false});},
  async finish(){live();assert.equal(sealed,true);assert.equal(finished,false);assert.ok(readback,'At least one fixed GPU checkpoint required');finished=true;await readback.mapAsync(1);stats.mappings++;const words=new Uint32Array(readback.getMappedRange().slice(0));readback.unmap();return captures.map((c,i)=>({name:c.name,words:words.slice(i*readWords,(i+1)*readWords)}));},
  async dispose(){if(disposed)return;disposed=true;if(submitted)await device.queue.onSubmittedWorkDone();for(const b of owned){try{b.unmap();}catch{}b.destroy();}buffers.clear();}
 });
}
