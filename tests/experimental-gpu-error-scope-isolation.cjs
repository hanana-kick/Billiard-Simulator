'use strict';
// Host tests model the device-global LIFO stack, not WGSL or GPU performance.
// The optional native gate below dispatches the unchanged free-body shader.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const Free=require('../src/experimental-free-body');
const Graph=require('../src/experimental-arithmetic-graph');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function initial(offset=0){return{
  kind:'isolated-dynamic-sphere',phase:'post-activation-pre-solve',bodyCount:1,contactCount:0,jointCount:0,
  ccdEnabled:false,sleeping:false,canSleep:false,lockedAxes:0,
  body:{linear:[.25,0,-.125],angular:[0,.5,0],translation:[offset,1,0],rotation:[0,0,0,1],localCom:[0,0,0],invMass:[1,1,1],invInertia:[1,0,0,0,1,0,0,0,1],principalFrame:[0,0,0,1],principalInertia:[1,1,1],invPrincipalInertia:[1,1,1]},
  parameters:{substeps:1,dt:1/64,lengthUnit:1,gravity:[0,0,0],userForce:[0,0,0],userTorque:[0,0,0],gravityScale:1,linearDamping:0,angularDamping:0,normalizedMaxLinearVelocity:Math.fround(3.4028234663852886e38),allowFastRotation:false,gyroscopic:true},
};}
function sharedDevice(){
  const stack=[],scopes=[],buffers=[],controls=new Map(),events=[];
  let caller;
  const control=name=>{if(!controls.has(name))controls.set(name,{});return controls.get(name);};
  function fault(name,owner=caller){const c=control(owner);if(c[name]){delete c[name];throw Error(owner+':'+name);}}
  class NativeLikeBuffer{
    constructor(d,owner){this.bytes=new ArrayBuffer(d.size);this.owner=owner;this.usage=d.usage;this.destroyed=false;this.mapped=false;buffers.push(this);}
    mapAsync(){
      fault('mapSyncError',this.owner);const c=control(this.owner),scope=stack.at(-1);
      assert.equal(scope?.owner,this.owner,'mapAsync validation must be issued inside its own scope');
      events.push(['map',this.owner]);if(c.mapValidation){scope.error={message:this.owner+':mapValidation'};delete c.mapValidation;}
      this.mapping=deferred();scope.mapping=this.mapping;scope.read=this;
      if(c.mapReject){delete c.mapReject;this.mapping.reject(Error(this.owner+':mapReject'));}
      return this.mapping.promise.then(()=>{this.mapped=true;});
    }
    getMappedRange(){fault('rangeError',this.owner);assert.equal(this.mapped,true);return this.bytes;}
    unmap(){fault('unmapError',this.owner);this.mapped=false;}
    destroy(){this.destroyed=true;this.mapped=false;}
  }
  class NativeLikeDevice{
    createShaderModule({code}){assert.equal(this,device);return{code,async getCompilationInfo(){return{messages:[]};}};}
    async createComputePipelineAsync({compute}){assert.equal(this,device);return{code:compute.module.code,getBindGroupLayout(){return{};}};}
    createBuffer(d){assert.equal(this,device);fault('createError');return new NativeLikeBuffer(d,caller);}
    createBindGroup(d){assert.equal(this,device);fault('groupError');return d;}
    pushErrorScope(filter){assert.equal(this,device);assert.equal(filter,'validation');const scope={owner:caller,error:null,result:deferred()};stack.push(scope);scopes.push(scope);events.push(['push',caller]);}
    popErrorScope(){
      assert.equal(this,device);const scope=stack.pop();assert.ok(scope,'No other operation may consume this scope');events.push(['pop',caller,scope.owner]);
      const c=control(scope.owner);if(c.popSyncError){delete c.popSyncError;throw Error(scope.owner+':popSyncError');}if(c.scopeReject){delete c.scopeReject;scope.result.reject(Error(scope.owner+':scopeReject'));}
      else scope.result.resolve(scope.error);
      return scope.result.promise;
    }
    createCommandEncoder(){
      assert.equal(this,device);fault('encoderError');const commands=[];return{
        beginComputePass(){let pipeline,group;return{
          setPipeline(p){pipeline=p;},setBindGroup(_,g){group=g;},dispatchWorkgroups(){},end(){commands.push(()=>{
            if(control(caller).skipCompute)return;
            const b=group.entries.map(e=>e.resource.buffer),words=new Uint32Array(b[1].bytes),nodes=[];
            for(let i=0;i<words.length;i+=4){const op=Graph.OPERATIONS[words[i]],args=op.name==='const'?[new Float32Array(Uint32Array.of(words[i+1]).buffer)[0]]:Array.from(words.slice(i+1,i+1+op.arity));nodes.push({kind:op.name,args});}
            const inputFloats=Number(pipeline.code.match(/let count=arrayLength\(&inputs\)\/(\d+)u/)[1]);
            const plan={inputFloats,nodes,outputs:Array.from(new Uint32Array(b[3].bytes))},input=new Float32Array(b[0].bytes),out=new Float32Array(b[4].bytes);
            for(let i=0;i<input.length/inputFloats;i++)out.set([...Graph.execute(input.slice(i*inputFloats,(i+1)*inputFloats),plan),1],i*(plan.outputs.length+1));
          });},
        };},
        copyBufferToBuffer(a,from,b,to,size){commands.push(()=>new Uint8Array(b.bytes,to,size).set(new Uint8Array(a.bytes,from,size)));},
        finish(){return commands;},
      };
    }
  }
  const device=new NativeLikeDevice();
  device.queue={
    writeBuffer(buffer,offset,a){assert.equal(this,device.queue);fault('writeError');new Uint8Array(buffer.bytes,offset,a.byteLength).set(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));},
    submit(lists){assert.equal(this,device.queue);fault('submitError');const c=control(caller);if(c.validation){stack.at(-1).error={message:caller+':validation'};delete c.validation;}for(const commands of lists)for(const run of commands)run();},
  };
  function facade(name){
    const result={};for(const method of Object.getOwnPropertyNames(NativeLikeDevice.prototype).filter(x=>x!=='constructor'))result[method]=(...args)=>{caller=name;return device[method](...args);};
    result.queue={};for(const method of ['writeBuffer','submit'])result.queue[method]=(...args)=>{caller=name;return device.queue[method](...args);};return result;
  }
  return{device,facade,control,stack,scopes,buffers,events,
    finish(name){const scope=scopes.find(s=>s.owner===name&&s.mapping&&!s.finished);assert.ok(scope,'Pending owner mapping');scope.finished=true;scope.mapping.resolve();},
    allDestroyed(){assert.ok(buffers.every(b=>b.destroyed));assert.equal(stack.length,0);},
  };
}
async function stages(f){return Promise.all(['a','b'].map(name=>Free.createGpuSolver(f.facade(name))));}
function expected(input){const result=Free.stepReference(input);return{...result,backend:'webgpu'};}

