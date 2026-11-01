import{MIXED_HULL_LEDGER_WGSL}from'../direct-candidate/deterministic-mixed-cushion-entry.mjs';
import{queryViewWords}from'./query-view.mjs';
/** BUILD ONLY: exact source query splitting and authenticated view parameterization. */
import{MIXED_V2_HULL_QUERY_WGSL}from'../direct-candidate/deterministic-mixed-cushion-v2-gpu.mjs';
import{QUERY_STAGED_WGSL}from'../direct-candidate/deterministic-hull-query-staged.mjs';
import{hashLoweringGraph}from'./smooth-program-lowering.mjs';
const copy=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
export async function lowerQueryProgram(program,{sourceField}={}){
 if(!['source','code'].includes(sourceField)||!Array.isArray(program?.definitions)||!Array.isArray(program.commands)||!Array.isArray(program.allocations))throw Error('Exact captured query graph required');
 const matches=new Set(program.definitions.flatMap((d,i)=>d[sourceField]===MIXED_V2_HULL_QUERY_WGSL&&(!d.entryPoint||d.entryPoint==='main')?[i]:[]));
 const affected=program.commands.filter(c=>c.kind==='dispatch'&&matches.has(c.definition));if(!affected.length)throw Error('Exact query commands required');
 const outputs=new Set(),rails=new Set();for(const c of affected){if(c.entries.length!==4||c.entries.some((e,i)=>e.binding!==i)||c.entries[0].offset!==0||c.entries[0].size!==1280||c.entries[2].offset!==0||c.entries[2].size!==32)throw Error('Exact four-body query views required');const e=c.entries[3];if(e.size!==1024||![0,1024,2048,3072].includes(e.offset)||program.allocations[e.buffer]?.size!==4096)throw Error('Exact query rail subview required');outputs.add(e.buffer);rails.add(e.offset/1024);}
 if(rails.size!==4)throw Error('All four query rail views required');
 // Other graph users keep their original full/subviews. Only source-matched
 // query writes are widened, and no allocation is resized or reassigned.
 for(const c of program.commands){if(c.kind!=='dispatch'){if(['buffer','source','target'].some(k=>outputs.has(c[k]))&&!(c.kind==='clear'&&outputs.has(c.buffer)&&c.offset===0&&c.size===4096))throw Error('Unexpected query arena copy/clear');continue;}for(const e of c.entries)if(outputs.has(e.buffer)){const d=program.definitions[c.definition];if(matches.has(c.definition)&&e.binding===3)continue;if(d?.[sourceField]!==MIXED_HULL_LEDGER_WGSL||e.binding!==1||e.offset!==0||e.size!==4096)throw Error('Unexpected query arena user/subview');}}
 const allocations=program.allocations.map(copy),descriptors=[];for(let rail=0;rail<4;rail++){const index=allocations.length,role='query-view-v1:'+rail,bytes=new Uint8Array(queryViewWords(rail).buffer);allocations.push(sourceField==='source'?{size:16,usage:128,external:null,initial:bytes}:{size:16,sourceUsage:128,usage:136,label:'wasm-fixed:'+role});descriptors.push({index,role,bytes:Array.from(bytes)});}
 const definitions=[],mapping=new Map();for(const[index,d]of program.definitions.entries()){
  if(!matches.has(index)){mapping.set(index,[definitions.length]);definitions.push(copy(d));continue;}
  if(d.layout!=='auto'&&(d.layout?.bindGroupLayouts?.length!==1||d.layout.bindGroupLayouts[0].entries.length!==4||d.layout.bindGroupLayouts[0].entries.some((e,i)=>e.binding!==i)))throw Error('Exact original query layout required');
  if(sourceField==='source'&&(!same(d.ownership?.[0],{stride:320,base:0,length:320})||!same(d.ownership?.[2],{stride:8,base:0,length:8})||!same(d.ownership?.[1],{stride:2448,base:0,length:2448})||d.ownership?.[3]?.stride!==1024||d.ownership[3].length!==256||![0,256,512,768].includes(d.ownership[3].base)))throw Error('Exact query source ownership required');
  const next=[];for(const code of QUERY_STAGED_WGSL){const def={...copy(d),[sourceField]:code};if(def.layout==='auto')def.layout={bindGroupLayouts:[{entries:[0,1,2,3].map(binding=>({binding,visibility:4,buffer:{type:binding===3?'storage':'read-only-storage'}}))}]};def.layout.bindGroupLayouts[0].entries.push({binding:4,visibility:4,buffer:{type:'read-only-storage'}});if(sourceField==='source')def.ownership=[...copy(d.ownership.slice(0,3)),{stride:1024,base:0,length:1024},{stride:4,base:0,length:4}];next.push(definitions.length);definitions.push(def);}mapping.set(index,next);
 }
 const starts=[];let count=0;for(const c of program.commands){starts.push(count);count+=c.kind==='dispatch'&&matches.has(c.definition)?2:1;}
 const commands=[],commandOrigins=[];for(const[index,source]of program.commands.entries()){
  const c=copy(source);if(c.indirect&&Object.hasOwn(c.indirect,'ownerCommand')){const owner=c.indirect.ownerCommand;if(!Number.isInteger(owner)||owner<0||owner>=starts.length)throw Error('Original indirect owner required');c.indirect.ownerCommand=starts[owner];}
  if(c.kind!=='dispatch'){commands.push(c);commandOrigins.push(index);continue;}
  const next=mapping.get(c.definition);if(!next)throw Error('Unknown query definition');
  if(matches.has(c.definition)){const old=c.entries[3],rail=old.offset/1024;if(sourceField==='source'&&program.definitions[c.definition].ownership[3].base!==old.offset/4)throw Error('Query ownership/view disagreement');c.entries[3]={...old,offset:0,size:4096};c.entries.push({binding:4,buffer:descriptors[rail].index,offset:0,size:16});}
  for(const definition of next){commands.push({...copy(c),definition});commandOrigins.push(index);}
 }
 for(const[index,c]of program.commands.entries()){const pair=c.kind==='dispatch'&&matches.has(c.definition),rows=commands.slice(starts[index],starts[index]+(pair?2:1));for(const row of rows){const expected=copy(c);if(expected.indirect&&Object.hasOwn(expected.indirect,'ownerCommand'))expected.indirect.ownerCommand=starts[expected.indirect.ownerCommand];if(pair){const rail=expected.entries[3].offset/1024;expected.entries[3]={...expected.entries[3],offset:0,size:4096};expected.entries.push({binding:4,buffer:descriptors[rail].index,offset:0,size:16});}if(c.kind==='dispatch')expected.definition=row.definition;if(!same(row,expected)||c.kind==='dispatch'&&!mapping.get(c.definition).includes(row.definition))throw Error('Query ordered command proof failed');}if(pair&&rows.some((r,i)=>r.definition!==mapping.get(c.definition)[i]))throw Error('Query stage order required');}
 if(commands.length!==program.commands.length+affected.length||definitions.some(d=>d[sourceField]===MIXED_V2_HULL_QUERY_WGSL))throw Error('Incomplete query lowering');
 const receipt={kind:'query-parameterized-two-stage-lowering-v1',originalSHA256:await hashLoweringGraph(program,sourceField),derivedSHA256:await hashLoweringGraph({definitions,commands,allocations},sourceField),originalCommands:program.commands.length,derivedCommands:commands.length,expandedCommands:affected.length,descriptors:descriptors.map(({index,role})=>({index,role})),originalShaderSHA256:await hash(MIXED_V2_HULL_QUERY_WGSL),stageSHA256:await Promise.all(QUERY_STAGED_WGSL.map(hash))};
 return{definitions,commands,allocations,receipt,descriptors,commandOrigins,originalProgram:program};
}
