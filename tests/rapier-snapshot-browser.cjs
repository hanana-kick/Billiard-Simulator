'use strict';
// Bounded snapshot import differential only. Never calls World.step/restore,
// never feeds POST-native state into a GPU trajectory, never enables the product.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {fixtures,hash,ORIGINAL_BINARY_SHA256}=require('./rapier-snapshot-browser-fixtures.cjs');
const D=require('../tools/rapier-snapshot-decoder/candidate.cjs'),ROOT=path.resolve(__dirname,'..');
let B,decoder,rows,opts,p,wasm,engine,native;const original=process.env.RAPIER_SNAPSHOT_DECODER_ORIGINAL,candidate=process.env.RAPIER_SNAPSHOT_DECODER_CANDIDATE;
function run(binary,input){const r=spawnSync(binary,[],{input,encoding:'utf8',maxBuffer:256*1024*1024,timeout:30000});assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);return r.stdout;}
before(async()=>{
 assert.ok(original&&candidate&&process.env.RAPIER_WASM_PROVENANCE,'Explicit original/candidate native binaries and WASM provenance required');
 assert.equal(hash(fs.readFileSync(original)),ORIGINAL_BINARY_SHA256,'Frozen native reference binary unchanged');
 const originalVersion=spawnSync(original,['--version'],{encoding:'utf8'}),candidateVersion=spawnSync(candidate,['--version'],{encoding:'utf8'});assert.equal(originalVersion.status,0);assert.equal(candidateVersion.status,0);assert.equal(candidateVersion.stdout,originalVersion.stdout,'CLI version stdout byte-identical');
 rows=fixtures();p=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE,'utf8'));
 for(const [file,sha]of Object.entries(p.build.sources))assert.equal(hash(fs.readFileSync(path.join(ROOT,file))),sha,'WASM built from current candidate source: '+file);
 wasm=new Uint8Array(fs.readFileSync(p.wasmPath));engine=new Uint8Array(fs.readFileSync(path.join(ROOT,'vendor/rapier.cjs')));
 B=await import('../tools/rapier-snapshot-decoder/browser.mjs');opts={engineVersion:'0.21.0',engineBytes:engine,wasmBytes:wasm,expectedWasmSha256:p.wasmSha256,provenance:p};decoder=await B.createSnapshotDecoder(opts);
 native=new Map(rows.map(row=>[row.label,run(original,row.bytes)]));
});
after(()=>{if(original)assert.equal(hash(fs.readFileSync(original)),ORIGINAL_BINARY_SHA256);});
test('original native, factored native, WASM typed outputs and byte reencodes agree on all archived boundaries',async t=>{
 for(const row of rows){
   const unchanged=new Uint8Array(row.bytes),old=native.get(row.label),next=run(candidate,row.bytes);
   assert.equal(next,old,'CLI stdout byte-identical: '+row.label);
   const expected=JSON.parse(old);expected.verification.javascriptTypedReencodeByteIdentical=true;
   const actual=await decoder.decodeSnapshot(row.bytes);
   assert.deepEqual(actual,expected,'Exact full typed state: '+row.label);
   assert.deepEqual(B.encodeLosslessTree(actual.state),unchanged,'Browser typed byte reencode: '+row.label);
   assert.deepEqual(D.encodeLosslessTree(actual.state),Buffer.from(unchanged),'Same Node encoder: '+row.label);
   assert.deepEqual(row.bytes,unchanged,'Import leaves caller snapshot untouched');
   if(row.expectedState)assert.deepEqual(actual.state,row.expectedState,'Archived original typed state unchanged');
   t.diagnostic(JSON.stringify({label:row.label,snapshotSha256:row.snapshotSha256,bytes:row.bytes.length,sourceSha256:row.source.sha256,typedStateSha256:hash(JSON.stringify(actual.state)),nativeCandidateStdoutByteIdentical:true,wasmTypedIdentical:true,typedReencodeByteIdentical:true}));
 }
});
test('provenance, version, hash, input size, malformed binary and typed depth gates fail closed',async()=>{
 for(const [patch,code]of [[{engineVersion:'0.20.0'},'engine-version'],[{engineBytes:new Uint8Array([1])},'engine-hash'],[{wasmBytes:new Uint8Array([1])},'wasm-hash'],[{expectedWasmSha256:'0'.repeat(64)},'wasm-hash'],[{provenance:{...p,sourceRevision:'unknown'}},'wasm-provenance']])await assert.rejects(B.createSnapshotDecoder({...opts,...patch}),e=>e.code===code);
 for(const input of [new Uint8Array(),new Uint8Array(B.MAX_BYTES+1),[],null])await assert.rejects(decoder.decodeSnapshot(input),e=>e.code==='snapshot-size');
 const valid=rows[0].bytes;
 for(const input of [valid.slice(0,-1),new Uint8Array([...valid,0]),new Uint8Array([255,255,255,255]),new Uint8Array(valid.length).fill(255)])await assert.rejects(decoder.decodeSnapshot(input),e=>['snapshot-decode-failed','wasm-trap'].includes(e.code));
 let tree={kind:'unit'};for(let i=0;i<514;i++)tree={kind:'some',value:tree};assert.throws(()=>B.encodeLosslessTree(tree),e=>e.code==='invalid-tree');
 const after=await decoder.decodeSnapshot(valid);assert.equal(after.inputSha256,hash(valid),'Fresh instance still works after failures');
});
test('decodeWorld requests one snapshot and accesses no stepping or restore API',async()=>{
 const snapshot=rows[0].bytes,accesses=[];let calls=0;
 const world=new Proxy({takeSnapshot(){calls++;return snapshot;}},{get(target,key){accesses.push(key);if(key!=='takeSnapshot')throw Error('Unexpected world access: '+String(key));return target[key];}});
 const out=await decoder.decodeWorld(world);assert.equal(calls,1);assert.deepEqual(accesses,['takeSnapshot','takeSnapshot']);assert.equal(out.inputSha256,hash(snapshot));
});
test('owned-buffer ABI rejects absent/oversize inputs without arbitrary pointer reads',async()=>{
 const x=(await WebAssembly.instantiate(wasm,{})).instance.exports;
 assert.equal(x.snapshot_decoder_decode(),1);assert.equal(x.snapshot_decoder_prepare(0),0);assert.equal(x.snapshot_decoder_prepare(B.MAX_BYTES+1),0);
 assert.equal(x.snapshot_decoder_decode(),1);assert.equal(x.snapshot_decoder_prepare(4)>0,true);assert.equal(x.snapshot_decoder_decode(),1);x.snapshot_decoder_release();assert.equal(x.snapshot_decoder_output_len(),0);
});
test('real Chromium imports snapshots with no Node globals or host imports',async t=>{
 const http=require('node:http'),{chromium}=require('playwright');
 const assets=new Map([['/',{type:'text/html',body:'<!doctype html><title>Read-only snapshot import test</title>'}],['/browser.mjs',{type:'text/javascript',body:fs.readFileSync(path.join(ROOT,'tools/rapier-snapshot-decoder/browser.mjs'))}],['/codec.js',{type:'text/javascript',body:fs.readFileSync(path.join(ROOT,'tools/rapier-snapshot-decoder/codec.js'))}],['/decoder.wasm',{type:'application/wasm',body:Buffer.from(wasm)}],['/engine',{type:'application/octet-stream',body:Buffer.from(engine)}]]);
 rows.forEach((r,i)=>assets.set('/snapshot/'+i,{type:'application/octet-stream',body:Buffer.from(r.bytes)}));
 const server=http.createServer((req,res)=>{const asset=assets.get(req.url);if(!asset){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':asset.type,'cache-control':'no-store'}).end(asset.body);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
   browser=await chromium.launch({executablePath:process.env.RAPIER_TEST_CHROMIUM,ignoreDefaultArgs:['--unsafely-disable-devtools-self-xss-warnings'],headless:true,chromiumSandbox:true,args:['--disable-gpu']});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
   const actual=await page.evaluate(async({p,count})=>{
     if(typeof Buffer!=='undefined'||typeof process!=='undefined'||typeof require!=='undefined')throw Error('Unexpected Node globals');
     const B=await import('/browser.mjs'),get=async url=>new Uint8Array(await(await fetch(url)).arrayBuffer()),wasm=await get('/decoder.wasm');
     if(WebAssembly.Module.imports(await WebAssembly.compile(wasm)).length)throw Error('Unexpected host imports');
     const decoder=await B.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:await get('/engine'),wasmBytes:wasm,provenance:p,expectedWasmSha256:p.wasmSha256}),out=[];
     for(let i=0;i<count;i++){const bytes=await get('/snapshot/'+i),decoded=await decoder.decodeSnapshot(bytes),encoded=B.encodeLosslessTree(decoded.state);if(encoded.length!==bytes.length||!encoded.every((x,j)=>x===bytes[j]))throw Error('Browser reencode mismatch');out.push(decoded);}
     try{await decoder.decodeSnapshot(new Uint8Array([1]));throw Error('Malformed input unexpectedly accepted');}catch(e){if(e.code!=='snapshot-decode-failed')throw e;}
     return out;
   },{p,count:rows.length});
   rows.forEach((row,i)=>{const expected=JSON.parse(native.get(row.label));expected.verification.javascriptTypedReencodeByteIdentical=true;assert.deepEqual(actual[i],expected,'Chromium exact typed output: '+row.label);});
   t.diagnostic(JSON.stringify({browser:await browser.version(),snapshots:rows.length,noNodeGlobals:true,noWasmHostImports:true,gpuDisabled:true,scope:'snapshot import only; not app or GPU world parity'}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
