/** Bounded acknowledgement policy, not a physics or instruction budget. */
export const SELECTED_INACTIVITY_MS=600000,SELECTED_ABSOLUTE_MS=1800000;
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
export function createSelectedRunWatchdog({commandCount,chunkSize,generation,requestId,previousRunGeneration=0,startedAt}){
 if(!integer(commandCount,1)||!integer(chunkSize,1)||chunkSize!==256||!integer(generation,1)||!integer(requestId,1)||!integer(previousRunGeneration)||!Number.isFinite(startedAt))throw Error('Exact bounded selected watchdog identity required');
 const chunks=Math.ceil(commandCount/chunkSize),absolute=startedAt+SELECTED_ABSOLUTE_MS;let deadline=startedAt+SELECTED_INACTIVITY_MS,lastNow=startedAt,runGeneration=null,completed=0,encoding=false,cancelled=false,done=false,finished=false;
 const check=now=>{if(!Number.isFinite(now)||now<lastNow)throw Error('Monotonic selected watchdog clock required');lastNow=now;if(done)throw Error('Selected watchdog already settled');if(now>=absolute)throw Error('Worker selected run absolute acknowledgement timeout');if(now>=deadline)throw Error('Worker selected run no-progress acknowledgement timeout');};
 function observe(m,now){
  check(now);if(m?.v!==1||m.generation!==generation||m.id!==requestId||!['execution','progress'].includes(m.event))throw Error('Selected watchdog reply identity mismatch');
  const d=m.detail;if(!d||Object.keys(d).sort().join(',')!=='chunkCount,chunkIndex,executionStage,generation,runElapsedMs,submittedCommands,totalCommands'||!integer(d.generation,1)||d.chunkCount!==chunks||d.totalCommands!==commandCount||!integer(d.chunkIndex)||!integer(d.submittedCommands)||!Number.isFinite(d.runElapsedMs)||d.runElapsedMs<0)throw Error('Exact selected progress shape/count required');
  if(runGeneration===null){if(m.event!=='execution'||d.executionStage!=='upload'||d.chunkIndex!==0||d.submittedCommands!==0||d.generation<=previousRunGeneration)throw Error('Fresh selected upload generation required');runGeneration=d.generation;return;}
  if(d.generation!==runGeneration)throw Error('Selected run generation mismatch');
  if(m.event==='execution'&&d.executionStage==='chunk-encode-or-wait'){if(encoding||completed>=chunks||d.chunkIndex!==completed+1||d.submittedCommands!==Math.min(completed*chunkSize,commandCount))throw Error('Selected encode order mismatch');encoding=true;return;}
  if(m.event==='progress'&&d.executionStage==='chunk-submitted'){if(!encoding||d.chunkIndex!==completed+1||d.submittedCommands!==Math.min((completed+1)*chunkSize,commandCount))throw Error('Selected completed chunk order mismatch');completed++;encoding=false;if(!cancelled)deadline=Math.min(absolute,now+SELECTED_INACTIVITY_MS);return;}
  if(m.event==='execution'&&d.executionStage==='finish-fence-and-readback'&&!finished&&!encoding&&completed===chunks&&d.chunkIndex===chunks&&d.submittedCommands===commandCount){finished=true;return;}
  throw Error('Unexpected selected execution phase');
 }
 return Object.freeze({observe,check,cancel(now){check(now);cancelled=true;},settle(now,{success=false}={}){check(now);if(success&&(!finished||encoding||completed!==chunks))throw Error('Incomplete selected progress before success');done=true;},status:()=>Object.freeze({deadline,absolute,runGeneration,completed,chunks,cancelled,done})});
}
