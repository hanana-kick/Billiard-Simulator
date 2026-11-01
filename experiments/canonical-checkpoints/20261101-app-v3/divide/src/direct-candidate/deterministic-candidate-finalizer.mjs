/** Compact result only. Status: 1 PASS, 2 FAIL, 3 INCOMPLETE, 4 UNSUPPORTED,
 * 5 irreversible condition-only FAIL proof (not final gameplay/trajectory).
 * Score is signed i32 bits; 0x80000000 means unavailable, NOT 0xffffffff (-1).
 * Inputs are private validated producer buffers, not caller-asserted proof records.
 */
export const NULL_CANDIDATE_SCORE=0x80000000;
export function finalizeCandidateCPU(id,physicalStatus,rule,config){
 const out=new Uint32Array([id,4,4,NULL_CANDIDATE_SCORE]);
 if(config[10]===1&&rule[29]===1){out[1]=5;out[2]=7;return out;}
 if(physicalStatus===5){out[1]=3;out[2]=3;return out;}
 if(physicalStatus!==3||rule[13]!==1)return out;
 const game=rule[18],search=rule[19];
 if(game===1||game===2)out[3]=config[0]===4&&rule[3]!==0?0xffffffff:game===1?1:0;
 if(game===3){out[1]=3;out[2]=3;return out;}
 if(game!==1&&game!==2){out[2]=6;return out;}
 if(game===2){out[1]=2;out[2]=1;return out;}
 if(config[5]!==0&&search!==1&&search!==2){out[1]=search===3?3:4;out[2]=search===3?3:5;return out;}
 out[1]=game===1&&(config[5]===0||search===1)?1:2;out[2]=out[1]===1?0:game===2?1:2;return out;
}
export function finalizeCandidatesCPU(state,rules,config){const out=new Uint32Array(state.length/160*4);for(let i=0;i<state.length/160;i++)out.set(finalizeCandidateCPU(state[i*160+1],state[i*160+2],rules.subarray(i*32,i*32+32),config),i*4);return out;}
export const CANDIDATE_FINALIZER_WGSL=`
@group(0) @binding(0) var<storage,read> state:array<u32>;
@group(0) @binding(1) var<storage,read> rules:array<u32>;
@group(0) @binding(2) var<storage,read> config:array<u32>;
@group(0) @binding(3) var<storage,read_write> result:array<vec4<u32>>;
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*160u;if(b>=arrayLength(&state)){return;}let r=id.x*32u;var out=vec4<u32>(state[b+1u],4u,4u,0x80000000u);
 if(config[10]==1u&&rules[r+29u]==1u){out.y=5u;out.z=7u;result[id.x]=out;return;}
 if(state[b+2u]==5u){out.y=3u;out.z=3u;result[id.x]=out;return;}
 if(state[b+2u]!=3u||rules[r+13u]!=1u){result[id.x]=out;return;}
 let game=rules[r+18u];let search=rules[r+19u];
 if(game==1u||game==2u){out.w=select(0u,1u,game==1u);if(config[0]==4u&&rules[r+3u]!=0u){out.w=0xffffffffu;}}
 if(game==3u){out.y=3u;out.z=3u;result[id.x]=out;return;}
 if(game!=1u&&game!=2u){out.z=6u;result[id.x]=out;return;}
 if(game==2u){out.y=2u;out.z=1u;result[id.x]=out;return;}
 if(config[5]!=0u&&search!=1u&&search!=2u){out.y=select(4u,3u,search==3u);out.z=select(5u,3u,search==3u);result[id.x]=out;return;}
 out.y=select(2u,1u,game==1u&&(config[5]==0u||search==1u));out.z=select(select(2u,1u,game==2u),0u,out.y==1u);result[id.x]=out;
}`;
