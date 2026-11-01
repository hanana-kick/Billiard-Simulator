/** Build-only wrapper around the ORIGINAL reviewed-source capability API. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const c=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for(const k of ['sourceRoot','outputDirectory'])assert.ok(typeof c[k]==='string'&&path.isAbsolute(c[k]));
assert.ok(!fs.existsSync(c.outputDirectory),'No overwrite');
const root=c.sourceRoot,imp=p=>import(pathToFileURL(path.join(root,p)).href);
const {verifyLiveWorldSourcePin}=await imp('tools/build-live-world-upload-seal.mjs');
const {buildVerifiedWasmGpuProgramAssets,readVerifiedWasmGpuProgramBuild}=await imp('tools/build-wasm-gpu-program-assets-verified.mjs');
const pin=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/live-world-upload-host-source-pin.json'),'utf8'));
const sourceToken=await verifyLiveWorldSourcePin(root,pin);
const capability=await buildVerifiedWasmGpuProgramAssets({root,sourceToken,outputDirectory:c.outputDirectory});
const receipt=readVerifiedWasmGpuProgramBuild(capability,'75c09c39e6d97085f4c4bf8045f0f892f121130d00340128101602de7df0e2df');
assert.equal(receipt.manifestSha256,'93f9bcc033060761a0a5dd445c4c8bf43eeca4c5088878d83e187c40fe628f02');
console.log(JSON.stringify(receipt));
