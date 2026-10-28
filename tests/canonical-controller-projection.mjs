import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {encodeCanonicalScene} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {canonicalSamplePoses,prepareCanonicalGameProjection} from '../src/direct-candidate/canonical-controller-projection.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');await R.init();require('../src/math.js');require('../src/physics.js');require('../src/game-rules.js');
const lab=new PhysicsLab(R),source=lab.snapshot();lab.dispose();
const Q=2**24;
function fixture(four=false){const s=structuredClone(source);if(four)s.objects.push({...structuredClone(s.objects[2]),id:4,pos:{x:.5,y:.03075,z:.4}});
 const scene=encodeCanonicalScene(s,{objectIds:s.objects.map(o=>o.id),staticCount:s.statics.length}).scene;
 const game=(four?new FourBallGame([1,2],[3,4]):new ThreeBallGame()).snapshot();return {scene,game};}
function result(delta=0,{scene,game}=fixture(),selectedId=1){return {readSourceContext:()=>structuredClone({game,selectedId,settings:{}}),purpose:'manual',physicsResultComplete:true,identity:{candidateId:12,sceneId:scene.sceneId},assertCurrent(){},readOutcome(){return {scoringEligible:true,packet:Uint32Array.of(12,delta===1?1:2,delta===1?0:1,delta>>>0)}}};}
test('exact presentation retains signed odd Q24 coordinates and full stable IDs',()=>{const {scene}=fixture(),state=new Uint32Array(40);scene.slotToId.forEach((id,i)=>state[i*10]=id);state[1]=Q+1;state[3]=(-Q-3)>>>0;
 const sample={status:'exact-source',interpolation:false,tick:123,slotToId:scene.slotToId,state},r=canonicalSamplePoses(scene,sample);
 assert.equal(r.poses[0].position.x,(Q+1)/Q);assert.equal(r.poses[0].position.z,(-Q-3)/Q);assert.equal(r.interpolation,false);
 state[10]=99;assert.throws(()=>canonicalSamplePoses(scene,sample),{code:'CONTROLLER_SAMPLE_REJECTED'});});
test('bounded, missing, unsupported samples never become invented exact poses',()=>{const {scene}=fixture();for(const status of ['bounded-source-interval','bounded-source-reference','unavailable','unsupported'])assert.deepEqual(canonicalSamplePoses(scene,{status,state:new Uint32Array(40)}),{presented:false,status});});
test('final score projects existing three/four-ball turn semantics without mutating source',()=>{for(const four of [false,true])for(const delta of four?[-1,0,1]:[0,1]){const {scene,game}=fixture(four),before=structuredClone(game);const r=prepareCanonicalGameProjection({scene,game,selectedId:2,result:result(delta,{scene,game},2)});
 assert.equal(r.snapshot.scores[2],delta);assert.equal(r.snapshot.activeCue,delta===1?2:1);assert.equal(r.snapshot.pending,null);assert.deepEqual(game,before);}});
test('incomplete, unavailable, invalid and stale outcomes never score',()=>{const {scene,game}=fixture();for(const mutate of [r=>r.physicsResultComplete=false,r=>r.purpose='forecast',r=>r.readOutcome=()=>({scoringEligible:false,packet:Uint32Array.of(12,3,3,0x80000000)}),r=>r.assertCurrent=()=>{throw Error('stale');},r=>r.readOutcome=()=>({scoringEligible:true,packet:Uint32Array.of(12,2,1,0xffffffff)})]){const r=result();mutate(r);assert.throws(()=>prepareCanonicalGameProjection({scene,game,selectedId:1,result:r}));}});
test('renderer facade contains no simulation/native writeback API and owns pose copies',async()=>{
 const {createCanonicalRenderView}=await import('../src/direct-candidate/canonical-controller-projection.mjs');const {scene}=fixture();let busy=false;
 const {view,present}=createCanonicalRenderView({scene,pose:PhysicsLab.prototype.pose,isBusy:()=>busy});
 for(const key of ['step','strike','restore','snapshot'])assert.equal(view[key],undefined);
 const old=scene.physical.bodies[0].pos.x,copy=view.objects[0].body.translation();copy.x=99;assert.equal(view.objects[0].body.translation().x,old);
 const words=new Uint32Array(40);scene.slotToId.forEach((id,i)=>words[10*i]=id);words[1]=Q+1;
 present({status:'exact-boundary',interpolation:false,tick:100,slotToId:scene.slotToId,state:words});assert.equal(view.objects[0].body.translation().x,(Q+1)/Q);
 assert.equal(scene.physical.bodies[0].pos.x,old);busy=true;assert.equal(view.anyMotion(),true);assert.equal(view.objects[0].body.isSleeping(),false);
 assert.ok(view.pose(view.objects[0],{angle:0,elevation:25,tipX:0,tipY:0}).tip);
});

