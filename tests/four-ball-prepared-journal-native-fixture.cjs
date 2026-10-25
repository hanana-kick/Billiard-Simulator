'use strict';
// Independent prepared broad/narrow graph oracle only. Native poses and actual
// narrow transitions are component inputs, never a whole-world recurrence seed.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const D=require('../tools/rapier-snapshot-decoder'),copy=x=>structuredClone(x),same=(a,b)=>a.index===b.index&&a.generation===b.generation,f=Math.fround,U=0xffffffff;
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function nativeHandle(h){const a=new DataView(new ArrayBuffer(8));a.setUint32(0,h.index,true);a.setUint32(4,h.generation,true);return a.getFloat64(0,true);}
function exportPrepared(row){
 assert.equal(row.sourceRevision,D.SOURCE_REVISION);assert.equal(row.engineSha256,D.ENGINE_SHA256);assert.equal(hash(row.snapshot),row.snapshotSha256);assert.equal(row.verification.nativeBincodeByteIdentical,true);assert.equal(row.verification.javascriptTypedReencodeByteIdentical,true);
 const registry=row.application.registry;assert.equal(registry.objects.length,4);assert.equal(registry.statics.length,16);assert.equal(row.colliders.length,24);assert.equal(row.bodies.length,20);assert.equal(row.joints.length,0);
 const fixedIds=new Set(registry.statics.map(s=>s.collider.index)),proxy=h=>{const p=row.proxies.find(p=>p.index===h.index);assert.ok(p,'Genuine native prepared proxy required, never synthesized');return{min:copy(p.min),max:copy(p.max)};};
 assert.equal(row.proxies.length,24,'All four source sphere proxy pairs must already exist');
 const colliders=row.colliders.map(c=>{assert.deepEqual(c.parent.pos_wrt_parent.translation,[0,0,0]);assert.deepEqual(c.parent.pos_wrt_parent.rotation,[0,0,0,1]);return{handle:copy(c.handle),body:copy(c.parent.handle),type:fixedIds.has(c.handle.index)?'Fixed':'Dynamic',groups:((c.flags.collision_groups.memberships<<16)|c.flags.collision_groups.filter)>>>0,enabled:c.flags.enabled==='Enabled',sensor:c.coll_type!=='Solid',activeCollisionTypes:c.flags.active_collision_types,contactSkin:c.contact_skin,parentLocalIdentity:true,...(fixedIds.has(c.handle.index)?proxy(c.handle):{})};});
 const bodies=registry.objects.map(o=>{const b=row.bodies.find(b=>same(b.handle,o.body)),primary=row.colliders.find(c=>same(c.handle,o.collider));assert.ok(b&&primary);assert.equal(b.body_type,'Dynamic');assert.equal(primary.shape.variant,'Ball');assert.ok(b.mprops.local_mprops.inv_mass>0,'Genuine source mass preparation required');assert.deepEqual(proxy(o.collider),proxy(o.pairCollider));return{body:copy(o.body),primary:copy(o.collider),pair:copy(o.pairCollider),radius:primary.shape.value.radius,softCcdPrediction:b.ccd.soft_ccd_prediction,...proxy(o.collider)};});
 const graph=row.state.narrow_phase.contact_graph.graph,edges=graph.edges.map(e=>{const p=e.weight,a=colliders.find(c=>same(c.handle,p.collider1)),b=colliders.find(c=>same(c.handle,p.collider2));assert.ok(a&&b);assert.equal(p.contacts.variant,'Rigid');return{collider1:copy(p.collider1),collider2:copy(p.collider2),body1:copy(a.body),body2:copy(b.body),active:p.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)};});
 const adjacency=colliders.map(c=>{const node=graph.nodes.find(n=>same(n.weight,c.handle)),a={collider:copy(c.handle),outgoing:[],incoming:[]};if(node)for(let side=0;side<2;side++){let index=node.next[side];const seen=new Set();while(index!==U){assert.ok(Number.isInteger(index)&&index>=0&&index<edges.length&&!seen.has(index));seen.add(index);assert.ok(same(edges[index]['collider'+(side+1)],c.handle));a[side?'incoming':'outgoing'].push(index);index=graph.edges[index].next[side];}}return a;});
 const ip=row.state.integration_parameters;assert.equal(ip.normalized_prediction_distance,f(.001));assert.equal(ip.length_unit,f(.0615));
 return{kind:'prepared-four-ball-contact-graph',adaptiveChangeDetectionMargin:false,lengthUnit:ip.length_unit,normalizedPredictionDistance:ip.normalized_prediction_distance,colliders,bodies,edges,adjacency};
}
async function capturePreparedTransitions(){
 const fixturePath=process.env.FOUR_BALL_CREATION_FIXTURE??path.join(__dirname,'four-ball-created-fixture.cjs');assert.ok(path.isAbsolute(fixturePath),'Explicit absolute creation fixture path required');
 const Creation=require(fixturePath),artifact=process.env.FOUR_BALL_CREATION_V8;assert.ok(artifact,'FOUR_BALL_CREATION_V8 must select the frozen source creation artifact');
 const{record,manifest}=Creation.loadArtifact(artifact),mode=record.boundaries.modeCreated;
 assert.equal(mode.boundary,'modeCreated');assert.equal(mode.nativeSteps,72);assert.equal(record.additionalApplicationSettlingSteps,0);assert.equal(mode.application.cue,null);assert.equal(mode.summary.bvhLeaves,22);assert.equal(mode.summary.contactPairs,3);assert.equal(mode.summary.colliders,24);
 const registry=copy(mode.application.registry),fourth=registry.objects[3];assert.equal(mode.proxies.some(p=>p.index===fourth.collider.index||p.index===fourth.pairCollider.index),false);assert.throws(()=>exportPrepared(mode),/proxy/,'Original mode entry must never pass as a prepared seed');
 const sourceHashes={creationFixture:hash(fs.readFileSync(fixturePath)),thisFixture:hash(fs.readFileSync(__filename)),journal:hash(fs.readFileSync(require.resolve('../src/experimental-contact-graph-journal')))};
 await Creation.R.init();const world=Creation.R.World.restoreSnapshot(mode.snapshot),queue=new Creation.R.EventQueue(true),frames=[];
 const poses=()=>registry.objects.map(o=>{const p=world.getRigidBody(nativeHandle(o.body)).translation();return{body:copy(o.body),translation:[p.x,p.y,p.z]};});
 let updates=0;const capture=boundary=>Creation.decodeBoundary({boundary,snapshot:world.takeSnapshot(),nativeSteps:72+updates,componentOnly:true,application:{registry:copy(registry)}});
 try{
  // Exactly one independent native preparation step. This is deliberately not
  // the original cue-created first-h path and cannot be used to admit that path.
  world.step(queue);updates++;queue.drainCollisionEvents(()=>{});const prepared=capture('noncue-native-prepared'),seed=exportPrepared(prepared),floor=registry.statics.find(s=>s.kind==='cloth').collider;
  assert.equal(seed.edges.filter(e=>same(e.collider1,floor)||same(e.collider2,floor)).length,4,'Fourth cloth pair was created by actual native update');
  const initial=poses(),r=registry.objects[0].radius,base=Object.fromEntries(initial.map((p,i)=>[i,p.translation]));
  const near=(target,gap)=>[f(base[target][0]+2*r+gap),base[target][1],base[target][2]],commands=[{}, {3:near(0,.002)}, {2:near(1,.002)}, {3:near(0,-.00002)}, {3:base[3]}, {2:base[2]}, {3:near(0,.002)}, {3:base[3]}];
  for(let i=0;i<commands.length;i++){
   for(const[index,p]of Object.entries(commands[i])){const b=world.getRigidBody(nativeHandle(registry.objects[index].body));b.setTranslation({x:p[0],y:p[1],z:p[2]},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);}
   const before=poses();world.step(queue);updates++;const contactEvents=[];queue.drainCollisionEvents((a,b,started)=>contactEvents.push({collider1:Creation.parts(a),collider2:Creation.parts(b),started}));const raw=capture('controlled-component-frame-'+i),graph=exportPrepared(raw);frames.push({before,after:poses(),graph,contactEvents,snapshotSha256:raw.snapshotSha256});
  }
  assert.deepEqual({creationFixture:hash(fs.readFileSync(fixturePath)),thisFixture:hash(fs.readFileSync(__filename)),journal:hash(fs.readFileSync(require.resolve('../src/experimental-contact-graph-journal')))},sourceHashes,'Frozen sources throughout independent native component capture');
  return{seed,frames,evidence:{creationArtifactSha256:manifest.sha256,creationModeSnapshotSha256:mode.snapshotSha256,preparedSnapshotSha256:prepared.snapshotSha256,nativePreparationSteps:1,controlledFrames:frames.length,sourceHashes,scope:'Native component pose inputs and geometry transitions; no original four-ball cue initialization or physics recurrence proof'}};
 }finally{queue.free();world.free();}
}
module.exports={exportPrepared,capturePreparedTransitions};
