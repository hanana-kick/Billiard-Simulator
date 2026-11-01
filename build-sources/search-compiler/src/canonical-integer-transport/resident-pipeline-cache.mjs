/** Experimental completed-only, device-local scheduler pipeline cache.
 * Contains no arenas, bind groups, source inputs or physics state. Not yet wired
 * into the qualified runner: integration requires a new runtime closure pin. */
const devices=new WeakMap();
const entries=Object.freeze(['setup','initialize','advance','commit']);
const signature=Object.freeze([10,9,9,9]);
function state(device){let s=devices.get(device);if(!s){s={tail:Promise.resolve(),completed:new Map(),disabled:false};devices.set(device,s);s.loss=Promise.resolve(device.lost).then(()=>{s.disabled=true;s.completed.clear();throw Error('Resident pipeline device lost');},()=>{s.disabled=true;s.completed.clear();throw Error('Resident pipeline device loss observation failed');});s.loss.catch(()=>{});}return s;}
/** Quarantine is irreversible for this device; fulfilled loss also clears cache. */
export function quarantineResidentPipelineCache(device){const s=state(device);s.disabled=true;s.completed.clear();}
export function getResidentPipelinePack(device,{code}={}){
 if(typeof code!=='string'||code.length===0)throw TypeError('Exact scheduler source required');
 const s=state(device),key=JSON.stringify([code,entries,signature,{},'storage:readonly=0,7;compute']);
 const wait=p=>Promise.race([Promise.resolve(p),s.loss]);
 const operation=s.tail.then(async()=>{
  if(s.disabled)throw Error('Resident pipeline device unavailable or quarantined');
  if(s.completed.has(key))return s.completed.get(key);
  if(s.completed.size)throw Error('Scheduler source changed: retire device before replacing cached pipelines');
  let result,failure,depth=0;
  try{
   for(const kind of ['validation','internal','out-of-memory']){device.pushErrorScope(kind);depth++;}
   const bgls=[10,9].map(n=>device.createBindGroupLayout({entries:Array.from({length:n},(_,binding)=>({binding,visibility:GPUShaderStage.COMPUTE,buffer:{type:[0,7].includes(binding)?'read-only-storage':'storage'}}))}));
   const layouts=bgls.map(layout=>device.createPipelineLayout({bindGroupLayouts:[layout]}));
   const module=device.createShaderModule({code,label:'experimental-resident-cached-scheduler'});
   const info=await wait(module.getCompilationInfo());if(info.messages.some(m=>m.type==='error'))throw Error('Scheduler compilation failed: '+info.messages.filter(m=>m.type==='error').map(m=>m.message).join('\n'));
   const pipelines=[];
   for(let i=0;i<entries.length;i++){if(s.disabled)throw Error('Resident pipeline device unavailable or quarantined');pipelines.push(await wait(device.createComputePipelineAsync({layout:layouts[i===0?0:1],compute:{module,entryPoint:entries[i],constants:{}}})));}
   result=Object.freeze({bgls:Object.freeze(bgls),pipelines:Object.freeze(pipelines),code});
  }catch(error){failure=error;}
  while(depth--){try{const error=await wait(device.popErrorScope());if(error)failure??=Error('Scheduler pipeline scope error: '+error.message);}catch(error){failure??=error;}}
  if(failure)throw failure;
  if(s.disabled)throw Error('Resident pipeline device unavailable or quarantined');
  s.completed.set(key,result);return result;
 });
 s.tail=operation.then(()=>{},()=>{});return operation;
}
