// SPDX-License-Identifier: Apache-2.0
// Explicit resident first/recurrent collision-pass adapter. Numerical source
// programs stay in separate gather/evaluate/scatter dispatches; no host facts,
// solver integration, outer clock, or terminal-success authority lives here.
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {SCENE_INITIALIZATION_LAYOUT as I} from './scene-initialization.mjs';
import {SCENE_WORLD_LAYOUT as W} from './scene-world.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {CONTACT_ROSTER_LAYOUT as R} from './contact-roster.mjs';
import {CUE_LAYOUT as Q} from './cue.mjs';
export const SCENE_INTEGRATION_LAYOUT=Object.freeze({header:Object.freeze({phase:12,cueFrame:13,cueSeen:14,entryAwake:15,entryDynamicAwake:16,entryChanged:17,priorCount:18,internalPass:19,entrySequence:20,rosterReady:21,entryValid:22,reserved:23}),priorWords:1024,priorStride:8,maxEdges:128,
 phases:Object.freeze({idle:0,preCollision:1,narrowPending:2,energy:3,solver:4,solved:5,application:6,collisionPrepared:7}),completeH:false});
const H=SCENE_INTEGRATION_LAYOUT.header;
function constants(template){const names=['header','bodies','cue','scene','initialization','journal','roster','sceneWorld','sceneAdapter','geometryFacts','manifoldViews','geometryRefreshed','broad','application'];for(const name of names)if(!Number.isInteger(template?.segments?.[name]?.offset))throw new RangeError('Scene integration requires common '+name+' segment');if(template.segments.sceneAdapter.words<1024)throw new RangeError('Scene prior metadata capacity');
 const groups={SI:H,SIS:S,SIH:S.header,SIB:S.body,SII:I,SIIH:I.header,SIW:W,SIWH:W.header,SIJ:J,SIJH:J.header,SIR:R,SIRH:R.header,SIRE:R.edge,SIQ:Q,SIQH:Q.header};return names.map(n=>`const SIO_${n}:u32=${template.segments[n].offset}u;`).concat(Object.entries(groups).flatMap(([prefix,g])=>Object.entries(g).filter(([,v])=>Number.isInteger(v)).map(([k,v])=>`const ${prefix}_${k}:u32=${v}u;`))).join('\n');}
