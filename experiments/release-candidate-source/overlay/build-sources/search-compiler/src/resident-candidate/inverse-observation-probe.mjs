// Diagnostic-only source composition: retain actual initial/first/two-h frames.
// Not a solver result, terminal receipt, alternate observer or physics input.
import {assertInverseAuditObservationComposition} from './inverse-observation-storage.mjs';
import {assertInverseWorldObservationPlan} from './inverse-world-observation.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {isOwnedUint32Array} from './abi.mjs';
const need=(x,m)=>{if(!x)throw new RangeError('Inverse frame probe: '+m);},align=x=>Math.ceil(x/64)*64,owned=new WeakSet();
export const INVERSE_PROBE_KIND='source-inverse-observation-two-h-probe-v1';
export const INVERSE_PROBE_MAGIC=0x52495042;
export function composeInverseObservationProbe({composition,observer,limits}={}){
 const p=assertInverseWorldObservationPlan(observer),c=assertInverseAuditObservationComposition(composition,{observer:p});
 need(c.layout.count===2&&c.checkpointLayout===null,'separate count2 emission-only probe');need(c.sourceBytecode,'original source PC retained');
 const frameStride=align(16+p.layout.frameWords),laneStride=64+3*frameStride,base=align(c.layout.totalWords),words=2*laneStride,totalWords=base+words;
 need(totalWords<0xffffffff&&Number.isSafeInteger(totalWords)&&limits?.maxStorageBuffersPerShaderStage>=8&&totalWords*4<=limits.maxStorageBufferBindingSize&&totalWords*4<=limits.maxBufferSize,'actual complete eighth binding limits');
 const layout=Object.freeze({kind:INVERSE_PROBE_KIND,count:2,points:Object.freeze([0,1,2]),base,words,laneStride,headerWords:64,frameStride,frameWords:p.layout.frameWords,totalWords,bytes:totalWords*4,originalSlabWords:c.layout.totalWords,initialization:'fresh GPU-zeroed storage only',diagnosticOnly:true,measured:false});owned.add(layout);
 const name='rc_inverse_world_observe',replacement='rc_inverse_probe_original_observe',signature='fn '+name+'(bank:u32,scratch:u32,initial:bool)->bool';need(c.code.split(signature).length===2&&!c.code.includes(replacement),'one exact original observer signature');const renamed=c.code.replace(signature,'fn '+replacement+'(bank:u32,scratch:u32,initial:bool)->bool');need(renamed.replace('fn '+replacement+'(bank:u32,scratch:u32,initial:bool)->bool',signature)===c.code,'every original source byte recoverable');
 const helper=`
fn rc_inverse_probe_address(index:u32)->u32{if(index>=${words}u){return 0xffffffffu;}return ${base}u+index;}
fn rc_inverse_probe_fail(h:u32,reason:u32)->bool{rc_event_audit[rc_inverse_probe_address(h+2u)]=3u;rc_event_audit[rc_inverse_probe_address(h+3u)]=reason;return false;}
fn rc_inverse_probe_capture(bank:u32,initial:bool)->bool{
 if(bank%${p.stateWords}u!=0u||bank/${p.stateWords}u>=2u){return false;}
 let lane=bank/${p.stateWords}u;let h=lane*${laneStride}u;let ob=lane*${p.observerWords}u;let c=ob+${p.segments.inverseControl.offset}u;let f=ob+${p.segments.inverseFrame.offset}u;
 let seq=rc_event_audit[rc_inverse_observer_address(f+3u)];
 if(seq>2u){return rc_inverse_probe_fail(h,1u);}
 if(rc_state[bank+2u]!=1u||rc_event_audit[rc_inverse_observer_address(c+5u)]!=rc_state[bank+5u]||seq!=select(rc_state[bank+5u]+1u,0u,initial)||(initial&&rc_state[bank+5u]!=0u)){return rc_inverse_probe_fail(h,2u);}
 if(rc_event_audit[rc_inverse_observer_address(c)]!=0x52494f57u||rc_event_audit[rc_inverse_observer_address(c+1u)]!=1u||rc_event_audit[rc_inverse_observer_address(c+2u)]!=2u||rc_event_audit[rc_inverse_observer_address(c+3u)]!=0u||rc_event_audit[rc_inverse_observer_address(c+4u)]!=seq||rc_event_audit[rc_inverse_observer_address(f)]!=0x52494f46u||rc_event_audit[rc_inverse_observer_address(f+1u)]!=1u||rc_event_audit[rc_inverse_observer_address(f+2u)]!=select(1u,0u,initial)||initial!=(seq==0u)){return rc_inverse_probe_fail(h,2u);}
 if(seq==0u){for(var i=0u;i<${laneStride}u;i++){if(rc_event_audit[rc_inverse_probe_address(h+i)]!=0u){return rc_inverse_probe_fail(h,3u);}}}
 else{if(rc_event_audit[rc_inverse_probe_address(h)]!=${INVERSE_PROBE_MAGIC}u||rc_event_audit[rc_inverse_probe_address(h+1u)]!=1u||rc_event_audit[rc_inverse_probe_address(h+2u)]!=1u||rc_event_audit[rc_inverse_probe_address(h+3u)]!=0u||rc_event_audit[rc_inverse_probe_address(h+4u)]!=seq){return rc_inverse_probe_fail(h,3u);}}
 let out=h+64u+seq*${frameStride}u;for(var i=0u;i<${frameStride}u;i++){if(rc_event_audit[rc_inverse_probe_address(out+i)]!=0u){return rc_inverse_probe_fail(h,4u);}}
 rc_event_audit[rc_inverse_probe_address(h)]=${INVERSE_PROBE_MAGIC}u;rc_event_audit[rc_inverse_probe_address(h+1u)]=1u;
 rc_event_audit[rc_inverse_probe_address(out)]=${INVERSE_PROBE_MAGIC}u;rc_event_audit[rc_inverse_probe_address(out+1u)]=1u;rc_event_audit[rc_inverse_probe_address(out+3u)]=seq;rc_event_audit[rc_inverse_probe_address(out+4u)]=rc_state[bank+4u];rc_event_audit[rc_inverse_probe_address(out+5u)]=rc_state[bank+5u];rc_event_audit[rc_inverse_probe_address(out+6u)]=rc_state[bank+${p.sourceOffsets.worldApplication+2}u];rc_event_audit[rc_inverse_probe_address(out+7u)]=rc_state[bank+12u];
 for(var i=0u;i<${p.layout.frameWords}u;i++){rc_event_audit[rc_inverse_probe_address(out+16u+i)]=rc_event_audit[rc_inverse_observer_address(f+i)];}
 rc_event_audit[rc_inverse_probe_address(out+2u)]=1u;rc_event_audit[rc_inverse_probe_address(h+4u)]=seq+1u;rc_event_audit[rc_inverse_probe_address(h+2u)]=select(1u,2u,seq==2u);return true;
}
fn rc_inverse_world_observe(bank:u32,scratch:u32,initial:bool)->bool{if(!rc_inverse_probe_original_observe(bank,scratch,initial)){return false;}return rc_inverse_probe_capture(bank,initial);}
`;
 const code=linkResidentWGSL([renamed,helper],{entry:c.entry}).code;
 return Object.freeze({kind:INVERSE_PROBE_KIND,code,entry:c.entry,layout,composition:c,renamedSource:renamed,helperCode:helper,sourceBytecode:c.sourceBytecode,sourceIdentity:p.sourceIdentity,sourceOnly:true,qualified:false});
}
/** Diagnostic decode only. Missing capture is unavailable, never a zero frame. */
export function decodeInverseObservationProbe(layout,words){
 need(owned.has(layout),'locally admitted diagnostic layout');need(isOwnedUint32Array(words)&&words.length===layout.words,'complete owned final diagnostic view');
 return Array.from({length:2},(_,lane)=>{const at=lane*layout.laneStride,w=words.subarray(at,at+layout.laneStride);if(w.every(x=>x===0))return{lane,status:'unwritten',frames:[]};
  if(w[2]===3){need(w[3]>=1&&w[3]<=4&&w[4]<=3&&(w[0]===0||w[0]===INVERSE_PROBE_MAGIC)&&(w[1]===0||w[1]===1)&&w.slice(5,64).every(x=>x===0),'bounded failed capture header');return{lane,status:'failed',reason:w[3],frames:[]};}need(w[0]===INVERSE_PROBE_MAGIC&&w[1]===1&&[1,2].includes(w[2])&&w[3]===0&&w[4]>=1&&w[4]<=3&&(w[2]===2)===(w[4]===3),'exact capture status/count');need(w.slice(5,64).every(x=>x===0),'reserved header');const frames=[];
  for(let seq=0;seq<3;seq++){const r=w.subarray(64+seq*layout.frameStride,64+(seq+1)*layout.frameStride);if(seq>=w[4]){need(r.every(x=>x===0),'unwritten future slot');continue;}need(r[0]===INVERSE_PROBE_MAGIC&&r[1]===1&&r[2]===1&&r[3]===seq&&r.slice(8,16).every(x=>x===0)&&r.slice(16+layout.frameWords).every(x=>x===0),'exact slot header/padding');const frame=r.slice(16,16+layout.frameWords);need(frame[0]===0x52494f46&&frame[1]===1&&frame[2]===(seq===0?0:1)&&frame[3]===seq&&r[5]===(seq===0?0:seq-1)&&r[6]===(seq===0?0:3)&&r[7]===(seq===0?0:5),'matching genuinely produced frame and source epoch');frames.push({sequence:seq,candidateId:r[4],sourceH:r[5],applicationPhase:r[6],sourcePhase:r[7],words:frame});}
  return{lane,status:w[2]===2?'complete':'incomplete',frames};});
}
