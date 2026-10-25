// SPDX-License-Identifier: Apache-2.0
// Integer source port: Rapier b716d375, experimental-solver-contact-roster.js.
// See vendor/RAPIER-LICENSE.txt. No physical arithmetic or host forward solver.
export const SOURCE_REVISION = 'b716d375efc0201003f0cd9ef7168eee0b62c177';
export const NONE = 0xffffffff;
export const CONTACT_ROSTER_STATUS = Object.freeze({ok:0, invalid:1, capacity:2, unsupported:3});
const H = Object.freeze({status:0, edgeCount:1, bodyCount:2, maskCount:3, valid:4,
  activeEpoch:5, graphEpoch:6, multibodyEpoch:7, graphMultibodyEpoch:8,
  sequence:9, revision:10, nextSequence:11, nextRevision:12, startCount:13,
  retiredCount:14, rebuilt:15, phase:16, nextLifeLo:17, nextLifeHi:18,
  awakeCount:19,oldAwakeCount:20,oldActiveEpoch:21,lastTransition:22});
const E = Object.freeze({c1:0,c1Generation:1,c2:2,c2Generation:3,b1:4,b1Generation:5,
  b2:6,b2Generation:7,active:8,lifeLo:9,lifeHi:10,hint:11,color:12,owner1:13,
  owner2:14,manifoldCount:15,flags:16,contacts:17,manifoldColor:18,
  solverBody1:19,solverBody2:20,graphPos:21,updated:22,dirty:23});
export const CONTACT_ROSTER_LAYOUT = Object.freeze({version:1,header:H,edge:E,
  maxEdges:128,maxBodies:32,maxBodyArena:32,buckets:130,maxRetired:128,
  headerWords:32,bodyOffset:32,bodyStride:4,maskOffset:160,
  edgeOffset:288,edgeStride:24,bucketOffset:3360,bucketStride:2,
  refOffset:3620,startOffset:3748,retiredOffset:3876,retiredStride:20,
  awakeOffset:6436,words:6468,bytes:25872});
const L=CONTACT_ROSTER_LAYOUT;
const TYPES=['Fixed','Dynamic','KinematicPositionBased','KinematicVelocityBased'];
const u=(x,label)=>{if(!Number.isInteger(x)||x<0||x>NONE)throw new RangeError('Exact u32 '+label+' required');return x;};
const handle=(x,label)=>{if(!x||Object.keys(x).sort().join(',')!=='generation,index')throw new TypeError('Generation-bearing '+label+' required');return[u(x.index,label),u(x.generation,label)];};
const life=x=>{if(!Number.isSafeInteger(x)||x<0)throw new RangeError('Exact nonnegative safe-integer lifetime required');const n=BigInt(x);return[Number(n&0xffffffffn),Number(n>>32n)];};
const readLife=(a,p)=>{const n=BigInt(a[p])+(BigInt(a[p+1])<<32n);if(n>BigInt(Number.MAX_SAFE_INTEGER))throw new RangeError('Lifetime exceeds source Number semantics');return Number(n);};
const bool=(x,label)=>{if(typeof x!=='boolean')throw new TypeError('Explicit boolean '+label+' required');return+x;};

/** Initial/import serialization only. Geometry and awake updates belong on device.
 * Arbitrary manifolds, >32 raw body arena indices and retired source imports are
 * not silently narrowed. New retired reservations are device-derived only. */
