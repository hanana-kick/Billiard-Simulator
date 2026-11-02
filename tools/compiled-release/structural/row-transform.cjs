'use strict';
const assert=require('node:assert/strict');
const oldHeader='@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){';
const newHeader='@compute @workgroup_size(8) fn main(@builtin(workgroup_id) group:vec3<u32>,@builtin(local_invocation_index) lane:u32){let row=group.x;let id=vec3<u32>(row*8u+lane,0u,0u);';
const oldCheck='if(repeat+1u<repetitions){if(id.x==0u){var terminal=1u;for(var row=0u;row<4u;row++){let b=row*64u;if(scratch[b+2u]!=0||(input[b+3u]!=0&&output[b+3u]==0)){terminal=0u;}}fused_terminal_flag=terminal;}let terminal_uniform=workgroupUniformLoad(&fused_terminal_flag);if(terminal_uniform!=0u){break;}}';
const newCheck='if(repeat+1u<repetitions){if(lane==0u){let b=row*64u;fused_terminal_flag=select(0u,1u,scratch[b+2u]==0&&(input[b+3u]==0||output[b+3u]!=0));}let terminal_uniform=workgroupUniformLoad(&fused_terminal_flag);if(terminal_uniform!=0u){break;}}';
function once(s,a,b){assert.equal(s.split(a).length,2,'Exact one source anchor: '+a);return s.replace(a,b);}
function transform(code){let s=once(code,oldHeader,newHeader);for(const p of[6,10])s=once(s,`fused_phase_${p}_main(id);storageBarrier();`,`if(lane==0u){fused_phase_${p}_main(vec3<u32>(row,0u,0u));}storageBarrier();`);s=once(s,oldCheck,newCheck);assert.equal(reverse(s),code);return s;}
function reverse(code){let s=once(code,newHeader,oldHeader);for(const p of[6,10])s=once(s,`if(lane==0u){fused_phase_${p}_main(vec3<u32>(row,0u,0u));}storageBarrier();`,`fused_phase_${p}_main(id);storageBarrier();`);return once(s,newCheck,oldCheck);}
module.exports={transform,reverse,oldHeader,newHeader,oldCheck,newCheck};
