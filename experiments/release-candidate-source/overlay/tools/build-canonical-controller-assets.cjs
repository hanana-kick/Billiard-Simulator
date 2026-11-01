'use strict';
// Normal opt-in build: source-generated, independently pinned compiled transport.
// Failure is fatal; never fall back to the historical eager-pipeline Worker.
const path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
function buildCanonicalControllerAssets({root=path.resolve(__dirname,'..'),out,includeWasmGpuPrograms=false}={}){
 assert.equal(typeof includeWasmGpuPrograms,'boolean','Explicit program build option');
 // Explicit program-free diagnostics cannot emit an old or new GPU Worker.
 if(!includeWasmGpuPrograms){
  assert.ok(out&&path.isAbsolute(out),'Explicit absolute output directory');
  const r=spawnSync(process.execPath,[path.join(root,'tools/build-canonical-controller-assets-verified.mjs'),root,out],{encoding:'utf8',maxBuffer:4*1024*1024});
  if(r.error)throw r.error;if(r.status!==0)throw Error('Program-free diagnostic build failed: '+(r.stderr||r.stdout||r.signal));
  const m=JSON.parse(r.stdout);assert.equal(m.wasmGpuProgramBootstrap,null);return m;
 }
 assert.ok(out&&path.isAbsolute(out),'Explicit absolute output directory');
 const result=spawnSync(process.execPath,[path.join(root,'tools/compiled-release/build-release-assets.mjs'),root,out],{encoding:'utf8',maxBuffer:4*1024*1024});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('Compiled canonical source build failed: '+(result.stderr||result.stdout||result.signal));
 const manifest=JSON.parse(result.stdout);
 assert.equal(manifest.schema,'canonical-controller-assets-compiled-candidate-v1');
 assert.ok(manifest.wasmGpuProgramBootstrap?.manifestSha256,'Verified original input manifest required');
 return manifest;
}
module.exports={buildCanonicalControllerAssets};
if(require.main===module){assert.equal(process.argv.length,3,'Usage: node tools/build-canonical-controller-assets.cjs /absolute/output');console.log(JSON.stringify(buildCanonicalControllerAssets({out:process.argv[2],includeWasmGpuPrograms:true})));}
