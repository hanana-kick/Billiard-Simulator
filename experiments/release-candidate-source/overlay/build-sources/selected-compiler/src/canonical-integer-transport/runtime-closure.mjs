/** Admission of a build-generated transitive dependency receipt. This checks a
 * trusted build identity, not JS bytes already loaded by the browser; the sealed
 * Worker bundle must independently authenticate actual deployed runtime bytes. */
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const path=x=>typeof x==='string'&&/^src\/[A-Za-z0-9_./-]+\.mjs$/.test(x)&&!x.includes('..')&&!x.includes('//');
const exact=(x,names)=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join(',')!==names.split(',').sort().join(','))throw Error('Exact runtime closure schema required');};
export function canonicalRuntimeClosure(value){
 exact(value,'version,entry,files,imports,scheduler');if(value.version!==1||!path(value.entry))throw Error('Runtime closure entry/version');exact(value.scheduler,'path,sha256');if(value.scheduler.path!=='artifacts/wasm-gpu-runtime.wasm'||!hash(value.scheduler.sha256))throw Error('Runtime closure scheduler identity');
 if(!value.files||!value.imports||typeof value.files!=='object'||typeof value.imports!=='object')throw Error('Runtime closure graph required');const names=Object.keys(value.files).sort();if(!names.length||names.length>128||names.some(p=>!path(p)||!hash(value.files[p]))||JSON.stringify(Object.keys(value.imports).sort())!==JSON.stringify(names)||!names.includes(value.entry))throw Error('Runtime closure exact module set');
 const imports={};for(const name of names){const dependencies=value.imports[name];if(!Array.isArray(dependencies)||dependencies.length>128||new Set(dependencies).size!==dependencies.length||dependencies.some(d=>!names.includes(d)))throw Error('Runtime closure missing dependency');imports[name]=dependencies.slice().sort();}
 const reachable=new Set();function visit(name){if(reachable.has(name))return;reachable.add(name);for(const dep of imports[name])visit(dep);}visit(value.entry);if(reachable.size!==names.length)throw Error('Runtime closure has unreachable module');
 return JSON.stringify({version:1,entry:value.entry,files:Object.fromEntries(names.map(p=>[p,value.files[p]])),imports,scheduler:{path:value.scheduler.path,sha256:value.scheduler.sha256}});
}
