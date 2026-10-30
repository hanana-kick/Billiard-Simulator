/** BUILD ONLY. Explicit second pass over the already audited/smooth-lowered
 * graph. Every staged pair is adjacent and uses the original admission gate. */
import {MIXED_V2_HULL_ENTRY_WGSL,MIXED_V2_HULL_ENDPOINT_CACHE_WGSL} from '../direct-candidate/deterministic-mixed-cushion-v2-gpu.mjs';
import {CUSHION_RELEASE_V2_WGSL} from '../direct-candidate/deterministic-cushion-release-v2.mjs';
import {HULL_ENTRY_STAGED_WGSL,HULL_STAGED_CACHE_WORDS} from '../direct-candidate/deterministic-hull-entry-staged.mjs';
import {CUSHION_RELEASE_STAGED_WGSL,RELEASE_STAGED_TEMP_WORDS} from '../direct-candidate/deterministic-cushion-release-staged.mjs';
import {hashLoweringGraph} from './smooth-program-lowering.mjs';
const copy=x=>structuredClone(x);
const hash=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x))),v=>v.toString(16).padStart(2,'0')).join('');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function lowerCushionProgram(program,{sourceField}={}){
 if(!['source','code'].includes(sourceField)||!Array.isArray(program?.definitions)||!Array.isArray(program.commands)||!Array.isArray(program.allocations))throw TypeError('Exact captured cushion graph required');
 const ids=code=>new Set(program.definitions.flatMap((d,i)=>d[sourceField]===code&&(!d.entryPoint||d.entryPoint==='main')?[i]:[]));
 const entry=ids(MIXED_V2_HULL_ENTRY_WGSL),release=ids(CUSHION_RELEASE_V2_WGSL),producer=ids(MIXED_V2_HULL_ENDPOINT_CACHE_WGSL);
 const ec=program.commands.filter(c=>c.kind==='dispatch'&&entry.has(c.definition)),rc=program.commands.filter(c=>c.kind==='dispatch'&&release.has(c.definition));
 if(!ec.length||!rc.length)throw Error('Both exact cushion source kernels required');
 const caches=new Set();for(const c of ec){if(c.entries.length!==8||c.entries.some((e,i)=>e.binding!==i))throw Error('Exact entry bindings required');const e=c.entries[7];if(e.offset!==0||e.size!==4096||program.allocations[e.buffer]?.size!==4096)throw Error('Full original endpoint cache required');caches.add(e.buffer);}
 for(const c of rc)if(c.entries.length!==7||c.entries.some((e,i)=>e.binding!==i))throw Error('Exact release bindings required');
 const usedProducers=new Set();
 for(const c of program.commands){
  if(c.kind!=='dispatch'){if(['buffer','source','target'].some(k=>caches.has(c[k])))throw Error('Unexpected endpoint cache copy/clear');continue;}
  for(const e of c.entries)if(caches.has(e.buffer)){
   if(!((entry.has(c.definition)&&e.binding===7)||(producer.has(c.definition)&&e.binding===4))||e.offset!==0||e.size!==4096)throw Error('Unexpected endpoint cache user/subview');
   if(producer.has(c.definition))usedProducers.add(e.buffer);
  }
 }
 if(caches.size!==usedProducers.size)throw Error('Every endpoint cache requires its exact producer');
 const cacheBytes=HULL_STAGED_CACHE_WORDS*4,tempBytes=RELEASE_STAGED_TEMP_WORDS*4,tempAllocation=program.allocations.length;
 const allocations=program.allocations.map((a,i)=>{const out=copy(a);if(caches.has(i)){if(sourceField==='source'&&(a.external!==null||a.initial.length!==4096||a.initial.some(x=>x!==0)))throw Error('Zero original endpoint cache required');out.size=cacheBytes;if(sourceField==='source')out.initial=new Uint8Array(cacheBytes);}return out;});
 allocations.push(sourceField==='source'?{size:tempBytes,usage:128,external:null,initial:new Uint8Array(tempBytes)}:{size:tempBytes,sourceUsage:128,usage:136,label:'wasm-temporary:release-staged'});
 const definitions=[],mapping=new Map();
 const checkLayout=(d,count)=>{if(d.layout==='auto')return;const l=d.layout;if(l?.bindGroupLayouts?.length!==1||l.bindGroupLayouts[0].entries.length!==count||l.bindGroupLayouts[0].entries.some((e,i)=>e.binding!==i))throw Error('Exact original cushion layout required');};
 const widen=(d,binding)=>{if(sourceField==='source'){if(!same(d.ownership?.[binding],{stride:1024,base:0,length:1024}))throw Error('Exact original endpoint ownership required');d.ownership[binding]={stride:HULL_STAGED_CACHE_WORDS,base:0,length:HULL_STAGED_CACHE_WORDS};}};
 for(const[index,source]of program.definitions.entries()){
  const d=copy(source),isEntry=entry.has(index),isRelease=release.has(index);
  if(isEntry){checkLayout(d,8);widen(d,7);}else if(producer.has(index)){checkLayout(d,5);widen(d,4);}
  if(!isEntry&&!isRelease){mapping.set(index,[definitions.length]);definitions.push(d);continue;}
  // Explicit ABI includes declared but stage-unused bindings. Auto layout
  // would drop them while the proven command graph still binds every entry.
  if(d.layout==='auto'){const declarations=[...d[sourceField].matchAll(/@group\(0\)\s*@binding\((\d+)\)\s*var<storage,\s*(read|read_write)>/g)];const count=isEntry?8:7;if(declarations.length!==count||declarations.some((m,i)=>Number(m[1])!==i))throw Error('Exact original staged storage declarations required');d.layout={bindGroupLayouts:[{entries:declarations.map(m=>({binding:Number(m[1]),visibility:4,buffer:{type:m[2]==='read'?'read-only-storage':'storage'}}))}]};}
  const next=[];if(isRelease)checkLayout(d,7);
  const codes=isEntry?HULL_ENTRY_STAGED_WGSL:CUSHION_RELEASE_STAGED_WGSL;
  for(let stage=0;stage<2;stage++){
   const def={...copy(d),[sourceField]:codes[stage]};
   if(isEntry&&stage===0){const indices=[0,1,2,3,7];if(def.layout!=='auto')def.layout.bindGroupLayouts[0].entries=indices.map((i,binding)=>({...copy(d.layout.bindGroupLayouts[0].entries[i]),binding,buffer:{type:binding===4?'storage':'read-only-storage'}}));if(sourceField==='source')def.ownership=indices.map(i=>copy(d.ownership[i]));}
   if(isRelease){if(def.layout!=='auto')def.layout.bindGroupLayouts[0].entries.push({binding:7,visibility:4,buffer:{type:'storage'}});if(sourceField==='source')def.ownership.push({stride:RELEASE_STAGED_TEMP_WORDS,base:0,length:RELEASE_STAGED_TEMP_WORDS});}
   next.push(definitions.length);definitions.push(def);
  }
  mapping.set(index,next);
 }
 const starts=[];let length=0;for(const c of program.commands){starts.push(length);length+=c.kind==='dispatch'&&(entry.has(c.definition)||release.has(c.definition))?2:1;}
 const commands=[],commandOrigins=[];
 for(const[index,source]of program.commands.entries()){
  const c=copy(source);if(c.indirect&&Object.hasOwn(c.indirect,'ownerCommand')){const owner=c.indirect.ownerCommand;if(!Number.isInteger(owner)||owner<0||owner>=starts.length)throw Error('Original indirect producer index required');c.indirect.ownerCommand=starts[owner];}
  if(c.kind!=='dispatch'){commands.push(c);commandOrigins.push(index);continue;}
  c.entries=c.entries.map(e=>({...e,size:caches.has(e.buffer)?cacheBytes:e.size}));const next=mapping.get(c.definition);if(!next)throw Error('Unknown cushion source dispatch');
  for(const[stage,definition]of next.entries()){
   let entries=copy(c.entries);if(entry.has(c.definition)&&stage===0)entries=[0,1,2,3,7].map((i,binding)=>({...copy(c.entries[i]),binding}));
   if(release.has(c.definition))entries.push({binding:7,buffer:tempAllocation,offset:0,size:tempBytes});
   commands.push({...copy(c),definition,entries});commandOrigins.push(index);
  }
 }
 // Prove adjacency and unchanged ordered command semantics, including every
 // original gate and its remapped producer, before authorizing the derived plan.
 for(const[index,source]of program.commands.entries()){
  const count=source.kind==='dispatch'&&(entry.has(source.definition)||release.has(source.definition))?2:1;
  for(let stage=0;stage<count;stage++){
   const expected=copy(source),actual=copy(commands[starts[index]+stage]);
   if(expected.indirect&&Object.hasOwn(expected.indirect,'ownerCommand'))expected.indirect.ownerCommand=starts[expected.indirect.ownerCommand];
   if(source.kind==='dispatch'){
    delete expected.definition;delete actual.definition;expected.entries=expected.entries.map(e=>({...e,size:caches.has(e.buffer)?cacheBytes:e.size}));
    if(entry.has(source.definition)&&stage===0)expected.entries=[0,1,2,3,7].map((i,binding)=>({...expected.entries[i],binding}));
    if(release.has(source.definition))expected.entries.push({binding:7,buffer:tempAllocation,offset:0,size:tempBytes});
   }
   if(!same(actual,expected))throw Error('Cushion lowering changed original ordered command semantics');
  }
 }
 // This structural receipt is authenticated by the outer artifact, not a
 // claim that the runtime independently replays this source transformation.
 const receipt=Object.freeze({kind:'cushion-two-stage-lowering-v1',originalSHA256:await hashLoweringGraph(program,sourceField),derivedSHA256:await hashLoweringGraph({definitions,commands,allocations},sourceField),originalCommands:program.commands.length,derivedCommands:commands.length,expandedEntryCommands:ec.length,expandedReleaseCommands:rc.length,tempAllocation,tempBytes,cacheAllocations:[...caches].sort((a,b)=>a-b).map(index=>({index,originalBytes:4096,derivedBytes:cacheBytes})),originalShaderSHA256:await Promise.all([MIXED_V2_HULL_ENTRY_WGSL,CUSHION_RELEASE_V2_WGSL].map(hash)),stageSHA256:await Promise.all([...HULL_ENTRY_STAGED_WGSL,...CUSHION_RELEASE_STAGED_WGSL].map(hash))});
 if(commands.length!==program.commands.length+ec.length+rc.length||definitions.some(d=>[MIXED_V2_HULL_ENTRY_WGSL,CUSHION_RELEASE_V2_WGSL].includes(d[sourceField])))throw Error('Incomplete cushion lowering');
 return {definitions,commands,allocations,receipt,commandOrigins,originalProgram:program};
}