export function encodeContactRoster(seed,{lifetimes=seed.edges?.map((_,i)=>i+1),nextLifetime=(lifetimes?.length??0)+1}={}){
  if(seed?.kind!=='source-single-manifold-solver-contact-roster'||seed.sourceRevision!==SOURCE_REVISION)throw new TypeError('Pinned source roster required');
  if(!Array.isArray(seed.edges)||!Array.isArray(seed.pairs)||seed.edges.length!==seed.pairs.length||seed.edges.length>L.maxEdges)throw new RangeError('Roster edge capacity');
  if(!Array.isArray(seed.bodies)||seed.bodies.length>L.maxBodies||!Array.isArray(seed.bodySolverColorMasks)||seed.bodySolverColorMasks.length>L.maxBodyArena)throw new RangeError('Roster body/mask capacity');
  if(!Array.isArray(seed.buckets)||seed.buckets.length!==L.buckets||seed.buckets[129].length)throw new RangeError('129 rigid buckets and empty generic bucket required');
  if(!Array.isArray(lifetimes)||lifetimes.length!==seed.edges.length)throw new RangeError('One lifetime per dense edge required');
  const a=new Uint32Array(L.words),set=(p,v)=>a.set(v,p),put=(k,v)=>a[H[k]]=u(v,k);
  put('edgeCount',seed.edges.length);put('bodyCount',seed.bodies.length);put('maskCount',seed.bodySolverColorMasks.length);put('valid',bool(seed.solverGraphValid,'solverGraphValid'));
  for(const [k,name]of[['activeEpoch','activeSetEpoch'],['graphEpoch','solverGraphEpoch'],['multibodyEpoch','multibodyTopologyEpoch'],['graphMultibodyEpoch','solverGraphMultibodyEpoch']])put(k,seed[name]);
  put('sequence',seed.sequence??0);put('revision',seed.revision??0);set(H.nextLifeLo,life(nextLifetime));
  const seen=new Set(),awake=seed.awakeBodies??[];
  seed.bodies.forEach((b,i)=>{const h=handle(b.handle,'body');if(h[0]>=L.maxBodyArena||seen.has(h[0])||!TYPES.includes(b.type))throw new RangeError('Distinct bounded source body registry required');seen.add(h[0]);const row=awake.find(r=>r.body.index===h[0]&&r.body.generation===h[1]);set(L.bodyOffset+i*L.bodyStride,[...h,TYPES.indexOf(b.type),row?u(row.activeSetId,'activeSetId'):NONE]);});
  if(new Set(awake.map(r=>r.activeSetId)).size!==awake.length||awake.some(r=>!seed.bodies.some(b=>b.type!=='Fixed'&&b.handle.index===r.body.index&&b.handle.generation===r.body.generation)||r.activeSetId===NONE))throw new RangeError('Exact unique awake slots required');
  put('awakeCount',awake.length);awake.forEach((r,i)=>{a[L.awakeOffset+i]=seed.bodies.findIndex(b=>b.handle.index===r.body.index&&b.handle.generation===r.body.generation);});
  seed.bodySolverColorMasks.forEach((x,i)=>{if(typeof x!=='string'&&typeof x!=='bigint')throw new TypeError('Exact u128 masks required, never Number');let n=BigInt(x);if(n<0n||n>=(1n<<128n))throw new RangeError('u128 mask overflow');for(let j=0;j<4;j++){a[L.maskOffset+i*4+j]=Number(n&0xffffffffn);n>>=32n;}});
  const expectedMasks=Array(seed.bodySolverColorMasks.length).fill(0n),byBody=new Map(seed.bodies.map(b=>[b.handle.index+':'+b.handle.generation,b]));
  seed.pairs.forEach((p,i)=>{
    const e=seed.edges[i],ends=[e.body1,e.body2].map(h=>byBody.get(h.index+':'+h.generation));
    if(ends.some(x=>!x))throw new RangeError('Exact edge body generations required');
    if(!Number.isInteger(p.solverColor)||!((p.solverColor>=0&&p.solverColor<=128)||p.solverColor===255)||!Array.isArray(p.solverColorBodies)||p.solverColorBodies.length!==2)throw new RangeError('Exact source color metadata required');
    const owners=ends.filter(b=>b.type!=='Fixed').map(b=>b.handle.index),actual=p.solverColorBodies.filter(x=>x!==NONE);
    if(p.solverColor<128){if(JSON.stringify(owners)!==JSON.stringify(actual))throw new RangeError('Source color owners mismatch');for(const id of owners){const bit=1n<<BigInt(p.solverColor);if(id>=expectedMasks.length||expectedMasks[id]&bit)throw new RangeError('Source color mask conflict');expectedMasks[id]|=bit;}}
    else if(actual.length)throw new RangeError('Uncolored pair cannot reserve source mask');
  });
  if(expectedMasks.some((x,i)=>x!==BigInt(seed.bodySolverColorMasks[i])))throw new RangeError('Mask has no imported live-pair owner; retired imports require an authenticated checkpoint');
  seed.edges.forEach((e,i)=>{const p=L.edgeOffset+i*L.edgeStride,q=seed.pairs[i];for(const[k,at]of[['collider1',0],['collider2',2],['body1',4],['body2',6]])set(p+at,handle(e[k],k));a[p+E.active]=bool(e.active,'active');set(p+E.lifeLo,life(lifetimes[i]));if(q.manifolds?.length>1||!Array.isArray(q.manifolds))throw new RangeError('Only source zero/one manifold supported');if(q.hint<0||q.hint>65535)throw new RangeError('u16 source hint required');set(p+E.hint,[u(q.hint,'hint'),u(q.solverColor,'color'),...q.solverColorBodies.map(x=>u(x,'color owner')),q.manifolds.length]);const m=q.manifolds[0];if(m){if(![0,1].includes(m.activeContactCount))throw new RangeError('Only source zero/one point supported');set(p+E.flags,[u(m.solverFlags,'flags'),m.activeContactCount,u(m.solverColor,'manifold color'),...m.solverBodyIds.map(x=>u(x,'solver body')),u(m.graphPos,'graph position')]);}else set(p+E.manifoldColor,[255,NONE,NONE,NONE]);});
  let offset=0;const refsSeen=new Set();seed.buckets.forEach((refs,color)=>{if(offset+refs.length>L.maxEdges)throw new RangeError('Compact bucket capacity');set(L.bucketOffset+color*2,[offset,refs.length]);for(let local=0;local<refs.length;local++){const r=refs[local];if(r.manifold!==0||r.edge>=seed.edges.length)throw new RangeError('Exact single-manifold bucket ref required');if(seed.solverGraphValid){const m=seed.pairs[r.edge].manifolds[0];if(refsSeen.has(r.edge)||!m||m.graphPos!==color*4194304+local||m.solverColor!==color)throw new RangeError('Source bucket/back-reference mismatch');refsSeen.add(r.edge);}a[L.refOffset+offset++]=r.edge;}});
  if(seed.solverGraphValid&&seed.pairs.some((p,i)=>p.manifolds.some(m=>m.graphPos!==NONE&&!refsSeen.has(i))))throw new RangeError('Dangling source graph position');
  return a;
}

