const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {buildCanonicalControllerAssets}=require('../tools/build-canonical-controller-assets.cjs');
test('explicit browser bundle is local, import-inert and exports no injected lifecycle entry',async()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'canonical-controller-assets-'));try{const manifest=buildCanonicalControllerAssets({out});
  assert.equal(manifest.activation,false);assert.equal(manifest.defaultBackendUnchanged,true);assert.equal(manifest.automaticDeviceRequest,false);
  assert.equal(manifest.explicitPracticeEntry,true);assert.equal(manifest.explicitPracticeDeviceRequest,true);assert.equal(manifest.searchSourceSealed,true);assert.equal(manifest.sharedSourceBytesVerified,true);assert.match(manifest.searchSourceRevision,/^[0-9a-f]{64}$/);
  const old=globalThis.LabController;globalThis.LabController=class{constructor(){throw Error('no auto controller');}};
  try{const api=await import(pathToFileURL(path.join(out,manifest.entrypoint)).href);assert.deepEqual(Object.keys(api).sort(),['createCanonicalStateStore','installCanonicalController','startCanonicalPractice']);assert.throws(()=>api.installCanonicalController(null,{searchService:{}}),/owns the verified/);}
  finally{globalThis.LabController=old;}
  assert.ok(manifest.sources['src/controller.js']===undefined);assert.ok(manifest.sources['src/direct-candidate/canonical-controller-integration.mjs']);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
