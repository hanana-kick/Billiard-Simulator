// Source-ordered WGSL port of inverse-events.js's observation reducer.
// No physics/convex-query/scorer producer, no host fallback, no activation.
import {generateSourceNumberWGSL,numberWords} from './source-number.mjs';
import {generatePinnedMathWGSL} from './raw-strike.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {assertInverseObservationLayout} from './inverse-observation-layout.mjs';
const F=n=>{const w=numberWords(n);return`RcF64(${w[0]}u,${w[1]}u)`;};
/** One lane owns one candidate. The input slot is eventually written by the
 * same-world after-solver/pre-application producer (NOT implemented here).
 * TEST host uploads of captured native frames are oracle fixtures only. */
export function generateInverseObservationWGSL(layout,{count=1,workgroupSize=1,entry='observe'}={}){
 const l=assertInverseObservationLayout(layout);if(!Number.isInteger(count)||count<1||count>4096||![1,64].includes(workgroupSize)||!['observe','project'].includes(entry))throw new TypeError('Explicit bounded observation shader shape');
 const S=l.stateWords,Q=l.frameWords,N=l.expected.length,O=l.objectIds.length,R=l.rails.length,P=l.pairs,PB=l.pairBase,EB=l.eventBase,C=l.eventCapacity;
 const declarations=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(1) var<storage,read> rc_program:array<u32>;
@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(4) var<storage,read> rc_inputs:array<u32>;`;
 const body=/*wgsl*/`
struct RcObsV {x:RcF64,y:RcF64,z:RcF64}
fn ro_load(p:u32)->RcF64{return RcF64(rc_state[p],rc_state[p+1u]);}
fn ro_input(p:u32)->RcF64{return RcF64(rc_inputs[p],rc_inputs[p+1u]);}
fn ro_put(p:u32,v:RcF64){rc_state[p]=v.x;rc_state[p+1u]=v.y;}
fn ro_iv(p:u32)->RcObsV{return RcObsV(ro_input(p),ro_input(p+2u),ro_input(p+4u));}
fn ro_sv(p:u32)->RcObsV{return RcObsV(ro_load(p),ro_load(p+2u),ro_load(p+4u));}
fn ro_vput(p:u32,v:RcObsV){ro_put(p,v.x);ro_put(p+2u,v.y);ro_put(p+4u,v.z);}
fn ro_sub(a:RcObsV,b:RcObsV)->RcObsV{return RcObsV(rc_f64_sub(a.x,b.x),rc_f64_sub(a.y,b.y),rc_f64_sub(a.z,b.z));}
fn ro_norm(a:RcObsV)->RcF64{return rc_f64_pinned_hypot3(a.x,a.y,a.z);}
fn ro_zero()->RcObsV{return RcObsV(${F(0)},${F(0)},${F(0)});}
fn ro_finite(a:RcObsV)->bool{return rc_f64_finite(a.x)&&rc_f64_finite(a.y)&&rc_f64_finite(a.z);}
fn ro_surface(a:RcObsV,r:RcF64)->RcObsV{
 let d=ro_norm(a);let diff=rc_f64_sub(d,r);let gap=select(diff,${F(0)},rc_f64_lt(diff,${F(0)})||rc_f64_zero(diff));
 if(rc_f64_lt(${F(1e-14)},d)){return RcObsV(rc_f64_div(rc_f64_mul(a.x,gap),d),rc_f64_div(rc_f64_mul(a.y,gap),d),rc_f64_div(rc_f64_mul(a.z,gap),d));}return ro_zero();
}
// Explicit +0 reduce seed and original left association, not dot/fma.
fn ro_dot(a:RcObsV,b:RcObsV)->RcF64{return rc_f64_add(rc_f64_add(rc_f64_add(${F(0)},rc_f64_mul(a.x,b.x)),rc_f64_mul(a.y,b.y)),rc_f64_mul(a.z,b.z));}
fn ro_segment(s:u32,c0:RcObsV,t0:RcObsV,c1:RcObsV,t1:RcObsV,r:RcF64)->RcObsV{
 let r0=ro_sub(c0,t0);let r1=ro_sub(c1,t1);let d=ro_sub(r1,r0);let dd=ro_dot(d,d);if(!ro_finite(r0)||!ro_finite(r1)||!ro_finite(d)||!rc_f64_finite(dd)){ro_fail(s,2u,4u);return ro_zero();}var u=${F(0)};
 if(rc_f64_lt(${F(1e-24)},dd)){let numerator=ro_dot(r0,d);if(!rc_f64_finite(numerator)){ro_fail(s,2u,4u);return ro_zero();}u=rc_f64_div(rc_f64_neg(numerator),dd);if(rc_f64_lt(${F(1)},u)){u=${F(1)};}if(!rc_f64_lt(${F(0)},u)){u=${F(0)};}}
 return ro_surface(RcObsV(rc_f64_add(r0.x,rc_f64_mul(u,d.x)),rc_f64_add(r0.y,rc_f64_mul(u,d.y)),rc_f64_add(r0.z,rc_f64_mul(u,d.z))),r);
}
fn ro_fail(s:u32,status:u32,reason:u32){rc_state[s+2u]=status;rc_state[s+3u]=reason;}
fn ro_same(a:u32,b:u32)->bool{return rc_program[12u+2u*a]==rc_program[12u+2u*b]&&rc_program[13u+2u*a]==rc_program[13u+2u*b];}
fn ro_config()->bool{
 if(arrayLength(&rc_program)!=${l.configWords}u){return false;}
 ${Array.from(l.config,(v,i)=>`if(rc_program[${i}u]!=${v}u){return false;}`).join('\n ')}return true;
}
fn ro_sample(s:u32,f:u32,continuous:bool){
 let stage=rc_state[s+6u];if(rc_state[s+7u]!=0u||stage>=${N}u){return;}
 let kind=rc_program[12u+2u*stage];let key=rc_program[13u+2u*stage];var found=false;var slot=0u;
 for(var i=0u;i<${P}u;i++){let object=i<${O}u;if(object==(kind==0u)&&rc_inputs[f+24u+12u*i]==key){found=true;slot=i;break;}}
 if(!found){rc_state[s+11u]=select(2u,1u,kind==0u);return;}
 let row=f+24u+12u*slot;let cue=ro_iv(f+8u);var targetPoint=ro_zero();var radius=ro_input(f+14u);var residual=ro_zero();
 if(kind==0u){targetPoint=ro_iv(row+2u);radius=rc_f64_add(radius,ro_input(row+8u));residual=ro_surface(ro_sub(cue,targetPoint),radius);}
 else{if(rc_inputs[row+2u]==0u){rc_state[s+11u]=2u;return;}targetPoint=ro_iv(row+4u);residual=ro_surface(ro_sub(cue,targetPoint),radius);}
 if(!ro_finite(residual)){ro_fail(s,2u,4u);return;}
 let st=s+64u+12u*stage;
 if(stage>0u&&ro_same(stage,stage-1u)){
  if(rc_state[s+${PB}u+2u*slot+1u]!=0u){rc_state[s+14u]=1u;return;}
  let gap=ro_norm(residual);
  if(rc_state[st+7u]==0u){rc_state[st+7u]=1u;ro_put(st+8u,gap);rc_state[st+10u]=0u;rc_state[s+14u]=1u;return;}
  if(rc_f64_lt(gap,rc_f64_sub(ro_load(st+8u),${F(1e-10)}))){rc_state[st+10u]=1u;}
  ro_put(st+8u,gap);if(rc_state[st+10u]==0u){rc_state[s+14u]=1u;return;}
 }
 if(kind==0u&&continuous&&rc_state[s+14u]==2u&&rc_state[s+15u]==stage){
  let segment=ro_segment(s,ro_sv(s+20u),ro_sv(s+26u),cue,targetPoint,radius);
  if(rc_state[s+2u]!=1u){return;}
  if(rc_f64_lt(ro_norm(segment),ro_norm(residual))){residual=segment;}
 }
 if(kind==0u){rc_state[s+14u]=2u;rc_state[s+15u]=stage;ro_vput(s+20u,cue);ro_vput(s+26u,targetPoint);ro_put(s+32u,radius);}else{rc_state[s+14u]=1u;}
 if(rc_state[st]==0u||rc_f64_lt(ro_norm(residual),ro_norm(ro_sv(st+1u)))){rc_state[st]=1u;ro_vput(st+1u,residual);}
}
fn ro_validate(s:u32,f:u32)->u32{
 if(!ro_config()||rc_state[s]!=${0x52494f53}u||rc_state[s+1u]!=1u||rc_state[s+6u]>${N}u||rc_state[s+12u]>${C}u||rc_state[s+13u]>rc_state[s+12u]||rc_state[s+7u]>2u||rc_state[s+14u]>2u){return 7u;}
 if(rc_inputs[f]!=${0x52494f46}u||rc_inputs[f+1u]!=1u||rc_inputs[f+2u]>1u||rc_inputs[f+16u]!=${O}u||rc_inputs[f+17u]!=${R}u){return 1u;}
 for(var i=18u;i<24u;i++){if(rc_inputs[f+i]!=0u){return 1u;}}
 if(!rc_f64_finite(ro_input(f+4u))||!ro_finite(ro_iv(f+8u))||!rc_f64_finite(ro_input(f+14u))||!rc_f64_lt(${F(0)},ro_input(f+14u))){return 1u;}
 if(rc_inputs[f+2u]==0u){if(!rc_f64_zero(ro_input(f+6u))){return 1u;}if(rc_state[s+5u]!=0u||rc_state[s+4u]!=0u||rc_inputs[f+3u]!=0u||!rc_f64_eq(ro_input(f+4u),ro_load(s+16u))){return 2u;}}
 else{if(!rc_f64_finite(ro_input(f+6u))||!rc_f64_lt(${F(0)},ro_input(f+6u))){return 1u;}if(rc_state[s+4u]==0xffffffffu||rc_inputs[f+3u]!=rc_state[s+4u]+1u||!rc_f64_lt(ro_load(s+18u),ro_input(f+4u))){return 2u;}}
 for(var i=0u;i<${P}u;i++){
  let row=f+24u+12u*i;if(rc_inputs[row]!=rc_program[${12+2*N}u+i]||rc_inputs[row+1u]>1u||rc_inputs[row+10u]!=0u||rc_inputs[row+11u]!=0u){return 1u;}
  if(i<${O}u){if(!ro_finite(ro_iv(row+2u))||!rc_f64_finite(ro_input(row+8u))||!rc_f64_lt(${F(0)},ro_input(row+8u))){return 1u;}}
  else{if(rc_inputs[row+2u]>1u||rc_inputs[row+3u]>1u){return 1u;}if(rc_inputs[row+2u]==1u){if(!ro_finite(ro_iv(row+4u))){return 1u;}}
   else{if(rc_inputs[row+1u]!=0u||(rc_inputs[f+2u]==1u&&rc_state[s+${PB}u+2u*i+1u]!=0u)){return 1u;}for(var j=3u;j<10u;j++){if(rc_inputs[row+j]!=0u){return 1u;}}}
  }
 }
 return 0u;
}
fn rc_inverse_observe(s:u32,f:u32){
 if(s>arrayLength(&rc_state)||arrayLength(&rc_state)-s<${S}u||f>arrayLength(&rc_inputs)||arrayLength(&rc_inputs)-f<${Q}u){return;}
 if(rc_state[s+2u]!=1u){return;}
 let invalid=ro_validate(s,f);if(invalid!=0u){ro_fail(s,3u,invalid);return;}
 if(rc_inputs[f+2u]==0u){ro_sample(s,f,false);if(rc_state[s+2u]!=1u){return;}ro_put(s+18u,ro_input(f+4u));rc_state[s+5u]=1u;}
 else{
  rc_state[s+4u]=rc_state[s+4u]+1u;ro_put(s+18u,ro_input(f+4u));
  let cue=ro_iv(f+8u);let radius=ro_input(f+14u);let first=rc_state[s+12u];var added=0u;
  for(var i=0u;i<${P}u;i++){
   let pair=s+${PB}u+2u*i;let row=f+24u+12u*i;let impact=rc_inputs[row+1u]!=0u;var pairActive=rc_state[pair+1u]!=0u;
   if(!pairActive&&!impact){continue;}
   var separation=${F(0)};
   if(i<${O}u){separation=rc_f64_sub(rc_f64_sub(ro_norm(ro_sub(cue,ro_iv(row+2u))),radius),ro_input(row+8u));}
   else{if(rc_inputs[row+3u]!=0u){separation=rc_f64_neg(radius);}else{separation=rc_f64_sub(ro_norm(ro_sub(cue,ro_iv(row+4u))),radius);}}
   if(rc_f64_lt(${F(.00005)},separation)){pairActive=false;}
   if(impact&&!pairActive){
    if(first+added>=${C}u){ro_fail(s,2u,3u);return;}
    let time=rc_f64_sub(ro_input(f+4u),ro_load(s+16u));if(!rc_f64_finite(time)){ro_fail(s,2u,4u);return;}
    let at=s+${EB}u+8u*(first+added);rc_state[at]=select(1u,0u,i<${O}u);rc_state[at+1u]=rc_inputs[row];ro_put(at+2u,time);ro_put(at+4u,ro_input(f+6u));rc_state[at+6u]=rc_state[s+4u];
    if(i<${O}u&&rc_state[s+13u]==0u){rc_state[s+13u]=first+added+1u;}added++;pairActive=true;
   }
   rc_state[pair]=1u;rc_state[pair+1u]=select(0u,1u,pairActive);
  }
  // All new events use the identical source frame.time-start expression.
  // With unique fixed roster keys, stable sort/dedup is this one ordered group.
  if(added>0u){
   ro_sample(s,f,false);if(rc_state[s+2u]!=1u){return;}
   rc_state[s+12u]=first+added;
   if(rc_state[s+7u]==0u&&rc_state[s+6u]<${N}u){
    let stage=rc_state[s+6u];let ev=s+${EB}u+8u*first;
    if(added!=1u){rc_state[s+7u]=2u;}
    else if(rc_state[ev]!=rc_program[12u+2u*stage]||rc_state[ev+1u]!=rc_program[13u+2u*stage]){rc_state[s+7u]=1u;}
    else{let st=s+64u+12u*stage;rc_state[st]=1u;ro_vput(st+1u,ro_zero());rc_state[s+6u]=stage+1u;}
    if(rc_state[s+7u]!=0u){rc_state[s+8u]=stage;rc_state[s+9u]=first;rc_state[s+10u]=added;}
   }
   rc_state[s+14u]=1u;ro_sample(s,f,false);
  }else{ro_sample(s,f,true);}
 }
 if(rc_state[s+2u]==1u&&rc_state[s+11u]!=0u){ro_fail(s,2u,select(6u,5u,rc_state[s+11u]==1u));}
}
// Positive finite safe quotient: exact Math.round, not floor(x+.5).
// Other contact-cell Number domains are explicitly unsupported, not coerced.
fn ro_round(q:RcF64)->RcF64{
 if(rc_f64_zero(q)){return q;}let exponent=i32((q.y>>20u)&2047u)-1023;if(exponent>=52){return q;}if(exponent<0){return select(${F(0)},${F(1)},!rc_f64_lt(q,${F(.5)}));}
 var floor=q;if(exponent==20){floor.x=0u;}else if(exponent>20){let shift=u32(52-exponent);floor.x=floor.x&(~((1u<<shift)-1u));}
 else{floor.x=0u;let shift=u32(20-exponent);floor.y=floor.y&(~((1u<<shift)-1u));}
 if(!rc_f64_lt(rc_f64_sub(q,floor),${F(.5)})){return rc_f64_add(floor,${F(1)});}return floor;
}
// Observation-only projection. Scorer/constraint/finalization join is absent.
fn rc_inverse_observation_project(s:u32,out:u32){
 if(s>arrayLength(&rc_state)||arrayLength(&rc_state)-s<${S}u||out>arrayLength(&rc_scratch)||arrayLength(&rc_scratch)-out<24u){return;}
 for(var i=0u;i<24u;i++){rc_scratch[out+i]=0u;}
 rc_scratch[out]=${0x52494f50}u;rc_scratch[out+1u]=rc_state[s+2u];rc_scratch[out+2u]=rc_state[s+3u];if(rc_state[s+2u]!=1u){return;}
 let prefix=rc_state[s+6u];let matched=rc_state[s+7u]==0u&&prefix==${N}u;let st=s+64u+12u*prefix;let available=matched||(prefix<${N}u&&rc_state[st]!=0u);
 rc_scratch[out+3u]=prefix;rc_scratch[out+4u]=prefix;rc_scratch[out+5u]=select(0u,1u,available)|select(0u,2u,matched);rc_scratch[out+6u]=rc_state[s+4u];
 if(available&&!matched){for(var i=0u;i<6u;i++){rc_scratch[out+8u+i]=rc_state[st+1u+i];}}
 if(rc_state[s+13u]!=0u){let ev=s+${EB}u+8u*(rc_state[s+13u]-1u);let time=ro_load(ev+2u);let dt=ro_load(ev+4u);let q=rc_f64_div(time,dt);
  if(!rc_f64_finite(q)||rc_f64_lt(q,${F(0)})||rc_f64_lt(${F(Number.MAX_SAFE_INTEGER)},q)){for(var i=3u;i<24u;i++){rc_scratch[out+i]=0u;}rc_scratch[out+1u]=2u;rc_scratch[out+2u]=8u;return;}
  let rounded=ro_round(q);rc_scratch[out+5u]=rc_scratch[out+5u]|16u;for(var i=0u;i<4u;i++){rc_scratch[out+14u+i]=rc_state[ev+2u+i];}rc_scratch[out+18u]=rounded.x;rc_scratch[out+19u]=rounded.y;rc_scratch[out+20u]=rc_state[ev+1u];
 }
}
@compute @workgroup_size(${workgroupSize}) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=${count}u){return;}${entry==='observe'?`rc_inverse_observe(gid.x*${S}u,gid.x*${Q}u);`:`rc_inverse_observation_project(gid.x*${S}u,gid.x*24u);`}}
`;
 // Keep original V8/SunPro license notice even though the linker prunes unrelated
 // trig functions. Reachable hypot3 and integer f64 bodies remain unchanged.
 const math=generatePinnedMathWGSL(),license=math.slice(0,math.indexOf('*/')+2);
 return license+'\n'+linkResidentWGSL([declarations,generateSourceNumberWGSL(),math,body],{entry:'main'}).code;
}
