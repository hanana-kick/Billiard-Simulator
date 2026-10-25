// SPDX-License-Identifier: Apache-2.0 AND BSD-3-Clause AND SunPro
// Source-operation-order raw parameter validation and cue pose. This is NOT
// clearance, native allocation, or admission of a completed physical shot.
import {numberWords, wordsNumber, generateSourceNumberWGSL} from './source-number.mjs';

const MATH_LICENSE = `
/* Selected sin/cos reduction and polynomial algorithms adapted to integer-backed
 * binary64 from V8 13.6.233 src/base/ieee754.cc (fdlibm), and hypot2/hypot3 from
 * src/builtins/math.tq. Modified 2026: WGSL u32 arithmetic and explicit scope.
 * Source: https://github.com/v8/v8/tree/13.6.233
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this software is freely
 * granted, provided that this notice is preserved.
 * Copyright 2014, 2016, 2019 the V8 project authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *  * Neither the name of Google Inc. nor the names of its contributors may be
 *    used to endorse or promote products derived from this software without
 *    specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */`;
export const RAW_STRIKE_CAPABILITY = Object.freeze({
  source: 'physics.js:99-124,143-165', numberProfile:'v8-13.6.233-fdlibm-fast-hypot',
  physicalInputRanges:true, pose:true, creationDescriptors:false,
  maximumTrigHighWord:0x7fefffff, arbitraryFiniteAngle:true,
  continuousClearance:false, nativeAllocator:false, completeStrikeInitialization:false,
  shaderNumericalValidation:false
});
export const RAW_POSE_LAYOUT = Object.freeze({words:64,status:0,reason:1,
  direction:2,side:8,up:14,surface:20,contact:26,tip:32,rotation:38,linear:46,shaftCenter:52});
const F=x=>{const w=numberWords(x);return `RcF64(0x${w[0].toString(16)}u,0x${w[1].toString(16)}u)`;};
const high=x=>numberWords(x)[1], fromHigh=h=>wordsNumber(Uint32Array.of(0,h));
const PI2 = [1.57079632673412561417,6.07710050650619224932e-11,6.07710050630396597660e-11,2.02226624879595063154e-21,2.02226624871116645580e-21,8.47842766036889956997e-32];
const NPIO2_HIGH = [0x3FF921FB,0x400921FB,0x4012D97C,0x401921FB,0x401F6A7A,0x4022D97C,0x4025FDBB,0x402921FB,0x402C463A,0x402F6A7A,0x4031475C,0x4032D97C,0x40346B9C,0x4035FDBB,0x40378FDB,0x403921FB,0x403AB41B,0x403C463A,0x403DD85A,0x403F6A7A,0x40407E4C,0x4041475C,0x4042106C,0x4042D97C,0x4043A28C,0x40446B9C,0x404534AC,0x4045FDBB,0x4046C6CB,0x40478FDB,0x404858EB,0x404921FB];
const S = [-1.66666666666666324348e-1,8.33333333332248946124e-3,-1.98412698298579493134e-4,2.75573137070700676789e-6,-2.50507602534068634195e-8,1.58969099521155010221e-10];
const C = [4.16666666666666019037e-2,-1.38888888888741095749e-3,2.48015872894767294178e-5,-2.75573143513906633035e-7,2.08757232129817482790e-9,-1.13596475577881948265e-11];
const TWO_OVER_PI = [0xA2F983,0x6E4E44,0x1529FC,0x2757D1,0xF534DD,0xC0DB62,0x95993C,0x439041,0xFE5163,0xABDEBB,0xC561B7,0x246E3A,0x424DD2,0xE00649,0x2EEA09,0xD1921C,0xFE1DEB,0x1CB129,0xA73EE8,0x8235F5,0x2EBB44,0x84E99C,0x7026B4,0x5F7E41,0x3991D6,0x398353,0x39F49C,0x845F8B,0xBDF928,0x3B1FF8,0x97FFDE,0x05980F,0xEF2F11,0x8B5A0A,0x6D1F6D,0x367ECF,0x27CB09,0xB74F46,0x3F669E,0x5FEA2D,0x7527BA,0xC7EBE5,0xF17B3D,0x0739F7,0x8A5292,0xEA6BFB,0x5FB11F,0x8D5D08,0x560330,0x46FC7B,0x6BABF0,0xCFBC20,0x9AF436,0x1DA9E3,0x91615E,0xE61B08,0x659985,0x5F14A0,0x68408D,0xFFD880,0x4D7327,0x310606,0x1556CA,0x73A8C9,0x60E27B,0xC08C6B];
const PI2_CHUNKS=[1.57079625129699707031,7.54978941586159635335e-8,5.39030252995776476554e-15,3.28200341580791294123e-22,1.27065575308067607349e-29,1.22933308981111328932e-36,2.73370053816464559624e-44,2.16741683877804819444e-51];
// Original kernel_rem_pio2 at fixed prec=2. All work arrays are bounded exactly
// as in fdlibm; capacity failures remain unsupported, never successful clearance.
function reduceLargePi2(x) {
  const bits=numberWords(x),ix=bits[1]&0x7fffffff;if(ix>=0x7ff00000)return null;
  const e0=(ix>>>20)-1046,tx=[],f=Array(20).fill(0),q=Array(20).fill(0),fq=Array(20).fill(0),iq=Array(20).fill(0);
  let z=wordsNumber(Uint32Array.of(bits[0],ix-(e0<<20)));
  for(let i=0;i<2;i++){tx[i]=Math.trunc(z);z=(z-tx[i])*16777216;}tx[2]=z;
  let nx=3;while(tx[nx-1]===0)nx--;
  const jk=4,jp=jk,jx=nx-1,jv=Math.max(0,Math.trunc((e0-3)/24));let q0=e0-24*(jv+1);
  for(let i=0,j=jv-jx;i<=jx+jk;i++,j++)f[i]=j<0?0:TWO_OVER_PI[j];
  for(let i=0;i<=jk;i++){let fw=0;for(let j=0;j<=jx;j++)fw+=tx[j]*f[jx+i-j];q[i]=fw;}
  let jz=jk,n=0,ih=0;
  for(;;){
    z=q[jz];for(let i=0,j=jz;j>0;i++,j--){const fw=Math.trunc(5.9604644775390625e-8*z);iq[i]=Math.trunc(z-16777216*fw);z=q[j-1]+fw;}
    z*=2**q0;z-=8*Math.floor(z*.125);n=Math.trunc(z);z-=n;ih=0;
    if(q0>0){const i=iq[jz-1]>>(24-q0);n+=i;iq[jz-1]-=i<<(24-q0);ih=iq[jz-1]>>(23-q0);}else if(q0===0)ih=iq[jz-1]>>23;else if(z>=.5)ih=2;
    if(ih>0){n++;let carry=0;for(let i=0;i<jz;i++){const j=iq[i];if(carry===0){if(j!==0){carry=1;iq[i]=0x1000000-j;}}else iq[i]=0xffffff-j;}
      if(q0===1)iq[jz-1]&=0x7fffff;else if(q0===2)iq[jz-1]&=0x3fffff;
      if(ih===2){z=1-z;if(carry!==0)z-=2**q0;}
    }
    if(z===0){let j=0;for(let i=jz-1;i>=jk;i--)j|=iq[i];if(j===0){let k=1;while(jk>=k&&iq[jk-k]===0)k++;
      if(jz+k>=20||jx+jz+k>=20||jv+jz+k>=TWO_OVER_PI.length)return null;
      for(let i=jz+1;i<=jz+k;i++){f[jx+i]=TWO_OVER_PI[jv+i];let fw=0;for(let j=0;j<=jx;j++)fw+=tx[j]*f[jx+i-j];q[i]=fw;}jz+=k;continue;
    }}break;
  }
  if(z===0){jz--;q0-=24;while(jz>=0&&iq[jz]===0){jz--;q0-=24;}if(jz<0)return null;}
  else {z*=2**(-q0);if(z>=16777216){const fw=Math.trunc(5.9604644775390625e-8*z);iq[jz]=Math.trunc(z-16777216*fw);jz++;q0+=24;if(jz>=20)return null;iq[jz]=fw;}else iq[jz]=Math.trunc(z);}
  let fw=2**q0;for(let i=jz;i>=0;i--){q[i]=fw*iq[i];fw*=5.9604644775390625e-8;}
  for(let i=jz;i>=0;i--){fw=0;for(let k=0;k<=jp&&k<=jz-i;k++)fw+=PI2_CHUNKS[k]*q[i+k];fq[jz-i]=fw;}
  fw=0;for(let i=jz;i>=0;i--)fw+=fq[i];const y0=ih===0?fw:-fw;fw=fq[0]-fw;for(let i=1;i<=jz;i++)fw+=fq[i];const y1=ih===0?fw:-fw;
  return bits[1]&0x80000000?{x:-y0,y:-y1,n:-(n&7)}:{x:y0,y:y1,n:n&7};
}
function kernelSin(x,y,tail) {
  if((high(x)&0x7fffffff)<0x3e400000)return x;
  const z=x*x,v=z*x,r=S[1]+z*(S[2]+z*(S[3]+z*(S[4]+z*S[5])));
  return tail?x-((z*(.5*y-v*r)-y)-v*S[0]):x+v*(S[0]+z*r);
}
function kernelCos(x,y) {
  const ix=high(x)&0x7fffffff;if(ix<0x3e400000)return 1;
  const z=x*x,r=z*(C[0]+z*(C[1]+z*(C[2]+z*(C[3]+z*(C[4]+z*C[5])))));
  if(ix<0x3fd33333)return 1-(.5*z-(z*r-x*y));
  const qx=ix>0x3fe90000?.28125:fromHigh(ix-0x00200000),iz=.5*z-qx,a=1-qx;
  return a-(iz-(z*r-x*y));
}
function reducePi2(x) {
  const hx=high(x),ix=hx&0x7fffffff;
  if(ix<=0x3fe921fb)return {x,y:0,n:0};
  if(ix<0x4002d97c) {
    if(!(hx&0x80000000)) {
      let z=x-PI2[0];if(ix!==0x3ff921fb){const y=z-PI2[1];return{x:y,y:(z-y)-PI2[1],n:1};}
      z-=PI2[2];const y=z-PI2[3];return{x:y,y:(z-y)-PI2[3],n:1};
    }
    let z=x+PI2[0];if(ix!==0x3ff921fb){const y=z+PI2[1];return{x:y,y:(z-y)+PI2[1],n:-1};}
    z+=PI2[2];const y=z+PI2[3];return{x:y,y:(z-y)+PI2[3],n:-1};
  }
  if(ix>0x413921fb)return reduceLargePi2(x);
  let t=Math.abs(x),n=Math.trunc(t*6.36619772367581382433e-1+.5),r=t-n*PI2[0],w=n*PI2[1],y=r-w;
  if(!(n<32&&ix!==NPIO2_HIGH[n-1])) {
    const j=ix>>>20;let i=j-((high(y)>>>20)&2047);
    if(i>16){t=r;w=n*PI2[2];r=t-w;w=n*PI2[3]-((t-r)-w);y=r-w;i=j-((high(y)>>>20)&2047);
      if(i>49){t=r;w=n*PI2[4];r=t-w;w=n*PI2[5]-((t-r)-w);y=r-w;}
    }
  }
  const tail=(r-y)-w;return hx&0x80000000?{x:-y,y:-tail,n:-n}:{x:y,y:tail,n};
}
/** Test-only host realization of the pinned polynomial algorithm, NOT Math.sin
 * or Math.cos. Includes source large-argument reduction, never native f32 trig.
 */
export function pinnedSinCosReference(x) {
  const r=reducePi2(x);if(!r)return null;
  const s=kernelSin(r.x,r.y,(high(x)&0x7fffffff)>0x3fe921fb),c=kernelCos(r.x,r.y);
  switch(r.n&3){case 0:return{sin:s,cos:c};case 1:return{sin:c,cos:-s};case 2:return{sin:-s,cos:-c};default:return{sin:-c,cos:s};}
}
export function pinnedHypot2Reference(a,b) {
  a=Math.abs(a);b=Math.abs(b);if(a===Infinity||b===Infinity)return Infinity;
  const m=Math.max(a,b);if(Number.isNaN(m)||!m)return m;
  return Math.sqrt((a/m)*(a/m)+(b/m)*(b/m))*m;
}
export function pinnedHypot3Reference(a,b,c) {
  a=Math.abs(a);b=Math.abs(b);c=Math.abs(c);if(a===Infinity||b===Infinity||c===Infinity)return Infinity;
  const m=Math.max(Math.max(a,b),c);if(Number.isNaN(m)||!m)return m;
  const pa=(a/m)*(a/m),pb=(b/m)*(b/m),compensation=(pa+pb)-pa-pb,pc=(c/m)*(c/m)-compensation;
  return Math.sqrt(pa+pb+pc)*m;
}
const va=(a,b)=>a.map((x,i)=>x+b[i]),vm=(a,s)=>a.map(x=>x*s),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function rawStrikePoseReference(settings,center,{radius=.03075,tipRadius=.006,retract=.012,cueLength=1.35}={}) {
  const keys=['angle','elevation','speed','tipX','tipY'];
  if(!keys.every(k=>Number.isFinite(settings?.[k])))return {status:'rejected',reason:'nonfinite-input'};
  const {angle,elevation,speed,tipX,tipY}=settings;
  if(pinnedHypot2Reference(tipX,tipY)>=1||speed<=0||speed>10||elevation<0||elevation>85)return{status:'rejected',reason:'source-input-range'};
  if(!Array.isArray(center)||center.length!==3||!center.every(Number.isFinite))throw new TypeError('Finite original ball center required');
  const a=angle*Math.PI/180,e=elevation*Math.PI/180,ay=pinnedSinCosReference(a),el=pinnedSinCosReference(e);
  if(!ay||!el)return {status:'unsupported',reason:'nonfinite-derived-angle-or-reduction-capacity'};
  const direction=[ay.cos*el.cos,-el.sin,ay.sin*el.cos],side=[-ay.sin,0,ay.cos],up=cross(side,direction);
  const surface=va(va(vm(side,tipX),vm(up,tipY)),vm(direction,-Math.sqrt(Math.max(.0001,1-tipX*tipX-tipY*tipY))));
  const contact=va(center,vm(surface,radius)),tip=va(va(center,vm(surface,radius+tipRadius)),vm(direction,-retract));
  const normalized=vm(direction,1/(pinnedHypot3Reference(...direction)||1)),scale=Math.sqrt((1+normalized[1])*2);
  const rotation=normalized[1]<-.999999?[1,0,0,0]:[normalized[2]/scale,0,-normalized[0]/scale,scale/2];
  const linear=vm(direction,speed),shaftCenter=va(tip,vm(direction,-(tipRadius+cueLength/2)));
  return {status:'pose-ready',direction,side,up,surface,contact,tip,rotation,linear,shaftCenter,
    native:{translation:tip.map(Math.fround),rotation:rotation.map(Math.fround),linear:linear.map(Math.fround)},
    clearanceRequired:true,allocationRequired:true};
}

/** Numerical part of physics.js:110-120 at pull=0. This only prepares query
 * geometry. No separation shortcut: all 3 sampled contacts AND continuous cast
 * must complete before the caller may commit creation descriptors. */
