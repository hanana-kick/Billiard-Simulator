/** Prepared resident physical producer -> RULE. No synthetic event inputs. */
import {validateRuleConfig,initialRuleState,reduceRuleEvent,gameplayFailureProof,RULE_WGSL} from './deterministic-rules.mjs';
import {Q_PAIR_VERSION} from './deterministic-q-pair.mjs';
export const PHYSICAL_RULE_VERSION=0x51525501;
export function packPhysicalRuleConfig(ruleConfig,cueSlot,n){
 validateRuleConfig(ruleConfig);if(ruleConfig[0]!==n||!Number.isInteger(cueSlot)||cueSlot<0||cueSlot>=n||[ruleConfig[1],ruleConfig[2],ruleConfig[3]].some(x=>x>=n||x===cueSlot))throw RangeError('Prepared RULE roster');
 const out=new Uint32Array(16);out.set(ruleConfig);out[9]=0; // This producer has no certified kiss/separation channel.
 out.set([cueSlot,PHYSICAL_RULE_VERSION,n,0],12);return out;
}
function commit(record,config,left,right,lo,hi){
 record[20]++;record[21]=left;record[22]=right;record[23]=lo;record[24]=hi;record[25]=config[12];record[26]=record[20];record[27]=1;
 if(left===config[12]||right===config[12]){reduceRuleEvent(record.subarray(0,20),config,[1,left===config[12]?right:left,0,hi]);record[31]++;if(gameplayFailureProof(config.subarray(0,12),record.subarray(0,20)))record[29]=1;}
}
export function initialPhysicalRulesCPU(initial,config){
 const out=new Uint32Array(initial.qState.length/160*32);for(let i=0;i<out.length/32;i++){const row=out.subarray(i*32,i*32+32),b=i*128,p=i*64;row.set(initialRuleState(config));row[30]=PHYSICAL_RULE_VERSION;if(initial.state[b+1]===0&&initial.responses[p+1]===1){const pair=initial.state[b+5],tick=initial.state[b+13];commit(row,config,pair>>>2,pair&3,initial.events[i*48+3],tick);}}
 return out;
}
export function commitPhysicalRulesCPU(rules,state,config){for(let i=0;i<rules.length/32;i++){const b=i*160;if(state[b+2]===0&&state[b+18]===Q_PAIR_VERSION&&state[b+31]===1){const pair=state[b+21];commit(rules.subarray(i*32,i*32+32),config,pair>>>2,pair&3,state[b+19],state[b+20]);}}}
export function terminatePhysicalQueryCPU(rules,state,config){if(config[10]!==1)return;for(let i=0;i<rules.length/32;i++)if(rules[i*32+29]===1){state[i*160+2]=8;state[i*160+3]=0;}}
export function finishPhysicalRulesCPU(rules,state,config){for(let i=0;i<rules.length/32;i++){const b=i*160,row=rules.subarray(i*32,i*32+32),status=state[b+2];row[28]=status;if(status===8)continue;const kind=status===3?5:status===5?6:7;reduceRuleEvent(row.subarray(0,20),config,[kind,0,0,state[b+5]+state[b+6]]);}}
const COMMON=`${RULE_WGSL}
fn configValue()->RuleConfig{var c:RuleConfig;for(var j=0u;j<12u;j++){c.w[j]=config[j];}return c;}
fn readRule(base:u32)->RuleState{var s:RuleState;for(var j=0u;j<20u;j++){s.w[j]=rules[base+j];}return s;}
fn writeRule(base:u32,s:RuleState){for(var j=0u;j<20u;j++){rules[base+j]=s.w[j];}}
fn committed(base:u32,left:u32,right:u32,lo:u32,hi:u32){rules[base+20u]++;rules[base+21u]=left;rules[base+22u]=right;rules[base+23u]=lo;rules[base+24u]=hi;rules[base+25u]=config[12];rules[base+26u]=rules[base+20u];rules[base+27u]=1u;if(left==config[12]||right==config[12]){let objectSlot=select(left,right,left==config[12]);writeRule(base,rule_event(readRule(base),configValue(),vec4<u32>(1u,objectSlot,0u,hi)));rules[base+31u]++;if(rule_gameplay_failure_proof(readRule(base),configValue())==1u){rules[base+29u]=1u;}}}
`;
export const PHYSICAL_RULE_INIT_WGSL=`
@group(0) @binding(0) var<storage,read> legacy:array<u32>;
@group(0) @binding(1) var<storage,read> responses:array<u32>;
@group(0) @binding(2) var<storage,read> events:array<u32>;
@group(0) @binding(3) var<storage,read> config:array<u32>;
@group(0) @binding(4) var<storage,read_write> rules:array<u32>;
${COMMON}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*128u;if(b>=arrayLength(&legacy)){return;}let base=id.x*32u;for(var j=0u;j<32u;j++){rules[base+j]=0u;}writeRule(base,rule_init(configValue()));rules[base+30u]=0x51525501u;if(legacy[b+1u]==0u&&responses[id.x*64u+1u]==1u){let pair=legacy[b+5u];committed(base,pair>>2u,pair&3u,events[id.x*48u+3u],legacy[b+13u]);}}
`;
export const PHYSICAL_RULE_EVENT_WGSL=`
@group(0) @binding(0) var<storage,read_write> state:array<u32>;
@group(0) @binding(1) var<storage,read> config:array<u32>;
@group(0) @binding(2) var<storage,read_write> rules:array<u32>;
${COMMON}
@compute @workgroup_size(32) fn commit(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*160u;if(b>=arrayLength(&state)){return;}if(state[b+2u]==0u&&state[b+18u]==0x51500401u&&state[b+31u]==1u){let pair=state[b+21u];committed(id.x*32u,pair>>2u,pair&3u,state[b+19u],state[b+20u]);}}
@compute @workgroup_size(32) fn terminate(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*160u;if(b>=arrayLength(&state)){return;}if(config[10]==1u&&rules[id.x*32u+29u]==1u){state[b+2u]=8u;state[b+3u]=0u;}}
@compute @workgroup_size(32) fn finish(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*160u;if(b>=arrayLength(&state)){return;}let base=id.x*32u;let status=state[b+2u];rules[base+28u]=status;if(status==8u){return;}var kind=7u;if(status==3u){kind=5u;}else if(status==5u){kind=6u;}writeRule(base,rule_event(readRule(base),configValue(),vec4<u32>(kind,0u,0u,state[b+5u]+state[b+6u])));}
`;
