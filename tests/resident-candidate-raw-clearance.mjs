import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import Query from '../src/experimental-cue-obstacle-contact.js';
import Point from '../src/experimental-convex-point.js';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {generateConvexPointWGSL,packSharedConvexHull} from '../src/resident-candidate/convex-point.mjs';
import {rawCastQueryReference,packRawCastQuery,generateRawCastQueryWGSL,RAW_CAST_LAYOUT as L,rawStrikeClearanceGeometryReference,rawContactQueryReference,rawClearanceReference,packRawContactQuery,generateRawContactQueryWGSL} from '../src/resident-candidate/raw-strike.mjs';
import {createNativeOwner,dispatchWordStages} from './resident-candidate-gpu-support.mjs';
const require=createRequire(import.meta.url),H=require('./cue-obstacle-fixtures.cjs'),R=H.R,V=H.V,Q=H.Q,I=H.I;
before(()=>R.init());
function primitive(s){return s.type==='sphere'?new R.Ball(s.radius):H.primitive(s);}
function nativeCast(p){return(p.native1??primitive(p.shape1)).castShape(V(p.position1??[0,0,0]),Q(p.rotation1??I),V([0,0,0]),p.native2??primitive(p.shape2),V(p.position2??[0,0,0]),Q(p.rotation2??I),V(p.velocity),0,1,true);}
function cases(){const out=[];for(const p of H.axisFixtures().filter((_,i)=>i%6===0))for(const velocity of [[.012,0,0],[-.012,0,0],[0,.012,0]])out.push({...p,velocity});
 for(const shape1 of [{type:'sphere',radius:.03075},{type:'cylinder',halfHeight:.615,radius:.011},{type:'box',halfExtents:[.4,.03,.4]}])for(const x of [-.5,-.04,0,.04,.5])for(const velocity of [[.012,0,0],[-.012,0,0],[0,0,0]])out.push({shape1,shape2:{type:'sphere',radius:.006},position1:[0,0,0],position2:[x,.02,0],rotation1:I,rotation2:I,velocity});
 return out;}
