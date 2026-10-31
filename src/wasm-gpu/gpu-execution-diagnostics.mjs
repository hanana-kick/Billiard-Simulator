/** Passive, local-only diagnostics. No GPU calls, timers, public callbacks or telemetry.
 * Native-promise observers add microtasks; this is not zero timing overhead. */
const clock=()=>globalThis.performance?.now()??Date.now();
const text=x=>typeof x==='string'?x.slice(0,512):null;
const number=x=>Number.isFinite(x)&&x>=0?x:null;
const read=(object,key)=>{try{return object?.[key];}catch{return undefined;}};
export function createGPUExecutionDiagnostics({now=clock}={}){
 let state=null;
 return Object.freeze({
  begin(generation){state={generation,started:now(),nativeStage:'upload',submittedCommands:0,confirmedCommands:0,submittedFences:0,fulfilledFences:0,resultCopySubmitted:false};},
  stage(value){if(state)state.nativeStage=value;},
  submitted(lastCommand,{resultCopy=false}={}){if(!state)return null;const run=state;run.submittedCommands=Math.max(run.submittedCommands,lastCommand);run.submittedFences++;if(resultCopy)run.resultCopySubmitted=true;return {run,lastCommand};},
  observe(nativePromise,submission){return Promise.resolve(nativePromise).then(value=>{if(submission&&state===submission.run){state.fulfilledFences++;state.confirmedCommands=Math.max(state.confirmedCommands,submission.lastCommand);}return value;});},
  snapshot(){if(!state)return null;const {started,...values}=state;return Object.freeze({...values,runElapsedMs:Math.max(0,now()-started)});}
 });
}
/** Allowlisted scalars only; the snapshot cannot retain GPU/adapter objects. */
export function snapshotGPUEnvironment({navigator:nav,adapter,device,requiredLimits,sourceRevision,manifestSha256}={}){
 const info=read(adapter,'info'),limits=read(device,'limits'),ua=read(nav,'userAgentData');
 return Object.freeze({sourceRevision:text(sourceRevision),manifestSha256:text(manifestSha256),
  userAgent:text(read(nav,'userAgent')),platform:text(read(ua,'platform')??read(nav,'platform')),
  vendor:text(read(info,'vendor')),architecture:text(read(info,'architecture')),device:text(read(info,'device')),description:text(read(info,'description')),
  isFallbackAdapter:typeof read(adapter,'isFallbackAdapter')==='boolean'?read(adapter,'isFallbackAdapter'):null,
  requestedStorageBuffersPerShaderStage:number(read(requiredLimits,'maxStorageBuffersPerShaderStage')),maxStorageBuffersPerShaderStage:number(read(limits,'maxStorageBuffersPerShaderStage')),maxBufferSize:number(read(limits,'maxBufferSize')),maxStorageBufferBindingSize:number(read(limits,'maxStorageBufferBindingSize'))});
}
/** Copy only this diagnostic schema across ownership and serialization boundaries. */
export function snapshotGPULossDiagnostics(value){
 if(!value||typeof value!=='object')return null;
 const out={};
 for(const key of ['sourceRevision','manifestSha256','workerSha256','userAgent','platform','vendor','architecture','device','description','mode','nativeStage','observedAt','label','entryPoint']){const v=text(read(value,key));if(v!==null)out[key]=v;}
 for(const key of ['generation','runGeneration','requestId','width','requestedStorageBuffersPerShaderStage','maxStorageBuffersPerShaderStage','maxBufferSize','maxStorageBufferBindingSize','submittedCommands','confirmedCommands','submittedFences','fulfilledFences','runElapsedMs','prepareElapsedMs','nativePreparationElapsedMs','pipelineIndex','totalPipelines','completedPipelines','shaderBytes']){const v=number(read(value,key));if(v!==null)out[key]=v;}
 for(const key of ['isFallbackAdapter','resultCopySubmitted']){const v=read(value,key);if(typeof v==='boolean')out[key]=v;}
 return Object.freeze(out);
}
