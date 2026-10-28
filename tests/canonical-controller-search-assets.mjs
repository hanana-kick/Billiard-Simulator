import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOTS,SEAL_PATH,createLiveWorldSealReviewCandidate} from '../tools/build-live-world-upload-seal.mjs';
import {buildCanonicalControllerAssetsVerified,snapshotControllerSources} from '../tools/build-canonical-controller-assets-verified.mjs';
const rootHere=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),entry='src/direct-candidate/canonical-controller-browser-entry.mjs';
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'controller-search-assets-'));
 const write=async(name,text)=>{await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),text);};
 await write(SEAL_PATH,await fs.readFile(path.join(rootHere,SEAL_PATH),'utf8'));
 await write(ROOTS[0],`import {LIVE_WORLD_UPLOAD_SOURCE_SEALED as sealed} from './experimental-live-world-build-seal.mjs';import {shared} from './shared.mjs';export function createCanonicalCompactSearchService(options){if(!sealed)throw Error('unsealed');return {options,shared,dispose(){globalThis.__testDisposed=(globalThis.__testDisposed||0)+1;}};}`);
 for(const name of ROOTS.slice(1))await write(name,'export {};');
 await write('src/direct-candidate/shared.mjs','export const shared=17;');
 await write(entry,await fs.readFile(path.join(rootHere,entry),'utf8'));
 await write('src/direct-candidate/canonical-practice-entry.mjs','export async function startCanonicalPracticeInternal(c,options){return options.requestDevice();}');
 await write('src/direct-candidate/canonical-controller-integration.mjs',`import {shared} from './shared.mjs';export function installCanonicalController(controller,options){if(controller==='fail')throw Error('install fail');return {controller,options,shared};}`);
 await write('src/direct-candidate/canonical-state-store.mjs','export function createCanonicalStateStore(options){return options;}');
 const pin=await createLiveWorldSealReviewCandidate(root);pin.reviewStatus='reviewed';
 const pinFile=path.join(root,'pin.json');await fs.writeFile(pinFile,JSON.stringify(pin));
 return {root,pin,pinFile,write,out:path.join(root,'out'),cleanup:()=>fs.rm(root,{recursive:true,force:true})};
}
test('controller composition is inert, self-contained and internally owns sealed service',async()=>{
 const f=await fixture();try{
  const manifest=await buildCanonicalControllerAssetsVerified(f);assert.equal(manifest.searchSourceSealed,true);assert.equal(manifest.sharedSourceBytesVerified,true);assert.equal(manifest.activation,false);assert.equal(manifest.automaticDeviceRequest,false);assert.equal(manifest.explicitPracticeDeviceRequest,true);
  const source=await fs.readFile(path.join(f.out,manifest.entrypoint),'utf8');assert.doesNotMatch(source,/from\s+["'](?:\.\.?\/|https?:)/);
  const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));assert.deepEqual(Object.keys(api).sort(),['createCanonicalStateStore','installCanonicalController','startCanonicalPractice']);
  const plain=api.installCanonicalController('idle',{device:{}});assert.equal(plain.options.searchService,undefined);
  assert.throws(()=>api.installCanonicalController('idle',{searchService:{}}),/owns/);
  const owned=api.installCanonicalController('idle',{device:{tag:'device'},selectedWorldProfile:'mmq1-ball-ball',searchOptions:{maximumCandidates:12}});
  assert.equal(owned.options.searchService.shared,17);assert.equal(owned.options.searchService.options.maximumCandidates,12);assert.equal(owned.shared,17);
  const oldSecure=globalThis.isSecureContext,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');let requests=0;
  try{globalThis.isSecureContext=true;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>{requests++;return {limits:{maxStorageBuffersPerShaderStage:10},requestDevice:async opts=>({requested:opts})};}}}});
   assert.equal(requests,0);const explicit=await api.startCanonicalPractice('idle');assert.equal(requests,1);assert.deepEqual(explicit.requested,{requiredLimits:{maxStorageBuffersPerShaderStage:10}});
  }finally{globalThis.isSecureContext=oldSecure;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;}
  globalThis.__testDisposed=0;assert.throws(()=>api.installCanonicalController('fail',{searchOptions:{}}),/install fail/);assert.equal(globalThis.__testDisposed,1);delete globalThis.__testDisposed;
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
