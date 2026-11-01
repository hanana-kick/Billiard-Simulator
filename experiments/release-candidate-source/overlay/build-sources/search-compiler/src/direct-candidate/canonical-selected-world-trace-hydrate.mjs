/** Hydration consumes GPU-owned snapshots only. It does not run raw/world
 * dynamics. Source recipe evaluators verify/sample retained accepted recipes. */
import {createCanonicalSelectedTraceCollector} from './canonical-selected-trace-cpu.mjs';
import {SELECTED_WORLD_TRACE_VERSION as V,SELECTED_WORLD_TRACE_LAYOUT as L,SELECTED_WORLD_TRACE_PHASE as P} from './canonical-selected-world-trace-gpu.mjs';
const cut=(r,name)=>{const [at,n]=L[name];return r.slice(at,at+n);};
export function selectedWorldSnapshotToCapture(r,{snapshotVersion=V,motionVersion=0x4d4d5101}={}){
 if(!((snapshotVersion===V&&motionVersion===0x4d4d5101)||(snapshotVersion===0x53574702&&motionVersion===0x4d4d5102)))throw RangeError('Explicit supported snapshot/motion version pair');
 if(!(r instanceof Uint32Array)||r.length!==4096||r[0]!==snapshotVersion||r[13]!==motionVersion||![3,4].includes(r[4]))throw RangeError('Original v1 GPU source snapshot');
 const beforeState=cut(r,'beforeState'),afterState=cut(r,'afterState'),context=cut(r,'context'),cloth=cut(r,'cloth'),n=beforeState[3];
 if(beforeState[0]!==r[10]||afterState[0]!==r[10]||beforeState[41]!==r[11]||afterState[41]!==r[11]||beforeState[42]!==r[12]||afterState[42]!==r[12]||n!==r[4]||afterState[3]!==n||r[2]!==beforeState[5]||r[3]!==afterState[5])throw RangeError('GPU source snapshot header identity/clock');
 const source={},p={kind:'world-prefix',startTick:r[2],endTick:r[3],beforeState,afterState,context,cloth,source};
 if(r[1]===P.INITIAL){p.kind='initial-state';return p;}
 if(r[1]===P.TAIL){p.rollingRows=cut(r,'tailRows').slice(0,n*32);p.kind=afterState[45]>beforeState[45]?'pair':'tail-rest';if(afterState[45]>beforeState[45])p.pair={entry:cut(r,'entry')};return p;}
 if(r[1]===P.MICROTAIL){source.kind='cloth-microtail';if(r[14]&(1<<15))source.microInput=cut(r,'microInput');source.slot=cut(r,'micro')[0];source.rows=cut(r,'microRows');source.micro=cut(r,'micro');source.fraction=cut(r,'fraction');source.smooth=cut(r,'smooth');source.rolling=cut(r,'rolling');return p;}
 if(r[1]===P.MIXED){source.kind=afterState[21]>beforeState[21]?'landing':'mixed-prefix';source.traceSmoothRows=cut(r,'rows');source.traceSmoothOutputs=cut(r,'smooth');source.partials=cut(r,'rolling');source.roots=cut(r,'roots');return p;}
 if(r[1]!==P.SUPPORTED)throw RangeError('Unknown GPU source phase');
 source.rows=cut(r,'rows');source.smooth=cut(r,'smooth');source.bridges=cut(r,'bridges');source.rolling=cut(r,'rolling');source.mask=afterState[40];
 const descriptors=cut(r,'descriptors').slice(0,n*80);
 // The query producer only owns descriptors while a supported tube is pending.
 // After a full CLEAR commit, phase51 sees endpoint state; use the retained
 // ORIGINAL rows+accepted polynomial and BEFORE state instead, never fit final.
 if(descriptors[0]===0x4d4d5101&&descriptors[6]===p.startTick&&Array.from({length:n},(_,i)=>Array.from({length:9},(_,k)=>descriptors[80*i+8+k]===beforeState[64+48*i+24+k]).every(Boolean)).every(Boolean))source.sourceDescriptors=descriptors;
 if(afterState[45]>beforeState[45])source.pair={entry:cut(r,'entry'),...(source.sourceDescriptors?{sourceRows:source.sourceDescriptors}:{})};
 return p;
}
export function hydrateCanonicalSelectedGPUTrace({request,candidate,batch,gpuCapture,result,maximumRecords=512}){
 if(gpuCapture?.kind!=='gpu-selected-world-source-v1'||gpuCapture.gpuProduced!==true||gpuCapture.pinnedMotionVersion!==0x4d4d5101||gpuCapture.identity?.candidateId!==candidate.candidateId||gpuCapture.identity.sceneKey!==batch.binding.sceneKey||gpuCapture.identity.requestKey!==batch.binding.requestKey||gpuCapture.identity.bodyCount!==request.slotToId.length||gpuCapture.recordCount!==gpuCapture.records?.length)throw RangeError('Bound selected GPU source receipt required');
 const collector=createCanonicalSelectedTraceCollector(request,candidate,batch,{maximumRecords,producerBackend:'webgpu',sourceFormat:'resident-v1'});let last=null;for(let i=0;i<gpuCapture.records.length;i++){const r=gpuCapture.records[i];if(r[10]!==gpuCapture.identity.candidateId||r[11]!==gpuCapture.identity.sceneKey||r[12]!==gpuCapture.identity.requestKey||r[4]!==gpuCapture.identity.bodyCount||request.slotToId.some((id,slot)=>r[32+64+48*slot]!==id||r[288+64+48*slot]!==id))throw RangeError('GPU source record receipt/roster identity');if(r[5]!==i||i===0&&r[1]!==P.INITIAL||last!==null&&r[2]!==last)throw RangeError('GPU source sequence/clock gap');collector.selectedTraceCapture(selectedWorldSnapshotToCapture(r));last=r[3];}
 if(last!==null&&last!==gpuCapture.lastTick)throw RangeError('GPU source final capture clock');
 const receipt=collector.finish({...result,selectedTraceCaptureStatus:{gpuProduced:true,incomplete:!gpuCapture.captureComplete,recordCount:gpuCapture.recordCount,overflow:gpuCapture.overflow,errorCode:gpuCapture.errorCode}});
 return Object.freeze({...receipt,sourceCaptureVersion:V,sourceRecordCount:gpuCapture.recordCount,sourceGPUBytes:gpuCapture.maximumRecords*4096*4,intermediateReadbacks:0});
}