export function rawStrikeClearanceGeometryReference(settings,center) {
 const pose=rawStrikePoseReference(settings,center);if(pose.status!=='pose-ready')return pose;
 const travel=.012,velocity=vm(pose.direction,travel),rear=1.35-.12;
 const sub=(a,b)=>a.map((x,i)=>x-b[i]);
 const parts=[{kind:'shaft',shape:'cylinder',halfHeight:rear/2,radius:.011,center:sub(pose.tip,vm(pose.direction,.006+.12+rear/2))},
  {kind:'neck',shape:'cylinder',halfHeight:.12/2,radius:.0058,center:sub(pose.tip,vm(pose.direction,.006+.12/2))},
  {kind:'tip',shape:'sphere',halfHeight:0,radius:.006,center:pose.tip.slice()}];
 return {status:'clearance-geometry-ready',travel,velocity,rotation:pose.rotation.slice(),parts:parts.map(part=>({...part,
  samples:[0,.5,1].map(fraction=>va(part.center,vm(velocity,fraction))),prediction:.1,maxTime:1,targetDistance:0,stopAtPenetration:true})),
  selectedExemption:{part:'tip',object:'selected-only'},sampledContactsRequired:true,continuousCastRequired:true};
}

export function generatePinnedMathWGSL() { return MATH_LICENSE+/* wgsl */ `
struct RcReducedAngle { head:RcF64, tail:RcF64, quadrant:i32, valid:bool }
struct RcSinCos { sine:RcF64, cosine:RcF64, valid:bool }
const RC_NPIO2_HIGH:array<u32,32> = array<u32,32>(${NPIO2_HIGH.map(x=>'0x'+x.toString(16)+'u').join(',')});
fn rc_f64_trunc_positive_u32(a:RcF64)->u32 {
 let d=rc_f64_decode(a);if(d.zero || d.exponent<0){return 0u;}
 if(d.exponent>31 || d.sign!=0u || d.special!=0u){return 0xffffffffu;}
 return rc_u128_shr(d.m,u32(52-d.exponent)).x;
}
const RC_TWO_OVER_PI:array<u32,66> = array<u32,66>(${TWO_OVER_PI.map(x=>'0x'+x.toString(16)+'u').join(',')});
const RC_PI2_CHUNKS:array<RcF64,8> = array<RcF64,8>(${PI2_CHUNKS.map(F).join(',')});
fn rc_f64_scalbn(a:RcF64,n:i32)->RcF64 {let d=rc_f64_decode(a);if(d.special!=0u||d.zero){return a;}return rc_f64_pack(d.m,d.exponent-52+n,d.sign);}
fn rc_f64_trunc_positive(a:RcF64)->RcF64 {let d=rc_f64_decode(a);if(d.zero||d.exponent<0){return ${F(0)};}if(d.exponent>=52){return a;}return rc_f64_pack(rc_u128_shr(d.m,u32(52-d.exponent)),0,0u);}
fn rc_f64_reduce_large_pi2(x:RcF64)->RcReducedAngle {
 let ix=x.y&0x7fffffffu;if(ix>=0x7ff00000u){return RcReducedAngle(rc_f64_nan(),rc_f64_nan(),0,false);}
 let e0=i32(ix>>20u)-1046;var tx:array<RcF64,3>;var f:array<RcF64,20>;var q:array<RcF64,20>;var fq:array<RcF64,20>;var iq:array<u32,20>;
 var z=RcF64(x.x,ix-(u32(e0)<<20u));
 for(var i=0;i<2;i++){tx[i]=rc_f64_from_u32(rc_f64_trunc_positive_u32(z));z=rc_f64_mul(rc_f64_sub(z,tx[i]),${F(16777216)});}tx[2]=z;
 var nx=3;loop {if(nx<=0){return RcReducedAngle(rc_f64_nan(),rc_f64_nan(),0,false);}if(!rc_f64_zero(tx[nx-1])){break;}nx--;}
 let jk=4;let jp=jk;let jx=nx-1;let jv=max(0,(e0-3)/24);var q0=e0-24*(jv+1);
 for(var i=0;i<=jx+jk;i++){let j=jv-jx+i;if(j<0){f[i]=${F(0)};}else{f[i]=rc_f64_from_u32(RC_TWO_OVER_PI[j]);}}
 for(var i=0;i<=jk;i++){var fw=${F(0)};for(var j=0;j<=jx;j++){fw=rc_f64_add(fw,rc_f64_mul(tx[j],f[jx+i-j]));}q[i]=fw;}
 var jz=jk;var n=0u;var ih=0u;
 loop {
  z=q[jz];for(var i=0;i<jz;i++){let j=jz-i;let fw=rc_f64_from_u32(rc_f64_trunc_positive_u32(rc_f64_mul(${F(5.9604644775390625e-8)},z)));iq[i]=rc_f64_trunc_positive_u32(rc_f64_sub(z,rc_f64_mul(${F(16777216)},fw)));z=rc_f64_add(q[j-1],fw);}
  z=rc_f64_scalbn(z,q0);z=rc_f64_sub(z,rc_f64_mul(${F(8)},rc_f64_trunc_positive(rc_f64_mul(z,${F(.125)}))));n=rc_f64_trunc_positive_u32(z);z=rc_f64_sub(z,rc_f64_from_u32(n));ih=0u;
  if(q0>0){let i=iq[jz-1]>>u32(24-q0);n+=i;iq[jz-1]-=i<<u32(24-q0);ih=iq[jz-1]>>u32(23-q0);}else if(q0==0){ih=iq[jz-1]>>23u;}else if(rc_f64_le(${F(.5)},z)){ih=2u;}
  if(ih>0u){n++;var carry=0u;for(var i=0;i<jz;i++){let j=iq[i];if(carry==0u){if(j!=0u){carry=1u;iq[i]=0x1000000u-j;}}else{iq[i]=0xffffffu-j;}}
   if(q0==1){iq[jz-1]&=0x7fffffu;}else if(q0==2){iq[jz-1]&=0x3fffffu;}
   if(ih==2u){z=rc_f64_sub(${F(1)},z);if(carry!=0u){z=rc_f64_sub(z,rc_f64_scalbn(${F(1)},q0));}}
  }
  if(rc_f64_zero(z)){var j=0u;for(var i=jz-1;i>=jk;i--){j|=iq[i];}if(j==0u){var k=1;loop{if(k>jk){break;}if(iq[jk-k]!=0u){break;}k++;}
   if(jz+k>=20||jx+jz+k>=20||jv+jz+k>=66){return RcReducedAngle(rc_f64_nan(),rc_f64_nan(),0,false);}
   for(var i=jz+1;i<=jz+k;i++){f[jx+i]=rc_f64_from_u32(RC_TWO_OVER_PI[jv+i]);var fw=${F(0)};for(var m=0;m<=jx;m++){fw=rc_f64_add(fw,rc_f64_mul(tx[m],f[jx+i-m]));}q[i]=fw;}jz+=k;continue;
  }}break;
 }
 if(rc_f64_zero(z)){jz--;q0-=24;loop{if(jz<0){return RcReducedAngle(rc_f64_nan(),rc_f64_nan(),0,false);}if(iq[jz]!=0u){break;}jz--;q0-=24;}}
 else{z=rc_f64_scalbn(z,-q0);if(rc_f64_le(${F(16777216)},z)){let fw=rc_f64_from_u32(rc_f64_trunc_positive_u32(rc_f64_mul(${F(5.9604644775390625e-8)},z)));iq[jz]=rc_f64_trunc_positive_u32(rc_f64_sub(z,rc_f64_mul(${F(16777216)},fw)));jz++;q0+=24;if(jz>=20){return RcReducedAngle(rc_f64_nan(),rc_f64_nan(),0,false);}iq[jz]=rc_f64_trunc_positive_u32(fw);}else{iq[jz]=rc_f64_trunc_positive_u32(z);}}
 var fw=rc_f64_scalbn(${F(1)},q0);for(var i=jz;i>=0;i--){q[i]=rc_f64_mul(fw,rc_f64_from_u32(iq[i]));fw=rc_f64_mul(fw,${F(5.9604644775390625e-8)});}
 for(var i=jz;i>=0;i--){fw=${F(0)};for(var k=0;k<=jp&&k<=jz-i;k++){fw=rc_f64_add(fw,rc_f64_mul(RC_PI2_CHUNKS[k],q[i+k]));}fq[jz-i]=fw;}
 fw=${F(0)};for(var i=jz;i>=0;i--){fw=rc_f64_add(fw,fq[i]);}var y0=fw;if(ih!=0u){y0=rc_f64_neg(y0);}fw=rc_f64_sub(fq[0],fw);for(var i=1;i<=jz;i++){fw=rc_f64_add(fw,fq[i]);}var y1=fw;if(ih!=0u){y1=rc_f64_neg(y1);}
 if((x.y&0x80000000u)!=0u){return RcReducedAngle(rc_f64_neg(y0),rc_f64_neg(y1),-i32(n&7u),true);}return RcReducedAngle(y0,y1,i32(n&7u),true);
}
fn rc_f64_kernel_sin(x:RcF64,y:RcF64,tail:bool)->RcF64 {
 if((x.y&0x7fffffffu)<0x3e400000u){return x;}
 let z=rc_f64_mul(x,x);let v=rc_f64_mul(z,x);
 var r=rc_f64_add(${F(S[4])},rc_f64_mul(z,${F(S[5])}));
 r=rc_f64_add(${F(S[3])},rc_f64_mul(z,r));r=rc_f64_add(${F(S[2])},rc_f64_mul(z,r));r=rc_f64_add(${F(S[1])},rc_f64_mul(z,r));
 if(!tail){return rc_f64_add(x,rc_f64_mul(v,rc_f64_add(${F(S[0])},rc_f64_mul(z,r))));}
 return rc_f64_sub(x,rc_f64_sub(rc_f64_sub(rc_f64_mul(z,rc_f64_sub(rc_f64_mul(${F(.5)},y),rc_f64_mul(v,r))),y),rc_f64_mul(v,${F(S[0])})));
}
fn rc_f64_kernel_cos(x:RcF64,y:RcF64)->RcF64 {
 let ix=x.y&0x7fffffffu;if(ix<0x3e400000u){return ${F(1)};}
 let z=rc_f64_mul(x,x);var r=rc_f64_add(${F(C[4])},rc_f64_mul(z,${F(C[5])}));
 r=rc_f64_add(${F(C[3])},rc_f64_mul(z,r));r=rc_f64_add(${F(C[2])},rc_f64_mul(z,r));r=rc_f64_add(${F(C[1])},rc_f64_mul(z,r));r=rc_f64_mul(z,rc_f64_add(${F(C[0])},rc_f64_mul(z,r)));
 let correction=rc_f64_sub(rc_f64_mul(z,r),rc_f64_mul(x,y));let halfZ=rc_f64_mul(${F(.5)},z);
 if(ix<0x3fd33333u){return rc_f64_sub(${F(1)},rc_f64_sub(halfZ,correction));}
 var qx=RcF64(0u,ix-0x200000u);if(ix>0x3fe90000u){qx=${F(.28125)};}
 return rc_f64_sub(rc_f64_sub(${F(1)},qx),rc_f64_sub(rc_f64_sub(halfZ,qx),correction));
}
fn rc_f64_reduce_pi2(x:RcF64)->RcReducedAngle {
 let ix=x.y&0x7fffffffu;let negative=(x.y&0x80000000u)!=0u;
 if(ix<=0x3fe921fbu){return RcReducedAngle(x,${F(0)},0,true);}
 if(ix<0x4002d97cu){
  if(!negative){var z=rc_f64_sub(x,${F(PI2[0])});var tail=${F(PI2[1])};if(ix==0x3ff921fbu){z=rc_f64_sub(z,${F(PI2[2])});tail=${F(PI2[3])};}let y=rc_f64_sub(z,tail);return RcReducedAngle(y,rc_f64_sub(rc_f64_sub(z,y),tail),1,true);}
  var z=rc_f64_add(x,${F(PI2[0])});var tail=${F(PI2[1])};if(ix==0x3ff921fbu){z=rc_f64_add(z,${F(PI2[2])});tail=${F(PI2[3])};}let y=rc_f64_add(z,tail);return RcReducedAngle(y,rc_f64_add(rc_f64_sub(z,y),tail),-1,true);
 }
 if(ix>0x413921fbu){return rc_f64_reduce_large_pi2(x);}
 var t=rc_f64_abs(x);let n=rc_f64_trunc_positive_u32(rc_f64_add(rc_f64_mul(t,${F(6.36619772367581382433e-1)}),${F(.5)}));let n64=rc_f64_from_u32(n);
 var r=rc_f64_sub(t,rc_f64_mul(n64,${F(PI2[0])}));var w=rc_f64_mul(n64,${F(PI2[1])});var y=rc_f64_sub(r,w);
 var quick=false;if(n<32u){quick=ix!=RC_NPIO2_HIGH[n-1u];}
 if(!quick){let j=i32(ix>>20u);var difference=j-i32((y.y>>20u)&2047u);
  if(difference>16){t=r;w=rc_f64_mul(n64,${F(PI2[2])});r=rc_f64_sub(t,w);w=rc_f64_sub(rc_f64_mul(n64,${F(PI2[3])}),rc_f64_sub(rc_f64_sub(t,r),w));y=rc_f64_sub(r,w);difference=j-i32((y.y>>20u)&2047u);
   if(difference>49){t=r;w=rc_f64_mul(n64,${F(PI2[4])});r=rc_f64_sub(t,w);w=rc_f64_sub(rc_f64_mul(n64,${F(PI2[5])}),rc_f64_sub(rc_f64_sub(t,r),w));y=rc_f64_sub(r,w);}
  }
 }
 let tail=rc_f64_sub(rc_f64_sub(r,y),w);if(negative){return RcReducedAngle(rc_f64_neg(y),rc_f64_neg(tail),-i32(n),true);}return RcReducedAngle(y,tail,i32(n),true);
}
fn rc_f64_pinned_sincos(x:RcF64)->RcSinCos {
 let reduced=rc_f64_reduce_pi2(x);if(!reduced.valid){return RcSinCos(rc_f64_nan(),rc_f64_nan(),false);}
 let sine=rc_f64_kernel_sin(reduced.head,reduced.tail,(x.y&0x7fffffffu)>0x3fe921fbu);let cosine=rc_f64_kernel_cos(reduced.head,reduced.tail);
 switch(u32(reduced.quadrant)&3u){case 0u:{return RcSinCos(sine,cosine,true);}case 1u:{return RcSinCos(cosine,rc_f64_neg(sine),true);}case 2u:{return RcSinCos(rc_f64_neg(sine),rc_f64_neg(cosine),true);}default:{return RcSinCos(rc_f64_neg(cosine),sine,true);}}
}
fn rc_f64_pinned_hypot2(a:RcF64,b:RcF64)->RcF64 {
 let x=rc_f64_abs(a);let y=rc_f64_abs(b);
 if(all(x==${F(Infinity)}) || all(y==${F(Infinity)})){return ${F(Infinity)};}
 if(!rc_f64_finite(x)||!rc_f64_finite(y)){return rc_f64_nan();}
 let m=select(x,y,rc_f64_lt(x,y));if(rc_f64_zero(m)){return ${F(0)};}
 let sx=rc_f64_div(x,m);let sy=rc_f64_div(y,m);return rc_f64_mul(rc_f64_sqrt(rc_f64_add(rc_f64_mul(sx,sx),rc_f64_mul(sy,sy))),m);
}
fn rc_f64_pinned_hypot3(a:RcF64,b:RcF64,c:RcF64)->RcF64 {
 let x=rc_f64_abs(a);let y=rc_f64_abs(b);let z=rc_f64_abs(c);
 if(all(x==${F(Infinity)}) || all(y==${F(Infinity)}) || all(z==${F(Infinity)})){return ${F(Infinity)};}
 if(!rc_f64_finite(x)||!rc_f64_finite(y)||!rc_f64_finite(z)){return rc_f64_nan();}
 var m=select(x,y,rc_f64_lt(x,y));m=select(m,z,rc_f64_lt(m,z));if(rc_f64_zero(m)){return ${F(0)};}
 let sx=rc_f64_div(x,m);let sy=rc_f64_div(y,m);let sz=rc_f64_div(z,m);
 let pa=rc_f64_mul(sx,sx);let pb=rc_f64_mul(sy,sy);let ab=rc_f64_add(pa,pb);let compensation=rc_f64_sub(rc_f64_sub(ab,pa),pb);let pc=rc_f64_sub(rc_f64_mul(sz,sz),compensation);
 return rc_f64_mul(rc_f64_sqrt(rc_f64_add(ab,pc)),m);
}
`; }