function compare(p,result){const native=nativeCast(p);assert.equal(result.status,'complete',p.name??JSON.stringify(p));assert.equal(result.hit,!!native,'exact source hit presence '+(p.name??JSON.stringify(p)));if(native){assert.ok(Number.isFinite(native.time_of_impact));assert.ok(Math.abs(result.timeOfImpact-native.time_of_impact)<=2e-6,'source toi tolerance');}}
test('source swept casts preserve dispatcher, no samples-only substitute',()=>{
 for(const p of cases())compare(p,rawCastQueryReference(Query,p));
 const p={shape1:{type:'sphere',radius:.005},shape2:{type:'sphere',radius:.005},position1:[0,0,0],position2:[-.1,0,0],velocity:[.4,0,0]};const result=rawCastQueryReference(Query,p);compare(p,result);assert.equal(result.hit,true);assert.ok(result.timeOfImpact>0&&result.timeOfImpact<.5);
 assert.deepEqual(L.stages,['init','cast','contact-init','contact-gjk','contact-epa','finish']);
 for(const stage of L.stages){const code=generateRawCastQueryWGSL(Query,stage);assert.doesNotMatch(code,/@compute|@group/);assert.match(code,/rc_raw_cast_stage/);}
});
test('actual original cue prestrike geometry retains continuous native cast hit decisions',()=>{
 const lab=new globalThis.PhysicsLab(R),selected=lab.objects[0],center=H.arr(selected.body.translation());let count=0,hits=0;
 try{for(const settings of [{angle:0,elevation:0,speed:2,tipX:0,tipY:0},{angle:23,elevation:37,speed:2,tipX:.2,tipY:-.1},{angle:180,elevation:7,speed:2,tipX:-.3,tipY:.15},{angle:310,elevation:85,speed:2,tipX:.2,tipY:-.1}]){
  const geometry=rawStrikeClearanceGeometryReference(settings,center);assert.equal(geometry.status,'clearance-geometry-ready');
  for(const other of [...lab.statics,...lab.objects])for(const part of geometry.parts){if(other===selected&&part.kind==='tip')continue;
   const shape1=other.shape==='sphere'?{type:'sphere',radius:other.radius}:other.shape==='box'?{type:'box',halfExtents:H.arr(other.half)}:{type:'convex',points:Array.from({length:other.vertices.length/3},(_,i)=>other.vertices.slice(i*3,i*3+3))};
   const shape2=part.shape==='sphere'?{type:'sphere',radius:part.radius}:{type:'cylinder',radius:part.radius,halfHeight:part.halfHeight},p={name:`${settings.angle}/${settings.elevation}/${other.label}/${part.kind}`,shape1,shape2,position1:H.arr(other.collider.translation()),rotation1:H.quat(other.collider.rotation()),position2:part.center,rotation2:geometry.rotation,velocity:geometry.velocity,native1:H.rawShape(lab.world,other.collider)};
   const result=rawCastQueryReference(Query,p);compare(p,result);hits+=+result.hit;count++;
  }
 }console.log(JSON.stringify({gate:'original-prestrike-continuous-casts-host',queries:count,hits,sourceHitPresenceExact:true,sampledContactQueries:false,fullClearance:false}));}finally{lab.dispose();}
});
test('sampled point-cylinder/box/ball dispatch agrees with original native distances',()=>{
 let queries=0;for(const p of cases().filter(p=>p.shape2.type==='sphere')){
  const result=rawContactQueryReference(Query,Point,{...p,prediction:.1}),native=(p.native1??primitive(p.shape1)).contactShape(V(p.position1??[0,0,0]),Q(p.rotation1??I),p.native2??primitive(p.shape2),V(p.position2??[0,0,0]),Q(p.rotation2??I),.1);
  assert.equal(result.status,'complete');assert.equal(result.contact,!!native);if(native)assert.equal(result.distance,native.distance);queries++;
 }assert.ok(queries>0);
});
test('full original four-ball ordered clearance keeps all samples, continuous sweep and selected-tip-only exemption',async()=>{
 const {decoder}=await originalRegisteredFixture(),D=require('../tools/rapier-snapshot-decoder'),T=require('../src/experimental-cue-convex-topology.js');require('../src/game-rules.js');require('../src/controller.js');
 const lab=new globalThis.PhysicsLab(R),controller={lab,state:{gameMode:'four',routeOptions:{}}};globalThis.LabController.prototype.setupGame.call(controller);assert.equal(lab.objects.length,4);
 try{
  lab.world.propagateModifiedBodyPositionsToColliders();const before=lab.world.takeSnapshot(),decoded=await decoder.decodeWorld(lab.world);assert.deepEqual(lab.world.takeSnapshot(),before);decoded.verification.liveWorldByteUnchanged=true;
  const ordered=[...lab.statics,...lab.objects],obstacles=ordered.map(o=>({shape:o.shape==='sphere'?{type:'sphere',radius:o.radius}:o.shape==='box'?{type:'box',halfExtents:H.arr(o.half)}:(()=>{const hull=T.exportNativeHull(decoded,o.collider.handle,D);return{type:'convex',points:hull.points,nativeTopology:hull};})(),position:H.arr(o.collider.translation()),rotation:H.quat(o.collider.rotation())}));
  const selected=lab.objects[0],center=H.arr(selected.body.translation()),selectedIndex=ordered.indexOf(selected);let complete=0;
  for(const [angle,elevation,tipX,tipY] of [[0,0,0,0],[0,8,0,0],[23,37,.2,-.1],[180,7,-.3,.15],[310,85,.2,-.1]]){
   const settings={angle,elevation,speed:2,tipX,tipY},expected=lab.cueClearance(selected,settings),actual=rawClearanceReference(Query,Point,{settings,center,obstacles,selectedIndex});assert.equal(actual.status,'clearance-complete',JSON.stringify({settings,actual}));assert.equal(actual.clear,expected.clear,'full source clear');assert.equal(actual.swept,expected.swept,'full source swept');assert.ok(Math.abs(actual.distance-expected.distance)<=2e-6,'source clearance distance');assert.equal(actual.contacts,177);assert.equal(actual.casts,59);if(expected.obstacle)assert.equal(ordered[actual.obstacle].label,expected.obstacle);complete++;
  }
  console.log(JSON.stringify({gate:'full-source-four-ball-clearance-host',candidates:complete,contactsPerCandidate:177,castsPerCandidate:59,sourceDiscreteParity:true,nativeGpu:false,nativeAllocation:false}));
 }finally{lab.dispose();}
});
test('actual resident cast stages match untouched native hit presence',async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('assigned serial native GPU slot required');
 const dynamic=process.env.RESIDENT_RAW_DYNAMIC==='1',rows=cases(),stride=64,state=new Uint32Array(rows.length*stride),geometry=new Uint32Array(rows.length*L.hullWords);rows.forEach((p,i)=>{const packed=packRawCastQuery(p);state.set(new Uint32Array(packed.input.buffer),i*stride);geometry.set(new Uint32Array(packed.hulls.buffer),i*L.hullWords);});
 const stages=L.stages.map(stage=>({repeat:dynamic?1:stage==='cast'?100:stage==='contact-gjk'?256:1,code:`@group(0) @binding(0) var<storage,read> rc_geometry:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
${generateRawCastQueryWGSL(Query,stage,{storageLoop:dynamic})}
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=arrayLength(&rc_state)/${stride}u){return;}let s=gid.x*${stride}u;rc_raw_cast_stage(gid.x*${L.scratchWords}u,s,s+32u,gid.x*${L.hullWords}u,s+48u);}`}));
 const owner=await createNativeOwner('resident original continuous cue cast');try{const[,raw]=await dispatchWordStages(owner,{stages,bindingTypes:['read-only-storage','storage','storage'],buffers:[{input:geometry},{input:state,readback:true},{words:L.scratchWords*rows.length}],workgroups:rows.length});const f=new Float32Array(raw.buffer);rows.forEach((p,i)=>{const status=f[i*stride+32],toi=f[i*stride+33];assert.notEqual(status,-1,'no unresolved cast');compare(p,{status:'complete',hit:status===1,timeOfImpact:status===1?toi:null});});t.diagnostic(JSON.stringify({queries:rows.length,dispatches:dynamic?6:360,storageLoop:dynamic,intermediateReadbacks:0,fullClearance:false}));}finally{owner.release();}
});

