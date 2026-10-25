import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
/* SPDX-License-Identifier: Apache-2.0
 * Device composition of original scene ownership, contact journal and original
 * force/sleep graphs. No host-provided hot/sleep/eligibility facts at runtime.
 * Source order: first registration admission; ordered collisions; force/hot;
 * removals/global split; all strong resets; all energy updates; component sleep.
 */
import {SCENE_LAYOUT as S,sceneEnergyPlan,sceneForcePlan,sceneActivationTestKernels} from './scene-activation.mjs';
import {SCENE_INITIALIZATION_LAYOUT as I} from './scene-initialization.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {COUPLED_BODY_OFFSETS as B} from './coupled-solver.mjs';
import {compileGraph,executeLowered} from './numeric-program.mjs';
const U=0xffffffff,key=h=>h.index+':'+h.generation;
const H=Object.freeze({version:0,status:1,phase:2,firstPending:3,operationCursor:4,awakeCount:5,componentCount:6,canonicalCount:7,initialEdges:8,lastEpoch:9,continuation:10,row:11,sleepGroup:12,sleepMember:13,pendingProgram:14,numericStatus:15,evaluations:16});
export const SCENE_WORLD_LAYOUT=Object.freeze({version:1,header:H,headerWords:32,bodyMapOffset:32,bodyMapCount:32,activationOffset:64,forceOffset:76,forceStride:6,awakeOffset:112,awakeStride:4,componentOffset:136,componentStride:4,componentMembersOffset:160,initialEdgeOffset:166,initialEdgeStride:5,gravityOffset:186,lengthUnitOffset:189,dtOffset:190,words:192,bytes:768});
const L=SCENE_WORLD_LAYOUT,need=(p,m)=>{if(!p)throw new RangeError('Scene world: '+m);},bits=x=>new Uint32Array(new Float32Array([x]).buffer)[0];
/** Initial immutable bindings. canonicalIndex is the body64 row index; use ball
 * source registry order 0..3 and original shaft/head 4/5 in the world owner.
 * Native handles are generation checked against the complete scene template. */
