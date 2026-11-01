/* SPDX-License-Identifier: Apache-2.0
 * Opt-in source query owner routing. A visit executes ONE unchanged original
 * phase entry. Only conflicting immutable phase adapters are alpha-renamed;
 * shared support/GJK/simplex/EPA arithmetic is retained and deduplicated.
 * There is no numerical/controller loop around the heavy query callsite.
 */
import {linkResidentWGSL} from './wgsl-linker.mjs';
const FAMILIES=Object.freeze({
 point:Object.freeze({prefix:'ball-geometry-',stages:Object.freeze(['init','gjk','epa','finish']),adapters:Object.freeze(['rc_world_geometry_stage','rc_project_convex_stage'])}),
 contact:Object.freeze({prefix:'cue-geometry-contact-',stages:Object.freeze(['init','gjk','epa','finish']),adapters:Object.freeze(['rc_world_cue_geometry_stage','rc_raw_contact_stage','rc_project_convex_stage'])}),
 normal:Object.freeze({prefix:'cue-geometry-normal-',stages:Object.freeze(['init','gjk','finish']),adapters:Object.freeze(['rc_world_cue_geometry_stage','rc_empty_convex_query_stage'])})
});
export const WORLD_QUERY_OWNER=Object.freeze({families:FAMILIES,capability:Object.freeze({optIn:true,defaultBackend:false,sourceCapsUnchanged:true,oneOriginalCallPerVisit:true,nativeQualified:false,fullRestQualified:false})});
const mask=s=>s.replace(/\/\*[\s\S]*?\*\//g,x=>x.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,x=>' '.repeat(x.length));
function declarations(code){
 const text=mask(code),rows=[];let cursor=0;
 while(cursor<text.length){while(cursor<text.length&&/\s/.test(text[cursor]))cursor++;if(cursor===text.length)break;const start=cursor,re=/\b(fn|struct|alias|const|var|enable|requires|diagnostic)\b/g;re.lastIndex=cursor;const m=re.exec(text);if(!m)throw new SyntaxError('Unsupported source query declaration');const kind=m[1],name=kind==='fn'?/^\s+(\w+)/.exec(text.slice(re.lastIndex))?.[1]:null;let end;
  if(kind==='fn'||kind==='struct'){const open=text.indexOf('{',re.lastIndex);if(open<0)throw new SyntaxError('Missing source query body');let depth=1;end=open+1;for(;depth&&end<text.length;end++){if(text[end]==='{')depth++;else if(text[end]==='}')depth--;}if(depth)throw new SyntaxError('Unclosed source query body');if(text[end]===';')end++;}else{end=text.indexOf(';',re.lastIndex)+1;if(!end)throw new SyntaxError('Unclosed source query declaration');}
  rows.push({kind,name,code:code.slice(start,end)});cursor=end;
 }
 return rows;
}
const calls=s=>[...mask(s).matchAll(/\b(\w+)\s*\(/g)].map(m=>m[1]);
const rename=(s,names)=>s.replace(/\b(\w+)(?=\s*\()/g,x=>names.get(x)??x);
/** pc must come from the SAME original source plan. The owner factory does not
 * infer a routing partition or replace row traversal/EPA/finish with a hit flag.
 * The main router chooses a unique explicit owner ID for this returned spec. */
export function createWorldQueryOwner(pc,source,{family,id,name=family}={}){
 if(pc?.kind!=='resident-world-device-pc'||source?.kind!=='resident-source-world-h-plan'||source.pipelines.length!==pc.pipelines.length||pc.stateWords!==source.stateWords||pc.scratchWords!==source.scratchWords||pc.count!==source.count)throw new TypeError('Matching original phase-PC and source world plan required');
 if(!Object.hasOwn(FAMILIES,family)||!Number.isInteger(id)||id<0||id>0xffffffff||typeof name!=='string'||!name)throw new TypeError('Explicit query family and unique owner identity required');
 if(source.transport?.query!=='staged')throw new RangeError('Query owner first gate requires unchanged staged source phases');
 const spec=FAMILIES[family],pipelineIds=spec.stages.map(stage=>{const matches=source.pipelines.flatMap((p,i)=>p.name===spec.prefix+stage?[i]:[]);if(matches.length!==1)throw new RangeError('Complete unique original '+family+' phase roster required');return matches[0];});
 const allowed=new Set(['rc_pc_source_stage',...spec.adapters]),pieces=[],roots=[],phaseRenames=[];
 for(const pipeline of pipelineIds){
  if(source.pipelines[pipeline].owner!==family||pc.pipelines[pipeline].sourcePipeline!==pipeline)throw new RangeError('Original source query owner metadata disagrees');
  const ds=declarations(pc.pipelines[pipeline].code),fs=new Map(ds.filter(d=>d.kind==='fn').map(d=>[d.name,d.code]));if(!fs.has('rc_pc_source_stage'))throw new TypeError('Unchanged original phase source entry required');
  const keep=new Set(),todo=['rc_pc_source_stage'];while(todo.length){const fn=todo.pop();if(keep.has(fn))continue;keep.add(fn);for(const called of calls(fs.get(fn)))if(called!==fn&&fs.has(called))todo.push(called);}
  const renames=new Map([...keep].filter(fn=>allowed.has(fn)).map(fn=>[fn,fn+'_query_'+family+'_'+pipeline]));
  pieces.push(...ds.filter(d=>d.kind!=='fn').map(d=>d.code));for(const fn of keep)pieces.push(rename(fs.get(fn),renames));roots.push(renames.get('rc_pc_source_stage'));phaseRenames.push(Object.freeze({pipeline,renames:Object.freeze(Object.fromEntries(renames))}));
 }
 const entry='rc_query_owner_'+family+'_'+id;
 // Router already owns originalPC. These integer identity checks make the
 // domain adapter independently fail closed on an invalid routing call too.
 pieces.push(`fn ${entry}(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->u32{
 if(bank%${pc.stateWords}u!=0u||bank/${pc.stateWords}u>=${pc.count}u||scratch!=(bank/${pc.stateWords}u)*${pc.scratchWords}u||originalPC>=${pc.instructions}u){return 2u;}
 let instruction=${pc.programBase}u+originalPC*4u;if(rc_program[instruction]!=1u||rc_program[instruction+1u]!=originalPipeline){return 2u;}
 let gid=vec3<u32>(bank/${pc.stateWords}u,0u,0u);switch originalPipeline{
 ${pipelineIds.map((pipeline,i)=>`case ${pipeline}u:{${roots[i]}(gid);return 1u;}`).join('\n')}
 default:{return 2u;}}
}`);
 // Unknown shared helper disagreements are errors, never silently renamed.
 const linked=linkResidentWGSL(pieces,{entry});
 return Object.freeze({id,name,pipelineIds:Object.freeze(pipelineIds),heavy:true,sourceCode:linked.code,entry,queryAdapter:Object.freeze({family,phaseRenames:Object.freeze(phaseRenames),functions:linked.functions,capability:WORLD_QUERY_OWNER.capability})});
}
