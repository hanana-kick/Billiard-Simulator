/** Statically substitute only the private Worker scheduler brand. Genuine input
 * contracts and all packing/decoding dependencies retain their original modules.
 * No production factory injection, native GPU acquisition or physics evidence. */
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {createWasmGpuInputContract} from '../../src/wasm-gpu/input-contract-builder.mjs';
import {loadWasmGpuInputContract} from '../../src/wasm-gpu/input-contract.mjs';

export async function loadProjectedInputContract(kind,engine){
 const bytes=new TextEncoder().encode(JSON.stringify(createWasmGpuInputContract(kind,engine))),expectedSha256=createHash('sha256').update(bytes).digest('hex');
 return loadWasmGpuInputContract(bytes,{kind,expectedSha256,expectedSourceRevision:engine.sourceRevision,expectedArtifactSha256:engine.artifactSha256,expectedCount:engine.count});
}

export async function createStaticWorkerBackendHarness(t){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),dir=await mkdtemp(join(tmpdir(),'worker-backend-host-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const backends=['compact-search-backend.mjs','selected-session-backend.mjs'].map(name=>join(root,'src/wasm-gpu',name)),client=join(root,'src/wasm-gpu/worker-owner-client.mjs'),outfile=join(dir,'backend.mjs');
 await build({stdin:{contents:backends.map(path=>'export * from '+JSON.stringify(path)+';').join('\n')+'\nexport {createSealedWorkerOwnerEndpoint} from '+JSON.stringify(client)+';',resolveDir:root,loader:'js'},outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'private-worker-brand-only',setup(b){
  b.onResolve({filter:/.*/},args=>{
   const path=args.path.startsWith('.')?resolve(dirname(args.importer),args.path):args.path;
   if(path===client)return{path:'worker-endpoint',namespace:'host-only'};
   if(backends.includes(path))return{path};
   if(backends.includes(args.importer))return{path:pathToFileURL(path).href,external:true};
  });
  b.onLoad({filter:/.*/,namespace:'host-only'},()=>({loader:'js',contents:`const owned=new WeakSet();export function assertWorkerOwnerEndpoint(endpoint){if(!owned.has(endpoint))throw TypeError('Owned sealed Worker endpoint required');return endpoint;}export async function createSealedWorkerOwnerEndpoint(){const endpoint=Object.freeze({kind:'host-only-worker-scheduler',lost:new Promise(()=>{})});owned.add(endpoint);return endpoint;}`}));
 }}]});
 return import(pathToFileURL(outfile).href);
}
