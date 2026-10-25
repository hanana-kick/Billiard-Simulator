/* SPDX-License-Identifier: Apache-2.0
 * Opt-in INTEGER_F32 BVH word variant. Source control/order/storage is copied
 * from bvh.mjs; ONLY the enumerated numerical expressions and transport types
 * change. This is not activation or qualification of any complete world path.
 */
import {generateBvhWGSL} from './bvh.mjs';
import {generateIntegerF32WGSL} from './integer-f32.mjs';
import {generateSourceNumberWGSL} from './source-number.mjs';
export const BVH_INTEGER_CAPABILITY=Object.freeze({optIn:true,nativeQualified:false,
 hardwareFloatArithmetic:false,hardwareFloatComparison:false,wordBoundary:true,
 sourceControlOrder:true,baselineChanged:false,otherGeometryQualified:false});
function closing(text,open,left='{',right='}'){
 let n=1,end=open+1;for(;n&&end<text.length;end++){if(text[end]===left)n++;else if(text[end]===right)n--;}if(n)throw Error('Original BVH source boundary changed');return end;
}
function fn(text,name){const start=text.indexOf('fn '+name+'(');if(start<0)throw Error('Original BVH helper missing '+name);return text.slice(start,closing(text,text.indexOf('{',start)));}
const predicates=`
fn rc_bvh_min(a:u32,c:u32)->u32{if(((a|c)&0x7fffffffu)==0u){return a|c;}return select(c,a,rc_num_lt_bits(a,c));}
fn rc_bvh_max(a:u32,c:u32)->u32{if(((a|c)&0x7fffffffu)==0u){return a&c;}return select(c,a,rc_num_lt_bits(c,a));}
fn rc_bvh_hit(a:RcBvhNode,c:RcBvhNode)->bool{for(var i=0u;i<3u;i++){if(rc_num_lt_bits(c.hi[i],a.lo[i])||rc_num_lt_bits(a.hi[i],c.lo[i])){return false;}}return true;}
fn rc_bvh_contains(a:RcBvhNode,c:RcBvhNode)->bool{for(var i=0u;i<3u;i++){if(rc_num_lt_bits(c.lo[i],a.lo[i])||rc_num_lt_bits(a.hi[i],c.hi[i])){return false;}}return true;}
fn rc_bvh_valid_box(lo:vec3<u32>,hi:vec3<u32>)->bool{for(var i=0u;i<3u;i++){if((lo[i]&0x7fffffffu)>0x447a0000u||(hi[i]&0x7fffffffu)>0x447a0000u||rc_num_lt_bits(hi[i],lo[i])){return false;}}return true;}
fn rc_bvh_le(a:u32,c:u32)->bool{return rc_num_lt_bits(a,c)||rc_num_eq_bits(a,c);}
fn rc_bvh_uint_word(a:u32)->u32{return rc_f64_to_f32_bits(rc_f64_from_u32(a));}
// Source Math.min(7,Math.max(0,Math.trunc(x))) on a finite f32. Source bin
// arithmetic is finite-gated; <=0 and >=7 are exact raw-word comparisons.
fn rc_bvh_bin_word(a:u32)->u32{if((a&0x80000000u)!=0u||a<0x3f800000u){return 0u;}if(a>=0x40e00000u){return 7u;}let exponent=((a>>23u)&255u)-127u;return ((a&0x7fffffu)|0x800000u)>>(23u-exponent);}
`;
/** New APIs use rc_ibvh_* and RcBvhWordNode (vec3<u32> AABB words), including
 * query/insert/update_leaf. Packed node, scratch and scheduler ABI is unchanged.
 * includeNumberLibrary=false requires the linked INTEGER_F32 software64 owner.
 * No conversion through hardware f32 is allowed at the caller boundary. */
