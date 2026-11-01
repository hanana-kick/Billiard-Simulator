/* SPDX-License-Identifier: Apache-2.0
 * Opt-in request lowering of the SIX existing geometry graph call sites.
 * Prefix/suffix text is extracted from the original generators, not rewritten
 * arithmetic. One evaluator callsite sits outside every new control loop.
 * Non-VM predicates/products in those source suffixes remain their original
 * numerical dependencies; this is not an integer-only geometry implementation.
 */
import {generateNarrowphaseWGSL} from './narrowphase.mjs';
import {generateWorldGeometryWGSL} from './world-geometry.mjs';
import {generateWorldCueGeometryWGSL} from './world-cue-geometry.mjs';
import {generateEmptyCueCacheWGSL} from './cue-empty-caches.mjs';
import {generateProfiledNumericWGSL,numericProfileCode,NUMERIC_PROFILE} from './numeric-profile.mjs';
import {generateNumericRequestWGSL} from './numeric-request.mjs';

export {NUMERIC_REQUEST as GEOMETRY_NUMERIC_REQUEST} from './numeric-request.mjs';

function sourceFunction(source,name){
 const at=source.indexOf('fn '+name+'(');if(at<0)throw Error('Missing original geometry function '+name);
 const open=source.indexOf('{',at);let end=open+1,depth=1;
 for(;depth&&end<source.length;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}
 if(depth)throw Error('Unclosed original geometry function '+name);
 return{code:source.slice(at,end),signature:source.slice(at,open),body:source.slice(open+1,end-1)};
}
function seam(source,name){
 const f=sourceFunction(source,name),m=/if\(rc_num_eval\(([^,]+),scratch\)!=1u\)\{/.exec(f.body);
 if(!m||f.body.match(/rc_num_eval\(/g)?.length!==1)throw Error('Original single evaluator seam changed: '+name);
 const open=m.index+m[0].length-1;let end=open+1,depth=1;
 for(;depth;end++){if(end>=f.body.length)throw Error('Unclosed original numeric failure');if(f.body[end]==='{')depth++;else if(f.body[end]==='}')depth--;}
 return{...f,name,program:m[1],prefix:f.body.slice(0,m.index),failure:f.body.slice(open+1,end-1),suffix:f.body.slice(end)};
}
function renamedSignature(f,phase){return f.signature.replace('fn '+f.name+'(','fn rc_gn_'+phase+'_'+f.name+'(').replace(/\)(\s*(?:->\w+)?\s*)$/,',request:u32)$1');}
function lowered(f,{save='',restore='',success='0u'}={}){
 return renamedSignature(f,'prepare')+'{'+f.prefix+save+`rc_gn_mark(request,${f.program},scratch);return${success===null?'':' '+success};}\n`+
  renamedSignature(f,'finish')+'{'+restore+`if(rc_state[request+18u]!=1u){${f.failure}}`+f.suffix+'}\n';
}
function sourceParts(t){
 let narrow=generateNarrowphaseWGSL(t.bundles.narrow),cue=generateWorldCueGeometryWGSL(),empty=generateEmptyCueCacheWGSL();
 const fs=[seam(narrow,'rc_narrow_floor'),seam(narrow,'rc_narrow_pair'),seam(narrow,'rc_narrow_convex_prepare'),seam(narrow,'rc_narrow_convex_finish'),seam(cue,'rc_world_cue_geometry_pose'),seam(empty,'rc_empty_cache_numeric')];
 for(const f of fs){narrow=narrow.replace(f.code,'');cue=cue.replace(f.code,'');empty=empty.replace(f.code,'');}
 // The wrapper is also split: cache query input and g+11 publication belong to
 // the ORIGINAL caller suffix, not to the generic numerical worker.
 cue=cue.replace(sourceFunction(cue,'rc_world_cue_geometry_cache').code,'');
 const save='rc_state[request+16u]=oldPair;rc_state[request+17u]=oldPoint;';
 const code=lowered(fs[0],{save,restore:'let oldPair=rc_state[request+16u];let oldPoint=rc_state[request+17u];'})+
  lowered(fs[1],{save:'rc_state[request+16u]=u32(oldPair);rc_state[request+17u]=u32(oldPoint);',restore:'let oldPair=rc_state[request+16u]!=0u;let oldPoint=rc_state[request+17u]!=0u;'})+
  lowered(fs[2])+lowered(fs[3])+lowered(fs[4],{success:null,restore:'let program=rc_state[request+9u];'})+
  lowered(fs[5],{success:'true',restore:'let outn=rc_state[request+21u];'});
 return{support:narrow+'\n'+cue+'\n'+empty+'\n'+generateWorldGeometryWGSL(t,'control'),lowered:code,seams:fs};
}
function validateTemplate(t){
 if(t?.kind!=='resident-created-world-layout'||!Number.isInteger(t.state?.length)||!Number.isInteger(t.numericScratchWords)||!t.bundles?.narrow||!t.bundles?.cueGeometry)throw TypeError('Exact created world geometry template required');
 for(const key of['caches','projectionOutput','cueGeometry','worldH'])if(!Number.isInteger(t.segments?.[key]?.offset))throw TypeError('Missing original geometry segment '+key);
}
/** The request is a new, exclusively owned tail span, never a cache, PC stack,
 * worldH+8..23, or shared numeric scratch. Optional routing allocation metadata
 * enforces its exact candidate address when supplied by the owner compiler.
 * No source stage may advance the world PC until request.status==completed;
 * sourceResult and transport status are intentionally different values.
 */
export function generateGeometryNumericOwnerWGSL(t,{numericProfile=NUMERIC_PROFILE.PRESERVED_F32,includeNumericLibrary=true,includeRequestLibrary=true,includeRequestValidator=true,
 requestTailBase,candidateCount}={}){
 validateTemplate(t);const profile=numericProfileCode(numericProfile),o=t.segments,p=t.programOffsets,n=t.state.length;
 const allocated=requestTailBase!==undefined||candidateCount!==undefined;
 if(allocated&&(!Number.isSafeInteger(requestTailBase)||requestTailBase<0||!Number.isInteger(candidateCount)||candidateCount<1||candidateCount>4096||requestTailBase<candidateCount*n+t.fixedCcd.length||requestTailBase+candidateCount*24>0xffffffff))throw RangeError('Disjoint bounded geometry request tail allocation required');
 const parts=sourceParts(t),e=t.bundles.narrow.entries;
 const sourcePrograms=[e.floor,e.pair,e.convexRecycle,e.convex].map(x=>p.narrow+x.base);
 const code=`
${parts.lowered}
fn rc_gn_source_result(bank:u32,request:u32,result:u32)->u32{
 let kind=rc_state[request+2u];rc_state[request+19u]=result;
 if(kind==3u){if(result==2u){rc_world_geometry_fail(bank,2u);}else{rc_state[bank+29u]=result;}}
 else if(kind<=4u&&result!=0u){rc_world_geometry_fail(bank,2u);}
 return result;
}
fn rc_geometry_numeric_prepare(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32,kind:u32)->u32{
 if(!rc_gn_address(bank,scratch,request)||kind<1u||kind>6u){return rc_gn_fail(bank,request);}
 if(rc_state[request]==0x5243474eu&&(rc_state[request+3u]==1u||rc_state[request+3u]==2u)){
  if(!rc_gn_identity(bank,scratch,request,originalPC,originalPipeline)||rc_state[request+2u]!=kind){return rc_gn_fail(bank,request);}return rc_state[request+19u];
 }
 if(rc_state[request]==0x5243474eu&&rc_state[request+3u]==4u){return rc_gn_fail(bank,request);}
 for(var i=0u;i<24u;i++){rc_state[request+i]=0u;}
 rc_state[request]=0x5243474eu;rc_state[request+1u]=1u;rc_state[request+2u]=kind;rc_state[request+3u]=3u;rc_state[request+4u]=originalPC;rc_state[request+5u]=originalPipeline;rc_state[request+6u]=rc_state[bank+5u];rc_state[request+7u]=rc_state[bank+${o.worldH.offset+2}u];rc_state[request+10u]=scratch;rc_state[request+23u]=${profile}u;
 var result=0u;
 if(kind<=4u){
  let geometryKind=select(select(2u,1u,kind==2u),0u,kind==1u);if(kind==4u){if(!rc_world_geometry_point_ready(bank)){return 0u;}}else{if(!rc_world_geometry_ready(bank,geometryKind)){return 0u;}}
  let base=rc_state[bank+26u];if(base<bank+${o.caches.offset}u||base>=bank+${o.caches.offset+o.caches.words}u){return rc_gn_fail(bank,request);}
  let present=rc_state[bank+27u];let visited=rc_state[bank+28u];rc_state[request+8u]=base;rc_state[request+12u]=present;rc_state[request+13u]=visited;
  switch kind{
   case 1u:{result=rc_gn_prepare_rc_narrow_floor(base,scratch,${p.narrow}u,present,visited,request);}
   case 2u:{result=rc_gn_prepare_rc_narrow_pair(base,scratch,${p.narrow}u,present,visited,request);}
   case 3u:{result=rc_gn_prepare_rc_narrow_convex_prepare(base,scratch,${p.narrow}u,present,visited,request);}
   default:{let projection=bank+${o.projectionOutput.offset}u;rc_state[request+14u]=projection;result=rc_gn_prepare_rc_narrow_convex_finish(base,scratch,${p.narrow}u,projection,request);}
  }
 }else{
  let g=bank+${o.cueGeometry.offset}u;rc_state[request+8u]=g;
  if(kind==5u){rc_state[request+20u]=g+3188u;rc_gn_prepare_rc_world_cue_geometry_pose(g,${p.cueGeometry}u,scratch,request);}
  else{
   if(rc_state[g]!=0u||rc_state[g+11u]!=1u){return 0u;}let cache=rc_wcg_cache(g);let program=${p.cueGeometry}u+rc_program[${p.cueGeometry}u+select(2u,3u,rc_state[g+7u]==2u)];
   rc_state[request+12u]=cache;rc_state[request+13u]=g+3202u;rc_state[request+14u]=g+3258u;rc_state[request+15u]=g+3360u;rc_state[request+20u]=g+3258u;
   if(!rc_gn_prepare_rc_empty_cache_numeric(cache,g+3202u,g+3258u,program,scratch,request)){rc_wcg_fail(g,4u);}
  }
 }
 if(rc_state[request+3u]==3u){return rc_gn_source_result(bank,request,result);}return result;
}
fn rc_gn_request_valid(bank:u32,request:u32)->bool{
 let kind=rc_state[request+2u];if(kind<1u||kind>6u){return false;}let g=bank+${o.cueGeometry.offset}u;var expected=0u;
 if(kind<=4u){if(rc_state[request+8u]!=rc_state[bank+26u]||rc_state[request+12u]!=rc_state[bank+27u]||rc_state[request+13u]!=rc_state[bank+28u]){return false;}
  switch kind{case 1u:{expected=${sourcePrograms[0]}u;}case 2u:{expected=${sourcePrograms[1]}u;}case 3u:{expected=${sourcePrograms[2]}u;}default:{expected=${sourcePrograms[3]}u;if(rc_state[request+14u]!=bank+${o.projectionOutput.offset}u){return false;}}}
 }else{if(rc_state[request+8u]!=g){return false;}if(kind==5u){expected=${p.cueGeometry}u+rc_program[${p.cueGeometry+1}u];if(rc_state[request+20u]!=g+3188u){return false;}}
  else{expected=${p.cueGeometry}u+rc_program[${p.cueGeometry}u+select(2u,3u,rc_state[g+7u]==2u)];if(rc_state[request+12u]!=rc_wcg_cache(g)||rc_state[request+13u]!=g+3202u||rc_state[request+14u]!=g+3258u||rc_state[request+15u]!=g+3360u||rc_state[request+20u]!=g+3258u){return false;}}
 }
 return rc_state[request+9u]==expected&&rc_state[request+11u]==rc_program[expected+3u]&&rc_state[request+21u]==rc_program[expected+4u]&&rc_state[request+22u]==expected+rc_program[expected+8u];
}
fn rc_geometry_numeric_finish(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->u32{
 if(!rc_gn_identity(bank,scratch,request,originalPC,originalPipeline)){return rc_gn_fail(bank,request);}let status=rc_state[request+3u];if(status==3u){return rc_state[request+19u];}if(status!=2u||!rc_gn_request_valid(bank,request)){return rc_gn_fail(bank,request);}
 let kind=rc_state[request+2u];let base=rc_state[request+8u];var result=0u;
 switch kind{
  case 1u:{result=rc_gn_finish_rc_narrow_floor(base,scratch,${p.narrow}u,rc_state[request+12u],rc_state[request+13u],request);}
  case 2u:{result=rc_gn_finish_rc_narrow_pair(base,scratch,${p.narrow}u,rc_state[request+12u],rc_state[request+13u],request);}
  case 3u:{result=rc_gn_finish_rc_narrow_convex_prepare(base,scratch,${p.narrow}u,rc_state[request+12u],rc_state[request+13u],request);}
  case 4u:{result=rc_gn_finish_rc_narrow_convex_finish(base,scratch,${p.narrow}u,rc_state[request+14u],request);}
  case 5u:{rc_gn_finish_rc_world_cue_geometry_pose(base,${p.cueGeometry}u,scratch,request);}
  default:{if(!rc_gn_finish_rc_empty_cache_numeric(rc_state[request+12u],rc_state[request+13u],rc_state[request+14u],rc_state[request+9u],scratch,request)){rc_wcg_fail(base,4u);}else{rc_empty_cache_query_input(rc_state[request+12u],rc_state[request+13u],rc_state[request+14u],rc_state[request+15u]);rc_state[base+11u]=2u;}}
 }
 rc_state[request+3u]=3u;return rc_gn_source_result(bank,request,result);
}
// Router completion is distinct from sourceResult. The shared evaluator may
// run between these calls; WAIT never advances the original source PC.
fn rc_geometry_numeric_entry(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32,kind:u32)->u32{
 if(!rc_gn_address(bank,scratch,request)){rc_gn_fail(bank,request);return 2u;}
 let transport=rc_state[request+3u];
 if(transport==1u||transport==2u){if(!rc_gn_identity(bank,scratch,request,originalPC,originalPipeline)||rc_state[request+2u]!=kind){rc_gn_fail(bank,request);return 2u;}if(transport==1u){return 0u;}rc_geometry_numeric_finish(bank,scratch,request,originalPC,originalPipeline);}
 else{rc_geometry_numeric_prepare(bank,scratch,request,originalPC,originalPipeline,kind);}
 if(rc_state[request+3u]==4u){return 2u;}return select(0u,1u,rc_state[request+3u]==3u);
}
${[['floor',1],['pair',2],['convex_prepare',3],['convex_finish',4],['cue_pose',5],['cue_cache',6]].map(([name,kind])=>`fn rc_geometry_${name}_entry(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->u32{return rc_geometry_numeric_entry(bank,scratch,request,originalPC,originalPipeline,${kind}u);}`).join('\n')}
fn rc_geometry_numeric_run(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32,kind:u32)->u32{
 if(!rc_gn_address(bank,scratch,request)){return rc_gn_fail(bank,request);}
 rc_geometry_numeric_prepare(bank,scratch,request,originalPC,originalPipeline,kind);
 if(rc_state[request+3u]==4u){return 0xffffffffu;}
 rc_geometry_numeric_evaluate(bank,scratch,request,originalPC,originalPipeline);
 if(rc_state[request+3u]==4u){return 0xffffffffu;}
 return rc_geometry_numeric_finish(bank,scratch,request,originalPC,originalPipeline);
}
`;
 const shared=includeRequestLibrary?generateNumericRequestWGSL(t,{numericProfile,includeNumericLibrary,requestTailBase,candidateCount}):(includeNumericLibrary?generateProfiledNumericWGSL(numericProfile):'');
 const validator=includeRequestValidator?'fn rc_numeric_request_validate_owner(bank:u32,request:u32)->bool{return rc_gn_request_valid(bank,request);}':'';
 return shared+'\n'+parts.support+'\n'+code+'\n'+validator;
}

/** TEST ONLY: exports exact extraction metadata, not a runtime host solver. */
export function geometryNumericSourceSeamsForTest(template,{testOnly=false}={}){
 if(!testOnly)throw TypeError('Explicit test-only source seam inspection required');validateTemplate(template);
 return sourceParts(template).seams.map(({name,code,prefix,failure,suffix,program})=>({name,code,prefix,failure,suffix,program}));
}