test('wrong scene, cue, or full game snapshot cannot receive a genuine guarded outcome',()=>{const {scene,game}=fixture(),r=result(1,{scene,game},1);for(const args of [{scene:fixture(true).scene,game:fixture(true).game,selectedId:1},{scene,game,selectedId:2},{scene,game:{...game,scores:{1:8,2:0}},selectedId:1}])assert.throws(()=>prepareCanonicalGameProjection({...args,result:r}),{code:'CONTROLLER_GAME_SOURCE_MISMATCH'});});

test('canonical projection retains every authored static color and material classification',async()=>{
 const {createCanonicalRenderView}=await import('../src/direct-candidate/canonical-controller-projection.mjs');
 const {view}=createCanonicalRenderView({scene:fixture().scene,pose:PhysicsLab.prototype.pose});
 for(const o of view.statics){const original=source.statics.find(s=>s.label===o.label&&JSON.stringify(s.pos)===JSON.stringify(o.body.translation()));assert.ok(original,o.label);assert.equal(o.color,original.color);assert.equal(o.kind,original.kind);assert.equal(o.shape,original.shape);assert.deepEqual(o.body.translation(),original.pos);assert.deepEqual(o.body.rotation(),original.rot);}
 assert.equal(view.statics.find(s=>s.kind==='cloth').color,'#187365');
 assert.ok(new Set(view.statics.filter(s=>s.kind==='wood').map(s=>s.color)).size>1);
});

test('CPU renderer command spy retains authored lighting materials and both shadow passes after projection',async()=>{
 require('../src/renderer.js');
 const {createCanonicalRenderView}=await import('../src/direct-candidate/canonical-controller-projection.mjs');
 const native=new PhysicsLab(R),scene=encodeCanonicalScene(native.snapshot(),{objectIds:native.objects.map(o=>o.id),staticCount:native.statics.length}).scene;
 try{
  const {view}=createCanonicalRenderView({scene,pose:PhysicsLab.prototype.pose});
  const r=Object.create(LabRenderer.prototype),light={sentinel:'unchanged light matrix'},vp={sentinel:'unchanged camera matrix'},passes=[];
  Object.assign(r,{gl:new Proxy({}, {get:()=>()=>{}}),canvas:{width:800,height:600},box:{},sphere:{},depth:{},main:{},light,vp,
   size(){},convexMesh(){return this.box;},cushionMesh(){return this.box;},drawCommands(commands,program,matrix){passes.push({commands,program,matrix});}});
  r.render(native,{});r.render(view,{});
  assert.equal(passes.length,4);assert.equal(passes[0].program,r.depth);assert.equal(passes[2].program,r.depth);assert.equal(passes[0].matrix,light);assert.equal(passes[2].matrix,light);
  assert.equal(passes[1].program,r.main);assert.equal(passes[3].program,r.main);assert.equal(passes[1].matrix,vp);assert.equal(passes[3].matrix,vp);
  const staticCommands=p=>p.commands.slice(0,native.statics.length).map(c=>JSON.stringify({model:Array.from(c.model),scale:c.scale,color:c.color,material:c.material})).sort();
  assert.deepEqual(staticCommands(passes[3]),staticCommands(passes[1]));assert.deepEqual(staticCommands(passes[2]),staticCommands(passes[0]));
 }finally{native.dispose();}
});
