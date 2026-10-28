/** Opt-in compilation-only facade. No production factory imports this module.
 * Bounds are per cache table; pending overflow bypasses sharing rather than
 * cancelling another caller. Labels are diagnostic only (first creator wins).
 * Intended for the existing asynchronous-compute factories only; callers must
 * submit facade shader modules through createComputePipelineAsync on this facade.
 * Synchronous compute/render pipeline APIs are outside this opt-in surface.
 * Unknown descriptors/provenance deliberately bypass the cache. No error scopes
 * are pushed: caller preflight order is preserved, but caching is NOT fully
 * transparent to validation/OOM error scopes. Reuse skips native allocation and
 * its error observations; a label belongs to the first creation. Opt in only
 * when the caller accepts that compilation/allocation observation contract.
 */
const devices=new WeakMap();
const plain=x=>x!==null&&typeof x==='object'&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const known=(x,keys)=>plain(x)&&Reflect.ownKeys(x).every(k=>typeof k==='string'&&keys.includes(k)&&Object.getOwnPropertyDescriptor(x,k)?.get===undefined&&Object.getOwnPropertyDescriptor(x,k)?.set===undefined);
const numberKey=n=>Object.is(n,-0)?'-0':String(n);
function constantsKey(x){if(x===undefined)return '';if(!plain(x)||!Reflect.ownKeys(x).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value')&&typeof x[k]==='number'&&Number.isFinite(x[k])))return null;return JSON.stringify(Object.keys(x).sort().map(k=>[k,numberKey(x[k])]));}
function storageLayoutKey(d){if(!known(d,['label','entries'])||!Array.isArray(d.entries))return null;const entries=[];for(const e of d.entries){if(!known(e,['binding','visibility','buffer'])||!Number.isInteger(e.binding)||!Number.isInteger(e.visibility)||!known(e.buffer,['type','hasDynamicOffset','minBindingSize']))return null;const b=e.buffer;if(!['storage','read-only-storage','uniform'].includes(b.type??'uniform')||(b.hasDynamicOffset!==undefined&&typeof b.hasDynamicOffset!=='boolean')||(b.minBindingSize!==undefined&&(!Number.isSafeInteger(b.minBindingSize)||b.minBindingSize<0)))return null;entries.push([e.binding,e.visibility,b.type??'uniform',b.hasDynamicOffset??false,b.minBindingSize??0]);}if(new Set(entries.map(e=>e[0])).size!==entries.length)return null;return JSON.stringify(entries.sort((a,b)=>a[0]-b[0]));}
export function createCanonicalCompileCacheDevice(device,{maxCompleted=128,maxPending=128}={}){
 if(!device||typeof device.lost?.then!=='function')throw TypeError('Device loss promise required');
 for(const n of [maxCompleted,maxPending])if(!Number.isInteger(n)||n<1||n>4096)throw RangeError('Cache bound 1..4096');
 const previous=devices.get(device);if(previous){if(previous.maxCompleted!==maxCompleted||previous.maxPending!==maxPending)throw RangeError('Existing device cache bounds differ');return previous.facade;}
 const modules=new Map(),pipelines=new Map(),moduleInfo=new WeakMap(),layoutInfo=new WeakMap(),bglInfo=new WeakMap();let lostError=null,nextLayoutId=0;
 const pendingLossRejectors=new Set();
 const alive=()=>{if(lostError)throw lostError;};
 const lose=info=>{if(lostError)return;lostError=new Error('Compilation cache device lost: '+(info?.message??'unknown'));for(const map of [modules,pipelines])map.clear();for(const reject of pendingLossRejectors)reject(lostError);pendingLossRejectors.clear();};
 Promise.resolve(device.lost).then(lose,lose);
 const trim=map=>{let complete=0;for(const e of map.values())if(!e.pending)complete++;for(const [key,e]of map){if(complete<=maxCompleted)break;if(!e.pending){map.delete(key);complete--;}}};
 const hit=(map,key)=>{const e=map.get(key);if(e){map.delete(key);map.set(key,e);}return e;};
 const room=map=>[...map.values()].filter(e=>e.pending).length<maxPending;
 // Register only unsettled operations. A reaction on a lifetime loss promise
 // would retain every completed pipeline until device destruction, defeating LRU.
 const race=p=>new Promise((resolve,reject)=>{
  const fail=error=>{pendingLossRejectors.delete(fail);reject(error);};
  pendingLossRejectors.add(fail);
  Promise.resolve(p).then(value=>{pendingLossRejectors.delete(fail);if(lostError)reject(lostError);else resolve(value);},fail);
 });
 function shader(d){alive();const cacheable=known(d,['code','label'])&&typeof d.code==='string',key=cacheable?d.code:null,old=cacheable&&hit(modules,key);if(old)return old.value;
  const native=device.createShaderModule(d),entry={pending:true},tracked=cacheable&&room(modules);let infoPromise;
  const wrapper=new Proxy(native,{get(target,k){if(k==='getCompilationInfo')return ()=>{try{alive();}catch(e){return Promise.reject(e);}if(infoPromise)return infoPromise;infoPromise=race(Promise.resolve().then(()=>{alive();return native.getCompilationInfo();})).then(info=>{entry.pending=false;if(info.messages.some(m=>m.type==='error')){if(modules.get(key)===entry)modules.delete(key);}else trim(modules);return info;},error=>{if(modules.get(key)===entry)modules.delete(key);throw error;});return infoPromise;};const v=Reflect.get(target,k,target);return typeof v==='function'?v.bind(target):v;}});
  entry.value=wrapper;moduleInfo.set(wrapper,{native,code:cacheable?d.code:null});if(tracked)modules.set(key,entry);return wrapper;
 }
 // Layout creation stays native and synchronous: do not retain an object before
 // its validation result is known. Known descriptors permit identity-only keys.
 // Structurally equal native layouts can have different validation/OOM results;
 // never substitute a successful pipeline compiled with a different layout.
 function bindLayout(d){alive();const key=storageLayoutKey(d),value=device.createBindGroupLayout(d);if(key!==null)bglInfo.set(value,key);return value;}
 function pipelineLayout(d){alive();const valid=known(d,['label','bindGroupLayouts'])&&Array.isArray(d.bindGroupLayouts)&&d.bindGroupLayouts.every(x=>bglInfo.has(x)),value=device.createPipelineLayout(d);if(valid)layoutInfo.set(value,++nextLayoutId);return value;}
 function pipeline(d){try{alive();}catch(e){return Promise.reject(e);}const m=moduleInfo.get(d?.compute?.module),c=d?.compute,ck=constantsKey(c?.constants),lk=d?.layout==='auto'?'auto':layoutInfo.get(d?.layout),valid=known(d,['label','layout','compute'])&&known(c,['module','entryPoint','constants'])&&m?.code!==null&&m!==undefined&&typeof c.entryPoint==='string'&&ck!==null&&lk!==undefined,key=valid?JSON.stringify([m.code,c.entryPoint,ck,lk]):null,old=valid&&hit(pipelines,key);if(old)return old.value;
  // Snapshot known descriptor dictionaries before any asynchronous boundary.
  const descriptor=m?(valid?{...d,compute:{...c,module:m.native,...(c.constants!==undefined?{constants:{...c.constants}}:{})}}:new Proxy(d,{get(target,k,receiver){return k==='compute'?new Proxy(c,{get(t,name,r){return name==='module'?m.native:Reflect.get(t,name,r);}}):Reflect.get(target,k,receiver);}})):d,entry={pending:true},tracked=valid&&room(pipelines);
  let result;try{result=device.createComputePipelineAsync(descriptor);}catch(e){return Promise.reject(e);}
  entry.value=race(result).then(value=>{entry.pending=false;trim(pipelines);return value;},error=>{if(pipelines.get(key)===entry)pipelines.delete(key);throw error;});if(tracked)pipelines.set(key,entry);return entry.value;
 }
 const overrides={createShaderModule:shader,createBindGroupLayout:bindLayout,createPipelineLayout:pipelineLayout,createComputePipelineAsync:pipeline};
 const facade=new Proxy(device,{get(target,k){if(Object.hasOwn(overrides,k))return overrides[k];const v=Reflect.get(target,k,target);return typeof v==='function'?v.bind(target):v;}});
 devices.set(device,{facade,maxCompleted,maxPending});return facade;
}