export function encodeSceneWorld(template,{bodyBindings,gravity,lengthUnit,initialEdges,firstPending=true}){
 need(Array.isArray(bodyBindings)&&bodyBindings.length<=6&&new Set(bodyBindings.map(x=>x.canonicalIndex)).size===bodyBindings.length,'distinct complete body64 bindings');need(Array.isArray(gravity)&&gravity.length===3&&gravity.every(x=>Number.isFinite(x)&&Object.is(Math.fround(x),x)),'source f32 gravity');need(Number.isFinite(lengthUnit)&&lengthUnit>0&&Object.is(Math.fround(lengthUnit),lengthUnit),'source f32 length unit');need(Array.isArray(initialEdges)&&initialEdges.length===4,'four original registered cloth edges');
 const a=new Uint32Array(L.words);a[H.version]=1;a[H.status]=1;a[H.firstPending]=+firstPending;a[H.canonicalCount]=bodyBindings.length;a[H.initialEdges]=initialEdges.length;a.fill(U,L.bodyMapOffset,L.bodyMapOffset+32);
 const by=new Map(bodyBindings.map(x=>[key(x.handle),x]));need(by.size===bodyBindings.length,'distinct native body bindings');template.bodies.forEach((b,i)=>{const binding=by.get(key(b.handle));if(b.type==='Dynamic'){need(binding&&Number.isInteger(binding.canonicalIndex)&&binding.canonicalIndex>=0&&binding.canonicalIndex<bodyBindings.length,'each dynamic body has its actual canonical row');a[L.bodyMapOffset+i]=binding.canonicalIndex;}else need(!binding,'fixed bodies are not dynamic body64 rows');});
 a.set(gravity.map(bits),L.gravityOffset);a[L.lengthUnitOffset]=bits(lengthUnit);for(const[e,i]of initialEdges.map((e,i)=>[e,i])){need(e.active===true&&e.collider1&&e.collider2,'original active cloth edge identity');a.set([e.collider1.index,e.collider1.generation,e.collider2.index,e.collider2.generation,1],L.initialEdgeOffset+i*5);}return a;
}
/** Shared once-per-world library. Two liveness-bounded source-ordered programs. */
export function createSceneWorldPrograms(){const entries=[sceneForcePlan(),sceneEnergyPlan()].map(plan=>compileGraph(plan)),header=new Uint32Array(8);header.set([0x52435357,1,2,8]);let at=8;entries.forEach((entry,i)=>{header[4+i]=at;at+=entry.program.length;});header[6]=Math.max(...entries.map(x=>x.scratchWords));const program=new Uint32Array(at);program.set(header);entries.forEach((e,i)=>program.set(e.program,header[4+i]));return Object.freeze({program,entries,scratchWords:header[6]});}
const CONSTANTS=()=>Object.entries({SW:H,SWL:L,SWB:B,SWI:I,SWIH:I.header,SWJ:J,SWJH:J.header,SWJC:J.collider,SWJE:J.edge,SWCH:J.change}).flatMap(([prefix,object])=>Object.entries(object).filter(([,v])=>Number.isInteger(v)).map(([name,value])=>`const ${prefix}_${name}:u32=${value}u;`)).join('\n');
export function generateSceneWorldWGSL({includeNumericLibrary=true,includeRosterBridge=true,continuationOnly=false,numericProfile}={}){const kernel=continuationOnly?withoutFunction(KERNEL,'rc_scene_world_observe'):KERNEL;const helpers=includeNumericLibrary?NUMERIC_HELPERS:withoutFunction(NUMERIC_HELPERS,'rc_sw_eval');const continuation=includeNumericLibrary?CONTINUATION:withoutFunction(CONTINUATION,'rc_scene_world_evaluate');return(includeNumericLibrary?generateProfiledNumericWGSL(numericProfile):'')+'\n'+CONSTANTS()+'\n'+helpers+'\n'+kernel+'\n'+continuation+(includeRosterBridge?'\n'+ROSTER_BRIDGE:'');}
function withoutFunction(text,name){const at=text.indexOf('fn '+name+'(');if(at<0)return text;const open=text.indexOf('{',at);let depth=1,end=open+1;while(depth&&end<text.length){if(text[end]==='{')depth++;else if(text[end]==='}')depth--;end++;}return text.slice(0,at)+text.slice(end);}
export const SCENE_WORLD_MAX_EVALUATIONS=24;
/** Compiler-bounded numerical dispatch: exactly one evaluator call, no scene loops. */
export function generateSceneWorldEvaluateWGSL({numericProfile}={}){return generateProfiledNumericWGSL(numericProfile)+'\n'+CONSTANTS()+'\n'+NUMERIC_HELPERS+'\n'+EVALUATE_ONLY;}
const NUMERIC_HELPERS=String.raw`
fn rc_sw_eval(bundle:u32,index:u32,scratch:u32)->u32{
 let length=arrayLength(&rc_program);if(bundle>length||length-bundle<8u||rc_program[bundle]!=0x52435357u||rc_program[bundle+1u]!=1u||rc_program[bundle+2u]!=2u||index>=2u){return 2u;}let program=bundle+rc_program[bundle+4u+index];return rc_num_eval(program,scratch);
}
fn rc_sw_output(bundle:u32,index:u32,scratch:u32,output:u32)->u32{let program=bundle+rc_program[bundle+4u+index];let map=program+rc_program[program+8u];return rc_scratch[scratch+rc_program[map+output]];}
`;
const KERNEL=String.raw`
fn rc_sw_fail(scene:u32,bridge:u32,reason:u32)->bool{rc_state[bridge+SW_status]=4u;return rc_scene_bad(scene,reason);}
fn rc_sw_body(scene:u32,bridge:u32,canonical:u32,member:u32)->u32{
 if(!rc_scene_valid_body(scene,member)){rc_sw_fail(scene,bridge,6u);return 0xffffffffu;}let row=rc_state[bridge+SWL_bodyMapOffset+member];if(row>=rc_state[bridge+SW_canonicalCount]){rc_sw_fail(scene,bridge,6u);return 0xffffffffu;}return canonical+row*64u;
}
// Source finishLiveRegisteredFourBallCollisionPhase gate: before sequence zero,
// unchanged original cloth prefix, changes exclusively INACTIVE cue appends.
// Later recurrent cloth/head contact ownership does not relax this first-h gate.
fn rc_scene_world_first_collision(scene:u32,initialization:u32,journal:u32,bridge:u32)->bool{
 if(rc_state[bridge+SW_firstPending]!=1u||rc_state[bridge+SW_status]!=1u||rc_state[scene+SH_phase]!=1u||rc_state[initialization+SWIH_phase]!=1u||rc_state[initialization+SWIH_numericReady]!=7u){return rc_sw_fail(scene,bridge,6u);}
 if(rc_state[journal+SWJH_status]!=0u||rc_state[journal+SWJH_phase]!=3u||rc_state[journal+SWJH_fromSequence]!=0u||rc_state[journal+SWJH_sequence]!=1u||rc_state[journal+SWJH_birthPending]!=0u||rc_state[journal+SWJH_removed]!=0u||rc_state[journal+SWJH_cueCount]!=3u){return rc_sw_fail(scene,bridge,6u);}
 let initial=rc_state[bridge+SW_initialEdges];if(initial!=4u||rc_state[journal+SWJH_edges]<initial){return rc_sw_fail(scene,bridge,6u);}
 for(var i=0u;i<initial;i++){let e=journal+SWJ_edgeOffset+i*SWJ_edgeStride;let expected=bridge+SWL_initialEdgeOffset+i*5u;let a=journal+SWJ_colliderOffset+rc_state[e]*SWJ_colliderStride;let c=journal+SWJ_colliderOffset+rc_state[e+1u]*SWJ_colliderStride;
  if(rc_state[a]!=rc_state[expected]||rc_state[a+1u]!=rc_state[expected+1u]||rc_state[c]!=rc_state[expected+2u]||rc_state[c+1u]!=rc_state[expected+3u]||rc_state[e+2u]!=rc_state[expected+4u]){return rc_sw_fail(scene,bridge,6u);}}
 for(var i=0u;i<rc_state[journal+SWJH_changes];i++){let change=journal+SWJ_changeOffset+i*SWJ_changeStride;let a=journal+SWJ_colliderOffset+rc_state[change+SWCH_collider1Slot]*SWJ_colliderStride;let c=journal+SWJ_colliderOffset+rc_state[change+SWCH_collider2Slot]*SWJ_colliderStride;if(rc_state[change+SWCH_kind]!=1u||rc_state[change+SWCH_oldActive]!=0u||rc_state[change+SWCH_newActive]!=0u||(rc_state[a+SWJC_cue]==0u&&rc_state[c+SWJC_cue]==0u)){return rc_sw_fail(scene,bridge,6u);}}
 // Source initializer clears body/collider flags, then accounts for its initial
 // joint unlink journal before Scene starts its ordinary pre-energy phase.
 for(var i=0u;i<rc_state[scene+SH_consumedCount];i++){let member=rc_state[scene+SL_consumedOffset+i];if(rc_scene_valid_body(scene,member)){rc_state[rc_scene_bp(scene,member)+SB_changes]=0u;}}
 for(var i=0u;i<rc_state[initialization+SWIH_consumedColliderCount];i++){let collider=rc_state[initialization+SWI_modifiedColliderOffset+i];let co=initialization+SWI_colliderOffset+collider*4u;var found=false;for(var j=0u;j<rc_state[journal+SWJH_colliders];j++){let q=journal+SWJ_colliderOffset+j*SWJ_colliderStride;if(rc_state[q]==rc_state[co]&&rc_state[q+1u]==rc_state[co+1u]&&rc_state[q+SWJC_cue]!=0u&&rc_state[q+SWJC_live]!=0u){found=true;}}if(!found){return rc_sw_fail(scene,bridge,6u);}rc_state[co+3u]=0u;}
 for(var i=0u;i<rc_state[scene+SH_removalCount];i++){let first=rc_state[scene+SL_removalOffset+2u*i];let second=rc_state[scene+SL_removalOffset+2u*i+1u];if(!rc_scene_valid_body(scene,first)||!rc_scene_valid_body(scene,second)){continue;}let a=rc_scene_bp(scene,first);let c=rc_scene_bp(scene,second);let id=rc_state[a+SB_island];if(id==0xffffffffu||id!=rc_state[c+SB_island]){continue;}let av=rc_state[a+SB_activation];let cv=rc_state[c+SB_activation];if((av&0x80000000u)==0u||(av&0x7fffffffu)==0u||(cv&0x80000000u)==0u||(cv&0x7fffffffu)==0u){return rc_sw_fail(scene,bridge,6u);}let p=rc_scene_pp(scene,id);if(rc_state[p+SP_removed]==0xffffffffu){return rc_sw_fail(scene,bridge,4u);}rc_state[p+SP_removed]=rc_state[p+SP_removed]+1u;}
 rc_state[scene+SH_removalCount]=0u;rc_state[scene+SH_phase]=2u;rc_state[scene+SH_sourcePhase]=2u;rc_state[initialization+SWIH_phase]=2u;rc_state[bridge+SW_firstPending]=0u;return rc_scene_begin(scene);
}
// Source application/CCD owner starts a new ordinary collision pass first.
fn rc_scene_world_begin_pass(scene:u32,bridge:u32)->bool{if(!rc_scene_ok(scene)||rc_state[bridge+SW_status]!=1u||rc_state[scene+SH_phase]!=4u){return rc_sw_fail(scene,bridge,6u);}rc_state[bridge+SW_operationCursor]=0u;rc_state[bridge+SW_phase]=0u;return true;}
fn rc_scene_world_apply_operations(scene:u32,journal:u32,bridge:u32,count:u32)->bool{
 if(rc_state[bridge+SW_status]!=1u||rc_state[bridge+SW_phase]!=0u){return rc_sw_fail(scene,bridge,6u);}let start=rc_state[bridge+SW_operationCursor];if(!rc_scene_apply_journal(scene,journal,start,count)){rc_state[bridge+SW_status]=4u;return false;}rc_state[bridge+SW_operationCursor]=start+count;return true;
}
fn rc_scene_world_prepare(scene:u32,initialization:u32,journal:u32,bridge:u32)->bool{
 if(rc_state[bridge+SW_firstPending]!=0u){if(!rc_scene_world_first_collision(scene,initialization,journal,bridge)){return false;}}
 if(rc_state[bridge+SW_status]!=1u||rc_state[bridge+SW_phase]!=0u||rc_state[journal+SWJH_status]!=0u||rc_state[journal+SWJH_phase]!=3u){return rc_sw_fail(scene,bridge,6u);}let cursor=rc_state[bridge+SW_operationCursor];let count=rc_state[journal+SWJH_operations];if(cursor>count){return rc_sw_fail(scene,bridge,6u);}if(!rc_scene_world_apply_operations(scene,journal,bridge,count-cursor)||!rc_scene_collisions_done(scene)||!rc_scene_incidence_from_journal(scene,journal)){rc_state[bridge+SW_status]=4u;return false;}rc_state[bridge+SW_phase]=1u;return true;
}
fn rc_sw_clear_input(scratch:u32){for(var i=0u;i<32u;i++){rc_scratch[scratch+i]=0u;}}
fn rc_sw_energy_input(scene:u32,bridge:u32,canonical:u32,member:u32,scratch:u32,operation:u32)->bool{
 let body=rc_sw_body(scene,bridge,canonical,member);if(body==0xffffffffu){return false;}let q=rc_scene_bp(scene,member);rc_sw_clear_input(scratch);
 for(var j=0u;j<12u;j++){rc_scratch[scratch+j]=rc_state[q+SB_activation+j];}for(var j=0u;j<3u;j++){rc_scratch[scratch+12u+j]=rc_state[body+SWB_translation+j];rc_scratch[scratch+19u+j]=rc_state[body+SWB_linear+j];rc_scratch[scratch+22u+j]=rc_state[body+SWB_angular+j];}for(var j=0u;j<4u;j++){rc_scratch[scratch+15u+j]=rc_state[body+SWB_rotation+j];}
 rc_scratch[scratch+25u]=rc_state[q+SB_maxExtent];rc_scratch[scratch+26u]=rc_state[bridge+SWL_lengthUnitOffset];rc_scratch[scratch+27u]=rc_state[bridge+SWL_dtOffset];rc_scratch[scratch+28u]=operation;return true;
}
fn rc_sw_gather_activation(bridge:u32,bundle:u32,scratch:u32)->u32{let output=bridge+SWL_activationOffset;for(var j=0u;j<12u;j++){rc_state[output+j]=rc_sw_output(bundle,1u,scratch,j);}return output;}
fn rc_sw_adopt_reset(scene:u32,member:u32,activation:u32){let q=rc_scene_bp(scene,member)+SB_activation;for(var j=0u;j<12u;j++){let value=rc_state[activation+j];rc_state[q+j]=value;if(j>=5u&&(value&0x7fffffffu)==0u){rc_state[q+j]=0u;}}}
fn rc_scene_world_observe(scene:u32,canonical:u32,bridge:u32,bundle:u32,scratch:u32,dtWord:u32)->bool{
 if(rc_state[bridge+SW_status]!=1u||rc_state[bridge+SW_phase]!=1u||(dtWord&0x80000000u)!=0u||(dtWord&0x7fffffffu)==0u||(dtWord&0x7f800000u)==0x7f800000u){return rc_sw_fail(scene,bridge,6u);}rc_state[bridge+SWL_dtOffset]=dtWord;if(!rc_scene_begin_energy(scene)){rc_state[bridge+SW_status]=4u;return false;}
 // First all force/hot rows, in entry active chunk order.
 for(var i=0u;i<rc_state[scene+SH_activeCount];i++){let member=rc_state[scene+SL_activeOffset+i];let body=rc_sw_body(scene,bridge,canonical,member);if(body==0xffffffffu){return false;}let q=rc_scene_bp(scene,member);rc_sw_clear_input(scratch);
  for(var j=0u;j<3u;j++){rc_scratch[scratch+j]=rc_state[body+SWB_userForce+j];rc_scratch[scratch+3u+j]=rc_state[bridge+SWL_gravityOffset+j];rc_scratch[scratch+6u+j]=rc_state[body+SWB_invMass+j];rc_scratch[scratch+10u+j]=rc_state[body+SWB_userTorque+j];rc_scratch[scratch+16u+j]=rc_state[body+SWB_linear+j];rc_scratch[scratch+19u+j]=rc_state[body+SWB_angular+j];}
  rc_scratch[scratch+9u]=rc_state[body+SWB_gravityScale];rc_scratch[scratch+22u]=rc_state[q+SB_maxExtent];rc_scratch[scratch+23u]=rc_state[q+SB_activation];rc_scratch[scratch+24u]=rc_state[bridge+SWL_lengthUnitOffset];if(rc_sw_eval(bundle,0u,scratch)!=1u){return rc_sw_fail(scene,bridge,5u);}
  for(var j=0u;j<6u;j++){let value=rc_sw_output(bundle,0u,scratch,j);rc_state[bridge+SWL_forceOffset+i*6u+j]=value;if(j<3u){rc_state[body+SWB_force+j]=value;}}
  let hot=rc_sw_output(bundle,0u,scratch,6u);if(hot!=0u&&hot!=0x3f800000u){return rc_sw_fail(scene,bridge,5u);}if(!rc_scene_force_fact(scene,member,hot!=0u)){rc_state[bridge+SW_status]=4u;return false;}
 }
 if(!rc_scene_before_energy_updates(scene)){rc_state[bridge+SW_status]=4u;return false;}
 // All source strong resets precede every update-energy row.
 for(var i=0u;i<rc_state[scene+SH_activeCount];i++){let member=rc_state[scene+SL_activeOffset+i];if((rc_state[scene+SH_resetMask]&(1u<<member))==0u){continue;}if(!rc_sw_energy_input(scene,bridge,canonical,member,scratch,0x40400000u)||rc_sw_eval(bundle,1u,scratch)!=1u){return rc_sw_fail(scene,bridge,5u);}rc_sw_adopt_reset(scene,member,rc_sw_gather_activation(bridge,bundle,scratch));}
 for(var i=0u;i<rc_state[scene+SH_activeCount];i++){let member=rc_state[scene+SL_activeOffset+i];if(!rc_sw_energy_input(scene,bridge,canonical,member,scratch,0u)||rc_sw_eval(bundle,1u,scratch)!=1u){return rc_sw_fail(scene,bridge,5u);}let eligible=rc_sw_output(bundle,1u,scratch,29u);if(eligible!=0u&&eligible!=0x3f800000u){return rc_sw_fail(scene,bridge,5u);}if(!rc_scene_adopt_energy(scene,member,rc_sw_gather_activation(bridge,bundle,scratch),eligible!=0u)){rc_state[bridge+SW_status]=4u;return false;}}
 if(!rc_scene_select_sleep(scene)){rc_state[bridge+SW_status]=4u;return false;}let topology=scene+SL_scratchOffset;
 // Flattened persistent component order is the source sleepRows order.
 for(var i=0u;i<rc_state[topology+214u];i++){let p=rc_scene_pp(scene,rc_state[topology+215u+i]);for(var j=0u;j<rc_state[p+SP_count];j++){let member=rc_state[p+SP_members+j];if(!rc_sw_energy_input(scene,bridge,canonical,member,scratch,0x3f800000u)||rc_sw_eval(bundle,1u,scratch)!=1u){return rc_sw_fail(scene,bridge,5u);}let body=rc_sw_body(scene,bridge,canonical,member);for(var z=0u;z<3u;z++){rc_state[body+SWB_linear+z]=rc_sw_output(bundle,1u,scratch,19u+z);rc_state[body+SWB_angular+z]=rc_sw_output(bundle,1u,scratch,22u+z);}if(!rc_scene_adopt_sleep(scene,member,rc_sw_gather_activation(bridge,bundle,scratch))){rc_state[bridge+SW_status]=4u;return false;}}}
 if(!rc_scene_finish_energy(scene)){rc_state[bridge+SW_status]=4u;return false;}// Preserve the original speculative cue component gate, including zero-force
 // and zero-torque ownership. A changed cue force is unsupported, not a miss.
 for(var role=0u;role<2u;role++){var member=rc_state[scene+SH_roleShaft];if(role==1u){member=rc_state[scene+SH_roleHead];}if(!rc_scene_valid_body(scene,member)){continue;}let q=rc_scene_bp(scene,member);if(rc_state[q+SB_activation+4u]!=0u){return rc_sw_fail(scene,bridge,6u);}var found=false;for(var i=0u;i<rc_state[scene+SH_activeCount];i++){if(rc_state[scene+SL_activeOffset+i]==member){found=true;for(var j=0u;j<6u;j++){if((rc_state[bridge+SWL_forceOffset+i*6u+j]&0x7fffffffu)!=0u){return rc_sw_fail(scene,bridge,6u);}}}}if(!found){return rc_sw_fail(scene,bridge,6u);}}
 rc_state[bridge+SW_phase]=2u;return rc_scene_world_orders(scene,bridge);
}
// Final awake chunk order differs from entry activeOffset after sleep swaps.
// Canonical rows remain stable; these are device-produced solver/BVH mappings.
fn rc_scene_world_orders(scene:u32,bridge:u32)->bool{
 if(!rc_scene_ok(scene)||rc_state[bridge+SW_status]!=1u||rc_state[scene+SH_phase]!=6u){return rc_sw_fail(scene,bridge,6u);}let awake=rc_state[scene+SH_awake];var count=0u;var components=0u;var members=0u;
 if(awake!=0xffffffffu){let c=rc_scene_cp(scene,awake);count=rc_state[c+1u];for(var i=0u;i<count;i++){let member=rc_state[c+2u+i];let q=rc_scene_bp(scene,member);let canonical=rc_state[bridge+SWL_bodyMapOffset+member];let island=rc_state[q+SB_island];if(canonical>=rc_state[bridge+SW_canonicalCount]||rc_state[q+SB_activation+4u]!=0u||rc_state[q+SB_activeIsland]!=awake||rc_state[q+SB_activeIndex]!=i){return rc_sw_fail(scene,bridge,6u);}let row=bridge+SWL_awakeOffset+i*4u;rc_state[row]=member;rc_state[row+1u]=canonical;rc_state[row+2u]=i;rc_state[row+3u]=island;
  var seen=false;for(var j=0u;j<components;j++){if(rc_state[bridge+SWL_componentOffset+j*4u]==island){seen=true;}}if(!seen){let p=rc_scene_pp(scene,island);let row=bridge+SWL_componentOffset+components*4u;rc_state[row]=island;rc_state[row+1u]=members;rc_state[row+2u]=rc_state[p+SP_count];rc_state[row+3u]=rc_state[p+SP_joints];if(members+rc_state[p+SP_count]>6u){return rc_sw_fail(scene,bridge,4u);}for(var j=0u;j<rc_state[p+SP_count];j++){let v=rc_state[p+SP_members+j];let id=rc_state[bridge+SWL_bodyMapOffset+v];if(id>=rc_state[bridge+SW_canonicalCount]||rc_state[rc_scene_bp(scene,v)+SB_activation+4u]!=0u){return rc_sw_fail(scene,bridge,6u);}rc_state[bridge+SWL_componentMembersOffset+members]=id;members++;}components++;}
 }}rc_state[bridge+SW_awakeCount]=count;rc_state[bridge+SW_componentCount]=components;rc_state[bridge+SW_lastEpoch]=rc_state[scene+SH_epoch];return true;
}
`;
const ROSTER_BRIDGE=String.raw`
// Metadata/graph transitions must already be complete in the source roster.
fn rc_scene_world_roster(scene:u32,bridge:u32,roster:u32,multibodyEpoch:u32)->bool{
 if(rc_state[bridge+SW_phase]!=2u||!rc_scene_ok(scene)){return rc_sw_fail(scene,bridge,6u);}rc_roster_begin_awake(roster,rc_state[scene+SH_epoch],multibodyEpoch);let topology=scene+SL_scratchOffset;
 for(var i=0u;i<rc_state[topology+214u];i++){let p=rc_scene_pp(scene,rc_state[topology+215u+i]);for(var j=0u;j<rc_state[p+SP_count];j++){let member=rc_state[p+SP_members+j];let q=rc_scene_bp(scene,member);rc_roster_sleep(roster,rc_state[q+SB_index],rc_state[q+SB_generation]);}}
 for(var i=0u;i<rc_state[bridge+SW_awakeCount];i++){let row=bridge+SWL_awakeOffset+i*4u;let q=rc_scene_bp(scene,rc_state[row]);rc_roster_awake(roster,rc_state[q+SB_index],rc_state[q+SB_generation],rc_state[row+2u]);}rc_roster_finish(roster);if(rc_state[roster]!=0u){return rc_sw_fail(scene,bridge,6u);}return true;
}
`;

