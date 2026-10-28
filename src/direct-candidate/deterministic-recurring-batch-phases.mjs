/** Audited storage ownership for the existing prepared recurrence; no new physics.
 * Each dispatch's y coordinate selects an independent candidate. x retains the
 * original shader's body/cell lanes, including its original range checks.
 */
import {DIRECTIONAL_PREPARE_WGSL,DIRECTIONAL_QUERY_WGSL,DIRECTIONAL_CONTACT_BUILD_WGSL,DIRECTIONAL_CONTACT_MERGE_WGSL} from './deterministic-directional-event.mjs';
import {TUBE_PREPARE_WGSL,TUBE_CLEAR_WGSL} from './deterministic-tube-prefix.mjs';
import {CONTACT_3D_WGSL} from './deterministic-contact-3d.mjs';
import {SMOOTH_CANDIDATE_WGSL,SMOOTH_CELLS_WGSL,SMOOTH_ACCEPT_WGSL} from './deterministic-smooth-segment.mjs';
import {LANDING_CHAIN_BUILD_WGSL,LANDING_CHAIN_PREPARE_WGSL,LANDING_CHAIN_COMMIT_WGSL} from './deterministic-landing-chain.mjs';
import {LANDING_3D_ROOT_WGSL,LANDING_3D_RESPONSE_WGSL} from './deterministic-landing-3d.mjs';
import {SLIP_BRIDGE_WGSL} from './deterministic-slip-bridge.mjs';
import {ROLLING_BOUNDS_PREPARE_WGSL} from './deterministic-rolling-bounds.mjs';
import {ROLLING_PAIR_WORLD_WGSL} from './deterministic-rolling-pair-world.mjs';
import {ROLLING_TAIL_WGSL} from './deterministic-rolling-tail.mjs';
import {RECUR_PROBE_WGSL,RECUR_BRIDGE_PROBE_WGSL,RECUR_CHOOSE_WGSL,RECUR_ROLLING_WGSL,RECUR_ASSEMBLE_WGSL,RECUR_REBASE_WGSL,RECUR_TAIL_BUILD_WGSL,RECUR_TAIL_COMMIT_WGSL,RECUR_FINALIZE_WGSL,RECUR_REFINEMENT_BUILD_WGSL} from './deterministic-recurring-stages.mjs';
const codes=[DIRECTIONAL_PREPARE_WGSL,DIRECTIONAL_QUERY_WGSL,DIRECTIONAL_CONTACT_BUILD_WGSL,CONTACT_3D_WGSL,DIRECTIONAL_CONTACT_MERGE_WGSL,TUBE_PREPARE_WGSL,SMOOTH_CANDIDATE_WGSL,SMOOTH_CELLS_WGSL,SMOOTH_ACCEPT_WGSL,TUBE_CLEAR_WGSL,LANDING_CHAIN_BUILD_WGSL,LANDING_3D_ROOT_WGSL,LANDING_CHAIN_PREPARE_WGSL,LANDING_3D_RESPONSE_WGSL,LANDING_CHAIN_COMMIT_WGSL,RECUR_PROBE_WGSL,RECUR_BRIDGE_PROBE_WGSL,SLIP_BRIDGE_WGSL,RECUR_CHOOSE_WGSL,RECUR_ROLLING_WGSL,RECUR_ASSEMBLE_WGSL,RECUR_REBASE_WGSL,RECUR_TAIL_BUILD_WGSL,ROLLING_TAIL_WGSL,RECUR_TAIL_COMMIT_WGSL,RECUR_FINALIZE_WGSL,RECUR_REFINEMENT_BUILD_WGSL,ROLLING_PAIR_WORLD_WGSL,ROLLING_BOUNDS_PREPARE_WGSL];
// null = immutable shared binding. Numbers are the complete candidate-local word
// counts, NOT a row's word count. Initial ctx is mutable (landing sets ctx[15]).
const bindings=[
 [96,null,256],[256,null],[256,null,64],[64,128],[256,128],
 [256,128,160,256,256,256],[256,256,256,512],[256,256,256,512],[256,256,256,512],
 [256,256,256,160],[256,160,null,128],[128,null,256],[256,256,256,160,256,256,256],[256,384],[256,256,384],
 [256,256,null,256],[256,256,256],[256,512],[256,256,256,512,null,256,256,640],
 [256,{stride:640,base:512,length:128},512],[256,256,512,512,256],[256,256,null,256,256,512,512,256],
 [256,256,null,'tail'],['tail',null,272],[256,256,272,null,1056],[256],
 [256,272,null,2],['tail',null,2,1056,'tail'],['tail','tail']
];
export const RECURRING_BATCH_PHASE_COUNT=29;
/** Fail closed when upstream changes introduce a synchronization/pointer shape
 * not covered by this index-only lift. Private globals are invocation-local. */
