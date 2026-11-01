/** Experimental exact per-source-invocation frames. No source workgroup/shared
 * constructs are admitted by the companion plan builder; logical gid is data.
 * Physical VM workgroups do not supply source workgroup semantics. */
import{integerKernelWGSL}from'./integer-core.mjs';
export function parallelIntegerKernelWGSL(){
 let s=integerKernelWGSL({locals:1,stack:1,stride:18,instructions:1});
 const old='@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){\nif(any(groups!=vec3<u32>(1u))){if(all(gid==vec3<u32>(0u))&&arrayLength(&state)>=4u){state[2u]=3u;state[3u]=10u;}return;}';
 if(!s.includes(old))throw Error('Exact audited integer transport template required');
 s=s.replace(old,'fn runLane(base:u32){').replace('arrayLength(&state)!=stateStride','arrayLength(&state)!=stateStride*dispatchInfo[0u]');
 s=s.replaceAll('state[','state[base+');
 const declarations='@group(0) @binding(5) var<storage,read> dispatchInfo:array<u32>;\n@group(0) @binding(6) var<storage,read_write> summary:array<u32>;\n';
 s=declarations+s;
 s+=`
fn dimensionsValid()->bool{return arrayLength(&dispatchInfo)==16u&&dispatchInfo[0u]>0u&&dispatchInfo[0u]<=65536u&&dispatchInfo[1u]==16u+dispatchInfo[2u]+dispatchInfo[3u]&&dispatchInfo[2u]>0u&&dispatchInfo[2u]<=1048576u&&dispatchInfo[3u]>0u&&dispatchInfo[3u]<=1048576u&&dispatchInfo[4u]>0u&&dispatchInfo[4u]<=1048576u&&dispatchInfo[5u]>0u&&dispatchInfo[5u]<=1048576u&&dispatchInfo[7u]>0u&&dispatchInfo[8u]>0u&&dispatchInfo[9u]>0u&&dispatchInfo[7u]<=65536u&&dispatchInfo[8u]<=65536u&&dispatchInfo[9u]<=65536u&&dispatchInfo[0u]==dispatchInfo[7u]*dispatchInfo[8u]*dispatchInfo[9u]&&arrayLength(&state)==dispatchInfo[0u]*dispatchInfo[1u]&&arrayLength(&summary)==dispatchInfo[0u]*4u&&arrayLength(&code)==dispatchInfo[4u]*8u;}
@compute @workgroup_size(32) fn initialize(@builtin(global_invocation_id) gid:vec3<u32>){
if(!dimensionsValid()||gid.x>=dispatchInfo[0u]){return;}let base=gid.x*dispatchInfo[1u];for(var i=0u;i<dispatchInfo[1u];i++){state[base+i]=0u;}state[base]=0x4349564du;state[base+1u]=1u;state[base+2u]=1u;state[base+10u]=dispatchInfo[2u];state[base+11u]=dispatchInfo[3u];state[base+12u]=dispatchInfo[4u];state[base+13u]=dispatchInfo[1u];state[base+14u]=dispatchInfo[5u];
if(dispatchInfo[6u]!=0xffffffffu){if(dispatchInfo[6u]>=dispatchInfo[2u]||3u>dispatchInfo[2u]-dispatchInfo[6u]){state[base+2u]=3u;state[base+3u]=11u;}else{let slot=base+16u+dispatchInfo[3u]+dispatchInfo[6u];state[slot]=gid.x%dispatchInfo[7u];state[slot+1u]=(gid.x/dispatchInfo[7u])%dispatchInfo[8u];state[slot+2u]=gid.x/(dispatchInfo[7u]*dispatchInfo[8u]);}}
summary[gid.x*4u]=state[base+2u];summary[gid.x*4u+1u]=state[base+3u];summary[gid.x*4u+2u]=0u;summary[gid.x*4u+3u]=0u;
}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
if(!dimensionsValid()||gid.x>=dispatchInfo[0u]){return;}let base=gid.x*dispatchInfo[1u];runLane(base);summary[gid.x*4u]=state[base+2u];summary[gid.x*4u+1u]=state[base+3u];summary[gid.x*4u+2u]=state[base+6u];summary[gid.x*4u+3u]=state[base+7u];}
`;
 return s;
}
