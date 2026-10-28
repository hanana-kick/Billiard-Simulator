/** Canonical encoded-state admission, not a discrete energy theorem.
 * Norms are compared as exact Q48 wide squares; no narrowing, sqrt, or clipping.
 * Position/material/time/uncertainty limits belong to their separate callers.
 */
import {multiplyWide} from './deterministic-axial.mjs';
export const CANONICAL_STATE_DOMAIN_VERSION=0x43534401;
export const CANONICAL_LINEAR_LIMIT=8*2**24;
export const CANONICAL_SPIN_LIMIT=16*2**24;
export function canonicalPositionWithin(v,limit=4*2**24){return v?.length===3&&Number.isInteger(limit)&&limit>=0&&limit<=0x7fffffff&&Array.from(v).every(x=>Number.isInteger(x)&&x>=-limit&&x<=limit);}
export function canonicalNormWithin(v,limit){
 if(!Number.isInteger(limit)||limit<0||limit>CANONICAL_SPIN_LIMIT||!canonicalPositionWithin(v,limit))return false;
 let lo=0,hi=0;for(const x of v){const p=multiplyWide(Math.abs(x),Math.abs(x)),sum=lo+p[0];lo=sum>>>0;hi+=p[1]+(sum>0xffffffff?1:0);}
 const bound=multiplyWide(limit,limit);return hi<bound[1]||(hi===bound[1]&&lo<=bound[0]);
}
export function canonicalVelocitySpinWithin(v,q){return canonicalNormWithin(v,CANONICAL_LINEAR_LIMIT)&&canonicalNormWithin(q,CANONICAL_SPIN_LIMIT);}
/** Requires the existing exact wide(u32,u32) helper; defines no mutable flags. */
export const CANONICAL_STATE_DOMAIN_WGSL=`
const CANONICAL_LINEAR_LIMIT:i32=134217728;
const CANONICAL_SPIN_LIMIT:i32=268435456;
fn canonicalPositionWithin(v:vec3<i32>,limit:i32)->bool{return limit>=0&&all(v>=vec3<i32>(-limit))&&all(v<=vec3<i32>(limit));}
fn canonicalNormWithin(v:vec3<i32>,limit:i32)->bool{
 if(limit<0||limit>CANONICAL_SPIN_LIMIT||!canonicalPositionWithin(v,limit)){return false;}
 var low=0u;var high=0u;for(var j=0u;j<3u;j++){let p=wide(u32(abs(v[j])),u32(abs(v[j])));let sum=low+p.x;high+=p.y+select(0u,1u,sum<low);low=sum;}
 let bound=wide(u32(limit),u32(limit));return high<bound.y||(high==bound.y&&low<=bound.x);
}
fn canonicalVelocitySpinWithin(v:vec3<i32>,q:vec3<i32>)->bool{return canonicalNormWithin(v,CANONICAL_LINEAR_LIMIT)&&canonicalNormWithin(q,CANONICAL_SPIN_LIMIT);}
`;
