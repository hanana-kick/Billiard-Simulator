/* SPDX-License-Identifier: Apache-2.0
 * Composes the existing source-owner entries for interpretation as DATA.
 * Never submit this merged source as a giant native shader: its purpose is to
 * preserve source operations while a small scalar VM owns the dynamic loop.
 */
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {WORLD_DEVICE_PC} from './world-device-pc.mjs';

const SIGNATURE='@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>)';
const integer=(n,label)=>{if(!Number.isInteger(n)||n<0||n>0xffffffff)throw new RangeError(label+' must be u32');return n;};
function privateDeclarations(code) {
  const masked=code.replace(/\/\*[\s\S]*?\*\//g,x=>x.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,x=>' '.repeat(x.length));
  return [...masked.matchAll(/\bvar\s*<\s*private\s*>\s+(\w+)\s*:\s*([^;]+);/g)].map(m=>{
    const text=m[2].trim(),equal=text.indexOf('='),type=(equal<0?text:text.slice(0,equal)).trim(),initial=equal<0?type+'()':text.slice(equal+1).trim();
    if(!type||!initial)throw new SyntaxError('Exact private declaration required');
    return Object.freeze({name:m[1],type,initial});
  });
}

/** pc is the existing immutable, explicitly routed owner plan. A device loop
 * picks only the owner of the CURRENT source CALL. WAIT returns to that same
 * owner; only the unchanged owner completion advances the original world PC.
 * No source guard, h capacity, per-program cap, receipt or equation changes.
 *
 * WGSL private globals are per-original-invocation state. They reset ONCE at
 * the start of each logical owner call, not on microcode budget yields. The
 * interpreter keeps them, locals, return stack and source state resident when
 * a source helper is interrupted between scalar instructions.
 */
export function composeWorldMicrocodeSource(pc) {
  if(!['resident-world-device-owners'].includes(pc?.kind)||!Array.isArray(pc.pipelines)||!pc.pipelines.length)throw new TypeError('Existing source-owner plan required');
  for(const key of['count','stateWords','scratchWords','controlTailBase','controlWords','programBase','instructions'])integer(pc[key],key);
  const route=new Map(),pieces=[],entries=[];
  for(const [index,pipeline] of pc.pipelines.entries()){
    if(typeof pipeline.code!=='string'||pipeline.code.split(SIGNATURE).length!==2||!Array.isArray(pipeline.pipelineIds)||!pipeline.pipelineIds.length)throw new TypeError('Exact single-gid source owner required');
    const entry='rc_micro_original_owner_'+index;
    const renamed=pipeline.code.replace(SIGNATURE,'fn '+entry+'(gid:vec3<u32>)');
    pieces.push(renamed);entries.push(Object.freeze({index,name:pipeline.name,entry,pipelineIds:Object.freeze([...pipeline.pipelineIds]),sourceCode:pipeline.code}));
    for(const id of pipeline.pipelineIds){integer(id,'source pipeline');if(route.has(id))throw new RangeError('Every source phase must have exactly one owner');route.set(id,index);}
  }
  if(!(pc.bytecode instanceof Uint32Array)||pc.bytecode.length!==pc.instructions*4)throw new TypeError('Exact original world bytecode required');
  for(let at=0;at<pc.bytecode.length;at+=4)if(pc.bytecode[at]===WORLD_DEVICE_PC.opcode.call&&!route.has(pc.bytecode[at+1]))throw new RangeError('Source CALL has no declared owner');
  // Deduplicate first so unknown declarations/helpers cannot silently select a
  // variant. A temporary entry retains every exact original source closure.
  const all=linkResidentWGSL([...pieces,'fn rc_micro_all(gid:vec3<u32>){'+entries.map(x=>x.entry+'(gid);').join('')+'}'],{entry:'rc_micro_all'});
  const globals=privateDeclarations(all.code);
  if(new Set(globals.map(x=>x.name)).size!==globals.length)throw new RangeError('Private declaration must be unique');
  const reset='fn rc_micro_reset_private(){'+globals.map(x=>x.name+'='+x.initial+';').join('')+'}';
  const entry='rc_micro_world_run';
  const dispatcher=`
fn ${entry}(gid:vec3<u32>){
 if(gid.x>=${pc.count}u){return;}
 let cb=${pc.controlTailBase}u+gid.x*${pc.controlWords}u;
 loop{
  if(rc_state[cb]!=${WORLD_DEVICE_PC.magic}u||rc_state[cb+1u]!=1u){rc_pc_fail(cb,1u);return;}
  if(rc_state[cb+4u]!=1u){return;}
  let originalPC=rc_state[cb+2u];
  if(originalPC>=${pc.instructions}u){rc_pc_fail(cb,2u);return;}
  let ip=${pc.programBase}u+originalPC*4u;
  if(rc_program[ip]!=1u){rc_pc_fail(cb,11u);return;}
  let originalPipeline=rc_program[ip+1u];
  rc_micro_reset_private();
  switch originalPipeline{
   ${entries.map(x=>'case '+x.pipelineIds.map(id=>id+'u').join(',')+':{'+x.entry+'(gid);}').join('\n')}
   default:{rc_pc_fail(cb,3u);return;}
  }
 }
}`;
  const linked=linkResidentWGSL([...pieces,reset,dispatcher],{entry});
  return Object.freeze({kind:'resident-world-microcode-source-v1',entry,code:linked.code,functions:linked.functions,entries:Object.freeze(entries),privateGlobals:Object.freeze(globals),route:Object.freeze(Object.fromEntries(route)),sourceBytecode:pc.bytecode,
    capability:Object.freeze({sourceBodiesUnchanged:true,sourceCapsUnchanged:true,dynamicOwnerSelection:true,hostStateReadback:false,nativeQualified:false,fullRestQualified:false,hardwarePerformance:false,defaultBackend:false})});
}
