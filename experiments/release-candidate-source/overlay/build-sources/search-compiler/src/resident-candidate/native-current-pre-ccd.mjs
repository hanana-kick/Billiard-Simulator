// SPDX-License-Identifier: Apache-2.0
// Source-only helper for native post-collision/pre-energy CCD admission.
// It supplies no template/shape admission and no CCD result. A branded caller
// must bind the exact actual dynamic roster, immutable shape metadata and
// current phase, then evaluate the original CCD graph and own its publication.
// Five-body genuine-three is qualified by its caller; six-body/four-ball use is
// NOT qualified merely by selecting another size. No old default imports this.
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {SCENE_WORLD_LAYOUT as W} from './scene-world.mjs';
export function generateNativeCurrentPreCcdHelpers({state,scene,bodies,bridge,registration,scratch,sphereCount,bodyCount,params,input,order}){
 for(const x of[state,scene,bodies,bridge,registration,scratch,params,input,order])if(!Number.isSafeInteger(x)||x<0||x>=0x10000000)throw new RangeError('Native current pre CCD bounded source-owned bases required');
 if(![3,4].includes(sphereCount)||bodyCount!==sphereCount+2)throw new RangeError('Actual sphere roster plus shaft/head required');
 if(params<32||input<params+bodyCount*16)throw new RangeError('Native current pre CCD metadata/input overlap');
 if(order<17||order+bodyCount>params||(order<=22&&order+bodyCount>22)||(order<=23&&order+bodyCount>23))throw new RangeError('Native current pre CCD order table overlaps header or metadata');
 const L={params,input};return `
// Source IslandManager.active_bodies: exact awake chunk order, no sorted IDs.
fn rc_native_current_pre_capture()->bool{
 let awake=rc_state[${scene+S.header.awake}u];var count=0u;var mask=0u;if(awake!=0xffffffffu){let chunk=rc_scene_cp(${scene}u,awake);count=rc_state[chunk+1u];if(count>${bodyCount}u){return rc_native_current_pre_fail(${state}u,2u,0xffffffffu);}for(var n=0u;n<count;n++){let member=rc_state[chunk+2u+n];let bp=rc_scene_bp(${scene}u,member);var role=0xffffffffu;for(var k=0u;k<${bodyCount}u;k++){if(rc_state[${state+L.params}u+k*16u]==member){if(role!=0xffffffffu){return rc_native_current_pre_fail(${state}u,2u,k);}role=k;}}
 if(role==0xffffffffu||!rc_native_current_pre_identity(${state}u,role)||!rc_scene_valid_body(${scene}u,member)||rc_state[bp+${S.body.dynamic}u]!=1u||rc_state[bp+${S.body.activation+4}u]!=0u||rc_state[bp+${S.body.activeIsland}u]!=awake||rc_state[bp+${S.body.activeIndex}u]!=n||(mask&(1u<<role))!=0u){return rc_native_current_pre_fail(${state}u,2u,role);}rc_state[${state+order}u+n]=role;mask=mask|(1u<<role);}}
 for(var role=0u;role<${bodyCount}u;role++){let param=${state+L.params}u+role*16u;let member=rc_state[param];let bp=rc_scene_bp(${scene}u,member);if(!rc_native_current_pre_identity(${state}u,role)||!rc_scene_valid_body(${scene}u,member)||rc_state[bp+${S.body.index}u]!=rc_state[param+1u]||rc_state[bp+${S.body.generation}u]!=rc_state[param+2u]||(((mask&(1u<<role))==0u)!=(rc_state[bp+${S.body.activation+4}u]!=0u))){return rc_native_current_pre_fail(${state}u,2u,role);}}
 rc_state[${state+6}u]=mask;rc_state[${state+8}u]=${(1<<bodyCount)-1}u^mask;rc_state[${state+9}u]=rc_state[${scene+S.header.epoch}u];rc_state[${state+22}u]=count;rc_state[${state+3}u]=1u;return true;
}
fn rc_native_current_pre_gather_body(){if(rc_state[${state+2}u]!=1u||rc_state[${state+3}u]!=1u||rc_state[${state+4}u]>=rc_state[${state+22}u]){return;}let role=rc_state[${state+order}u+rc_state[${state+4}u]];if(rc_state[${state+11}u]!=0u||rc_state[${scene+S.header.phase}u]!=5u||rc_state[${state+9}u]!=rc_state[${scene+S.header.epoch}u]){rc_native_current_pre_fail(${state}u,3u,role);return;}let param=${state+L.params}u+role*16u;let member=rc_state[param];let bp=rc_scene_bp(${scene}u,member);let src=${bodies}u+role*64u;let dst=${state+L.input}u+role*64u;for(var n=0u;n<64u;n++){rc_state[dst+n]=0u;}
 // The preceding h's retained force/torque is still authoritative before the
 // new force stage. Original sleepers have never replaced that t0 torque.
 var priorFound=false;for(var row=0u;row<rc_state[${scene+S.header.activeCount}u];row++){if(rc_state[${scene+S.activeOffset}u+row]==member){if(priorFound){rc_native_current_pre_fail(${state}u,3u,role);return;}priorFound=true;for(var n=0u;n<3u;n++){if(rc_state[${bridge+W.forceOffset}u+row*6u+n]!=rc_state[src+47u+n]||rc_state[${bridge+W.forceOffset+3}u+row*6u+n]!=rc_state[param+9u+n]){rc_native_current_pre_fail(${state}u,3u,role);return;}}}}if(!priorFound){if(rc_state[param+15u]!=1u){rc_native_current_pre_fail(${state}u,3u,role);return;}for(var n=0u;n<3u;n++){if(rc_state[src+47u+n]!=rc_state[param+6u+n]||rc_state[src+38u+n]!=rc_state[param+9u+n]){rc_native_current_pre_fail(${state}u,3u,role);return;}}}
 for(var n=0u;n<13u;n++){rc_state[dst+n]=rc_state[src+n];}for(var n=0u;n<3u;n++){rc_state[dst+13u+n]=rc_state[src+47u+n];rc_state[dst+16u+n]=rc_state[param+9u+n];rc_state[dst+19u+n]=rc_state[src+13u+n];rc_state[dst+31u+n]=rc_state[src+56u+n];if(rc_state[src+56u+n]!=rc_state[param+12u+n]){rc_native_current_pre_fail(${state}u,3u,role);return;}}for(var n=0u;n<9u;n++){rc_state[dst+22u+n]=rc_state[src+16u+n];}rc_state[dst+34u]=rc_state[bp+${S.body.maxExtent}u];rc_state[dst+35u]=rc_state[param+5u];rc_state[dst+36u]=rc_state[${state+10}u];
 if(role<${sphereCount}u){if(rc_state[dst+34u]!=rc_state[param+4u]){rc_native_current_pre_fail(${state}u,3u,role);return;}}else{let init=${registration}u+(role-${sphereCount}u)*30u;if(rc_state[src+62u]!=rc_state[init+12u]||rc_state[dst+34u]!=rc_state[init+12u]||rc_state[src+63u]!=rc_state[init+13u]||rc_state[src+63u]!=rc_state[param+5u]){rc_native_current_pre_fail(${state}u,3u,role);return;}for(var n=0u;n<3u;n++){if(rc_state[src+35u+n]!=rc_state[src+47u+n]||rc_state[src+47u+n]!=rc_state[param+6u+n]||rc_state[src+38u+n]!=rc_state[param+9u+n]){rc_native_current_pre_fail(${state}u,3u,role);return;}}}
 for(var n=0u;n<64u;n++){if((rc_state[dst+n]&0x7f800000u)==0x7f800000u){rc_native_current_pre_fail(${state}u,4u,role);return;}rc_scratch[${scratch}u+n]=rc_state[dst+n];}rc_state[${state+11}u]=1u;
}
`;
}
