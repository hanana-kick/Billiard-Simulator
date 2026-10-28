const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {buildCanonicalControllerAssets}=require('../tools/build-canonical-controller-assets.cjs');
test('explicit browser bundle is local, import-inert and exports no injected lifecycle entry',async()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'canonical-controller-assets-'));try{const manifest=buildCanonicalControllerAssets({out});
  assert.equal(manifest.activation,false);assert.equal(manifest.defaultBackendUnchanged,true);assert.equal(manifest.automaticDeviceRequest,false);
  assert.equal(manifest.explicitPracticeEntry,true);assert.equal(manifest.explicitPracticeDeviceRequest,true);assert.equal(manifest.searchSourceSealed,true);assert.equal(manifest.sharedSourceBytesVerified,true);assert.match(manifest.searchSourceRevision,/^[0-9a-f]{64}$/);
  const old=globalThis.LabController;globalThis.LabController=class{constructor(){throw Error('no auto controller');}};
  try{const api=await import(pathToFileURL(path.join(out,manifest.entrypoint)).href);assert.deepEqual(Object.keys(api).sort(),['createCanonicalStateStore','installCanonicalController','startCanonicalPractice']);assert.throws(()=>api.installCanonicalController(null,{searchService:{}}),/owns the verified/);
   for(const profile of ['mmq1-ball-ball','unknown'])assert.throws(()=>api.startCanonicalPractice(null,{selectedWorldProfile:profile}),/통합 모드/);
   const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldSecure=Object.getOwnPropertyDescriptor(globalThis,'isSecureContext');let adapters=0,devices=0;
   try{
    Object.defineProperty(globalThis,'isSecureContext',{configurable:true,value:true});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(){adapters++;return {limits:{maxStorageBuffersPerShaderStage:9},requestDevice(){devices++;throw Error('must not create GPU device');}};}}}});
    const c={state:{ready:true,paused:true,settings:{},routeOptions:{}},lab:{anyMotion:()=>false},game:{},undoStack:[],redoStack:[],worldStamp:()=>0};
    await assert.rejects(()=>api.startCanonicalPractice(c),/저장 버퍼 10개/);assert.equal(adapters,1);assert.equal(devices,0);
   }finally{for(const [key,descriptor]of [['navigator',oldNavigator],['isSecureContext',oldSecure]]){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
}
  finally{globalThis.LabController=old;}
  assert.ok(manifest.sources['src/controller.js']===undefined);assert.ok(manifest.sources['src/direct-candidate/canonical-controller-integration.mjs']);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
