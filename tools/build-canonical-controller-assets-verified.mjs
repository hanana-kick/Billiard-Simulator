/** Build-only composition. Every runtime source is snapshotted before bundling. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import esbuild from 'esbuild';
import {ROOTS,SEAL_PATH,BUILD_CONFIGURATION_PATH,staticSourceDependencies,verifyLiveWorldSourcePin,snapshotVerifiedLiveWorldSources,buildVerifiedLiveWorldBundle} from './build-live-world-upload-seal.mjs';
const ENTRY='src/direct-candidate/canonical-controller-browser-entry.mjs';
const SEALED_ENTRY=ROOTS[0];
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function snapshotControllerSources(root,pin){
 const files={},pending=[ENTRY];
 while(pending.length){
  const name=pending.pop();if(name===SEALED_ENTRY||Object.hasOwn(files,name))continue;
  const filename=path.resolve(root,name);
  if(filename!==path.join(path.resolve(root),name))throw Error('Controller source path escaped');
  const stat=await fs.lstat(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||await fs.realpath(filename)!==filename)throw Error('Regular in-root controller source required');
  const bytes=await fs.readFile(filename),source=bytes.toString('utf8');
  if(!Buffer.from(source).equals(bytes))throw Error('Exact UTF-8 controller source required');
  if(!Object.hasOwn(pin.files,name))throw Error('Unreviewed controller source: '+name);
  if(pin.files[name]!==source)throw Error('Selected/batch shared source drift: '+name);
  files[name]=source;pending.push(...staticSourceDependencies(name,source));
 }
 return Object.freeze(Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b))));
}
export async function buildCanonicalControllerAssetsVerified({root,out,pinFile=path.join(root,'tests/fixtures/live-world-upload-host-source-pin.json'),includeWasmGpuPrograms=false,programBuild}={}){
 if(!path.isAbsolute(root)||!path.isAbsolute(out))throw Error('Explicit absolute root and output required');
 const pin=JSON.parse(await fs.readFile(pinFile,'utf8'));
 const token=await verifyLiveWorldSourcePin(root,pin);
 // Shared numerical/host source bytes must match exactly, not merely a revision label.
 const verified=snapshotVerifiedLiveWorldSources(token);
 const controllerFiles=await snapshotControllerSources(root,{files:verified.files});
 const files={...controllerFiles,...verified.files};
 if(typeof includeWasmGpuPrograms!=='boolean'||includeWasmGpuPrograms&&programBuild!==undefined)throw Error('Explicit single program build option required');
 let bootstrap=null;
 if(includeWasmGpuPrograms||programBuild!==undefined){const programs=await import('./build-wasm-gpu-program-assets-verified.mjs');if(includeWasmGpuPrograms)programBuild=await programs.buildVerifiedWasmGpuProgramAssets({root,sourceToken:token,outputDirectory:path.join(out,'wasm-gpu-programs')});bootstrap=programs.readVerifiedWasmGpuProgramBuild(programBuild,verified.revision);const manifestBytes=await fs.readFile(path.join(out,bootstrap.relativeBase,'manifest.json'));if(hash(manifestBytes)!==bootstrap.manifestSha256)throw Error('Owned program assets must exist in controller output with exact manifest digest');}
 // This independent bundle is an audit receipt only. Never inline its code:
 // selected/search share one original-module graph and thus one set of brands.
 const sealed=await buildVerifiedLiveWorldBundle(token,{programBuild});
 const plugin={name:'exact-controller-and-sealed-search-snapshots',setup(build){
  build.onResolve({filter:/.*/},args=>{
   const name=args.path===ENTRY&&!args.importer?ENTRY:path.posix.normalize(path.posix.join(path.posix.dirname(args.importer),args.path));
   if(!Object.hasOwn(files,name))throw Error('Unsnapshotted controller import: '+name);
   return{path:name,namespace:'canonical-snapshot'};
  });
  build.onLoad({filter:/.*/,namespace:'canonical-snapshot'},args=>({contents:args.path===SEAL_PATH?`export const LIVE_WORLD_UPLOAD_SOURCE_SEALED=true;export const LIVE_WORLD_UPLOAD_SOURCE_REVISION=${JSON.stringify(verified.revision)};`:args.path===BUILD_CONFIGURATION_PATH&&bootstrap?`export const WASM_GPU_BUILD_CONFIGURATION=Object.freeze(${JSON.stringify(bootstrap)});`:files[args.path],loader:'js'}));
 }};
 const result=await esbuild.build({entryPoints:[ENTRY],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true,legalComments:'inline',plugins:[plugin],logLevel:'silent'});
 if(result.outputFiles.length!==1||Object.values(result.metafile.outputs).some(o=>o.imports.length))throw Error('One self-contained browser module required');
 const bytes=result.outputFiles[0].contents,allSources=files;
 const manifest={schema:'canonical-controller-assets-v1',entrypoint:'canonical-controller.mjs',activation:false,defaultBackendUnchanged:true,automaticDeviceRequest:false,
  experimental:true,productionEnabled:false,browserVerified:false,nativeControllerVerified:false,
  explicitPracticeEntry:true,explicitPracticeDeviceRequest:true,
  searchSourceSealed:true,searchSourceRevision:sealed.receipt.sourceRevision,sharedSourceBytesVerified:true,
  sealedSearchBundleSHA256:sealed.receipt.bundleSHA256,unifiedSourceGraph:true,wasmGpuProgramBootstrap:bootstrap,buildInputs:verified.buildInputs,
  sha256:hash(bytes),bytes:bytes.length,sources:Object.fromEntries(Object.entries(allSources).sort(([a],[b])=>a.localeCompare(b)).map(([file,source])=>[file,hash(source)]))};
 await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,manifest.entrypoint),bytes);await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [root,out,flag]=process.argv.slice(2);if(!root||!out||process.argv.length>5||flag!==undefined&&flag!=='--wasm-gpu-programs')throw Error('Usage: node build-canonical-controller-assets-verified.mjs root out [--wasm-gpu-programs]');
 try{console.log(JSON.stringify(await buildCanonicalControllerAssetsVerified({root,out,includeWasmGpuPrograms:flag==='--wasm-gpu-programs'})));}catch(error){console.error(error.message);process.exitCode=1;}
}
