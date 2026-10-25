// SPDX-License-Identifier: Apache-2.0
// Browser-native exact-data validation, not a Node compatibility layer.
import * as D from '../../tools/rapier-snapshot-decoder/browser.mjs';
export const copy=x=>structuredClone(x);
export function requireThat(ok,message='Unsupported initial source state') {
  if(!ok) throw Object.assign(new RangeError(message),{code:'initial-import-contract'});
}
// structuredClone retains SharedArrayBuffer storage, so copy alone is not an
// ownership boundary. Admit only accessor-free source data before any clone or
// await. A cycle is scanned once; downstream schema/codec guards still decide
// whether that cycle is a valid input (the native typed tree is not cyclic).
// Both public entries run this before clone AND on the canonicalized clone,
// before awaiting: structuredClone restores hidden Map/Set/Memory/SAB internal
// types even if a caller disguised their prototype. The second scan rejects
// those types without exception-driven brand probes on every ordinary node.
const bufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
const sharedPrototype=typeof SharedArrayBuffer==='undefined'?null:SharedArrayBuffer.prototype;
const typedPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const typedBuffer=Object.getOwnPropertyDescriptor(typedPrototype,'buffer').get;
const viewBuffer=Object.getOwnPropertyDescriptor(DataView.prototype,'buffer').get;
const dataPrototypes=new Set([Object.prototype,null,Array.prototype,ArrayBuffer.prototype,DataView.prototype,
  Int8Array.prototype,Uint8Array.prototype,Uint8ClampedArray.prototype,Int16Array.prototype,Uint16Array.prototype,
  Int32Array.prototype,Uint32Array.prototype,Float32Array.prototype,Float64Array.prototype,
  ...(typeof BigInt64Array==='undefined'?[]:[BigInt64Array.prototype,BigUint64Array.prototype])]);
export function assertOwnedInputData(input){
  const seen=new WeakSet(),pending=[input],rejections=new WeakSet();
  const check=(ok,message)=>{if(!ok){const error=Object.assign(new RangeError(message),{code:'initial-import-contract'});rejections.add(error);throw error;}};
  try{
    while(pending.length){
      const value=pending.pop();
      if(value===null||typeof value!=='object'){
        check(typeof value!=='function'&&typeof value!=='symbol','Only explicit source data is supported');continue;
      }
      if(seen.has(value))continue;seen.add(value);
      const prototype=Object.getPrototypeOf(value);
      check(!sharedPrototype||prototype!==sharedPrototype,'Shared storage is not supported by initial import');
      if(ArrayBuffer.isView(value)){
        // Invoke intrinsic buffer getters, never a caller-supplied .buffer
        // accessor. This also recognizes views from another JS realm.
        let buffer;try{buffer=viewBuffer.call(value);}catch{buffer=typedBuffer.call(value);}
        // If this realm has no SAB constructor, a non-ArrayBuffer backing store
        // still fails closed here rather than being silently cloned as shared.
        try{bufferLength.call(buffer);}catch{check(false,'Only non-shared ArrayBuffer storage is supported');}
        pending.push(buffer);
      }
      check(dataPrototypes.has(prototype),'Unknown source data prototype is unsupported');
      // Descriptor traversal rejects accessors instead of skipping them:
      // structuredClone would otherwise execute an enumerable getter later.
      const descriptors=Object.getOwnPropertyDescriptors(value);
      for(const key of Reflect.ownKeys(descriptors)){
        const descriptor=descriptors[key];
        check('value'in descriptor,'Source data accessors are unsupported');
        check(typeof key==='string','Symbol source fields are unsupported');
        pending.push(descriptor.value);
      }
    }
  }catch(error){
    if(rejections.has(error))throw error;
    // Proxy reflection can run traps; there is no portable Proxy detector.
    // Trap failures are rejection, not a side-effect-free guarantee for Proxies.
    throw Object.assign(new RangeError('Source data inspection failed; input rejected'),{code:'initial-import-contract'});
  }
}
export function equal(a,b,message='Exact source scalar required') {requireThat(Object.is(a,b),message);}
export function sameData(a,b) {
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  if(ArrayBuffer.isView(a)||ArrayBuffer.isView(b))return a.constructor===b.constructor&&a.length===b.length&&Array.from(a).every((x,i)=>Object.is(x,b[i]));
  if(Array.isArray(a)!==Array.isArray(b))return false;
  const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();
  return ak.length===bk.length&&ak.every((k,i)=>k===bk[i]&&sameData(a[k],b[k]));
}
export function equalData(a,b,message='Exact source data required') {requireThat(sameData(a,b),message);}
export async function hash(bytes) {
  requireThat(globalThis.crypto?.subtle,'Web Crypto SHA-256 requires a secure context');
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
}
export function plain(node) {
  if(!node)return null;
  switch(node.kind) {
    case 'float':return D.floatValue(node);
    case 'integer':{const n=Number(node.value);return Number.isSafeInteger(n)?n:BigInt(node.value);}
    case 'bool':return node.value;
    case 'none':case 'unit':case 'unit_struct':return null;
    case 'some':case 'newtype_struct':return plain(node.value);
    case 'newtype_variant':return {variant:node.variant,value:plain(node.value)};
    case 'unit_variant':return node.variant;
    default:
      if(node.fields)return Object.fromEntries(node.fields.map(([k,v])=>[k,plain(v)]));
      if(node.items)return node.items.map(plain);
      if(node.entries)return node.entries.map(([k,v])=>[plain(k),plain(v)]);
      if('value'in node)return node.value;
      throw new RangeError('Unsupported exact native tree node '+node.kind);
  }
}
export async function journalDigest(journal) {
  function canonical(value) {
    if(value===null)return ['null'];
    if(typeof value==='number'){const b=new DataView(new ArrayBuffer(8));b.setFloat64(0,value,false);return ['f64',Array.from(new Uint8Array(b.buffer),x=>x.toString(16).padStart(2,'0')).join('')];}
    if(typeof value==='undefined')return ['undefined'];
    if(typeof value==='bigint')return ['bigint',value.toString()];
    if(typeof value==='string'||typeof value==='boolean')return [typeof value,value];
    if(Array.isArray(value))return ['array',value.map(canonical)];
    equal(typeof value,'object','Journal values are explicit data, never functions');
    return ['object',Object.keys(value).sort().map(k=>[k,canonical(value[k])])];
  }
  return hash(new TextEncoder().encode(JSON.stringify(['tagged-sorted-json-f64-bits-v1',canonical(journal)])));
}
export async function verifyDecoded(d,snapshot) {
  requireThat(snapshot instanceof Uint8Array&&snapshot.byteLength>0&&snapshot.byteLength<=D.MAX_BYTES,'Bounded native snapshot bytes required');
  requireThat(d?.schemaVersion===1&&d.sourceRevision===D.SOURCE_REVISION&&d.engineVersion===D.ENGINE_VERSION&&d.engineSha256===D.ENGINE_SHA256&&d.parryVersion==='0.31.1'&&d.verification?.nativeBincodeByteIdentical===true&&d.verification?.javascriptTypedReencodeByteIdentical===true,'Pinned source/engine and both decoded roundtrips required');
  equal(d.byteLength,snapshot.length,'Snapshot byte length mismatch');
  equal(d.inputSha256,await hash(snapshot),'Snapshot identity mismatch');
  const rebuilt=D.encodeLosslessTree(d.state);
  requireThat(rebuilt.length===snapshot.length&&rebuilt.every((x,i)=>x===snapshot[i]),'Decoded tree changed after byte verification');
}
