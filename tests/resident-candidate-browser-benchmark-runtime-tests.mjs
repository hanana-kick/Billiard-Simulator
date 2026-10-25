// Transport mocks ONLY. No WebGPU adapter, shader evaluation, physical result,
// hardware performance, or numerical acceptance is obtained by these tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runResidentBrowserBenchmark} from './resident-candidate-browser-benchmark-runtime.mjs';
import {PORTABLE_RUNTIME_CONTRACT,assertDecodedPortableRuntime} from './resident-candidate-portable-payload.mjs';

const code = name => `// MOCK TRANSPORT ${name}\n@compute @workgroup_size(1) fn main() {}`;
function fixture() {
  const bindingTypes = ['storage','read-only-storage','read-only-storage','storage','read-only-storage'];
  const stages = Object.fromEntries(Array.from({length:19},(_,i) => {
    const name = i===18 ? 'creation-finish' : `initial-${i}`;
    return [name,{name,code:code(name),bindingTypes:['storage'],resources:['worldState'],workgroups:6}];
  }));
  const commands = Object.keys(stages).map((stage,i) => ({stage,repeat:i===0 ? 68295 : 1}));
  const program = Uint32Array.of(9,7), input = new Uint32Array(96), bytes = new DataView(input.buffer);
  const rawRows = [
    [17,0,8,2,0,0],[118,23,37,1.7,.2,-.1],[219,310,85,4.5,.2,-.1],
    [320,180,37,.5,-.3,.15],[421,180,8,2,0,0],[522,9,8,0,0,0],
  ].map(([id,...params],i) => {bytes.setUint32(i*64,id,true);params.forEach((n,j) => bytes.setFloat64(i*64+8+j*8,n,true));return{id,settings:Object.fromEntries(['angle','elevation','speed','tipX','tipY'].map((k,j)=>[k,params[j]]))};});
  return {
    kind:'resident-raw-pc-initial-only-runtime-v1',count:6,frames:2,sweeps:2048,sourceMode:'owners',dispatches:101082,transport:{},
    identity:{sourceHead:'mock',sourceHashes:{},sourceArtifactSha256:'a'.repeat(64),preStrikeIdentity:'b'.repeat(64),sourceIdentity:'c'.repeat(64),rawRows,rawInputSha256:'d'.repeat(64),programSha256:'e'.repeat(64),sharedGeometrySha256:'f'.repeat(64),rule:{},frames:2,count:6,options:{},sourceCaps:{...PORTABLE_RUNTIME_CONTRACT.sourceCaps},pipelineIdentity:{},generationIdentity:'0'.repeat(64)},
    init:{resources:{inputs:96,rawState:12,rawProgram:Uint32Array.of(1),rawGeometry:Uint32Array.of(2),rawScratch:24,worldState:52,worldTemplate:new Uint32Array(8),worldProgram:Uint32Array.of(9),numericScratch:24},scratchAlias:{words:24},stages,commands,dispatches:68313,hostReadbacksBeforeH:0,initialUploads:[{resource:'worldState',offsetWords:48,data:Uint32Array.of(4,5,6,7)}]},
    pc:{count:6,maxH:2,stateWords:8,programBase:1,bytecode:Uint32Array.of(7),controlTailBase:52,controlWords:80,totalStateWords:676,controlPartition:'source-closures-v1',controlVisitPolicy:'single-call',bindingTypes,begin:{name:'begin',code:code('begin')},pipelines:Array.from({length:16},(_,i)=>({name:`owner-${i}`,code:code(`owner-${i}`),receiptPolicy:'guarded'})),sweep:Array.from({length:16},(_,i)=>i)},
    program,input,sharedGeometry:Uint32Array.of(10),
  };
}
function mock({timestamps=false,badModule=null,failPipeline=false,smallCapacity=false,onPreflight,uniquePipelines=36}={}) {
  const log = [], counts = {dispatches:0,compiles:0,modules:0,creates:0,destroys:0,writes:0,submits:0,maps:0,resolves:0,queries:0};
  let clock=100n;
  const device = {
    features:new Set(timestamps?['timestamp-query']:[]),limits:{maxBufferSize:smallCapacity?100:2**25,maxStorageBufferBindingSize:smallCapacity?100:2**25,maxComputeWorkgroupsPerDimension:65535},
    pushErrorScope(){log.push(['scope']);},async popErrorScope(){return null;},
    createShaderModule(d){counts.modules++;log.push(['module',d.label]);onPreflight?.();return{...d,async getCompilationInfo(){return{messages:d.label===badModule?[{type:'error',lineNum:1,linePos:1,message:'mock parse error'}]:[]};}};},
    createBindGroupLayout:x=>x,createPipelineLayout:x=>x,createBindGroup:x=>x,
    async createComputePipelineAsync(d){counts.compiles++;log.push(['compile',d.compute.module.label]);assert.equal(counts.modules,uniquePipelines,'ALL unchanged modules must preflight before first pipeline');if(failPipeline)throw Error('mock pipeline failure');return d;},
    createBuffer({size,label}){counts.creates++;const data=new Uint8Array(size);log.push(['allocate',label,data]);return{label,data,async mapAsync(){counts.maps++;log.push(['map',label,counts.dispatches]);assert.equal(counts.dispatches%101082,0,'no intermediate map');},getMappedRange(){return data.buffer;},unmap(){},destroy(){counts.destroys++;}};},
    createQuerySet({type,count}){assert.equal(type,'timestamp');assert.equal(count,198);counts.queries++;return{values:new BigUint64Array(count),destroy(){log.push(['query-destroy']);}};},
    createCommandEncoder(){const operations=[];return{
      beginComputePass(options={}){let current,dispatches=0,first,last;const ts=options.timestampWrites;if(ts)operations.push(()=>{ts.querySet.values[ts.beginningOfPassWriteIndex]=clock;clock+=1000n;});return{
        setPipeline(p){current=p;},setBindGroup(){},dispatchWorkgroups(n){assert.equal(n,6);dispatches++;first??=current.compute.module.label;last=current.compute.module.label;},
        end(){operations.push(()=>{counts.dispatches+=dispatches;log.push(['pass',dispatches,first,last]);});if(ts)operations.push(()=>{ts.querySet.values[ts.endOfPassWriteIndex]=clock;clock+=7n;});},
      };},
      copyBufferToBuffer(a,ao,b,bo,n){operations.push(()=>{b.data.set(a.data.subarray(ao,ao+n),bo);log.push(['copy',a.label,b.label]);});},
      resolveQuerySet(q,start,count,b,offset){operations.push(()=>{counts.resolves++;b.data.set(new Uint8Array(q.values.buffer,start*8,count*8),offset);});},
      finish(){log.push(['finish']);return operations;},
    };},
    queue:{writeBuffer(b,o,v){counts.writes++;b.data.set(new Uint8Array(v.buffer,v.byteOffset,v.byteLength),o);log.push(['write',b.label]);},submit(commands){counts.submits++;for(const c of commands)for(const f of c)f();},async onSubmittedWorkDone(){log.push(['drain']);}},
  };
  return {device,log,counts};
}
const finiteTimes = m => {
  for(const k of ['allocationWallMs','uploadWallMs','uploadDrainWallMs','bindGroupWallMs','endToEndWallMs','validationWallMs'])assert.ok(Number.isFinite(m[k])&&m[k]>=0,k);
  for(const g of ['initialize','pump','readback'])for(const k of ['wallMs','encodeWallMs','submitWallMs','queueDrainWallMs'])assert.ok(Number.isFinite(m[g][k])&&m[g][k]>=0,`${g}.${k}`);
};

