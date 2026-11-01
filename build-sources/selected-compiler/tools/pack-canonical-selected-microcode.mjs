import {selectExactDivideCandidate} from '../src/canonical-integer-transport/approve-exact-divide.mjs';
/** Build-only exact selected graph. No physics, GPU, or production activation. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {compileMicrocodeWGSL,assertCanonicalIntegerCompilation} from '../src/resident-candidate/microcode-compiler.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
import {admitIntegerProgram} from '../src/canonical-integer-transport/kernel-common-guards.mjs';
export const SOURCE='75c09c39e6d97085f4c4bf8045f0f892f121130d00340128101602de7df0e2df';
export const MANIFEST='93f9bcc033060761a0a5dd445c4c8bf43eeca4c5088878d83e187c40fe628f02';
export const SELECTED='11e20cdbda4bf68e65679c8a3bde9dac91cbb9525ef9f7c1cc7e359b4f3d5862';
const sha=b=>createHash('sha256').update(b).digest('hex'),owned=new WeakSet();
const freeze=(x,seen=new WeakSet())=>{if(x&&typeof x==='object'&&!ArrayBuffer.isView(x)&&!seen.has(x)){seen.add(x);Object.values(x).forEach(v=>freeze(v,seen));Object.freeze(x);}return x;};
const literal=n=>{assert.equal(n.kind,'literal');assert.match(n.text,/^\d+u?$/);return Number(n.text.replace(/u$/,''));};
export function assertSelectedBuildPack(p){assert.ok(owned.has(p),'Owned selected build pack');for(const d of p.definitions)assertCanonicalIntegerCompilation(d.compilation);return p;}
export async function buildCanonicalSelectedPack({sourceRoot,assetRoot,onProgress}={}){
 const root=sourceRoot.replace(/\/?$/,'/'),base=assetRoot.replace(/\/?$/,'/');
 const pin=JSON.parse(fs.readFileSync(root+'tests/fixtures/live-world-upload-host-source-pin.json'));
 for(const [name,value] of Object.entries(pin.files))assert.equal(fs.readFileSync(root+name,'utf8'),value,name);
 for(const [name,value] of Object.entries(pin.buildInputs))assert.equal(sha(fs.readFileSync(root+name)),value,name);
 assert.equal(sha(JSON.stringify({files:pin.files,buildInputs:pin.buildInputs})),SOURCE);
 const mb=fs.readFileSync(base+'manifest.json');assert.equal(sha(mb),MANIFEST);const meta=JSON.parse(mb).selectedProgram;
 assert.equal(meta.artifact.artifactSha256,SELECTED);const compressed=fs.readFileSync(base+meta.artifact.file);assert.equal(sha(compressed),meta.artifact.sha256);const decoded=zlib.gunzipSync(compressed);assert.equal(sha(decoded),meta.artifact.decodedSha256);
 const {loadWasmGpuSelectedArtifact}=await import(pathToFileURL(root+'src/wasm-gpu/selected-artifact.mjs'));
 const engine=await loadWasmGpuSelectedArtifact(decoded.toString('utf8'),{expectedArtifactSha256:SELECTED,expectedSourceRevision:SOURCE});
 assert.equal(engine.definitions.length,125);assert.equal(engine.allocations.length,232);assert.equal(engine.commands.length,66317);
 const definitions=[];
 for(const [id,d] of engine.definitions.entries()){
  assert.deepEqual(d.constants,{});const ast=parseMicrocodeWGSL(d.code),entry=ast.functions.find(f=>f.name===d.entryPoint);assert.ok(entry?.attributes.some(a=>a.name==='compute'));const w=entry.attributes.find(a=>a.name==='workgroup_size'),workgroupSize=w.args.map(literal);while(workgroupSize.length<3)workgroupSize.push(1);assert.equal(workgroupSize.length,3);assert.ok(workgroupSize.every(x=>Number.isSafeInteger(x)&&x>=1&&x<=256));assert.ok(workgroupSize.reduce((a,b)=>a*b,1)<=256);
  const policy=ast.globals.filter(g=>g.storage==='storage').map(g=>{assert.equal(g.type.name,'array');assert.equal(g.type.args.length,1);assert.equal(literal(g.attributes.find(a=>a.name==='group').args[0]),0);assert.ok(['u32','i32'].includes(g.type.args[0].name),'Selected exact integer source');return{name:g.name,binding:literal(g.attributes.find(a=>a.name==='binding').args[0]),access:g.access,scalar:g.type.args[0].name};});
  const compilation=compileMicrocodeWGSL(d.code,{entry:d.entryPoint,sourceStoragePolicy:policy,exactWide:true,exactDivide:selectExactDivideCandidate(d.code,ast)});assertCanonicalIntegerCompilation(compilation);const layout=admitIntegerProgram(compilation),fn=compilation.functions.find(f=>f.name===d.entryPoint);assert.equal(compilation.sourceSha256,sha(d.code));
  const builtins=fn.params.map(p=>{assert.equal(p.type,'vec3<u32>');assert.equal(p.words,3);assert.equal(p.attributes.length,1);assert.equal(p.attributes[0].name,'builtin');assert.equal(p.attributes[0].args[0].name,'global_invocation_id');return{name:'global_invocation_id',slot:p.slot,words:3};});
  definitions.push({id,sourceSHA256:sha(d.code),bytecodeSHA256:sha(compilation.instructions),entryPoint:d.entryPoint,workgroupSize,builtins,policy,layout,entryPc:compilation.entryPc,compilation});onProgress?.({stage:'selected-source-lowered',completed:id+1,total:125,entry:d.entryPoint,instructions:layout.instructions});
 }
 const arenas=engine.allocations.map((a,id)=>({id,bytes:a.size,atomic:false,usage:a.usage,label:a.label}));assert.equal(arenas.reduce((n,a)=>n+a.bytes,0),8785284);
 // Immutable deployed graph is post three explicit staged lowerings. Original
 // pre-lowering owner auditor requires29 uses; exact deployed epochs require43.
 const {CUSHION_RESOLVER_V2_OWNER_WGSL}=await import(pathToFileURL(root+'src/direct-candidate/deterministic-cushion-resolver-v2.mjs'));
 const argIds=new Set(engine.commands.filter(c=>c.indirect).map(c=>c.indirect.buffer));assert.deepEqual([...argIds].sort((a,b)=>a-b),[129,185]);const epochs=new Map(),epochReceipts=[];
 const commands=engine.commands.map((c,index)=>{
  if(c.kind!=='dispatch'){assert.ok(!argIds.has(c.kind==='copy'?c.target:c.buffer),'No non-owner indirect args writer');if(c.kind==='clear')return{ordinal:index+1,kind:'clear',ranges:[{arena:c.buffer,offsetBytes:c.offset,sizeBytes:c.size}]};return{ordinal:index+1,kind:'copy',copies:[{sourceArena:c.source,sourceOffsetBytes:c.sourceOffset,destinationArena:c.target,destinationOffsetBytes:c.targetOffset,sizeBytes:c.size}]};}
  const d=definitions[c.definition],views=c.entries.map(e=>({binding:e.binding,arena:e.buffer,offsetBytes:e.offset,sizeBytes:e.size}));
  assert.equal(views.length,d.policy.length);assert.equal(new Set(views.map(v=>v.binding)).size,views.length);for(const v of views){assert.ok(d.policy.some(p=>p.binding===v.binding));assert.ok(v.offsetBytes>=0&&v.offsetBytes%4===0&&v.sizeBytes>0&&v.sizeBytes%4===0&&v.offsetBytes+v.sizeBytes<=arenas[v.arena].bytes);}
  for(const v of views)if(argIds.has(v.arena)&&d.policy.find(p=>p.binding===v.binding).access==='read_write'){
   assert.equal(engine.definitions[c.definition].code,CUSHION_RESOLVER_V2_OWNER_WGSL);assert.equal(c.x,1);assert.ok(!c.indirect);assert.equal(v.binding,3);assert.equal(views[1].sizeBytes/320,4);assert.equal(v.offsetBytes,0);assert.equal(v.sizeBytes,32);assert.equal(views.filter(x=>x.arena===v.arena).length,1);const old=epochs.get(v.arena);if(old){assert.equal(old.uses,43);epochReceipts.push({...old});}epochs.set(v.arena,{arena:v.arena,ownerOrdinal:index+1,uses:0});
  }
  let indirect=null,groups;
  if(c.indirect){const e=epochs.get(c.indirect.buffer);assert.ok(e);assert.ok([8,20].includes(c.indirect.offset));assert.equal(arenas[c.indirect.buffer].bytes,32);e.uses++;assert.ok(e.uses<=43);const bound=c.indirect.offset===8?1:4;indirect={arena:c.indirect.buffer,offsetBytes:c.indirect.offset,bound,ownerOrdinal:e.ownerOrdinal};groups=[bound,1,1];}else groups=[c.x,1,1];
  return{ordinal:index+1,kind:'dispatch',definition:c.definition,views,workgroups:groups,invocations:groups.map((n,i)=>n*d.workgroupSize[i]),indirect};
 });
 for(const e of epochs.values()){assert.equal(e.uses,43);epochReceipts.push({...e});}assert.equal(epochReceipts.length,128);assert.equal(commands.filter(c=>c.indirect).length,5504);
 const p={kind:'owned-selected-integer-build-v1',sourceRevision:SOURCE,manifestSHA256:MANIFEST,selectedArtifactSHA256:SELECTED,count:1,arenas,definitions,commands,outputs:engine.outputs,initialization:engine.initialization,epochReceipts,commandSourceSHA256:sha(JSON.stringify(engine.commands)),gpuExecuted:false,productionEnabled:false};freeze(p);owned.add(p);return p;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const p=await buildCanonicalSelectedPack({...config,onProgress:x=>console.log(JSON.stringify(x))});const words=p.definitions.reduce((n,d)=>n+d.compilation.instructions.length,0);console.log(JSON.stringify({stage:'selected-pack-complete',programs:p.definitions.length,commands:p.commands.length,arenas:p.arenas.length,bytecodeWords:words,sourceArenaBytes:p.arenas.reduce((n,a)=>n+a.bytes,0),epochs:p.epochReceipts.length,gpuExecuted:false}));}
