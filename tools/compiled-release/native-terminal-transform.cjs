'use strict';
const assert=require('node:assert/strict');
const declaration='var<workgroup> fused_terminal_flag:u32;\n';
const check='if(repeat+1u<repetitions){if(id.x==0u){var terminal=1u;for(var row=0u;row<4u;row++){let b=row*64u;if(scratch[b+2u]!=0||(input[b+3u]!=0&&output[b+3u]==0)){terminal=0u;}}fused_terminal_flag=terminal;}let terminal_uniform=workgroupUniformLoad(&fused_terminal_flag);if(terminal_uniform!=0u){break;}}';
const tail='fused_phase_10_main(id);storageBarrier();}}';
function transform(code){assert.equal(code.split(tail).length,2,'Expected exact final phase10/iteration tail');assert.ok(!code.includes('fused_terminal_flag'));assert.ok(code.includes('@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let repetitions=fused_parameters.x;if(repetitions!=1u&&repetitions!=16u){return;}for(var repeat=0u;repeat<repetitions;repeat++){'));const next=declaration+code.replace(tail,'fused_phase_10_main(id);storageBarrier();'+check+'}}');assert.equal(reverse(next),code);return next;}
function reverse(code){assert.ok(code.startsWith(declaration));assert.equal(code.split(check).length,2);return code.slice(declaration.length).replace(check,'');}
module.exports={transform,reverse,declaration,check};
