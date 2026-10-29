/** Build-time only: exact audited source closure -> one self-contained bundle.
 * A source pin is reviewed repository policy, not a caller's runtime assertion.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import esbuild from 'esbuild';
export const ROOTS=Object.freeze(['src/direct-candidate/experimental-live-world-sealed-entry.mjs','src/direct-candidate/experimental-live-world-batch.mjs','src/direct-candidate/experimental-live-world-uploads.mjs','src/wasm-gpu/seal-entry.mjs','src/direct-candidate/canonical-controller-browser-entry.mjs']);
export const BUILD_CONFIGURATION_PATH='src/wasm-gpu/build-configuration.mjs';
export const BUILD_CONFIGURATION_STUB='/** Inert development stub. Only the verified same-source bundle builder may\n * replace this with the independently pinned local program asset configuration. */\nexport const WASM_GPU_BUILD_CONFIGURATION = null;\n';
export const SEAL_PATH='src/direct-candidate/experimental-live-world-build-seal.mjs';
const STUB='/** Only the verified experimental bundle builder may substitute this stub. */\nexport const LIVE_WORLD_UPLOAD_SOURCE_SEALED=false;\nexport const LIVE_WORLD_UPLOAD_SOURCE_REVISION=null;\n';
export const BUILD_INPUT_PATHS=Object.freeze(['tools/build-wasm-gpu-program-assets.mjs','tools/build-wasm-gpu-program-assets-verified.mjs','tools/build-live-world-upload-seal.mjs','tools/build-canonical-controller-assets-verified.mjs','vendor/rapier.cjs','tools/wasm-gpu-runtime/Cargo.toml','tools/wasm-gpu-runtime/Cargo.lock','tools/wasm-gpu-runtime/src/lib.rs','tools/wasm-gpu-runtime/build.mjs','artifacts/wasm-gpu-runtime.wasm','artifacts/wasm-gpu-runtime.wasm.build.json'].sort());
const owned=new WeakMap();
const digest=text=>createHash('sha256').update(text).digest('hex');
function resolveLocal(from,specifier){
 if(typeof specifier!=='string'||!specifier.startsWith('./')&&!specifier.startsWith('../')||/[?#\\]/.test(specifier))throw Error('Only exact relative local imports are sealed: '+specifier);
 const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(from),specifier));
 if(!resolved.startsWith('src/')||! /\.(?:mjs|js)$/.test(resolved))throw Error('Unknown source import role: '+resolved);
 return resolved;
}
export function staticSourceDependencies(filename,source){
 const ast=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),deps=[];
 if(ast.parseDiagnostics.length)throw Error('Unparsed audited source: '+filename);
 function visit(node){
  if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)&&node.moduleSpecifier){if(!ts.isStringLiteral(node.moduleSpecifier))throw Error('Nonliteral module source');deps.push(resolveLocal(filename,node.moduleSpecifier.text));}
  if(ts.isImportEqualsDeclaration(node)||ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&['require','eval','Function'].includes(node.expression.text))||ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='Function')throw Error('Dynamic/unknown code loading is outside sealed closure: '+filename);
  ts.forEachChild(node,visit);
 }
 visit(ast);return [...new Set(deps)].sort();
}
async function sourceBytes(root,relative){
 const filename=path.resolve(root,relative);if(filename!==path.join(path.resolve(root),relative))throw Error('Escaped source path');
 const stat=await fs.lstat(filename);if(!stat.isFile()||stat.isSymbolicLink()||await fs.realpath(filename)!==filename)throw Error('Only regular in-root sources may be sealed');
 const bytes=await fs.readFile(filename),text=bytes.toString('utf8');if(!Buffer.from(text).equals(bytes))throw Error('Exact UTF-8 source required');return text;
}
export async function collectLiveWorldSourceClosure(root){
 const files={},pending=[...ROOTS,SEAL_PATH,BUILD_CONFIGURATION_PATH];
 while(pending.length){const name=pending.pop();if(Object.hasOwn(files,name))continue;const source=await sourceBytes(root,name);files[name]=source;pending.push(...staticSourceDependencies(name,source));}
 return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
}
/** Candidate data is never an accepted pin until separately reviewed and marked
 * by the repository's human/agent review process. No auto-refresh build option. */