export function generateRawStrikeWGSL({includeNumberLibrary=true,includeStorageAdapter=true}={}) {
 const zero=`RcVec3D(${F(0)},${F(0)},${F(0)})`;
 return (includeNumberLibrary?generateSourceNumberWGSL():'')+generatePinnedMathWGSL()+/* wgsl */ `
struct RcVec3D {x:RcF64,y:RcF64,z:RcF64}
struct RcQuatD {x:RcF64,y:RcF64,z:RcF64,w:RcF64}
struct RcClearancePart {kind:u32,halfHeight:RcF64,radius:RcF64,center:RcVec3D}
struct RcStrikeSettings {angle:RcF64,elevation:RcF64,speed:RcF64,tipX:RcF64,tipY:RcF64}
struct RcStrikePose {status:u32,reason:u32,direction:RcVec3D,side:RcVec3D,up:RcVec3D,surface:RcVec3D,contact:RcVec3D,tip:RcVec3D,rotation:RcQuatD,linear:RcVec3D,shaftCenter:RcVec3D}
fn rc_v3d_add(a:RcVec3D,b:RcVec3D)->RcVec3D{return RcVec3D(rc_f64_add(a.x,b.x),rc_f64_add(a.y,b.y),rc_f64_add(a.z,b.z));}
fn rc_v3d_sub(a:RcVec3D,b:RcVec3D)->RcVec3D{return RcVec3D(rc_f64_sub(a.x,b.x),rc_f64_sub(a.y,b.y),rc_f64_sub(a.z,b.z));}
fn rc_v3d_mul(a:RcVec3D,s:RcF64)->RcVec3D{return RcVec3D(rc_f64_mul(a.x,s),rc_f64_mul(a.y,s),rc_f64_mul(a.z,s));}
fn rc_v3d_cross(a:RcVec3D,b:RcVec3D)->RcVec3D{return RcVec3D(rc_f64_sub(rc_f64_mul(a.y,b.z),rc_f64_mul(a.z,b.y)),rc_f64_sub(rc_f64_mul(a.z,b.x),rc_f64_mul(a.x,b.z)),rc_f64_sub(rc_f64_mul(a.x,b.y),rc_f64_mul(a.y,b.x)));}
fn rc_raw_empty(status:u32,reason:u32)->RcStrikePose {let z=${zero};return RcStrikePose(status,reason,z,z,z,z,z,z,RcQuatD(${F(0)},${F(0)},${F(0)},${F(0)}),z,z);}
fn rc_raw_strike_pose(s:RcStrikeSettings,center:RcVec3D)->RcStrikePose {
 if(!rc_f64_finite(s.angle)||!rc_f64_finite(s.elevation)||!rc_f64_finite(s.speed)||!rc_f64_finite(s.tipX)||!rc_f64_finite(s.tipY)){return rc_raw_empty(8u,1u);}
 if(!rc_f64_lt(rc_f64_pinned_hypot2(s.tipX,s.tipY),${F(1)})||!rc_f64_lt(${F(0)},s.speed)||rc_f64_lt(${F(10)},s.speed)||rc_f64_lt(s.elevation,${F(0)})||rc_f64_lt(${F(85)},s.elevation)){return rc_raw_empty(8u,2u);}
 let a=rc_f64_div(rc_f64_mul(s.angle,${F(Math.PI)}),${F(180)});let e=rc_f64_div(rc_f64_mul(s.elevation,${F(Math.PI)}),${F(180)});let az=rc_f64_pinned_sincos(a);let el=rc_f64_pinned_sincos(e);
 if(!az.valid||!el.valid){return rc_raw_empty(4u,6u);}
 let direction=RcVec3D(rc_f64_mul(az.cosine,el.cosine),rc_f64_neg(el.sine),rc_f64_mul(az.sine,el.cosine));let side=RcVec3D(rc_f64_neg(az.sine),${F(0)},az.cosine);let up=rc_v3d_cross(side,direction);
 let disk=rc_f64_sub(rc_f64_sub(${F(1)},rc_f64_mul(s.tipX,s.tipX)),rc_f64_mul(s.tipY,s.tipY));let safe=select(disk,${F(.0001)},rc_f64_lt(disk,${F(.0001)}));let rear=rc_f64_neg(rc_f64_sqrt(safe));
 let surface=rc_v3d_add(rc_v3d_add(rc_v3d_mul(side,s.tipX),rc_v3d_mul(up,s.tipY)),rc_v3d_mul(direction,rear));let contact=rc_v3d_add(center,rc_v3d_mul(surface,${F(.03075)}));
 let tip=rc_v3d_add(rc_v3d_add(center,rc_v3d_mul(surface,${F(.03075+.006)})),rc_v3d_mul(direction,${F(-.012)}));
 let length=rc_f64_pinned_hypot3(direction.x,direction.y,direction.z);let divisor=select(length,${F(1)},rc_f64_zero(length));let normalized=rc_v3d_mul(direction,rc_f64_div(${F(1)},divisor));
 let scale=rc_f64_sqrt(rc_f64_mul(rc_f64_add(${F(1)},normalized.y),${F(2)}));var rotation=RcQuatD(${F(1)},${F(0)},${F(0)},${F(0)});
 if(!rc_f64_lt(normalized.y,${F(-.999999)})){rotation=RcQuatD(rc_f64_div(normalized.z,scale),${F(0)},rc_f64_div(rc_f64_neg(normalized.x),scale),rc_f64_div(scale,${F(2)}));}
 let linear=rc_v3d_mul(direction,s.speed);let shaftCenter=rc_v3d_sub(tip,rc_v3d_mul(direction,${F(.006+1.35/2)}));
 return RcStrikePose(1u,0u,direction,side,up,surface,contact,tip,rotation,linear,shaftCenter);
}
// Original cueClearance parts at pull=0, before native f32 conversion. The
// selected sphere exempts ONLY part 2. Never infer clear from these descriptors.
fn rc_raw_clearance_part(p:RcStrikePose,part:u32)->RcClearancePart {
 if(part==0u){return RcClearancePart(1u,${F((1.35-.12)/2)},${F(.011)},rc_v3d_sub(p.tip,rc_v3d_mul(p.direction,${F(.006+.12+(1.35-.12)/2)})));}
 if(part==1u){return RcClearancePart(1u,${F(.12/2)},${F(.0058)},rc_v3d_sub(p.tip,rc_v3d_mul(p.direction,${F(.006+.12/2)})));}
 return RcClearancePart(0u,${F(0)},${F(.006)},p.tip);
}
fn rc_raw_clearance_velocity(p:RcStrikePose)->RcVec3D{return rc_v3d_mul(p.direction,${F(.012)});}
fn rc_raw_clearance_sample(p:RcStrikePose,part:u32,sample:u32)->RcVec3D {
 var fraction=${F(0)};if(sample==1u){fraction=${F(.5)};}else if(sample==2u){fraction=${F(1)};}
 return rc_v3d_add(rc_raw_clearance_part(p,part).center,rc_v3d_mul(rc_raw_clearance_velocity(p),fraction));
}
`+(includeStorageAdapter?/* wgsl */ `
// Caller supplies rc_inputs and rc_state storage arrays. Output is a staging
// pose only: do not commit cue allocation before original swept clearance.
fn rc_raw_settings(base:u32)->RcStrikeSettings {
 return RcStrikeSettings(RcF64(rc_inputs[base+2u],rc_inputs[base+3u]),RcF64(rc_inputs[base+4u],rc_inputs[base+5u]),RcF64(rc_inputs[base+6u],rc_inputs[base+7u]),RcF64(rc_inputs[base+8u],rc_inputs[base+9u]),RcF64(rc_inputs[base+10u],rc_inputs[base+11u]));
}
fn rc_raw_store64(base:u32,value:RcF64){rc_state[base]=value.x;rc_state[base+1u]=value.y;}
fn rc_raw_store3(base:u32,value:RcVec3D){rc_raw_store64(base,value.x);rc_raw_store64(base+2u,value.y);rc_raw_store64(base+4u,value.z);}
fn rc_raw_write_pose(base:u32,p:RcStrikePose){
 for(var i=0u;i<64u;i++){rc_state[base+i]=0u;}rc_state[base]=p.status;rc_state[base+1u]=p.reason;
 rc_raw_store3(base+2u,p.direction);rc_raw_store3(base+8u,p.side);rc_raw_store3(base+14u,p.up);rc_raw_store3(base+20u,p.surface);rc_raw_store3(base+26u,p.contact);rc_raw_store3(base+32u,p.tip);
 rc_raw_store64(base+38u,p.rotation.x);rc_raw_store64(base+40u,p.rotation.y);rc_raw_store64(base+42u,p.rotation.z);rc_raw_store64(base+44u,p.rotation.w);rc_raw_store3(base+46u,p.linear);rc_raw_store3(base+52u,p.shaftCenter);
}
`: '');
}

// Compact initialization bytecode avoids compiler-expanding hundreds of nested
// software-binary64 calls. This is initialization transport, not a graph VM for
// world stepping. Every operation and branch remains in pinned source order.
const RAW_OP=Object.freeze({copy:0,add:1,sub:2,mul:3,div:4,sqrt:5,neg:6,abs:7,lt:8,le:9,eq:10,finite:11,zero:12,high:13,and:14,or:15,shl:16,shr:17,trunc:18,scalbn:19,replaceHigh:20,load:21,store:22,jump:23,jz:24,call:25,ret:26,halt:27,fround:28});
class RawBuilder {
 constructor(){this.code=[];this.constants=[];this.constantMap=new Map();this.regs=0;this.functions=new Map();this.maxCallDepth=8;}
 alloc(n=1){const at=this.regs;this.regs+=n;return at;}
 c(x){const bits=numberWords(x),key=bits.join(',');if(this.constantMap.has(key))return this.constantMap.get(key);const r=this.alloc();this.constants.push([r,...bits]);this.constantMap.set(key,r);return r;}
 emit(op,d=0,a=0,b=0){if(!Object.hasOwn(RAW_OP,op))throw new RangeError('Unknown source opcode '+op);const at=this.code.length;this.code.push([RAW_OP[op],d,a,b]);return at;}
 patch(at,target){this.code[at][1]=target;}
 op(name,a,b=0){const r=this.alloc();this.emit(name,r,a,b);return r;}
 set(r,x){this.emit('copy',r,x);return r;}
 variable(x){return this.set(this.alloc(),x);}
 branch(condition,yes,no=()=>{}){const z=this.emit('jz',0,condition);yes();const end=this.emit('jump');this.patch(z,this.code.length);no();this.patch(end,this.code.length);}
 loop(condition,body){const begin=this.code.length,done=this.emit('jz',0,condition());body();this.emit('jump',begin);this.patch(done,this.code.length);}
 define(name,count,resultCount,body){const f={entry:this.code.length,args:Array.from({length:count},()=>this.alloc()),results:Array.from({length:resultCount},()=>this.alloc())};this.functions.set(name,f);body(f.args,f.results);this.emit('ret');return f;}
 call(name,args){const f=this.functions.get(name);if(!f||args.length!==f.args.length)throw Error('Invalid initialization function '+name);args.forEach((r,i)=>this.set(f.args[i],r));this.emit('call',f.entry);return f.results.map(r=>this.variable(r));}
 at(base,index){const r=this.alloc();this.emit('load',r,base,index);return r;}
 put(base,index,value){this.emit('store',base,index,value);}
}
const rawPrograms=new Map();
/** Source-ordered, device-resident raw initializer. Common program/constants are
 * candidate-independent. Raw inputs retain the exact ABI binary64 words. */
