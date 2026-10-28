'use strict';
// Build-only local packaging. No download, native physics, GPU or activation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const RUNTIME='src/bounded-gpu-shot';
function sourceFiles(root,{resident=false}={}){
 assert.equal(typeof resident,'boolean','Explicit resident asset opt-in');
 const seen=new Set();
 function visit(file){
  file=path.posix.normalize(file);assert.ok(!file.startsWith('../')&&!path.isAbsolute(file),'Bundled source must stay inside root');
  if(seen.has(file))return;seen.add(file);
  const source=fs.readFileSync(path.join(root,file),'utf8');
  // Include module-worker dynamic import lists as well as static ES imports.
  for(const match of source.matchAll(/['"]((?:\.\.?\/)[\w./-]+\.(?:mjs|js))['"]/g))visit(path.posix.join(path.posix.dirname(file),match[1]));
  // Original classic modules have lazy source-local require/load dependencies.
  for(const match of source.matchAll(/(?:require\(['"]\.\/|load\(['"])([\w-]+)(?:\.js)?['"]/g))visit(path.posix.join(path.posix.dirname(file),match[1]+'.js'));
 }
 for(const dir of ['src/browser-initial-import',RUNTIME])for(const name of fs.readdirSync(path.join(root,dir)).filter(n=>n.endsWith('.mjs')))visit(dir+'/'+name);
 visit('src/experimental-four-ball-world.js');visit('src/experimental-four-ball-batch-world.mjs');
 visit('tools/rapier-snapshot-decoder/browser.mjs');
 if(resident){visit('src/resident-candidate/browser-runtime-entry.mjs');visit('src/resident-candidate/worker-entry.mjs');visit('src/resident-candidate/worker-client.mjs');}
 return [...seen].sort();
}
async function buildGpuWorkerAssets({root=path.resolve(__dirname,'..'),out,provenanceFile=process.env.RAPIER_WASM_PROVENANCE,resident=false}={}){
 assert.equal(typeof resident,'boolean','Explicit resident asset opt-in');
 assert.ok(out&&path.isAbsolute(out),'Explicit absolute output directory required');
 assert.ok(provenanceFile,'GPU assets require explicit RAPIER_WASM_PROVENANCE from the official-source decoder build; no download or fallback');
 const p=JSON.parse(fs.readFileSync(provenanceFile,'utf8'));
 assert.ok(p.build?.sources&&Object.keys(p.build.sources).length,'Decoder source build provenance required');
 for(const [file,sha]of Object.entries(p.build.sources)){
  assert.ok(!path.isAbsolute(file)&&!file.split(/[\\/]/).includes('..'),'Relative decoder source provenance required');
  assert.equal(hash(fs.readFileSync(path.join(root,file))),sha,'Pinned decoder source '+file);
 }
 const engine=fs.readFileSync(path.join(root,'vendor/rapier.cjs')),wasm=fs.readFileSync(p.wasmPath);
 assert.equal(hash(engine),p.engineSha256,'Engine identity');assert.equal(hash(wasm),p.wasmSha256,'Decoder identity');
 assert.ok(p.notices?.path&&p.notices.sha256,'Decoder dependency license notices required');
 const notices=fs.readFileSync(p.notices.path);assert.equal(hash(notices),p.notices.sha256,'Decoder notices identity');
 const {pathToFileURL}=require('node:url');
 const {createSnapshotDecoder}=await import(pathToFileURL(path.join(root,'tools/rapier-snapshot-decoder/browser.mjs')).href);
 // Same fail-closed provenance, hash, host-import and ABI validation as runtime.
 // Compiles a read-only decoder; never decodes or steps a physics world.
 await createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(engine),wasmBytes:new Uint8Array(wasm),provenance:p,expectedWasmSha256:p.wasmSha256});
 const module_=new WebAssembly.Module(wasm),abi=new WebAssembly.Instance(module_,{}).exports;
 assert.ok(abi.memory instanceof WebAssembly.Memory,'Decoder memory export required');
 for(const [name,value]of Object.entries({snapshot_decoder_abi:1,snapshot_decoder_max_input:33554432,snapshot_decoder_max_output:268435456,snapshot_decoder_max_depth:128,snapshot_decoder_max_nodes:2000000}))assert.equal(abi[name]?.(),value,'Decoder ABI bound '+name);
 const files=sourceFiles(root,{resident}),payload=new Map(files.map(file=>[file,fs.readFileSync(path.join(root,file))]));
 const bundledProvenance={...p,wasmPath:'four-ball-worker-decoder.wasm',notices:{...p.notices,path:'four-ball-worker-NOTICES.txt'}};
 payload.set(RUNTIME+'/four-ball-worker-assets.json',Buffer.from(JSON.stringify({schema:'bounded-four-ball-worker-assets-v1',expectedWasmSha256:p.wasmSha256,provenance:bundledProvenance})));
 payload.set(RUNTIME+'/four-ball-worker-engine.bin',engine);payload.set(RUNTIME+'/four-ball-worker-decoder.wasm',wasm);payload.set(RUNTIME+'/four-ball-worker-NOTICES.txt',notices);
 const manifest={schema:'bounded-gpu-worker-build-v1',activation:false,publicBackendUnchanged:true,networkTransferMeasured:false,
  entrypoints:[RUNTIME+'/four-ball-worker-entry.mjs',RUNTIME+'/current-source-worker-entry.mjs',RUNTIME+'/evaluation.mjs'],
  optionalBatchModule:'src/experimental-four-ball-batch-world.mjs',batchRequiresExistingRuntimeInitialization:true,
  ...(resident?{residentRuntime:{entrypoint:'src/resident-candidate/browser-runtime-entry.mjs',workerEntrypoint:'src/resident-candidate/worker-entry.mjs',clientEntrypoint:'src/resident-candidate/worker-client.mjs',protocol:'resident-candidate-worker-v1',activation:false,automaticDeviceRequest:false,numericallyQualified:false,fullRestQualified:false,native1024Qualified:false}}:{}),
  wasmSha256:p.wasmSha256,engineSha256:p.engineSha256,
  files:Object.fromEntries([...payload].map(([file,bytes])=>[file,{sha256:hash(bytes),bytes:bytes.length}])),
  payloadBytes:[...payload.values()].reduce((n,b)=>n+b.length,0)};
 if(resident)manifest.residentRuntime.sourceVersion=hash(Buffer.from(JSON.stringify({schema:'resident-worker-package-v1',files:manifest.files})));
 // Validate every input before touching output. Caller owns the output directory.
 for(const [file,bytes]of payload){fs.mkdirSync(path.dirname(path.join(out,file)),{recursive:true});fs.writeFileSync(path.join(out,file),bytes);}
 fs.writeFileSync(path.join(out,'gpu-worker-build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
module.exports={buildGpuWorkerAssets,sourceFiles};
if(require.main===module){assert.ok(process.argv.length===3||process.argv.length===4&&process.argv[3]==='--resident','Usage: output-directory [--resident]');buildGpuWorkerAssets({out:process.argv[2]&&path.resolve(process.argv[2]),resident:process.argv[3]==='--resident'}).then(m=>console.log(JSON.stringify({files:Object.keys(m.files).length,payloadBytes:m.payloadBytes,activation:false}))).catch(e=>{console.error(e);process.exitCode=1;});}
