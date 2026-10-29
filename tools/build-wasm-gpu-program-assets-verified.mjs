/** Build-only reviewed-snapshot capability. Never refreshes/reviews a pin.
 * The child executes only materialized private snapshot code and bundled vendor
 * bytes, not imports from the mutable worktree. No GPU or network acquisition. */
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {snapshotVerifiedLiveWorldSources,BUILD_INPUT_PATHS} from './build-live-world-upload-seal.mjs';
const owned=new WeakMap(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAX_ENCODED=8*1024*1024,MAX_DECODED=64*1024*1024;
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function safeRelative(name){if(typeof name!=='string'||!name||name.includes('\\')||path.posix.isAbsolute(name)||path.posix.normalize(name)!==name||name.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Unsafe private snapshot path');return name;}
function flat(name){safeRelative(name);if(name.includes('/')||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))throw Error('Unsafe program filename');return name;}
function canonical(x){if(x===null||typeof x!=='object')return x;if(Array.isArray(x))return x.map(canonical);return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));}
async function regularBytes(root,name,max){flat(name);const file=path.join(root,name),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||await fs.realpath(file)!==file||stat.size>max)throw Error('Bounded regular private output required');return fs.readFile(file);}
async function runSnapshot(snapshotRoot,output,revision){
 const tool=path.join(snapshotRoot,'tools/build-wasm-gpu-program-assets.mjs');
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--max-old-space-size=256',tool,output,revision],{cwd:snapshotRoot,env:{PATH:process.env.PATH??'',NODE_OPTIONS:'',NODE_PATH:'',TZ:'UTC'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let log='',settled=false,terminationError=null;
  const terminate=error=>{if(!terminationError){terminationError=error;child.kill('SIGKILL');}};
  const timer=setTimeout(()=>terminate(Error('Private program build exceeded bounded duration')),180000);
  const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve();};
  const record=chunk=>{if(terminationError)return;log+=chunk.toString();if(Buffer.byteLength(log)>1024*1024){log=log.slice(-16000);terminate(Error('Private program build exceeded bounded diagnostics'));}};
  child.stdout.on('data',record);child.stderr.on('data',record);child.on('error',finish);
  // Await child and pipe closure before the finally block removes our temp root.
  child.on('close',(code,signal)=>finish(terminationError??(code===0?null:Error('Private program snapshot build failed ('+(signal??code)+'): '+log.slice(-16000)))));
 });
}
async function verifyOutputs(directory,snapshot){
 const manifestBytes=await regularBytes(directory,'manifest.json',2*1024*1024),manifest=JSON.parse(manifestBytes);
 if(manifest.format!=='wasm-gpu-program-assets-v1'||manifest.sourceRevision!==snapshot.revision||manifest.sourceVerification!=='caller-supplied-unverified'||manifest.gpuExecutionQualified!==false||manifest.publicActivation!==false||manifest.profile!=='mmq2-cushion'||manifest.bodyCount!==4||!same(manifest.widths,[1,3])||!Array.isArray(manifest.programs)||manifest.programs.length!==2)throw Error('Snapshot output manifest contract mismatch');
 const bytes=new Map(),names=new Set(['manifest.json']);
 async function artifact(d,kind){if(!d||d.encoding!=='gzip'||!Number.isSafeInteger(d.byteLength)||d.byteLength<1||d.byteLength>MAX_ENCODED||!Number.isSafeInteger(d.decodedByteLength)||d.decodedByteLength<1||d.decodedByteLength>MAX_DECODED||![d.sha256,d.decodedSha256,d.artifactSha256].every(digest))throw Error('Exact output artifact hashes and bounds required');const name=flat(d.file);if(names.has(name))throw Error('Duplicate output filename');names.add(name);const encoded=await regularBytes(directory,name,MAX_ENCODED);if(encoded.length!==d.byteLength||sha(encoded)!==d.sha256)throw Error('Encoded output artifact mismatch');const decoded=gunzipSync(encoded,{maxOutputLength:MAX_DECODED});if(decoded.length!==d.decodedByteLength||sha(decoded)!==d.decodedSha256)throw Error('Decoded output artifact mismatch');const a=JSON.parse(decoded),format=kind==='world'?'wasm-gpu-live-program-v1':kind==='raw'?'wasm-gpu-raw-program-v1':'wasm-gpu-selected-program-v1';if(a.format!==format||a.sha256!==d.artifactSha256||a.payload?.sourceRevision!==snapshot.revision||sha(JSON.stringify(kind==='raw'?a.payload:canonical(a.payload)))!==a.sha256)throw Error('Output source/artifact integrity mismatch');bytes.set(name,Buffer.from(encoded));return a.payload;}
 const widths=new Set();for(const p of manifest.programs){if(![1,3].includes(p.count)||widths.has(p.count)||p.profile!=='mmq2-cushion'||p.bodyCount!==4||p.maximumSteps!==2048)throw Error('Exact output program widths/profile required');widths.add(p.count);const world=await artifact(p.world,'world'),raw=await artifact(p.raw,'raw');if(world.count!==p.count||raw.count!==p.count||raw.maximumSteps!==2048||world.structuralConfig?.uploadManifest?.shape?.maxWorldSteps!==128||world.lowered.commands.indices.length+raw.commands.indices.length!==p.commandCount||p.commandCount>65536)throw Error('Output command/configuration mismatch');}
 const selected=manifest.selectedProgram;if(!selected||selected.count!==1||selected.bodyCount!==4||selected.profile!=='mmq2-cushion'||selected.strikeBackend!=='staged'||selected.maximumSteps!==2048||selected.maxWorldSteps!==128||selected.maximumRecords!==256)throw Error('Exact selected output configuration required');const program=await artifact(selected.artifact,'selected');if(program.commands.indices.length!==selected.commandCount||selected.commandCount>65536||program.allocations.reduce((n,a)=>n+a.size,0)!==selected.totalOwnedBytes||!same(program.outputs,selected.outputs))throw Error('Selected output resource/ABI mismatch');
 const s=manifest.scheduler;if(!s||!digest(s.sha256)||!digest(s.provenanceSha256))throw Error('Output scheduler hashes required');for(const name of [s.file,s.provenanceFile]){flat(name);if(names.has(name))throw Error('Duplicate scheduler output');names.add(name);}
 const wasm=await regularBytes(directory,s.file,2*1024*1024),provenance=await regularBytes(directory,s.provenanceFile,64*1024);if(wasm.length!==s.byteLength||sha(wasm)!==s.sha256||sha(provenance)!==s.provenanceSha256||!wasm.equals(Buffer.from(snapshot.buildInputBytes['artifacts/wasm-gpu-runtime.wasm']))||!provenance.equals(Buffer.from(snapshot.buildInputBytes['artifacts/wasm-gpu-runtime.wasm.build.json'])))throw Error('Output scheduler differs from reviewed snapshot');
 const p=JSON.parse(provenance),module=await WebAssembly.compile(wasm);if(p.abiVersion!==1||p.sha256!==s.sha256||p.byteLength!==wasm.length||!same(WebAssembly.Module.imports(module),p.imports)||!same(WebAssembly.Module.exports(module),p.exports))throw Error('Output scheduler ABI mismatch');bytes.set(s.file,Buffer.from(wasm));bytes.set(s.provenanceFile,Buffer.from(provenance));
 if(!same((await fs.readdir(directory)).sort(),[...names].sort()))throw Error('Unexpected output files from private build');
 // This is the only promotion point. GPU/public qualification stays false.
 manifest.sourceVerification='reviewed-source-snapshot';const promoted=Buffer.from(JSON.stringify(manifest,null,2)+'\n');bytes.set('manifest.json',promoted);return {bytes,manifestSha256:sha(promoted)};
}
/** A sourceToken is a private capability from verifyLiveWorldSourcePin. root is
 * only the explicit caller context; no worktree code is read after its snapshot. */
