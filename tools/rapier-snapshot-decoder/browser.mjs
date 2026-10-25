// SPDX-License-Identifier: Apache-2.0
// Read-only browser import. No native subprocess, engine restore or physics step.
// Load only a locally bundled module admitted by build-wasm.cjs provenance.
import * as importedCodec from './codec.js';
const Codec=importedCodec.default??globalThis.RapierSnapshotCodec;
export const SOURCE_REVISION='b716d375efc0201003f0cd9ef7168eee0b62c177';
export const ENGINE_VERSION='0.21.0';
export const ENGINE_SHA256='fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4';
export const MAX_BYTES=32*1024*1024;
export const MAX_OUTPUT=256*1024*1024;
const {fail}=Codec;
export const {encodeLosslessTree,walk,field,findStructs,floatValue}=Codec;
function bytes(value,label,max){
 if(!(value instanceof Uint8Array)||!value.byteLength||value.byteLength>max)fail('snapshot-size',`${label} must be a nonempty Uint8Array of at most ${max} bytes`);
 return new Uint8Array(value); // Never retain caller-mutatable input across await.
}
async function hash(value){
 if(!globalThis.crypto?.subtle)fail('crypto-unavailable','Web Crypto SHA-256 requires a secure browser context');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value)),x=>x.toString(16).padStart(2,'0')).join('');
}
const same=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
function provenance(p){
 if(!p||p.schema!=='rapier-readonly-wasm-decoder-provenance-v1'||p.abi!==1||p.sourceRevision!==SOURCE_REVISION||p.engineVersion!==ENGINE_VERSION||p.engineSha256!==ENGINE_SHA256||p.parryVersion!=='0.31.1'||p.target!=='wasm32-unknown-unknown'||p.limits?.input!==MAX_BYTES||p.limits?.output!==MAX_OUTPUT||p.limits?.depth!==128||p.limits?.nodes!==2000000||p.limits?.memory!==1073741824||p.source?.rapier?.archiveSha256!=='67825e5487ff84582777132f1ede42e8b865984246825ba9de6ff07ed2a8fdb1'||p.source?.parry?.archiveSha256!=='7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e'||!/^[0-9a-f]{64}$/.test(p.wasmSha256??''))fail('wasm-provenance','Explicit official-source WASM provenance required');
 return structuredClone(p);
}
export async function createSnapshotDecoder(options={}){
 if(options.engineVersion!==ENGINE_VERSION)fail('engine-version','Explicit pinned engineVersion 0.21.0 required');
 const p=provenance(options.provenance);
 // The manifest itself must come from the application build, not an untrusted
 // snapshot. A caller-supplied hash alone is never evidence of official source.
 if(options.expectedWasmSha256!==p.wasmSha256)fail('wasm-hash','Explicit application-pinned WASM SHA256 required');
 const engine=bytes(options.engineBytes,'Engine source',MAX_BYTES),wasm=bytes(options.wasmBytes,'Decoder module',MAX_BYTES);
 if(await hash(engine)!==ENGINE_SHA256)fail('engine-hash','Vendor Rapier bytes do not match pinned engine');
 if(await hash(wasm)!==p.wasmSha256)fail('wasm-hash','Decoder module differs from admitted build');
 const module=await WebAssembly.compile(wasm);
 if(WebAssembly.Module.imports(module).length)fail('wasm-imports','Read-only decoder must not import host APIs');
 return Object.freeze({provenance:p,async decodeSnapshot(input){
   const snapshot=bytes(input,'Snapshot',MAX_BYTES),inputSha256=await hash(snapshot);
   // Fresh instances are deliberate: a trap/OOM poisons no later operation.
   let instance;
   try{instance=await WebAssembly.instantiate(module,{});}catch(error){fail('wasm-unavailable',String(error));}
   const x=instance.exports;
   try{
     if(!(x.memory instanceof WebAssembly.Memory)||x.snapshot_decoder_abi?.()!==1||x.snapshot_decoder_max_input?.()!==MAX_BYTES||x.snapshot_decoder_max_output?.()!==MAX_OUTPUT||x.snapshot_decoder_max_depth?.()!==128||x.snapshot_decoder_max_nodes?.()!==2000000)fail('wasm-abi','Decoder ABI or bounds mismatch');
     const ptr=x.snapshot_decoder_prepare(snapshot.length)>>>0;
     if(!ptr||ptr+snapshot.length>x.memory.buffer.byteLength)fail('wasm-buffer','Invalid owned input allocation');
     new Uint8Array(x.memory.buffer,ptr,snapshot.length).set(snapshot);
     const status=x.snapshot_decoder_decode(),length=x.snapshot_decoder_output_len()>>>0,outptr=x.snapshot_decoder_output_ptr()>>>0;
     if(!length||length>MAX_OUTPUT||outptr+length>x.memory.buffer.byteLength)fail('wasm-output','Invalid bounded output allocation');
     let out;
     try{out=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(x.memory.buffer,outptr,length)));}catch{fail('invalid-wasm-json','Decoder did not return valid UTF-8 JSON');}
     if(status!==0)fail('snapshot-decode-failed',out.error?.message??'Pinned source decoder rejected snapshot');
     if(out.schemaVersion!==1||out.sourceRevision!==SOURCE_REVISION||out.engineVersion!==ENGINE_VERSION||out.engineSha256!==ENGINE_SHA256||out.parryVersion!=='0.31.1'||out.verification?.nativeBincodeByteIdentical!==true)fail('wasm-provenance','Source decoder output provenance mismatch');
     if(out.byteLength!==snapshot.length||out.inputSha256!==inputSha256)fail('snapshot-identity','Decoder returned a different input identity');
     const rebuilt=encodeLosslessTree(out.state);
     if(!same(rebuilt,snapshot))fail('javascript-roundtrip-mismatch','Typed re-encode differs from original snapshot');
     out.verification.javascriptTypedReencodeByteIdentical=true;
     return out;
   }catch(error){if(error instanceof WebAssembly.RuntimeError)fail('wasm-trap','Decoder trapped; snapshot rejected without fallback');throw error;}
   finally{try{x.snapshot_decoder_release?.();}catch{/* The instance is discarded after any trap. */}}
 },async decodeWorld(world){
   if(typeof world?.takeSnapshot!=='function')fail('world-snapshot-api','Native world.takeSnapshot required');
   return this.decodeSnapshot(world.takeSnapshot());
 }});
}
