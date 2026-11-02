/** Experimental append-only GPU trace transport. It conveys no final result or score. */
const V=0x53574702, M=0x4d4d5102, RECORD_WORDS=4096, MAX_RECORDS=256, MAX_PACKET_RECORDS=16;
const identityKeys=['sourceRevision','artifactSHA256','generation','runId','sceneKey','requestKey','candidateId','bodyCount'];
const uint=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const senderCancellationCapabilities=new WeakSet();
export const isNativePrefixCancellationCapability=value=>senderCancellationCapabilities.has(value);
const abort=reason=>Object.assign(new Error(String(reason??'Selected prefix cancelled')),{name:'AbortError'});
export function snapshotPrefixIdentity(value){
 if(!value||Object.keys(value).sort().join()!==[...identityKeys].sort().join()||!['sourceRevision','artifactSHA256'].every(k=>/^[a-f0-9]{64}$/.test(value[k]))||!['generation','runId','sceneKey','requestKey','candidateId','bodyCount'].every(k=>uint(value[k]))||value.generation<1||value.runId<1||![3,4].includes(value.bodyCount))throw TypeError('Exact bound prefix source/run identity required');
 return Object.freeze(Object.fromEntries(identityKeys.map(k=>[k,value[k]])));
}
export function snapshotPrefixWords(value,maximumWords){
 if(Object.getPrototypeOf(value)!==Uint32Array.prototype||['buffer','byteOffset','byteLength','length','slice','subarray'].some(k=>Object.hasOwn(value,k))||Object.hasOwn(value,Symbol.iterator))throw TypeError('Plain owned u32 prefix required');
 const proto=Object.getPrototypeOf(Uint32Array.prototype),get=k=>Object.getOwnPropertyDescriptor(proto,k).get.call(value),buffer=get('buffer'),length=get('length');
 let byteLength;try{byteLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get.call(buffer);}catch{throw TypeError('Nonshared ArrayBuffer intrinsic brand required');}if(!Number.isSafeInteger(byteLength)||length>maximumWords)throw RangeError('Nonshared bounded prefix required');const result=new Uint32Array(length);Uint32Array.prototype.set.call(result,value);return result;
}
export function createNativeSelectedPrefixReceiver({identity,slotToId,isCurrent,signal,onRecords}){
 const bound=snapshotPrefixIdentity(identity),ids=Object.freeze([...slotToId]);if(ids.length!==bound.bodyCount||new Set(ids).size!==ids.length||!ids.every(uint)||typeof isCurrent!=='function'||typeof onRecords!=='function')throw TypeError('Owned prefix roster/current decoder required');
 let sequence=0,count=0,lastTick=null,sourceBoundary=0,invalid=false;
 const assertCurrent=()=>{if(invalid||signal?.aborted||!isCurrent())throw abort(signal?.reason??'Stale selected prefix');};
 return Object.freeze({assertCurrent,invalidate(){invalid=true;},accept(packet){
  assertCurrent();if(!packet||packet.kind!=='native-selected-prefix-v1'||identityKeys.some(k=>packet.identity?.[k]!==bound[k])||packet.sequence!==sequence||packet.firstRecord!==count||!uint(packet.sourceBoundary)||packet.sourceBoundary<sourceBoundary||packet.sourceBoundary>66317||packet.final!==false)throw RangeError('Stale, replayed or unbound selected prefix');
  const words=snapshotPrefixWords(packet.words,MAX_PACKET_RECORDS*RECORD_WORDS);if(!words.length||words.length%RECORD_WORDS||count+words.length/RECORD_WORDS>MAX_RECORDS)throw RangeError('Bounded nonempty complete source records required');
  let tick=lastTick;const records=[];for(let at=0;at<words.length;at+=RECORD_WORDS){const r=words.slice(at,at+RECORD_WORDS),index=count+records.length;if(r[0]!==V||r[13]!==M||r[5]!==index||r[4]!==bound.bodyCount||r[10]!==bound.candidateId||r[11]!==bound.sceneKey||r[12]!==bound.requestKey||r[2]>0x7fffffff||r[3]>0x7fffffff||r[3]<r[2]||tick!==null&&r[2]!==tick||index===0&&r[1]!==1||r[1]<1||r[1]>10)throw RangeError('GPU prefix source identity/sequence/clock');
   for(const offset of [32,288])if(r[offset]!==bound.candidateId||r[offset+3]!==bound.bodyCount||r[offset+41]!==bound.sceneKey||r[offset+42]!==bound.requestKey||r[offset+5]!==r[offset===32?2:3]||ids.some((id,i)=>r[offset+64+i*48]!==id))throw RangeError('GPU prefix state/roster binding');
   tick=r[3];records.push(r);
  }
  // A decoder failure poisons this run: no partial retry may duplicate records.
  let decoded;try{decoded=onRecords(records);if(decoded&&typeof decoded.then==='function'){Promise.resolve(decoded).catch(()=>{});throw TypeError('Synchronous prefix decoder required');}assertCurrent();}catch(error){invalid=true;throw error;}
  count+=records.length;sequence++;lastTick=tick;sourceBoundary=packet.sourceBoundary;
  return Object.freeze({decoded,ack:Object.freeze({kind:'native-selected-prefix-ack-v1',identity:bound,sequence:packet.sequence,recordCount:count}),recordCount:count,lastTick,complete:false});
 }});
}
export function createNativeSelectedPrefixSender({identity,send,isCurrent,signal,isCancellationCurrent=()=>true,acknowledgmentTimeoutMs=30000}){
 const bound=snapshotPrefixIdentity(identity);if(typeof send!=='function'||typeof isCurrent!=='function'||typeof isCancellationCurrent!=='function'||!Number.isInteger(acknowledgmentTimeoutMs)||acknowledgmentTimeoutMs<1||acknowledgmentTimeoutMs>30000)throw TypeError('Bounded prefix sender required');let sequence=0,count=0,pending=null,closed=false,busy=false;
 const cancellationErrors=new WeakSet();
 const signalCancellation=()=>{const error=abort(signal.reason);cancellationErrors.add(error);return error;};
 const cancellationCapability=Object.freeze({isCancellationError:error=>signal?.aborted===true&&cancellationErrors.has(error)&&isCancellationCurrent()===true});senderCancellationCapabilities.add(cancellationCapability);
 const assertCurrent=()=>{if(signal?.aborted)throw signalCancellation();if(closed||!isCurrent())throw abort('Stale selected prefix');};
 const cancel=()=>{closed=true;if(pending){clearTimeout(pending.timer);pending.reject(signal?.aborted?signalCancellation():abort('Selected prefix disposed'));pending=null;}};signal?.addEventListener('abort',cancel,{once:true});
 return Object.freeze({cancellationCapability,async publish({sourceBoundary,words}){assertCurrent();if(busy)throw Error('Only one prefix packet may be outstanding');const snapshot=snapshotPrefixWords(words,MAX_PACKET_RECORDS*RECORD_WORDS);if(!snapshot.length||snapshot.length%RECORD_WORDS||count+snapshot.length/RECORD_WORDS>MAX_RECORDS)throw RangeError('Bounded complete prefix packet required');const next=count+snapshot.length/RECORD_WORDS,packet={kind:'native-selected-prefix-v1',identity:bound,sequence,firstRecord:count,sourceBoundary,final:false,words:snapshot};
  let sendFailure,hasSendFailure=false;busy=true;try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{closed=true;pending=null;reject(Error('Selected prefix acknowledgment deadline'));},acknowledgmentTimeoutMs);pending={sequence,next,resolve,reject,timer};try{send(packet,[snapshot.buffer]);}catch(e){hasSendFailure=true;sendFailure=e;clearTimeout(timer);pending=null;closed=true;reject(e);}}).catch(error=>{throw hasSendFailure?sendFailure:error;});if(hasSendFailure)throw sendFailure;assertCurrent();count=next;sequence++;return count;}finally{busy=false;}
 },acknowledge(ack){assertCurrent();if(!pending||ack?.kind!=='native-selected-prefix-ack-v1'||identityKeys.some(k=>ack.identity?.[k]!==bound[k])||ack.sequence!==pending.sequence||ack.recordCount!==pending.next)throw RangeError('Exact current prefix acknowledgment required');const p=pending;pending=null;clearTimeout(p.timer);p.resolve();},dispose(){cancel();signal?.removeEventListener('abort',cancel);},get pending(){return pending!==null;}});
}