export async function buildVerifiedWasmGpuProgramAssets({root,sourceToken,outputDirectory}={}){
 if(typeof root!=='string'||!path.isAbsolute(root)||typeof outputDirectory!=='string'||!path.isAbsolute(outputDirectory))throw Error('Explicit absolute source/output directories required');
 const snapshot=snapshotVerifiedLiveWorldSources(sourceToken);
 if(!digest(snapshot.revision)||!same(Object.keys(snapshot.buildInputs).sort(),[...BUILD_INPUT_PATHS].sort())||sha(JSON.stringify({files:snapshot.files,buildInputs:snapshot.buildInputs}))!==snapshot.revision)throw Error('Reviewed source/build-input revision mismatch');
 const materialized=new Map();let total=0;for(const [name,text]of Object.entries(snapshot.files)){safeRelative(name);if(!name.startsWith('src/')||typeof text!=='string')throw Error('Exact private source closure required');const bytes=Buffer.from(text);total+=bytes.length;materialized.set(name,bytes);}
 for(const name of BUILD_INPUT_PATHS){safeRelative(name);const data=snapshot.buildInputBytes[name];if(!(data instanceof Uint8Array)||sha(data)!==snapshot.buildInputs[name]||materialized.has(name))throw Error('Reviewed build input snapshot mismatch');const bytes=Buffer.from(data);total+=bytes.length;materialized.set(name,bytes);}
 if(materialized.size>2048||total>128*1024*1024)throw Error('Private build snapshot exceeds bounded capsule');
 const temporary=await fs.mkdtemp(path.join(tmpdir(),'verified-wasm-program-'));try{
  const snapshotRoot=path.join(temporary,'source'),privateOutput=path.join(temporary,'output');await fs.mkdir(snapshotRoot);
  for(const [name,bytes]of materialized){const file=path.join(snapshotRoot,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes,{flag:'wx',mode:0o600});}
  await runSnapshot(snapshotRoot,privateOutput,snapshot.revision);const result=await verifyOutputs(privateOutput,snapshot);
  // Capture/verify every immutable byte before writing any caller-visible file.
  await fs.mkdir(outputDirectory,{recursive:true});const target=path.resolve(outputDirectory),stat=await fs.lstat(target);if(!stat.isDirectory()||stat.isSymbolicLink()||await fs.realpath(target)!==target)throw Error('Regular output directory without symlink traversal required');
  for(const [name,bytes]of [...result.bytes].sort(([a],[b])=>a==='manifest.json'?1:b==='manifest.json'?-1:a.localeCompare(b))){const handle=await fs.open(path.join(target,name),constants.O_WRONLY|constants.O_CREAT|constants.O_TRUNC|constants.O_NOFOLLOW,0o644);try{await handle.writeFile(bytes);}finally{await handle.close();}}
  const bootstrap=Object.freeze({sourceRevision:snapshot.revision,manifestSha256:result.manifestSha256,relativeBase:'wasm-gpu-programs/'}),capability=Object.freeze({kind:'verified-wasm-gpu-program-build-v1',sourceRevision:snapshot.revision,fileCount:result.bytes.size});owned.set(capability,bootstrap);return capability;
 }finally{await fs.rm(temporary,{recursive:true,force:true});}
}
export function readVerifiedWasmGpuProgramBuild(capability,expectedRevision){const bootstrap=owned.get(capability);if(!bootstrap||typeof expectedRevision!=='string'||bootstrap.sourceRevision!==expectedRevision)throw Error('Owned same-revision verified program build required');return bootstrap;}
