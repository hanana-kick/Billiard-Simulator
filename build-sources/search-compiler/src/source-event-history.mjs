// SPDX-License-Identifier: Apache-2.0
// Initial application metadata from the owned original capture, not Rapier
// snapshot bytes or a future trajectory. No engine, decoder or GPU dependency.
export const SOURCE_EVENT_HISTORY_PROFILE='source-full-application-history-v1';
const FIELDS=['initialEventHistoryProfile','preStrikeEventHistory','initialEventHistory'];
const need=(ok,message)=>{if(!ok)throw new RangeError('Source event history: '+message);};
const same=(a,b)=>{if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();return ak.length===bk.length&&ak.every((k,i)=>k===bk[i]&&same(a[k],b[k]));};
const plain=x=>x&&Object.getPrototypeOf(x)===Object.prototype;
function list(events,time){
 need(Array.isArray(events)&&events.length<=120,'actual bounded original event list required');
 for(const e of events){
  need(plain(e)&&['stroke','contact','cue-obstruction'].includes(e.kind)&&typeof e.label==='string','original event kind/label required');
  need(Number.isFinite(e.time)&&e.time>=0&&e.time<=time,'finite original absolute event time required');
  if(Object.hasOwn(e,'key')){need(e.kind==='contact'&&typeof e.key==='string','only native contacts have pair keys');const keys=e.key.split(':');need(keys.length===2&&keys.every(s=>s.length>0&&Number.isFinite(Number(s))&&String(Number(s))===s)&&keys.slice().sort().join(':')===e.key,'exact original numeric-handle pair key required');}
 }
 return events;
}
function transition(pre,created,preClock,createdClock,settings){
 need(preClock&&createdClock&&Number.isFinite(preClock.time)&&preClock.time>=0&&Object.is(createdClock.time,preClock.time),'unchanged prestrike/created absolute time');
 need(Number.isSafeInteger(preClock.shots)&&preClock.shots>=0&&createdClock.shots===preClock.shots+1,'one accepted original strike');
 need(settings&&Number.isFinite(settings.speed)&&settings.speed>0&&settings.speed<=10,'accepted original speed required');
 list(pre,preClock.time);list(created,createdClock.time);
 const stroke={kind:'stroke',label:createdClock.shots+'번째 타격 · '+settings.speed.toFixed(2)+' m/s',time:createdClock.time};
 need(same(created,[...pre,stroke].slice(-120)),'created history must be exact prestrike + accepted stroke, capped at120');
 return stroke;
}
/** Called only with the importer's owned actual capture application records.
 * Capture-envelope ownership/hashes supply provenance; native bytes alone do
 * not authenticate these JavaScript events. Never accepts an expected bank. */
export function captureAcceptedEventHistory(preApplication,createdApplication){
 transition(preApplication?.events,createdApplication?.events,preApplication,createdApplication,createdApplication?.controller?.settings);
 return{initialEventHistoryProfile:SOURCE_EVENT_HISTORY_PROFILE,preStrikeEventHistory:structuredClone(preApplication.events),initialEventHistory:structuredClone(createdApplication.events)};
}
/** Legacy serialized seeds retain their old semantics only if ALL three fields
 * are absent. A partial/unknown new contract is never a legacy fallback. */
export function validateSeedEventHistory(seed){
 const present=FIELDS.map(k=>Object.hasOwn(seed??{},k));if(present.every(x=>!x))return null;
 need(present.every(Boolean)&&seed.initialEventHistoryProfile===SOURCE_EVENT_HISTORY_PROFILE,'complete known versioned history profile required');
 const origin=seed.sourceOrigin;need(origin&&seed.kind==='original-live-registered-four-ball-created-world','registered original capture provenance required');
 need(seed.initialSnapshotSha256===origin.createdSnapshotSha256&&typeof origin.preStrikeSnapshotSha256==='string'&&/^[a-f0-9]{64}$/.test(origin.preStrikeSnapshotSha256),'exact original prestrike/created snapshot identities');
 const stroke=transition(seed.preStrikeEventHistory,seed.initialEventHistory,origin.preStrikeClock,origin.createdClock,origin.settings);
 need(same(seed.initialContactEvents,seed.initialEventHistory.filter(e=>e.kind==='contact')),'contact-only initial scorer projection must remain exact');
 return{profile:SOURCE_EVENT_HISTORY_PROFILE,preStrike:seed.preStrikeEventHistory,created:seed.initialEventHistory,stroke};
}
function numberWords(n){need(Number.isFinite(n),'finite source Number');const b=new ArrayBuffer(8),v=new DataView(b);v.setFloat64(0,n,true);return[v.getUint32(0,true),v.getUint32(4,true)];}
/** Canonical initialization representation: oldest at slot0, head=count%8.
 * Later h appends use the ordinary source FIFO and are never re-canonicalized. */
export function packSourceEventHistory(events,colliders){
 need(Array.isArray(events)&&Array.isArray(colliders)&&colliders.length===27,'complete original event list/collider roster');
 const tail=events.slice(-8),words=new Uint32Array(32);
 tail.forEach((e,i)=>{let pairId=0,keyed=0;if(Object.hasOwn(e,'key')){need(typeof e.key==='string','native pair key string');const parts=e.key.split(':');need(parts.length===2,'native pair key endpoints');const slots=parts.map(s=>{const[index,generation]=numberWords(Number(s));return colliders.findIndex(c=>c.handle?.index===index&&c.handle?.generation===generation);});need(slots.every(x=>x>=0),'historical collider generation unavailable');pairId=Math.min(...slots)*27+Math.max(...slots);keyed=1;}words.set([pairId,...numberWords(e.time),keyed],i*4);});
 return{count:tail.length,head:tail.length%8,words};
}
export function createHistoryInitialization(seed,colliders){
 const h=validateSeedEventHistory(seed);if(!h)return null;
 return{kind:'resident-initial-event-history-v1',profile:SOURCE_EVENT_HISTORY_PROFILE,preStrike:packSourceEventHistory(h.preStrike,colliders),created:packSourceEventHistory(h.created,colliders),strokeTime:Uint32Array.from(numberWords(h.stroke.time))};
}
