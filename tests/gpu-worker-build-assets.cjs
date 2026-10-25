'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),vm=require('node:vm');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {buildGpuWorkerAssets,sourceFiles}=require('../tools/build-gpu-worker-assets.cjs');
const root=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('explicit builder fails closed without admitted provenance and writes nothing',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gpu-build-negative-')),out=path.join(dir,'out');
 try{await assert.rejects(buildGpuWorkerAssets({root,out,provenanceFile:''}),/explicit RAPIER_WASM_PROVENANCE/);assert.equal(fs.existsSync(out),false);
 const p=path.join(dir,'bad.json');fs.writeFileSync(p,JSON.stringify({build:{sources:{'../outside':'bad'}}}));await assert.rejects(buildGpuWorkerAssets({root,out,provenanceFile:p}),/Relative decoder source/);assert.equal(fs.existsSync(out),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('built graph is local, byte-exact, import-resolvable and browser-module initialized without GPU',async t=>{
 assert.ok(process.env.RAPIER_WASM_PROVENANCE,'Set explicit admitted decoder manifest to verify real packaging');assert.equal(typeof vm.SourceTextModule,'function','Run with --experimental-vm-modules');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gpu-build-assets-'));
 try{
  const manifest=await buildGpuWorkerAssets({root,out:dir});assert.equal(manifest.activation,false);
  let bytes=0;for(const [file,row]of Object.entries(manifest.files)){const b=fs.readFileSync(path.join(dir,file));bytes+=b.length;assert.equal(b.length,row.bytes);assert.equal(hash(b),row.sha256);if(/\.(js|mjs)$/.test(file))assert.deepEqual(b,fs.readFileSync(path.join(root,file)));}
  assert.equal(bytes,manifest.payloadBytes);assert.ok(sourceFiles(root).includes('src/experimental-plan-batch-scheduler.js'));
  assert.ok(!Object.keys(manifest.files).some(f=>f.startsWith('tests/')||f.includes('node_modules')));
  const config=JSON.parse(fs.readFileSync(path.join(dir,'src/bounded-gpu-shot/four-ball-worker-assets.json')));
  assert.equal(config.provenance.wasmPath,'four-ball-worker-decoder.wasm');assert.equal(config.provenance.notices.path,'four-ball-worker-NOTICES.txt');
  const context=vm.createContext({structuredClone,TextEncoder,TextDecoder}),modules=new Map();
  const resolve=(s,ref)=>{assert.match(s,/^\.{1,2}\//,'No network or bare module resolution');const url=new URL(s,ref);assert.equal(url.protocol,'file:');assert.equal(url.search+url.hash,'');const file=path.relative(dir,fileURLToPath(url));assert.ok(manifest.files[file],file);return url.href;};
  function get(url){if(modules.has(url))return modules.get(url);const source=fs.readFileSync(fileURLToPath(url),'utf8');const m=new vm.SourceTextModule(source,{context,identifier:url,initializeImportMeta(meta){meta.url=url;},importModuleDynamically:(s,r)=>evaluate(resolve(s,r.identifier))});modules.set(url,m);return m;}
  async function evaluate(url){const m=get(url);if(m.status==='unlinked')await m.link((s,r)=>get(resolve(s,r.identifier)));if(m.status==='linked')await m.evaluate();assert.equal(m.status,'evaluated');return m;}
  const runtime=await evaluate(pathToFileURL(path.join(dir,'src/bounded-gpu-shot/four-ball-worker-runtime.mjs')).href);
  const loaded=await runtime.namespace.loadWorkerRuntime();assert.equal(typeof loaded.createCurrentSourceFourBallShotService,'function');
  const topology=vm.runInContext('LabCueConvexTopologyExperimental',context);
  const batch=await evaluate(pathToFileURL(path.join(dir,manifest.optionalBatchModule)).href);assert.equal(typeof batch.namespace.createGpuBatchStepper,'function');assert.equal(batch.namespace.CAPABILITY.productionDefault,false);
  assert.equal(vm.runInContext('LabCueConvexTopologyExperimental',context),topology,'Single hull authority remains shared');
  const client=await evaluate(pathToFileURL(path.join(dir,'src/bounded-gpu-shot/evaluation.mjs')).href);assert.equal(typeof client.namespace.createBoundedFourBallEvaluationClient,'function');
  // Static-link every emitted module, including both dedicated-worker entries,
  // without evaluating worker-only boot code or supplying a fake GPU.
  for(const file of Object.keys(manifest.files).filter(f=>/\.(mjs|js)$/.test(f))){const m=get(pathToFileURL(path.join(dir,file)).href);if(m.status==='unlinked')await m.link((s,r)=>get(resolve(s,r.identifier)));}
  assert.equal(vm.runInContext('typeof module+":"+typeof require+":"+typeof navigator',context),'undefined:undefined:undefined');
  t.diagnostic(JSON.stringify({files:Object.keys(manifest.files).length,payloadBytes:bytes,modules:modules.size,networkTransferMeasured:false,gpuExecuted:false}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
