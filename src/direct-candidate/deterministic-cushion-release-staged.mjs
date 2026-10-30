/** Source-owned ordered mb→mb→hs staging. Never merges independent bad flags. */
import {CUSHION_RELEASE_V2_WGSL as original} from './deterministic-cushion-release-v2.mjs';
import {linkResidentWGSL} from '../resident-candidate/wgsl-linker.mjs';
const marker='@compute @workgroup_size(1) fn main(){',start=original.indexOf(marker),arithmetic=original.indexOf('let b=body*80u;let radius=',start);if(start<0||arithmetic<0)throw Error('Original release structure');
let guard=original.slice(start+marker.length,arithmetic);
const init=guard.indexOf('if(config[3]==0u){');if(init<0)throw Error('Original release initialization missing');let at=guard.indexOf('{',init)+1,depth=1;for(;depth&&at<guard.length;at++)depth+=(guard[at]==='{')-(guard[at]==='}');if(depth)throw Error('Unclosed original release initialization');guard=guard.slice(0,init)+guard.slice(at);guard=guard.replaceAll(/fail\(\d+u\);/g,'');if(guard.includes('proof['))throw Error('Precompute must not publish proof');
const temp='\n@group(0) @binding(7) var<storage,read_write> staged:array<u32>;\n';
const header=original.slice(0,start)+temp;
const precompute=header+marker+`
for(var j=0u;j<64u;j++){staged[j]=0u;}
${guard}
bad=false;
// One call site, ordered evaluations with the original shared private bad state.
for(var slot=0u;slot<2u;slot++){let value=mb(body,select(0u,h,slot==1u),h);let outAt=slot*16u;staged[outAt]=select(0u,1u,value.valid);for(var j=0u;j<6u;j++){staged[outAt+1u+j]=bitcast<u32>(value.p[j]);staged[outAt+7u+j]=bitcast<u32>(value.v[j]);}}
let sample=hs(body,h);staged[32]=select(0u,1u,sample.valid);for(var j=0u;j<3u;j++){staged[33u+j]=bitcast<u32>(sample.p[j]);staged[36u+j]=bitcast<u32>(sample.v[j]);staged[39u+j]=bitcast<u32>(sample.q[j]);}staged[42]=select(0u,1u,bad);staged[43]=1u;staged[44]=body;staged[45]=h;
}`;
const reader=`
fn stagedBounds(slot:u32)->MixedBounds{var value:MixedBounds;let at=slot*16u;value.valid=staged[at]==1u;for(var j=0u;j<6u;j++){value.p[j]=bitcast<i32>(staged[at+1u+j]);value.v[j]=bitcast<i32>(staged[at+7u+j]);}return value;}
fn stagedState()->HullState{var value:HullState;value.valid=staged[32]==1u;for(var j=0u;j<3u;j++){value.p[j]=bitcast<i32>(staged[33u+j]);value.v[j]=bitcast<i32>(staged[36u+j]);value.q[j]=bitcast<i32>(staged[39u+j]);}return value;}
`;
const chain='bad=false;let whole=mb(body,0u,h);let endpoint=mb(body,h,h);let sample=hs(body,h);';if(original.split(chain).length!==2)throw Error('Original release arithmetic chain changed');
const residual=original.slice(0,start)+temp+reader+original.slice(start).replace(chain,'bad=false;let whole=stagedBounds(0u);let endpoint=stagedBounds(1u);let sample=stagedState();bad=staged[42]!=0u;if(staged[43]!=1u||staged[44]!=body||staged[45]!=h){fail(6u);return;}');
export const RELEASE_STAGED_TEMP_WORDS=64;
export const CUSHION_RELEASE_STAGED_WGSL=Object.freeze([precompute,residual].map(code=>linkResidentWGSL([code]).code));
