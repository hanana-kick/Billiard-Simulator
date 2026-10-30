import {REVIEWED_SELECTED_OWNED_BYTES} from './helpers/reviewed-endpoint-cache-delta.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
import {createLiveWorldSealReviewCandidate,verifyLiveWorldSourcePin,snapshotVerifiedLiveWorldSources,BUILD_INPUT_PATHS} from '../tools/build-live-world-upload-seal.mjs';
import {buildVerifiedWasmGpuProgramAssets,readVerifiedWasmGpuProgramBuild} from '../tools/build-wasm-gpu-program-assets-verified.mjs';
const sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),sha=x=>createHash('sha256').update(x).digest('hex');
async function fixture(){
 const root=await fs.mkdtemp(path.join(tmpdir(),'verified-program-test-')),candidate=await createLiveWorldSealReviewCandidate(sourceRoot);
 try{for(const [name,text]of Object.entries(candidate.files)){await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),text);}for(const name of BUILD_INPUT_PATHS){await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),await fs.readFile(path.join(sourceRoot,name)));}
 // TEST ONLY: an isolated temporary candidate acts as the review authority. No
 // repository pin is edited, auto-reviewed, or accepted by a public build.
 const pin=await createLiveWorldSealReviewCandidate(root);pin.reviewStatus='reviewed';const token=await verifyLiveWorldSourcePin(root,pin);return {root,pin,token,cleanup:()=>fs.rm(root,{recursive:true,force:true})};
 }catch(error){await fs.rm(root,{recursive:true,force:true});throw error;}
}
test('genuine private reviewed snapshot builds all programs despite mutable source/tool drift',{timeout:120000},async()=>{
 const f=await fixture();try{
 const out=path.join(f.root,'built','wasm-gpu-programs'),saved=snapshotVerifiedLiveWorldSources(f.token);
 const copy=snapshotVerifiedLiveWorldSources(f.token);copy.buildInputBytes['vendor/rapier.cjs'].fill(0);
 await fs.writeFile(path.join(f.root,'src/math.js'),'throw Error("MUTABLE WORKTREE SOURCE EXECUTED");');await fs.writeFile(path.join(f.root,'tools/build-wasm-gpu-program-assets.mjs'),'throw Error("MUTABLE BUILD TOOL EXECUTED");');f.pin.files['src/math.js']='caller pin mutation';
 const cap=await buildVerifiedWasmGpuProgramAssets({root:f.root,sourceToken:f.token,outputDirectory:out}),bootstrap=readVerifiedWasmGpuProgramBuild(cap,f.token.revision);
 assert.ok(Object.isFrozen(bootstrap));assert.deepEqual(Object.keys(bootstrap).sort(),['manifestSha256','relativeBase','sourceRevision']);assert.equal(bootstrap.relativeBase,'wasm-gpu-programs/');assert.equal(bootstrap.sourceRevision,f.token.revision);
 const bytes=await fs.readFile(path.join(out,'manifest.json'));assert.equal(sha(bytes),bootstrap.manifestSha256);const manifest=JSON.parse(bytes);assert.equal(manifest.sourceVerification,'reviewed-source-snapshot');assert.equal(manifest.sourceRevision,f.token.revision);assert.equal(manifest.publicActivation,false);assert.equal(manifest.gpuExecutionQualified,false);
 assert.deepEqual(manifest.widths,[1,3]);assert.equal(manifest.selectedProgram.commandCount,55403);assert.equal(manifest.selectedProgram.totalOwnedBytes,REVIEWED_SELECTED_OWNED_BYTES);
 for(const info of [...manifest.programs.flatMap(p=>[p.world,p.raw]),manifest.selectedProgram.artifact]){const encoded=await fs.readFile(path.join(out,info.file)),decoded=gunzipSync(encoded);assert.equal(sha(encoded),info.sha256);assert.equal(encoded.length,info.byteLength);assert.equal(sha(decoded),info.decodedSha256);assert.equal(decoded.length,info.decodedByteLength);const artifact=JSON.parse(decoded);assert.equal(artifact.sha256,info.artifactSha256);assert.equal(artifact.payload.sourceRevision,f.token.revision);assert.doesNotMatch(decoded.toString(),/"initial"\s*:/);}
 assert.deepEqual(await fs.readFile(path.join(out,manifest.scheduler.file)),Buffer.from(saved.buildInputBytes['artifacts/wasm-gpu-runtime.wasm']));
 assert.throws(()=>readVerifiedWasmGpuProgramBuild({...cap},f.token.revision),/Owned/);assert.throws(()=>readVerifiedWasmGpuProgramBuild(cap,'other'),/same-revision/);
 assert.equal((await fs.readdir(path.join(f.root,'built'))).length,1,'only requested output directory was published');
 }finally{await f.cleanup();}
});
test('forged capability, unreviewed pin, source drift and build input drift fail closed',async()=>{
 const f=await fixture();try{
 await assert.rejects(()=>buildVerifiedWasmGpuProgramAssets({root:f.root,sourceToken:{...f.token},outputDirectory:path.join(f.root,'no-output')}),/Owned/);await assert.rejects(()=>verifyLiveWorldSourcePin(f.root,{...f.pin,reviewStatus:'UNREVIEWED'}),/Reviewed/);
 const name='src/math.js',before=await fs.readFile(path.join(f.root,name));await fs.appendFile(path.join(f.root,name),'\n// source drift');await assert.rejects(()=>verifyLiveWorldSourcePin(f.root,f.pin),/bytes drift/);await fs.writeFile(path.join(f.root,name),before);
 await fs.appendFile(path.join(f.root,'tools/build-wasm-gpu-program-assets.mjs'),'\n// build input drift');await assert.rejects(()=>verifyLiveWorldSourcePin(f.root,f.pin),/Build input bytes drift/);
 await assert.rejects(()=>fs.stat(path.join(f.root,'no-output')),/ENOENT/);
 }finally{await f.cleanup();}
});
test('bad snapshotted scheduler provenance stops child before any assets are copied',async()=>{
 const f=await fixture();try{
 const wasm=path.join(f.root,'artifacts/wasm-gpu-runtime.wasm'),bytes=await fs.readFile(wasm);bytes[bytes.length-1]^=1;await fs.writeFile(wasm,bytes);
 const pin=await createLiveWorldSealReviewCandidate(f.root);pin.reviewStatus='reviewed';const token=await verifyLiveWorldSourcePin(f.root,pin),out=path.join(f.root,'no-assets');
 await assert.rejects(()=>buildVerifiedWasmGpuProgramAssets({root:f.root,sourceToken:token,outputDirectory:out}),/snapshot build failed.*provenance\/binary mismatch/s);await assert.rejects(()=>fs.stat(out),/ENOENT/);
 }finally{await f.cleanup();}
});
test('builder source executes snapshot child only with bounded heap and no runtime factory imports',async()=>{
 const source=await fs.readFile(new URL('../tools/build-wasm-gpu-program-assets-verified.mjs',import.meta.url),'utf8');assert.match(source,/--max-old-space-size=256/);assert.doesNotMatch(source,/from ['"][^'"]*src\//);assert.doesNotMatch(source,/requestAdapter\(|requestDevice\(|\.queue\.submit\(/);
});
