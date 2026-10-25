// Browser-executed test harness, not a runtime adapter or product admission gate.
import * as B from './browser.mjs';
const status=document.querySelector('#result'),button=document.querySelector('#run');
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const get=async name=>{const r=await fetch(name);if(!r.ok)throw Error('Asset HTTP '+r.status+': '+name);return new Uint8Array(await r.arrayBuffer());};
const assert=(ok,message)=>{if(!ok)throw Error(message);};
button.addEventListener('click',async()=>{
 button.disabled=true;const result={scope:'Read-only snapshot import only; NOT browser gameplay or GPU world parity',userAgent:navigator.userAgent,secureContext:isSecureContext,rows:[],negativeChecks:[]};
 try{
  assert(typeof Buffer==='undefined'&&typeof process==='undefined'&&typeof require==='undefined','Node globals unexpectedly available');result.noNodeGlobals=true;
  const manifestBytes=await get('manifest.json'),m=JSON.parse(new TextDecoder().decode(manifestBytes));result.manifestSha256=await hash(manifestBytes);result.referenceLogSha256=m.referenceLogSha256;result.originalBinarySha256=m.originalBinarySha256;
  const wasm=await get('decoder.wasm'),engine=await get('engine'),p=m.provenance;
  result.wasmSha256=await hash(wasm);result.hostImports=WebAssembly.Module.imports(await WebAssembly.compile(wasm)).length;assert(result.hostImports===0,'Unexpected WASM host imports');
  const options={engineVersion:'0.21.0',engineBytes:engine,wasmBytes:wasm,expectedWasmSha256:p.wasmSha256,provenance:p},decoder=await B.createSnapshotDecoder(options);
  for(const row of m.rows){
   status.textContent='Running '+row.label;const bytes=await get(row.url),unchanged=new Uint8Array(bytes),actual=await decoder.decodeSnapshot(bytes),encoded=B.encodeLosslessTree(actual.state),typedStateSha256=await hash(new TextEncoder().encode(JSON.stringify(actual.state)));
   assert(await hash(bytes)===row.snapshotSha256,'Snapshot identity: '+row.label);assert(typedStateSha256===row.typedStateSha256,'Full typed-state hash differs from original native reference: '+row.label);
   assert(encoded.length===bytes.length&&encoded.every((x,i)=>x===bytes[i]),'Typed reencode differs: '+row.label);assert(bytes.every((x,i)=>x===unchanged[i]),'Caller bytes changed');
   result.rows.push({label:row.label,bytes:bytes.length,snapshotSha256:row.snapshotSha256,typedStateSha256,nativeReferenceTypedStateHashIdentical:true,typedReencodeByteIdentical:true});
  }
  const rejects=async(label,action,codes)=>{let error;try{await action();}catch(e){error=e;}assert(error&&codes.includes(error.code),'Expected rejection '+label+'; got '+error?.code);result.negativeChecks.push({label,code:error.code});};
  for(const [label,patch,code]of [['engine version',{engineVersion:'0.20.0'},'engine-version'],['engine hash',{engineBytes:new Uint8Array([1])},'engine-hash'],['WASM hash',{wasmBytes:new Uint8Array([1])},'wasm-hash'],['pinned hash',{expectedWasmSha256:'0'.repeat(64)},'wasm-hash'],['source revision',{provenance:{...p,sourceRevision:'unknown'}},'wasm-provenance']])await rejects(label,()=>B.createSnapshotDecoder({...options,...patch}),[code]);
  for(const [label,input]of [['empty',new Uint8Array()],['oversize',new Uint8Array(B.MAX_BYTES+1)],['wrong type',[]]])await rejects(label,()=>decoder.decodeSnapshot(input),['snapshot-size']);
  const valid=await get(m.rows[0].url);for(const [label,input]of [['truncated',valid.slice(0,-1)],['trailing byte',new Uint8Array([...valid,0])],['malformed',new Uint8Array([255,255,255,255])]])await rejects(label,()=>decoder.decodeSnapshot(input),['snapshot-decode-failed','wasm-trap']);
  let tree={kind:'unit'};for(let i=0;i<514;i++)tree={kind:'some',value:tree};await rejects('typed depth',()=>B.encodeLosslessTree(tree),['invalid-tree']);
  let calls=0;const accesses=[],world=new Proxy({takeSnapshot(){calls++;return valid;}},{get(target,key){accesses.push(key);assert(key==='takeSnapshot','Unexpected world API access');return target[key];}});await decoder.decodeWorld(world);assert(calls===1&&accesses.length===2,'Read-only world contract');result.worldSnapshotOnly=true;
  const x=(await WebAssembly.instantiate(wasm,{})).instance.exports;assert(x.snapshot_decoder_decode()===1&&x.snapshot_decoder_prepare(0)===0&&x.snapshot_decoder_prepare(B.MAX_BYTES+1)===0,'Owned ABI size rejection');x.snapshot_decoder_release();result.ownedAbiRejectsInvalidInput=true;
  result.passed=result.rows.length===8&&result.negativeChecks.length===12;
  status.textContent=JSON.stringify(result,null,2);document.title=result.passed?'PASS: 8 read-only snapshot imports':'FAIL: snapshot checks';
 }catch(error){result.passed=false;result.error=String(error?.stack??error);status.textContent=JSON.stringify(result,null,2);document.title='FAIL: snapshot import';}
});