export function generateSceneIntegrationWGSL(template){return constants(template)+'\n'+HINT+'\n'+ADAPTER;}
// Additive access to the exact existing integer hint equations. No admission
// or generated world shader changes: distinct rosters own their own bindings.
export function generateContactHintWGSL(){return HINT;}
/** Separate numeric pipeline: only one evaluator call, no integer scene loops. */
export function generateSceneIntegrationEvaluateWGSL(template){return constants(template)+`\nfn rc_world_scene_energy_evaluate(bank:u32,scratch:u32)->u32{if(rc_state[bank+2u]!=1u||rc_state[bank+SI_phase]!=3u){return 0u;}return rc_scene_world_evaluate(bank+SIO_scene,bank+SIO_sceneWorld,${template.programOffsets.scene}u,scratch);}`;}
export function generateSceneIntegrationEnergyWGSL(template,{includeConstants=false}={}){return(includeConstants?constants(template):'')+`\nfn rc_world_scene_energy_gather(bank:u32,scratch:u32)->u32{if(rc_state[bank+2u]!=1u||rc_state[bank+SI_phase]!=3u){return 0u;}let value=rc_scene_world_gather(bank+SIO_scene,bank+SIO_bodies,bank+SIO_sceneWorld,scratch);if(rc_state[bank+SIO_sceneWorld+SIWH_status]!=1u){rc_world_scene_fail(bank,rc_state[bank+SIO_scene+SIH_reason]);return 0u;}if(rc_state[bank+SIO_sceneWorld+SIWH_continuation]==10u){rc_state[bank+SI_phase]=4u;}return value;}
fn rc_world_scene_energy_scatter(bank:u32,scratch:u32)->bool{if(rc_state[bank+2u]!=1u||rc_state[bank+SI_phase]!=3u){return false;}if(!rc_scene_world_scatter(bank+SIO_scene,bank+SIO_bodies,bank+SIO_sceneWorld,${template.programOffsets.scene}u,scratch)){return rc_world_scene_fail(bank,rc_state[bank+SIO_scene+SIH_reason]);}return true;}`;}
// Source experimental-coupled-contact-hints.updateHint, integer equations only.
// prior points to [lifeLo,lifeHi,hint,color,count,flags,contacts,graphPos].
// entry bits: awake1/2, dynamicAwake4/8, modified16. out seven words.
const HINT=String.raw`
fn rc_world_scene_hint(prior:u32,hasPrevious:bool,entry:u32,visited:bool,refreshed:bool,manifolds:u32,flags:u32,contacts:u32,out:u32)->bool{
 var oldHint=0u;var color=255u;var oldCount=0u;var oldFlags=0u;var oldContacts=0u;var pos=0xffffffffu;
 if(hasPrevious){oldHint=rc_state[prior+2u];color=rc_state[prior+3u];oldCount=rc_state[prior+4u];oldFlags=rc_state[prior+5u];oldContacts=rc_state[prior+6u];pos=rc_state[prior+7u];}
 if(oldHint>65535u||(color>128u&&color!=255u)||oldCount>1u||oldContacts>1u||manifolds>1u||contacts>1u||(pos!=0xffffffffu&&pos/4194304u>129u)){return false;}
 let eligible=(entry&19u)!=0u;let dynamicAwake=(entry&12u)!=0u;if((refreshed&&(!visited||!eligible))||(eligible&&!visited)){return false;}
 if(!refreshed&&(manifolds!=oldCount||(manifolds!=0u&&(flags!=oldFlags||contacts!=oldContacts)))){return false;}
 var hint=oldHint;var updated=false;var dirty=false;var outcome=0u;var count=0u;if(manifolds!=0u&&(flags&1u)!=0u&&contacts!=0u){count=1u;}
 if(eligible){if(!refreshed){if(!hasPrevious){return false;}outcome=1u;if((hint&32767u)==0u){hint=count;if(dynamicAwake){hint=hint|32768u;}updated=hint!=oldHint;if((hint&32768u)!=0u&&(hint&32767u)!=0u){outcome=3u;dirty=true;updated=true;}}}else{
  hint=count;if(dynamicAwake){hint=hint|32768u;}updated=true;var drift=false;
  if(manifolds!=0u){let qualifies=(hint&32768u)!=0u&&(hint&32767u)!=0u&&(flags&1u)!=0u&&contacts!=0u;if(!qualifies){drift=pos!=0xffffffffu;}else if(pos==0xffffffffu){drift=true;}else{let bucket=pos/4194304u;if(bucket!=129u){var expected=color;if(color==255u){expected=128u;}drift=bucket!=expected;}}}
  dirty=hint!=oldHint||drift;outcome=4u;if(dirty){outcome=2u;}
 }}rc_state[out]=hint;rc_state[out+1u]=select(0u,1u,updated);rc_state[out+2u]=select(0u,1u,dirty);rc_state[out+3u]=outcome;rc_state[out+4u]=manifolds;rc_state[out+5u]=flags;rc_state[out+6u]=contacts;return true;
}
`;
const ADAPTER=String.raw`
fn rc_world_scene_fail(bank:u32,reason:u32)->bool{if(rc_state[bank+2u]==1u){rc_state[bank+2u]=4u;rc_state[bank+3u]=reason;if(reason==0u){rc_state[bank+3u]=6u;}}return false;}
fn rc_world_scene_live(bank:u32,phase:u32)->bool{if(rc_state[bank+2u]!=1u){return false;}if(rc_state[bank]!=0x52435753u||rc_state[bank+1u]!=1u||rc_state[bank+SI_phase]!=phase){return rc_world_scene_fail(bank,6u);}return true;}
fn rc_world_scene_capture_entry(bank:u32)->bool{
 let scene=bank+SIO_scene;let init=bank+SIO_initialization;let journal=bank+SIO_journal;let roster=bank+SIO_roster;
 if(!rc_scene_ok(scene)||rc_state[init+SIIH_status]!=1u||rc_state[journal]!=0u||rc_state[roster]!=0u||rc_state[roster+SIRH_phase]!=0u||rc_state[roster+SIRH_edgeCount]!=rc_state[journal+SIJH_edges]||rc_state[roster+SIRH_sequence]!=rc_state[journal+SIJH_sequence]){return rc_world_scene_fail(bank,6u);}
 rc_state[bank+SI_entryAwake]=0u;rc_state[bank+SI_entryDynamicAwake]=0u;rc_state[bank+SI_entryChanged]=0u;
 let count=rc_state[journal+SIJH_colliders];if(count>27u||count!=rc_state[init+SIIH_colliderCount]){return rc_world_scene_fail(bank,4u);}let awake=rc_state[scene+SIH_awake];
 for(var i=0u;i<count;i++){let c=journal+SIJ_colliderOffset+i*SIJ_colliderStride;if(rc_state[c+6u]==0u){continue;}var member=0xffffffffu;for(var j=0u;j<rc_state[scene+SIH_bodySlots];j++){let q=rc_scene_bp(scene,j);if(rc_state[q+SIB_index]==rc_state[c+2u]&&rc_state[q+SIB_generation]==rc_state[c+3u]){member=j;}}if(member==0xffffffffu){return rc_world_scene_fail(bank,6u);}let body=rc_scene_bp(scene,member);let bit=1u<<i;if(rc_state[body+SIB_present]==0u){if(rc_state[c+7u]==0u||rc_state[bank+SIO_cue+SIQH_present]!=0u){return rc_world_scene_fail(bank,6u);}continue;}
  if(awake!=0xffffffffu&&rc_state[body+SIB_activeIsland]==awake){rc_state[bank+SI_entryAwake]=rc_state[bank+SI_entryAwake]|bit;}if(rc_state[body+SIB_dynamic]!=0u&&rc_state[body+SIB_activation+4u]==0u){rc_state[bank+SI_entryDynamicAwake]=rc_state[bank+SI_entryDynamicAwake]|bit;}
  var found=false;for(var j=0u;j<count;j++){let q=init+SII_colliderOffset+j*4u;if(rc_state[q]==rc_state[c]&&rc_state[q+1u]==rc_state[c+1u]){if(found){return rc_world_scene_fail(bank,6u);}found=true;if(rc_state[q+3u]>2u){rc_state[bank+SI_entryChanged]=rc_state[bank+SI_entryChanged]|bit;}}}if(!found){return rc_world_scene_fail(bank,6u);}
 }
 let edges=rc_state[roster+SIRH_edgeCount];if(edges>128u){return rc_world_scene_fail(bank,4u);}rc_state[bank+SI_priorCount]=edges;
 for(var i=0u;i<edges;i++){let old=roster+SIR_edgeOffset+i*SIR_edgeStride;let e=journal+SIJ_edgeOffset+i*SIJ_edgeStride;let c1=journal+SIJ_colliderOffset+rc_state[e]*SIJ_colliderStride;let c2=journal+SIJ_colliderOffset+rc_state[e+1u]*SIJ_colliderStride;
  if(rc_state[old]!=rc_state[c1]||rc_state[old+1u]!=rc_state[c1+1u]||rc_state[old+2u]!=rc_state[c2]||rc_state[old+3u]!=rc_state[c2+1u]||rc_state[old+9u]!=rc_state[e+3u]||rc_state[old+10u]!=rc_state[e+4u]){return rc_world_scene_fail(bank,6u);}let p=bank+SIO_sceneAdapter+i*8u;rc_state[p]=rc_state[old+9u];rc_state[p+1u]=rc_state[old+10u];rc_state[p+2u]=rc_state[old+11u];rc_state[p+3u]=rc_state[old+12u];rc_state[p+4u]=rc_state[old+15u];rc_state[p+5u]=rc_state[old+16u];rc_state[p+6u]=rc_state[old+17u];rc_state[p+7u]=rc_state[old+21u];
 }rc_state[bank+SI_entrySequence]=rc_state[journal+SIJH_sequence];rc_state[bank+SI_entryValid]=1u;rc_state[bank+SI_rosterReady]=0u;return true;
}
// This predicate is frozen before any deferred broad/narrow wake propagation.
fn rc_world_scene_geometry_visited(bank:u32,c1:u32,c2:u32)->bool{
 if(rc_state[bank+SI_entryValid]!=1u||c1>=27u||c2>=27u){rc_world_scene_fail(bank,6u);return false;}let mask=(1u<<c1)|(1u<<c2);return ((rc_state[bank+SI_entryAwake]|rc_state[bank+SI_entryChanged])&mask)!=0u;
}
fn rc_world_scene_geometry_dynamic_awake(bank:u32,collider:u32)->bool{
 if(rc_state[bank+SI_entryValid]!=1u||collider>=27u){rc_world_scene_fail(bank,6u);return false;}return (rc_state[bank+SI_entryDynamicAwake]&(1u<<collider))!=0u;
}
fn rc_world_scene_after_cue_pre(bank:u32)->bool{
 if(!rc_world_scene_live(bank,0u)){return false;}let scene=bank+SIO_scene;let cue=bank+SIO_cue;let bridge=bank+SIO_sceneWorld;let init=bank+SIO_initialization;
 if(rc_state[cue+SIQH_status]!=1u){return rc_world_scene_fail(bank,6u);}let frame=rc_state[cue+SIQH_frame];let first=rc_state[bank+7u]!=0u;
 if(first){if(rc_state[bank+SI_cueSeen]!=0u||frame!=1u||rc_state[cue+SIQH_present]!=1u||rc_state[cue+SIQH_initialized]!=1u||rc_state[cue+SIQH_initialNumericMask]!=7u||rc_state[cue+SIQH_removedCount]!=0u){return rc_world_scene_fail(bank,6u);}if(!rc_scene_created_initialize(scene,init,cue+SIQ_initialOutputs,7u)){return rc_world_scene_fail(bank,rc_state[scene+SIH_reason]);}}
 else{if(rc_state[bank+SI_cueSeen]!=1u||!rc_scene_begin(scene)){return rc_world_scene_fail(bank,6u);}let fresh=frame!=rc_state[bank+SI_cueFrame];if(fresh){if(frame!=rc_state[bank+SI_cueFrame]+1u){return rc_world_scene_fail(bank,6u);}let count=rc_state[cue+SIQH_mutableCount];if(count!=2u&&count!=4u){return rc_world_scene_fail(bank,6u);}for(var i=0u;i<count;i++){let row=cue+SIQ_mutableCalls+i*3u;var role=0u;if(i==1u){role=1u;}else if(i==2u){role=3u;}let member=rc_state[row+2u];if(rc_state[row]!=role||rc_state[row+1u]>1u||member!=rc_state[cue+SIQH_headSlot+role]){return rc_world_scene_fail(bank,6u);}if(!rc_scene_api_call(scene,member,rc_state[row+1u]!=0u)){return rc_world_scene_fail(bank,rc_state[scene+SIH_reason]);}}
   let removed=rc_state[cue+SIQH_removedCount];if(removed!=0u){if(removed!=3u||rc_state[cue+SIQH_present]!=0u){return rc_world_scene_fail(bank,6u);}for(var i=0u;i<3u;i++){if(rc_state[cue+SIQ_removedRoles+i]!=i){return rc_world_scene_fail(bank,6u);}}if(!rc_scene_withdraw_cue(scene)){return rc_world_scene_fail(bank,rc_state[scene+SIH_reason]);}}
  }else if(rc_state[cue+SIQH_present]!=0u){return rc_world_scene_fail(bank,6u);}if(!rc_scene_drain_modified(scene)||!rc_scene_world_begin_pass(scene,bridge)){return rc_world_scene_fail(bank,rc_state[scene+SIH_reason]);}
 }
 if(rc_cue_to_canonical(cue,bank+SIO_bodies)!=1u){return rc_world_scene_fail(bank,6u);}rc_state[bank+SI_cueFrame]=frame;rc_state[bank+SI_cueSeen]=1u;rc_state[bank+SI_internalPass]=0u;if(!rc_world_scene_capture_entry(bank)){return false;}rc_state[bank+SI_phase]=1u;return true;
}
fn rc_world_scene_after_broad(bank:u32)->bool{
 if(!rc_world_scene_live(bank,1u)){return false;}let journal=bank+SIO_journal;if(rc_state[journal]!=0u||rc_state[journal+SIJH_phase]!=2u){return rc_world_scene_fail(bank,6u);}if(rc_state[bank+7u]==0u&&!rc_scene_world_apply_operations(bank+SIO_scene,journal,bank+SIO_sceneWorld,rc_state[journal+SIJH_operations])){return rc_world_scene_fail(bank,6u);}rc_state[bank+SI_phase]=2u;return true;
}
fn rc_world_scene_after_narrow(bank:u32)->bool{
 if(!rc_world_scene_live(bank,2u)){return false;}if(!rc_scene_world_prepare(bank+SIO_scene,bank+SIO_initialization,bank+SIO_journal,bank+SIO_sceneWorld)){return rc_world_scene_fail(bank,rc_state[bank+SIO_scene+SIH_reason]);}rc_state[bank+SI_phase]=7u;return true;
}
// CCD source selects the solve dt AFTER deferred collisions and BEFORE energy.
fn rc_world_scene_begin_energy(bank:u32)->bool{
 if(!rc_world_scene_live(bank,7u)){return false;}if(!rc_scene_world_begin_observe(bank+SIO_scene,bank+SIO_sceneWorld,rc_state[bank+10u])){return rc_world_scene_fail(bank,rc_state[bank+SIO_scene+SIH_reason]);}rc_state[bank+SI_phase]=3u;return true;
}
// Original hints see the ENTRY masks and pre-transition pair metadata. Geometry
// refresh and active-point count come from completed device cache owners.
fn rc_world_scene_prepare_roster(bank:u32)->bool{
 if(!rc_world_scene_live(bank,4u)||rc_state[bank+SI_rosterReady]!=0u){return rc_world_scene_fail(bank,6u);}let journal=bank+SIO_journal;let roster=bank+SIO_roster;let scene=bank+SIO_scene;
 rc_journal_apply_roster(journal,roster);if(rc_state[journal]!=0u||rc_state[roster]!=0u){return rc_world_scene_fail(bank,6u);}if(rc_state[scene+SIH_invalidatesSolver]!=0u){rc_state[roster+SIRH_valid]=0u;}
 // The scene scratch area is no longer used by numeric energy here. Its last
 // seven words are temporary hint result; component sleep/order rows preserved.
 let out=scene+SIS_scratchOffset+505u;
 for(var i=0u;i<rc_state[journal+SIJH_edges];i++){let edge=journal+SIJ_edgeOffset+i*SIJ_edgeStride;let c1=rc_state[edge];let c2=rc_state[edge+1u];var prior=0u;var found=false;for(var j=0u;j<rc_state[bank+SI_priorCount];j++){let p=bank+SIO_sceneAdapter+j*8u;if(rc_state[p]==rc_state[edge+3u]&&rc_state[p+1u]==rc_state[edge+4u]){if(found){return rc_world_scene_fail(bank,6u);}found=true;prior=p;}}
  let mask1=1u<<c1;let mask2=1u<<c2;var entry=0u;if((rc_state[bank+SI_entryAwake]&mask1)!=0u){entry=entry|1u;}if((rc_state[bank+SI_entryAwake]&mask2)!=0u){entry=entry|2u;}if((rc_state[bank+SI_entryDynamicAwake]&mask1)!=0u){entry=entry|4u;}if((rc_state[bank+SI_entryDynamicAwake]&mask2)!=0u){entry=entry|8u;}if((rc_state[bank+SI_entryChanged]&(mask1|mask2))!=0u){entry=entry|16u;}
  let refreshed=rc_state[bank+SIO_geometryRefreshed+i];if(refreshed>1u){return rc_world_scene_fail(bank,6u);}var manifolds=0u;var flags=0u;var contacts=0u;
  if(refreshed!=0u){let facts=bank+SIO_geometryFacts+i*6u;let view=bank+SIO_manifoldViews+i*8u;if(rc_state[facts]!=i||rc_state[facts+1u]!=rc_state[edge+3u]||rc_state[facts+2u]!=rc_state[edge+4u]||rc_state[facts+4u]!=1u||rc_state[view]!=rc_state[edge+3u]||rc_state[view+1u]!=rc_state[edge+4u]||rc_state[view+7u]!=0u){return rc_world_scene_fail(bank,6u);}manifolds=rc_state[view+2u];if(manifolds!=0u){flags=1u;}contacts=rc_state[facts+3u];if(manifolds==0u&&contacts!=0u){return rc_world_scene_fail(bank,6u);}}else if(found){manifolds=rc_state[prior+4u];flags=rc_state[prior+5u];contacts=rc_state[prior+6u];}
  if(!rc_world_scene_hint(prior,found,entry,rc_world_scene_geometry_visited(bank,c1,c2),refreshed!=0u,manifolds,flags,contacts,out)){return rc_world_scene_fail(bank,6u);}rc_roster_metadata(roster,i,rc_state[out+1u]!=0u,rc_state[out+2u]!=0u,rc_state[out],rc_state[out+4u],rc_state[out+5u],rc_state[out+6u]);if(rc_state[roster]!=0u){return rc_world_scene_fail(bank,6u);}
 }
 if(!rc_scene_world_roster(scene,bank+SIO_sceneWorld,roster,rc_state[roster+SIRH_multibodyEpoch])){return rc_world_scene_fail(bank,6u);}rc_state[bank+SI_rosterReady]=1u;return true;
}
fn rc_world_scene_after_solve(bank:u32)->bool{
 if(!rc_world_scene_live(bank,4u)||rc_state[bank+SI_rosterReady]!=1u||rc_state[bank+SIO_scene+SIH_phase]!=6u){return rc_world_scene_fail(bank,6u);}let cue=bank+SIO_cue;if(rc_state[cue+SIQH_status]!=1u||rc_state[cue+SIQH_needsSolve]!=0u||rc_cue_to_canonical(cue,bank+SIO_bodies)!=1u){return rc_world_scene_fail(bank,6u);}rc_state[bank+SI_phase]=5u;return true;
}
fn rc_world_scene_after_application(bank:u32)->bool{
 if(!rc_world_scene_live(bank,5u)||rc_state[bank+SIO_scene+SIH_phase]!=3u||rc_state[bank+SIO_application]!=0u){return rc_world_scene_fail(bank,6u);}rc_state[bank+SI_phase]=6u;return true;
}
fn rc_world_scene_finish(bank:u32)->bool{
 if(!rc_world_scene_live(bank,6u)||rc_state[bank+SIO_journal]!=0u||rc_state[bank+SIO_journal+SIJH_phase]!=0u||rc_state[bank+SIO_roster]!=0u||rc_state[bank+SIO_roster+SIRH_phase]!=0u||rc_state[bank+SIO_broad]!=0u||rc_state[bank+SIO_broad+1u]!=0u||rc_state[bank+SIO_scene+SIH_phase]!=3u){return rc_world_scene_fail(bank,6u);}rc_state[bank+7u]=0u;rc_state[bank+SI_phase]=0u;rc_state[bank+SI_entryValid]=0u;return true;
}
// A post-cue CCD internal pass has NO new application prefix. The CCD owner
// alone decides to call this after its preceding pass/graph/BVH are complete.
fn rc_world_scene_next_internal(bank:u32)->bool{
 if(!rc_world_scene_live(bank,5u)||rc_state[bank+7u]!=0u||rc_state[bank+SIO_cue+SIQH_present]!=0u||rc_state[bank+SI_internalPass]==0xffffffffu){return rc_world_scene_fail(bank,6u);}if(!rc_scene_next_internal_pass(bank+SIO_scene)||!rc_scene_world_begin_pass(bank+SIO_scene,bank+SIO_sceneWorld)){return rc_world_scene_fail(bank,6u);}if(!rc_world_scene_capture_entry(bank)){return false;}rc_state[bank+SI_internalPass]++;rc_state[bank+SI_phase]=1u;return true;
}
`;
/** TEST ONLY integer dialect execution. Dependencies are actual resident
 * kernels; absent dependency calls throw, never stand in for source physics. */
export function sceneIntegrationTestKernels(words,template,dependencies){let code=generateSceneIntegrationWGSL(template)+'\n'+generateSceneIntegrationEnergyWGSL(template);const names=[...code.matchAll(/fn (rc_\w+)\(/g)].map(m=>m[1]);code=code.replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?\s*\{/g,(_,n,args)=>`function ${n}(${args.replace(/:(?:u32|bool)/g,'')}){`).replace(/:(?:u32|bool)(?=\s*=)/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/(\b\w+)\/4194304\b/g,'Math.floor($1/4194304)');return new Function('rc_state','select',...Object.keys(dependencies),code+'\nreturn {'+names.join(',')+'};')(words,(a,b,p)=>p?b:a,...Object.values(dependencies));}
export function contactHintTestKernel(words){let code=HINT.replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?\s*\{/g,(_,n,args)=>`function ${n}(${args.replace(/:(?:u32|bool)/g,'')}){`).replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/(\b\w+)\/4194304\b/g,'Math.floor($1/4194304)');return new Function('rc_state','select',code+'\nreturn rc_world_scene_hint;')(words,(a,b,p)=>p?b:a);}
