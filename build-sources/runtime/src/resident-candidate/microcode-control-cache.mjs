/* SPDX-License-Identifier: Apache-2.0
 * Explicit invocation-local VM control cache. Source state, scalar locals and
 * CALL stack remain in their original storage arrays. No physics is cached.
 */
import {MICROCODE_ISA as I} from './microcode-isa.mjs';
const C=I.control,fields=Object.freeze(['status','error','pc','sp','stepsLow','stepsHigh','lastOpcode']);
export const MICROCODE_CACHED_CONTROL_FIELDS=Object.freeze(fields.map(name=>Object.freeze({name,offset:C[name]})));
const must=(condition,message)=>{if(!condition)throw new TypeError('Microcode control cache: '+message);};
function boundary(source,name){const start=source.indexOf('fn '+name+'(');must(start>=0,'known generated function '+name);const open=source.indexOf('{',start);let end=open+1,depth=1;for(;depth&&end<source.length;end++)depth+=+(source[end]==='{')-+(source[end]==='}');must(depth===0,'balanced generated function');return{start,end,text:source.slice(start,end)};}
/** Transform only the known generated transport functions, never original
 * source helpers. No private array or source equation is introduced. */
export function generateCachedMicrocodeControlWGSL(storage,p){
 must(p.controlMode==='invocation-cache-v1'&&p.vmStateDisjoint===true,'explicit disjoint control-cache contract');
 const step=boundary(storage,'rc_vm_step'),main=boundary(storage,'main');let code=step.text;
 must(code.startsWith('fn rc_vm_step(base:u32)->bool{'),'exact scalar step signature');
 code=code.replace('fn rc_vm_step(base:u32)->bool{','fn rc_vm_step(base:u32,control:ptr<function,RcMicroCachedControl>)->bool{');
 for(const{name,offset}of MICROCODE_CACHED_CONTROL_FIELDS)code=code.replaceAll(`rc_vm_state[base+${offset}u]`,`(*control).${name}`);
 code=code.replaceAll('return rc_vm_fail(base,','return rc_vm_cache_fail(control,');
 // The existing validator reads the stored PC/SP/error. Materialize exactly
 // the current prefix before calling it; pendingMacro remains storage-owned.
 code=code.replace('if(!rc_vm_external_valid(base,aa))','rc_vm_cache_store(base,*control);if(!rc_vm_external_valid(base,aa))');
 const tail='return (*control).status==1u;';must(code.includes(tail),'exact successful step boundary');code=code.replace(tail,`if(op==${I.opcodes.RET}u){rc_vm_cache_store(base,*control);}${tail}`);
 for(const{offset}of MICROCODE_CACHED_CONTROL_FIELDS)must(!code.includes(`rc_vm_state[base+${offset}u]`),'no uncached owned control field in scalar step');
 const loop=`for(var work=0u;work<${p.instructionBudget}u;work++){if(!rc_vm_step(base)){return;}}`;
 must(main.text.includes(loop),'exact original bounded instruction loop');
 const cachedMain=main.text.replace(loop,`var control=rc_vm_cache_load(base);\n for(var work=0u;work<${p.instructionBudget}u;work++){if(!rc_vm_step(base,&control)){rc_vm_cache_store(base,control);return;}}\n rc_vm_cache_store(base,control);`);
 const helpers=`struct RcMicroCachedControl{${fields.map(name=>`${name}:u32,`).join('')}}
fn rc_vm_cache_load(base:u32)->RcMicroCachedControl{return RcMicroCachedControl(${MICROCODE_CACHED_CONTROL_FIELDS.map(x=>`rc_vm_state[base+${x.offset}u]`).join(',')});}
fn rc_vm_cache_store(base:u32,control:RcMicroCachedControl){${MICROCODE_CACHED_CONTROL_FIELDS.map(x=>`rc_vm_state[base+${x.offset}u]=control.${x.name};`).join('')}}
fn rc_vm_cache_fail(control:ptr<function,RcMicroCachedControl>,error:u32,status:u32)->bool{(*control).status=status;(*control).error=error;return false;}
`;
 return storage.slice(0,step.start)+helpers+code+storage.slice(step.end,main.start)+cachedMain+storage.slice(main.end);
}

