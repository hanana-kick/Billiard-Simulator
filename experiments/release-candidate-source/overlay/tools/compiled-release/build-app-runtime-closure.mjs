/** Build-time static parser/resolver closure, never runtime compiler. esbuild
 * supplies the complete parsed dependency graph (including side-effect imports).
 * Dynamic/external imports are forbidden, not silently omitted by a regex. */
import{readFile,realpath}from'node:fs/promises';import{resolve,relative,isAbsolute}from'node:path';import{createHash}from'node:crypto';import{createRequire}from'node:module';
import{pathToFileURL}from'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex');
export async function buildCanonicalRuntimeClosure({root,dependencyDirectory,entry='src/canonical-integer-transport/experimental-worker-protocol.mjs'}={}){
 const {canonicalRuntimeClosure}=await import(pathToFileURL(resolve(root,'src/canonical-integer-transport/runtime-closure.mjs')));
 const {build,transform}=createRequire(import.meta.url)(resolve(dependencyDirectory??resolve(root,'node_modules'),'esbuild')),base=await realpath(root),snapshots=new Map();
 const local=async filename=>{const actual=await realpath(filename),name=relative(base,actual).replaceAll('\\','/');if(name.startsWith('../')||isAbsolute(name)||!/^src\/[A-Za-z0-9_./-]+\.mjs$/.test(name))throw Error('Runtime closure must stay inside source root');return{name,actual};};
 const result=await build({absWorkingDir:base,entryPoints:[entry],bundle:true,write:false,metafile:true,format:'esm',platform:'browser',packages:'external',logLevel:'silent',plugins:[{name:'snapshot-runtime-source',setup(b){b.onLoad({filter:/\.mjs$/},async args=>{const{name,actual}=await local(args.path);const contents=await readFile(actual);const parsed=await transform(contents.toString('utf8'),{loader:'js',format:'esm',minifyWhitespace:true,logLevel:'silent'});if(parsed.warnings.length||/\b(?:import|require)\(/.test(parsed.code))throw Error('Runtime closure forbids dynamic loading (including nonliteral imports)');snapshots.set(name,contents);return{contents,loader:'js',resolveDir:resolve(actual,'..')};});}}]});
 if(result.warnings.length)throw Error('Runtime closure parser warning: '+result.warnings.map(w=>w.text).join('; '));
 const files={},imports={};for(const[name,input]of Object.entries(result.metafile.inputs)){if(!snapshots.has(name))throw Error('Runtime closure unsnapshotted module');files[name]=sha(snapshots.get(name));imports[name]=[];for(const dependency of input.imports){if(dependency.external||dependency.kind==='dynamic-import'||dependency.kind==='require-call'||!snapshots.has(dependency.path))throw Error('Runtime closure requires static internal ESM only');imports[name].push(dependency.path);}imports[name]=[...new Set(imports[name])];}
 if(Object.keys(files).length!==snapshots.size)throw Error('Runtime closure snapshot/graph mismatch');const schedulerPath='artifacts/wasm-gpu-runtime.wasm',scheduler={path:schedulerPath,sha256:sha(await readFile(resolve(base,schedulerPath)))};
 const canonical=canonicalRuntimeClosure({version:1,entry,files,imports,scheduler});return Object.freeze({closure:JSON.parse(canonical),runtimeRevision:sha(canonical)});
}
