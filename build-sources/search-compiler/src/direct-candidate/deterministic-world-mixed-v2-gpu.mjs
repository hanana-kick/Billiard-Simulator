/** Explicit MMQ2 world adapters. No numerical sampler is replaced here. */
import {WORLD_MIXED_RESOLVE_WGSL} from './deterministic-world-mixed-resolution.mjs';
// Reuse the qualified impulse commit, but never consume v1 dense full-clear:
// MMQ2 full-clear needs original rolling endpoints and authoritative stop records.
const clearStart=WORLD_MIXED_RESOLVE_WGSL.indexOf('if(query[1]==1){');
const clearEnd=WORLD_MIXED_RESOLVE_WGSL.indexOf('if(entry[1]!=1',clearStart);
if(clearStart<0||clearEnd<clearStart)throw Error('Audited world pair commit shape changed');
export const WORLD_MIXED_RESOLVE_V2_WGSL=(WORLD_MIXED_RESOLVE_WGSL.slice(0,clearStart)+WORLD_MIXED_RESOLVE_WGSL.slice(clearEnd)).replace('query[2]!=state[4]','query[2]!=state[4]||bitcast<u32>(query[0])!=0x4d4d5102u').replace('mode!=0&&mode!=1','mode!=0&&mode!=1&&mode!=3');
export const WORLD_MIXED_CLEAR_COMMIT_V2_WGSL=`
@group(0) @binding(0) var<storage,read_write> state:array<i32>;
@group(0) @binding(1) var<storage,read_write> dense:array<i32>;
@group(0) @binding(2) var<storage,read> rows:array<i32>;
@group(0) @binding(3) var<storage,read> advanced:array<i32>;
@group(0) @binding(4) var<storage,read> query:array<i32>;
@group(0) @binding(5) var<storage,read> ctx:array<i32>;
@compute @workgroup_size(1) fn main(){
 let h=advanced[2];

if(arrayLength(&state)!=256u){return;}if(arrayLength(&dense)!=256u){return;}if(arrayLength(&ctx)!=160u){return;}if(state[3]<3){return;}if(state[3]>4){return;}if(arrayLength(&rows)!=u32(state[3])*80u){return;}if(arrayLength(&advanced)!=160u){return;}if(arrayLength(&query)!=1056u){return;}if(state[8]!=state[5]){return;}if(ctx[13]!=1){return;}if(advanced[0]!=0x4d435001){return;}if(advanced[3]!=state[3]){return;}if((query[1]!=1&&query[1]!=6)){return;}if(query[11]!=h){return;}if((query[1]==6&&h==state[4])){return;}if(state[1]!=7){return;}if((state[2]!=6&&state[2]!=7)){return;}if(state[6]!= -1){return;}if(state[40]!=0){return;}if(h<=0){return;}if(h>state[4]){return;}if(query[0]!=0x4d4d5102){return;}if(query[2]!=state[4]){return;}if(advanced[1]!=1){return;}if(state[5]>2147483647-h){return;}if(state[5]+h>ctx[24]){return;}if(state[56]>=2147483647){return;}
var sourceValid=true;for(var i=0u;i<u32(state[3]);i++){let b=i*80u;let z=16u+i*32u;let w=64u+i*48u;let mode=state[w+40u];sourceValid=sourceValid & ((mode==0)|(mode==1)|(mode==3));sourceValid=sourceValid & (rows[b]==0x4d4d5102);sourceValid=sourceValid & (rows[b+4u]==state[w+22u]);sourceValid=sourceValid & (rows[b+17u]==state[w+23u]);sourceValid=sourceValid & (rows[b+5u]==1);sourceValid=sourceValid & (rows[b+7u]==i32(i));sourceValid=sourceValid & (rows[b+48u]==ctx[4]);sourceValid=sourceValid & (rows[b+49u]==ctx[8]);sourceValid=sourceValid & (rows[b+50u]==ctx[7]);sourceValid=sourceValid & (rows[b+6u]==state[5]);sourceValid=sourceValid & (rows[b+2u]==state[4]);sourceValid=sourceValid & (rows[b+3u]==state[w]);sourceValid=sourceValid & (advanced[z]==state[w]);sourceValid=sourceValid & (rows[b+1u]==mode);for(var j=0u;j<9u;j++){sourceValid=sourceValid & (rows[b+8u+j]==state[w+24u+j]);}if(mode==3){sourceValid=sourceValid & (ctx[5]>=0);sourceValid=sourceValid & (ctx[5]<=268435456);sourceValid=sourceValid & (ctx[6]>=0);sourceValid=sourceValid & (ctx[6]<=67108864);sourceValid=sourceValid & (rows[b+24u]==ctx[6]);sourceValid=sourceValid & (rows[b+25u]==0);sourceValid=sourceValid & (rows[b+26u]==0);sourceValid=sourceValid & (rows[b+27u]==0);sourceValid=sourceValid & (rows[b+28u]==0);sourceValid=sourceValid & (rows[b+29u]==ctx[16]);sourceValid=sourceValid & (rows[b+30u]==ctx[17]);sourceValid=sourceValid & (rows[b+31u]==min(ctx[18],ctx[19]));sourceValid=sourceValid & (rows[b+32u]==min(ctx[20],ctx[21]));sourceValid=sourceValid & (rows[b+33u]==ctx[22]);sourceValid=sourceValid & (2*ctx[6]<=7*ctx[5]);}}if(!sourceValid){return;}
 let originalH=state[4];for(var i=0u;i<256u;i++){dense[i]=0;}state[4]=h;state[5]+=h;state[8]=state[5];state[1]=12;state[2]=0;state[7]=0;state[56]++;state[60]=select(0,64,h<originalH);
 for(var i=0u;i<u32(state[3]);i++){let b=64u+i*48u;let z=16u+i*32u;let k=i*64u;for(var j=0u;j<9u;j++){state[b+24u+j]=advanced[z+1u+j];}for(var j=9u;j<15u;j++){state[b+j]=0;}state[b+39u]=1;var mode=rows[i*80u+1u];if(mode==3){mode=select(0,3,advanced[z+4u]!=0||advanced[z+6u]!=0);}else{mode=select(0,1,advanced[z+4u]!=0||advanced[z+6u]!=0||advanced[z+7u]!=0||advanced[z+9u]!=0);if(mode==1&&advanced[z+7u]==advanced[z+6u]&&advanced[z+9u]== -advanced[z+4u]&&2*ctx[6]<=7*ctx[5]){mode=3;}}state[b+40u]=mode;state[7]|=mode<<(2u*i);dense[k]=mode;dense[k+1u]=state[b+22u];for(var j=0u;j<3u;j++){dense[k+4u+j]=advanced[z+1u+j];dense[k+16u+j]=advanced[z+1u+j];dense[k+20u+j]=advanced[z+4u+j];dense[k+48u+j]=advanced[z+4u+j];dense[k+24u+j]=advanced[z+7u+j];}dense[k+28u]=advanced[z+16u];dense[k+30u]=advanced[z+17u];dense[k+32u]=advanced[z+18u];dense[k+34u]=advanced[z+19u];dense[k+36u]=advanced[z+20u];dense[k+37u]=advanced[z+22u];dense[k+38u]=advanced[z+21u];dense[k+40u]=advanced[z+23u];dense[k+41u]=1;}
}`;
/** Source-owned no-impulse result consumption, including bounded stop endpoints. */
export const WORLD_STOP_ROUTE_COMMIT_V2_WGSL=`
@group(0) @binding(0) var<storage,read_write> state:array<u32>;
@group(0) @binding(1) var<storage,read_write> dense:array<u32>;
@group(0) @binding(2) var<storage,read> result:array<u32>;
@group(0) @binding(3) var<storage,read> resultDense:array<u32>;
@compute @workgroup_size(1) fn main(){if(state[1]!=7u||(state[2]!=6u&&state[2]!=7u)||result[1]!=1u||result[56]!=state[56]+1u||result[61]!=state[61]||result[62]!=state[62]||result[63]!=state[63]||result[21]!=state[21]||result[45]!=state[45]||result[5]<=state[5]||result[5]-state[5]>state[4]||result[0]!=state[0]||result[3]!=state[3]||result[41]!=state[41]||result[42]!=state[42]||result[8]!=result[5]||result[4]!=result[5]-state[5]){return;}for(var i=0u;i<state[3];i++){let b=64u+i*48u;if(result[b]!=state[b]||result[b+22u]!=state[b+22u]||result[b+23u]!=state[b+23u]){return;}}for(var i=0u;i<256u;i++){state[i]=result[i];dense[i]=resultDense[i];}state[1]=12u;}
`;
export async function createWorldMixedAdaptersV2GPU(device,{onCompilePhase=()=>{}}={}){const codes=[WORLD_MIXED_RESOLVE_V2_WGSL,WORLD_MIXED_CLEAR_COMMIT_V2_WGSL,WORLD_STOP_ROUTE_COMMIT_V2_WGSL],pipelines=[];for(const [index,code] of codes.entries()){onCompilePhase(index);const module=device.createShaderModule({code});const info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipelines.push(await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}));}return{encode(e,index,buffers){const pass=e.beginComputePass();pass.setPipeline(pipelines[index]);pass.setBindGroup(0,device.createBindGroup({layout:pipelines[index].getBindGroupLayout(0),entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))}));pass.dispatchWorkgroups(1);pass.end();}};}

