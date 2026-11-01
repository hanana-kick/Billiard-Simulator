/* SPDX-License-Identifier: Apache-2.0
 * Source-call adapters for owner routing. Only IDENTICAL original phase bodies
 * are coalesced: source equations, order, returns and completion checks remain
 * unchanged. One visit executes one original CALL, never a physics helper loop.
 */
import {linkResidentWGSL} from './wgsl-linker.mjs';

function removeMain(code){
 const start=code.indexOf('@compute @workgroup_size(1) fn main(');
 if(start<0)throw new RangeError('Original one-lane phase compute entry required');
 const brace=code.indexOf('{',start);let end=brace+1,depth=1;
 for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;else if(code[end]==='}')depth--;}
 if(depth)throw new SyntaxError('Unclosed original source entry');
 return code.slice(0,start)+code.slice(end);
}

/** pipelineIds are explicit original source IDs, never selected by a name
 * heuristic. The router supplies the same candidate bank/scratch and validates
 * its current PC. A repeated source continuation returning pending is still a
 * completed original CALL; its original repeat decides the next CALL.
 *
 * Use this adapter only where linked helper definitions are identical. Query
 * phase adapters with conflicting definitions require explicit alpha-renaming;
 * the linker rejects them rather than silently selecting a variant.
 */
export function makeCompactSourceOwner(plan,{id,name,pipelineIds,entry='rc_compact_source_owner'}={}){
 if(plan?.kind!=='resident-source-world-h-plan')throw new TypeError('Original source world plan required');
 if(!Number.isInteger(id)||id<0||id>0xffffffff||typeof name!=='string'||!name||!/^[_A-Za-z]\w*$/.test(entry))throw new TypeError('Explicit owner identity and entry required');
 if(!Array.isArray(pipelineIds)||!pipelineIds.length||new Set(pipelineIds).size!==pipelineIds.length||pipelineIds.some(i=>!Number.isInteger(i)||i<0||i>=plan.pipelines.length))throw new RangeError('Distinct original pipeline IDs required');
 const ids=[...pipelineIds].sort((a,b)=>a-b),bodies=new Map(),pieces=[],guardCases=[];
 for(const index of ids){
  const p=plan.pipelines[index],body=p.devicePc?.body,guard=p.devicePc?.guard;
  if(typeof body!=='string'||typeof guard!=='string')throw new TypeError('Original source body and entry guard metadata required');
  pieces.push(removeMain(p.code));guardCases.push(`case ${index}u:{return ${guard};}`);
  const row=bodies.get(body)??{body,ids:[],fn:entry+'_body_'+bodies.size};row.ids.push(index);bodies.set(body,row);
 }
 const guardName=entry+'_guard';pieces.push(`fn ${guardName}(bank:u32,scratch:u32,phase:u32)->bool{switch phase{${guardCases.join('\n')}default:{return false;}}}`);
 const cases=[];
 for(const {body,ids:members,fn}of bodies.values()){
  // The original body's early return exits this helper, never the router's
  // receipt. A common flat/evaluator body has exactly one static callsite even
  // when it serves both application/joint or post/outer original phases.
  pieces.push(`fn ${fn}(bank:u32,scratch:u32){${body}}`);
  cases.push(`case ${members.map(i=>i+'u').join(',')}:{if(!${guardName}(bank,scratch,originalPipeline)){return 1u;}${fn}(bank,scratch);return 1u;}`);
 }
 pieces.push(`fn ${entry}(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->u32{switch originalPipeline{${cases.join('\n')}default:{return 2u;}}}`);
 const linked=linkResidentWGSL(pieces,{entry});
 return Object.freeze({id,name,pipelineIds:Object.freeze(ids),heavy:true,sourceCode:linked.code,entry,
  sourceBodies:ids.length,uniqueSourceBodies:bodies.size,sourceCallsites:Object.freeze([...bodies.values()].map(r=>Object.freeze({ids:Object.freeze([...r.ids]),entry:r.fn,body:r.body}))),
  capability:Object.freeze({sourceBodyIdentity:true,sourceCapsUnchanged:true,hostPhysicsFallback:false,nativeQualified:false,defaultBackend:false})});
}
