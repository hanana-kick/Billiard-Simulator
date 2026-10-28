/** Source-owned MMQ2 cushion indirect subset only, not generic indirect support. */
import {CUSHION_RESOLVER_V2_OWNER_WGSL} from './deterministic-cushion-resolver-v2.mjs';
export function auditLiveCushionIndirect(plan){
 const args=new Set(plan.commands.filter(c=>c.indirect).map(c=>c.indirect.buffer)),owners=new Map(),uses=new Map(),ownerCommands=new Map();
 for(const [commandIndex,c] of plan.commands.entries()){
  if(c.kind!=='dispatch'){const target=c.kind==='copy'?c.target:c.buffer;if(args.has(target))throw Error('Indirect config cannot be copied or cleared');continue;}
  const d=plan.definitions[c.definition],access=[...d.source.matchAll(/@group\(0\)\s*@binding\((\d+)\)\s*var<storage,\s*(read|read_write)>/g)];
  for(const [i,e] of c.entries.entries())if(args.has(e.buffer)&&access[i]?.[2]==='read_write'){
   if(c.entries.filter(other=>other.buffer===e.buffer).length!==1)throw Error('Indirect config read/write alias');
   if(c.indirect||c.x!==1||d.source!==CUSHION_RESOLVER_V2_OWNER_WGSL||i!==3||e.offset!==0||e.size!==32||plan.allocations[e.buffer].size!==32)throw Error('Indirect config writer is not exact current MMQ2 owner');
   const n=c.entries[1].size/320;if(![3,4].includes(n))throw Error('Indirect owner roster view');if(owners.has(e.buffer)&&uses.get(e.buffer)!==29)throw Error('Incomplete indirect owner epoch');owners.set(e.buffer,n);ownerCommands.set(e.buffer,commandIndex);uses.set(e.buffer,0);
  }
  if(c.indirect){const a=c.indirect,allocation=plan.allocations[a.buffer],n=owners.get(a.buffer);if(!n||allocation.size!==32||!(allocation.usage&256)||![8,20].includes(a.offset))throw Error('Unowned indirect config view');a.bound=a.offset===8?1:n;a.ownerCommand=ownerCommands.get(a.buffer);uses.set(a.buffer,uses.get(a.buffer)+1);if(uses.get(a.buffer)>29)throw Error('Stale indirect owner epoch');}
 }
 for(const buffer of args)if(uses.get(buffer)!==29)throw Error('Incomplete indirect owner epoch');
 return plan;
}
export function guardLiveCushionIndirect(guarded,{stride,offset,bound}){
 if(stride!==8||![8,20].includes(offset)||![1,3,4].includes(bound))throw Error('Unreviewed indirect layout');
 let code=guarded.code;if(/\bliveIndirect\w*\b/.test(code))throw Error('Reserved indirect identifier');
 const size=Number(code.match(/@workgroup_size\((1|16|32)\)/)?.[1]);if(!size)throw Error('Indirect workgroup shape');
 const entry=/(fn main\(@builtin\(global_invocation_id\) (\w+):vec3<u32>\)\{batchCandidate=\2\.y;)/;
 if(!entry.test(code))throw Error('Indirect guarded entry shape');
 const binding=guarded.faultBinding+1;
 code=code.replace(entry,(_,head,id)=>head+`let liveIndirectBase=batchCandidate*8u+${offset/4}u;let liveIndirectX=liveIndirectArgs[liveIndirectBase];let liveIndirectY=liveIndirectArgs[liveIndirectBase+1u];let liveIndirectZ=liveIndirectArgs[liveIndirectBase+2u];if((liveIndirectX!=0u&&liveIndirectX!=${bound}u)||liveIndirectY!=1u||liveIndirectZ!=1u){atomicOr(&guardedBatchFault[batchCandidate],2u);return;}if(${id}.x/${size}u>=liveIndirectX){return;}`);
 code+=`\n@group(0) @binding(${binding}) var<storage,read> liveIndirectArgs:array<u32>;\n`;
 return{...guarded,code,indirectBinding:binding,storageBindingCount:binding+1};
}