/** Test-only shared-kernel execution; numeric operations run through the exact
 * lowered original graphs. There is no production CPU fallback or hot fact API. */
export function sceneWorldTestKernels(rc_state,programs,{scratchWords=programs.scratchWords}={}){
 const scene=sceneActivationTestKernels(rc_state),rc_scratch=new Uint32Array(scratchWords),outputs=new Map();let text=CONSTANTS()+'\n'+KERNEL+'\n'+CONTINUATION;const names=[...text.matchAll(/fn (rc_\w+)\(/g)].map(m=>m[1]);text=text.replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?\s*\{/g,(_,n,args)=>`function ${n}(${args.replace(/:(?:u32|bool)/g,'')}){`).replace(/:(?:u32|bool)(?=\s*=)/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/\bloop\s*\{/g,'while(true){');
 // Scene constants are needed only by field names, never copied future states.
 const constants=Object.entries({SH:S.header,SB:S.body,SP:S.persistent,SL:S}).flatMap(([prefix,group])=>Object.entries(group).filter(([,v])=>Number.isInteger(v)).map(([k,v])=>`const ${prefix}_${k}=${v};`)).join('\n');
 const evaluate=(bundle,index,scratch)=>{try{const result=executeLowered(programs.entries[index],new Float32Array(rc_scratch.buffer,scratch*4,32),{testOnly:true});outputs.set(index,new Uint32Array(result.buffer,result.byteOffset,result.length));return 1;}catch(e){return e.numericStatus??2;}},output=(_bundle,index,_scratch,i)=>outputs.get(index)[i];
 return new Function('rc_state','rc_scratch','rc_sw_eval','rc_sw_output',...Object.keys(scene),constants+'\n'+text+'\nreturn {'+names.join(',')+'};')(rc_state,rc_scratch,evaluate,output,...Object.values(scene));
}

// Gather/evaluate/scatter are separate dispatch entry points. All continuation
// fields, numerical scratch and body state remain resident between dispatches.
// Integer topology may loop; the numerical evaluator is never called in those
// loops. This prevents recursive GPU-driver inlining of the numerical VM.
const CONTINUATION=String.raw`
fn rc_scene_world_begin_observe(scene:u32,bridge:u32,dtWord:u32)->bool{
 if(rc_state[bridge+SW_status]!=1u||rc_state[bridge+SW_phase]!=1u||(dtWord&0x80000000u)!=0u||(dtWord&0x7fffffffu)==0u||(dtWord&0x7f800000u)==0x7f800000u){return rc_sw_fail(scene,bridge,6u);}rc_state[bridge+SWL_dtOffset]=dtWord;if(!rc_scene_begin_energy(scene)){rc_state[bridge+SW_status]=4u;return false;}rc_state[bridge+SW_continuation]=1u;rc_state[bridge+SW_row]=0u;rc_state[bridge+SW_evaluations]=0u;rc_state[bridge+SW_numericStatus]=0u;return true;
}
fn rc_sw_force_input(scene:u32,bridge:u32,canonical:u32,member:u32,scratch:u32)->bool{
 let body=rc_sw_body(scene,bridge,canonical,member);if(body==0xffffffffu){return false;}let q=rc_scene_bp(scene,member);rc_sw_clear_input(scratch);
 for(var j=0u;j<3u;j++){rc_scratch[scratch+j]=rc_state[body+SWB_userForce+j];rc_scratch[scratch+3u+j]=rc_state[bridge+SWL_gravityOffset+j];rc_scratch[scratch+6u+j]=rc_state[body+SWB_invMass+j];rc_scratch[scratch+10u+j]=rc_state[body+SWB_userTorque+j];rc_scratch[scratch+16u+j]=rc_state[body+SWB_linear+j];rc_scratch[scratch+19u+j]=rc_state[body+SWB_angular+j];}
 rc_scratch[scratch+9u]=rc_state[body+SWB_gravityScale];rc_scratch[scratch+22u]=rc_state[q+SB_maxExtent];rc_scratch[scratch+23u]=rc_state[q+SB_activation];rc_scratch[scratch+24u]=rc_state[bridge+SWL_lengthUnitOffset];return true;
}
fn rc_sw_finish_continuation(scene:u32,bridge:u32)->bool{
 if(!rc_scene_finish_energy(scene)){rc_state[bridge+SW_status]=4u;return false;}
 for(var role=0u;role<2u;role++){var member=rc_state[scene+SH_roleShaft];if(role==1u){member=rc_state[scene+SH_roleHead];}if(!rc_scene_valid_body(scene,member)){continue;}let q=rc_scene_bp(scene,member);if(rc_state[q+SB_activation+4u]!=0u){return rc_sw_fail(scene,bridge,6u);}var found=false;for(var i=0u;i<rc_state[scene+SH_activeCount];i++){if(rc_state[scene+SL_activeOffset+i]==member){found=true;for(var j=0u;j<6u;j++){if((rc_state[bridge+SWL_forceOffset+i*6u+j]&0x7fffffffu)!=0u){return rc_sw_fail(scene,bridge,6u);}}}}if(!found){return rc_sw_fail(scene,bridge,6u);}}
 rc_state[bridge+SW_phase]=2u;rc_state[bridge+SW_continuation]=10u;return rc_scene_world_orders(scene,bridge);
}
// Returns 1 when a single numerical program is ready, 0 at completion/error.
fn rc_scene_world_gather(scene:u32,canonical:u32,bridge:u32,scratch:u32)->u32{
 if(rc_state[bridge+SW_status]!=1u||!rc_scene_ok(scene)){return 0u;}if(rc_state[bridge+SW_continuation]==10u){return 0u;}
 loop {let phase=rc_state[bridge+SW_continuation];let row=rc_state[bridge+SW_row];let count=rc_state[scene+SH_activeCount];
  if(phase==1u){if(row<count){let member=rc_state[scene+SL_activeOffset+row];if(!rc_sw_force_input(scene,bridge,canonical,member,scratch)){return 0u;}rc_state[bridge+SW_pendingProgram]=0u;rc_state[bridge+SW_numericStatus]=0u;rc_state[bridge+SW_continuation]=2u;return 1u;}if(!rc_scene_before_energy_updates(scene)){rc_state[bridge+SW_status]=4u;return 0u;}rc_state[bridge+SW_continuation]=3u;rc_state[bridge+SW_row]=0u;continue;}
  if(phase==3u){if(row<count){let member=rc_state[scene+SL_activeOffset+row];if((rc_state[scene+SH_resetMask]&(1u<<member))==0u){rc_state[bridge+SW_row]=row+1u;continue;}if(!rc_sw_energy_input(scene,bridge,canonical,member,scratch,0x40400000u)){return 0u;}rc_state[bridge+SW_pendingProgram]=1u;rc_state[bridge+SW_numericStatus]=0u;rc_state[bridge+SW_continuation]=4u;return 1u;}rc_state[bridge+SW_continuation]=5u;rc_state[bridge+SW_row]=0u;continue;}
  if(phase==5u){if(row<count){let member=rc_state[scene+SL_activeOffset+row];if(!rc_sw_energy_input(scene,bridge,canonical,member,scratch,0u)){return 0u;}rc_state[bridge+SW_pendingProgram]=1u;rc_state[bridge+SW_numericStatus]=0u;rc_state[bridge+SW_continuation]=6u;return 1u;}if(!rc_scene_select_sleep(scene)){rc_state[bridge+SW_status]=4u;return 0u;}rc_state[bridge+SW_sleepGroup]=0u;rc_state[bridge+SW_sleepMember]=0u;rc_state[bridge+SW_continuation]=7u;continue;}
  if(phase==7u){let topology=scene+SL_scratchOffset;let group=rc_state[bridge+SW_sleepGroup];if(group>=rc_state[topology+214u]){if(!rc_sw_finish_continuation(scene,bridge)){return 0u;}return 0u;}let p=rc_scene_pp(scene,rc_state[topology+215u+group]);let at=rc_state[bridge+SW_sleepMember];if(at>=rc_state[p+SP_count]){rc_state[bridge+SW_sleepGroup]=group+1u;rc_state[bridge+SW_sleepMember]=0u;continue;}let member=rc_state[p+SP_members+at];if(!rc_sw_energy_input(scene,bridge,canonical,member,scratch,0x3f800000u)){return 0u;}rc_state[bridge+SW_pendingProgram]=1u;rc_state[bridge+SW_numericStatus]=0u;rc_state[bridge+SW_continuation]=8u;return 1u;}
  rc_sw_fail(scene,bridge,6u);return 0u;
 }
}
fn rc_scene_world_evaluate(scene:u32,bridge:u32,bundle:u32,scratch:u32)->u32{
 if(rc_state[bridge+SW_status]!=1u||rc_state[bridge+SW_continuation]==10u){return 0u;}let phase=rc_state[bridge+SW_continuation];if((phase!=2u&&phase!=4u&&phase!=6u&&phase!=8u)||rc_state[bridge+SW_numericStatus]!=0u){rc_sw_fail(scene,bridge,6u);return 0u;}
 let status=rc_sw_eval(bundle,rc_state[bridge+SW_pendingProgram],scratch);rc_state[bridge+SW_numericStatus]=status;rc_state[bridge+SW_evaluations]=rc_state[bridge+SW_evaluations]+1u;if(status!=1u){rc_sw_fail(scene,bridge,5u);}return status;
}
fn rc_scene_world_scatter(scene:u32,canonical:u32,bridge:u32,bundle:u32,scratch:u32)->bool{
 if(rc_state[bridge+SW_status]!=1u){return false;}if(rc_state[bridge+SW_continuation]==10u){return true;}if(rc_state[bridge+SW_numericStatus]!=1u){return rc_sw_fail(scene,bridge,6u);}let phase=rc_state[bridge+SW_continuation];let row=rc_state[bridge+SW_row];
 if(phase==2u){let member=rc_state[scene+SL_activeOffset+row];let body=rc_sw_body(scene,bridge,canonical,member);if(body==0xffffffffu){return false;}for(var j=0u;j<6u;j++){let value=rc_sw_output(bundle,0u,scratch,j);rc_state[bridge+SWL_forceOffset+row*6u+j]=value;if(j<3u){rc_state[body+SWB_force+j]=value;}}let hot=rc_sw_output(bundle,0u,scratch,6u);if(hot!=0u&&hot!=0x3f800000u){return rc_sw_fail(scene,bridge,5u);}if(!rc_scene_force_fact(scene,member,hot!=0u)){rc_state[bridge+SW_status]=4u;return false;}rc_state[bridge+SW_row]=row+1u;rc_state[bridge+SW_continuation]=1u;}
 else if(phase==4u){let member=rc_state[scene+SL_activeOffset+row];rc_sw_adopt_reset(scene,member,rc_sw_gather_activation(bridge,bundle,scratch));rc_state[bridge+SW_row]=row+1u;rc_state[bridge+SW_continuation]=3u;}
 else if(phase==6u){let member=rc_state[scene+SL_activeOffset+row];let eligible=rc_sw_output(bundle,1u,scratch,29u);if(eligible!=0u&&eligible!=0x3f800000u){return rc_sw_fail(scene,bridge,5u);}if(!rc_scene_adopt_energy(scene,member,rc_sw_gather_activation(bridge,bundle,scratch),eligible!=0u)){rc_state[bridge+SW_status]=4u;return false;}rc_state[bridge+SW_row]=row+1u;rc_state[bridge+SW_continuation]=5u;}
 else if(phase==8u){let topology=scene+SL_scratchOffset;let p=rc_scene_pp(scene,rc_state[topology+215u+rc_state[bridge+SW_sleepGroup]]);let member=rc_state[p+SP_members+rc_state[bridge+SW_sleepMember]];let body=rc_sw_body(scene,bridge,canonical,member);if(body==0xffffffffu){return false;}for(var j=0u;j<3u;j++){rc_state[body+SWB_linear+j]=rc_sw_output(bundle,1u,scratch,19u+j);rc_state[body+SWB_angular+j]=rc_sw_output(bundle,1u,scratch,22u+j);}if(!rc_scene_adopt_sleep(scene,member,rc_sw_gather_activation(bridge,bundle,scratch))){rc_state[bridge+SW_status]=4u;return false;}rc_state[bridge+SW_sleepMember]=rc_state[bridge+SW_sleepMember]+1u;rc_state[bridge+SW_continuation]=7u;}
 else{return rc_sw_fail(scene,bridge,6u);}rc_state[bridge+SW_numericStatus]=0u;return true;
}
`;
// Standalone evaluate source intentionally has no Scene library dependency and
// one VM call; gather/scatter shaders do not include or inline the evaluator.
const EVALUATE_ONLY=String.raw`
fn rc_scene_world_evaluate(scene:u32,bridge:u32,bundle:u32,scratch:u32)->u32{
 if(rc_state[bridge+SW_status]!=1u||rc_state[bridge+SW_continuation]==10u){return 0u;}let phase=rc_state[bridge+SW_continuation];if((phase!=2u&&phase!=4u&&phase!=6u&&phase!=8u)||rc_state[bridge+SW_numericStatus]!=0u){rc_state[bridge+SW_status]=4u;rc_state[scene+1u]=4u;rc_state[scene+2u]=6u;return 0u;}
 let status=rc_sw_eval(bundle,rc_state[bridge+SW_pendingProgram],scratch);rc_state[bridge+SW_numericStatus]=status;rc_state[bridge+SW_evaluations]=rc_state[bridge+SW_evaluations]+1u;if(status!=1u){rc_state[bridge+SW_status]=4u;rc_state[scene+1u]=4u;rc_state[scene+2u]=5u;}return status;
}
`;
