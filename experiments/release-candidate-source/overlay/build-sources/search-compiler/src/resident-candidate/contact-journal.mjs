// SPDX-License-Identifier: Apache-2.0
// Rapier b716d375 data/graph.rs and narrow_phase/pair_management.rs integer port.
// Initial serialization and device source-order bookkeeping, NOT a host solver.
import {SOURCE_REVISION,NONE as U} from './contact-roster.mjs';
export {SOURCE_REVISION};
export const CONTACT_JOURNAL_STATUS=Object.freeze({ok:0,invalid:1,capacity:2,unsupported:3});
const H=Object.freeze({status:0,phase:1,colliders:2,edges:3,sequence:4,revision:5,nextLo:6,nextHi:7,changes:8,operations:9,events:10,broad:11,removed:12,fromSequence:13,fromRevision:14,cuePresent:15,cueCount:16,cloth1:17,cloth2:18,birth1:19,birth2:20,birthPending:21,rosterApplied:22});
// Collider row: raw handle, parent handle, body type, groups, live, cue,
// source body.collider-list rank, outgoing/incoming head, reserved.
// Edge row: collider slots, active, lifetime lo/hi, next outgoing/incoming.
const C=Object.freeze({index:0,generation:1,bodyIndex:2,bodyGeneration:3,type:4,groups:5,live:6,cue:7,bodyColliderRank:8,outgoingHead:9,incomingHead:10});
const E=Object.freeze({collider1Slot:0,collider2Slot:1,isActive:2,lifeLo:3,lifeHi:4,nextOutgoing:5,nextIncoming:6});
const CHANGE=Object.freeze({kind:0,edge:1,lastEdge:2,collider1Slot:3,collider2Slot:4,oldActive:5,lifeLo:6,lifeHi:7,newActive:8,withdrawnColliderSlot:9,relocatedCollider1Slot:10,relocatedCollider2Slot:11,relocatedActive:12,relocatedLifeLo:13,relocatedLifeHi:14});
const OP=Object.freeze({kind:0,edgeOrOld:1,lastOrNew:2,collider1Slot:3,collider2Slot:4,flag:5});
const EVENT=Object.freeze({collider1Slot:0,collider2Slot:1,started:2,flags:3});
const BROAD=Object.freeze({kind:0,collider1Slot:1,collider2Slot:2,isActive:3});
export const CONTACT_JOURNAL_LAYOUT=Object.freeze({version:1,header:H,collider:C,edge:E,change:CHANGE,operation:OP,event:EVENT,broad:BROAD,
 // Persistent header contains transient queue counters/phase too; copy the
 // whole persistent prefix when staging a new candidate h. Queue contents are
 // valid only through that h; consumers must finish before scratch reuse.
 persistent:Object.freeze({offset:0,words:1380,bytes:5520}),
 transient:Object.freeze({offset:1380,words:14386,bytes:57544}),
 transientLogs:Object.freeze({offset:1380,words:12827,bytes:51308}),
 transientScratch:Object.freeze({offset:14207,words:1559,bytes:6236}),maxColliders:27,maxEdges:128,maxChanges:384,maxOperations:768,maxEvents:256,maxBroad:256,maxBvttPairs:351,headerWords:32,
 colliderOffset:32,colliderStride:12,edgeOffset:356,edgeStride:8,
 changeOffset:1380,changeStride:16,operationOffset:7524,operationStride:6,
 eventOffset:12132,eventStride:4,broadOffset:13156,broadStride:4,
 removedOffset:14180,pairOffset:14207,matrixOffset:14909,deleteOffset:15638,
 words:15766,bytes:63064});
export const CONTACT_JOURNAL_GEOMETRY=Object.freeze({stride:6,edge:0,lifeLo:1,lifeHi:2,isActive:3,supported:4,initialBirthOwned:5});
export const CONTACT_JOURNAL_OPERATION=Object.freeze({unlink:1,edgeRemoved:2,edgeRelocated:3,strongWake:4,interactionChanged:5,link:6});
const L=CONTACT_JOURNAL_LAYOUT;
const need=(yes,message)=>{if(!yes)throw new RangeError('Resident journal: '+message);};
const uint=x=>Number.isInteger(x)&&x>=0&&x<=U;
const same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
const validHandle=h=>h&&Object.keys(h).sort().join(',')==='generation,index'&&uint(h.index)&&uint(h.generation);
const lifetime=x=>{need(Number.isSafeInteger(x)&&x>=0,'exact source lifetime');return[Number(BigInt(x)&0xffffffffn),Number(BigInt(x)>>32n)];};
const readLife=(a,p)=>{const n=BigInt(a[p])+(BigInt(a[p+1])<<32n);need(n<=BigInt(Number.MAX_SAFE_INTEGER),'source lifetime overflow');return Number(n);};
/** Initial/checkpoint import only. The owner authenticates sourceSnapshotSha256
 * once for the whole world; no future native journal is accepted at runtime.
 * bodyColliderOrder must contain the actual source parent collider-list order
 * for EVERY parent (fixed, ball, cue). It is never inferred from arena order. */
