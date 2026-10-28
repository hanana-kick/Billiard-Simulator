import {createCPU} from './cpu.mjs';
import {context,options} from 'GPU_CONTEXT';
import {prepareExperimentalRawWorldBatchContinuation} from '../../src/direct-candidate/experimental-raw-world-batch-binding.mjs';
import {createExperimentalRawWorldBatchGPU} from '../../src/direct-candidate/experimental-raw-world-batch-gpu.mjs';
const now=()=>performance.now(),progress=text=>postMessage({type:'progress',text});
const sha=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',x)),b=>b.toString(16).padStart(2,'0')).join('');
function exact(a,b,label){if(a.length!==b.length)throw Error(`${label}: lengths differ`);for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error(`${label}: mismatch word ${i}, ${a[i]} != ${b[i]}`);}
const summary=xs=>{const s=[...xs].sort((a,b)=>a-b);return {min:s[0],median:s[Math.floor(s.length/2)],max:s.at(-1)};};
self.onmessage=async({data})=>{
 let device;const report={schema:'billiard-local-benchmark-v1',startedAt:new Date().toISOString(),status:'running',pipelineRevision:'0850a4d',physicalHardwareVerified:false,adapter:null,runs:[],ratios:[],notes:['No universal correction factor. No cloud-to-hardware extrapolation.', 'Wall clocks, not GPU timestamp queries. GPU queue wait includes driver scheduling.', 'CPU is one JavaScript worker, sequential, including per-candidate batch allocation and native CPU journal/history overhead; not all-core CPU throughput.', 'GPU timing uses compact-only readback after separate full-word validation; CPU timing omits extra diagnostic serialization but includes its algorithm allocations.', 'uploadHostCallMs measures synchronous writeBuffer calls only, not device transfer time.', 'CPU sequential canonical implementation and parameter-parallel GPU use identical bounded candidates; this is not a full app benchmark.']};
 try{
  if(![3,5,7].includes(data.repeats)||typeof data.include256!=='boolean'||typeof data.forceFallback!=='boolean')throw Error('Invalid bounded run options');
  report.config={widths:data.include256?[1,3,32,256]:[1,3,32],warmups:1,repeats:data.repeats,forceFallback:data.forceFallback};
  report.environment={userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency??null,secureContext:self.isSecureContext};
  const [fb,rb,manifest]=await Promise.all([fetch('./fixture.json').then(r=>r.arrayBuffer()),fetch('./reference.bin').then(r=>r.arrayBuffer()),fetch('./manifest.json').then(r=>r.json())]);
  if(await sha(fb)!==manifest.fixtureSHA256||await sha(rb)!==manifest.referenceSHA256)throw Error('Immutable asset hash mismatch');
  report.manifest=manifest;const fixture=JSON.parse(new TextDecoder().decode(fb)),reference=new Uint32Array(rb),cpu=createCPU(fixture),c=context(fixture);
  const snapshot=c.snapshotRawWorldBatch(c.batch([c.candidates[0]]));
  if(await sha(snapshot.rawScene)!==fixture.rawSceneSHA256||await sha(snapshot.template)!==fixture.worldTemplateSHA256)throw Error('Raw fixture identity changed');
  if(!navigator.gpu)throw Error('WebGPU unavailable: hardware verification not performed');
  const adapter=await navigator.gpu.requestAdapter({forceFallbackAdapter:data.forceFallback});if(!adapter)throw Error('Requested adapter unavailable');
  const info=adapter.info??{};report.adapter={vendor:info.vendor??null,architecture:info.architecture??null,device:info.device??null,description:info.description??null,isFallbackAdapter:typeof info.isFallbackAdapter==='boolean'?info.isFallbackAdapter:typeof adapter.isFallbackAdapter==='boolean'?adapter.isFallbackAdapter:null};
  report.adapter.classification=report.adapter.isFallbackAdapter===true?'reported-fallback':'unknown-not-physical-proof';
  device=await adapter.requestDevice();let lost=null;device.lost.then(x=>{lost=x.message||x.reason;});
  let uploadHostCallMs=0,submitHostCallMs=0;
  const queue=new Proxy(device.queue,{get(target,p){const value=Reflect.get(target,p,target);if(p==='writeBuffer')return(...args)=>{const t=now();try{return value.apply(target,args);}finally{uploadHostCallMs+=now()-t;}};if(p==='submit')return(...args)=>{const t=now();try{return value.apply(target,args);}finally{submitHostCallMs+=now()-t;}};return typeof value==='function'?value.bind(target):value;}});
  const measured=new Proxy(device,{get(target,p){if(p==='queue')return queue;const value=Reflect.get(target,p,target);return typeof value==='function'?value.bind(target):value;}});
  const binding=prepareExperimentalRawWorldBatchContinuation(c.request,c.raw.shotClock,{...options,pipelineRevision:'0850a4d'});
  progress('고정 GPU 파이프라인 컴파일 중 (수 분이 걸릴 수 있음)…');const compileStart=now();const engine=await createExperimentalRawWorldBatchGPU(measured,binding,{strikeBackend:'chunked-16',diagnostic:true});
  report.compilation={factoryWallMs:now()-compileStart,engineCompileMs:engine.compileMs};
  for(const n of report.config.widths){
   progress(`N${n}: CPU/기준값/GPU 완전 일치 검증`);const expected=reference.slice(0,n*2916),cpuCheck=cpu(n);exact(cpuCheck.words,expected,`N${n} CPU/reference`);
   const batch=c.batch(c.candidates.slice(0,n));const gpuCheck=await engine.run(batch);exact(gpuCheck.words,expected,`N${n} GPU/reference`);exact(gpuCheck.compact,cpuCheck.compact,`N${n} compact`);
   const row={n,verifiedWords:n*2916,resultSHA256:await sha(expected),candidateSHA256:await sha(new TextEncoder().encode(JSON.stringify(fixture.candidates.slice(0,n)))),supportedDomain:gpuCheck.envelope,validationMetrics:gpuCheck.metrics,samples:[]};report.runs.push(row);
   for(let repeat=-1;repeat<data.repeats;repeat++){
    progress(`N${n}: ${repeat<0?'준비 실행':`반복 ${repeat+1}/${data.repeats}`}`);
    let cpuMs,gpuMs,gpu;
    const runCPU=()=>{const start=now();const r=cpu(n,false);cpuMs=now()-start;exact(r.compact,cpuCheck.compact,'Repeated CPU compact');};
    const runGPU=async()=>{uploadHostCallMs=0;submitHostCallMs=0;const start=now();gpu=await engine.run(batch,{diagnostic:false});gpuMs=now()-start;exact(gpu.compact,cpuCheck.compact,'Repeated GPU compact');};
    if(repeat%2===0){await runGPU();runCPU();}else{runCPU();await runGPU();}
    if(lost)throw Error(`Device lost: ${lost}`);
    if(repeat>=0)row.samples.push({repeat,cpuMs,gpuMs,uploadHostCallMs,submitHostCallMs,...gpu.metrics});
   }
   row.summary={cpuMs:summary(row.samples.map(s=>s.cpuMs)),gpuMs:summary(row.samples.map(s=>s.gpuMs))};
   report.ratios.push({n,kind:'same-browser CPU sequential / selected WebGPU compact end-to-end',value:row.summary.cpuMs.median/row.summary.gpuMs.median,physicalHardwareClaim:false});
  }
  report.status='complete';
 }catch(error){report.status='failed';report.error=String(error?.stack??error);}finally{device?.destroy();report.endedAt=new Date().toISOString();postMessage({type:'result',report});}
};
