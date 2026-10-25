'use strict';
// Exact stage-value preservation, separate from the fake-device orchestration
// suite. Reads already captured source fixtures only; never generates/decodes a
// native snapshot or invokes the native engine. Actual WGSL is opt-in.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),crypto=require('node:crypto'),Module=require('node:module'),{pathToFileURL}=require('node:url');
const file=require.resolve('../src/experimental-cue-empty-convex-cache'),E=require(file),T=require('../src/experimental-cue-convex-topology'),D=require('../tools/rapier-snapshot-decoder');
const baselinePath=process.env.EMPTY_CONVEX_PIPELINE_BASELINE_SOURCE,createdPath=process.env.CUE_EMPTY_CONVEX_CREATED_JSON??'/tmp/billiard-all-pair-created-typed.json';
const evidenceDir=process.env.CUE_EMPTY_PAIR_EVIDENCE_DIR??path.resolve(__dirname,'../../billiard-generalized-cue-input-evidence'),observedPath=path.join(evidenceDir,'yaw61-25-elevated-holdout-hull-birth.v8');
const available=!!baselinePath&&fs.existsSync(createdPath),gpuRequested=!!process.env.GPU_NATIVE_MODULE||process.env.REQUIRE_WEBGPU==='1',f=Math.fround,copy=x=>structuredClone(x);
function baseline(){
  const text=fs.readFileSync(baselinePath,'utf8');assert.equal(crypto.createHash('sha256').update(text).digest('hex'),'bc0198f2c21e5cb3e364b8419b997163a31cfb9fd91a19ad33628f93f3c9d21e');
  const m=new Module(file,module);m.filename=file;m.paths=module.paths;m.require=Module.createRequire(file);m._compile(text,file);return m.exports;
}
function hull(){const decoded=JSON.parse(fs.readFileSync(createdPath)),bits=new DataView(new ArrayBuffer(8));bits.setUint32(0,9,true);return T.exportNativeHull(decoded,bits.getFloat64(0,true),D);}
function fixture(){return{kind:'separated-convex-cylinder-empty-cache',separated:true,shapesChanged:false,convex:{translation:[0,0,0],rotation:[0,0,0,1],localTranslation:[0,0,0]},cylinder:{radius:f(.011),halfHeight:f(.615),translation:[0,2,0],rotation:[0,0,0,1],localTranslation:[0,f(-.741),0]},contactRecycleDistance:f(.003075),predictionDistance:f(.0000615),previous:null};}
function cases(){
  const sets=[{name:'birth-reuse-refresh',inputs:[0,.00001,.002].map(x=>{const s=fixture();s.cylinder.translation[0]=f(x);return s;})}];
  if(fs.existsSync(observedPath)){
    const captured=v8.deserialize(fs.readFileSync(observedPath));assert.equal(captured.identity.schema,'original-cue-single-hull-birth-boundary-v1');assert.equal(captured.identity.native.sourceRevision,D.SOURCE_REVISION);
    assert.deepEqual(captured.observations.map(o=>o.h),[409,410,411]);
    sets.push({name:'captured-h410-birth-h411-reuse',inputs:captured.observations.slice(0,2).map(o=>{
      const raw=o.raw,a=raw.colliders.find(c=>c.handle.index===9),b=raw.colliders.find(c=>c.handle.index===22),pose=raw.bodies.shaft.pos.position;
      return{kind:'separated-convex-cylinder-empty-cache',separated:true,shapesChanged:false,convex:{translation:copy(a.pos.translation),rotation:copy(a.pos.rotation),localTranslation:copy(a.parent.pos_wrt_parent.translation)},cylinder:{radius:b.shape.value.radius,halfHeight:b.shape.value.half_height,translation:copy(pose.translation),rotation:copy(pose.rotation),localTranslation:copy(b.parent.pos_wrt_parent.translation)},contactRecycleDistance:f(raw.integration.normalized_contact_recycle_distance*raw.integration.length_unit),predictionDistance:f(raw.integration.normalized_prediction_distance*raw.integration.length_unit),previous:null};
    })});
  }
  return sets;
}
function numeric(value){const result=copy(value);delete result.backend;delete result.actualDispatches;return result;}
async function compare(stages,t){
  const records=[];
  for(const set of cases()){
    const previous=stages.map(()=>null);
    for(let i=0;i<set.inputs.length;i++){
      const outputs=[];
      for(let j=0;j<stages.length;j++){
        const out=await stages[j].step({...copy(set.inputs[i]),previous:previous[j]});
        if(j)assert.deepEqual(numeric(out),numeric(outputs[0]),set.name+' '+i+' stage '+j);
        assert.equal(out.actualDispatches,out.backend==='webgpu'?(out.recycled?1:259):0);
        outputs.push(out);previous[j]=out;
      }
      records.push({case:set.name,index:i,recycled:outputs[0].recycled,value:numeric(outputs[0])});
    }
  }
  const summary={caseCount:records.length,recycled:records.map(r=>r.recycled),numericSha256:crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex')};
  t.diagnostic(JSON.stringify(summary));return summary;
}

test('exact fixed CPU values match frozen source before/after the compile-cache-only change',{skip:!available},async t=>{
  const old=baseline(),h=hull(),before=old.createReferenceStage({hull:h}),after=E.createReferenceStage({hull:h});
  try{await compare([before,after],t);}finally{before.dispose();after.dispose();}
});

test('actual fixed WGSL values match frozen WGSL and both CPU stages with two shared-pipeline stage instances',{skip:!available||!gpuRequested,timeout:120000},async t=>{
  assert.ok(process.env.GPU_NATIVE_MODULE,'GPU_NATIVE_MODULE is required for an actual WGSL conformance run');
  const{create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
  const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter,'Actual WebGPU adapter required');
  const raw=await adapter.requestDevice(),counts={modules:0,pipelines:0};
  // A test-owned facade is the exact cache key. Do not unwrap any service or
  // renderer device; this fresh device is used only by this conformance test.
  const device=new Proxy(raw,{get(target,key){const value=Reflect.get(target,key,target);if(key==='createShaderModule')return(...args)=>{counts.modules++;return value.apply(target,args);};if(key==='createComputePipelineAsync')return(...args)=>{counts.pipelines++;return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});
  const old=baseline(),h=hull(),cpuOld=old.createReferenceStage({hull:h}),cpuNew=E.createReferenceStage({hull:h});let before,afterA,afterB;
  try{
    before=await old.createGpuStage(device,{hull:h});assert.deepEqual(counts,{modules:4,pipelines:4});
    [afterA,afterB]=await Promise.all([E.createGpuStage(device,{hull:h}),E.createGpuStage(device,{hull:h})]);
    assert.deepEqual(counts,{modules:8,pipelines:8},'Two new stages add exactly four actual compilations, not eight');
    await compare([cpuOld,cpuNew,before,afterA,afterB],t);t.diagnostic(JSON.stringify({actualCompileRequests:counts,instances:3}));
  }finally{before?.dispose();afterA?.dispose();afterB?.dispose();cpuOld.dispose();cpuNew.dispose();raw.destroy();}
});