export function compileRawStrikeProgram({clearanceGeometry=false}={}){
 if(rawPrograms.has(clearanceGeometry))return rawPrograms.get(clearanceGeometry);
 const b=new RawBuilder(),jumpMain=b.emit('jump');
 const c=x=>b.c(x),op=(name,a,z)=>b.op(name,a,z),add=(a,z)=>op('add',a,z),sub=(a,z)=>op('sub',a,z),mul=(a,z)=>op('mul',a,z),div=(a,z)=>op('div',a,z),neg=a=>op('neg',a),abs=a=>op('abs',a),sqrt=a=>op('sqrt',a),lt=(a,z)=>op('lt',a,z),le=(a,z)=>op('le',a,z),eq=(a,z)=>op('eq',a,z),band=(a,z)=>op('and',a,z),shr=(a,z)=>op('shr',a,z),shl=(a,z)=>op('shl',a,z),trunc=a=>op('trunc',a),high=a=>op('high',a),scale=(a,n)=>op('scalbn',a,n),nz=a=>eq(op('zero',a),c(0)),choose=(condition,yes,no)=>{const r=b.alloc();b.branch(condition,()=>b.set(r,yes()),()=>b.set(r,no()));return r;};
 const ret=(out,values)=>{values.forEach((v,i)=>b.set(out[i],v));b.emit('ret');};
 const boundedArray=(values)=>{const base=b.alloc(values.length);values.forEach((x,i)=>b.constants.push([base+i,...numberWords(x)]));return base;};
 const piTable=boundedArray(TWO_OVER_PI),piChunks=boundedArray(PI2_CHUNKS),npio=boundedArray(NPIO2_HIGH);
 b.define('kernelSin',3,1,([x,y,tail],out)=>{
  b.branch(lt(band(high(x),c(0x7fffffff)),c(0x3e400000)),()=>ret(out,[x]));
  const z=mul(x,x),v=mul(z,x),r=add(c(S[1]),mul(z,add(c(S[2]),mul(z,add(c(S[3]),mul(z,add(c(S[4]),mul(z,c(S[5])))))))));
  b.branch(tail,()=>ret(out,[sub(x,sub(sub(mul(z,sub(mul(c(.5),y),mul(v,r))),y),mul(v,c(S[0]))))]),()=>ret(out,[add(x,mul(v,add(c(S[0]),mul(z,r))))]));
 });
 b.define('kernelCos',2,1,([x,y],out)=>{
  const ix=band(high(x),c(0x7fffffff));b.branch(lt(ix,c(0x3e400000)),()=>ret(out,[c(1)]));
  const z=mul(x,x),r=mul(z,add(c(C[0]),mul(z,add(c(C[1]),mul(z,add(c(C[2]),mul(z,add(c(C[3]),mul(z,add(c(C[4]),mul(z,c(C[5]))))))))))));
  const correction=sub(mul(z,r),mul(x,y)),half=mul(c(.5),z);
  b.branch(lt(ix,c(0x3fd33333)),()=>ret(out,[sub(c(1),sub(half,correction))]));
  const qx=choose(lt(c(0x3fe90000),ix),()=>c(.28125),()=>op('replaceHigh',c(0),sub(ix,c(0x200000))));ret(out,[sub(sub(c(1),qx),sub(sub(half,qx),correction))]);
 });
 b.define('largeReduce',1,4,([x],out)=>{
  const hx=high(x),ix=band(hx,c(0x7fffffff));b.branch(le(c(0x7ff00000),ix),()=>ret(out,[c(NaN),c(NaN),c(0),c(0)]));
  const e0=sub(shr(ix,c(20)),c(1046)),tx=b.alloc(3),f=b.alloc(20),q=b.alloc(20),fq=b.alloc(20),iq=b.alloc(20);
  const z=b.variable(op('replaceHigh',x,sub(ix,shl(e0,c(20))))),i=b.variable(c(0)),j=b.alloc(),k=b.alloc(),fw=b.alloc();
  b.loop(()=>lt(i,c(2)),()=>{b.put(tx,i,trunc(z));b.set(z,mul(sub(z,b.at(tx,i)),c(16777216)));b.set(i,add(i,c(1)));});b.put(tx,c(2),z);
  const nx=b.variable(c(3));b.loop(()=>op('zero',b.at(tx,sub(nx,c(1)))),()=>b.set(nx,sub(nx,c(1))));
  const jx=sub(nx,c(1)),jv=choose(lt(trunc(div(sub(e0,c(3)),c(24))),c(0)),()=>c(0),()=>trunc(div(sub(e0,c(3)),c(24)))),q0=b.variable(sub(e0,mul(c(24),add(jv,c(1)))));
  b.set(i,c(0));b.loop(()=>le(i,add(jx,c(4))),()=>{b.set(j,add(sub(jv,jx),i));b.put(f,i,choose(lt(j,c(0)),()=>c(0),()=>b.at(piTable,j)));b.set(i,add(i,c(1)));});
  b.set(i,c(0));b.loop(()=>le(i,c(4)),()=>{b.set(fw,c(0));b.set(j,c(0));b.loop(()=>le(j,jx),()=>{b.set(fw,add(fw,mul(b.at(tx,j),b.at(f,sub(add(jx,i),j)))));b.set(j,add(j,c(1)));});b.put(q,i,fw);b.set(i,add(i,c(1)));});
  const jz=b.variable(c(4)),n=b.alloc(),ih=b.alloc(),carry=b.alloc(),recompute=b.variable(c(1));
  b.loop(()=>recompute,()=>{
   b.set(recompute,c(0));b.set(z,b.at(q,jz));b.set(i,c(0));b.set(j,jz);
   b.loop(()=>lt(c(0),j),()=>{b.set(fw,trunc(mul(c(5.9604644775390625e-8),z)));b.put(iq,i,trunc(sub(z,mul(c(16777216),fw))));b.set(z,add(b.at(q,sub(j,c(1))),fw));b.set(i,add(i,c(1)));b.set(j,sub(j,c(1)));});
   b.set(z,scale(z,q0));b.set(z,sub(z,mul(c(8),trunc(mul(z,c(.125))))));b.set(n,trunc(z));b.set(z,sub(z,n));b.set(ih,c(0));
   b.branch(lt(c(0),q0),()=>{b.set(i,shr(b.at(iq,sub(jz,c(1))),sub(c(24),q0)));b.set(n,add(n,i));b.put(iq,sub(jz,c(1)),sub(b.at(iq,sub(jz,c(1))),shl(i,sub(c(24),q0))));b.set(ih,shr(b.at(iq,sub(jz,c(1))),sub(c(23),q0)));},()=>b.branch(eq(q0,c(0)),()=>b.set(ih,shr(b.at(iq,sub(jz,c(1))),c(23))),()=>b.branch(le(c(.5),z),()=>b.set(ih,c(2)))));
   b.branch(lt(c(0),ih),()=>{
    b.set(n,add(n,c(1)));b.set(carry,c(0));b.set(i,c(0));b.loop(()=>lt(i,jz),()=>{b.set(j,b.at(iq,i));b.branch(eq(carry,c(0)),()=>b.branch(nz(j),()=>{b.set(carry,c(1));b.put(iq,i,sub(c(0x1000000),j));}),()=>b.put(iq,i,sub(c(0xffffff),j)));b.set(i,add(i,c(1)));});
    b.branch(eq(q0,c(1)),()=>b.put(iq,sub(jz,c(1)),band(b.at(iq,sub(jz,c(1))),c(0x7fffff))),()=>b.branch(eq(q0,c(2)),()=>b.put(iq,sub(jz,c(1)),band(b.at(iq,sub(jz,c(1))),c(0x3fffff)))));
    b.branch(eq(ih,c(2)),()=>{b.set(z,sub(c(1),z));b.branch(nz(carry),()=>b.set(z,sub(z,scale(c(1),q0))));});
   });
   b.branch(op('zero',z),()=>{
    b.set(j,c(0));b.set(i,sub(jz,c(1)));b.loop(()=>le(c(4),i),()=>{b.set(j,op('or',j,b.at(iq,i)));b.set(i,sub(i,c(1)));});
    b.branch(eq(j,c(0)),()=>{
     b.set(k,c(1));b.loop(()=>choose(le(k,c(4)),()=>op('zero',b.at(iq,sub(c(4),k))),()=>c(0)),()=>b.set(k,add(k,c(1))));
     for(const v of [add(jz,k),add(add(jx,jz),k)])b.branch(le(c(20),v),()=>ret(out,[c(NaN),c(NaN),c(0),c(0)]));b.branch(le(c(66),add(add(jv,jz),k)),()=>ret(out,[c(NaN),c(NaN),c(0),c(0)]));
     b.set(i,add(jz,c(1)));b.loop(()=>le(i,add(jz,k)),()=>{b.put(f,add(jx,i),b.at(piTable,add(jv,i)));b.set(fw,c(0));b.set(j,c(0));b.loop(()=>le(j,jx),()=>{b.set(fw,add(fw,mul(b.at(tx,j),b.at(f,sub(add(jx,i),j)))));b.set(j,add(j,c(1)));});b.put(q,i,fw);b.set(i,add(i,c(1)));});b.set(jz,add(jz,k));b.set(recompute,c(1));
    });
   });
  });
  b.branch(op('zero',z),()=>{b.set(jz,sub(jz,c(1)));b.set(q0,sub(q0,c(24)));b.loop(()=>choose(le(c(0),jz),()=>op('zero',b.at(iq,jz)),()=>c(0)),()=>{b.set(jz,sub(jz,c(1)));b.set(q0,sub(q0,c(24)));});b.branch(lt(jz,c(0)),()=>ret(out,[c(NaN),c(NaN),c(0),c(0)]));},()=>{
   b.set(z,scale(z,neg(q0)));b.branch(le(c(16777216),z),()=>{b.set(fw,trunc(mul(c(5.9604644775390625e-8),z)));b.put(iq,jz,trunc(sub(z,mul(c(16777216),fw))));b.set(jz,add(jz,c(1)));b.set(q0,add(q0,c(24)));b.branch(le(c(20),jz),()=>ret(out,[c(NaN),c(NaN),c(0),c(0)]));b.put(iq,jz,fw);},()=>b.put(iq,jz,trunc(z)));
  });
  b.set(fw,scale(c(1),q0));b.set(i,jz);b.loop(()=>le(c(0),i),()=>{b.put(q,i,mul(fw,b.at(iq,i)));b.set(fw,mul(fw,c(5.9604644775390625e-8)));b.set(i,sub(i,c(1)));});
  b.set(i,jz);b.loop(()=>le(c(0),i),()=>{b.set(fw,c(0));b.set(k,c(0));b.loop(()=>mul(le(k,c(4)),le(k,sub(jz,i))),()=>{b.set(fw,add(fw,mul(b.at(piChunks,k),b.at(q,add(i,k)))));b.set(k,add(k,c(1)));});b.put(fq,sub(jz,i),fw);b.set(i,sub(i,c(1)));});
  b.set(fw,c(0));b.set(i,jz);b.loop(()=>le(c(0),i),()=>{b.set(fw,add(fw,b.at(fq,i)));b.set(i,sub(i,c(1)));});const y0=choose(eq(ih,c(0)),()=>fw,()=>neg(fw));b.set(fw,sub(b.at(fq,c(0)),fw));b.set(i,c(1));b.loop(()=>le(i,jz),()=>{b.set(fw,add(fw,b.at(fq,i)));b.set(i,add(i,c(1)));});const y1=choose(eq(ih,c(0)),()=>fw,()=>neg(fw)),quad=band(n,c(7));
  b.branch(nz(band(hx,c(0x80000000))),()=>ret(out,[neg(y0),neg(y1),neg(quad),c(1)]),()=>ret(out,[y0,y1,quad,c(1)]));
 });
 b.define('reduce',1,4,([x],out)=>{
  const hx=high(x),ix=band(hx,c(0x7fffffff));b.branch(le(ix,c(0x3fe921fb)),()=>ret(out,[x,c(0),c(0),c(1)]));
  b.branch(lt(ix,c(0x4002d97c)),()=>{
   b.branch(nz(band(hx,c(0x80000000))),()=>{const z=b.variable(add(x,c(PI2[0]))),tail=b.variable(c(PI2[1]));b.branch(eq(ix,c(0x3ff921fb)),()=>{b.set(z,add(z,c(PI2[2])));b.set(tail,c(PI2[3]));});const y=add(z,tail);ret(out,[y,add(sub(z,y),tail),c(-1),c(1)]);},()=>{const z=b.variable(sub(x,c(PI2[0]))),tail=b.variable(c(PI2[1]));b.branch(eq(ix,c(0x3ff921fb)),()=>{b.set(z,sub(z,c(PI2[2])));b.set(tail,c(PI2[3]));});const y=sub(z,tail);ret(out,[y,sub(sub(z,y),tail),c(1),c(1)]);});
  });
  b.branch(lt(c(0x413921fb),ix),()=>ret(out,b.call('largeReduce',[x])));
  const t=b.variable(abs(x)),n=trunc(add(mul(t,c(6.36619772367581382433e-1)),c(.5))),r=b.variable(sub(t,mul(n,c(PI2[0])))),w=b.variable(mul(n,c(PI2[1]))),y=b.variable(sub(r,w));
  const quick=choose(lt(n,c(32)),()=>eq(eq(ix,b.at(npio,sub(n,c(1)))),c(0)),()=>c(0));
  b.branch(eq(quick,c(0)),()=>{
   const j=shr(ix,c(20)),difference=b.variable(sub(j,band(shr(high(y),c(20)),c(2047))));
   b.branch(lt(c(16),difference),()=>{b.set(t,r);b.set(w,mul(n,c(PI2[2])));b.set(r,sub(t,w));b.set(w,sub(mul(n,c(PI2[3])),sub(sub(t,r),w)));b.set(y,sub(r,w));b.set(difference,sub(j,band(shr(high(y),c(20)),c(2047))));b.branch(lt(c(49),difference),()=>{b.set(t,r);b.set(w,mul(n,c(PI2[4])));b.set(r,sub(t,w));b.set(w,sub(mul(n,c(PI2[5])),sub(sub(t,r),w)));b.set(y,sub(r,w));});});
  });
  const tail=sub(sub(r,y),w);b.branch(nz(band(hx,c(0x80000000))),()=>ret(out,[neg(y),neg(tail),neg(n),c(1)]),()=>ret(out,[y,tail,n,c(1)]));
 });
 b.define('sincos',1,3,([x],out)=>{
  const r=b.call('reduce',[x]);b.branch(eq(r[3],c(0)),()=>ret(out,[c(NaN),c(NaN),c(0)]));
  const sine=b.call('kernelSin',[r[0],r[1],lt(c(0x3fe921fb),band(high(x),c(0x7fffffff)))])[0],cosine=b.call('kernelCos',[r[0],r[1]])[0],quad=band(r[2],c(3));
  b.branch(eq(quad,c(0)),()=>ret(out,[sine,cosine,c(1)]));b.branch(eq(quad,c(1)),()=>ret(out,[cosine,neg(sine),c(1)]));b.branch(eq(quad,c(2)),()=>ret(out,[neg(sine),neg(cosine),c(1)]));ret(out,[neg(cosine),sine,c(1)]);
 });
 b.define('hypot2',2,1,([a,d],out)=>{
  const x=abs(a),y=abs(d),m=choose(lt(x,y),()=>y,()=>x);b.branch(op('zero',m),()=>ret(out,[c(0)]));const sx=div(x,m),sy=div(y,m);ret(out,[mul(sqrt(add(mul(sx,sx),mul(sy,sy))),m)]);
 });
 b.define('hypot3',3,1,([a,d,e],out)=>{
  const x=abs(a),y=abs(d),z=abs(e),xy=choose(lt(x,y),()=>y,()=>x),m=choose(lt(xy,z),()=>z,()=>xy);b.branch(op('zero',m),()=>ret(out,[c(0)]));const sx=div(x,m),sy=div(y,m),sz=div(z,m),pa=mul(sx,sx),pb=mul(sy,sy),ab=add(pa,pb),comp=sub(sub(ab,pa),pb),pc=sub(mul(sz,sz),comp);ret(out,[mul(sqrt(add(ab,pc)),m)]);
 });
 b.patch(jumpMain,b.code.length);
 const inputs=Array.from({length:8},()=>b.alloc()),[angle,elevation,speed,tipX,tipY,...center]=inputs,status=b.variable(c(0)),reason=b.variable(c(0));
 const outputMap=[[0,status,1],[1,reason,1]],fail=(s,r)=>{b.set(status,c(s));b.set(reason,c(r));b.emit('halt');};
 for(const v of inputs.slice(0,5))b.branch(eq(op('finite',v),c(0)),()=>fail(8,1));
 b.branch(le(c(1),b.call('hypot2',[tipX,tipY])[0]),()=>fail(8,2));for(const condition of[le(speed,c(0)),lt(c(10),speed),lt(elevation,c(0)),lt(c(85),elevation)])b.branch(condition,()=>fail(8,2));
 const az=b.call('sincos',[div(mul(angle,c(Math.PI)),c(180))]),el=b.call('sincos',[div(mul(elevation,c(Math.PI)),c(180))]);b.branch(eq(mul(az[2],el[2]),c(0)),()=>fail(4,6));
 const va=(a,d)=>a.map((x,i)=>add(x,d[i])),vs=(a,d)=>a.map((x,i)=>sub(x,d[i])),vm=(a,d)=>a.map(x=>mul(x,d)),cross=(a,d)=>[sub(mul(a[1],d[2]),mul(a[2],d[1])),sub(mul(a[2],d[0]),mul(a[0],d[2])),sub(mul(a[0],d[1]),mul(a[1],d[0]))];
 const direction=[mul(az[1],el[1]),neg(el[0]),mul(az[0],el[1])],side=[neg(az[0]),c(0),az[1]],up=cross(side,direction),disk=sub(sub(c(1),mul(tipX,tipX)),mul(tipY,tipY)),rear=neg(sqrt(choose(lt(disk,c(.0001)),()=>c(.0001),()=>disk))),surface=va(va(vm(side,tipX),vm(up,tipY)),vm(direction,rear)),contact=va(center,vm(surface,c(.03075))),tip=va(va(center,vm(surface,c(.03075+.006))),vm(direction,c(-.012))),length=b.call('hypot3',direction)[0],norm=vm(direction,div(c(1),choose(op('zero',length),()=>c(1),()=>length))),qscale=sqrt(mul(add(c(1),norm[1]),c(2))),rotation=Array.from({length:4},()=>b.alloc());
 b.branch(lt(norm[1],c(-.999999)),()=>[1,0,0,0].forEach((x,i)=>b.set(rotation[i],c(x))),()=>[div(norm[2],qscale),c(0),div(neg(norm[0]),qscale),div(qscale,c(2))].forEach((r,i)=>b.set(rotation[i],r)));
 const linear=vm(direction,speed),shaftCenter=vs(tip,vm(direction,c(.006+1.35/2)));
 for(const [name,values]of Object.entries({direction,side,up,surface,contact,tip,rotation,linear,shaftCenter}))values.forEach((r,i)=>outputMap.push([RAW_POSE_LAYOUT[name]+i*2,r,0]));
 if(clearanceGeometry){
  const velocity=vm(direction,c(.012));rotation.forEach((r,i)=>outputMap.push([64+i,r,2]));velocity.forEach((r,i)=>outputMap.push([68+i,r,2]));linear.forEach((r,i)=>outputMap.push([120+i,r,2]));tip.forEach((r,i)=>outputMap.push([124+i,r,2]));
  const rearLength=1.35-.12,parts=[{center:vs(tip,vm(direction,c(.006+.12+rearLength/2))),kind:0,half:rearLength/2,radius:.011},{center:vs(tip,vm(direction,c(.006+.12/2))),kind:0,half:.12/2,radius:.0058},{center:tip,kind:3,half:0,radius:.006}];
  parts.forEach((part,pi)=>{const at=72+pi*16;part.center.forEach((r,i)=>outputMap.push([at+i,r,2]));[0,.5,1].forEach((fraction,si)=>va(part.center,vm(velocity,c(fraction))).forEach((r,i)=>outputMap.push([at+3+si*3+i,r,2])));outputMap.push([at+12,c(part.kind),2],[at+13,c(part.half),2],[at+14,c(part.radius),2]);});
 }
 b.set(status,c(1));b.set(reason,c(0));b.emit('halt');
 const program=compileSourceNumberProgram(b,{inputs,outputs:outputMap,outputWords:clearanceGeometry?128:64,scope:'raw binary64 validation, pose'+(clearanceGeometry?' and native clearance geometry':'')+' only; clearance/allocation/full physics required'});rawPrograms.set(clearanceGeometry,program);return program;
}