export function encodeContactJournal(seed,{state=seed,bodyColliderOrder=[],cueClothPair=null,initialClothBirth=null}={}){
 need(Array.isArray(seed.colliders)&&seed.colliders.length<=27,'bounded collider registry');
 need(Array.isArray(state.edges)&&state.edges.length<=128&&Array.isArray(state.adjacency),'complete bounded graph');
 const a=new Uint32Array(L.words),colliders=seed.colliders,slots=new Map();
 need(Array.isArray(bodyColliderOrder)&&bodyColliderOrder.length>0,'complete source parent.collider-list order required');
 const orderedBodies=new Set(),orderedColliders=new Set();
 for(const row of bodyColliderOrder){need(validHandle(row.body)&&Array.isArray(row.colliders)&&row.colliders.length<=27,'exact source parent.collider-list');const bk=row.body.index+':'+row.body.generation;need(!orderedBodies.has(bk),'duplicate source parent list');orderedBodies.add(bk);for(const handle of row.colliders){need(validHandle(handle),'source parent collider handle');const c=colliders.find(c=>same(c.handle,handle));const ck=handle.index+':'+handle.generation;need(c&&same(c.body,row.body)&&!orderedColliders.has(ck),'source parent collider ownership/order');orderedColliders.add(ck);}}
 need(orderedColliders.size===colliders.length,'complete source parent.collider-list order required');
 const cues=seed.cueColliders??[],live=state.liveColliders??colliders.map(c=>c.handle);
 need(cues.length===0||cues.length===3,'zero or all three original cue colliders');
 need(new Set(live.map(h=>h.index+':'+h.generation)).size===live.length,'distinct live colliders');
 need(uint(state.sequence??0)&&uint(state.revision??0),'u32 graph clocks');
 a[H.colliders]=colliders.length;a[H.edges]=state.edges.length;a[H.sequence]=state.sequence??0;a[H.revision]=state.revision??0;
 a.set(lifetime(state.nextLifetime??state.edges.length+1),H.nextLo);a[H.cueCount]=cues.length;a[H.cuePresent]=+(state.cuePresent??cues.length>0);
 a[H.cloth1]=U;a[H.cloth2]=U;a[H.birth1]=U;a[H.birth2]=U;
 colliders.forEach((c,i)=>{need(validHandle(c.handle)&&validHandle(c.body)&&['Fixed','Dynamic'].includes(c.type)&&uint(c.groups),'exact collider identity/filter');need(!slots.has(c.handle.index),'unique collider arena index');slots.set(c.handle.index,i);
  const isCue=cues.some(h=>same(h,c.handle)),sourceOrder=bodyColliderOrder.find(r=>same(r.body,c.body));
  const rank=sourceOrder?.colliders.findIndex(h=>same(h,c.handle))??-1;need(rank>=0,'source parent.collider-list order required');
  a.set([c.handle.index,c.handle.generation,c.body.index,c.body.generation,c.type==='Fixed'?0:1,c.groups,+live.some(h=>same(h,c.handle)),+isCue,rank,U,U,0],L.colliderOffset+i*12);
 });
 const slot=h=>{need(validHandle(h),'generation-bearing collider');const i=slots.get(h.index);need(i!==undefined&&same(colliders[i].handle,h),'registered collider generation');return i;};
 for(const h of live)slot(h);for(const h of cues)slot(h);
 if(cueClothPair){a[H.cloth1]=slot(cueClothPair.collider1);a[H.cloth2]=slot(cueClothPair.collider2);}
 if(initialClothBirth){a[H.birth1]=slot(initialClothBirth.clothCollider);a[H.birth2]=slot(initialClothBirth.primary);a[H.birthPending]=1;}
 const lives=state.lifetimes??state.edges.map((_,i)=>i+1);need(lives.length===state.edges.length,'one lifetime per edge');
 const seen=new Set();state.edges.forEach((e,i)=>{const x=slot(e.collider1),y=slot(e.collider2),ca=colliders[x],cb=colliders[y];need(ca.handle.index<cb.handle.index&&same(e.body1,ca.body)&&same(e.body2,cb.body)&&typeof e.active==='boolean','canonical edge identity');need(a[L.colliderOffset+x*12+6]&&a[L.colliderOffset+y*12+6],'live edge endpoints');need(!same(ca.body,cb.body)&&!(ca.type==='Fixed'&&cb.type==='Fixed')&&((ca.groups>>>16)&(cb.groups&65535))&&((cb.groups>>>16)&(ca.groups&65535)),'source eligible edge');need(!seen.has(x+':'+y),'duplicate edge');seen.add(x+':'+y);a.set([x,y,+e.active,...lifetime(lives[i]),U,U,0],L.edgeOffset+i*8);});
 need(state.adjacency.length===live.length,'complete live adjacency');const adjSeen=new Set();
 for(const row of state.adjacency){const i=slot(row.collider);need(a[L.colliderOffset+i*12+6]&&!adjSeen.has(i),'unique live adjacency');adjSeen.add(i);for(const [side,field,next,head]of [['outgoing','collider1',5,9],['incoming','collider2',6,10]]){const ids=row[side];need(Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.every(id=>uint(id)&&state.edges[id]&&same(state.edges[id][field],row.collider)),'exact directional adjacency');need(ids.length===state.edges.filter(e=>same(e[field],row.collider)).length,'complete directional adjacency');a[L.colliderOffset+i*12+head]=ids[0]??U;ids.forEach((id,k)=>a[L.edgeOffset+id*8+next]=ids[k+1]??U);}}
 return a;
}

