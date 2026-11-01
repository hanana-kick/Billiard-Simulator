// SPDX-License-Identifier: Apache-2.0
// Distinct current h2 phase gates. Numerical equations/field mappings are the
// exact existing three-sphere/two-cue owners; old initial factories are untouched.
// Caller must own current inactive empty-edge journal/roster and native pre-CCD.
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {SCENE_WORLD_LAYOUT as W} from './scene-world.mjs';
import {CONTACT_JOURNAL_LAYOUT as J,CONTACT_JOURNAL_LAYOUT as G} from './contact-journal.mjs';
import {THREE_BALL_FIRST_CUE_HEADER as Q} from './three-ball-first-cue.mjs';
import {THREE_BALL_FIRST_SPHERE_HEADER as P} from './three-ball-first-sphere.mjs';
import {THREE_BALL_SOLVER_LAYOUT as L} from './three-ball-solver.mjs';
import Joint from '../experimental-cue-joint-stepper.js';
export function generateThreeBallCurrentNumericalWGSL(){return generateNumerical(null);}
export function generateThreeBallRetainedNumericalKernelsWGSL(controlBase){if(!Number.isSafeInteger(controlBase)||controlBase<0||controlBase>=0x10000000)throw new RangeError('Genuine-three retained numerical control base');return generateNumerical(controlBase);}
function generateNumerical(controlBase){const p=Joint.buildPlan(),sequence=controlBase===null?'2u':`rc_state[${controlBase+8}u]`;return `

fn rc_scene_three_cue_fail(s:u32,c:u32)->bool{rc_state[c+2u]=4u;return rc_scene_bad(s,6u);}
fn rc_scene_three_cue_gather(s:u32,j:u32,w:u32,b:u32,c:u32,input:u32,saved:u32,initOut:u32)->bool{
 if(rc_state[c]!=0x52334355u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+4u]!=3u||rc_state[c+5u]!=5u||rc_state[c+6u]!=25u||rc_state[c+7u]!=2u||rc_state[c+8u]!=0u||rc_state[c+9u]!=0u||rc_state[c+10u]!=0u||rc_state[s+${S.header.phase}u]!=6u||rc_state[s+${S.header.jointCount}u]!=2u||rc_state[w+${W.header.continuation}u]!=10u||rc_state[j+${G.header.sequence}u]!=${sequence}||(rc_state[j+${G.header.edges}u]<3u||rc_state[j+${G.header.edges}u]>9u)){return rc_scene_three_cue_fail(s,c);}
 if(rc_state[s+${S.header.roleShaft}u]!=rc_state[c+12u]||rc_state[s+${S.header.roleHead}u]!=rc_state[c+13u]||rc_state[s+${S.header.roleGuide}u]!=rc_state[c+14u]||rc_state[input+131u]!=rc_state[c+11u]){return rc_scene_three_cue_fail(s,c);}
 let guide=rc_scene_bp(s,rc_state[c+14u]);if(!rc_scene_valid_body(s,rc_state[c+14u])||rc_state[guide+${S.body.dynamic}u]!=0u||rc_state[guide+${S.body.index}u]!=rc_state[c+24u]||rc_state[guide+${S.body.generation}u]!=rc_state[c+25u]){return rc_scene_three_cue_fail(s,c);}
 for(var n=0u;n<2u;n++){let actual=s+${S.jointOffset}u+n*6u;let original=c+28u+n*6u;if(rc_state[actual]!=rc_state[original]||rc_state[actual+1u]!=rc_state[original+1u]||rc_state[actual+4u]!=rc_state[original+2u]||rc_state[actual+5u]!=rc_state[original+3u]){return rc_scene_three_cue_fail(s,c);}}
 for(var role=0u;role<2u;role++){
  let slot=rc_state[c+12u+role];let member=rc_scene_bp(s,slot);let binding=c+16u+role*4u;
  if(!rc_scene_valid_body(s,slot)||rc_state[member+${S.body.index}u]!=rc_state[binding]||rc_state[member+${S.body.generation}u]!=rc_state[binding+1u]||rc_state[member+${S.body.activation+4}u]!=0u||rc_state[binding+2u]!=slot||rc_state[binding+3u]!=3u+role||rc_state[w+${W.bodyMapOffset}u+slot]!=3u+role){return rc_scene_three_cue_fail(s,c);}
  let src=b+(3u+role)*64u;let dst=input+role*48u;let original=initOut+role*30u;
  // Exact registration graph outputs, never initial zero max_extent metadata.
  if(rc_state[original+12u]!=rc_state[member+${S.body.maxExtent}u]||rc_state[original+13u]!=rc_state[src+63u]){return rc_scene_three_cue_fail(s,c);}rc_state[src+62u]=rc_state[original+12u];
  for(var k=0u;k<64u;k++){rc_state[saved+role*64u+k]=rc_state[src+k];}
  for(var k=0u;k<13u;k++){rc_state[dst+k]=rc_state[src+k];}
  for(var k=0u;k<3u;k++){rc_state[dst+13u+k]=rc_state[src+56u+k];rc_state[dst+16u+k]=rc_state[src+13u+k];rc_state[dst+29u+k]=rc_state[src+28u+k];rc_state[dst+32u+k]=rc_state[src+35u+k];rc_state[dst+35u+k]=rc_state[src+38u+k];}
  rc_state[dst+19u]=rc_state[src+16u];rc_state[dst+20u]=rc_state[src+17u];rc_state[dst+21u]=rc_state[src+18u];rc_state[dst+22u]=rc_state[src+20u];rc_state[dst+23u]=rc_state[src+21u];rc_state[dst+24u]=rc_state[src+24u];
  for(var k=0u;k<4u;k++){rc_state[dst+25u+k]=rc_state[src+31u+k];rc_state[dst+38u+k]=rc_state[src+42u+k];}
 }
 rc_state[c+15u]=rc_state[s+${S.header.epoch}u];rc_state[c+3u]=1u;return true;
}
fn rc_scene_three_cue_scatter(s:u32,b:u32,c:u32,out:u32)->bool{
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+8u]!=1u||rc_state[c+15u]!=rc_state[s+${S.header.epoch}u]){return rc_scene_three_cue_fail(s,c);}
 for(var role=0u;role<2u;role++){var at=out+${p.bodyLayout[0]}u;if(role==1u){at=out+${p.bodyLayout[1]}u;}let dst=b+(3u+role)*64u;
  for(var k=0u;k<13u;k++){rc_state[dst+k]=rc_state[at+k];}
  rc_state[dst+16u]=rc_state[at+13u];rc_state[dst+17u]=rc_state[at+14u];rc_state[dst+18u]=rc_state[at+15u];rc_state[dst+19u]=rc_state[at+14u];rc_state[dst+20u]=rc_state[at+16u];rc_state[dst+21u]=rc_state[at+17u];rc_state[dst+22u]=rc_state[at+15u];rc_state[dst+23u]=rc_state[at+17u];rc_state[dst+24u]=rc_state[at+18u];
 }
 rc_state[c+3u]=2u;return true;
}
fn rc_scene_three_cue_ccd_input(b:u32,c:u32,saved:u32,input:u32,role:u32)->bool{
 if(role>1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=2u||(rc_state[c+9u]&(1u<<role))!=0u){return false;}let cur=saved+role*64u;let next=b+(3u+role)*64u;
 for(var k=0u;k<64u;k++){rc_state[input+k]=0u;}for(var k=0u;k<13u;k++){rc_state[input+k]=rc_state[cur+k];}
 for(var k=0u;k<3u;k++){rc_state[input+13u+k]=rc_state[cur+47u+k];rc_state[input+16u+k]=rc_state[cur+38u+k];rc_state[input+19u+k]=rc_state[cur+13u+k];rc_state[input+31u+k]=rc_state[cur+56u+k];}
 for(var k=0u;k<9u;k++){rc_state[input+22u+k]=rc_state[cur+16u+k];}rc_state[input+34u]=rc_state[cur+62u];rc_state[input+35u]=rc_state[cur+63u];rc_state[input+36u]=rc_state[c+11u];
 for(var k=0u;k<7u;k++){rc_state[input+37u+k]=rc_state[next+6u+k];}return true;
}
fn rc_scene_three_cue_ccd_finish(s:u32,c:u32,out:u32,role:u32)->bool{
 if(role>1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=2u||rc_state[c+15u]!=rc_state[s+${S.header.epoch}u]||(rc_state[c+9u]&(1u<<role))!=0u||rc_state[out+17u]!=0u||rc_state[out+18u]!=0x3f800000u){return rc_scene_three_cue_fail(s,c);}
 rc_state[c+9u]=rc_state[c+9u]|(1u<<role);if(rc_state[c+9u]==3u){rc_state[c+3u]=3u;rc_state[c+10u]=1u;}return true;
}


fn rc_scene_three_sphere_fail(s:u32,c:u32)->bool{rc_state[c+2u]=4u;return rc_scene_bad(s,6u);}
fn rc_scene_three_sphere_begin(s:u32,j:u32,q:u32,w:u32,c:u32,common:u32)->bool{
 if(rc_state[c]!=0x52335350u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+6u]!=0u||rc_state[q+${Q.completed}u]!=1u||rc_state[q+${Q.phase}u]!=3u||rc_state[q+${Q.ccdMask}u]!=3u||rc_state[q+${Q.status}u]!=1u||rc_state[s+${S.header.phase}u]!=6u||rc_state[j+${J.header.sequence}u]!=${sequence}||(rc_state[j+${J.header.edges}u]<3u||rc_state[j+${J.header.edges}u]>9u)||rc_state[w]!=0u||rc_state[w+1u]!=1u){return rc_scene_three_sphere_fail(s,c);}
 if(rc_state[common]!=rc_state[c+9u]||rc_state[q+${Q.dt}u]!=rc_state[c+9u]||rc_state[w+2u]>3u||rc_state[w+3u]>3u){return rc_scene_three_sphere_fail(s,c);}
 var awake=0u;var count=0u;for(var n=0u;n<3u;n++){let bind=c+16u+n*4u;let slot=rc_state[bind+2u];let b=rc_scene_bp(s,slot);if(!rc_scene_valid_body(s,slot)||rc_state[b+${S.body.index}u]!=rc_state[bind]||rc_state[b+${S.body.generation}u]!=rc_state[bind+1u]||rc_state[b+${S.body.dynamic}u]!=1u){return rc_scene_three_sphere_fail(s,c);}if(rc_state[b+${S.body.activation+4}u]==0u){awake=awake|(1u<<n);count++;}}
 if(rc_state[w+2u]!=count||rc_state[common+${L.coupled.rosterBase}u]!=count||rc_state[common+${L.coupled.rosterBase+1}u]!=rc_state[w+3u]){return rc_scene_three_sphere_fail(s,c);}
 rc_state[c+4u]=awake;rc_state[c+5u]=0u;rc_state[c+7u]=rc_state[s+${S.header.epoch}u];rc_state[c+8u]=rc_state[j+${J.header.sequence}u];rc_state[c+3u]=1u;return true;
}
fn rc_scene_three_sphere_post_input(s:u32,b:u32,w:u32,c:u32,input:u32,n:u32)->bool{
 if(n>=3u||rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[w]!=0u||rc_state[w+1u]!=2u||rc_state[c+7u]!=rc_state[s+${S.header.epoch}u]||(rc_state[c+4u]&(1u<<n))==0u||(rc_state[c+5u]&(1u<<n))!=0u||rc_state[input+36u]!=rc_state[c+9u]){return false;}
 for(var k=0u;k<7u;k++){rc_state[input+37u+k]=rc_state[b+n*64u+6u+k];}return true;
}
fn rc_scene_three_sphere_post_finish(s:u32,c:u32,out:u32,n:u32)->bool{
 if(n>=3u||rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+7u]!=rc_state[s+${S.header.epoch}u]||(rc_state[c+4u]&(1u<<n))==0u||(rc_state[c+5u]&(1u<<n))!=0u||rc_state[out+17u]!=0u||rc_state[out+18u]!=0x3f800000u){return rc_scene_three_sphere_fail(s,c);}rc_state[c+5u]=rc_state[c+5u]|(1u<<n);return true;
}
fn rc_scene_three_sphere_complete(s:u32,j:u32,w:u32,c:u32)->bool{
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+6u]!=0u||rc_state[w]!=0u||rc_state[w+1u]!=2u||rc_state[c+7u]!=rc_state[s+${S.header.epoch}u]||rc_state[c+8u]!=rc_state[j+${J.header.sequence}u]||rc_state[c+4u]!=rc_state[c+5u]){return rc_scene_three_sphere_fail(s,c);}rc_state[c+3u]=2u;rc_state[c+6u]=1u;return true;
}


fn rc_scene_three_post_fail(s:u32,c:u32)->bool{rc_state[c+2u]=4u;return rc_scene_bad(s,6u);}
fn rc_scene_three_post_begin(s:u32,p:u32,c:u32)->bool{
 if(rc_state[c]!=0x52335041u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+7u]!=0u||rc_state[p+${P.phase}u]!=1u||rc_state[p+${P.completed}u]!=0u||rc_state[s+${S.header.phase}u]!=6u){return rc_scene_three_post_fail(s,c);}rc_state[c+8u]=rc_state[s+${S.header.epoch}u];rc_state[c+12u]=rc_state[p+${P.awakeMask}u];rc_state[c+3u]=1u;return true;
}
fn rc_scene_three_post_fat_input(s:u32,p:u32,c:u32,b:u32,input:u32,n:u32)->bool{
 if(n>=3u||rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=0u||rc_state[c+6u]!=0u||rc_state[c+8u]!=rc_state[s+${S.header.epoch}u]||(rc_state[c+12u]&(1u<<n))==0u||rc_state[c+5u]!=(((1u<<n)-1u)&rc_state[c+12u])||(rc_state[p+${P.postMask}u]&(1u<<n))!=0u){return rc_scene_three_post_fail(s,c);}for(var k=0u;k<3u;k++){rc_state[input+k]=rc_state[b+n*64u+6u+k];}return true;
}
fn rc_scene_three_post_fat_finish(s:u32,c:u32,out:u32,bounds:u32,n:u32)->bool{
 if(n>=3u||rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=0u||rc_state[c+6u]!=0u||rc_state[c+8u]!=rc_state[s+${S.header.epoch}u]||(rc_state[c+12u]&(1u<<n))==0u||rc_state[out+6u]!=0x3f800000u||rc_state[c+5u]!=(((1u<<n)-1u)&rc_state[c+12u])){return rc_scene_three_post_fail(s,c);}for(var k=0u;k<6u;k++){rc_state[bounds+n*6u+k]=rc_state[out+k];}rc_state[c+5u]=rc_state[c+5u]|(1u<<n);return true;
}
fn rc_scene_three_post_patch(s:u32,p:u32,c:u32,b:u32,out:u32,n:u32)->bool{
 if(n>=3u||rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=n||rc_state[c+8u]!=rc_state[s+${S.header.epoch}u]||rc_state[p+${P.completed}u]!=1u||rc_state[p+${P.postMask}u]!=rc_state[c+12u]||rc_state[c+5u]!=rc_state[c+12u]){return rc_scene_three_post_fail(s,c);}let mask=1u<<n;
 if((rc_state[c+12u]&mask)!=0u){if((rc_state[c+5u]&mask)==0u||(rc_state[p+${P.postMask}u]&mask)==0u||rc_state[out+38u]!=1u||rc_state[out]>1u||rc_state[out+1u]!=0u){return rc_scene_three_post_fail(s,c);}if(rc_state[out]!=0u){let slot=rc_state[p+16u+n*4u+2u];if(!rc_scene_post_application(s,slot)){return rc_scene_three_post_fail(s,c);}for(var k=0u;k<3u;k++){rc_state[b+n*64u+3u+k]=rc_state[out+32u+k];}}}
 rc_state[c+6u]=rc_state[c+6u]|mask;rc_state[c+4u]=n+1u;return true;
}
fn rc_scene_three_post_complete(s:u32,p:u32,c:u32)->bool{
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=3u||rc_state[c+5u]!=rc_state[c+12u]||rc_state[c+6u]!=7u||rc_state[c+7u]!=0u||rc_state[p+${P.completed}u]!=1u){return rc_scene_three_post_fail(s,c);}if(!rc_scene_finish_application(s)){return rc_scene_three_post_fail(s,c);}rc_state[c+3u]=2u;rc_state[c+7u]=1u;return true;
}

`;
}
