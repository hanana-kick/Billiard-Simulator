/** Source-owned bounds staging; exact isolated GPU-compared arithmetic. */
import {MIXED_V2_HULL_ENTRY_WGSL as original,MIXED_V2_HULL_MOTION_WGSL} from './deterministic-mixed-cushion-v2-gpu.mjs';
import {CUSHION_POINT_WGSL} from './deterministic-cushion-geometry.mjs';
import {linkResidentWGSL} from '../resident-candidate/wgsl-linker.mjs';
const precompute=`
@group(0) @binding(0) var<storage,read> rows:array<u32>;
@group(0) @binding(1) var<storage,read> scene:array<u32>;
@group(0) @binding(2) var<storage,read> ledger:array<u32>;
@group(0) @binding(3) var<storage,read> config:array<u32>;
@group(0) @binding(4) var<storage,read_write> endpointCache:array<u32>;
${CUSHION_POINT_WGSL}
${MIXED_V2_HULL_MOTION_WGSL}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let slot=gid.x;if(slot>=19u){return;}let at=1024u+16u*slot;
 for(var j=0u;j<16u;j++){endpointCache[at+j]=0u;}
 if(ledger[1]!=6u||ledger[4]>=128u){return;}let z=32u+8u*ledger[4];let body=ledger[z+1u];let n=config[0];
 if(ledger[z]!=2u||ledger[z+2u]!=config[1]||body>=n||n<3u||n>4u||arrayLength(&rows)!=n*80u||config[2]<1u||config[2]>256u){return;}
 var lo=ledger[z+4u];var hi=lo;
 if(slot!=0u){let endpointSlot=select(slot,slot-9u,slot>=10u);let width=1u<<(endpointSlot-1u);if(width>config[2]){return;}hi=min(ledger[2],ledger[z+5u]+width-1u);if(slot<10u){lo=hi;}}
 bad=false;let value=mb(body,lo,hi);
 endpointCache[at]=select(0u,1u,value.valid);endpointCache[at+1u]=select(0u,1u,bad);
 for(var j=0u;j<6u;j++){endpointCache[at+2u+j]=bitcast<u32>(value.p[j]);endpointCache[at+8u+j]=bitcast<u32>(value.v[j]);}
 endpointCache[at+14u]=lo;endpointCache[at+15u]=hi;
}`;
const reader=`
fn cachedMixedBounds(slot:u32,lo:u32,hi:u32)->MixedBounds{
 var value:MixedBounds;value.valid=false;if(slot>=19u){bad=true;return value;}let at=1024u+16u*slot;
 if(endpointCache[at+14u]!=lo||endpointCache[at+15u]!=hi){bad=true;return value;}
 value.valid=endpointCache[at]==1u;bad=endpointCache[at+1u]!=0u;
 for(var j=0u;j<6u;j++){value.p[j]=bitcast<i32>(endpointCache[at+2u+j]);value.v[j]=bitcast<i32>(endpointCache[at+8u+j]);}return value;
}
`;
let entry=original.replace('fn hc(i:u32)',reader+'\nfn hc(i:u32)').replace('arrayLength(&endpointCache)==1024u','arrayLength(&endpointCache)==1536u');
for(const[a,b]of [['mb(body,lo,lo)','cachedMixedBounds(0u,lo,lo)'],['mb(body,hi,hi)','cachedMixedBounds(endpointSlot,hi,hi)'],['mb(body,lo,hi)','cachedMixedBounds(endpointSlot+9u,lo,hi)']]){if(entry.split(a).length!==2)throw Error('exact call required: '+a);entry=entry.replace(a,b);}
export const HULL_STAGED_CACHE_WORDS=1536;
export const HULL_ENTRY_STAGED_WGSL=Object.freeze([precompute,entry].map(code=>linkResidentWGSL([code]).code));
