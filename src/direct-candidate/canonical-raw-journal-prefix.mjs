/** Composition seam for the owned raw-world runner, not a public proof oracle.
 * Only READY from that runner can certify the collision-free guarded stroke.
 */
import {snapshotRawWorldBatch,RAW_WORLD_VERSION} from './deterministic-raw-world.mjs';
const V=0x52504a01;
function config(batch){const d=snapshotRawWorldBatch(batch);if(batch.count!==1)throw RangeError('One owned raw candidate');return Uint32Array.of(V,d.rawRows[0],d.template[2],d.template[3],d.template[8],d.template[9],d.template[7],RAW_WORLD_VERSION);}
/** Call only with the raw result freshly produced inside runRaw(batch). The
 * record is diagnostic; the caller-owned execution chain supplies provenance. */
export function seedRawJournalPrefixCPU(journal,batch,result){const c=config(batch),w=result.world,s=result.status;if(!(journal instanceof Uint32Array)||journal.length<40||!(w instanceof Uint32Array)||w.length!==192||!(s instanceof Uint32Array)||s.length!==16)throw TypeError('Complete owned raw handoff and journal');const ready=journal[1]===1&&s[0]===c[1]&&s[1]===1&&s[2]===0&&s[11]===c[7]&&w[1]===c[1]&&w[2]===c[2]&&w[6]===1&&w[7]===c[6]&&w[8]===c[4]&&w[9]===c[5]&&s[8]===c[4]&&s[9]===c[5]&&w[3]>=c[3]&&w[3]===s[10]&&w[3]-c[3]===s[7]&&journal[5]===w[3]&&journal[6]===w[3]&&journal[3]===0;if(!ready){journal[1]=3;journal[2]=10;journal[20]=0;return journal;}journal[5]=c[3];journal[20]=1;journal[21]=w[3];return journal;}
const WGSL=String.raw`
@group(0) @binding(0) var<storage,read> w:array<u32>;
@group(0) @binding(1) var<storage,read> s:array<u32>;
@group(0) @binding(2) var<storage,read> c:array<u32>;
@group(0) @binding(3) var<storage,read_write> j:array<u32>;
@compute @workgroup_size(1) fn main(){let ready=j[1]==1u&&s[0]==c[1]&&s[1]==1u&&s[2]==0u&&s[11]==c[7]&&w[1]==c[1]&&w[2]==c[2]&&w[6]==1u&&w[7]==c[6]&&w[8]==c[4]&&w[9]==c[5]&&s[8]==c[4]&&s[9]==c[5]&&w[3]>=c[3]&&w[3]==s[10]&&w[3]-c[3]==s[7]&&j[5]==w[3]&&j[6]==w[3]&&j[3]==0u;if(!ready){j[1]=3u;j[2]=10u;j[20]=0u;return;}j[5]=c[3];j[20]=1u;j[21]=w[3];}
`;
export async function createRawJournalPrefixGPU(device){const module=device.createShaderModule({code:WGSL}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});return {createBank(rawBank,journalBank){const words=config(rawBank.identity);if(rawBank.count!==1||rawBank.preparedWorldWordStride!==192||rawBank.handoffStatusWordStride!==16||rawBank.preparedWorldBuffer.size!==768||rawBank.handoffStatusBuffer.size!==64)throw RangeError('Owned one-candidate raw-world bank');const expected=device.createBuffer({size:32,usage:128|8});device.queue.writeBuffer(expected,0,words);const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[rawBank.preparedWorldBuffer,rawBank.handoffStatusBuffer,expected,journalBank.buffer].map((buffer,binding)=>({binding,resource:{buffer}}))});return {encode(encoder){const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();},destroy(){expected.destroy();}};}};}
