/** Isolated real-app candidate packaging; never deploys, installs, or runs GPU work.
 * Original physics pin, new compiled artifacts, new integration closure and Worker
 * bytes are distinct identities. A local build is NOT native/browser qualification.
 */
import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import{createHash}from'node:crypto';import{createRequire}from'node:module';import{spawnSync}from'node:child_process';
import{buildCanonicalRuntimeClosure}from'./build-app-runtime-closure.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex'),json=b=>JSON.parse(Buffer.from(b).toString('utf8'));
const sourceRevision='75c09c39e6d97085f4c4bf8045f0f892f121130d00340128101602de7df0e2df';
const manifestSHA='93f9bcc033060761a0a5dd445c4c8bf43eeca4c5088878d83e187c40fe628f02';
async function regularInRoot(root,name){const base=path.resolve(root),file=path.resolve(base,name);if(!file.startsWith(base+path.sep))throw Error('Source path escaped');const st=await fs.lstat(file);if(!st.isFile()||st.isSymbolicLink()||await fs.realpath(file)!==file)throw Error('Regular in-root source required '+name);return file;}
const safeName=n=>typeof n==='string'&&/^[A-Za-z0-9._-]+$/.test(n)&&!n.includes('..');
const frozenModule=(name,x)=>`const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x};export const ${name}=freeze(${JSON.stringify(x)});`;
async function checkedFile(root,name,expected,bytes){if(!safeName(name))throw Error('Flat asset path required');const b=await fs.readFile(path.join(root,name));if(sha(b)!==expected||bytes!==undefined&&b.length!==bytes)throw Error('Asset integrity '+name);return b;}
// Async module reads must not affect the emitted provenance JSON bytes.
export function orderedSourceHashes(record){return Object.fromEntries(Object.keys(record).sort().map(name=>[name,record[name]]));}
export async function buildCanonicalAppCandidate(c){
 for(const k of['assetsOutputDirectory','originalRoot','integrationRoot','programDirectory','dependencyDirectory','outputDirectory'])if(!path.isAbsolute(c[k]??''))throw Error('Explicit absolute '+k);
 if(c.sourceRevision!==sourceRevision||c.inputManifestSHA256!==manifestSHA)throw Error('Independent original pins required');
 if(Object.keys(c.programs??{}).sort().join(',')!=='search-N1,search-N3,selected-N1')throw Error('Complete explicit profile set required');
 if(await fs.stat(c.outputDirectory).then(()=>true,()=>false))throw Error('No overwrite of any candidate');await fs.mkdir(c.outputDirectory);
 const pin=json(await fs.readFile(await regularInRoot(c.originalRoot,'tests/fixtures/live-world-upload-host-source-pin.json')));
 if(pin.reviewStatus!=='reviewed'||sha(JSON.stringify({files:pin.files,buildInputs:pin.buildInputs}))!==sourceRevision)throw Error('Reviewed original source pin required');
 for(const [n,s]of Object.entries(pin.files))if(await fs.readFile(await regularInRoot(c.originalRoot,n),'utf8')!==s)throw Error('Original source drift '+n);
 for(const [n,s]of Object.entries(pin.buildInputs))if(sha(await fs.readFile(await regularInRoot(c.originalRoot,n)))!==s)throw Error('Original build input drift '+n);
 const {build,version}=createRequire(import.meta.url)(path.join(c.dependencyDirectory,'esbuild'));if(version!=='0.25.5')throw Error('Reviewed esbuild0.25.5 required');
 const closure=await buildCanonicalRuntimeClosure({root:c.integrationRoot,dependencyDirectory:c.dependencyDirectory,entry:'src/canonical-integer-transport/compiled-app-worker-protocol.mjs'});
 const sourceManifestBytes=await checkedFile(c.programDirectory,'manifest.json',manifestSHA),sourceManifest=json(sourceManifestBytes);
 const programOut=path.join(c.outputDirectory,'prepared-assets/wasm-gpu-programs');await fs.mkdir(programOut,{recursive:true});await fs.writeFile(path.join(programOut,'manifest.json'),sourceManifestBytes);
 for(const entry of sourceManifest.programs)for(const d of Object.values(entry.inputs)){const b=await checkedFile(c.programDirectory,d.file,d.sha256,d.byteLength);await fs.writeFile(path.join(programOut,d.file),b);}
 const selectedInput=sourceManifest.selectedProgram.inputs;await fs.writeFile(path.join(programOut,selectedInput.file),await checkedFile(c.programDirectory,selectedInput.file,selectedInput.sha256,selectedInput.byteLength));
 const scheduler=sourceManifest.scheduler,moduleBytes=await checkedFile(c.programDirectory,scheduler.file,scheduler.sha256,scheduler.byteLength);if(scheduler.sha256!==closure.closure.scheduler.sha256)throw Error('Runtime/original WASM mismatch');await fs.writeFile(path.join(programOut,scheduler.file),moduleBytes);
 const resourcePrograms={},workerPrograms={},derivedFiles=[];
 for(const key of['search-N1','search-N3','selected-N1']){
  const spec=c.programs[key],kind=key.startsWith('search')?'search':'selected',count=key==='search-N3'?3:1;
  const native=kind==='selected'&&spec.transport==='native-wgsl';if(!/^[a-f0-9]{64}$/.test(spec.artifactSHA256??'')||!/^[a-f0-9]{64}$/.test((native?spec.transformRevision:spec.compilerRevision)??''))throw Error('External compiled pins required '+key);
  const binary=await fs.readFile(spec.artifactFile);if(sha(binary)!==spec.artifactSHA256)throw Error('Independent compiled artifact mismatch '+key);
  const meta=native?json(binary):json(binary.subarray(16,16+binary.readUInt32LE(8)));if(meta.sourceRevision!==sourceRevision||(native?meta.transformRevision!==spec.transformRevision:meta.compilerRevision!==spec.compilerRevision))throw Error('Compiled source/compiler mismatch');
  const deriveConfig={kind,count,runtimeRoot:c.integrationRoot,artifactFile:spec.artifactFile,artifactSHA256:spec.artifactSHA256,compilerRevision:spec.compilerRevision,physicsSourceRevision:sourceRevision,...(native?{transport:spec.transport,transformRevision:spec.transformRevision,selectedArtifactSHA256:meta.selectedArtifactSHA256}:{})};
  const configFile=path.join(c.outputDirectory,key+'-resource-config.json');await fs.writeFile(configFile,JSON.stringify(deriveConfig));
  const derived=spawnSync(process.execPath,['--max-semi-space-size=4','--max-old-space-size=256',path.join(here,'derive-compiled-app-resource.mjs'),configFile],{encoding:'utf8',maxBuffer:1024*1024});if(derived.error||derived.status!==0)throw Error('Owned resource admission failed '+key+': '+(derived.error??derived.stderr??derived.signal));const facts=JSON.parse(derived.stdout);derivedFiles.push({key,facts});
  const program={count,profile:'mmq2-cushion',strikeBackend:'staged',bodyCount:4,maximumSteps:2048,maxWorldSteps:128,...(kind==='selected'?{maximumRecords:256}:{}),artifactSHA256:spec.artifactSHA256,artifactByteLength:binary.length,...(kind==='selected'?{selectedArtifactSHA256:meta.selectedArtifactSHA256}:{worldArtifactSHA256:meta.worldArtifactSHA256,rawArtifactSHA256:meta.rawArtifactSHA256}),...(native?{}:{commandSourceSHA256:meta.commandSourceSHA256})};
  const m={kind:native?'experimental-native-selected-manifest-v1':kind==='search'?'experimental-compiled-search-manifest-v1':'experimental-compiled-selected-manifest-v1',version:1,physicsSourceRevision:sourceRevision,...(native?{transformRevision:spec.transformRevision}:{compilerRevision:spec.compilerRevision}),runtimeRevision:closure.runtimeRevision,runtimeClosure:closure.closure,inputManifestSHA256:manifestSHA,program},mb=Buffer.from(JSON.stringify(m));
  const manifestFile='compiled-'+key+'.json',artifactFile='compiled-'+key+'.bin';await fs.writeFile(path.join(programOut,manifestFile),mb);await fs.writeFile(path.join(programOut,artifactFile),binary);
  workerPrograms[key]={manifestFile,manifestSHA256:sha(mb),artifactFile,artifactSHA256:spec.artifactSHA256,artifactByteLength:binary.length,...(native?{transport:spec.transport,transformRevision:spec.transformRevision}:{compilerRevision:spec.compilerRevision})};resourcePrograms[key]={...facts,compiledManifestSHA256:sha(mb)};
 }
 const resource={kind:'compiled-app-resource-receipt-v1',version:1,physicsSourceRevision:sourceRevision,runtimeRevision:closure.runtimeRevision,inputManifestSHA256:manifestSHA,schedulerSHA256:scheduler.sha256,programs:resourcePrograms},resourceBytes=Buffer.from(JSON.stringify(resource)),resourceSHA=sha(resourceBytes);
 await fs.writeFile(path.join(programOut,'compiled-resource-receipt.json'),resourceBytes);
 const PINS={physicsSourceRevision:sourceRevision,runtimeRevision:closure.runtimeRevision,inputManifestSHA256:manifestSHA,schedulerFile:scheduler.file,schedulerSHA256:scheduler.sha256,resourceReceiptFile:'compiled-resource-receipt.json',resourceReceiptSHA256:resourceSHA,programs:workerPrograms};
 const assets=path.dirname(programOut),workerFile='wasm-gpu-compute-worker.mjs',workerSources={};
 const worker=await build({entryPoints:[path.join(here,'compiled-app-worker-entry.mjs')],bundle:true,write:false,metafile:true,format:'esm',platform:'browser',target:'es2022',logLevel:'silent',plugins:[{name:'pinned-compiled-app-worker',setup(b){
  b.onResolve({filter:/^compiled-app-build-pins$/},()=>({path:'pins',namespace:'app-pins'}));b.onLoad({filter:/.*/,namespace:'app-pins'},()=>({contents:frozenModule('PINS',PINS),loader:'js'}));
  b.onResolve({filter:/^compiled-app-runtime\//},a=>({path:path.join(c.integrationRoot,'src',a.path.slice('compiled-app-runtime/'.length))}));
  b.onLoad({filter:/\.mjs$/},async a=>{const content=await fs.readFile(a.path);workerSources[path.relative(c.integrationRoot,a.path)]=sha(content);return{contents:content,loader:'js',resolveDir:path.dirname(a.path)};});
 }}]});
 for(const [name,expected]of Object.entries(closure.closure.files))if(workerSources[name]!==expected)throw Error('Worker bundle and sealed runtime closure differ '+name);
 if(worker.outputFiles.length!==1||Object.values(worker.metafile.outputs).some(o=>o.imports.length))throw Error('Self-contained real Worker required');const workerBytes=worker.outputFiles[0].contents;await fs.writeFile(path.join(assets,workerFile),workerBytes);
 const descriptor={file:workerFile,byteLength:workerBytes.length,sha256:sha(workerBytes),sourceRevision,programManifestSha256:manifestSHA};
 const config={sourceRevision,manifestSha256:manifestSHA,relativeBase:'wasm-gpu-programs/'},frontConfig={resourceReceiptSha256:resourceSHA,runtimeRevision:closure.runtimeRevision,physicsSourceRevision:sourceRevision,inputManifestSha256:manifestSHA,relativeFile:'compiled-resource-receipt.json'};
 const alias={'src/direct-candidate/canonical-practice-entry.mjs':'src/canonical-integer-transport/compiled-practice-entry.mjs','src/direct-candidate/canonical-selected-trace.mjs':'src/canonical-integer-transport/compiled-prefix-source-trace.mjs','src/direct-candidate/canonical-selected-trace-cpu.mjs':'src/canonical-integer-transport/compiled-prefix-source-collector.mjs','src/direct-candidate/canonical-session-service.mjs':'src/canonical-integer-transport/compiled-prefix-session-service.mjs','src/direct-candidate/canonical-application-adapter.mjs':'src/canonical-integer-transport/compiled-prefix-application-adapter.mjs','src/direct-candidate/canonical-controller-integration.mjs':'src/canonical-integer-transport/compiled-controller-integration.mjs','src/wasm-gpu/compute-generation-facade.mjs':'src/canonical-integer-transport/compiled-compute-generation-facade.mjs','src/wasm-gpu/production-runtime.mjs':'src/canonical-integer-transport/compiled-production-runtime.mjs','src/wasm-gpu/worker-owner-client.mjs':'src/canonical-integer-transport/compiled-worker-owner-client.mjs'},frontSources={},frontReadPaths={},ENTRY='src/direct-candidate/canonical-controller-browser-entry.mjs';
 const controller=await build({entryPoints:[ENTRY],bundle:true,write:false,metafile:true,format:'esm',platform:'browser',target:'es2022',logLevel:'silent',plugins:[{name:'original-physics-new-compiled-frontend',setup(b){
  b.onResolve({filter:/.*/},a=>{let name=a.importer?path.posix.normalize(path.posix.join(path.posix.dirname(a.importer),a.path)):path.posix.normalize(a.path);name=alias[name]??name;if(!name.startsWith('src/')||!name.endsWith('.mjs'))throw Error('Static internal controller graph required '+name);return{path:name,namespace:'app-source'};});
  b.onLoad({filter:/.*/,namespace:'app-source'},async a=>{let s;
   if(a.path==='src/direct-candidate/experimental-live-world-build-seal.mjs')s=`export const LIVE_WORLD_UPLOAD_SOURCE_SEALED=true;export const LIVE_WORLD_UPLOAD_SOURCE_REVISION=${JSON.stringify(sourceRevision)};`;
   else if(a.path==='src/wasm-gpu/build-configuration.mjs')s=frozenModule('WASM_GPU_BUILD_CONFIGURATION',config);
   else if(a.path==='src/wasm-gpu/worker-build-configuration.mjs')s=frozenModule('WASM_GPU_WORKER_BUILD_CONFIGURATION',descriptor);
   else if(a.path==='src/canonical-integer-transport/frontend-build-configuration.mjs')s=frozenModule('COMPILED_FRONTEND_BUILD_CONFIGURATION',frontConfig);
   else if(Object.hasOwn(pin.files,a.path))s=pin.files[a.path];
   else if(a.path.startsWith('src/canonical-integer-transport/')){s=await fs.readFile(await regularInRoot(c.integrationRoot,a.path),'utf8');frontReadPaths[a.path]=sha(s);}
   else throw Error('Unreviewed original controller import '+a.path);
   frontSources[a.path]=sha(s);return{contents:s,loader:'js'};
  });
 }}]});
 if(controller.outputFiles.length!==1||Object.values(controller.metafile.outputs).some(o=>o.imports.length))throw Error('Self-contained controller required');const controllerBytes=controller.outputFiles[0].contents;await fs.writeFile(path.join(assets,'canonical-controller.mjs'),controllerBytes);
 const manifest={schema:'canonical-controller-assets-compiled-candidate-v1',entrypoint:'canonical-controller.mjs',activation:false,automaticDeviceRequest:false,defaultBackendUnchanged:true,experimental:true,productionEnabled:false,browserVerified:false,nativeControllerVerified:false,searchSourceRevision:sourceRevision,compiledRuntimeRevision:closure.runtimeRevision,resourceReceiptSha256:resourceSHA,wasmGpuProgramBootstrap:config,wasmGpuWorkerBootstrap:descriptor,sha256:sha(controllerBytes),bytes:controllerBytes.length,sources:orderedSourceHashes(frontSources),workerSources:orderedSourceHashes(workerSources)};await fs.writeFile(path.join(assets,'manifest.json'),JSON.stringify(manifest,null,2));
 // Source checks again after bundling prevent mutable-root TOCTOU drift.
 for(const [name,expected]of Object.entries(closure.closure.files))if(sha(await fs.readFile(path.join(c.integrationRoot,name)))!==expected)throw Error('Runtime changed during build '+name);
 for(const [name,expected]of Object.entries(workerSources))if(sha(await fs.readFile(path.resolve(c.integrationRoot,name)))!==expected)throw Error('Worker source changed during build '+name);
 for(const [name,expected]of Object.entries(frontReadPaths))if(sha(await fs.readFile(path.join(c.integrationRoot,name)))!==expected)throw Error('Frontend source changed during build '+name);
 await fs.cp(assets,c.assetsOutputDirectory,{recursive:true});
 await fs.writeFile(path.join(c.assetsOutputDirectory,'build-receipt.json'),JSON.stringify({physicsSourceRevision:sourceRevision,runtimeRevision:closure.runtimeRevision,resourceReceiptSHA256:resourceSHA,worker:descriptor,controllerSHA256:sha(controllerBytes),programs:workerPrograms,resources:resourcePrograms},null,2));
 return manifest;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)console.log(JSON.stringify(await buildCanonicalAppCandidate(json(await fs.readFile(process.argv[2])))));