test('browser runtime is pure ESM and preserves exact six-row transport with cold then fresh-buffer warm repeats',async()=>{
  const source=readFileSync(new URL('./resident-candidate-browser-benchmark-runtime.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/from ['"]node:|require\(|fetch\(|requestAdapter\(|requestDevice\(/);
  const runtime=fixture();assertDecodedPortableRuntime(runtime);const before=structuredClone(runtime),m=mock(),result=await runResidentBrowserBenchmark({device:m.device,runtime});
  assert.deepEqual(runtime,before,'input payload untouched');assert.equal(result.runs.length,3);assert.equal(result.compilation.count,36);assert.equal(result.compilation.warmHits,72);assert.equal(result.cache.preflightCold,36);assert.equal(result.cache.preflightWarm,72);assert.equal(m.counts.compiles,36);assert.equal(m.counts.dispatches,303246);assert.equal(m.counts.writes,21);assert.equal(m.counts.maps,3);assert.equal(m.counts.creates,m.counts.destroys);
  assert.ok(m.log.findIndex(e=>e[0]==='compile')>m.log.map(e=>e[0]).lastIndexOf('module'));
  for(const [i,r] of result.runs.entries()){
    assert.equal(r.metrics.dispatches,101082);assert.equal(r.metrics.submissions,100);assert.equal(r.metrics.initialWrites,7);assert.equal(r.metrics.stateMappings,1);assert.equal(r.metrics.stateCopies,1);assert.equal(r.metrics.timestampMappings,0);assert.equal(r.metrics.initialize.dispatches,68314);assert.equal(r.metrics.initialize.submissions,67);assert.equal(r.metrics.pump.dispatches,32768);assert.equal(r.metrics.pump.submissions,32);assert.equal(r.metrics.readback.bytes,676*4);assert.equal(r.cache.coldCompiles,i===0?36:0);assert.equal(r.cache.warmHits,i===0?0:36);assert.equal(r.gpuTimestamps.status,'disabled');assert.equal('gpuTimestampMs'in r.metrics.pump,false);finiteTimes(r.metrics);assert.ok(r.metrics.endToEndWallMs>=r.metrics.initialize.wallMs+r.metrics.pump.wallMs);assert.match(r.metrics.endToEndScope,/through final state\/timestamp mapping/);
    assert.deepEqual(Array.from(r.words.slice(48,52)),[4,5,6,7]);assert.equal(r.words[0],0,'mock does not pretend shader execution or parity');
  }
  const passes=m.log.filter(e=>e[0]==='pass');for(let i=0;i<3;i++){assert.equal(passes[i*99][2],'initialize initial-0');assert.equal(passes[i*99+66][3],'begin');assert.equal(passes[i*99+67][2],'owner-0');assert.equal(passes[i*99+98][3],'owner-15');}
  const states=m.log.filter(e=>e[0]==='allocate'&&e[1]==='worldState');assert.equal(new Set(states.map(x=>x[2])).size,3,'fresh world buffers each repeat');assert.equal(result.parity,'requires-independent-strict-comparator');
});

test('timestamp mode is explicit, resolves only after unchanged physical work, and never substitutes unsupported zero',async()=>{
  const absent=mock(),trace=[];await assert.rejects(runResidentBrowserBenchmark({device:absent.device,runtime:fixture(),timestampMode:'required',trace:x=>trace.push(x)}),e=>e.code==='RESIDENT_TIMESTAMP_UNSUPPORTED'&&e.timestampStatus==='unsupported');assert.equal(absent.counts.modules,0);assert.equal(absent.counts.dispatches,0);assert.equal(trace[0].status,'unsupported');
  const m=mock({timestamps:true}),result=await runResidentBrowserBenchmark({device:m.device,runtime:fixture(),timestampMode:'required'});
  assert.equal(m.counts.queries,3);assert.equal(m.counts.resolves,3);assert.equal(m.counts.maps,6);assert.equal(m.counts.dispatches,303246);for(const r of result.runs){assert.equal(r.gpuTimestamps.status,'available');assert.equal(r.gpuTimestamps.chunks.length,99);assert.equal(r.gpuTimestamps.initializeNs,'67000');assert.equal(r.gpuTimestamps.pumpNs,'32000');assert.equal(r.metrics.initialize.gpuTimestampMs,.067);assert.equal(r.metrics.pump.gpuTimestampMs,.032);assert.equal(r.metrics.stateMappings,1);assert.equal(r.metrics.timestampMappings,1);assert.equal(r.metrics.submissions,100);}
  const lastPass=m.log.map(x=>x[0]).lastIndexOf('pass'),lastMap=m.log.map(x=>x[0]).lastIndexOf('map');assert.ok(lastMap>lastPass);assert.equal(m.counts.creates,m.counts.destroys);
});

test('failed preflight or pipeline never submits initial state or physics; limits and altered schedules fail closed',async()=>{
  const bad=mock({badModule:'initialize creation-finish'});await assert.rejects(runResidentBrowserBenchmark({device:bad.device,runtime:fixture()}),/mock parse error/);assert.equal(bad.counts.compiles,0);assert.equal(bad.counts.creates,0);assert.equal(bad.counts.submits,0);
  const compile=mock({failPipeline:true});await assert.rejects(runResidentBrowserBenchmark({device:compile.device,runtime:fixture()}),/mock pipeline failure/);assert.equal(compile.counts.modules,36);assert.equal(compile.counts.creates,0);assert.equal(compile.counts.submits,0);
  const small=mock({smallCapacity:true});await assert.rejects(runResidentBrowserBenchmark({device:small.device,runtime:fixture()}),/exceeds maxBufferSize/);assert.equal(small.counts.modules,0);
  for(const mutate of [p=>p.count=1024,p=>p.frames=371,p=>p.sweeps=2047,p=>p.identity.sourceCaps.ccdPasses=3,p=>p.expectedWords=new Uint32Array(3)]){const p=fixture(),m=mock();mutate(p);await assert.rejects(runResidentBrowserBenchmark({device:m.device,runtime:p}));assert.equal(m.counts.modules,0);}
  await assert.rejects(runResidentBrowserBenchmark({device:mock().device,runtime:fixture(),repeats:2}),/At least three repeats/);
});

test('caller mutation after first await cannot replace captured source code, raw uploads, or schedule',async()=>{
  const runtime=fixture();let changed=false;const m=mock({onPreflight(){if(!changed){changed=true;runtime.input.fill(0xffffffff);runtime.pc.pipelines[0].code='modified';runtime.sweeps=1;runtime.init.initialUploads[0].data.fill(123);}}});
  const result=await runResidentBrowserBenchmark({device:m.device,runtime});assert.equal(result.sweeps,2048);assert.equal(m.counts.dispatches,303246);assert.deepEqual(Array.from(result.runs[0].words.slice(48,52)),[4,5,6,7]);
});

test('retained browser cache identity is exact code, binding types and entry point, never labels',async()=>{
  const same=fixture();same.pc.pipelines[1].code=same.pc.pipelines[0].code;const a=mock({uniquePipelines:35}),r=await runResidentBrowserBenchmark({device:a.device,runtime:same});assert.equal(r.compilation.count,35);assert.equal(r.cache.warmHits,73,'renamed duplicate is one exact pipeline');
  const entry=fixture();entry.pc.pipelines[1].code=entry.pc.pipelines[0].code;entry.pc.pipelines[1].entryPoint='alternate';const b=mock(),e=await runResidentBrowserBenchmark({device:b.device,runtime:entry});assert.equal(e.compilation.count,36,'entry point is part of identity');
  const bindings=fixture();bindings.init.stages['initial-0'].code=bindings.pc.begin.code;const c=mock(),f=await runResidentBrowserBenchmark({device:c.device,runtime:bindings});assert.equal(f.compilation.count,36,'different binding types cannot share a pipeline');
});
