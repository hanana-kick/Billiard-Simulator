/** HOST ONLY: real pinned shipped manifests/artifacts/input contracts and actual
 * app RPC facade. Intentionally invalid native device stops before any GPU work. */
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';import http from'node:http';import{createHash}from'node:crypto';
import{createWasmGpuInputLibrary}from'../src/wasm-gpu/input-library.mjs';
import{loadCompiledFrontendResourcePolicy}from'../src/canonical-integer-transport/frontend-resource-policy.mjs';
import{createExperimentalCompiledInputLibrary}from'../src/canonical-integer-transport/compiled-program-library.mjs';
import{createCompiledSelectedInputLibrary}from'../src/canonical-integer-transport/selected-program-library.mjs';
import{createCompiledAppWorkerProtocol}from'../src/canonical-integer-transport/compiled-app-worker-protocol.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('actual app RPC lookup admits all three pinned profiles with original descriptive structural bounds; extra caller keys still rejected',async()=>{
 const root='/tmp/billiard-real-app-compiled-candidate-v2',receipt=await fs.readFile(root+'/candidate-build-receipt.json');assert.equal(sha(receipt),'0bad4a246823a04d08fb8c3390c7b8387ce03c8f126d05ac8e4efebadbeb7236');const app=JSON.parse(receipt),dir=app.site+'/canonical-controller-assets/wasm-gpu-programs/',read=async name=>new Uint8Array(await fs.readFile(dir+name));
 const server=http.createServer(async(req,res)=>{const name=req.url.slice(1);if(!/^[a-zA-Z0-9._-]+$/.test(name)){res.writeHead(404);res.end();return;}try{res.end(await read(name));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/';const prior=globalThis.location;globalThis.location=new URL(base);
 try{const inputLibrary=await createWasmGpuInputLibrary({baseURL:base,expectedManifestSha256:app.worker.programManifestSha256,expectedSourceRevision:app.physicsSourceRevision});assert.deepEqual(inputLibrary.manifest.structuralBounds.widths,[1,3]);assert.equal(inputLibrary.manifest.structuralBounds.maximumCommands,131072);assert.equal(typeof inputLibrary.manifest.structuralBounds.mutableInputs,'string');
 const resourcePolicy=await loadCompiledFrontendResourcePolicy(await read('compiled-resource-receipt.json'),{expectedSHA256:app.resourceReceiptSHA256,expectedSourceRevision:app.physicsSourceRevision,expectedRuntimeRevision:app.runtimeRevision,expectedInputManifestSHA256:app.worker.programManifestSha256}),moduleBytes=await read('wasm-gpu-runtime.wasm');
 for(const key of ['search-N1','search-N3','selected-N1']){const p=app.programs[key],factory=key.startsWith('search')?createExperimentalCompiledInputLibrary:createCompiledSelectedInputLibrary,library=await factory({inputLibrary,manifestBytes:await read(p.manifestFile),compiledBytes:await read(p.artifactFile),expectedManifestSHA256:p.manifestSHA256,expectedPhysicsSourceRevision:app.physicsSourceRevision,expectedCompilerRevision:p.compilerRevision,expectedRuntimeRevision:app.runtimeRevision});const selector={sourceRevision:app.physicsSourceRevision,count:key==='search-N3'?3:1,profile:'mmq2-cushion',strikeBackend:'staged',bodyCount:4,maximumSteps:2048,maxWorldSteps:128,...(key==='selected-N1'?{maximumRecords:256}:{})};
 const lookup=key==='selected-N1'?'lookupSelectedProgram':'lookupProgram';await assert.rejects(library[lookup]({...selector,maximumCommands:131072}),/Exact (compiled manifest schema|selected manifest fields) required/);
 let lost;const messages=[],device={lost:new Promise(r=>lost=r),queue:{onSubmittedWorkDone:async()=>{}},destroy(){lost({reason:'destroyed'});}};
 const protocol=await createCompiledAppWorkerProtocol({inputLibrary,resourcePolicy,moduleBytes,initialGeneration:1,loadCompiledLibrary:async requested=>{assert.equal(requested,key);return library;},requestDevice:async()=>device,send:m=>messages.push(m)});
 await protocol.handle({v:1,generation:1,id:1,op:'prepare',program:key.startsWith('search')?'search':'selected',width:selector.count});const response=messages.find(m=>m.id===1&&typeof m.ok==='boolean');assert.equal(response.ok,false);assert.match(response.error.message,/Resident scheduler requires the existing ten-storage-buffer device contract and device loss/,key+': '+response.error.message);
 await protocol.handle({v:1,generation:1,id:2,op:'dispose'});assert.equal(messages.at(-1).destroyed,true);assert.equal(messages.at(-1).ownedBytes,0);
 }
 }finally{globalThis.location=prior;await new Promise(r=>server.close(r));}
});