test('actual resident sampled-contact dispatcher includes original native convex topology',async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('assigned serial native GPU slot required');
 const dynamic=process.env.RESIDENT_RAW_DYNAMIC==='1',{seed}=await originalRegisteredFixture(),lab=new globalThis.PhysicsLab(R),rows=cases().filter(p=>p.shape2.type==='sphere'),nativeShape=handle=>{const buffer=new ArrayBuffer(8),view=new DataView(buffer);view.setUint32(0,handle.index,true);view.setUint32(4,handle.generation,true);return H.rawShape(lab.world,lab.world.getCollider(view.getFloat64(0,true)));};
 for(const c of seed.cushionSeeds[0].cushions){const hull=c.hull,center=[0,1,2].map(j=>Math.fround(hull.points.reduce((s,p)=>s+p[j],0)/hull.points.length));for(const delta of [[0,0,0],[.1,.04,-.13],[1,.2,-1]])rows.push({shape1:{type:'convex',points:hull.points,nativeTopology:hull},shape2:{type:'sphere',radius:.006},position1:[0,0,0],rotation1:I,position2:center.map((v,i)=>Math.fround(v+delta[i])),rotation2:I,native1:nativeShape(c.colliderHandle),prediction:.1});}
 const stride=64,state=new Uint32Array(rows.length*stride),hullStride=200+1156,geometry=new Uint32Array(rows.length*hullStride);rows.forEach((p,i)=>{const packed=packRawContactQuery({...p,prediction:.1});state.set(new Uint32Array(packed.input.buffer),i*stride);geometry.set(new Uint32Array(packed.hulls.buffer),i*hullStride);if(p.shape1.nativeTopology)geometry.set(packSharedConvexHull(p.shape1.nativeTopology),i*hullStride+200);});
 const stages=['init','gjk','epa','finish'].map(stage=>({repeat:stage==='gjk'&&!dynamic?256:1,code:`@group(0) @binding(0) var<storage,read> rc_geometry:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
${generateRawContactQueryWGSL(Query,stage,{pointStageCode:generateConvexPointWGSL(stage==='gjk'&&dynamic?'gjk-loop':stage),storageLoop:dynamic})}
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=arrayLength(&rc_state)/${stride}u){return;}let s=gid.x*${stride}u;rc_raw_contact_stage(gid.x*${L.scratchWords}u,s,s+32u,gid.x*${hullStride}u,s+48u,gid.x*${hullStride}u+200u);}`}));
 const owner=await createNativeOwner('resident original sampled cue clearance');try{const[,raw]=await dispatchWordStages(owner,{stages,bindingTypes:['read-only-storage','storage','storage'],buffers:[{input:geometry},{input:state,readback:true},{words:L.scratchWords*rows.length}],workgroups:rows.length});const f=new Float32Array(raw.buffer);rows.forEach((p,i)=>{const expected=rawContactQueryReference(Query,Point,{...p,prediction:.1}),native=(p.native1??primitive(p.shape1)).contactShape(V(p.position1??[0,0,0]),Q(p.rotation1??I),p.native2??primitive(p.shape2),V(p.position2??[0,0,0]),Q(p.rotation2??I),.1);assert.equal(expected.status,'complete');const status=f[i*stride+32],distance=f[i*stride+33];assert.notEqual(status,-1,'query complete');assert.equal(status===1,!!native,'exact native presence');assert.equal(status===1,expected.contact);if(native){assert.equal(distance,expected.distance,'source f32 distance');assert.ok(Math.abs(distance-native.distance)<=2e-6,'unchanged native query gate');}});t.diagnostic(JSON.stringify({queries:rows.length,dispatches:dynamic?4:259,storageLoop:dynamic,intermediateReadbacks:0,fullClearance:false}));}finally{owner.release();lab.dispose();}
});