const LEGACY=[
  'angular-patch','convex-point','cue-cloth-joint-stepper','cue-created-stroke-stage','cue-empty-convex-cache',
  'cue-empty-pair-cache','cue-initialization','cue-joint-compliance','cue-joint-stepper','cue-joint-tip-contact',
  'cue-joint','cue-lateral-compensated','cue-obstacle-contact','cue-obstacle-manifold','cue-rigid-exclusion',
  'cue-stroke-stage','free-body','sleep-activation',
];
test('all 19 legacy operation scopes close before their first async yield without losing checks',()=>{
  const directory=path.join(__dirname,'../src');
  const found=fs.readdirSync(directory).filter(file=>/^experimental-.*\.js$/.test(file)&&fs.readFileSync(path.join(directory,file),'utf8').includes('pushErrorScope')).sort();
  assert.deepEqual(found,[...LEGACY.map(name=>'experimental-'+name+'.js'),'experimental-stage-runtime.js'].sort());
  let count=0;
  for(const name of LEGACY){
    const source=fs.readFileSync(path.join(directory,'experimental-'+name+'.js'),'utf8');
    const scopes=source.split("device.pushErrorScope('validation');").slice(1);assert.equal(scopes.length,name==='cue-empty-convex-cache'?2:1);
    for(const operation of scopes){
      count++;const body=operation.slice(0,operation.indexOf('}finally{'));
      const map=body.indexOf('read.mapAsync(1)'),pop=body.indexOf('device.popErrorScope()'),firstYield=body.search(/\bawait\b/);
      assert.ok(map>=0&&map<pop&&pop<firstYield,name+': map and pop must both precede first await');
      assert.match(body,/mapping\.catch\(\(\)=>\{\}\)/,name+': mapping rejection is handled if pop throws');
      assert.match(body,/pendingScope\.catch\(\(\)=>\{\}\)/,name+': scope rejection is handled while mapping is pending or fails');
      assert.match(body,/await mapping;.*const (error|err)=await pendingScope;if\(\1\)throw Error\(\1\.message\)/s,name+': original validation error remains checked');
      assert.match(operation,/finally\{[^}]*if\(scoped\)await device\.popErrorScope\(\)/,name+': synchronous setup/map failure retains finally pop');
    }
  }
  assert.equal(count,19);
});