/** Test-only execution of the exact common instruction stream. Not an executor
 * fallback and never invoked by candidate GPU submission. */
export function executeRawStrikeProgramReference(settings,center,options={}){
 const result=executeSourceNumberProgramReference(compileRawStrikeProgram(),[...['angle','elevation','speed','tipX','tipY'].map(k=>settings[k]),...center],options);
 if(!result.done){result.raw[0]=4;result.raw[1]=4;}return result;
}
export function executeSourceNumberProgramReference(p,inputs,{maximumInstructions=p.maximumInstructions}={}){
 const w=p.words,regs=new Float64Array(p.registerCount),stack=[];
 if(inputs.length!==w[10])throw new RangeError('Explicit source program input count required');
 for(let i=0;i<w[6];i++){const at=w[7]+i*3;regs[w[at]]=wordsNumber(w.subarray(at+1,at+3));}
 inputs.forEach((v,i)=>{regs[w[w[11]+i]]=v;});
 let pc=0,steps=0,done=false;
 while(!done&&steps++<maximumInstructions){
  if(pc>=w[4])throw Error('Malformed raw program PC');const at=w[5]+pc*4,[code,d,a,z]=w.subarray(at,at+4),x=regs[a],y=regs[z];pc++;
  switch(code){
   case 0:regs[d]=x;break;case 1:regs[d]=x+y;break;case 2:regs[d]=x-y;break;case 3:regs[d]=x*y;break;case 4:regs[d]=x/y;break;
   case 5:regs[d]=Math.sqrt(x);break;case 6:regs[d]=-x;break;case 7:regs[d]=Math.abs(x);break;case 8:regs[d]=+(x<y);break;case 9:regs[d]=+(x<=y);break;case 10:regs[d]=+(x===y);break;case 11:regs[d]=+Number.isFinite(x);break;case 12:regs[d]=+(x===0);break;
   case 13:regs[d]=numberWords(x)[1];break;case 14:regs[d]=(x&y)>>>0;break;case 15:regs[d]=(x|y)>>>0;break;case 16:regs[d]=(x<<y)>>>0;break;case 17:regs[d]=x>>>y;break;case 18:regs[d]=Math.trunc(x);break;case 19:regs[d]=x*2**y;break;case 20:regs[d]=wordsNumber(Uint32Array.of(numberWords(x)[0],y>>>0));break;
   case 21:{const i=a+Math.trunc(y);if(i<0||i>=regs.length)throw Error('Malformed raw load');regs[d]=regs[i];break;}
   case 22:{const i=d+Math.trunc(x);if(i<0||i>=regs.length)throw Error('Malformed raw store');regs[i]=y;break;}
   case 23:pc=d;break;case 24:if(!x)pc=d;break;case 25:if(stack.length>=p.controlWords-4)throw Error('Raw call capacity');stack.push(pc);pc=d;break;case 26:if(!stack.length)throw Error('Raw call underflow');pc=stack.pop();break;case 27:done=true;break;case 28:regs[d]=Math.fround(x);break;default:throw Error('Malformed raw opcode');
  }
 }
 const raw=new Uint32Array(p.outputWords);
 if(!done){return{raw,steps,done:false,completion:3};}
 for(let i=0;i<w[8];i++){const at=w[9]+i*3,[dest,reg,integer]=w.subarray(at,at+3);if(integer===1)raw[dest]=regs[reg]>>>0;else if(integer===2)raw[dest]=new Uint32Array(Float32Array.of(regs[reg]).buffer)[0];else raw.set(numberWords(regs[reg]),dest);}
 return{raw,steps,done:true,completion:1};
}

export function generateRawStrikeProgramWGSL({includeNumberLibrary=true}={}){return (includeNumberLibrary?generateSourceNumberWGSL():'')+/* wgsl */ `
// Caller supplies rc_program (immutable u32), rc_inputs (immutable ABI u32),
// rc_state (resident u32). Register words/control are disjoint per candidate.
// No private work arrays, source arithmetic occurs at one switch call site.
fn rc_rsp_get(base:u32,index:u32)->RcF64{return RcF64(rc_state[base+index*2u],rc_state[base+index*2u+1u]);}
fn rc_rsp_set(base:u32,index:u32,value:RcF64){rc_state[base+index*2u]=value.x;rc_state[base+index*2u+1u]=value.y;}
fn rc_rsp_int(a:RcF64)->u32{let d=rc_f64_decode(a);if(d.zero||d.exponent<0){return 0u;}var v=rc_u128_shr(d.m,u32(max(0,52-d.exponent))).x;if(d.exponent>52){v=rc_u128_shl(d.m,u32(d.exponent-52)).x;}return select(v,0u-v,d.sign!=0u);}
fn rc_rsp_trunc(a:RcF64)->RcF64{let d=rc_f64_decode(a);if(d.special!=0u||d.zero||d.exponent>=52){return a;}if(d.exponent<0){return RcF64(0u,d.sign);}return rc_f64_pack(rc_u128_shr(d.m,u32(52-d.exponent)),0,d.sign);}
fn rc_rsp_scalbn(a:RcF64,n:RcF64)->RcF64{let d=rc_f64_decode(a);if(d.special!=0u||d.zero){return a;}return rc_f64_pack(d.m,d.exponent-52+bitcast<i32>(rc_rsp_int(n)),d.sign);}
fn rc_source_program_init(pb:u32,sb:u32,cb:u32){
 let count=rc_program[pb+3u];for(var i=0u;i<count*2u;i++){rc_state[sb+i]=0u;}for(var i=0u;i<rc_program[pb+12u]+4u;i++){rc_state[cb+i]=0u;}
 for(var i=0u;i<rc_program[pb+6u];i++){let at=pb+rc_program[pb+7u]+i*3u;rc_rsp_set(sb,rc_program[at],RcF64(rc_program[at+1u],rc_program[at+2u]));}
}
fn rc_source_program_input(pb:u32,sb:u32,index:u32,value:RcF64){rc_rsp_set(sb,rc_program[pb+rc_program[pb+11u]+index],value);}
fn rc_raw_program_init(pb:u32,sb:u32,cb:u32,ib:u32,center:array<RcF64,3>){
 rc_source_program_init(pb,sb,cb);
 for(var i=0u;i<5u;i++){let reg=rc_program[pb+rc_program[pb+11u]+i];rc_rsp_set(sb,reg,RcF64(rc_inputs[ib+2u+i*2u],rc_inputs[ib+3u+i*2u]));}
 for(var i=0u;i<3u;i++){rc_rsp_set(sb,rc_program[pb+rc_program[pb+11u]+5u+i],center[i]);}
}
fn rc_raw_program_step(pb:u32,sb:u32,cb:u32,budget:u32){
 if(rc_state[cb+1u]!=0u){return;}var pc=rc_state[cb];var sp=rc_state[cb+3u];let count=rc_program[pb+3u];
 for(var step=0u;step<budget;step++){
  if(rc_state[cb+2u]>=rc_program[pb+13u]){rc_state[cb+1u]=3u;break;}rc_state[cb+2u]++;
  if(pc>=rc_program[pb+4u]){rc_state[cb+1u]=2u;break;}
  let at=pb+rc_program[pb+5u]+pc*4u;let code=rc_program[at];let d=rc_program[at+1u];let a=rc_program[at+2u];let b=rc_program[at+3u];pc++;
  var x=RcF64(0u);var y=RcF64(0u);if(a<count){x=rc_rsp_get(sb,a);}if(b<count){y=rc_rsp_get(sb,b);}var value=RcF64(0u);var write=true;
  switch(code){
   case 0u:{value=x;}case 1u:{value=rc_f64_add(x,y);}case 2u:{value=rc_f64_sub(x,y);}case 3u:{value=rc_f64_mul(x,y);}case 4u:{value=rc_f64_div(x,y);}
   case 5u:{value=rc_f64_sqrt(x);}case 6u:{value=rc_f64_neg(x);}case 7u:{value=rc_f64_abs(x);}case 8u:{value=rc_f64_from_u32(select(0u,1u,rc_f64_lt(x,y)));}case 9u:{value=rc_f64_from_u32(select(0u,1u,rc_f64_le(x,y)));}case 10u:{value=rc_f64_from_u32(select(0u,1u,rc_f64_eq(x,y)));}case 11u:{value=rc_f64_from_u32(select(0u,1u,rc_f64_finite(x)));}case 12u:{value=rc_f64_from_u32(select(0u,1u,rc_f64_zero(x)));}
   case 13u:{value=rc_f64_from_u32(x.y);}case 14u:{value=rc_f64_from_u32(rc_rsp_int(x)&rc_rsp_int(y));}case 15u:{value=rc_f64_from_u32(rc_rsp_int(x)|rc_rsp_int(y));}case 16u:{value=rc_f64_from_u32(rc_rsp_int(x)<<(rc_rsp_int(y)&31u));}case 17u:{value=rc_f64_from_u32(rc_rsp_int(x)>>(rc_rsp_int(y)&31u));}case 18u:{value=rc_rsp_trunc(x);}case 19u:{value=rc_rsp_scalbn(x,y);}case 20u:{value=RcF64(x.x,rc_rsp_int(y));}
   case 21u:{let index=a+rc_rsp_int(y);if(index>=count){rc_state[cb+1u]=2u;write=false;}else{value=rc_rsp_get(sb,index);}}
   case 22u:{let index=d+rc_rsp_int(x);if(index>=count){rc_state[cb+1u]=2u;}else{rc_rsp_set(sb,index,y);}write=false;}
   case 23u:{pc=d;write=false;}case 24u:{if(rc_f64_zero(x)){pc=d;}write=false;}
   case 25u:{if(sp>=rc_program[pb+12u]){rc_state[cb+1u]=3u;}else{rc_state[cb+4u+sp]=pc;sp++;pc=d;}write=false;}
   case 26u:{if(sp==0u){rc_state[cb+1u]=2u;}else{sp--;pc=rc_state[cb+4u+sp];}write=false;}
   case 27u:{rc_state[cb+1u]=1u;write=false;}
   case 28u:{value=rc_f64_from_f32_bits(rc_f64_to_f32_bits(x));}
   default:{rc_state[cb+1u]=2u;write=false;}
  }
  if(write){if(d>=count){rc_state[cb+1u]=2u;}else{rc_rsp_set(sb,d,value);}}if(rc_state[cb+1u]!=0u){break;}
 }
 rc_state[cb]=pc;rc_state[cb+3u]=sp;
}
fn rc_source_program_step(pb:u32,sb:u32,cb:u32,budget:u32){rc_raw_program_step(pb,sb,cb,budget);}
fn rc_source_program_finish(pb:u32,sb:u32,cb:u32,ob:u32)->u32 {
 let done=rc_state[cb+1u];if(done!=1u){return done;}
 for(var i=0u;i<rc_program[pb+14u];i++){rc_state[ob+i]=0u;}
 for(var i=0u;i<rc_program[pb+8u];i++){let at=pb+rc_program[pb+9u]+i*3u;let dest=rc_program[at];let value=rc_rsp_get(sb,rc_program[at+1u]);if(rc_program[at+2u]==1u){rc_state[ob+dest]=rc_rsp_int(value);}else if(rc_program[at+2u]==2u){rc_state[ob+dest]=rc_f64_to_f32_bits(value);}else{rc_state[ob+dest]=value.x;rc_state[ob+dest+1u]=value.y;}}return done;
}
fn rc_raw_program_finish(pb:u32,sb:u32,cb:u32,ob:u32){
 let done=rc_source_program_finish(pb,sb,cb,ob);if(done==1u){return;}
 for(var i=0u;i<rc_program[pb+14u];i++){rc_state[ob+i]=0u;}rc_state[ob]=4u;rc_state[ob+1u]=select(5u,4u,done==3u);if(done==0u){rc_state[ob]=5u;rc_state[ob+1u]=11u;}
}
`;}


export {RawBuilder as SourceNumberProgramBuilder};
/** Builder outputs are [destinationWord, register, integerFlag]. Integer outputs
 * use one u32; type2 uses one native f32 word; type0 uses two binary64 lo/hi words. Control ABI: pc, completion
 * (0 running/1 halted/2 malformed/3 capacity), cumulative instructions, stackTop,
 * then source call return PCs. Generic callers must gate completion before using
 * numerical outputs; malformed/capacity is never an ordinary false predicate. */
export function compileSourceNumberProgram(b,{inputs,outputs,outputWords=64,maximumInstructions=20000,scope='source-number-program'}={}){
 if(!(b instanceof RawBuilder)||!Array.isArray(inputs)||!Array.isArray(outputs)||!Number.isSafeInteger(outputWords)||outputWords<2||!Number.isSafeInteger(maximumInstructions)||maximumInstructions<1)throw new TypeError('Source builder and explicit bounded IO required');
 if(inputs.some(r=>!Number.isInteger(r)||r<0||r>=b.regs)||outputs.some(([d,r,t])=>!Number.isInteger(d)||d<0||d+(t?0:1)>=outputWords||!Number.isInteger(r)||r<0||r>=b.regs||![0,1,2].includes(t)))throw new RangeError('Source program IO out of bounds');
 const headerWords=16,instructionOffset=headerWords,constantOffset=instructionOffset+b.code.length*4,outputOffset=constantOffset+b.constants.length*3,inputOffset=outputOffset+outputs.length*3,words=new Uint32Array(inputOffset+inputs.length);
 words.set([0x52435350,1,words.length,b.regs,b.code.length,instructionOffset,b.constants.length,constantOffset,outputs.length,outputOffset,inputs.length,inputOffset,b.maxCallDepth,maximumInstructions,outputWords,0]);words.set(b.code.flat(),instructionOffset);words.set(b.constants.flat(),constantOffset);words.set(outputs.flat(),outputOffset);words.set(inputs,inputOffset);
 return Object.freeze({words,registerCount:b.regs,registerWords:b.regs*2,controlWords:4+b.maxCallDepth,instructionCount:b.code.length,constantCount:b.constants.length,outputWords,maximumInstructions,scope,sourceProfile:RAW_STRIKE_CAPABILITY.numberProfile});
}