async function readBuildInputs(root){
 const bytes={},hashes={};for(const name of BUILD_INPUT_PATHS){const filename=path.resolve(root,name),stat=await fs.lstat(filename);if(filename!==path.join(path.resolve(root),name)||!stat.isFile()||stat.isSymbolicLink()||await fs.realpath(filename)!==filename)throw Error('Regular in-root build input required');bytes[name]=await fs.readFile(filename);hashes[name]=digest(bytes[name]);}return{bytes,hashes};
}
export async function createLiveWorldSealReviewCandidate(root){const {hashes}=await readBuildInputs(root);return{kind:'live-world-upload-host-source-pin-v1',reviewStatus:'UNREVIEWED',roots:[...ROOTS],sealPath:SEAL_PATH,files:await collectLiveWorldSourceClosure(root),buildInputs:hashes};}
export async function verifyLiveWorldSourcePin(root,pin){
 if(pin?.kind!=='live-world-upload-host-source-pin-v1'||pin.reviewStatus!=='reviewed'||JSON.stringify(pin.roots)!==JSON.stringify(ROOTS)||pin.sealPath!==SEAL_PATH||!pin.files||typeof pin.files!=='object'||Array.isArray(pin.files))throw Error('Reviewed exact host-source pin required');
 const current=await collectLiveWorldSourceClosure(root),names=Object.keys(current);
 if(JSON.stringify(names)!==JSON.stringify(Object.keys(pin.files)))throw Error('Host-source closure membership drift');
 for(const name of names)if(typeof pin.files[name]!=='string'||current[name]!==pin.files[name])throw Error('Host-source bytes drift: '+name);
 if(current[SEAL_PATH]!==STUB)throw Error('Only the reviewed false/null seal stub may be substituted');
 if(current[BUILD_CONFIGURATION_PATH]!==BUILD_CONFIGURATION_STUB)throw Error('Only the reviewed null program configuration stub may be substituted');
 const inputs=await readBuildInputs(root);if(!pin.buildInputs||JSON.stringify(Object.keys(pin.buildInputs).sort())!==JSON.stringify(BUILD_INPUT_PATHS))throw Error('Complete reviewed build input hashes required');for(const name of BUILD_INPUT_PATHS)if(pin.buildInputs[name]!==inputs.hashes[name])throw Error('Build input bytes drift: '+name);
 const revision=digest(JSON.stringify({files:current,buildInputs:inputs.hashes})),token=Object.freeze({kind:'verified-live-world-build-capability-v1',revision,moduleCount:names.length});
 owned.set(token,{files:current,revision,buildInputs:inputs.hashes,buildInputBytes:inputs.bytes});return token;
}
export function snapshotVerifiedLiveWorldSources(token){const verified=owned.get(token);if(!verified)throw Error('Owned verified build capability required');return Object.freeze({files:Object.freeze({...verified.files}),revision:verified.revision,buildInputs:Object.freeze({...verified.buildInputs}),buildInputBytes:Object.freeze(Object.fromEntries(Object.entries(verified.buildInputBytes).map(([name,bytes])=>[name,new Uint8Array(bytes)])))});}
export async function buildVerifiedLiveWorldBundle(token,{minify=false,programBuild}={}){
 const verified=owned.get(token);if(!verified)throw Error('Owned verified build capability required');
 if(typeof minify!=='boolean')throw TypeError('Explicit minification boolean');
 // This private snapshot, not the mutable filesystem or caller pin, is the only
 // input to esbuild. The substituted capability is never an entrypoint export.
 const bootstrap=programBuild===undefined?null:(await import('./build-wasm-gpu-program-assets-verified.mjs')).readVerifiedWasmGpuProgramBuild(programBuild,verified.revision);
 const files=verified.files,entry=`export * from ${JSON.stringify('./'+ROOTS[0])};`;
 const plugin={name:'exact-audited-live-world-source',setup(build){
  build.onResolve({filter:/.*/},args=>{if(args.path==='sealed-entry')return{path:'sealed-entry',namespace:'sealed'};const name=args.importer==='sealed-entry'?args.path.replace(/^\.\//,''):resolveLocal(args.importer,args.path);if(!Object.hasOwn(files,name))throw Error('Unsealed module requested: '+name);return{path:name,namespace:'sealed'};});
  build.onLoad({filter:/.*/,namespace:'sealed'},args=>({contents:args.path==='sealed-entry'?entry:args.path===SEAL_PATH?`const capability=Object.freeze({audited:true,revision:${JSON.stringify(verified.revision)}});export const LIVE_WORLD_UPLOAD_SOURCE_SEALED=capability.audited;export const LIVE_WORLD_UPLOAD_SOURCE_REVISION=capability.revision;`:args.path===BUILD_CONFIGURATION_PATH&&bootstrap?`export const WASM_GPU_BUILD_CONFIGURATION=Object.freeze(${JSON.stringify(bootstrap)});`:files[args.path],loader:'js'}));
 }};
 const result=await esbuild.build({entryPoints:['sealed-entry'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,minify,metafile:true,plugins:[plugin],logLevel:'silent'});
 if(result.outputFiles.length!==1||Object.values(result.metafile.outputs).some(output=>output.imports.length||output.exports.some(name=>name.startsWith('LIVE_WORLD_UPLOAD_SOURCE_'))))throw Error('One self-contained bundle without seal exports required');
 const code=result.outputFiles[0].text;
 return Object.freeze({code,receipt:Object.freeze({kind:'live-world-upload-sealed-bundle-v1',sourceRevision:verified.revision,moduleCount:Object.keys(files).length,bundleSHA256:digest(code),bundleBytes:Buffer.byteLength(code),minified:minify,physicalGPUQualified:false})});
}
async function cli(){const [pinFile,outFile]=process.argv.slice(2);if(!pinFile||!outFile||process.argv.length!==4)throw Error('Usage: node tools/build-live-world-upload-seal.mjs reviewed-pin.json output.mjs');const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),pin=JSON.parse(await fs.readFile(pinFile,'utf8')),token=await verifyLiveWorldSourcePin(root,pin),result=await buildVerifiedLiveWorldBundle(token);await fs.writeFile(outFile,result.code);await fs.writeFile(outFile+'.receipt.json',JSON.stringify(result.receipt,null,2)+'\n');console.log(JSON.stringify(result.receipt));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))cli().catch(error=>{console.error(error.message);process.exitCode=1;});