test('overlapping owners retain their own validation result in either map completion order',async()=>{
  for(const invalid of ['a','b'])for(const first of ['a','b']){
    const f=sharedDevice(),[a,b]=await stages(f),inputs={a:initial(),b:initial(2)};
    f.control(invalid).validation=true;
    const pa=a.step(inputs.a),pb=b.step(inputs.b),settled=Promise.allSettled([pa,pb]);
    assert.equal(f.stack.length,0,'No scope remains open while either map is pending');
    assert.deepEqual(f.events,[['push','a'],['map','a'],['pop','a','a'],['push','b'],['map','b'],['pop','b','b']]);
    f.finish(first);await turn();f.finish(first==='a'?'b':'a');const results=await settled;
    for(const [i,name] of ['a','b'].entries())if(name===invalid){assert.equal(results[i].status,'rejected');assert.equal(results[i].reason.message,name+':validation');}else{assert.equal(results[i].status,'fulfilled');assert.deepEqual(results[i].value,expected(inputs[name]));}
    a.dispose();b.dispose();f.allDestroyed();
  }
});

test('map-time validation is captured before pop, not accidentally left uncaptured',async()=>{
  const f=sharedDevice(),[a,b]=await stages(f);f.control('a').mapValidation=true;
  const pa=a.step(initial()),pb=b.step(initial(2)),settled=Promise.allSettled([pa,pb]);f.finish('b');f.finish('a');
  const results=await settled;assert.equal(results[0].reason.message,'a:mapValidation');assert.deepEqual(results[1].value,expected(initial(2)));
  a.dispose();b.dispose();f.allDestroyed();
});

test('synchronous setup and mapping failures close only their own scope and release the stage for retry',async()=>{
  for(const failure of ['createError','writeError','groupError','encoderError','submitError','mapSyncError']){
    const f=sharedDevice(),[a,b]=await stages(f);f.control('a')[failure]=true;
    const pa=a.step(initial()),pb=b.step(initial(2)),settled=Promise.allSettled([pa,pb]);
    assert.equal(f.stack.length,0,failure);f.finish('b');const results=await settled;
    assert.equal(results[0].reason.message,'a:'+failure);assert.deepEqual(results[1].value,expected(initial(2)));
    const retry=a.step(initial());assert.equal(f.stack.length,0);f.finish('a');assert.deepEqual(await retry,expected(initial()));
    a.dispose();b.dispose();f.allDestroyed();
  }
});

test('an unexpected throw after synchronous pop cannot trigger a second pop of an outer scope',async()=>{
  const f=sharedDevice(),[a,b]=await stages(f),outer=f.facade('outer');outer.pushErrorScope('validation');
  f.control('a').popSyncError=true;
  const pa=a.step(initial()),pb=b.step(initial(2)),settled=Promise.allSettled([pa,pb]);
  assert.deepEqual(f.stack.map(scope=>scope.owner),['outer']);
  assert.deepEqual(f.events.filter(event=>event[0]==='pop'),[['pop','a','a'],['pop','b','b']]);
  // mapAsync already returned a promise before pop failed. A later rejection
  // must stay handled even though this operation cannot await it anymore.
  f.scopes.find(scope=>scope.owner==='a').mapping.reject(Error('a:lateMapFailure'));await turn();f.finish('b');
  const results=await settled;assert.equal(results[0].reason.message,'a:popSyncError');assert.deepEqual(results[1].value,expected(initial(2)));
  assert.equal(await outer.popErrorScope(),null);a.dispose();b.dispose();f.allDestroyed();
});