import {TUBE_CLEAR_WGSL} from './deterministic-tube-prefix.mjs';
import {WORLD_TAIL_MARK_WGSL} from './deterministic-world-stages.mjs';
import {RECUR_TAIL_COMMIT_WGSL} from './deterministic-recurring-stages.mjs';
/** Supported rolling paths use the original MMQ2 law, never a fitted tube. */
// A bridge+rolling prefix may commit only when ORIGINAL swept boxes clear every
// object/rail for its whole duration. Failed boxes remain unresolved (98); the
// no-bridge rolling route still uses original MMQ2 event queries.
export const WORLD_SUPPORTED_CLEAR_V2_WGSL=TUBE_CLEAR_WGSL
 .replace('if(state[1]!=0){return;}','if(state[1]!=0){return;}var mixedBridge=false;for(var body=0u;body<u32(state[3]);body++){if(state[64u+body*48u+40u]==3){if(state[40]==0){state[1]=7;state[2]=6;return;}mixedBridge=true;}}')
 .replace('state[2]=reason;return;','state[2]=select(reason,98,mixedBridge);return;');
// Backend-portability candidate: execute the exact existing early routing guard
// in a small dispatch before the unchanged supported-clear body. No acceptance
// predicate, arithmetic, allocation, or physics budget is relaxed.
const supportedClearEntry=WORLD_SUPPORTED_CLEAR_V2_WGSL.indexOf('@compute @workgroup_size(1) fn main(){');
const supportedClearBody=WORLD_SUPPORTED_CLEAR_V2_WGSL.indexOf('let n=u32(state[3]);',supportedClearEntry);
if(supportedClearEntry<0||supportedClearBody<supportedClearEntry)throw Error('Exact supported-clear guard boundary required');
export const WORLD_SUPPORTED_CLEAR_V2_GUARD_WGSL='@group(0) @binding(0) var<storage,read_write> state:array<i32>;\n'+WORLD_SUPPORTED_CLEAR_V2_WGSL.slice(supportedClearEntry,supportedClearBody)+'}';
export const WORLD_TAIL_MARK_V2_WGSL=WORLD_TAIL_MARK_WGSL.replace('if(mode==1){supportedSlip=true;}','if(mode==1){supportedSlip=true;}if(mode==3){state[50]=1;}');
/** Only the original all-object-clear tail may skip directly to full rest. */
export const WORLD_TAIL_COMMIT_V2_WGSL=RECUR_TAIL_COMMIT_WGSL.replace('dense[z+41u]=2;','').replace('if(state[1]!=10){return;}','if(state[1]!=10){return;}if(tail[1]!=1){state[1]=1;return;}if(state[5]>ctx[24]-tail[4]){state[1]=select(7,5,ctx[25]!=0);state[2]=select(79,84,ctx[25]!=0);return;}');
export const WORLD_TAIL_PROBE_V2_WGSL=`@group(0) @binding(0) var<storage,read_write> state:array<i32>;@compute @workgroup_size(1) fn main(){if(state[1]!=1||state[6]!= -1){return;}for(var i=0u;i<u32(state[3]);i++){let m=state[64u+i*48u+40u];if(m!=0&&m!=3){return;}}state[40]=0;state[1]=10;}`;
export const WORLD_PREFIX_BUDGET_V2_WGSL=`@group(0) @binding(0) var<storage,read_write> state:array<i32>;@group(0) @binding(1) var<storage,read> config:array<i32>;@group(0) @binding(2) var<storage,read> iteration:array<i32>;@compute @workgroup_size(1) fn main(){if(state[1]==1&&iteration[0]>=config[6]){state[1]=5;state[2]=77;}}`;