export function decodeContactRoster(a,{initialSnapshotSha256=null,backend='webgpu'}={}){
  if(!(a instanceof Uint32Array)||a.length<L.words)throw new TypeError('Complete packed roster required');
  if(a[H.edgeCount]>L.maxEdges||a[H.bodyCount]>L.maxBodies||a[H.maskCount]>L.maxBodyArena||a[H.retiredCount]>L.maxRetired)throw new RangeError('Corrupt packed counts');
  const h=p=>({index:a[p],generation:a[p+1]}),bodies=[],awakeBodies=[],edges=[],pairs=[],lifetimes=[],buckets=[];
  for(let i=0;i<a[H.bodyCount];i++){const p=L.bodyOffset+i*4;bodies.push({handle:h(p),type:TYPES[a[p+2]]});}
  for(let i=0;i<a[H.awakeCount];i++){const slot=a[L.awakeOffset+i];if(slot>=bodies.length)throw new RangeError('Corrupt awake order');awakeBodies.push({body:bodies[slot].handle,activeSetId:a[L.bodyOffset+slot*4+3]});}
  for(let i=0;i<a[H.edgeCount];i++){const p=L.edgeOffset+i*24;edges.push({collider1:h(p),collider2:h(p+2),body1:h(p+4),body2:h(p+6),active:!!a[p+8]});lifetimes.push(readLife(a,p+9));pairs.push({hint:a[p+11],solverColor:a[p+12],solverColorBodies:[a[p+13],a[p+14]],manifolds:a[p+15]?[{activeContactCount:a[p+17],solverFlags:a[p+16],graphPos:a[p+21],solverColor:a[p+18],solverBodyIds:[a[p+19],a[p+20]]}]:[]});}
  for(let color=0;color<130;color++){const p=L.bucketOffset+color*2,start=a[p],count=a[p+1];if(start+count>128)throw new RangeError('Corrupt bucket range');buckets.push(Array.from({length:count},(_,j)=>({edge:a[L.refOffset+start+j],manifold:0})));}
  const bodySolverColorMasks=Array.from({length:a[H.maskCount]},(_,i)=>{let n=0n;for(let j=3;j>=0;j--)n=(n<<32n)+BigInt(a[L.maskOffset+i*4+j]);return n.toString();});
  const retiredReservations=Array.from({length:a[H.retiredCount]},(_,i)=>{const p=L.retiredOffset+i*20;return{edge:{collider1:h(p),collider2:h(p+2),body1:h(p+4),body2:h(p+6)},solverColor:a[p+8],owners:[a[p+9],a[p+10]].filter(x=>x!==NONE),lifetime:readLife(a,p+11),withdrawn:h(p+13),sequence:a[p+15],revision:a[p+16]};});
  return{snapshot:{kind:'source-single-manifold-solver-contact-roster',sourceRevision:SOURCE_REVISION,initialSnapshotSha256,bodies,edges,pairs,bodySolverColorMasks,buckets,solverGraphValid:!!a[H.valid],activeSetEpoch:a[H.activeEpoch],solverGraphEpoch:a[H.graphEpoch],multibodyTopologyEpoch:a[H.multibodyEpoch],solverGraphMultibodyEpoch:a[H.graphMultibodyEpoch],awakeBodies,sequence:a[H.sequence],revision:a[H.revision],backend},lifetimes,nextLifetime:readLife(a,H.nextLifeLo),retiredReservations,status:a[H.status],rebuilt:!!a[H.rebuilt],phase:a[H.phase]};
}

