/* SPDX-License-Identifier: Apache-2.0
 * Opt-in integer implementation of ONLY the non-VM narrowphase scalars.
 * Original graph programs, cache lifecycle/order and all source caps remain
 * unchanged. The default narrowphase generator is intentionally not modified.
 */
import {generateNarrowphaseWGSL} from './narrowphase.mjs';
import {generateSourceNumberWGSL} from './source-number.mjs';
export const INTEGER_NARROWPHASE_CAPABILITY=Object.freeze({optIn:true,defaultBackend:false,nativeQualified:false,
 hardwareScalarArithmetic:false,sourceCacheLifecycle:true,sourceProducts:2,sourceMinima:2,
 pointProjectionQualified:false,wholeGeometryQualified:false,wholeWorldQualified:false});

/** Finite-operand domain follows successful rc_num_eval: all128 floor /320
 * pair input words are scanned before any instruction executes. Slots104/41
 * and137/129 are also multiplied by the original geometry graph; nonfinite
 * operands or an overflowing f32 product therefore fail BEFORE these updates.
 * Finite binary32 products have at most48 significant bits, all representable
 * exactly in binary64 (product exponents -298..256 cannot under/overflow64).
 * Software64 multiplication + exact RN-even32 conversion is thus exact here,
 * not a generic claim that arbitrary f64 intermediates cannot double-round.
 * Math.min preserves -0 when either equal-zero operand has its sign bit set.
 */
export function generateIntegerNarrowScalarsWGSL({includeSourceNumberLibrary=false}={}){
 return (includeSourceNumberLibrary?generateSourceNumberWGSL():'')+String.raw`
fn rc_narrow_scalar_mul(a:u32,b:u32)->u32{return rc_f64_to_f32_bits(rc_f64_mul(rc_f64_from_f32_bits(a),rc_f64_from_f32_bits(b)));}
fn rc_narrow_scalar_min(a:u32,b:u32)->u32{
 if(a==b||((a|b)&0x7fffffffu)==0u){return a|b;}let sa=a>>31u;let sb=b>>31u;
 if(sa!=sb){return select(b,a,sa!=0u);}return select(b,a,select(a<b,a>b,sa!=0u));
}
// Original Point.feature emits only kind0..3 and authenticated hull indices:
// points<32, faces<64, edges<96 (native topology exporter limits). Decode the
// exact nonnegative integral binary32 transport, never a hardware conversion.
// Reject invalid producer words rather than truncating NaN/fractions to a hit.
fn rc_narrow_feature_uint(word:u32,maximum:u32)->u32{
 if((word&0x7fffffffu)==0u){return 0u;}if((word&0x80000000u)!=0u){return 0xffffffffu;}
 let field=(word>>23u)&255u;if(field<127u||field>133u){return 0xffffffffu;}let shift=150u-field;let mantissa=(word&0x7fffffu)|0x800000u;
 if((mantissa&((1u<<shift)-1u))!=0u){return 0xffffffffu;}let value=mantissa>>shift;if(value>maximum){return 0xffffffffu;}return value;
}
`;
}
function replaceOnce(code,before,after){if(code.split(before).length!==2)throw Error('Original narrow scalar seam changed: '+before.slice(0,90));return code.replace(before,after);}
/** Requires the same rc_num_eval/rc_state/rc_scratch/rc_program as baseline;
 * caller selects its separately qualified integer VM profile. This generator
 * cannot qualify the still-independent convex point GJK/EPA implementation. */
export function generateIntegerNarrowphaseWGSL(programs,{includeSourceNumberLibrary=false}={}){
 let code=generateNarrowphaseWGSL(programs);
 for(const[product,a,b,drift,recycle]of[[119,104,41,95,118],[219,137,129,199,138]]){
  code=replaceOnce(code,`rc_state[base+${product}u]=bitcast<u32>(bitcast<f32>(rc_state[base+${a}u])*bitcast<f32>(rc_state[base+${b}u]));`,`rc_state[base+${product}u]=rc_narrow_scalar_mul(rc_state[base+${a}u],rc_state[base+${b}u]);`);
  code=replaceOnce(code,`rc_state[base+${drift}u]=select(bitcast<u32>(min(bitcast<f32>(rc_state[base+${recycle}u]),bitcast<f32>(rc_state[base+${product}u]))),rc_state[base+${recycle}u],isActive);`,`rc_state[base+${drift}u]=select(rc_narrow_scalar_min(rc_state[base+${recycle}u],rc_state[base+${product}u]),rc_state[base+${recycle}u],isActive);`);
 }
 // These IDs are freshly assigned above each seam, not arbitrary u32 inputs:
 // 0 or2^31. Both are exactly representable as32; spell out their bit words.
 for(const[dest,id]of[[114,136],[216,322]])code=replaceOnce(code,`rc_state[base+${dest}u]=bitcast<u32>(f32(rc_state[base+${id}u]));`,`rc_state[base+${dest}u]=select(0u,0x4f000000u,rc_state[base+${id}u]==0x80000000u);`);
 code=replaceOnce(code,'let kind=u32(bitcast<f32>(rc_state[projection+5u]));let index=u32(bitcast<f32>(rc_state[projection+6u]));if(kind>3u){rc_state[base+387u]=3u;return 3u;}',
  'let kind=rc_narrow_feature_uint(rc_state[projection+5u],3u);let index=rc_narrow_feature_uint(rc_state[projection+6u],95u);if(kind>3u||index==0xffffffffu){rc_state[base+387u]=3u;return 3u;}');
 const result=generateIntegerNarrowScalarsWGSL({includeSourceNumberLibrary})+code,executable=result.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 if(/\bf32\b|\bf16\b|\d+\.\d+/.test(executable))throw Error('Integer narrowphase retains a hardware floating expression');return result;
}
