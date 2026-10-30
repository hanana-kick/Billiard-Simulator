/** BUILD ONLY: explicit source-owned lowering, after the original indirect audit.
 * Never changes the recorder or mutates the original captured program. */
import {SMOOTH_CELLS_WGSL} from '../direct-candidate/deterministic-smooth-segment.mjs';
import {SMOOTH_STAGED_WGSL,SMOOTH_STAGED_TEMP_WORDS_PER_ROW} from '../direct-candidate/deterministic-smooth-staged.mjs';
const copy=x=>structuredClone(x);
const hash=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof x==='string'?x:JSON.stringify(x)))),v=>v.toString(16).padStart(2,'0')).join('');
const graph=({definitions,commands,allocations},field)=>({definitions,commands,allocations:allocations.map(a=>field==='source'?{size:a.size,usage:a.usage,external:a.external}:{size:a.size,sourceUsage:a.sourceUsage,usage:a.usage,label:a.label})});
export const hashLoweringGraph=(program,sourceField)=>hash(graph(program,sourceField));
export async function lowerSmoothCellProgram(program,{sourceField}={}){
 if(!['source','code'].includes(sourceField)||!Array.isArray(program?.definitions)||!Array.isArray(program.commands)||!Array.isArray(program.allocations))throw TypeError('Exact captured world/selected graph required');
 const original=graph(program,sourceField),matches=new Set(program.definitions.flatMap((d,i)=>d[sourceField]===SMOOTH_CELLS_WGSL&&(!d.entryPoint||d.entryPoint==='main')?[i]:[]));
 const affected=program.commands.filter(c=>c.kind==='dispatch'&&matches.has(c.definition));if(!affected.length)throw Error('Source-owned smooth cells commands required');
 const sizes=new Set();
 for(const c of affected){
  if(c.entries.length!==4||c.entries.some((e,i)=>e.binding!==i)||c.entries[0].size%256||c.entries[2].size!==c.entries[0].size||c.entries[3].size!==2*c.entries[0].size)throw Error('Exact smooth rows/scratch/cells binding views required');
  sizes.add(c.entries[0].size/256*SMOOTH_STAGED_TEMP_WORDS_PER_ROW*4);
 }
 // Current capsule: every original invocation has the same four-row shape.
 // Triplets are adjacent, so all nine smooth owners reuse this one local arena.
 if(sizes.size!==1)throw Error('Shared staged temporary requires one exact row shape');
 const tempBytes=[...sizes][0],tempIndex=program.allocations.length;
 const temp=sourceField==='source'?{size:tempBytes,usage:128,external:null,initial:new Uint8Array(tempBytes)}:{size:tempBytes,sourceUsage:128,usage:136,label:'wasm-temporary:smooth-staged'};
 const allocations=[...program.allocations.map(copy),temp],definitions=[],mapping=new Map();
 for(const [index,d]of program.definitions.entries()){
  if(!matches.has(index)){mapping.set(index,[definitions.length]);definitions.push(copy(d));continue;}
  const layout=copy(d.layout);
  if(layout!=='auto'){
   if(layout?.bindGroupLayouts?.length!==1||layout.bindGroupLayouts[0].entries.length!==4||layout.bindGroupLayouts[0].entries.some((e,i)=>e.binding!==i))throw Error('Exact original smooth layout required');
   layout.bindGroupLayouts[0].entries.push({binding:4,visibility:4,buffer:{type:'storage'}});
  }
  const next=[];for(const code of SMOOTH_STAGED_WGSL){next.push(definitions.length);const def={...copy(d),[sourceField]:code,layout:copy(layout)};if(sourceField==='source'){if(d.ownership?.length!==4)throw Error('Original smooth ownership required');def.ownership=[...copy(d.ownership),{stride:tempBytes/4,base:0,length:tempBytes/4}];}definitions.push(def);}mapping.set(index,next);
 }
 const starts=[];let count=0;for(const c of program.commands){starts.push(count);count+=c.kind==='dispatch'&&matches.has(c.definition)?3:1;}
 const commands=[],origins=[];
 for(const [index,originalCommand]of program.commands.entries()){
  const c=copy(originalCommand);if(c.indirect&&Object.hasOwn(c.indirect,'ownerCommand')){const owner=c.indirect.ownerCommand;if(!Number.isInteger(owner)||!starts[owner]&&owner!==0)throw Error('Original indirect owner index required');c.indirect.ownerCommand=starts[owner];}
  if(c.kind!=='dispatch'){commands.push(c);origins.push(index);continue;}
  const next=mapping.get(c.definition);if(!next)throw Error('Unknown source dispatch');
  for(const definition of next){commands.push({...copy(c),definition,...(next.length===3?{entries:[...copy(c.entries),{binding:4,buffer:tempIndex,offset:0,size:tempBytes}]}:{})});origins.push(index);}
 }
 if(commands.length!==program.commands.length+2*affected.length||definitions.some(d=>d[sourceField]===SMOOTH_CELLS_WGSL))throw Error('Incomplete smooth lowering');
 // Verify adjacency, original order, complete original binding views and exact
 // x/indirect semantics before granting the derived graph to later lowering.
 for(const [index,c]of program.commands.entries()){
  const length=c.kind==='dispatch'&&matches.has(c.definition)?3:1,rows=commands.slice(starts[index],starts[index]+length);
  for(const row of rows){const expected=copy(c),actual=copy(row);if(expected.indirect&&Object.hasOwn(expected.indirect,'ownerCommand'))expected.indirect.ownerCommand=starts[expected.indirect.ownerCommand];if(c.kind==='dispatch'){delete expected.definition;delete actual.definition;if(length===3)actual.entries.pop();}if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Staged lowering changed original command semantics');}
 }
 const derived={definitions,commands,allocations};
 // This receipt binds reference/derived structural provenance under the outer
 // artifact digest. It is not an independent runtime replay of this transform.
 const receipt=Object.freeze({kind:'smooth-cells-three-stage-lowering-v1',originalSHA256:await hash(original),derivedSHA256:await hash(graph(derived,sourceField)),originalCommands:program.commands.length,derivedCommands:commands.length,expandedCommands:affected.length,tempAllocation:tempIndex,tempBytes,originalShaderSHA256:await hash(SMOOTH_CELLS_WGSL),stageSHA256:await Promise.all(SMOOTH_STAGED_WGSL.map(hash))});
 return {...derived,receipt,commandOrigins:origins,originalProgram:program};
}
