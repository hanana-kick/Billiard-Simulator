/** Test-only original assets from this checkout's successful deterministic release build. */
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const inside=(parent,child)=>{const r=path.relative(parent,child);return r!==''&&!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r);};
async function verify(directory){const bytes=await fs.readFile(path.join(directory,'manifest.json'));if(createHash('sha256').update(bytes).digest('hex')!=='93f9bcc033060761a0a5dd445c4c8bf43eeca4c5088878d83e187c40fe628f02')throw Error('Exact original manifest required');const m=JSON.parse(bytes);await fs.access(path.join(directory,m.selectedProgram.artifact.file));return directory;}
export async function resolveNativeOriginalAssets(){
 if(process.env.NATIVE_TERMINAL_ORIGINAL_ASSETS)return verify(path.resolve(process.env.NATIVE_TERMINAL_ORIGINAL_ASSETS));
 let work;try{work=await fs.realpath(path.join(root,'.compiled-build'));}catch{throw Error('Run npm run build:release first, or set explicit NATIVE_TERMINAL_ORIGINAL_ASSETS');}
 const failures=[];for(const name of (await fs.readdir(work)).filter(x=>x.startsWith('release-')).sort()){
  try{const entry=path.join(work,name),receipt=JSON.parse(await fs.readFile(path.join(entry,'receipt.json'),'utf8'));if(receipt.success!==true)continue;const config=JSON.parse(await fs.readFile(path.join(entry,'generated/app-build.json'),'utf8')),directory=await fs.realpath(config.programDirectory);if(!inside(work,directory))throw Error('Original assets must belong to this checkout build');return await verify(directory);}catch(error){failures.push(name+': '+error.message);}
 }
 throw Error('No successful own-checkout original asset build. Run npm run build:release. '+failures.join('; '));
}
