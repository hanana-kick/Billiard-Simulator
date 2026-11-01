import {validateSelectedMicrotailPhase,sampleSelectedMicrotailPhase} from './canonical-microtail-phase-trace.mjs';
import {validateSelectedRollingPhase,sampleSelectedRollingPhase} from './canonical-rolling-trace.mjs';
import {validateSelectedBridgePhase,sampleSelectedBridgePhase} from './canonical-bridge-phase-trace.mjs';
/** SST1: optional selected-shot source capture, never candidate-batch output.
 * This is NOT a checkpoint or a physics producer. Only producer-owned accepted
 * descriptors may be appended. Missing laws stay explicit; no inferred paths.
 */
import {validateCanonicalRequest,validateCanonicalCandidate,createSelectedShotTraceRequest} from './canonical-engine-contract.mjs';
import {validateMixedMotionDescriptors} from './deterministic-mixed-motion-query.mjs';
import {sampleMixedMotionCPU} from './deterministic-mixed-pair-entry.mjs';
import {validateMixedMotionV2,sampleMixedMotionV2CPU} from './deterministic-mixed-motion-v2.mjs';
export const SELECTED_TRACE_LIMITS=Object.freeze({maximumRecords:512,recordWords:2048,maximumPayloadBytes:512*2048*4,headerWords:32,boundaryWords:40,sourceOffset:112});
export const SELECTED_TRACE_SOURCE=Object.freeze({MMQ1:1,MMQ2:2,RAW_CONTACT:3,SLIP_BRIDGE:4,QT_BRIDGE:5,MICROTAIL:6,BOUNDARY_IMPULSE:7,ROLLING_TAIL:8,MIXED_BRIDGE:9,MICROTAIL_ROSTER:10});
const V=0x53535401,owned=new WeakMap(),uint=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff,tick=x=>uint(x)&&x<=0x7fffffff;
function words(x,n){if(!(x instanceof Uint32Array)||Object.prototype.toString.call(x.buffer)==='[object SharedArrayBuffer]'||x.length!==n)throw TypeError('Owned exact-length u32 words required');return x.slice();}
function roster(x){if(!Array.isArray(x)||![3,4].includes(x.length)||!x.every(uint)||new Set(x).size!==x.length)throw RangeError('Complete unique stable-ID roster required');return [...x];}
export function selectedTraceWorldBoundary(state){if(!(state instanceof Uint32Array)||state.length<256||![3,4].includes(state[3]))throw RangeError('Complete prepared-world state required');const out=new Uint32Array(40);for(let i=0;i<state[3];i++){const a=64+48*i;out[i*10]=state[a];out.set(state.subarray(a+24,a+33),i*10+1);}return out;}
function checkBoundary(x,ids){const out=words(x,40);for(let i=0;i<ids.length;i++)if(out[10*i]!==ids[i])throw RangeError('Full trace roster/order mismatch');if(out.subarray(ids.length*10).some(Boolean))throw RangeError('Unused boundary slots must be zero');return out;}
function identity(x){const names=['modelId','profileId','sceneId','requestKey','candidateKey'];if(!x||names.some(k=>typeof x[k]!=='string'||!x[k])||!uint(x.epoch)||!uint(x.candidateId)||Object.keys(x).length!==7)throw RangeError('Exact selected-candidate identity required');return Object.freeze({...x});}
/** Identity comes from createSelectedShotTraceRequest; callers must epoch-gate
 * before/after awaits. Capacity failure changes trace only, never physics. */