/** Declarations intentionally omit the binding: the owner supplies
 * `var<storage,read_write> rc_state: array<u32>;`. One invocation owns one
 * absolute base throughout a transaction. No cross-candidate atomics required.
 * Nonzero status invalidates the draft; owner must not publish/continue it. */
export function generateContactRosterWGSL(){return WGSL;}
const WGSL=String.raw`
const RC_NONE:u32=4294967295u;
fn rc_r(base:u32,at:u32)->u32 { return rc_state[base+at]; }
fn rc_w(base:u32,at:u32,value:u32) { rc_state[base+at]=value; }
fn rc_fail(base:u32,status:u32) { if(rc_r(base,0u)==0u){rc_w(base,0u,status);} }
fn rc_edge(at:u32)->u32 { return 288u+at*24u; }
fn rc_body(base:u32,index:u32,generation:u32)->u32 {
 for(var i:u32=0u;i<rc_r(base,2u);i=i+1u){let p:u32=32u+i*4u;if(rc_r(base,p)==index&&rc_r(base,p+1u)==generation){return p;}}
 return RC_NONE;
}
fn rc_mask_has(base:u32,body:u32,color:u32)->bool { return (rc_r(base,160u+body*4u+color/32u)&(1u<<(color%32u)))!=0u; }
fn rc_mask_set(base:u32,body:u32,color:u32,on:bool) {
 if(body>=32u||color>=128u){rc_fail(base,2u);return;}let p:u32=160u+body*4u+color/32u;let bit:u32=1u<<(color%32u);
 if(on){rc_w(base,p,rc_r(base,p)|bit);}else{rc_w(base,p,rc_r(base,p)&~bit);}
 if(body>=rc_r(base,3u)){rc_w(base,3u,body+1u);}
}
fn rc_clear_color(base:u32,edge:u32){let p:u32=rc_edge(edge);let color:u32=rc_r(base,p+12u);
 if(color<128u){for(var j:u32=0u;j<2u;j=j+1u){let body:u32=rc_r(base,p+13u+j);if(body!=RC_NONE){rc_mask_set(base,body,color,false);}}}
 rc_w(base,p+12u,255u);rc_w(base,p+13u,RC_NONE);rc_w(base,p+14u,RC_NONE);
}
fn rc_assign_color(base:u32,edge:u32){
 let p:u32=rc_edge(edge);if(rc_r(base,p+12u)!=255u){return;}
 let b1:u32=rc_body(base,rc_r(base,p+4u),rc_r(base,p+5u));let b2:u32=rc_body(base,rc_r(base,p+6u),rc_r(base,p+7u));
 if(b1==RC_NONE||b2==RC_NONE){rc_fail(base,1u);return;}
 var a:u32=RC_NONE;var b:u32=RC_NONE;
 if(rc_r(base,b1+2u)!=0u){a=rc_r(base,p+4u);}if(rc_r(base,b2+2u)!=0u){b=rc_r(base,p+6u);}
 var color:u32=128u;
 if(a!=RC_NONE&&b!=RC_NONE){for(var i:u32=0u;i<120u;i=i+1u){if(!rc_mask_has(base,a,i)&&!rc_mask_has(base,b,i)){color=i;break;}}}
 else{var owner:u32=a;if(owner==RC_NONE){owner=b;}if(owner!=RC_NONE){for(var n:u32=0u;n<128u;n=n+1u){let i:u32=127u-n;if(!rc_mask_has(base,owner,i)){color=i;break;}}}}
 rc_w(base,p+12u,color);rc_w(base,p+13u,RC_NONE);rc_w(base,p+14u,RC_NONE);
 if(color<128u){if(a==RC_NONE){a=b;b=RC_NONE;}rc_w(base,p+13u,a);rc_w(base,p+14u,b);rc_mask_set(base,a,color,true);if(b!=RC_NONE){rc_mask_set(base,b,color,true);}}
}
fn rc_bucket_total(base:u32)->u32 { return rc_r(base,3360u+129u*2u)+rc_r(base,3361u+129u*2u); }
fn rc_bucket_remove(base:u32,pos:u32){
 let color:u32=pos/4194304u;let local:u32=pos%4194304u;if(color>=129u){rc_fail(base,1u);return;}
 let hp:u32=3360u+color*2u;let offset:u32=rc_r(base,hp);let count:u32=rc_r(base,hp+1u);if(local>=count){rc_fail(base,1u);return;}
 let end:u32=offset+count-1u;let tail:u32=rc_r(base,3620u+end);
 if(local<count-1u){rc_w(base,3620u+offset+local,tail);rc_w(base,rc_edge(tail)+21u,pos);}
 let total:u32=rc_bucket_total(base);for(var i:u32=end;i+1u<total;i=i+1u){rc_w(base,3620u+i,rc_r(base,3621u+i));}
 rc_w(base,3620u+total-1u,0u);rc_w(base,hp+1u,count-1u);
 for(var c:u32=color+1u;c<130u;c=c+1u){let at:u32=3360u+c*2u;rc_w(base,at,rc_r(base,at)-1u);}
}
fn rc_bucket_append(base:u32,color:u32,edge:u32){
 let total:u32=rc_bucket_total(base);if(color>=128u){rc_fail(base,3u);return;}if(total>=128u){rc_fail(base,2u);return;}
 let hp:u32=3360u+color*2u;let count:u32=rc_r(base,hp+1u);let end:u32=rc_r(base,hp)+count;
 var i:u32=total;loop{if(i<=end){break;}rc_w(base,3620u+i,rc_r(base,3619u+i));i=i-1u;}
 rc_w(base,3620u+end,edge);rc_w(base,hp+1u,count+1u);rc_w(base,rc_edge(edge)+21u,color*4194304u+count);
 for(var c:u32=color+1u;c<130u;c=c+1u){let at:u32=3360u+c*2u;rc_w(base,at,rc_r(base,at)+1u);}
}
fn rc_roster_begin(base:u32,toSequence:u32,toRevision:u32,invalidated:bool){
 if(rc_r(base,0u)!=0u){return;}if(rc_r(base,9u)==RC_NONE||rc_r(base,10u)==RC_NONE){rc_fail(base,2u);return;}if(rc_r(base,16u)!=0u||toSequence!=rc_r(base,9u)+1u||toRevision<rc_r(base,10u)||toRevision>rc_r(base,10u)+1u){rc_fail(base,1u);return;}
 rc_w(base,11u,toSequence);rc_w(base,12u,toRevision);rc_w(base,13u,0u);rc_w(base,15u,0u);rc_w(base,16u,1u);rc_w(base,22u,RC_NONE);if(invalidated){rc_w(base,4u,0u);}
 for(var i:u32=0u;i<rc_r(base,1u);i=i+1u){rc_w(base,rc_edge(i)+22u,0u);rc_w(base,rc_edge(i)+23u,0u);}
}
fn rc_roster_append(base:u32,c1:u32,c1g:u32,c2:u32,c2g:u32,b1:u32,b1g:u32,b2:u32,b2g:u32)->u32 {
 if(rc_r(base,0u)!=0u){return RC_NONE;}if(rc_r(base,16u)!=1u||rc_r(base,22u)!=RC_NONE||rc_body(base,b1,b1g)==RC_NONE||rc_body(base,b2,b2g)==RC_NONE){rc_fail(base,1u);return RC_NONE;}
 let edge:u32=rc_r(base,1u);if(edge>=128u){rc_fail(base,2u);return RC_NONE;}
 for(var i:u32=0u;i<edge;i=i+1u){let p:u32=rc_edge(i);if(rc_r(base,p)==c1&&rc_r(base,p+1u)==c1g&&rc_r(base,p+2u)==c2&&rc_r(base,p+3u)==c2g){rc_fail(base,1u);return RC_NONE;}}
 let p:u32=rc_edge(edge);for(var j:u32=0u;j<24u;j=j+1u){rc_w(base,p+j,0u);}
 rc_w(base,p,c1);rc_w(base,p+1u,c1g);rc_w(base,p+2u,c2);rc_w(base,p+3u,c2g);rc_w(base,p+4u,b1);rc_w(base,p+5u,b1g);rc_w(base,p+6u,b2);rc_w(base,p+7u,b2g);
 rc_w(base,p+9u,rc_r(base,17u));rc_w(base,p+10u,rc_r(base,18u));let lo:u32=rc_r(base,17u);if(lo==RC_NONE){if(rc_r(base,18u)>=2097151u){rc_fail(base,2u);return RC_NONE;}rc_w(base,17u,0u);rc_w(base,18u,rc_r(base,18u)+1u);}else{rc_w(base,17u,lo+1u);}
 rc_w(base,p+12u,255u);rc_w(base,p+13u,RC_NONE);rc_w(base,p+14u,RC_NONE);rc_w(base,p+18u,255u);rc_w(base,p+19u,RC_NONE);rc_w(base,p+20u,RC_NONE);rc_w(base,p+21u,RC_NONE);rc_w(base,1u,edge+1u);return edge;
}
// withdrawIndex=RC_NONE denotes ordinary pair deletion. A collider-node removal
// is supplied only by the owning device journal after authenticating withdrawal.
// It invalidates buckets BEFORE removal, matching source updateState ordering.
fn rc_roster_remove(base:u32,edge:u32,lifeLo:u32,lifeHi:u32,withdrawIndex:u32,withdrawGeneration:u32){
 if(rc_r(base,0u)!=0u){return;}if(rc_r(base,16u)!=1u||rc_r(base,22u)!=RC_NONE||edge>=rc_r(base,1u)){rc_fail(base,1u);return;}
 let p:u32=rc_edge(edge);if(rc_r(base,p+9u)!=lifeLo||rc_r(base,p+10u)!=lifeHi){rc_fail(base,1u);return;}
 if(withdrawIndex!=RC_NONE){
  if(!((rc_r(base,p)==withdrawIndex&&rc_r(base,p+1u)==withdrawGeneration)||(rc_r(base,p+2u)==withdrawIndex&&rc_r(base,p+3u)==withdrawGeneration))){rc_fail(base,1u);return;}
  rc_w(base,4u,0u);let color:u32=rc_r(base,p+12u);
  if(color<128u){let count:u32=rc_r(base,14u);if(count>=128u){rc_fail(base,2u);return;}let r:u32=3876u+count*20u;for(var j:u32=0u;j<8u;j=j+1u){rc_w(base,r+j,rc_r(base,p+j));}rc_w(base,r+8u,color);rc_w(base,r+9u,rc_r(base,p+13u));rc_w(base,r+10u,rc_r(base,p+14u));rc_w(base,r+11u,lifeLo);rc_w(base,r+12u,lifeHi);rc_w(base,r+13u,withdrawIndex);rc_w(base,r+14u,withdrawGeneration);rc_w(base,r+15u,rc_r(base,11u));rc_w(base,r+16u,rc_r(base,12u));rc_w(base,14u,count+1u);}
 }else{if(rc_r(base,4u)!=0u&&rc_r(base,p+15u)!=0u&&rc_r(base,p+21u)!=RC_NONE){rc_bucket_remove(base,rc_r(base,p+21u));}rc_clear_color(base,edge);}
 let last:u32=rc_r(base,1u)-1u;if(edge!=last){let tail:u32=rc_edge(last);for(var j:u32=0u;j<24u;j=j+1u){rc_w(base,p+j,rc_r(base,tail+j));}
  if(rc_r(base,4u)!=0u&&rc_r(base,p+15u)!=0u&&rc_r(base,p+21u)!=RC_NONE){let pos:u32=rc_r(base,p+21u);let color:u32=pos/4194304u;let local:u32=pos%4194304u;rc_w(base,3620u+rc_r(base,3360u+color*2u)+local,edge);}
 }
 for(var j:u32=0u;j<24u;j=j+1u){rc_w(base,rc_edge(last)+j,0u);}rc_w(base,1u,last);
}
fn rc_roster_active(base:u32,edge:u32,isActive:bool){
 if(rc_r(base,0u)!=0u){return;}if(rc_r(base,16u)!=1u||edge>=rc_r(base,1u)||(rc_r(base,22u)!=RC_NONE&&edge<=rc_r(base,22u))){rc_fail(base,1u);return;}
 let p:u32=rc_edge(edge);if((rc_r(base,p+8u)!=0u)==isActive){rc_fail(base,1u);return;}rc_w(base,22u,edge);
 if(isActive){rc_w(base,p+8u,1u);let n:u32=rc_r(base,13u);rc_w(base,3748u+n,edge);rc_w(base,13u,n+1u);}else{rc_w(base,p+8u,0u);rc_clear_color(base,edge);}
}
fn rc_start_less(base:u32,a:u32,b:u32)->bool {
 let pa:u32=rc_edge(a);let pb:u32=rc_edge(b);let alo:u32=min(rc_r(base,pa+4u),rc_r(base,pa+6u));let blo:u32=min(rc_r(base,pb+4u),rc_r(base,pb+6u));if(alo!=blo){return alo<blo;}
 let ahi:u32=max(rc_r(base,pa+4u),rc_r(base,pa+6u));let bhi:u32=max(rc_r(base,pb+4u),rc_r(base,pb+6u));if(ahi!=bhi){return ahi<bhi;}return a<b;
}
fn rc_roster_finish_transitions(base:u32){
 if(rc_r(base,0u)!=0u){return;}if(rc_r(base,16u)!=1u){rc_fail(base,1u);return;}
 let n:u32=rc_r(base,13u);for(var i:u32=1u;i<n;i=i+1u){let edge:u32=rc_r(base,3748u+i);var j:u32=i;loop{if(j==0u||!rc_start_less(base,edge,rc_r(base,3747u+j))){break;}rc_w(base,3748u+j,rc_r(base,3747u+j));j=j-1u;}rc_w(base,3748u+j,edge);}
 for(var i:u32=0u;i<n;i=i+1u){rc_assign_color(base,rc_r(base,3748u+i));}rc_w(base,16u,2u);
}
fn rc_roster_metadata(base:u32,edge:u32,updated:bool,dirty:bool,hint:u32,manifolds:u32,flags:u32,contacts:u32){
 if(rc_r(base,0u)!=0u){return;}if(rc_r(base,16u)!=2u||edge>=rc_r(base,1u)||hint>65535u||manifolds>1u||contacts>1u){rc_fail(base,1u);return;}
 let p:u32=rc_edge(edge);if(rc_r(base,p+22u)!=0u){rc_fail(base,1u);return;}
 if(!updated){if(hint!=rc_r(base,p+11u)||manifolds!=rc_r(base,p+15u)||(manifolds!=0u&&(flags!=rc_r(base,p+16u)||contacts!=rc_r(base,p+17u)))){rc_fail(base,1u);return;}}
 else{if(manifolds!=rc_r(base,p+15u)&&rc_r(base,p+15u)!=0u&&rc_r(base,p+21u)!=RC_NONE){rc_w(base,4u,0u);}if(rc_r(base,p+15u)==0u&&manifolds!=0u){rc_w(base,p+18u,255u);rc_w(base,p+19u,RC_NONE);rc_w(base,p+20u,RC_NONE);rc_w(base,p+21u,RC_NONE);}rc_w(base,p+11u,hint);rc_w(base,p+15u,manifolds);rc_w(base,p+16u,flags);rc_w(base,p+17u,contacts);}
 rc_w(base,p+22u,1u);if(dirty){rc_w(base,p+23u,1u);}
}
fn rc_roster_begin_awake(base:u32,activeEpoch:u32,multibodyEpoch:u32){
 if(rc_r(base,0u)!=0u){return;}if(rc_r(base,16u)!=2u){rc_fail(base,1u);return;}
 for(var i:u32=0u;i<rc_r(base,1u);i=i+1u){if(rc_r(base,rc_edge(i)+22u)==0u){rc_fail(base,1u);return;}}
 rc_w(base,20u,rc_r(base,19u));rc_w(base,21u,rc_r(base,5u));
 for(var i:u32=0u;i<rc_r(base,2u);i=i+1u){rc_w(base,3748u+i,rc_r(base,35u+i*4u));rc_w(base,35u+i*4u,RC_NONE);rc_w(base,3812u+i,0u);}
 for(var i:u32=0u;i<rc_r(base,19u);i=i+1u){rc_w(base,3780u+i,rc_r(base,6436u+i));}
 rc_w(base,19u,0u);rc_w(base,5u,activeEpoch);rc_w(base,7u,multibodyEpoch);rc_w(base,16u,3u);
}
fn rc_roster_sleep(base:u32,index:u32,generation:u32){
 if(rc_r(base,0u)!=0u){return;}let b:u32=rc_body(base,index,generation);if(rc_r(base,16u)!=3u||b==RC_NONE){rc_fail(base,1u);return;}let slot:u32=(b-32u)/4u;if(rc_r(base,b+2u)!=1u||rc_r(base,3812u+slot)!=0u){rc_fail(base,1u);return;}rc_w(base,3812u+slot,1u);
 for(var i:u32=0u;i<rc_r(base,1u);i=i+1u){let p:u32=rc_edge(i);if((rc_r(base,p+4u)==index&&rc_r(base,p+5u)==generation)||(rc_r(base,p+6u)==index&&rc_r(base,p+7u)==generation)){rc_w(base,p+11u,rc_r(base,p+11u)&32768u);}}rc_w(base,4u,0u);
}
fn rc_roster_awake(base:u32,index:u32,generation:u32,activeSetId:u32){
 if(rc_r(base,0u)!=0u){return;}let b:u32=rc_body(base,index,generation);if(rc_r(base,16u)!=3u||b==RC_NONE||activeSetId==RC_NONE){rc_fail(base,1u);return;}let slot:u32=(b-32u)/4u;
 if(rc_r(base,b+2u)==0u||rc_r(base,b+3u)!=RC_NONE||rc_r(base,3812u+slot)!=0u){rc_fail(base,1u);return;}
 for(var i:u32=0u;i<rc_r(base,19u);i=i+1u){let prior:u32=rc_r(base,6436u+i);if(rc_r(base,35u+prior*4u)==activeSetId){rc_fail(base,1u);return;}}
 let n:u32=rc_r(base,19u);if(n>=32u){rc_fail(base,2u);return;}rc_w(base,b+3u,activeSetId);rc_w(base,6436u+n,slot);rc_w(base,19u,n+1u);
}
fn rc_reconcile(base:u32,edge:u32,full:bool){
 let p:u32=rc_edge(edge);if(rc_r(base,p+15u)==0u){return;}let b1:u32=rc_body(base,rc_r(base,p+4u),rc_r(base,p+5u));let b2:u32=rc_body(base,rc_r(base,p+6u),rc_r(base,p+7u));
 if(b1==RC_NONE||b2==RC_NONE){rc_fail(base,1u);return;}let a:u32=rc_r(base,b1+3u);let b:u32=rc_r(base,b2+3u);let hint:u32=rc_r(base,p+11u);
 let qualifies:bool=(hint&32768u)!=0u&&(hint&32767u)!=0u&&(rc_r(base,p+16u)&1u)!=0u&&rc_r(base,p+17u)!=0u&&((a!=RC_NONE&&rc_r(base,b1+2u)==1u)||(b!=RC_NONE&&rc_r(base,b2+2u)==1u));
 let pos:u32=rc_r(base,p+21u);
 if(qualifies){let color:u32=rc_r(base,p+12u);if(color>=128u){rc_fail(base,3u);return;}rc_w(base,p+19u,a);rc_w(base,p+20u,b);rc_w(base,p+18u,color);
  if(full||pos==RC_NONE||pos/4194304u!=color){if(!full&&pos!=RC_NONE){rc_bucket_remove(base,pos);}rc_bucket_append(base,color,edge);}
 }else{if(!full&&pos!=RC_NONE){rc_bucket_remove(base,pos);}rc_w(base,p+21u,RC_NONE);}
}
fn rc_roster_finish(base:u32){
 if(rc_r(base,0u)!=0u){return;}if(rc_r(base,16u)!=3u){rc_fail(base,1u);return;}
 if(rc_r(base,5u)==rc_r(base,21u)){
  if(rc_r(base,19u)!=rc_r(base,20u)){rc_fail(base,1u);return;}
  for(var i:u32=0u;i<rc_r(base,2u);i=i+1u){if(rc_r(base,35u+i*4u)!=rc_r(base,3748u+i)){rc_fail(base,1u);return;}}
  for(var i:u32=0u;i<rc_r(base,19u);i=i+1u){if(rc_r(base,6436u+i)!=rc_r(base,3780u+i)){rc_fail(base,1u);return;}}
 }
 let full:bool=rc_r(base,4u)==0u||rc_r(base,5u)!=rc_r(base,6u)||rc_r(base,7u)!=rc_r(base,8u);
 if(full){for(var i:u32=0u;i<260u;i=i+1u){rc_w(base,3360u+i,0u);}}
 for(var i:u32=0u;i<rc_r(base,1u);i=i+1u){if(full||rc_r(base,rc_edge(i)+23u)!=0u){rc_reconcile(base,i,full);if(rc_r(base,0u)!=0u){return;}}}
 if(full){rc_w(base,6u,rc_r(base,5u));rc_w(base,8u,rc_r(base,7u));rc_w(base,4u,1u);rc_w(base,15u,1u);}
 rc_w(base,9u,rc_r(base,11u));rc_w(base,10u,rc_r(base,12u));rc_w(base,16u,0u);
}
`;
