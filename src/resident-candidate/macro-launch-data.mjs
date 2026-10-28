/* Lean data-content identity only. No WGSL generator, compiler or physics. */
import {createHash} from './source-sha256.mjs';
import {isOwnedUint32Array} from './abi.mjs';
const need=(ok,message)=>{if(!ok)throw new TypeError('Macro launch profile: '+message);};
const typedArrayPrototype=Object.getPrototypeOf(Uint32Array.prototype),viewGet=key=>Object.getOwnPropertyDescriptor(typedArrayPrototype,key).get;
const viewBuffer=viewGet('buffer'),viewOffset=viewGet('byteOffset'),viewLength=viewGet('byteLength');
/** Stable data-content digest; no V8 object-reference ordering or hash-only
 * caller assertion. Accessors, functions, cycles and future payloads reject. */
export function macroLaunchDataSha256(value){
 const h=createHash('sha256'),active=new WeakSet();
 const visit=x=>{
  if(x===null){h.update('null;');return;}const type=typeof x;
  if(type==='string'){h.update('str:'+JSON.stringify(x)+';');return;}
  if(type==='number'){const bytes=new ArrayBuffer(8);new DataView(bytes).setFloat64(0,x,true);h.update('num:');h.update(new Uint8Array(bytes));return;}
  if(type==='boolean'||type==='undefined'){h.update(type+':'+String(x)+';');return;}
  need(type==='object','data-only source identity');need(!active.has(x),'acyclic source identity');
  if(ArrayBuffer.isView(x)){need(isOwnedUint32Array(x),'owned u32 initial source words');const bytes=viewLength.call(x);h.update('u32:'+bytes/4+':');h.update(new Uint8Array(viewBuffer.call(x),viewOffset.call(x),bytes));return;}
  active.add(x);if(Array.isArray(x)){const d=Object.getOwnPropertyDescriptors(x),keys=Reflect.ownKeys(d);need(Object.getPrototypeOf(x)===Array.prototype&&keys.length===x.length+1&&keys.every(k=>typeof k==='string'&&Object.hasOwn(d[k],'value')&&(k==='length'||/^(0|[1-9][0-9]*)$/.test(k)&&Number(k)<x.length)),'dense plain source arrays without accessors/symbols/custom properties');h.update('array:'+x.length+'[');for(let i=0;i<x.length;i++)visit(d[i].value);h.update(']');}
  else{need(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null,'plain source records');const d=Object.getOwnPropertyDescriptors(x),keys=Reflect.ownKeys(d);need(keys.every(k=>typeof k==='string'&&Object.hasOwn(d[k],'value')),'source records cannot contain accessors/symbols');h.update('{');for(const key of keys.sort()){need(!/expected|future/i.test(key),'no expected/future payload in source profile');h.update(JSON.stringify(key)+':');visit(d[key].value);}h.update('}');}active.delete(x);
 };visit(value);return h.digest('hex');
}