export function decodeContactJournal(a){
 need(a instanceof Uint32Array&&a.length>=L.words,'complete packed region');
 for(const[k,max]of[['colliders',27],['edges',128],['changes',384],['operations',768],['events',256],['broad',256],['removed',27]])need(a[H[k]]<=max,'corrupt '+k+' count');
 const c=i=>{need(i<a[H.colliders],'collider slot');const p=L.colliderOffset+i*12;return{handle:{index:a[p],generation:a[p+1]},body:{index:a[p+2],generation:a[p+3]}};};
 const edge=(x,y,isActive)=>({collider1:c(x).handle,collider2:c(y).handle,body1:c(x).body,body2:c(y).body,active:!!isActive});
 const edges=[],lifetimes=[],adjacency=[],liveColliders=[];
 for(let i=0;i<a[H.edges];i++){const p=L.edgeOffset+i*8;edges.push(edge(a[p],a[p+1],a[p+2]));lifetimes.push(readLife(a,p+3));}
 for(let i=0;i<a[H.colliders];i++){const p=L.colliderOffset+i*12;if(!a[p+6])continue;liveColliders.push(c(i).handle);const row={collider:c(i).handle,outgoing:[],incoming:[]};for(const[side,head,next]of[['outgoing',9,5],['incoming',10,6]]){let id=a[p+head];while(id!==U){need(id<edges.length&&row[side].length<128&&!row[side].includes(id),'acyclic adjacency');row[side].push(id);id=a[L.edgeOffset+id*8+next];}}adjacency.push(row);}
 const changes=Array.from({length:a[H.changes]},(_,i)=>{const p=L.changeOffset+i*16,kind=a[p],e=edge(a[p+3],a[p+4],a[p+5]),common={kind:['','append','remove','active'][kind],edgeId:a[p+1],lifetime:readLife(a,p+6),edge:e};if(kind===2){common.lastEdgeId=a[p+2];common.relocated=a[p+10]===U?null:{edge:edge(a[p+10],a[p+11],a[p+12]),lifetime:readLife(a,p+13)};if(a[p+9]!==U)common.removalReason='collider-node';}if(kind===3)common.active=!!a[p+8];return common;});
 const operations=Array.from({length:a[H.operations]},(_,i)=>{const p=L.operationOffset+i*6,k=a[p];if(k===1)return{kind:'unlink',edgeId:a[p+1]};if(k===2)return{kind:'edge-removed',removedEdgeId:a[p+1],lastEdgeId:a[p+2]};if(k===3)return{kind:'edge-relocated',oldEdgeId:a[p+1],newEdgeId:a[p+2]};const pair={body1:c(a[p+3]).body,body2:c(a[p+4]).body};if(k===4)return{kind:'interaction-strong-wake',...pair,reason:a[p+5]===1?'collider-removal':'active-pair-deletion'};if(k===5)return{kind:'interaction-changed',...pair,wakeUp:!!a[p+5],strongWake:false};if(k===6)return{kind:'link',edgeId:a[p+1],...pair};throw new RangeError('Unknown packed operation');});
 const contactEvents=Array.from({length:a[H.events]},(_,i)=>{const p=L.eventOffset+i*4;return{collider1:c(a[p]).handle,collider2:c(a[p+1]).handle,started:!!a[p+2],...(a[p+3]?{flags:a[p+3]}:{})};});
 const broadPhaseEvents=Array.from({length:a[H.broad]},(_,i)=>{const p=L.broadOffset+i*4;return{kind:a[p]===1?'AddPair':'DeletePair',...edge(a[p+1],a[p+2],a[p+3])};});
 return{state:{edges,adjacency,lifetimes,liveColliders,sequence:a[H.sequence],revision:a[H.revision],nextLifetime:readLife(a,H.nextLo),...(a[H.cueCount]?{cuePresent:!!a[H.cuePresent]}:{})},changes,operations,contactEvents,broadPhaseEvents,removedColliders:Array.from({length:a[H.removed]},(_,i)=>c(a[L.removedOffset+i]).handle),status:a[H.status],phase:a[H.phase],fromSequence:a[H.fromSequence],fromRevision:a[H.fromRevision]};
}

