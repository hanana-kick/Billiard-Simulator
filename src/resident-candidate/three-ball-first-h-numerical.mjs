// SPDX-License-Identifier: Apache-2.0
// Source-order numerical/application suffix of the genuine initial same-bank
// owner. This file supplies emitted functions only: no HOST phase execution.
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {SCENE_WORLD_LAYOUT as W} from './scene-world.mjs';
import Joint from '../experimental-cue-joint-stepper.js';
export function generateThreeBallFirstHNumericalWGSL(plan){const d=plan.layout,p=plan.programOffsets,joint=Joint.buildPlan(),c=d.control,q=d.cue,b=d.bodies,post=d.postControl,sp=d.sphereControl,cp=d.cueControl,floor=d.floorBase,F=plan.floor.layout,app=d.applicationControl,ni=d.numberInput,nr=d.numberRegisters,nc=d.numberControl,constants=d.applicationConstants,cat=plan.geometryCatalogBase;
 return `
fn rc_three_h_eval(input:u32,program:u32,out:u32)->bool{
 let count=rc_program[program+3u];let output=rc_program[program+4u];let map=program+rc_program[program+8u];if(count>144u||output>592u){return rc_three_h_fail(30u);}for(var n=0u;n<count;n++){rc_scratch[n]=rc_state[input+n];}if(rc_num_eval(program,0u)!=1u){return rc_three_h_fail(30u);}for(var n=0u;n<output;n++){let value=rc_scratch[rc_program[map+n]];if((value&0x7f800000u)==0x7f800000u){return rc_three_h_fail(30u);}rc_state[out+n]=value;}return true;
}
fn rc_three_h_number_begin(program:u32){rc_source_program_init(program,${nr}u,${nc}u);for(var n=0u;n<rc_program[program+10u];n++){rc_source_program_input(program,${nr}u,n,RcF64(rc_state[${ni}u+n*2u],rc_state[${ni+1}u+n*2u]));}}
fn rc_three_h_number_evaluate(program:u32){rc_source_program_step(program,${nr}u,${nc}u,64u);}
fn rc_three_h_number_finish(program:u32,out:u32)->bool{if(rc_source_program_finish(program,${nr}u,${nc}u,out)!=1u){return rc_three_h_fail(31u);}rc_state[out+31u]=1u;return true;}
fn rc_three_h_number_f32(index:u32,value:u32){let x=rc_f64_from_f32_bits(value);rc_state[${ni}u+index*2u]=x.x;rc_state[${ni+1}u+index*2u]=x.y;}
fn rc_three_h_number_copy(index:u32,at:u32){rc_state[${ni}u+index*2u]=rc_state[at];rc_state[${ni+1}u+index*2u]=rc_state[at+1u];}
fn rc_three_h_energy_begin()->bool{
 if(rc_state[${c+2}u]!=1u||rc_state[${c+3}u]!=5u||rc_state[${d.preCcd+2}u]!=1u||rc_state[${d.preCcd+5}u]!=1u){return rc_three_h_fail(12u);}
 if(!rc_scene_three_energy_begin(0u,${d.journal}u,${d.firstBridge}u,${d.energy}u)||!rc_scene_world_begin_observe(0u,${d.energy}u,rc_state[${sp+9}u])){return rc_three_h_fail(13u);}rc_state[${c+3}u]=6u;return true;
}
fn rc_three_h_energy_done()->bool{
 if(rc_state[${c+2}u]!=1u||rc_state[${c+3}u]!=6u||rc_state[${d.energy+W.header.status}u]!=1u||rc_state[${d.energy+W.header.continuation}u]!=10u){return rc_three_h_fail(14u);}
 // The initial while-cue profile owns no newly-awake precheck. Actual energy
 // may sleep entry-awake bodies, but must not silently activate an unchecked
 // sphere. No solver input/publication follows this unsupported boundary.
 for(var n=0u;n<3u;n++){let slot=rc_state[${sp+18}u+n*4u];let body=rc_scene_bp(0u,slot);if(rc_state[body+${S.body.activation+4}u]==0u&&(rc_state[${d.preCcd+7}u]&(1u<<n))==0u){return rc_three_h_fail(14u);}}
 if(!rc_three_roster_prepare()){return rc_three_h_fail(14u);}
 rc_three_solver_gather(${d.solver}u,${d.journal}u,${d.roster}u,0u,${b}u,${cat}u,${d.caches}u,${d.coupled}u,rc_state[${sp+9}u],0xffffffffu);if(rc_state[${d.solver}u]!=0u||rc_state[${d.solver+1}u]!=1u){return rc_three_h_fail(14u);}rc_state[${c+3}u]=7u;return true;
}
fn rc_three_h_cue_gather()->bool{if(rc_state[${c+3}u]!=7u||!rc_scene_three_cue_gather(0u,${d.journal}u,${d.energy}u,${b}u,${cp}u,${d.input}u,${d.saved}u,${plan.template.registration.layout.numericOutputs}u)){return rc_three_h_fail(15u);}return true;}
fn rc_three_h_cue_scatter()->bool{
 if(rc_state[${c+3}u]!=7u||bitcast<f32>(rc_state[${d.output+joint.guardOffset}u])<1e-7){return rc_three_h_fail(15u);}rc_state[${cp+8}u]=1u;if(!rc_scene_three_cue_scatter(0u,${b}u,${cp}u,${d.output}u)){return rc_three_h_fail(15u);}return true;
}
fn rc_three_h_sphere_begin()->bool{
 if(rc_state[${c+3}u]!=7u||!rc_scene_three_sphere_begin(0u,${d.journal}u,${cp}u,${d.solver}u,${sp}u,${d.coupled}u)||!rc_scene_three_post_begin(0u,${sp}u,${post}u)){return rc_three_h_fail(16u);}
 for(var i=0u;i<3u;i++){for(var n=0u;n<6u;n++){let x=rc_state[${floor+F.bounds}u+i*6u+n];rc_state[${d.fatInputs+12}u+i*24u+n]=x;rc_state[${d.fatBounds}u+i*6u+n]=x;}}rc_state[${c+3}u]=8u;return true;
}
fn rc_three_h_sphere_scatter()->bool{if(rc_state[${c+3}u]!=8u){return rc_three_h_fail(17u);}rc_three_solver_scatter(${d.solver}u,${d.journal}u,${d.roster}u,0u,${b}u,${cat}u,${d.caches}u,${d.coupled}u);if(rc_state[${d.solver}u]!=0u||rc_state[${d.solver+1}u]!=2u){return rc_three_h_fail(17u);}return true;}
fn rc_three_h_sphere_awake(n:u32)->bool{return (rc_state[${sp+4}u]&(1u<<n))!=0u;}
fn rc_three_h_sphere_fat_finish(n:u32)->bool{if(!rc_scene_three_post_fat_finish(0u,${post}u,${d.fatOutputs}u+n*8u,${d.fatBounds}u,n)||rc_geometry_gather(${cat}u,${d.caches}u,${b}u,n,rc_state[${sp+9}u])!=0u){return rc_three_h_fail(18u);}return true;}
fn rc_three_h_sphere_done()->bool{if(!rc_scene_three_sphere_complete(0u,${d.journal}u,${d.solver}u,${sp}u)){return rc_three_h_fail(19u);}rc_state[${c+3}u]=9u;return true;}
fn rc_three_h_app_begin()->bool{
 if(rc_state[${c+3}u]!=9u||rc_state[${d.physicalControl+2}u]!=1u||rc_state[${d.physicalControl+6}u]!=1u||!rc_scene_three_app_adopt(${app}u,${q}u,${cp}u,${d.input}u,${d.output}u)||!rc_scene_three_app_final_mass()){return rc_three_h_fail(20u);}
 rc_three_h_number_copy(0u,${app+10}u);rc_three_h_number_copy(1u,${app+12}u);rc_three_h_number_copy(2u,${app+10}u);rc_three_h_number_copy(3u,${app+16}u);rc_three_h_number_begin(${p.clock}u);rc_state[${c+3}u]=10u;return true;
}
fn rc_three_h_app_clock()->bool{if(!rc_three_h_number_finish(${p.clock}u,${d.clockOutput}u)||!rc_scene_three_app_clock(${app}u,${q}u,${d.clockOutput}u)||!rc_scene_three_app_observe_and_drain(${app}u,${q}u,${d.journal}u,${d.caches}u)){return rc_three_h_fail(21u);}return true;}
fn rc_three_h_patch_begin(n:u32)->bool{
 let body=${b}u+n*64u;let cache=${d.caches}u+n*144u;if(n>=3u||rc_state[${c+3}u]!=10u||rc_state[${post+4}u]!=n){return rc_three_h_fail(22u);}for(var k=0u;k<96u;k++){rc_state[${ni}u+k]=0u;}
 if(rc_state[cache+128u]!=1u||rc_state[cache+129u]!=1u||rc_state[cache+130u]!=1u||rc_state[cache+131u]!=1u){return rc_three_h_fail(22u);}rc_three_h_number_f32(0u,0x3f800000u);for(var k=0u;k<3u;k++){rc_three_h_number_f32(1u+k,rc_state[cache+55u+k]);rc_three_h_number_f32(4u+k,rc_state[body+3u+k]);}rc_three_h_number_f32(7u,rc_state[body+1u]);rc_three_h_number_copy(8u,${constants}u+n*4u);rc_three_h_number_copy(9u,${constants+2}u+n*4u);rc_three_h_number_copy(10u,${constants+12}u);rc_three_h_number_copy(11u,${app+12}u);rc_three_h_number_copy(12u,${constants+14}u);rc_three_h_number_copy(13u,${constants+16}u);rc_three_h_number_f32(14u,0x3f800000u);rc_three_h_number_f32(15u,rc_state[cache+70u]);rc_three_h_number_begin(${p.angular}u);return true;
}
fn rc_three_h_patch_native(n:u32)->bool{
 let out=${d.patchOutputs}u+n*40u;let body=${b}u+n*64u;if(!rc_three_h_number_finish(${p.angular}u,out)||rc_state[out]>1u||rc_state[out+1u]!=0u){return rc_three_h_fail(23u);}var nonzero=false;for(var k=0u;k<3u;k++){let v=rc_f64_to_f32_bits(RcF64(rc_state[out+2u+k*2u],rc_state[out+3u+k*2u]));rc_state[out+35u+k]=v;rc_state[out+32u+k]=rc_state[body+3u+k];rc_state[${ni}u+k]=rc_state[body+3u+k];rc_state[${ni+9}u+k]=v;if((v&0x7fffffffu)!=0u){nonzero=true;}}
 ${[16,17,18,20,21,24].map((at,i)=>`rc_state[${ni+3+i}u]=rc_state[body+${at}u];`).join('')}
 if(rc_state[out]!=0u&&nonzero){if(!rc_three_h_eval(${ni}u,${p.nativeTorque}u,out+32u)){return false;}}rc_state[out+38u]=1u;return true;
}
fn rc_three_h_patch_publish(n:u32)->bool{if(!rc_scene_three_post_patch(0u,${sp}u,${post}u,${b}u,${d.patchOutputs}u+n*40u,n)){return rc_three_h_fail(24u);}return true;}
fn rc_three_h_complete()->bool{if(rc_state[${c+3}u]!=10u||!rc_three_tape_preserved()||rc_state[${d.guardBase+11}u]!=1u||rc_state[${d.preCcd+5}u]!=1u||rc_state[${floor+5}u]!=1u||!rc_scene_three_post_complete(0u,${sp}u,${post}u)||!rc_scene_three_app_finish(${app}u,${q}u,${post}u,${d.clockOutput}u)){return rc_three_h_fail(25u);}rc_state[${c+3}u]=11u;rc_state[${c+5}u]=1u;rc_state[${c+6}u]=1u;return true;}
`;}