export function generateBvhIntegerWGSL({includeNumberLibrary=true}={}){
 let code=generateBvhWGSL();
 const replace=(old,next,count=1)=>{const found=code.split(old).length-1;if(found!==count)throw Error('Original BVH numeric seam changed: '+old+' ('+found+')');code=code.split(old).join(next);};
 for(const name of['min','max','hit','contains','valid_box']){const replacement=fn(predicates,'rc_bvh_'+name);replace(fn(code,'rc_bvh_'+name),replacement);}
 for(const[name,op]of[['add',1],['sub',2],['mul',3],['div',4]]){
  const check=name==='div'?'if((rc_state[b+24u]&0x7f800000u)==0x7f800000u){rc_bvh_fail(b,2u);}':'';
  replace(fn(code,'rc_bvh_'+name),`fn rc_bvh_${name}(b:u32,a:u32,c:u32)->u32{rc_state[b+24u]=rc_num_soft_arithmetic(${op}u,a,c);${check}return rc_state[b+24u];}`);
 }
 // Every non-helper floating comparison is listed explicitly. Integer
 // topology/count/flag comparisons must not be changed by a broad regexp.
 replace('up0=a<c;','up0=rc_num_lt_bits(a,c);');replace('up1=a<c;','up1=rc_num_lt_bits(a,c);');
 replace('d0<0.0||d1<0.0','rc_num_lt_bits(d0,0u)||rc_num_lt_bits(d1,0u)');replace('if(d0<d1)','if(rc_num_lt_bits(d0,d1))');
 replace('let left=a<c||(a==c&&lc<rc);','let left=rc_num_lt_bits(a,c)||(rc_num_eq_bits(a,c)&&lc<rc);');
 replace('skin>=0.0&&skin<=1.0','rc_bvh_le(0u,skin)&&rc_bvh_le(skin,0x3f800000u)');replace('reinsert||skin>0.0','reinsert||rc_num_lt_bits(0u,skin)');
 replace('if(ext[1]>ext[axis])','if(rc_num_lt_bits(ext[axis],ext[1]))');replace('if(ext[2]>ext[axis])','if(rc_num_lt_bits(ext[axis],ext[2]))');
 replace('ext[axis]!=0.0','(ext[axis]&0x7fffffffu)!=0u',2);replace('if(cost<best)','if(rc_num_lt_bits(cost,best))');
 replace('bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(child)])<=bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(child+1u)])','rc_bvh_le(rc_state[rc_bvh_s(b,2790u)+(child)],rc_state[rc_bvh_s(b,2790u)+(child+1u)])');
 replace('itemScore<=bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(parent)])','rc_bvh_le(itemScore,rc_state[rc_bvh_s(b,2790u)+(parent)])');
 replace('score<=bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(parent)])','rc_bvh_le(score,rc_state[rc_bvh_s(b,2790u)+(parent)])');
 replace('f32(rc_bvh_count(a))','rc_bvh_uint_word(rc_bvh_count(a))');replace('f32(rc_bvh_count(c))','rc_bvh_uint_word(rc_bvh_count(c))');
 replace('u32(clamp(value,0.0,7.0))','rc_bvh_bin_word(value)');replace('var hi=-lo;','var hi=lo^vec3<u32>(0x80000000u);');
 // Transport-only casts become identities, including nested round-trip casts.
 for(;;){const m=/bitcast<(?:f32|u32)>\(/.exec(code);if(!m)break;const open=m.index+m[0].length-1,end=closing(code,open,'(',')');code=code.slice(0,m.index)+code.slice(open+1,end-1)+code.slice(end);}
 code=code.replace(/\bf32\b/g,'u32');
 const constants=new Map([['1000.0','0x447a0000u'],['8.0','0x41000000u'],['7.0','0x40e00000u'],['1.0','0x3f800000u'],['0.5','0x3f000000u'],['0.0','0u']]);
 code=code.replace(/\b\d+\.\d+\b/g,s=>{if(!constants.has(s))throw Error('Uninventoried BVH floating constant '+s);return constants.get(s);});
 code+='\n'+['rc_bvh_le','rc_bvh_uint_word','rc_bvh_bin_word'].map(name=>fn(predicates,name)).join('\n');
 code=code.replace(/\brc_bvh_/g,'rc_ibvh_').replace(/\bRcBvhNode\b/g,'RcBvhWordNode');
 const numeric=generateIntegerF32WGSL({includeSourceNumberLibrary:false}),helpers=['rc_num_eq_bits','rc_num_lt_bits','rc_num_widen','rc_num_soft_arithmetic'].map(name=>fn(numeric,name)).join('\n');
 const out='const RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=3u;\n'+(includeNumberLibrary?generateSourceNumberWGSL():'')+helpers+'\n'+code,clean=out.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
 if(/\bf32\b|\bf16\b|\d+\.\d+|\bbitcast\b/.test(clean))throw Error('Integer BVH contains residual floating transport/arithmetic');
 return out;
}
