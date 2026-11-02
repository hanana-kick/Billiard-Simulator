/** Source-recipe decoder only. Never finishes a collector or executes dynamics. */
import{createCanonicalSelectedTraceCollector}from'./compiled-prefix-source-collector.mjs';
import{sampleSelectedShotTrace}from'./compiled-prefix-source-trace.mjs';
import{selectedWorldSnapshotToCapture}from'../direct-candidate/canonical-selected-world-trace-hydrate.mjs';
import{selectedMMQ2SnapshotRecords}from'../direct-candidate/canonical-selected-mmq2-snapshot.mjs';
import{createNativeSelectedPrefixReceiver,snapshotPrefixWords,snapshotPrefixIdentity}from'./native-selected-prefix-protocol.mjs';
export function createNativeSelectedPrefixDecoder({request,candidate,batch,identity,isCurrent,signal}){
 identity=snapshotPrefixIdentity(identity);const collector=createCanonicalSelectedTraceCollector(request,candidate,batch,{maximumRecords:512,producerBackend:'webgpu',sourceFormat:'resident-v1'}),committed=[];let latest=null,revoked=false;
 const current=()=>{if(revoked||signal?.aborted||!isCurrent())throw Object.assign(Error('Stale selected source prefix'),{name:'AbortError'});};
 const receiver=createNativeSelectedPrefixReceiver({identity,slotToId:request.slotToId,signal,isCurrent:()=>{current();return true;},onRecords(records){
  for(const r of records){if(r[2]<batch.binding.shotClock.startingTick||r[3]>batch.binding.shotClock.deadlineTick)throw RangeError('Prefix outside original request shot clock');if(r[1]>=6)collector.captureSourceRecords(selectedMMQ2SnapshotRecords(r));else collector.selectedTraceCapture(selectedWorldSnapshotToCapture(r,{snapshotVersion:0x53574702,motionVersion:0x4d4d5102}));}
  const snapshot=collector.snapshotPrefix();committed.push(...records);const sourceCount=committed.length;
  latest=Object.freeze({kind:'canonical-session-selected-prefix-v1',identity:Object.freeze({...identity}),startTick:snapshot.startingTick,certifiedThroughTick:snapshot.lastTick,recordCount:sourceCount,normalizedRecordCount:snapshot.trace.recordCount,complete:false,physicsResultComplete:false,scoreAndTurnCommitted:false,assertCurrent:current,
   sampleAt(tick,{side='after'}={}){current();if(tick>snapshot.lastTick||tick===snapshot.lastTick&&side==='after')return{status:'unavailable',reason:'OPEN_PREFIX_FRONTIER',tick,interpolation:false};const sample=sampleSelectedShotTrace(snapshot.trace,tick,{side});current();return sample;},
   presentAt(tick,present,options){if(typeof present!=='function')throw TypeError('Presentation callback required');const sample=this.sampleAt(tick,options);if(!['exact-source','exact-boundary'].includes(sample.status))return{presented:false,sample};current();present(sample);current();return{presented:true,sample};}});return latest;
 }});
 return Object.freeze({accept(packet){current();return receiver.accept(packet);},assertFinalTrace(trace){current();const words=snapshotPrefixWords(trace,1048592);if(words.length!==1048592||words[1]<committed.length)throw RangeError('Full final trace must contain every committed prefix');for(let i=0;i<committed.length;i++)for(let k=0;k<4096;k++)if(words[16+i*4096+k]!==committed[i][k])throw RangeError('Final trace changed an already presented source record');return true;},invalidate(){revoked=true;receiver.invalidate();},get latest(){current();return latest;}});
}