/** Define pinned V8 fast Math.hypot two/three argument functions. Call the named
 * functions in the same builder after emitting a jump over function definitions.
 * All finite/zero/Infinity/NaN rules are retained, not a Euclidean approximation. */
export function defineSourceNumberHypotFunctions(b,{prefix='sourceHypot'}={}){
 const c=x=>b.c(x),op=(name,a,z)=>b.op(name,a,z),add=(a,z)=>op('add',a,z),sub=(a,z)=>op('sub',a,z),mul=(a,z)=>op('mul',a,z),div=(a,z)=>op('div',a,z),eq=(a,z)=>op('eq',a,z),choose=(condition,yes,no)=>{const r=b.alloc();b.branch(condition,()=>b.set(r,yes()),()=>b.set(r,no()));return r;};
 const ret=(out,value)=>{b.set(out[0],value);b.emit('ret');},names={hypot2:prefix+'2',hypot3:prefix+'3'};
 for(const n of [2,3])b.define(names['hypot'+n],n,1,(args,out)=>{
  const values=args.map(x=>op('abs',x));for(const v of values)b.branch(eq(v,c(Infinity)),()=>ret(out,c(Infinity)));for(const v of values)b.branch(eq(op('finite',v),c(0)),()=>ret(out,c(NaN)));
  let m=values[0];for(const v of values.slice(1)){const prior=m;m=choose(op('lt',prior,v),()=>v,()=>prior);}b.branch(op('zero',m),()=>ret(out,c(0)));
  const scaled=values.map(v=>div(v,m)),sq=scaled.map(v=>mul(v,v)),ab=add(sq[0],sq[1]),sum=n===2?ab:add(ab,sub(sq[2],sub(sub(ab,sq[0]),sq[1])));ret(out,mul(op('sqrt',sum),m));
 });return Object.freeze(names);
}

// Parry query/gjk/gjk.rs::minkowski_ray_cast and
// query/shape_cast/shape_cast_support_map_support_map.rs. The source 100-step
// iteration cap is retained and surfaced as unresolved, never proof of clear.
// mget/mset are separate metadata, outside reusable EPA scratch (which may use
// every source slot). Only the source contact fallback at tiny TOI may finalize.
const RAW_CAST_CORE=String.raw`
fn cast_hit(toi:f32){mset(0,1.0);mset(1,toi);}
fn cast_miss(){mset(0,2.0);}
fn cast_bad(){mset(0,3.0);}
fn cast_init(){
 init();mset(0,0.0);mset(1,0.0);mset(2,0.0);mset(3,0.0);
 let velocity:V=rotate(v3(iget(24),iget(25),iget(26)),vn(iv(3)),iget(6));
 if(iget(20)==3.0&&iget(21)==3.0){mset(2,1.0);
  let center:V=vn(getv(17));let dc:V=vn(center);let radius:f32=addf(iget(7),iget(17));let a:f32=vd(velocity,velocity);let b:f32=vd(dc,velocity);let c:f32=subf(vd(dc,dc),mulf(radius,radius));
  if(a==0.0){if(c>0.0){cast_miss();}else{cast_hit(0.0);}return;}
  if(c>0.0&&b>0.0){cast_miss();return;}let delta:f32=subf(mulf(b,b),mulf(a,c));if(delta<0.0){cast_miss();return;}
  let t:f32=divf(subf(-b,sqrtf(delta)),a);if(t<=0.0){cast_hit(0.0);}else if(t>1.0){cast_miss();}else{cast_hit(t);}mset(2,1.0);return;
 }
 let ray_length:f32=len(velocity);mset(4,ray_length);if(absf(ray_length)<=0.00000011920928955078125){cast_miss();return;}
 let ray_dir:V=v3(divf(velocity.x,ray_length),divf(velocity.y,ray_length),divf(velocity.z,ray_length));setv(114,ray_dir);setv(117,zero());setv(120,vn(ray_dir));
 let pt:Cso=support(vn(ray_dir));put_vertex(0,pt);sset(1,0.0);sset(2,0.0);for(var i:i32=0;i<4;i=i+1){sset(60+i,f32(i));}setv(8,reduce_simplex());sset(3,3.4028234663852886e38);mset(5,0.0);mset(6,0.0);mset(7,0.0);
}
fn cast_step(){
 if(mget(0)!=0.0){return;}let eps:f32=0.0000011920928955078125;let rel:f32=sqrtf(eps);let old:f32=sget(3);let np:V=vn(getv(8));var dist:f32=len(np);let dir:V=try_unit(np);if(vd(dir,dir)==0.0){dist=0.0;}
 if(dist<=eps){cast_hit(divf(mget(5),mget(4)));return;}sset(3,dist);
 var pt:Cso=Cso(zero(),zero(),zero());if(dist>=old){mset(6,1.0);let p:V=va(getv(8),getv(117));pt=Cso(p,zero(),p);}else{pt=support(dir);}
 if(mget(6)!=0.0&&mget(5)>0.0){result(sget(1)==3.0,dir);let witness:f32=vd(vs(vs(getv(14),getv(84)),zero()),getv(114));if(finitef(witness)&&witness>mget(5)){mset(5,witness);}cast_hit(divf(mget(5),mget(4)));return;}
 let denom:f32=vd(dir,getv(114));var has_t:bool=false;var t:f32=0.0;
 if(absf(denom)>0.00000011920928955078125){t=divf(vd(dir,vs(pt.point,getv(117))),denom);has_t=t>=0.0;}
 if(has_t){if(denom<0.0&&t>0.0){setv(120,dir);mset(5,addf(mget(5),t));let shift:V=vm(getv(114),t);setv(117,va(getv(117),shift));sset(3,3.4028234663852886e38);for(var i:i32=0;i<=i32(sget(1));i=i+1){let p:Cso=simplex_vertex(i);put_vertex(i,Cso(p.orig1,p.orig2,va(p.point,vn(shift))));}mset(6,0.0);}}
 else if(denom>eps){cast_miss();return;}
 if(mget(6)!=0.0){cast_miss();return;}
 let min_bound:f32=-vd(dir,vs(pt.point,getv(117)));if(!finitef(min_bound)){cast_bad();return;}
 if(subf(sget(3),min_bound)<=mulf(rel,sget(3))){cast_miss();return;}
 let added:bool=add_vertex(Cso(pt.orig1,pt.orig2,va(pt.point,vn(getv(117)))));if(sget(0)<0.0){cast_bad();return;}setv(8,reduce_simplex());
 if(sget(1)==3.0){let scale:f32=maxf(len(pt.point),len(getv(117)));if(min_bound>=mulf(eps,maxf(scale,1.0))){cast_miss();}else{cast_hit(divf(mget(5),mget(4)));}return;}
 mset(7,addf(mget(7),1.0));if(mget(7)==100.0){cast_bad();}
}
fn cast_contact_init(){if(mget(0)==1.0&&mget(2)==0.0&&mget(1)<0.0001){mset(3,1.0);init();}}
fn cast_contact_step(){if(mget(3)!=0.0){gjk_step();}}
fn cast_contact_epa(){if(mget(3)!=0.0){epa();}}
fn cast_finish(){
 if(mget(0)==0.0||mget(0)==3.0){oset(0,-1.0);return;}if(mget(0)==2.0||mget(1)>1.0){oset(0,0.0);return;}
 if(mget(3)!=0.0){finish();if(sget(0)<0.0||sget(0)==0.0||sget(0)==2.0){oset(0,-1.0);return;}if(sget(0)==4.0){if(sget(112)==1.0){oset(0,0.0);}else{oset(0,-1.0);}return;}}
 oset(0,1.0);oset(1,mget(1));
}
`;
function rawQueryFunctions(source){const result=new Map(),re=/\bfn\s+(\w+)\s*\(/g;let m;while((m=re.exec(source))){const open=source.indexOf('{',re.lastIndex);let depth=1,end=open+1;for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}if(depth)throw Error('Unbalanced original query source');result.set(m[1],source.slice(m.index,end));re.lastIndex=end;}return result;}
function rawCastFunctions(query){
 if(query?.PROVENANCE?.parry!=='0.31.1'||query.STATE_FLOATS!==13632)throw new TypeError('Pinned original support-map query required');
 const functions=new Map();for(const stage of ['init','gjk','epa','finish'])for(const[name,body]of rawQueryFunctions(query.generateWGSL(stage))){if(name==='main')continue;if(functions.has(name)&&functions.get(name)!==body)throw Error('Inconsistent original query function '+name);functions.set(name,body);}
 for(const[name,body]of rawQueryFunctions(RAW_CAST_CORE))functions.set(name,body);
 return functions;
}
export const RAW_CAST_LAYOUT=Object.freeze({inputWords:32,outputWords:16,scratchWords:13632,metadataWords:16,hullWords:200,sourceIterations:100,contactFallbackIterations:256,
 stages:Object.freeze(['init','cast','contact-init','contact-gjk','contact-epa','finish']),source:'Parry 0.31.1 gjk::minkowski_ray_cast; target_distance=0,max_toi=1,stop_at_penetration=true'});
/** Common input shape codes match original query: cylinder0, box1, convex2,
 * ball3. Shape order is never swapped. hget retains original-index vertices. */
