/** Opt-in composition only. The owning world supplies immutable actual materials
 * and original descriptors; this module cannot authorize a contact by an ID. */
import {runCushionResolverCPU} from './deterministic-cushion-resolver.mjs';
import {prepareMixedMotionDescriptorsCPU} from './deterministic-mixed-motion-query.mjs';
import {packVerifiedCushionRailMap} from './deterministic-world-cushion-commit.mjs';
const Q=2**24;
export function worldCushionSettings(scene,hulls,context,options){
 if(options.enableCushionContinuation!==undefined&&typeof options.enableCushionContinuation!=='boolean')throw TypeError('Explicit boolean cushion continuation option');
 if(!options.enableCushionContinuation)return null;
 const sc=new Int32Array(scene.buffer,scene.byteOffset),c=new Int32Array(context.buffer,context.byteOffset);
 const material={mass:sc[3]/Q,restitution:options.cushionRestitution,friction:options.cushionFriction,clothRestitution:options.clothRestitution,clothFriction:sc[13]/Q};
 if(![material.restitution,material.friction,material.clothRestitution,material.clothFriction].every(x=>Number.isFinite(x)&&x>=0&&x<=1))throw RangeError('Explicit immutable actual cushion and cloth coefficients required');
 return {material:Object.freeze(material),rails:packVerifiedCushionRailMap(hulls,Array.from(c.slice(9,13))),releaseTicks:64,maxNodes:options.tailMaxNodes??256};
}
export function resolveWorldCushionCPU(prepared,smooth,scene,hulls,context,settings,journal,captureSourceDescriptors=false){
 if(!settings||prepared.state[1]!==7||![6,7].includes(prepared.state[2]))return;
 const descriptors=prepareMixedMotionDescriptorsCPU(prepared,prepared.rows,smooth,context),result=runCushionResolverCPU(prepared,descriptors,scene,hulls,context,settings.rails,settings.material,settings);
 if(captureSourceDescriptors)prepared.sourceDescriptors=descriptors;
 prepared.cushionAttempt=result;
 if(!result.committed&&!result.cleared)return;
 if(result.committed)journal?.capture(result.impact.state);
 Object.assign(prepared,result,{kind:result.committed?'finite-cushion':'finite-cushion-clear',cushionImpactState:result.impact?.state});
 if(prepared.state[1]===1)prepared.state[1]=12;
}
/** Consume a newly committed impact or complete source-bound event-free CLEAR;
 * inactive/failed admissions leave the original pending state intact. Successful
 * continuations wait for the next world iteration rather than being reused here. */
export const WORLD_CUSHION_ROUTE_COMMIT_WGSL=`
@group(0) @binding(0) var<storage,read_write> state:array<u32>;
@group(0) @binding(1) var<storage,read_write> dense:array<u32>;
@group(0) @binding(2) var<storage,read> result:array<u32>;
@group(0) @binding(3) var<storage,read> resultDense:array<u32>;
@compute @workgroup_size(1) fn main(){if(state[1]!=7u||(state[2]!=6u&&state[2]!=7u)){return;}let impact=result[61]==state[61]+1u;let clear=result[1]==1u&&result[56]==state[56]+1u&&result[61]==state[61]&&result[62]==state[62]&&result[63]==state[63]&&result[21]==state[21]&&result[45]==state[45]&&state[4]>0u&&result[5]==state[5]+state[4];if(!impact&&!clear){return;}for(var i=0u;i<256u;i++){state[i]=result[i];dense[i]=resultDense[i];}if(state[1]==1u){state[1]=12u;}}
`;
