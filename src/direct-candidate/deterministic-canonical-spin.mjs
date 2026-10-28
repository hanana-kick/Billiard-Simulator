import {canonicalVelocitySpinWithin} from './deterministic-state-domain.mjs';
/** Explicit canonical advancement modes: 0 generic polynomial, 3 exact rolling. */
export function validCanonicalSpinMode(mode,v,a,q,rate){return canonicalVelocitySpinWithin(v,q)&&(mode===0||(mode===3&&v[1]===0&&a[1]===0&&q[1]===0&&rate[1]===0&&q[0]===v[2]&&q[2]===-v[0]&&rate[0]===a[2]&&rate[2]===-a[0]));}
export function canonicalSpin(v,q,mode){return mode===3?[v[2],0,-v[0]]:q;}
/** Requires CANONICAL_STATE_DOMAIN_WGSL once in the containing shader. */
export const CANONICAL_SPIN_WGSL=`
fn validCanonicalSpinMode(mode:u32,v:vec3<i32>,a:vec3<i32>,q:vec3<i32>,rate:vec3<i32>)->bool{return canonicalVelocitySpinWithin(v,q)&&(mode==0u||(mode==3u&&v.y==0&&a.y==0&&q.y==0&&rate.y==0&&q.x==v.z&&q.z== -v.x&&rate.x==a.z&&rate.z== -a.x));}
fn canonicalSpin(v:vec3<i32>,q:vec3<i32>,mode:u32)->vec3<i32>{if(mode==3u){return vec3<i32>(v.z,0,-v.x);}return q;}
`;