export function packRawCastQuery(pair){
 const F=Math.fround,input=new Float32Array(32),hulls=new Float32Array(200),finite=(x,label)=>{if(typeof x!=='number'||!Number.isFinite(F(x)))throw new TypeError('Finite f32 '+label+' required');return F(x);};
 for(let which=0;which<2;which++){
  const shape=pair['shape'+(which+1)],position=pair['position'+(which+1)]??[0,0,0],rotation=pair['rotation'+(which+1)]??[0,0,0,1];if(position.length!==3||rotation.length!==4)throw new RangeError('Explicit source pose required');input.set(position.map(x=>finite(x,'position')),which*10);input.set(rotation.map(x=>finite(x,'rotation')),which*10+3);
  let kind,dim;if(shape?.type==='cylinder'){kind=0;dim=[shape.halfHeight,shape.radius,0];}else if(shape?.type==='box'){kind=1;dim=shape.halfExtents;}else if(shape?.type==='sphere'){kind=3;dim=[shape.radius,0,0];}else if(shape?.type==='convex'){kind=2;dim=[0,0,0];if(!Array.isArray(shape.points)||shape.points.length<4||shape.points.length>32)throw new RangeError('Original-indexed hull 4..32 required');hulls[which*100]=shape.points.length;shape.points.forEach((p,i)=>{if(p.length!==3)throw new RangeError('Hull point xyz required');hulls.set(p.map(x=>finite(x,'hull')),which*100+1+i*3);});}else throw new RangeError('Unsupported original clearance shape');
  input.set(dim.map(x=>finite(x,'dimension')),which*10+7);input[20+which]=kind;
 }
 input[22]=F(3.4028234663852886e38);const velocity=pair.velocity??[0,0,0];if(velocity.length!==3)throw new RangeError('Relative world velocity required');input.set(velocity.map(x=>finite(x,'velocity')),24);return{input,hulls};
}
const rawCastReferenceFactories=new WeakMap();
export function rawCastQueryReference(query,pair){
 const functions=rawCastFunctions(query),{input,hulls}=packRawCastQuery(pair),state=new Float32Array(RAW_CAST_LAYOUT.scratchWords),metadata=new Float32Array(16),output=new Float32Array(16),F=Math.fround;
 const primitives={f32:F,i32:Math.trunc,addf:(a,b)=>F(a+b),subf:(a,b)=>F(a-b),mulf:(a,b)=>F(a*b),divf:(a,b)=>F(a/b),sqrtf:x=>F(Math.sqrt(x)),absf:Math.abs,minf:Math.min,maxf:Math.max,finitef:Number.isFinite,signcopy:(s,m)=>s<0||Object.is(s,-0)?-Math.abs(m):Math.abs(m),v3:(x,y,z)=>({x:F(x),y:F(y),z:F(z)}),Cso:(orig1,orig2,point)=>({orig1,orig2,point}),Projection:(point,kind,index,weights)=>({point,kind,index,weights}),sget:i=>state[i],sset:(i,v)=>{state[i]=v;},iget:i=>input[i],oset:(i,v)=>{output[i]=v;},hget:i=>hulls[i],mget:i=>metadata[i],mset:(i,v)=>{metadata[i]=v;}};
 for(const name of Object.keys(primitives))functions.delete(name);
 const body=[...functions.values()].join('\n').replace(/\bfn\s+/g,'function ').replace(/\s*->\s*(?:f32|i32|bool|V|Cso|Projection)\b/g,'').replace(/:\s*(?:f32|i32|bool|V|Cso|Projection)\b/g,'');
 let factory=rawCastReferenceFactories.get(query);if(!factory){factory=new Function(...Object.keys(primitives),body+';return {cast_init,cast_step,cast_contact_init,cast_contact_step,cast_contact_epa,cast_finish};');rawCastReferenceFactories.set(query,factory);}const api=factory(...Object.values(primitives));api.cast_init();for(let i=0;i<100&&metadata[0]===0;i++)api.cast_step();api.cast_contact_init();for(let i=0;i<256;i++)api.cast_contact_step();api.cast_contact_epa();api.cast_finish();
 if(output[0]<0||output.some(x=>!Number.isFinite(x)))return{status:'unsupported',reason:'query-numeric-or-capacity',metadata:Array.from(metadata)};
 return{status:'complete',hit:output[0]===1,timeOfImpact:output[0]===1?output[1]:null,metadata:Array.from(metadata)};
}
export function generateRawCastQueryWGSL(query,stage='finish',{storageLoop=false}={}){
 const targets={init:'cast_init',cast:'cast_step','contact-init':'cast_contact_init','contact-gjk':'cast_contact_step','contact-epa':'cast_contact_epa',finish:'cast_finish'},target=targets[stage];if(!target)throw new RangeError('Bounded source cast stage required');const functions=rawCastFunctions(query);
 functions.set('sget','fn sget(i:i32)->f32{return bitcast<f32>(rc_scratch[rc_cast_scratch+u32(i)]);}');functions.set('sset','fn sset(i:i32,x:f32){rc_scratch[rc_cast_scratch+u32(i)]=bitcast<u32>(x);}');functions.set('iget','fn iget(i:i32)->f32{return bitcast<f32>(rc_state[rc_cast_input+u32(i)]);}');functions.set('oset','fn oset(i:i32,x:f32){rc_state[rc_cast_output+u32(i)]=bitcast<u32>(x);}');functions.set('hget','fn hget(i:i32)->f32{return bitcast<f32>(rc_geometry[rc_cast_hull+u32(i)]);}');
 functions.set('mget','fn mget(i:i32)->f32{return bitcast<f32>(rc_state[rc_cast_metadata+u32(i)]);}');functions.set('mset','fn mset(i:i32,x:f32){rc_state[rc_cast_metadata+u32(i)]=bitcast<u32>(x);}');
 const used=new Set(),visit=name=>{if(used.has(name)||!functions.has(name))return;used.add(name);for(const m of functions.get(name).matchAll(/\b(\w+)\s*\(/g))if(m[1]!==name)visit(m[1]);};visit(target);const names=new Set([...functions.keys(),'V','Cso','Projection']),rename=source=>source.replace(/\b[A-Za-z_]\w*\b/g,name=>names.has(name)?'rc_cast_'+name:name);
 return `var<private> rc_cast_scratch:u32;var<private> rc_cast_input:u32;var<private> rc_cast_output:u32;var<private> rc_cast_hull:u32;var<private> rc_cast_metadata:u32;\n`+rename('alias V=vec3<f32>;struct Cso{orig1:V,orig2:V,point:V};struct Projection{point:V,kind:i32,index:i32,weights:V};')+'\n'+[...functions].filter(([name])=>used.has(name)).map(([,body])=>rename(body)).join('\n')+`
fn rc_raw_cast_stage(scratch:u32,input:u32,output:u32,hull:u32,metadata:u32){rc_cast_scratch=scratch;rc_cast_input=input;rc_cast_output=output;rc_cast_hull=hull;rc_cast_metadata=metadata;
 ${stage==='init'?`for(var i=0u;i<13632u;i++){rc_scratch[scratch+i]=0u;}for(var i=0u;i<16u;i++){rc_state[metadata+i]=0u;rc_state[output+i]=0u;}rc_cast_cast_init();rc_state[metadata+15u]=100u;`:stage==='cast'?(storageLoop?`let bound=rc_state[metadata+15u];if(bound==0u||bound>100u){rc_state[metadata]=0x40400000u;return;}for(var i=0u;i<bound;i++){if(rc_state[metadata]!=0u){break;}rc_cast_cast_step();}if(bound!=100u){rc_state[metadata]=0x40400000u;}`:`rc_cast_cast_step();`):stage==='contact-gjk'?(storageLoop?`let bound=rc_state[metadata+15u];if(bound==0u||bound>256u){rc_state[metadata]=0x40400000u;return;}for(var i=0u;i<bound;i++){if(rc_state[metadata+3u]==0u||rc_scratch[scratch]!=0u){break;}rc_cast_cast_contact_step();}if(bound!=256u){rc_state[metadata]=0x40400000u;}`:`rc_cast_cast_contact_step();`):stage==='contact-init'?`rc_cast_cast_contact_init();rc_state[metadata+15u]=256u;`:`rc_cast_${target}();`}
}
`;
}

const RAW_CONTACT_CORE=String.raw`
fn contact_distance(projected:V,inside:f32,center:V,radius:f32){
 let delta:V=vs(projected,center);let length:f32=len(delta);var distance:f32=-radius;
 if(length>=0.00000011920928955078125){if(inside!=0.0){distance=subf(-length,radius);}else{distance=subf(length,radius);}}
 if(distance<=iget(22)){oset(0,1.0);oset(1,distance);}else{oset(0,0.0);}mset(0,1.0);
}
fn contact_project_box(center:V,half:V,radius:f32){
 let lower:V=vn(half);let mins_pt:V=vs(lower,center);let pt_maxs:V=vs(center,half);
 let shift:V=vs(v3(maxf(mins_pt.x,0.0),maxf(mins_pt.y,0.0),maxf(mins_pt.z,0.0)),v3(maxf(pt_maxs.x,0.0),maxf(pt_maxs.y,0.0),maxf(pt_maxs.z,0.0)));
 if(vd(shift,shift)!=0.0){contact_distance(va(center,shift),0.0,center,radius);return;}
 var sx:f32=-1.0;var sy:f32=-1.0;var sz:f32=-1.0;if(center.x>0.0){sx=1.0;}if(center.y>0.0){sy=1.0;}if(center.z>0.0){sz=1.0;}
 let diff:V=vs(half,v3(mulf(sx,center.x),mulf(sy,center.y),mulf(sz,center.z)));var displacement:V=zero();
 if(diff.x<=diff.y&&diff.x<=diff.z){displacement=v3(mulf(diff.x,sx),0.0,0.0);}else if(diff.y<=diff.x&&diff.y<=diff.z){displacement=v3(0.0,mulf(diff.y,sy),0.0);}else{displacement=v3(0.0,0.0,mulf(diff.z,sz));}
 contact_distance(va(center,displacement),1.0,center,radius);
}
fn contact_project_cylinder(center:V,half:f32,radius:f32,ball_radius:f32){
 let planar:f32=sqrtf(addf(mulf(center.x,center.x),mulf(center.z,center.z)));var dx:f32=1.0;var dz:f32=0.0;
 if(planar>0.00000011920928955078125){let inv:f32=divf(1.0,planar);dx=mulf(center.x,inv);dz=mulf(center.z,inv);}
 let px:f32=mulf(dx,radius);let pz:f32=mulf(dz,radius);var projected:V=zero();var inside:f32=0.0;
 if(center.y>=-half&&center.y<=half&&planar<=radius){inside=1.0;let top:f32=subf(half,center.y);let bottom:f32=subf(center.y,-half);let side:f32=subf(radius,planar);
  if(top<bottom&&top<side){projected=v3(center.x,half,center.z);}else if(bottom<top&&bottom<side){projected=v3(center.x,-half,center.z);}else{projected=v3(px,center.y,pz);}
 }else if(center.y>half){if(planar<=radius){projected=v3(center.x,half,center.z);}else{projected=v3(px,half,pz);}}
 else if(center.y < -half){if(planar<=radius){projected=v3(center.x,-half,center.z);}else{projected=v3(px,-half,pz);}}
 else{projected=v3(px,center.y,pz);}contact_distance(projected,inside,center,ball_radius);
}
fn contact_init(){
 init();mset(0,0.0);let k1:i32=i32(iget(20));let k2:i32=i32(iget(21));
 if(k1==3&&k2==3){let distance2:f32=vd(getv(17),getv(17));let radii:f32=addf(iget(7),iget(17));let limit:f32=addf(radii,iget(22));
  if(distance2<mulf(limit,limit)){oset(0,1.0);oset(1,subf(sqrtf(distance2),radii));}else{oset(0,0.0);}mset(0,1.0);return;}
 if(k1!=3&&k2!=3){return;}
 var center:V=getv(17);var which:i32=0;var radius:f32=iget(17);var kind:i32=k1;
 if(k1==3){center=rotate(vn(getv(17)),vn(getv(68)),sget(71));which=1;radius=iget(7);kind=k2;}
 mset(2,radius);mset(3,center.x);mset(4,center.y);mset(5,center.z);mset(6,f32(kind));
 if(kind==1){contact_project_box(center,iv(which*10+7),radius);return;}
 if(kind==0){contact_project_cylinder(center,iget(which*10+7),iget(which*10+8),radius);return;}
 if(kind==2){mset(0,2.0);return;}mset(0,3.0);
}
fn contact_gjk(){if(mget(0)==0.0){gjk_step();}}
fn contact_epa(){if(mget(0)==0.0){epa();}}
fn contact_finish(){if(mget(0)==0.0){finish();if(sget(0)==4.0&&sget(112)!=1.0){oset(0,-1.0);}}else if(mget(0)==3.0){oset(0,-1.0);}}
`;
function rawContactFunctions(query){const functions=rawCastFunctions(query);for(const[name,body]of rawQueryFunctions(RAW_CONTACT_CORE))functions.set(name,body);return functions;}
export function packRawContactQuery(pair){const packed=packRawCastQuery({...pair,velocity:[0,0,0]});const prediction=Math.fround(pair.prediction??.1);if(!Number.isFinite(prediction)||prediction<0)throw new RangeError('Finite nonnegative source prediction required');packed.input[22]=prediction;return packed;}
const rawContactReferenceFactories=new WeakMap();
export function rawContactQueryReference(query,pointQuery,pair){
 const functions=rawContactFunctions(query),{input,hulls}=packRawContactQuery(pair),state=new Float32Array(13632),metadata=new Float32Array(16),output=new Float32Array(16),F=Math.fround;
 const primitives={f32:F,i32:Math.trunc,addf:(a,b)=>F(a+b),subf:(a,b)=>F(a-b),mulf:(a,b)=>F(a*b),divf:(a,b)=>F(a/b),sqrtf:x=>F(Math.sqrt(x)),absf:Math.abs,minf:Math.min,maxf:Math.max,finitef:Number.isFinite,signcopy:(s,m)=>s<0||Object.is(s,-0)?-Math.abs(m):Math.abs(m),v3:(x,y,z)=>({x:F(x),y:F(y),z:F(z)}),Cso:(orig1,orig2,point)=>({orig1,orig2,point}),Projection:(point,kind,index,weights)=>({point,kind,index,weights}),sget:i=>state[i],sset:(i,v)=>{state[i]=v;},iget:i=>input[i],oset:(i,v)=>{output[i]=v;},hget:i=>hulls[i],mget:i=>metadata[i],mset:(i,v)=>{metadata[i]=v;}};
 for(const name of Object.keys(primitives))functions.delete(name);let factory=rawContactReferenceFactories.get(query);if(!factory){const body=[...functions.values()].join('\n').replace(/\bfn\s+/g,'function ').replace(/\s*->\s*(?:f32|i32|bool|V|Cso|Projection)\b/g,'').replace(/:\s*(?:f32|i32|bool|V|Cso|Projection)\b/g,'');factory=new Function(...Object.keys(primitives),body+';return {contact_init,contact_gjk,contact_epa,contact_finish,contact_distance};');rawContactReferenceFactories.set(query,factory);}const api=factory(...Object.values(primitives));api.contact_init();
 if(metadata[0]===2){const shape=pair.shape1.type==='convex'?pair.shape1:pair.shape2;if(!pointQuery||!shape.nativeTopology)return{status:'unsupported',reason:'native-convex-topology-required'};try{const projected=pointQuery.queryReference({hull:shape.nativeTopology,point:Array.from(metadata.slice(3,6))});api.contact_distance(primitives.v3(...projected.point),+projected.isInside,primitives.v3(...metadata.slice(3,6)),metadata[2]);}catch(error){return{status:'unsupported',reason:'source-point-query-failed',detail:String(error)};}}
 else{for(let i=0;i<256;i++)api.contact_gjk();api.contact_epa();}api.contact_finish();
 if(output[0]<0||output.some(x=>!Number.isFinite(x)))return{status:'unsupported',reason:'query-numeric-or-capacity'};return{status:'complete',contact:output[0]===1,distance:output[0]===1?output[1]:null};
}
/** pointStageCode must be the matching generateConvexPointWGSL(stage) source;
 * its immutable full native hull is supplied separately as pointHull. */
export function generateRawContactQueryWGSL(query,stage='finish',{pointStageCode='',storageLoop=false,queryChunk=1}={}){
 if(![1,2,4,8].includes(queryChunk)||storageLoop&&queryChunk!==1)throw new RangeError('Explicit source contact query transport required');
 const chunked=queryChunk!==1;
 const targets={init:'contact_init',gjk:'contact_gjk',epa:'contact_epa',finish:'contact_finish'},target=targets[stage];if(!target)throw new RangeError('Source contact stage required');const functions=rawContactFunctions(query);
 functions.set('sget','fn sget(i:i32)->f32{return bitcast<f32>(rc_scratch[rc_contact_scratch+u32(i)]);}');functions.set('sset','fn sset(i:i32,x:f32){rc_scratch[rc_contact_scratch+u32(i)]=bitcast<u32>(x);}');functions.set('iget','fn iget(i:i32)->f32{return bitcast<f32>(rc_state[rc_contact_input+u32(i)]);}');functions.set('oset','fn oset(i:i32,x:f32){rc_state[rc_contact_output+u32(i)]=bitcast<u32>(x);}');functions.set('hget','fn hget(i:i32)->f32{return bitcast<f32>(rc_geometry[rc_contact_hull+u32(i)]);}');functions.set('mget','fn mget(i:i32)->f32{return bitcast<f32>(rc_state[rc_contact_metadata+u32(i)]);}');functions.set('mset','fn mset(i:i32,x:f32){rc_state[rc_contact_metadata+u32(i)]=bitcast<u32>(x);}');
 const used=new Set(),visit=name=>{if(used.has(name)||!functions.has(name))return;used.add(name);for(const m of functions.get(name).matchAll(/\b(\w+)\s*\(/g))if(m[1]!==name)visit(m[1]);};visit(target);if(stage==='finish')visit('contact_distance');const names=new Set([...functions.keys(),'V','Cso','Projection']),rename=source=>source.replace(/\b[A-Za-z_]\w*\b/g,name=>names.has(name)?'rc_contact_'+name:name);
 let point='if(rc_state[metadata]==0x40000000u){rc_state[metadata]=0x40400000u;}';
 if(pointStageCode){if(!pointStageCode.includes('fn rc_project_convex_stage'))throw new TypeError('Resident original point stage source required');point=`if(rc_state[metadata]==0x40000000u){let center=vec3<f32>(bitcast<f32>(rc_state[metadata+3u]),bitcast<f32>(rc_state[metadata+4u]),bitcast<f32>(rc_state[metadata+5u]));let failed=rc_project_convex_stage(scratch,output,pointHull,center,0u);${stage==='init'?'rc_state[output+15u]=256u;':''}if(failed!=0u){rc_state[metadata]=0x40400000u;} ${stage==='finish'?`else{let inside=bitcast<f32>(rc_state[output+1u]);let projected=vec3<f32>(bitcast<f32>(rc_state[output+2u]),bitcast<f32>(rc_state[output+3u]),bitcast<f32>(rc_state[output+4u]));rc_contact_contact_distance(projected,inside,center,bitcast<f32>(rc_state[metadata+2u]));}`:''}}`;}
 return pointStageCode+`\nvar<private> rc_contact_scratch:u32;var<private> rc_contact_input:u32;var<private> rc_contact_output:u32;var<private> rc_contact_hull:u32;var<private> rc_contact_metadata:u32;\n`+rename('alias V=vec3<f32>;struct Cso{orig1:V,orig2:V,point:V};struct Projection{point:V,kind:i32,index:i32,weights:V};')+'\n'+[...functions].filter(([name])=>used.has(name)).map(([,body])=>rename(body)).join('\n')+`
fn rc_raw_contact_stage(scratch:u32,input:u32,output:u32,hull:u32,metadata:u32,pointHull:u32){rc_contact_scratch=scratch;rc_contact_input=input;rc_contact_output=output;rc_contact_hull=hull;rc_contact_metadata=metadata;
 ${stage==='init'?`for(var i=0u;i<13632u;i++){rc_scratch[scratch+i]=0u;}for(var i=0u;i<16u;i++){rc_state[metadata+i]=0u;rc_state[output+i]=0u;}rc_contact_contact_init();rc_state[metadata+15u]=256u;${point}`:stage==='gjk'?(storageLoop?`let bound=rc_state[metadata+15u];if(bound==0u||bound>256u){rc_state[metadata]=0x40400000u;return;}for(var i=0u;i<bound;i++){if(rc_state[metadata]!=0u||rc_scratch[scratch]!=0u){break;}rc_contact_contact_gjk();}if(bound!=256u){rc_state[metadata]=0x40400000u;}${point}`:chunked?`if(rc_state[metadata+15u]!=256u||rc_state[metadata+14u]>256u||rc_state[metadata+14u]%${queryChunk}u!=0u){rc_state[metadata]=0x40400000u;return;}if(rc_state[metadata+14u]==256u){return;}${Array.from({length:queryChunk},()=>`rc_contact_contact_gjk();rc_state[metadata+14u]++;`).join('')}${point}`:`rc_contact_contact_gjk();${point}`):stage==='epa'?`${chunked?'if(rc_state[metadata+14u]!=256u||rc_state[metadata+15u]!=256u){rc_state[metadata]=0x40400000u;return;}rc_state[metadata+14u]=0u;rc_state[metadata+15u]=0u;':''}rc_contact_contact_epa();${point}`:`${chunked?'if(rc_state[metadata+14u]!=0u||rc_state[metadata+15u]!=0u){rc_state[metadata]=0x40400000u;}':''}${point}rc_contact_contact_finish();`}
}
`;
}

/** Test oracle for the source ordered clearance state machine. Runtime GPU code
 * must use these resident query stages; this function is never a fallback. */
export function rawClearanceReference(query,pointQuery,{settings,center,obstacles,selectedIndex}){
 if(!Array.isArray(obstacles)||!Number.isInteger(selectedIndex)||selectedIndex<0||selectedIndex>=obstacles.length)throw new TypeError('Complete original ordered obstacles and selected row required');
 const geometry=rawStrikeClearanceGeometryReference(settings,center);if(geometry.status!=='clearance-geometry-ready')return geometry;
 let distance=.1,obstacle=null,swept=false,contacts=0,casts=0;
 for(let oi=0;oi<obstacles.length;oi++)for(let pi=0;pi<geometry.parts.length;pi++){
  if(oi===selectedIndex&&pi===2)continue;const other=obstacles[oi],part=geometry.parts[pi],shape2=part.shape==='sphere'?{type:'sphere',radius:part.radius}:{type:'cylinder',radius:part.radius,halfHeight:part.halfHeight};
  const base={shape1:other.shape,shape2,position1:other.position,rotation1:other.rotation,rotation2:geometry.rotation};let gap=.1;
  for(const position2 of part.samples){const result=rawContactQueryReference(query,pointQuery,{...base,position2,prediction:.1});contacts++;if(result.status!=='complete')return{status:'unsupported',reason:result.reason,obstacleIndex:oi,partIndex:pi,contacts,casts};if(result.contact)gap=Math.min(gap,result.distance);}
  const cast=rawCastQueryReference(query,{...base,position2:part.center,velocity:geometry.velocity});casts++;if(cast.status!=='complete')return{status:'unsupported',reason:cast.reason,obstacleIndex:oi,partIndex:pi,contacts,casts};if(cast.hit){gap=Math.min(gap,-1e-7);swept=true;}
  if(gap<distance){distance=gap;obstacle=oi;}
 }
 return{status:'clearance-complete',clear:distance>=0,distance,obstacle:distance<0?obstacle:null,swept,travel:geometry.travel,contacts,casts};
}

export const RAW_CLEARANCE_GEOMETRY_LAYOUT=Object.freeze({words:128,nativeRotation:64,nativeVelocity:68,parts:72,partStride:16,partCenter:0,partSamples:3,partKind:12,partHalfHeight:13,partRadius:14,nativeLinear:120,nativeTip:124});

export const RAW_CLEARANCE_STATE_LAYOUT=Object.freeze({words:16,status:0,pair:1,sample:2,selected:3,distance:4,gap:6,swept:8,nearest:9,contacts:10,casts:11,reason:12,
 statuses:Object.freeze({running:0,clear:1,blocked:2,unsupported:3}),obstacleStride:16});
/** Pack immutable original prestrike obstacle geometry once, not per candidate.
 * Hull topology is accepted only by the existing original source exporter. */
export function packClearanceObstacles(pointQuery,obstacles){
 if(!Array.isArray(obstacles)||!obstacles.length)throw new TypeError('Original ordered obstacle roster required');
 const header=new Uint32Array(obstacles.length*16),chunks=[header,new Uint32Array(200)];let words=header.length+200;const fword=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
 obstacles.forEach((o,i)=>{
  const pair=packRawCastQuery({shape1:o.shape,position1:o.position,rotation1:o.rotation,shape2:{type:'sphere',radius:.006},velocity:[0,0,0]}),f=pair.input,base=i*16;header.set(new Uint32Array(f.buffer,0,10),base);header[base+10]=fword(f[20]);header[base+11]=header.length;header[base+12]=0xffffffff;
  if(o.shape.type==='convex'){
   if(!o.shape.nativeTopology||!pointQuery)throw new TypeError('Original admitted convex topology required');const packed=pointQuery.packQuery({hull:o.shape.nativeTopology,point:[0,0,0]});
   if(JSON.stringify(o.shape.points)!==JSON.stringify(o.shape.nativeTopology.points))throw new RangeError('Support points must retain native topology index order');
   header[base+11]=words;const support=new Uint32Array(pair.hulls.buffer).slice();chunks.push(support);words+=support.length;header[base+12]=words;const topology=new Uint32Array(packed.hulls.buffer).slice();chunks.push(topology);words+=topology.length;
  }
 });
 const data=new Uint32Array(words);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}return Object.freeze({words:data,obstacleCount:obstacles.length,obstacleStride:16,obstacleOffset:0,immutable:true});
}
/** Resident source-order roster/aggregate, to wrap contact/cast stage pipelines.
 * rc_state/rc_geometry plus source-number WGSL are supplied by caller. A failed
 * query becomes unsupported; no query-null or failure is fabricated as a miss.
 */
export function generateRawClearanceControlWGSL(){return /* wgsl */ `
fn rc_clearance_skip(cb:u32)->bool{return rc_state[cb+1u]/3u==rc_state[cb+3u]&&rc_state[cb+1u]%3u==2u;}
fn rc_clearance_active(cb:u32)->bool{return rc_state[cb]==0u&&!rc_clearance_skip(cb);}
fn rc_clearance_load64(at:u32)->RcF64{return RcF64(rc_state[at],rc_state[at+1u]);}
fn rc_clearance_store64(at:u32,x:RcF64){rc_state[at]=x.x;rc_state[at+1u]=x.y;}
fn rc_clearance_init(cb:u32,selected:u32){for(var i=0u;i<16u;i++){rc_state[cb+i]=0u;}rc_state[cb+3u]=selected;rc_state[cb+9u]=0xffffffffu;rc_clearance_store64(cb+4u,${F(.1)});rc_clearance_store64(cb+6u,${F(.1)});}
fn rc_clearance_obstacle(cb:u32,geometry:u32)->u32{return geometry+(rc_state[cb+1u]/3u)*16u;}
fn rc_clearance_hull(cb:u32,geometry:u32)->u32{return geometry+rc_geometry[rc_clearance_obstacle(cb,geometry)+11u];}
fn rc_clearance_point_hull(cb:u32,geometry:u32)->u32{let x=rc_geometry[rc_clearance_obstacle(cb,geometry)+12u];if(x==0xffffffffu){return x;}return geometry+x;}
fn rc_clearance_prepare(raw:u32,cb:u32,qb:u32,geometry:u32){
 if(!rc_clearance_active(cb)){return;}let obstacle=rc_clearance_obstacle(cb,geometry);let part=raw+72u+(rc_state[cb+1u]%3u)*16u;let sample=rc_state[cb+2u];for(var i=0u;i<32u;i++){rc_state[qb+i]=0u;}
 for(var i=0u;i<10u;i++){rc_state[qb+i]=rc_geometry[obstacle+i];}var position=part;if(sample<3u){position=part+3u+sample*3u;}for(var i=0u;i<3u;i++){rc_state[qb+10u+i]=rc_state[position+i];rc_state[qb+24u+i]=rc_state[raw+68u+i];}
 for(var i=0u;i<4u;i++){rc_state[qb+13u+i]=rc_state[raw+64u+i];}let kind=rc_state[part+12u];if(kind==0x40400000u){rc_state[qb+17u]=rc_state[part+14u];}else{rc_state[qb+17u]=rc_state[part+13u];rc_state[qb+18u]=rc_state[part+14u];}
 rc_state[qb+20u]=rc_geometry[obstacle+10u];rc_state[qb+21u]=kind;rc_state[qb+22u]=select(0x3dcccccdu,0x7f7fffffu,sample==3u);
}
fn rc_clearance_reduce_contact(cb:u32,output:u32){
 if(rc_state[cb]!=0u){return;}if(rc_clearance_skip(cb)){rc_state[cb+2u]++;return;}rc_state[cb+10u]++;let status=bitcast<f32>(rc_state[output]);
 if(status!=0.0&&status!=1.0){rc_state[cb]=3u;rc_state[cb+12u]=4u;return;}
 if(status==1.0){let distance=rc_f64_from_f32_bits(rc_state[output+1u]);if(!rc_f64_finite(distance)){rc_state[cb]=3u;rc_state[cb+12u]=5u;return;}let gap=rc_clearance_load64(cb+6u);if(rc_f64_lt(distance,gap)){rc_clearance_store64(cb+6u,distance);}}
 rc_state[cb+2u]++;
}
fn rc_clearance_reduce_cast(cb:u32,output:u32,obstacleCount:u32){
 if(rc_state[cb]!=0u){return;}if(!rc_clearance_skip(cb)){rc_state[cb+11u]++;let status=bitcast<f32>(rc_state[output]);if(status!=0.0&&status!=1.0){rc_state[cb]=3u;rc_state[cb+12u]=4u;return;}
  if(status==1.0){let gap=rc_clearance_load64(cb+6u);if(rc_f64_lt(${F(-1e-7)},gap)){rc_clearance_store64(cb+6u,${F(-1e-7)});}rc_state[cb+8u]=1u;}
  let gap=rc_clearance_load64(cb+6u);if(rc_f64_lt(gap,rc_clearance_load64(cb+4u))){rc_clearance_store64(cb+4u,gap);rc_state[cb+9u]=rc_state[cb+1u]/3u;}
 }
 rc_state[cb+1u]++;rc_state[cb+2u]=0u;rc_clearance_store64(cb+6u,${F(.1)});
 if(rc_state[cb+1u]>=obstacleCount*3u){if(rc_f64_lt(rc_clearance_load64(cb+4u),${F(0)})){rc_state[cb]=2u;rc_state[cb+12u]=3u;}else{rc_state[cb]=1u;rc_state[cb+9u]=0xffffffffu;}}
}
`;}

/** Build common source and immutable data for GPU-only raw initialization plus
 * full source clearance. This does not create bodies, simulate h or claim a
 * terminal game result. The owner compiles each unique stage once, then records
 * the fixed schedule in bounded submissions with NO candidate readback. */
export function buildRawPreparationPlan({query,pointQuery,pointStageGenerator,obstacles,center,selectedObstacleIndex,selectedInputIndex=0,storageLoops=false}={}){
 if(!Array.isArray(center)||center.length!==3||!center.every(Number.isFinite)||!Number.isInteger(selectedObstacleIndex)||selectedObstacleIndex<0||selectedObstacleIndex>=obstacles?.length||!Number.isInteger(selectedInputIndex))throw new TypeError('Fixed original prestrike selection/center required');
 if(typeof pointStageGenerator!=='function')throw new TypeError('Original resident convex point stage generator required');
 const program=compileRawStrikeProgram({clearanceGeometry:true}),geometry=packClearanceObstacles(pointQuery,obstacles),layout={registers:0,programControl:program.registerWords,raw:program.registerWords+program.controlWords};layout.clearance=layout.raw+program.outputWords;layout.query=layout.clearance+16;layout.output=layout.query+32;layout.metadata=layout.output+16;layout.stateWords=layout.metadata+16;layout.scratchWords=13632;
 const bindings=`@group(0) @binding(0) var<storage,read> rc_inputs:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read> rc_program:array<u32>;
@group(0) @binding(3) var<storage,read> rc_geometry:array<u32>;
@group(0) @binding(4) var<storage,read_write> rc_scratch:array<u32>;
`,control=generateRawClearanceControlWGSL(),numbers=generateSourceNumberWGSL();
 const wrap=(source,body)=>bindings+source+`\n@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=arrayLength(&rc_inputs)/16u){return;}let base=gid.x*${layout.stateWords}u;let cb=base+${layout.clearance}u;let qb=base+${layout.query}u;let ob=base+${layout.output}u;let mb=base+${layout.metadata}u;let sb=gid.x*${layout.scratchWords}u;${body}}`;
 const vm=generateRawStrikeProgramWGSL(),stages={
  'raw-init':wrap(vm,`rc_raw_program_init(0u,base,base+${layout.programControl}u,gid.x*16u,array<RcF64,3>(${center.map(F).join(',')}));`),
  'raw-step':wrap(vm,`rc_raw_program_step(0u,base,base+${layout.programControl}u,256u);`),
  'raw-finish':wrap(vm+control,`rc_raw_program_finish(0u,base,base+${layout.programControl}u,base+${layout.raw}u);rc_clearance_init(cb,${selectedObstacleIndex}u);if(rc_state[base+${layout.raw}u]!=1u){rc_state[cb]=3u;rc_state[cb+12u]=rc_state[base+${layout.raw+1}u];}else if(rc_inputs[gid.x*16u+12u]!=${selectedInputIndex}u){rc_state[base+${layout.raw}u]=4u;rc_state[base+${layout.raw+1}u]=6u;rc_state[cb]=3u;rc_state[cb+12u]=6u;}`)
 };
 for(const stage of ['init','gjk','epa','finish']){
  const source=numbers+control+generateRawContactQueryWGSL(query,stage,{pointStageCode:pointStageGenerator(stage==='gjk'&&storageLoops?'gjk-loop':stage),storageLoop:storageLoops});let body=stage==='init'?`rc_clearance_prepare(base+${layout.raw}u,cb,qb,0u);`:'';
  body+=`if(rc_clearance_active(cb)){rc_raw_contact_stage(sb,qb,ob,rc_clearance_hull(cb,0u),mb,rc_clearance_point_hull(cb,0u));}`;if(stage==='finish')body+='rc_clearance_reduce_contact(cb,ob);';stages['contact-'+stage]=wrap(source,body);
 }
 for(const stage of RAW_CAST_LAYOUT.stages){const source=numbers+control+generateRawCastQueryWGSL(query,stage,{storageLoop:storageLoops});let body=stage==='init'?`rc_clearance_prepare(base+${layout.raw}u,cb,qb,0u);`:'';body+=`if(rc_clearance_active(cb)){rc_raw_cast_stage(sb,qb,ob,rc_clearance_hull(cb,0u),mb);}`;if(stage==='finish')body+=`rc_clearance_reduce_cast(cb,ob,${geometry.obstacleCount}u);`;stages['cast-'+stage]=wrap(source,body);}
 const initialSchedule=Object.freeze([{stage:'raw-init',repeat:1},{stage:'raw-step',repeat:Math.ceil(program.maximumInstructions/256)},{stage:'raw-finish',repeat:1}]);
 const pairSchedule=[];for(let sample=0;sample<3;sample++)pairSchedule.push({stage:'contact-init',repeat:1},{stage:'contact-gjk',repeat:storageLoops?1:256},{stage:'contact-epa',repeat:1},{stage:'contact-finish',repeat:1});pairSchedule.push({stage:'cast-init',repeat:1},{stage:'cast-cast',repeat:storageLoops?1:100},{stage:'cast-contact-init',repeat:1},{stage:'cast-contact-gjk',repeat:storageLoops?1:256},{stage:'cast-contact-epa',repeat:1},{stage:'cast-finish',repeat:1});
 return Object.freeze({program,geometry,layout:Object.freeze(layout),stages:Object.freeze(stages),bindingTypes:Object.freeze(['read-only-storage','storage','read-only-storage','read-only-storage','storage']),initialSchedule,pairSchedule:Object.freeze(pairSchedule),pairCount:obstacles.length*3,
  dispatches:initialSchedule.reduce((s,x)=>s+x.repeat,0)+obstacles.length*3*pairSchedule.reduce((s,x)=>s+x.repeat,0),fullPhysics:false,nativeAllocation:false,sourceProfile:RAW_STRIKE_CAPABILITY.numberProfile});
}