/** Requires generated BVH and roster declarations plus rc_state storage binding.
 * A single invocation owns the entire absolute region. Device geometry rows and
 * the source-owned BVH are the only inputs after initial import. Status != 0
 * invalidates the whole draft; owner must discard all state-bank mutations. */
export function generateContactJournalWGSL(){return WGSL+WGSL_BVH+WGSL_ROSTER;}
const WGSL=String.raw`
const RC_J_NONE:u32=4294967295u;
fn rc_jr(b:u32,p:u32)->u32{return rc_state[b+p];}
fn rc_jw(b:u32,p:u32,v:u32){rc_state[b+p]=v;}
fn rc_jfail(b:u32,s:u32){if(rc_jr(b,0u)==0u){rc_jw(b,0u,s);}}
fn rc_jc(i:u32)->u32{return 32u+i*12u;}
fn rc_je(i:u32)->u32{return 356u+i*8u;}
fn rc_jslot(b:u32,index:u32,generation:u32)->u32{for(var i=0u;i<rc_jr(b,2u);i++){let p=rc_jc(i);if(rc_jr(b,p)==index&&rc_jr(b,p+1u)==generation){return i;}}return RC_J_NONE;}
fn rc_jfind(b:u32,x:u32,y:u32)->u32{for(var i=0u;i<rc_jr(b,3u);i++){let p=rc_je(i);if(rc_jr(b,p)==x&&rc_jr(b,p+1u)==y){return i;}}return RC_J_NONE;}
fn rc_jeligible(b:u32,x:u32,y:u32)->bool{let a=rc_jc(x);let c=rc_jc(y);if(x==y||rc_jr(b,a+6u)==0u||rc_jr(b,c+6u)==0u||(rc_jr(b,a+2u)==rc_jr(b,c+2u)&&rc_jr(b,a+3u)==rc_jr(b,c+3u))||(rc_jr(b,a+4u)==0u&&rc_jr(b,c+4u)==0u)){return false;}let ag=rc_jr(b,a+5u);let cg=rc_jr(b,c+5u);return ((ag>>16u)&(cg&65535u))!=0u&&((cg>>16u)&(ag&65535u))!=0u;}
fn rc_jcue(b:u32,x:u32,y:u32)->bool{return rc_jr(b,rc_jc(x)+7u)!=0u||rc_jr(b,rc_jc(y)+7u)!=0u;}
fn rc_jcloth(b:u32,x:u32,y:u32)->bool{return x==rc_jr(b,17u)&&y==rc_jr(b,18u);}
fn rc_jop(b:u32,kind:u32,a:u32,c:u32,x:u32,y:u32,flag:u32){let n=rc_jr(b,9u);if(n>=768u){rc_jfail(b,2u);return;}let p=7524u+n*6u;rc_jw(b,p,kind);rc_jw(b,p+1u,a);rc_jw(b,p+2u,c);rc_jw(b,p+3u,x);rc_jw(b,p+4u,y);rc_jw(b,p+5u,flag);rc_jw(b,9u,n+1u);}
fn rc_jevent(b:u32,x:u32,y:u32,isStarted:u32,flags:u32){let n=rc_jr(b,10u);if(n>=256u){rc_jfail(b,2u);return;}let p=12132u+n*4u;rc_jw(b,p,x);rc_jw(b,p+1u,y);rc_jw(b,p+2u,isStarted);rc_jw(b,p+3u,flags);rc_jw(b,10u,n+1u);}
fn rc_jbroad(b:u32,kind:u32,x:u32,y:u32,isActive:u32){let n=rc_jr(b,11u);if(n>=256u){rc_jfail(b,2u);return;}let p=13156u+n*4u;rc_jw(b,p,kind);rc_jw(b,p+1u,x);rc_jw(b,p+2u,y);rc_jw(b,p+3u,isActive);rc_jw(b,11u,n+1u);}
fn rc_jchange(b:u32,kind:u32,id:u32,last:u32,newActive:u32,withdraw:u32)->u32{let n=rc_jr(b,8u);if(n>=384u){rc_jfail(b,2u);return RC_J_NONE;}let p=1380u+n*16u;let e=rc_je(id);for(var j=0u;j<16u;j++){rc_jw(b,p+j,0u);}rc_jw(b,p,kind);rc_jw(b,p+1u,id);rc_jw(b,p+2u,last);for(var j=0u;j<5u;j++){rc_jw(b,p+3u+j,rc_jr(b,e+j));}rc_jw(b,p+8u,newActive);rc_jw(b,p+9u,withdraw);rc_jw(b,p+10u,RC_J_NONE);if(kind==2u&&id!=last){let tail=rc_je(last);for(var j=0u;j<5u;j++){rc_jw(b,p+10u+j,rc_jr(b,tail+j));}}rc_jw(b,8u,n+1u);return p;}
fn rc_journal_begin(b:u32){if(rc_jr(b,0u)!=0u){return;}if(rc_jr(b,1u)!=0u){rc_jfail(b,1u);return;}if(rc_jr(b,4u)==RC_J_NONE||rc_jr(b,5u)==RC_J_NONE){rc_jfail(b,2u);return;}rc_jw(b,13u,rc_jr(b,4u));rc_jw(b,14u,rc_jr(b,5u));for(var p=8u;p<=12u;p++){rc_jw(b,p,0u);}rc_jw(b,22u,0u);rc_jw(b,1u,1u);}
fn rc_jappend(b:u32,x:u32,y:u32){if(rc_jr(b,0u)!=0u){return;}let n=rc_jr(b,3u);if(n>=128u){rc_jfail(b,2u);return;}if(!rc_jeligible(b,x,y)||rc_jfind(b,x,y)!=RC_J_NONE||rc_jr(b,rc_jc(x))>=rc_jr(b,rc_jc(y))){rc_jfail(b,1u);return;}let e=rc_je(n);for(var j=0u;j<8u;j++){rc_jw(b,e+j,0u);}rc_jw(b,e,x);rc_jw(b,e+1u,y);rc_jw(b,e+3u,rc_jr(b,6u));rc_jw(b,e+4u,rc_jr(b,7u));rc_jw(b,e+5u,rc_jr(b,rc_jc(x)+9u));rc_jw(b,e+6u,rc_jr(b,rc_jc(y)+10u));rc_jw(b,rc_jc(x)+9u,n);rc_jw(b,rc_jc(y)+10u,n);rc_jw(b,3u,n+1u);rc_jchange(b,1u,n,n,0u,RC_J_NONE);let lo=rc_jr(b,6u);if(lo==RC_J_NONE){if(rc_jr(b,7u)>=2097151u){rc_jfail(b,2u);return;}rc_jw(b,6u,0u);rc_jw(b,7u,rc_jr(b,7u)+1u);}else{rc_jw(b,6u,lo+1u);}rc_jbroad(b,1u,x,y,0u);}
// Unlink target from both directional linked lists, then rename dense tail ID
// everywhere without changing list traversal order (source Vec swap_remove).
fn rc_jremove(b:u32,id:u32,withdraw:u32){if(rc_jr(b,0u)!=0u){return;}if(id>=rc_jr(b,3u)){rc_jfail(b,1u);return;}let e=rc_je(id);let x=rc_jr(b,e);let y=rc_jr(b,e+1u);let wasActive=rc_jr(b,e+2u);let last=rc_jr(b,3u)-1u;rc_jchange(b,2u,id,last,0u,withdraw);rc_jop(b,1u,id,0u,x,y,0u);rc_jop(b,2u,id,last,x,y,0u);if(id!=last){rc_jop(b,3u,last,id,x,y,0u);}
 for(var s=0u;s<2u;s++){var owner=x;if(s==1u){owner=y;}let head=rc_jc(owner)+9u+s;let next=5u+s;var at=rc_jr(b,head);var previous=RC_J_NONE;var visits=0u;loop{if(at==RC_J_NONE){rc_jfail(b,1u);return;}if(at==id){let after=rc_jr(b,rc_je(at)+next);if(previous==RC_J_NONE){rc_jw(b,head,after);}else{rc_jw(b,rc_je(previous)+next,after);}break;}if(at>=rc_jr(b,3u)||visits>=128u){rc_jfail(b,1u);return;}visits++;previous=at;at=rc_jr(b,rc_je(at)+next);}}
 for(var i=0u;i<rc_jr(b,2u);i++){for(var s=9u;s<11u;s++){let p=rc_jc(i)+s;if(rc_jr(b,p)==last){rc_jw(b,p,id);}}}for(var i=0u;i<rc_jr(b,3u);i++){for(var s=5u;s<7u;s++){let p=rc_je(i)+s;if(rc_jr(b,p)==last){rc_jw(b,p,id);}}}
 if(id!=last){for(var j=0u;j<8u;j++){rc_jw(b,e+j,rc_jr(b,rc_je(last)+j));}}for(var j=0u;j<8u;j++){rc_jw(b,rc_je(last)+j,0u);}rc_jw(b,3u,last);if(wasActive!=0u&&withdraw==RC_J_NONE){rc_jop(b,4u,0u,0u,x,y,0u);rc_jevent(b,x,y,0u,0u);}}
fn rc_jwithdraw(b:u32,slot:u32){let c=rc_jc(slot);if(rc_jr(b,c+6u)==0u||rc_jr(b,c+7u)==0u){rc_jfail(b,3u);return;}
 // All incident contact events/wakes precede this collider's first removal.
 for(var side=0u;side<2u;side++){var id=rc_jr(b,c+9u+side);var visits=0u;loop{if(id==RC_J_NONE){break;}if(id>=rc_jr(b,3u)||visits>=128u){rc_jfail(b,1u);return;}visits++;let e=rc_je(id);let x=rc_jr(b,e);let y=rc_jr(b,e+1u);if(rc_jr(b,e+2u)!=0u){if(!rc_jcloth(b,x,y)){rc_jfail(b,3u);return;}rc_jevent(b,x,y,0u,2u);}rc_jop(b,4u,0u,0u,x,y,1u);id=rc_jr(b,e+5u+side);}}
 for(var side=0u;side<2u;side++){var visits=0u;loop{let id=rc_jr(b,c+9u+side);if(id==RC_J_NONE){break;}if(visits>=128u){rc_jfail(b,1u);return;}visits++;rc_jremove(b,id,slot);if(rc_jr(b,0u)!=0u){return;}}}let n=rc_jr(b,12u);if(n>=27u){rc_jfail(b,2u);return;}rc_jw(b,14180u+n,slot);rc_jw(b,12u,n+1u);rc_jw(b,c+6u,0u);}
// Called from the device body-removal owner in source removed-body order.
// Collider order is authenticated at import, never sorted by collider index.
fn rc_journal_withdraw_body(b:u32,index:u32,generation:u32){if(rc_jr(b,0u)!=0u){return;}if(rc_jr(b,1u)!=1u){rc_jfail(b,1u);return;}for(var rank=0u;rank<27u;rank++){for(var i=0u;i<rc_jr(b,2u);i++){let c=rc_jc(i);if(rc_jr(b,c+2u)==index&&rc_jr(b,c+3u)==generation&&rc_jr(b,c+8u)==rank&&rc_jr(b,c+6u)!=0u){rc_jwithdraw(b,i);if(rc_jr(b,0u)!=0u){return;}}}}}
`;
const WGSL_BVH=String.raw`
fn rc_jleaf(b:u32,v:u32,slot:u32)->u32{let c=rc_jc(slot);let id=rc_jr(b,c);if(id>=27u||rc_state[v+1787u+id]!=rc_jr(b,c+1u)){rc_jfail(b,1u);return RC_J_NONE;}let p=rc_state[v+1760u+id];if(p!=RC_J_NONE&&p>=192u){rc_jfail(b,1u);return RC_J_NONE;}return p;}
fn rc_jpair_less(b:u32,a:u32,c:u32)->bool{let ax=a/27u;let ay=a%27u;let cx=c/27u;let cy=c%27u;let ai=rc_jr(b,rc_jc(ax));let ci=rc_jr(b,rc_jc(cx));if(ai!=ci){return ai<ci;}return rc_jr(b,rc_jc(ay))<rc_jr(b,rc_jc(cy));}
// Source-owned current fat-box tree, not host overlap flags. The BVTT stream
// determines births; complete live-leaf overlaps independently determine stale
// pairs and prove that the changed-tree traversal missed no new eligible pair.
fn rc_journal_prepare_bvh(b:u32,v:u32){
 if(rc_jr(b,0u)!=0u){return;}if(rc_jr(b,1u)!=1u||rc_state[v+18u]!=0u){rc_jfail(b,1u);return;}
 let removed=rc_jr(b,12u);if(removed!=0u&&removed!=rc_jr(b,16u)){rc_jfail(b,3u);return;}
 for(var i=0u;i<729u;i++){rc_jw(b,14909u+i,0u);}let nc=rc_jr(b,2u);
 for(var x=0u;x<nc;x++){for(var y=0u;y<nc;y++){if(rc_jr(b,rc_jc(x))>=rc_jr(b,rc_jc(y))||!rc_jeligible(b,x,y)){continue;}let a=rc_jleaf(b,v,x);let c=rc_jleaf(b,v,y);if(rc_jr(b,0u)!=0u){return;}if(a==RC_J_NONE||c==RC_J_NONE){continue;}if(rc_bvh_hit(rc_bvh_node(v,a),rc_bvh_node(v,c))){rc_jw(b,14909u+x*27u+y,1u);}}}
 // Preserve the original admitted cue domain. Unsupported simultaneous
 // noncue changes cannot be silently generalized while cue ownership is live.
 if(rc_jr(b,15u)!=0u){for(var x=0u;x<nc;x++){for(var y=0u;y<nc;y++){if(rc_jr(b,rc_jc(x))>=rc_jr(b,rc_jc(y))||!rc_jeligible(b,x,y)||rc_jcue(b,x,y)){continue;}let exists=rc_jfind(b,x,y)!=RC_J_NONE;let wanted=rc_jr(b,14909u+x*27u+y)!=0u;if(exists!=wanted){let initial=rc_jr(b,21u)!=0u&&rc_jr(b,4u)==0u&&x==rc_jr(b,19u)&&y==rc_jr(b,20u)&&wanted&&!exists;if(!initial){rc_jfail(b,3u);return;}}}}}
 let count=rc_bvh_bvtt(v,b+14207u,351u);if(count==RC_J_NONE||count>351u||rc_state[v+18u]!=0u){rc_jfail(b,3u);return;}
 for(var i=0u;i<count;i++){let ai=rc_jr(b,14207u+2u*i);let ci=rc_jr(b,14208u+2u*i);if(ai>=27u||ci>=27u){rc_jfail(b,1u);return;}var x=rc_jslot(b,ai,rc_state[v+1787u+ai]);var y=rc_jslot(b,ci,rc_state[v+1787u+ci]);if(x==RC_J_NONE||y==RC_J_NONE){rc_jfail(b,1u);return;}if(rc_jr(b,rc_jc(x))>rc_jr(b,rc_jc(y))){let swap=x;x=y;y=swap;}if(!rc_jeligible(b,x,y)){continue;}let p=14909u+x*27u+y;let flags=rc_jr(b,p);if((flags&2u)!=0u||(flags&1u)==0u){rc_jfail(b,1u);return;}rc_jw(b,p,flags|2u);if(rc_jfind(b,x,y)==RC_J_NONE){rc_jappend(b,x,y);if(rc_jr(b,0u)!=0u){return;}}}
 for(var x=0u;x<nc;x++){for(var y=0u;y<nc;y++){if((rc_jr(b,14909u+x*27u+y)&1u)!=0u&&rc_jfind(b,x,y)==RC_J_NONE){rc_jfail(b,3u);return;}}}
 var deletes=0u;for(var i=0u;i<rc_jr(b,3u);i++){let e=rc_je(i);let x=rc_jr(b,e);let y=rc_jr(b,e+1u);if((rc_jr(b,14909u+x*27u+y)&1u)==0u){if(deletes>=128u){rc_jfail(b,2u);return;}rc_jw(b,15638u+deletes,x*27u+y);deletes++;}}
 for(var i=1u;i<deletes;i++){let pair=rc_jr(b,15638u+i);var j=i;loop{if(j==0u||!rc_jpair_less(b,pair,rc_jr(b,15637u+j))){break;}rc_jw(b,15638u+j,rc_jr(b,15637u+j));j--;}rc_jw(b,15638u+j,pair);}
 for(var i=0u;i<deletes;i++){let pair=rc_jr(b,15638u+i);let x=pair/27u;let y=pair%27u;let id=rc_jfind(b,x,y);if(id==RC_J_NONE){rc_jfail(b,1u);return;}let isActive=rc_jr(b,rc_je(id)+2u);if(isActive!=0u&&rc_jcue(b,x,y)&&!rc_jcloth(b,x,y)){rc_jfail(b,3u);return;}rc_jbroad(b,2u,x,y,isActive);rc_jremove(b,id,RC_J_NONE);if(rc_jr(b,0u)!=0u){return;}}
 if(removed!=0u){rc_jw(b,15u,0u);}rc_jw(b,1u,2u);
}
// Complete geometry-owner rows in dense edge order, bound to current lifetime.
// supported=0 is UNKNOWN/unsupported, never an inactive contact or failed shot.
fn rc_journal_narrow(b:u32,geometry:u32,count:u32){
 if(rc_jr(b,0u)!=0u){return;}if(rc_jr(b,1u)!=2u||count!=rc_jr(b,3u)){rc_jfail(b,1u);return;}
 for(var id=0u;id<count;id++){let g=geometry+id*6u;let e=rc_je(id);if(rc_state[g]!=id||rc_state[g+1u]!=rc_jr(b,e+3u)||rc_state[g+2u]!=rc_jr(b,e+4u)||rc_state[g+3u]>1u){rc_jfail(b,1u);return;}if(rc_state[g+4u]!=1u){rc_jfail(b,3u);return;}let isActive=rc_state[g+3u];let x=rc_jr(b,e);let y=rc_jr(b,e+1u);if(isActive==rc_jr(b,e+2u)){continue;}if(rc_jcue(b,x,y)&&!rc_jcloth(b,x,y)){rc_jfail(b,3u);return;}if(isActive!=0u&&rc_jr(b,21u)!=0u&&x==rc_jr(b,19u)&&y==rc_jr(b,20u)&&rc_state[g+5u]!=1u){rc_jfail(b,3u);return;}
 rc_jchange(b,3u,id,id,isActive,RC_J_NONE);rc_jw(b,e+2u,isActive);rc_jop(b,5u,0u,0u,x,y,isActive);if(isActive!=0u){rc_jop(b,6u,id,0u,x,y,0u);}else{rc_jop(b,1u,id,0u,x,y,0u);}rc_jevent(b,x,y,isActive,0u);if(rc_jr(b,0u)!=0u){return;}}
 rc_jw(b,4u,rc_jr(b,13u)+1u);var revision=rc_jr(b,14u);if(rc_jr(b,8u)!=0u||rc_jr(b,12u)!=0u){revision++;}rc_jw(b,5u,revision);rc_jw(b,1u,3u);
}
`;
const WGSL_ROSTER=String.raw`
// Replay device-derived graph journal only after narrow determines final
// revision. This is the original roster receipt boundary, not host control.
fn rc_journal_apply_roster(b:u32,r:u32){
 if(rc_jr(b,0u)!=0u){return;}if(rc_jr(b,1u)!=3u||rc_jr(b,22u)!=0u||rc_r(r,9u)!=rc_jr(b,13u)||rc_r(r,10u)!=rc_jr(b,14u)){rc_jfail(b,1u);return;}
 rc_roster_begin(r,rc_jr(b,4u),rc_jr(b,5u),rc_jr(b,12u)!=0u);
 for(var i=0u;i<rc_jr(b,8u);i++){let p=1380u+i*16u;let kind=rc_jr(b,p);let id=rc_jr(b,p+1u);let x=rc_jc(rc_jr(b,p+3u));let y=rc_jc(rc_jr(b,p+4u));
 if(kind==1u){let added=rc_roster_append(r,rc_jr(b,x),rc_jr(b,x+1u),rc_jr(b,y),rc_jr(b,y+1u),rc_jr(b,x+2u),rc_jr(b,x+3u),rc_jr(b,y+2u),rc_jr(b,y+3u));if(added!=id){rc_jfail(b,1u);return;}}
 else{if(id>=rc_r(r,1u)){rc_jfail(b,1u);return;}let e=rc_edge(id);if(rc_r(r,e)!=rc_jr(b,x)||rc_r(r,e+1u)!=rc_jr(b,x+1u)||rc_r(r,e+2u)!=rc_jr(b,y)||rc_r(r,e+3u)!=rc_jr(b,y+1u)||rc_r(r,e+9u)!=rc_jr(b,p+6u)||rc_r(r,e+10u)!=rc_jr(b,p+7u)){rc_jfail(b,1u);return;}
 if(kind==2u){let w=rc_jr(b,p+9u);var wi=RC_J_NONE;var wg=0u;if(w!=RC_J_NONE){let c=rc_jc(w);if(rc_jr(b,c+6u)!=0u||rc_jr(b,c+7u)==0u){rc_jfail(b,1u);return;}wi=rc_jr(b,c);wg=rc_jr(b,c+1u);}rc_roster_remove(r,id,rc_jr(b,p+6u),rc_jr(b,p+7u),wi,wg);}else if(kind==3u){rc_roster_active(r,id,rc_jr(b,p+8u)!=0u);}else{rc_jfail(b,1u);return;}}
 if(rc_r(r,0u)!=0u){rc_jfail(b,rc_r(r,0u));return;}}
 if(rc_r(r,1u)!=rc_jr(b,3u)||rc_r(r,17u)!=rc_jr(b,6u)||rc_r(r,18u)!=rc_jr(b,7u)){rc_jfail(b,1u);return;}rc_roster_finish_transitions(r);if(rc_r(r,0u)!=0u){rc_jfail(b,rc_r(r,0u));return;}rc_jw(b,22u,1u);
}
// Call only after geometry/activation/solver and source post-step BVH finish.
// Whole-h shadow-bank publication is owned by the enclosing world driver.
fn rc_journal_finish(b:u32){if(rc_jr(b,0u)!=0u){return;}if(rc_jr(b,1u)!=3u||rc_jr(b,22u)!=1u){rc_jfail(b,1u);return;}if(rc_jr(b,21u)!=0u){let id=rc_jfind(b,rc_jr(b,19u),rc_jr(b,20u));if(id==RC_J_NONE||rc_jr(b,rc_je(id)+2u)==0u){rc_jfail(b,3u);return;}rc_jw(b,21u,0u);}rc_jw(b,1u,0u);}
`;
