import test from 'node:test';import assert from 'node:assert/strict';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {packCreatedGeometry,GEOMETRY_CATALOG as C} from '../src/resident-candidate/geometry-state.mjs';
import {generateGeometryWorldWGSL} from '../src/resident-candidate/geometry-world.mjs';
import {encodeContactJournal,CONTACT_JOURNAL_LAYOUT as J} from '../src/resident-candidate/contact-journal.mjs';
import {createNativeOwner,dispatchWords} from './resident-candidate-gpu-support.mjs';
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
async function fixture(){
 const{seed}=await originalRegisteredFixture(),p=packCreatedGeometry(seed),order=structuredClone(seed.cueBroadSeed.bodyColliders);
 // Original import has all dynamic parent lists. Every fixed parent in this
 // authenticated fixture has exactly one collider, leaving no ordering choice.
 for(const c of seed.contactGraphSeed.colliders.filter(c=>c.type==='Fixed')){assert.equal(seed.contactGraphSeed.colliders.filter(o=>o.body.index===c.body.index&&o.body.generation===c.body.generation).length,1);order.push({body:c.body,colliders:[c.handle]});}
 const journal=encodeContactJournal(seed.contactGraphSeed,{bodyColliderOrder:order});return{seed,p,journal};
}
test('geometry bridge resolves generation-bearing owners and retains exact fixed-scene cache domain',async()=>{
 const{p,journal}=await fixture();assert.equal(journal[J.header.edges],4);assert.equal(p.catalog.length,26*16);assert.match(generateGeometryWorldWGSL(),/collisionDt/);assert.doesNotMatch(generateGeometryWorldWGSL(),/sqrt\(|rc_num_eval|@compute/);assert.equal(p.completeCueCacheRoster,false);
});
test('actual native geometry bridge gathers current bodies and transfers only owned source cache fields',async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('assigned serial native GPU slot required');
 const{p,journal}=await fixture(),B=8,K=B+256+8,Q=K+p.caches.length+8,F=Q+journal.length+8,V=F+128*6+8,T=V+128*8+8,S=T+26*32+8,stride=S+96+8,initial=new Uint32Array(stride*2).fill(0x12345678),expected=[];
 const gatherMap=[[0,0,31],[34,35,3],[37,38,3],[42,41,1],[43,42,1],[44,43,1],[46,44,1],[47,45,1],[48,46,1],[110,31,4]];
 const contactMap={0:[[0,55,15],[15,72,3],[18,71,1],[19,70,1],[20,96,2],[22,115,2]],1:[[0,148,20],[20,139,2],[22,168,2]],2:[[0,272,22],[22,372,2]]};
 for(let lane=0;lane<2;lane++){
  const base=lane*stride,a=initial.subarray(base,base+stride);a.set(p.bodyWords,B);a.set(p.caches,K);a.set(journal,Q);a.fill(0,F,T);a.fill(0,S,S+96);
  if(lane)for(let b=0;b<4;b++){a[B+b*64]=bits(.2+b);a[B+b*64+3]=bits(-.3-b);a[B+b*64+6]=bits(.12+b*.02);}
  const want=a.slice(),dt=bits(lane?1/960:1/61440);
  for(let row=0;row<26;row++){const r=p.catalog.subarray(row*16,row*16+16),kind=r[C.kind],cache=K+r[C.cache],body=B+r[C.body2]*64;let mapping=kind===0?gatherMap:kind===1?[[0,0,64],[64,0,64]]:[[0,0,64]];
   for(const[dest,src,n]of mapping){const from=kind===1&&dest===0?B+r[C.body1]*64:body;want.set(a.subarray(from+src,from+src+n),cache+dest);}want[cache+(kind===0?40:128)]=dt;
   const contact=T+row*32;want.fill(0,contact,contact+32);for(const[dest,src,n]of contactMap[kind])want.set(want.subarray(cache+src,cache+src+n),contact+dest);
   // Mutable solver cache values are an address-transfer probe only. They are
   // deliberately not represented as computed physical impulses.
   for(const at of[15,16,17,18,19,22,23])want[contact+at]=0x3f000000+row*256+at;
   for(const[dest,src,n]of contactMap[kind])for(let i=0;i<n;i++)if([15,16,17,18,19,22,23].includes(dest+i))want[cache+src+i]=want[contact+dest+i];
  }
  for(let edge=0;edge<4;edge++){const ep=Q+J.edgeOffset+edge*8,c2=Q+J.colliderOffset+want[ep+1]*12,row=Array.from({length:4},(_,i)=>i).find(i=>p.catalog[i*16+C.collider2]===want[c2]),r=p.catalog.subarray(row*16,row*16+16);want.set([edge,want[ep+3],want[ep+4],1,1,0],F+edge*6);want.set([want[ep+3],want[ep+4],1,base+K+r[C.normal],1,base+K+r[C.impulse],1,0],V+edge*8);}
  expected.push(want);
 }
 const code=`@group(0) @binding(0) var<storage,read> rc_geometry:array<u32>;@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
 ${generateGeometryWorldWGSL()}
 @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=2u){return;}let bank=gid.x*${stride}u;let dt=select(${bits(1/61440)}u,${bits(1/960)}u,gid.x!=0u);for(var row=0u;row<26u;row++){let contact=bank+${T}u+row*32u;rc_state[bank+${S}u+row*3u]=rc_geometry_gather(0u,bank+${K}u,bank+${B}u,row,dt);rc_state[bank+${S}u+row*3u+1u]=rc_geometry_to_contact(0u,bank+${K}u,row,contact);for(var at=0u;at<24u;at++){if((at>=15u&&at<=19u)||at>=22u){rc_state[contact+at]=0x3f000000u+row*256u+at;}}rc_state[bank+${S}u+row*3u+2u]=rc_geometry_from_contact(0u,bank+${K}u,row,contact);}for(var edge=0u;edge<4u;edge++){rc_state[bank+${S+80}u+edge]=rc_geometry_publish_edge(0u,26u,bank+${K}u,bank+${Q}u,edge,bank+${F}u,bank+${V}u);}rc_state[bank+${S+84}u]=rc_geometry_find(0u,26u,0u,99u,16u,0u);}`;
 for(const e of expected)e[S+84]=0xffffffff;
 const owner=await createNativeOwner('resident geometry address bridge');try{const[,actual]=await dispatchWords(owner,{code,buffers:[{input:p.catalog},{input:initial,readback:true}],workgroups:2});for(let lane=0;lane<2;lane++){const row=actual.subarray(lane*stride,(lane+1)*stride);for(let i=0;i<stride;i++)assert.equal(row[i],expected[lane][i],`lane${lane} word${i}`);}t.diagnostic(JSON.stringify({lanes:2,cacheOwners:26,exactAddressAndOwnership:true,physicalStep:false}));}finally{owner.release();}
});
