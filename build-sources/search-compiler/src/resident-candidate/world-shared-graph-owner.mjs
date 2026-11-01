/* SPDX-License-Identifier: Apache-2.0
 * One shared numeric worker for exact source CALL seams. Source prefixes and
 * suffixes execute once, outside the graph interpreter. No source PC advances
 * until the original suffix has returned. This does not qualify direct f32
 * predicates in those suffixes, nor change the public admission mask.
 */
import {generateNumericRequestWGSL,NUMERIC_REQUEST} from './numeric-request.mjs';
import {generateGeometryNumericOwnerWGSL} from './geometry-numeric-owner.mjs';
import {generateRemainingNumericOwnerWGSL} from './remaining-numeric-owner.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {NUMERIC_PROFILE} from './numeric-profile.mjs';

// Exact source call labels, not a pattern-based heuristic. Source additions
// must declare a new explicit seam or fail this construction.
const CALLS=new Map([
 ['ball-geometry-floor',[1,0,false]],['ball-geometry-pair',[2,0,false]],
 ['ball-geometry-convexPrepare',[3,0,false]],['ball-geometry-convexFinish',[4,0,false]],
 ['cue-geometry-pose',[5,0,false]],['cue-geometry-cache',[6,0,false]],
 ['collision-broad-evaluate',[16,0,false]],['post-broad-evaluate',[16,0,false]],
 ['scene-energy-evaluate',[17,0,false]],['cloth-evaluate',[18,0,false]],
 ['active-ccd-pre-evaluate',[19,0,false]],['active-ccd-post-evaluate',[19,0,false]],
 ['entry-inactive-evaluate',[20,0,false]],['newly-awake-inactive-evaluate',[20,0,false]],['post-inactive-evaluate',[20,0,false]],
 ['cue-pre-ccd-0',[21,0,false]],['cue-pre-ccd-1',[21,1,false]],
 ['cue-post-ccd-0',[21,0,true]],['cue-post-ccd-1',[21,1,true]],
]);
export function makeSharedGraphSourceOwner(t,plan,{id=1,pipelineIds,requestTailBase,numericProfile=NUMERIC_PROFILE.PRESERVED_F32,entry='rc_world_shared_graph_owner'}={}){
 if(plan?.kind!=='resident-source-world-h-plan'||t?.kind!=='resident-created-world-layout'||plan.stateWords!==t.state.length)throw new TypeError('Matching original world and plan required');
 if(plan.numericProfile!==numericProfile)throw new RangeError('Shared numeric worker profile must match every original source phase');
 if(!Number.isInteger(id)||id<0||!/^[_A-Za-z]\w*$/.test(entry)||!Array.isArray(pipelineIds)||!pipelineIds.length||new Set(pipelineIds).size!==pipelineIds.length)throw new TypeError('Explicit shared graph owner and original IDs required');
 const selected=pipelineIds.map(index=>{const phase=plan.pipelines[index],args=CALLS.get(phase?.name);if(!Number.isInteger(index)||!phase||phase.owner!=='shared-graph'||!args)throw new RangeError('Undeclared original graph seam '+phase?.name);return{index,name:phase.name,kind:args[0],role:args[1],post:args[2]};});
 const options={numericProfile,requestTailBase,candidateCount:plan.count};
 const common=generateNumericRequestWGSL(t,options),geometry=generateGeometryNumericOwnerWGSL(t,{...options,includeNumericLibrary:false,includeRequestLibrary:false,includeRequestValidator:false}),remaining=generateRemainingNumericOwnerWGSL(t,{numericProfile});
 const source=`
fn rc_numeric_request_validate_owner(bank:u32,request:u32)->bool{if(rc_state[request+2u]<=6u){return rc_gn_request_valid(bank,request);}return rc_remaining_numeric_request_valid(bank,request);}
fn ${entry}(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->u32{
 var kind=0u;var role=0u;var post=false;
 switch originalPipeline{${selected.map(r=>`case ${r.index}u:{kind=${r.kind}u;role=${r.role}u;post=${r.post};}`).join('\n')}default:{return 2u;}}
 if(!rc_gn_address(bank,scratch,request)){rc_gn_fail(bank,request);return 2u;}
 if(kind<=6u){rc_geometry_numeric_prepare(bank,scratch,request,originalPC,originalPipeline,kind);}else{rc_remaining_numeric_prepare(bank,scratch,request,originalPC,originalPipeline,kind,role,post);}
 if(rc_state[request+3u]==4u){return 2u;}
 // Exactly ONE evaluator callsite, after every source prefix has returned.
 rc_numeric_request_evaluate(bank,scratch,request,originalPC,originalPipeline);
 if(rc_state[request+3u]==4u){return 2u;}
 if(kind<=6u){rc_geometry_numeric_finish(bank,scratch,request,originalPC,originalPipeline);}else{rc_remaining_numeric_finish(bank,scratch,request,originalPC,originalPipeline);}
 if(rc_state[request+3u]==4u){return 2u;}
 return select(0u,1u,rc_state[request+3u]==3u);
}
`;
 const linked=linkResidentWGSL([common,geometry,remaining,source],{entry});
 if((linked.code.match(/\brc_num_eval\s*\(/g)??[]).length!==2)throw Error('Shared owner must contain one graph evaluator definition and one callsite');
 return Object.freeze({id,name:'shared-graph',pipelineIds:Object.freeze([...pipelineIds]),heavy:true,sourceCode:linked.code,entry,seams:Object.freeze(selected.map(Object.freeze)),requestWords:NUMERIC_REQUEST.words,
  capability:Object.freeze({sourceProgramsUnchanged:true,oneEvaluatorCallsite:true,nativeQualified:false,defaultBackend:false})});
}
