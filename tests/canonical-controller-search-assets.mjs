import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOTS,SEAL_PATH,BUILD_INPUT_PATHS,BUILD_CONFIGURATION_PATH,BUILD_CONFIGURATION_STUB,verifyLiveWorldSourcePin,snapshotVerifiedLiveWorldSources,createLiveWorldSealReviewCandidate} from '../tools/build-live-world-upload-seal.mjs';
import {buildCanonicalControllerAssetsVerified,snapshotControllerSources} from '../tools/build-canonical-controller-assets-verified.mjs';
const rootHere=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),entry='src/direct-candidate/canonical-controller-browser-entry.mjs';
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'controller-search-assets-'));
 const write=async(name,text)=>{await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),text);};
 await write(BUILD_CONFIGURATION_PATH,BUILD_CONFIGURATION_STUB);
 await write(SEAL_PATH,await fs.readFile(path.join(rootHere,SEAL_PATH),'utf8'));
 await write(ROOTS[0],`import {LIVE_WORLD_UPLOAD_SOURCE_SEALED as sealed} from './experimental-live-world-build-seal.mjs';import {shared} from './shared.mjs';export function createCanonicalCompactSearchService(options){if(!sealed)throw Error('unsealed');return {options,shared,dispose(){globalThis.__testDisposed=(globalThis.__testDisposed||0)+1;}};}`);
 for(const name of ROOTS.slice(1))await write(name,'export {};');
 await write('src/wasm-gpu/production-runtime.mjs',`export async function createWasmGpuProductionRuntime(){return {dispose(){}};}export function assertWasmGpuProductionRuntime(value){if(!value)throw Error('Owned production runtime required');return value;}`);
 await write('src/direct-candidate/canonical-compact-search-service.mjs',`export {createCanonicalCompactSearchService as createCanonicalWasmCompactSearchService} from './experimental-live-world-sealed-entry.mjs';`);
 await write('src/direct-candidate/shared.mjs','export const shared=17;');
 await write(entry,await fs.readFile(path.join(rootHere,entry),'utf8'));
 await write('src/direct-candidate/canonical-page-preparation.mjs',await fs.readFile(path.join(rootHere,'src/direct-candidate/canonical-page-preparation.mjs'),'utf8'));
 await write('src/direct-candidate/canonical-practice-entry.mjs','export async function startCanonicalPracticeInternal(c,options){return options.requestDevice();}');
 await write('src/direct-candidate/canonical-controller-integration.mjs',`import {shared} from './shared.mjs';export function installCanonicalController(controller,options){if(controller==='fail')throw Error('install fail');return {controller,options,shared};}`);
 await write('src/direct-candidate/canonical-state-store.mjs','export function createCanonicalStateStore(options){return options;}');
 for(const name of BUILD_INPUT_PATHS)await write(name,'fixture '+name);
 const pin=await createLiveWorldSealReviewCandidate(root);pin.reviewStatus='reviewed';
 const pinFile=path.join(root,'pin.json');await fs.writeFile(pinFile,JSON.stringify(pin));
 return {root,pin,pinFile,write,out:path.join(root,'out'),cleanup:()=>fs.rm(root,{recursive:true,force:true})};
}
test('controller composition is inert, self-contained and internally owns sealed service',async()=>{
 const f=await fixture();try{
  const manifest=await buildCanonicalControllerAssetsVerified(f);assert.equal(manifest.searchSourceSealed,true);assert.equal(manifest.sharedSourceBytesVerified,true);assert.equal(manifest.activation,false);assert.equal(manifest.automaticDeviceRequest,false);assert.equal(manifest.explicitPracticeDeviceRequest,true);
  const source=await fs.readFile(path.join(f.out,manifest.entrypoint),'utf8');assert.doesNotMatch(source,/from\s+["'](?:\.\.?\/|https?:)/);
  const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));assert.deepEqual(Object.keys(api).sort(),['createCanonicalStateStore','installCanonicalController','startCanonicalPractice']);
  assert.throws(()=>api.installCanonicalController('idle',{device:{}}),/Owned production runtime/);
  assert.throws(()=>api.installCanonicalController('idle',{searchService:{}}),/owns/);
  const owned=api.installCanonicalController('idle',{productionRuntime:{},device:{tag:'device'},selectedWorldProfile:'mmq1-ball-ball',searchOptions:{maximumCandidates:12}});
  assert.equal(owned.options.searchService.shared,17);assert.equal(owned.options.searchService.options.maximumCandidates,12);assert.equal(owned.shared,17);
  const oldSecure=globalThis.isSecureContext,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');let requests=0;
  try{globalThis.isSecureContext=true;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>{requests++;return {limits:{maxStorageBuffersPerShaderStage:10},requestDevice:async opts=>({requested:opts})};}}}});
   assert.equal(requests,0);const explicit=await api.startCanonicalPractice('idle');assert.equal(requests,1);assert.deepEqual(explicit.requested,{requiredLimits:{maxStorageBuffersPerShaderStage:10}});
  }finally{globalThis.isSecureContext=oldSecure;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;}
  globalThis.__testDisposed=0;assert.throws(()=>api.installCanonicalController('fail',{productionRuntime:{},searchOptions:{}}),/install fail/);assert.equal(globalThis.__testDisposed,1);delete globalThis.__testDisposed;
 }finally{await f.cleanup();}
});
test('selected/batch shared bytes drift and unreviewed seals fail before artifacts',async()=>{
 const f=await fixture();try{
  await f.write('src/direct-candidate/shared.mjs','export const shared=18;');
  await assert.rejects(()=>snapshotControllerSources(f.root,f.pin),/shared source drift/);
  await assert.rejects(()=>buildCanonicalControllerAssetsVerified(f),/bytes drift/);
  assert.equal(await fs.stat(f.out).then(()=>true,()=>false),false);
 }finally{await f.cleanup();}
 const g=await fixture();try{g.pin.reviewStatus='UNREVIEWED';await fs.writeFile(g.pinFile,JSON.stringify(g.pin));await assert.rejects(()=>buildCanonicalControllerAssetsVerified(g),/Reviewed/);}finally{await g.cleanup();}
});
test('unified GPU wrapper requires ten bindings and rejects invalid profile before GPU access',async()=>{
 const f=await fixture(),oldSecure=globalThis.isSecureContext,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 let adapterRequests=0,deviceRequests=0,availableBindings=10;
 try{
  await f.write('src/direct-candidate/canonical-practice-entry.mjs',`export async function startCanonicalPracticeInternal(c,options){const device=await options.requestDevice();return options.install(c,{device,selectedWorldProfile:options.selectedWorldProfile});}`);
  await f.write('src/direct-candidate/canonical-controller-integration.mjs',`export function installCanonicalController(controller,options){globalThis.__assetInstallCalls++;return {controller,options};}`);
  const updated=await createLiveWorldSealReviewCandidate(f.root);updated.reviewStatus='reviewed';await fs.writeFile(f.pinFile,JSON.stringify(updated));
  const manifest=await buildCanonicalControllerAssetsVerified(f),source=await fs.readFile(path.join(f.out,manifest.entrypoint),'utf8');
  globalThis.__assetInstallCalls=0;globalThis.isSecureContext=true;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>{adapterRequests++;return {limits:{maxStorageBuffersPerShaderStage:availableBindings},requestDevice:async options=>{deviceRequests++;return {requested:options};}};}}}});
  const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  assert.equal(adapterRequests,0);assert.equal(deviceRequests,0);assert.equal(globalThis.__assetInstallCalls,0);
  const installed=await api.startCanonicalPractice('idle',{selectedWorldProfile:'mmq2-cushion'});
  assert.equal(installed.options.selectedWorldProfile,'mmq2-cushion');assert.deepEqual(installed.options.device.requested,{requiredLimits:{maxStorageBuffersPerShaderStage:10}});
  assert.equal(adapterRequests,1);assert.equal(deviceRequests,1);assert.equal(globalThis.__assetInstallCalls,1);
  availableBindings=9;
  await assert.rejects(()=>api.startCanonicalPractice('idle',{selectedWorldProfile:'mmq2-cushion'}),/10개/);
  assert.equal(adapterRequests,2);assert.equal(deviceRequests,1);assert.equal(globalThis.__assetInstallCalls,1);
  assert.throws(()=>api.startCanonicalPractice('idle',{selectedWorldProfile:'unknown'}),/공·쿠션 통합 모드/);
  assert.equal(adapterRequests,2);assert.equal(deviceRequests,1);assert.equal(globalThis.__assetInstallCalls,1);
 }finally{globalThis.isSecureContext=oldSecure;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;delete globalThis.__assetInstallCalls;await f.cleanup();}
});
test('one unified source graph preserves WeakMap brands across sealed and controller imports',async()=>{
 const f=await fixture();try{
  await f.write('src/direct-candidate/shared.mjs',`const owned=new WeakMap();export function make(){const value={};owned.set(value,17);return value;}export function accept(value){if(!owned.has(value))throw Error('Duplicate module brand');return owned.get(value);}`);
  await f.write(ROOTS[0],`import {LIVE_WORLD_UPLOAD_SOURCE_SEALED} from './experimental-live-world-build-seal.mjs';import {make} from './shared.mjs';export const sealedMake=()=>{if(!LIVE_WORLD_UPLOAD_SOURCE_SEALED)throw Error('unsealed');return make();};`);
  await f.write(entry,`import {sealedMake} from './experimental-live-world-sealed-entry.mjs';import {accept} from './shared.mjs';import {WASM_GPU_BUILD_CONFIGURATION} from '../wasm-gpu/build-configuration.mjs';export const probe=()=>({value:accept(sealedMake()),configuration:WASM_GPU_BUILD_CONFIGURATION});`);
  const pin=await createLiveWorldSealReviewCandidate(f.root);pin.reviewStatus='reviewed';await fs.writeFile(f.pinFile,JSON.stringify(pin));
  const manifest=await buildCanonicalControllerAssetsVerified(f),code=await fs.readFile(path.join(f.out,manifest.entrypoint),'utf8'),api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  assert.deepEqual(api.probe(),{value:17,configuration:null});assert.equal(manifest.unifiedSourceGraph,true);assert.equal(manifest.wasmGpuProgramBootstrap,null);assert.ok(manifest.sealedSearchBundleSHA256);assert.deepEqual(manifest.buildInputs,pin.buildInputs);
  await assert.rejects(()=>buildCanonicalControllerAssetsVerified({...f,programBuild:{sourceRevision:manifest.searchSourceRevision}}),/Owned|owned/);
 }finally{await f.cleanup();}
});
test('verified controller CLI rejects unknown activation flags before source access',async()=>{
 const {spawnSync}=await import('node:child_process');const tool=path.join(rootHere,'tools/build-canonical-controller-assets-verified.mjs');
 for(const args of [['/missing-root','/missing-output','--unknown'],['/missing-root','/missing-output','--wasm-gpu-programs','extra']]){const result=spawnSync(process.execPath,[tool,...args],{encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/Usage:.*--wasm-gpu-programs/);}
});
test('public entry and full controller graph require reviewed membership and reject post-token gate drift',async()=>{
 const f=await fixture();try{
  assert.ok(ROOTS.includes(entry));for(const name of [entry,'src/direct-candidate/canonical-controller-integration.mjs','src/wasm-gpu/production-runtime.mjs'])assert.equal(typeof f.pin.files[name],'string');
  const token=await verifyLiveWorldSourcePin(f.root,f.pin),snapshot=snapshotVerifiedLiveWorldSources(token),original=snapshot.files[entry];
  const incomplete={files:{...snapshot.files}};delete incomplete.files[entry];await assert.rejects(()=>snapshotControllerSources(f.root,incomplete),/Unreviewed controller source/);
  await f.write(entry,original+'\nthrow Error("unreviewed public gate executed");');
  await assert.rejects(()=>snapshotControllerSources(f.root,snapshot),/shared source drift/);await assert.rejects(()=>buildCanonicalControllerAssetsVerified(f),/bytes drift/);
  assert.equal(snapshotVerifiedLiveWorldSources(token).files[entry],original);assert.equal(await fs.stat(f.out).then(()=>true,()=>false),false);
 }finally{await f.cleanup();}
});