/** TEST ONLY differential adapter. The unchanged canonical scalar interpreter
 * runs against a control-word proxy: only the seven fields use invocation-local
 * values. Locals/stack/source buffers are not copied or cached. Full backing
 * words are flushed at RET commit and every public execution boundary. */
export function createCachedMicrocodeReferenceForTest(options,createReference,layoutFor){
 must(options?.testOnly===true,'TEST ONLY');must(options.controlMode==='invocation-cache-v1'&&options.vmStateDisjoint===true,'explicit disjoint control-cache contract');
 const layout=layoutFor(options),backing=options.state??new Uint32Array(layout.totalWords);must(backing instanceof Uint32Array&&backing.length===layout.totalWords,'exact VM storage');
 must(![options.code,...options.bindings??[]].some(x=>x?.buffer===backing.buffer),'VM backing buffer must not alias code or source');
 let active=false,laneBase=0;const cached=new Map(),stats={invocations:0,controlLoads:0,controlStores:0,retFlushes:0,boundaryFlushes:0};
 const flush=()=>{for(const[index,value]of cached)backing[index]=value;stats.controlStores+=cached.size;};
 const indexOf=key=>typeof key==='string'&&/^(0|[1-9]\d*)$/.test(key)?Number(key):null;
 const normalized=(value,fallback)=>{let n=value===undefined?fallback:Number(value);n=Number.isNaN(n)?0:Math.trunc(n);return n<0?Math.max(backing.length+n,0):Math.min(n,backing.length);};
 let proxy;proxy=new Proxy(backing,{
  get(target,key){const index=indexOf(key);if(index!==null&&active&&cached.has(index))return cached.get(index);
   if(key==='subarray')return(start,end)=>{if(active)flush();return target.subarray(start,end);};
   if(key==='slice')return(start,end)=>{const begin=normalized(start,0),finish=normalized(end,target.length),copy=target.slice(start,end);if(active)for(const[i,value]of cached)if(i>=begin&&i<finish)copy[i-begin]=value;return copy;};
   if(key==='fill')return(value,start,end)=>{target.fill(value,start,end);if(active){const begin=normalized(start,0),finish=normalized(end,target.length);for(const i of cached.keys())if(i>=begin&&i<finish)cached.set(i,target[i]);}return proxy;};
   if(key==='set')return(values,offset=0)=>{target.set(values,offset);if(active)for(const i of cached.keys())if(i>=offset&&i<offset+values.length)cached.set(i,target[i]);};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  },
  set(target,key,value){const index=indexOf(key);if(index!==null&&active&&cached.has(index)){cached.set(index,value>>>0);if(index===laneBase+C.pc&&cached.get(laneBase+C.lastOpcode)===I.opcodes.RET){flush();stats.retFlushes++;}return true;}return Reflect.set(target,key,value,target);}
 });
 // Diagnostic callbacks may inspect backing-buffer views. Materialize current
 // controls before entry; callbacks must not mutate VM transport authority.
 const callbacks={};for(const name of['onCall','onReturn','intrinsicHandler','numericContinuationHandler'])if(typeof options[name]==='function')callbacks[name]=(...args)=>{flush();return options[name](...args);};
 const reference=createReference({...options,...callbacks,state:proxy});
 const invoke=(name,lane,args)=>{must(Number.isInteger(lane)&&lane>=0&&lane<layout.count,'candidate lane');must(!active,'no reentrant cached invocation');laneBase=lane*layout.stride;cached.clear();for(const{offset}of MICROCODE_CACHED_CONTROL_FIELDS)cached.set(laneBase+offset,backing[laneBase+offset]);active=true;stats.invocations++;stats.controlLoads+=cached.size;
  try{return reference[name](lane,...args);}finally{flush();stats.boundaryFlushes++;active=false;cached.clear();}
 };
 return Object.freeze({...reference,state:proxy,begin:(lane=0)=>invoke('begin',lane,[]),advance:(lane=0,budget)=>invoke('advance',lane,budget===undefined?[]:[budget]),serviceExternal:(lane=0,id,handler)=>invoke('serviceExternal',lane,[id,typeof handler==='function'?(...args)=>{flush();return handler(...args);}:handler]),controlCacheStats:()=>({...stats})});
}
