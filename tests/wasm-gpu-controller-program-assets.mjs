/** Host-only build integration. Test-local review marker; never updates repo pin. */
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {createLiveWorldSealReviewCandidate} from '../tools/build-live-world-upload-seal.mjs';
import {buildCanonicalControllerAssetsVerified} from '../tools/build-canonical-controller-assets-verified.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=x=>createHash('sha256').update(x).digest('hex');
test('real unified controller embeds owned same-source bootstrap and bundles all three private-capture programs',{timeout:120000},async()=>{
 const temporary=await fs.mkdtemp(path.join(tmpdir(),'controller-program-integration-'));try{
  const pin=await createLiveWorldSealReviewCandidate(root);assert.equal(pin.reviewStatus,'UNREVIEWED');pin.reviewStatus='reviewed';const pinFile=path.join(temporary,'test-only-pin.json');await fs.writeFile(pinFile,JSON.stringify(pin));
  const out=path.join(temporary,'canonical-controller-assets'),manifest=await buildCanonicalControllerAssetsVerified({root,out,pinFile,includeWasmGpuPrograms:true});
  const bootstrap=manifest.wasmGpuProgramBootstrap;assert.equal(bootstrap.sourceRevision,manifest.searchSourceRevision);assert.equal(bootstrap.relativeBase,'wasm-gpu-programs/');assert.equal(manifest.unifiedSourceGraph,true);
  const programBytes=await fs.readFile(path.join(out,bootstrap.relativeBase,'manifest.json')),programs=JSON.parse(programBytes);assert.equal(sha(programBytes),bootstrap.manifestSha256);assert.equal(programs.sourceRevision,manifest.searchSourceRevision);assert.equal(programs.sourceVerification,'reviewed-source-snapshot');assert.deepEqual(programs.widths,[1,3]);assert.equal(programs.selectedProgram.maximumRecords,256);assert.equal(programs.gpuExecutionQualified,false);
  const code=await fs.readFile(path.join(out,manifest.entrypoint));assert.equal(sha(code),manifest.sha256);assert.ok(code.includes(Buffer.from(bootstrap.manifestSha256)));assert.ok(code.includes(Buffer.from(bootstrap.sourceRevision)));
  const oldFetch=globalThis.fetch,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');let calls=0;try{globalThis.fetch=()=>{calls++;throw Error('Import must be inert');};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter(){calls++;throw Error('No GPU in host build test');}}}});const api=await import(pathToFileURL(path.join(out,manifest.entrypoint)).href);assert.equal(typeof api.startCanonicalPractice,'function');assert.equal(calls,0);}finally{globalThis.fetch=oldFetch;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;}
 }finally{await fs.rm(temporary,{recursive:true,force:true});}
});