export function createCanonicalSelectedShotCapture(request,candidate,{maximumRecords=512,sampleEveryTicks=1,maximumFrames=4096}={}){
 request=validateCanonicalRequest(request);candidate=validateCanonicalCandidate(request,candidate);
 return createSelectedShotTraceCapture({traceRequest:createSelectedShotTraceRequest(candidate,{sampleEveryTicks,maximumFrames,checkpoints:false}),slotToId:request.slotToId,maximumRecords});
}
export function createSelectedShotTraceCapture({traceRequest,slotToId,maximumRecords=512}){
 if(traceRequest?.kind!=='canonical-selected-trace-request-v1'||traceRequest.checkpoints!==false)throw RangeError('Explicit selected trace request without checkpoints required');
 const id=identity(traceRequest.identity),ids=roster(slotToId);if(!Number.isInteger(maximumRecords)||maximumRecords<1||maximumRecords>512)throw RangeError('Trace record cap 1..512');
 const records=[];let closed=false,overflow=false,last=null;
 return Object.freeze({captureAccepted({startTick,endTick,sourceKind,sourceWords=new Uint32Array(),startState,endState,event=null}){
  if(closed)throw Error('Trace already finished');if(!tick(startTick)||!tick(endTick)||endTick<startTick||last!==null&&startTick!==last)throw RangeError('Contiguous monotonic original Q20 clocks required');
  if(!Object.values(SELECTED_TRACE_SOURCE).includes(sourceKind))throw RangeError('Explicit source phase required');
  if(!(sourceWords instanceof Uint32Array)||sourceWords.length>1936)throw RangeError('Source exceeds bounded record');const start=checkBoundary(startState,ids),end=checkBoundary(endState,ids),source=words(sourceWords,sourceWords.length);
  if(records.length&&!overflow&&records.at(-1).subarray(72,112).some((x,i)=>x!==start[i]))throw RangeError('Accepted boundaries must join exactly');
  if(event!==null&&(!uint(event.kind)||event.kind===0||!tick(event.lo)||!tick(event.hi)||event.lo<startTick||event.hi!==endTick||event.lo>event.hi||typeof event.resolved!=='boolean'))throw RangeError('Actual event bracket ending at accepted endpoint required');
  if(sourceKind===1||sourceKind===2){(sourceKind===1?validateMixedMotionDescriptors:validateMixedMotionV2)(source);if(source.length!==ids.length*80||source[6]!==startTick||endTick-startTick>source[2])throw RangeError('Original descriptor source clock/roster required');for(let i=0;i<ids.length;i++)if(source[80*i+3]!==ids[i])throw RangeError('Descriptor stable-ID mismatch');}
  if(sourceKind===8){validateSelectedRollingPhase(source);if(source[1]!==ids.length||source[2]!==startTick||source[3]!==endTick||ids.some((id,i)=>source[16+10*i]!==id))throw RangeError('Original rolling phase clock/roster');}
  if(sourceKind===10){validateSelectedMicrotailPhase(source);if(source[1]!==ids.length||source[2]!==startTick||source[3]!==endTick||ids.some((id,i)=>source[16+80*i+3]!==id))throw RangeError('Original microtail phase clock/roster');}
  if(sourceKind===9){validateSelectedBridgePhase(source);if(source[1]!==ids.length||source[2]!==startTick||source[3]!==endTick-startTick||ids.some((id,i)=>source[16+80*i+3]!==id))throw RangeError('Original bridge phase clock/roster');}
  if([1,2,9,10].includes(sourceKind)){const offset=sourceKind<=2?0:16;for(let i=0;i<ids.length;i++)for(let k=0;k<9;k++)if(source[offset+80*i+8+k]!==start[10*i+1+k])throw RangeError('Original descriptor anchor differs from accepted start');}
  last=endTick;if(records.length>=maximumRecords){overflow=true;return false;}
  const row=new Uint32Array(2048);row.set([V,sourceKind,startTick,endTick,ids.length,source.length,event?.kind??0,event?.lo??endTick,event?.hi??endTick,event?Number(event.resolved):1]);row.set(start,32);row.set(end,72);row.set(source,112);records.push(row);return true;
 },finish(compactResult){if(closed)throw Error('Trace already finished');const compact=words(compactResult,4);if(compact[0]!==id.candidateId)throw RangeError('Selected compact candidate mismatch');closed=true;const trace=Object.freeze({kind:'canonical-selected-source-trace-v1',identity:id,slotToId:Object.freeze(ids),recordCount:records.length,payloadBytes:records.length*8192,overflow,captureComplete:!overflow&&records.length>0,samplingComplete:!overflow&&records.length>0&&records.every(r=>[1,2,8].includes(r[1])&&r[6]===0),compactResult:Object.freeze(Array.from(compact)),checkpoint:false,presentationInterpolation:false});owned.set(trace,records);return trace;}});
}
export function exportSelectedShotTraceRecords(trace){const records=owned.get(trace);if(!records)throw TypeError('Owned selected trace required');return records.map(x=>x.slice());}
/** Exact source samples, not presentation interpolation. Event brackets are
 * unavailable internally; corrected post-impact endpoint wins at endTick. */
export function sampleSelectedShotTrace(trace,t,{side='after'}={}){
 const records=owned.get(trace);if(!records||!tick(t)||!['before','after'].includes(side))throw RangeError('Owned trace, integer Q20 time and side required');
 const candidates=records.filter(r=>t>=r[2]&&t<=r[3]);const r=side==='before'?candidates[0]:candidates.at(-1);if(!r)return {status:'unavailable',reason:'OUTSIDE_CAPTURE'};
 const base={tick:t,slotToId:trace.slotToId,interpolation:false};
 if(r[6]&&!r[9]&&(t>r[7]||t===r[3]&&side==='after'))return {...base,status:'unavailable',reason:'UNRESOLVED_EVENT'};
 if(t===r[3]&&side==='after')return {...base,status:'exact-boundary',state:r.slice(72,112),correctedPostImpact:r[6]!==0};
 if(t===r[2])return {...base,status:'exact-boundary',state:r.slice(32,72),correctedPostImpact:false};
 if(r[6]&&t>r[7])return {...base,status:'unavailable',reason:r[9]?'EVENT_BRACKET':'UNRESOLVED_EVENT'};
 if(r[1]===8)return {...base,...sampleSelectedRollingPhase(r.slice(112,112+r[5]),t-r[2])};
 if(r[1]===10)return {...base,...sampleSelectedMicrotailPhase(r.slice(112,112+r[5]),t-r[2])};
 if(r[1]===9)return {...base,...sampleSelectedBridgePhase(r.slice(112,112+r[5]),t-r[2])};
 if(![1,2].includes(r[1]))return {...base,status:'unsupported',reason:'SOURCE_SAMPLER_NOT_IMPLEMENTED',sourceKind:r[1]};
 const source=r.slice(112,112+r[5]),out=new Uint32Array(40);for(let i=0;i<r[4];i++){const x=(r[1]===1?sampleMixedMotionCPU:sampleMixedMotionV2CPU)(source,i,t-r[2]);if(x[1]!==1)return {...base,status:'unavailable',reason:'SOURCE_SAMPLE_REFUSED'};out[10*i]=x[3];out.set(x.subarray(64,73),10*i+1);}return {...base,status:'exact-source',state:out};
}