export function liftCandidatePhase(code, ownership){
 if(/\b(?:batchCandidate|batchInvocation|batchLocal_\w*)\b/.test(code))throw Error('Reserved batch injection identifier');
 if(/var\s*<\s*workgroup\s*>|workgroupBarrier|storageBarrier|atomic|@builtin\((?:local_invocation|workgroup_id|num_workgroups)/.test(code))throw Error('Batch phase needs a fresh shared-state audit');
 const groups=[...code.matchAll(/@workgroup_size\(([^)]+)\)/g)];if(groups.length!==1||!['1','32'].includes(groups[0][1].trim()))throw Error('Batch requires audited one-dimensional workgroup size');
 const found=[...code.matchAll(/@group\(0\)\s*@binding\((\d+)\)\s*var<storage,\s*(read|read_write)>\s*(\w+)\s*:\s*array<(?:u32|i32)>\s*;/g)];
 if((code.match(/var\s*<\s*storage\b/g)??[]).length!==found.length)throw Error('Unclassified storage binding');
 if(found.length!==ownership.length||found.some((m,i)=>Number(m[1])!==i))throw Error('Batch storage shape changed');
 // Alpha-rename only the exact audited arithmetic helper unit(input).
 // Every other parameter shadow rejects; this is not a general WGSL compiler.
 // This changes names only, before the storage-access transformation.
 for(const [, , ,name] of found){
  const funcs=/\bfn\s+\w+\(([^{}]*?)\)[^{]*\{/g;let f;
  while((f=funcs.exec(code))){if(!new RegExp(`\\b${name}\\s*:`).test(f[1]))continue;if(name!=='input'||f[0]!=='fn unit(input:vec3<i32>)->vec3<i32>{')throw Error(`Unaudited storage parameter shadow ${name}`);let end=funcs.lastIndex,depth=1;for(;end<code.length&&depth;end++){if(code[end]==='{')depth++;else if(code[end]==='}')depth--;}const part=code.slice(f.index,end).replace(new RegExp(`\\b${name}\\b`,'g'),`batchLocal_${name}`);code=code.slice(0,f.index)+part+code.slice(end);funcs.lastIndex=f.index+part.length;}
 }
 const map=new Map();
 for(let i=0;i<found.length;i++){
  const [, , access,name]=found[i],o=ownership[i];
  if(o===null){if(access!=='read')throw Error(`Shared binding ${name} is writable`);continue;}
  const shape=typeof o==='number'?{stride:o,length:o,base:0}:{base:0,...o};
  if(![shape.stride,shape.length,shape.base].every(Number.isInteger)||shape.length<1||shape.base<0||shape.stride<shape.base+shape.length)throw Error(`Invalid shape ${name}`);
  if(new RegExp(`\\b(?:let|var)\\s+${name}\\b|\\bfn\\s+\\w+\\([^)]*\\b${name}\\s*:`).test(code))throw Error(`Storage name shadow ${name}`);
  map.set(name,shape);
 }
 code=code.replace(/arrayLength\(\s*&(\w+)\s*\)/g,(all,name)=>map.has(name)?`${map.get(name).length}u`:all);
 for(const name of map.keys())if(new RegExp(`(?<!&)&(?!&)\\s*${name}\\b`).test(code))throw Error(`Unsupported storage pointer ${name}`);
 function indices(source){let out='',pos=0;const token=/\b[A-Za-z_]\w*\s*\[/g;let m;while((m=token.exec(source))){const name=m[0].slice(0,m[0].lastIndexOf('[')).trim();if(!map.has(name))continue;let end=token.lastIndex,depth=1;for(;end<source.length&&depth;end++){if(source[end]==='[')depth++;else if(source[end]===']')depth--;}if(depth)throw Error('Unbalanced WGSL index');const o=map.get(name),expression=indices(source.slice(token.lastIndex,end-1));out+=source.slice(pos,m.index)+`${name}[batchCandidate*${o.stride}u+${o.base}u+u32(${expression})]`;pos=end;token.lastIndex=end;}return out+source.slice(pos);}
 code=indices(code);
 const entry=/fn main\(([^{}]*?)\)\s*\{/;const match=code.match(entry);if(!match)throw Error('Missing batch entry');
 let args=match[1],id=args.match(/^\s*@builtin\(global_invocation_id\)\s+(\w+)\s*:\s*vec3<u32>\s*$/)?.[1];
 if(args.trim()&&!id)throw Error('Unsupported entry arguments');
 if(id){const outsideEntry=code.slice(0,match.index)+code.slice(match.index+match[0].length);if(new RegExp(`\\b${id}\\b(?!\\s*\\.\\s*x\\b)`).test(outsideEntry))throw Error('Original invocation ID may use x only');}
 if(!id){if(args.trim())throw Error('Unsupported entry arguments');id='batchInvocation';args=`@builtin(global_invocation_id) ${id}:vec3<u32>`;}
 code=code.replace(entry,`fn main(${args}){batchCandidate=${id}.y;`);
 return `// Candidate-local storage lift; no arithmetic/branch changes.\nvar<private> batchCandidate:u32;\n${code}`;
}
export function recurringBatchPhaseSpecs(bodyCount){
 if(![3,4].includes(bodyCount))throw RangeError('Three/four body scene');
 const result=codes.map((code,index)=>({index,sourceIndex:index,source:code,ownership:bindings[index].map(x=>x==='tail'?bodyCount*32:x),smooth:index>=6&&index<=8}));
 // Reuse original kernels with explicit candidate-local views into combinedRows.
 for(let index=6;index<=8;index++)result.push({index:result.length,sourceIndex:index,source:codes[index],ownership:[{stride:640,base:0,length:256},256,256,512],smooth:true});
 result.push({index:32,sourceIndex:17,source:codes[17],ownership:[{stride:640,base:256,length:256},512]});
 result.push({index:33,sourceIndex:9,source:codes[9],ownership:[256,256,256,null]});
 return result.map(s=>({...s,code:liftCandidatePhase(s.source,s.ownership)}));
}