test('scope rejection is handled during a held map and mapping failure preserves its original error',async()=>{
  for(const mapReject of [false,true]){
    const f=sharedDevice(),[a,b]=await stages(f);Object.assign(f.control('a'),{scopeReject:true,mapReject});
    const pa=a.step(initial()),pb=b.step(initial(2)),settled=Promise.allSettled([pa,pb]);
    await turn();assert.equal(f.stack.length,0);f.finish('b');if(!mapReject)f.finish('a');const results=await settled;
    assert.equal(results[0].reason.message,'a:'+(mapReject?'mapReject':'scopeReject'));assert.deepEqual(results[1].value,expected(initial(2)));
    a.dispose();b.dispose();f.allDestroyed();
  }
});

test('mapped range, unmap, incomplete-output and validation failures keep cleanup and busy release',async()=>{
  for(const failure of ['rangeError','unmapError','skipCompute','validation']){
    const f=sharedDevice(),[a,b]=await stages(f);f.control('a')[failure]=true;
    const pa=a.step(initial()),pb=b.step(initial(2)),settled=Promise.allSettled([pa,pb]);f.finish('a');f.finish('b');const results=await settled;
    assert.equal(results[0].status,'rejected');assert.match(results[0].reason.message,failure==='skipCompute'?/incomplete/:new RegExp(failure));assert.deepEqual(results[1].value,expected(initial(2)));
    delete f.control('a').skipCompute;const retry=a.step(initial());f.finish('a');assert.deepEqual(await retry,expected(initial()));
    a.dispose();b.dispose();f.allDestroyed();
  }
});

test('actual GPU owner facades overlap without sharing validation errors or changing native methods',{
  skip:!process.env.GPU_NATIVE_MODULE&&process.env.REQUIRE_WEBGPU!=='1',timeout:120000,
},async()=>{
  assert.ok(process.env.GPU_NATIVE_MODULE,'GPU_NATIVE_MODULE must identify the native WebGPU module');
  const {create}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href),gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);
  const device=await adapter.requestDevice(),uncaptured=[],nativeMethods=new Map();
  device.addEventListener('uncapturederror',event=>uncaptured.push(event.error.message));
  let depth=0;const faults={};
  function facade(name){
    const f={queue:device.queue};
    for(const method of ['createShaderModule','createComputePipelineAsync','createBuffer','createBindGroup','createCommandEncoder']){nativeMethods.set(method,device[method]);f[method]=device[method].bind(device);}
    f.pushErrorScope=filter=>{device.pushErrorScope(filter);depth++;if(faults[name]){delete faults[name];device.createBuffer({size:4,usage:0,label:'scope-isolation-'+name}).destroy();}};
    f.popErrorScope=()=>{depth--;return device.popErrorScope();};return f;
  }
  let a,b;try{
    [a,b]=await Promise.all([Free.createGpuSolver(facade('a')),Free.createGpuSolver(facade('b'))]);
    for(const invalid of ['a','b']){
      faults[invalid]=true;const pa=a.step(initial()),pb=b.step(initial(2));assert.equal(depth,0,'Both native operations popped before returning pending promises');
      const results=await Promise.allSettled([pa,pb]);for(const [i,name]of ['a','b'].entries())if(name===invalid)assert.equal(results[i].status,'rejected');else{assert.equal(results[i].status,'fulfilled');assert.deepEqual(results[i].value,expected(initial(name==='a'?0:2)));}
    }
    const results=await Promise.all([a.step(initial()),b.step(initial(2))]);results.forEach((value,i)=>assert.deepEqual(value,expected(initial(i*2))));
    for(const [name,method]of nativeMethods)assert.equal(device[name],method,'Native '+name+' was not patched');
    await turn();assert.deepEqual(uncaptured,[]);
  }finally{a?.dispose();b?.dispose();device.destroy();}
});
