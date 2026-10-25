'use strict';
// Lightweight source-shaped scene transactions only. No native decoder, oracle,
// GPU device, or complete-world parity claim is involved in this test suite.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Scene=require('../src/experimental-scene-activation');
const Authority=require('../src/experimental-ccd-pass-authority');
const f=Math.fround,copy=x=>structuredClone(x),U=0xffffffff,h=index=>({index,generation:0});
const events=()=>({apiCalls:[],removedBodies:[]});
const parameters=dt=>({dt:f(dt),lengthUnit:1});

function scene({groups=[[1,2]],sleeping=[],timer=0,threshold=1,timeUntilSleep=2,links=[]}={}){
 const members=groups.flat(),awake=members.filter(index=>!sleeping.includes(groups.findIndex(group=>group.includes(index)))),chunks=[];
 if(awake.length)chunks.push({bodies:awake.map(h)});
 for(const id of sleeping)chunks.push({bodies:groups[id].map(h)});
 const bodies=members.map(index=>{
  const island=groups.findIndex(group=>group.includes(index)),chunk=chunks.findIndex(c=>c.bodies.some(x=>x.index===index));
  return{handle:h(index),type:'Dynamic',enabled:true,changes:0,ids:{active_island_id:chunk,active_set_id:chunks[chunk].bodies.findIndex(x=>x.index===index),island_id:island,island_index:groups[island].indexOf(index)},activation:{normalized_linear_threshold:f(threshold),angular_threshold:f(.5),time_until_sleep:f(timeUntilSleep),time_since_can_sleep:f(typeof timer==='object'?timer[index]??0:timer),sleeping:sleeping.includes(island),sleep_prev_pose:{translation:[0,0,0],rotation:[0,0,0,1],padding:0}},maxExtent:f(.03),jointAdjacency:[]};
 });
 const islands=groups.map((members,id)=>({bodies:members.map(h),contact_links:links.filter(link=>members.includes(link.body1.index)).map(copy),joint_links:[],constraint_remove_count:0,split_denied_until:0,sleeping:sleeping.includes(id)}));
 const locations=[];
 islands.forEach((island,id)=>island.contact_links.forEach((link,index)=>{while(locations.length<=link.edge_id)locations.push([U,U]);locations[link.edge_id]=[id,index];}));
 return{kind:'source-scene-activation',phase:'post-world-step-post-application',noOtherPendingChanges:true,roles:{},manager:{active_set_epoch:7,islands:{n:chunks.length,v:chunks},awake_island:awake.length?0:null,free_islands:[],persistent:{islands:{n:islands.length,v:islands},free_islands:[],contact_link_locs:locations,joint_link_locs:[],removal_journal:[],split_island:null,sleep_scan_stamp:10,bootstrapped:true}},bodies,modifiedBodies:[],consumedModifiedBodies:[]};
}
function physical(s){return s.bodies.filter(b=>!b.activation.sleeping).map(b=>({handle:copy(b.handle),translation:[0,0,0],rotation:[0,0,0,1],linear:[0,0,0],angular:[0,0,0],userForce:[1,2,3],userTorque:[4,5,6],gravity:[0,-2,0],invMass:[1,1,1],gravityScale:1}));}
function owned(initial){
 const stage=Scene.createReferenceStage(initial),authority=Authority.createAuthority('cpu-reference'),token={};stage.claim(token);authority.claim(token);
 let outer=null,current=null,remaining=0,steps=4;
 return{stage,authority,token,get outer(){return outer;},get current(){return current;},
  begin(dt=.5){outer=authority.beginOuter({dt:f(dt),minCcdDt:0,maxCcdSubsteps:4},token);current=null;remaining=f(dt);steps=4;return stage.beginOuter(outer,token);},
  parameters(dt){dt=f(dt);if(!current){const firstImpact=dt===remaining?null:f((dt*steps-remaining)/(steps-1));current=authority.selectPass({firstImpact,selection:{dt,remainingTime:f(remaining-dt),remainingSubsteps:firstImpact===null?0:steps-1}},token);}return{...parameters(dt),ccdPass:current};},
  advance(){const pass=Authority.assertPass(current,'cpu-reference',outer),next=stage.advanceInternalPass(current,token);authority.advanceInternalPass(current,token);remaining=pass.remainingTimeAfter;steps=pass.remainingSubstepsAfter;current=null;return next;},
  commit(){stage.assertOuterPrepared(current,token);stage.commitOuter(current,token);authority.commit(current,token);outer=null;current=null;},
  abort(){stage.abort(token);authority.abort(token);outer=null;current=null;},
  close(){stage.abort(token);authority.abort(token);stage.release(token);authority.release(token);stage.dispose();authority.dispose();}
 };
}
const rb=(s,index)=>s.bodies.find(b=>b.handle.index===index);
const awake=s=>s.manager.awake_island===null?[]:s.manager.islands.v[s.manager.awake_island].bodies;

async function runSingle(initial,outer){const owner=owned(initial),{stage,token}=owner;try{if(outer)owner.begin(.125);stage.beginFrame(events(),token);const collision=outer?stage.applyCollisionOperations([],token):initial;const result=await stage.observe(physical(collision),outer?owner.parameters(.125):parameters(.125),[],token);const final=stage.postApplication(awake(result.context),token);stage.assertPrepared(token);if(outer)owner.commit();else stage.commit(token);return{result,final,snapshot:stage.snapshot()};}finally{owner.close();}}

test('opt-in one-pass transaction preserves the existing single-pass result exactly',async()=>{
 const initial=scene(),legacy=await runSingle(initial,false),outer=await runSingle(initial,true);
 assert.deepEqual(outer,legacy);
 assert.deepEqual(outer.result.bodies.map(b=>b.force),[[1,0,3],[1,0,3]]);
 assert.deepEqual(outer.result.bodies.map(b=>b.torque),[[4,5,6],[4,5,6]]);
});

test('three internal passes drain APIs once, use each solve dt, and publish only final application',async()=>{
 const initial=scene({timer:1});rb(initial,1).changes=1;initial.modifiedBodies=[h(1)];
 const owner=owned(initial),{stage,token}=owner;
 try{
  owner.begin();
  const start=stage.beginFrame({apiCalls:[{body:h(1),strongWake:true}],removedBodies:[]},token);
  assert.deepEqual(start.consumedModifiedBodies,[h(1)]);assert.deepEqual(start.modifiedBodies,[]);assert.equal(start.manager.active_set_epoch,8);
  let context=stage.applyCollisionOperations([],token);
  assert.equal(rb(context,1).changes,0);assert.deepEqual(context.consumedModifiedBodies,[]);
  for(const [index,dt]of[.125,.25,.125].entries()){
   const out=await stage.observe(physical(context),owner.parameters(dt),[],token);
   assert.deepEqual(out.effects.processedModifiedBodies,index===0?[h(1)]:[]);
   assert.equal(out.context.manager.active_set_epoch,8);assert.deepEqual(out.context.modifiedBodies,[]);
   assert.deepEqual(stage.snapshot(),initial,'no intermediate state publication');
   context=out.context;
   if(index<2){const next=owner.advance();assert.deepEqual(next,context,'transition does not mutate manager or queue');context=stage.applyCollisionOperations([],token);}
  }
  assert.equal(rb(context,1).activation.time_since_can_sleep,.5,'strong API wake is not replayed');
  assert.equal(rb(context,2).activation.time_since_can_sleep,1.5);
  const final=stage.postApplication([h(2),h(1)],token);
  assert.deepEqual(final.modifiedBodies,[h(2),h(1)]);assert.equal(final.manager.active_set_epoch,8);
  assert.deepEqual(stage.snapshot(),initial);owner.commit();assert.deepEqual(stage.snapshot(),final);
  assert.equal(final.manager.persistent.sleep_scan_stamp,13);
  const next=stage.beginFrame(events(),token);assert.deepEqual(next.consumedModifiedBodies,[h(2),h(1)]);assert.equal(next.manager.active_set_epoch,10);
 }finally{owner.close();}
});

test('collision wake exposes exact awake order before splitting and resets energy only once',async()=>{
 const initial=scene({groups:[[1],[2]],sleeping:[0],timer:{1:2,2:.5}}),owner=owned(initial),{stage,token}=owner;
 try{
  owner.begin(.5);stage.beginFrame(events(),token);
  const collision=stage.applyCollisionOperations([{type:'strong-wake',bodies:[h(1)]}],token);
  assert.deepEqual(awake(collision),[h(2),h(1)]);assert.equal(collision.manager.active_set_epoch,8);
  assert.deepEqual(collision.modifiedBodies,[h(1)]);assert.equal(rb(collision,1).activation.sleeping,false);
  const first=await stage.observe(physical(collision),owner.parameters(.125),[],token);
  assert.deepEqual(first.bodies.map(b=>b.handle),[h(2),h(1)]);assert.equal(rb(first.context,1).activation.time_since_can_sleep,.125);
  const next=owner.advance();assert.deepEqual(next.modifiedBodies,[h(1)]);assert.equal(rb(next,1).changes,1);assert.equal(next.manager.active_set_epoch,8);
  const secondCollision=stage.applyCollisionOperations([],token);
  const second=await stage.observe(physical(secondCollision),owner.parameters(.375),[],token);
  assert.equal(rb(second.context,1).activation.time_since_can_sleep,.5);assert.equal(second.context.manager.active_set_epoch,8);
  assert.deepEqual(second.context.modifiedBodies,[h(1)],'internal pass does not drain contact-wake queue');
  stage.postApplication([],token);owner.commit();assert.deepEqual(stage.snapshot().modifiedBodies,[h(1)]);
 }finally{owner.close();}
});

test('sleep in one pass and contact wake in the next preserves source chunk transitions',async()=>{
 const initial=scene({groups:[[1],[2]],timer:{1:.4375,2:0},timeUntilSleep:.5}),owner=owned(initial),{stage,token}=owner;
 try{
  owner.begin(.1875);stage.beginFrame(events(),token);let context=stage.applyCollisionOperations([],token);
  const first=await stage.observe(physical(context),owner.parameters(.125),[],token);
  assert.deepEqual(first.effects.sleptBodies,[h(1)]);assert.deepEqual(awake(first.context),[h(2)]);assert.equal(first.context.manager.active_set_epoch,8);
  owner.advance();context=stage.applyCollisionOperations([{type:'interaction-strong-wake',body1:h(1),body2:h(2)}],token);
  assert.deepEqual(awake(context),[h(2),h(1)]);assert.equal(context.manager.active_set_epoch,9);
  const second=await stage.observe(physical(context),owner.parameters(.0625),[],token);
  assert.deepEqual(second.effects.sleptBodies,[]);assert.equal(second.effects.requiresSolverGraphInvalidation,false);
  assert.equal(rb(second.context,1).activation.time_since_can_sleep,.0625);assert.equal(rb(second.context,2).activation.time_since_can_sleep,.0625);
  stage.postApplication(awake(second.context),token);owner.commit();Scene.validate(stage.snapshot());
 }finally{owner.close();}
});

test('internal pass does not replay collision removals or carry their journal forward',async()=>{
 const initial=scene({threshold:-1,links:[{edge_id:0,body1:h(1),body2:h(2)}]}),owner=owned(initial),{stage,token}=owner;
 try{
  owner.begin(.5);stage.beginFrame(events(),token);let context=stage.applyCollisionOperations([{type:'unlink',edgeId:0}],token);
  assert.equal(context.manager.persistent.removal_journal.length,1);
  const first=await stage.observe(physical(context),owner.parameters(.125),[],token);
  assert.equal(first.context.manager.persistent.islands.v[0].constraint_remove_count,1);assert.deepEqual(first.context.manager.persistent.removal_journal,[]);
  owner.advance();context=stage.applyCollisionOperations([],token);
  const second=await stage.observe(physical(context),owner.parameters(.25),[],token);
  assert.equal(second.context.manager.persistent.islands.v[0].constraint_remove_count,1);assert.deepEqual(second.context.manager.persistent.contact_link_locs,[[U,U]]);
 }finally{owner.close();}
});

test('outer transitions reject wrong owners, repeats, missing collision stage, and extra operations',async()=>{
 const initial=scene(),unleased=Scene.createReferenceStage(initial),other={};
 assert.throws(()=>unleased.beginOuter({},{}),/leased/);unleased.dispose();
 const owner=owned(initial),{stage,token}=owner;
 try{
  for(const method of['beginOuter','advanceInternalPass','commitOuter'])assert.throws(()=>stage[method]({},other),/leased/);
  assert.throws(()=>stage.workingSnapshot(other),/leased/);
  assert.throws(()=>stage.applyCollisionOperations([],token),/pre-collision/);
  assert.throws(()=>stage.advanceInternalPass({},token),/Observed outer/);
  owner.begin(.25);
  assert.throws(()=>stage.beginOuter(owner.outer,token),/Idle leased/);assert.throws(()=>stage.release(token),/Idle/);
  assert.throws(()=>stage.applyCollisionOperations([],token),/pre-collision/);assert.throws(()=>stage.commit(token),/commitOuter/);
  stage.beginFrame(events(),token);
  assert.throws(()=>stage.beginFrame(events(),token),/unavailable/);
  await assert.rejects(()=>stage.observe(physical(initial),parameters(.125),[],token),/Applied outer/);
  assert.throws(()=>stage.advanceInternalPass({},token),/Observed outer/);
  assert.throws(()=>stage.applyCollisionOperations(null,token),/Ordered/);
  const context=stage.applyCollisionOperations([],token);
  assert.throws(()=>stage.applyCollisionOperations([],token),/pre-collision/);
  await assert.rejects(()=>stage.observe(physical(context),owner.parameters(.125),[{type:'weak-wake',bodies:[]}],token),/before the CCD splitter/);
  const inFlight=stage.observe(physical(context),owner.parameters(.125),[],token);
  assert.throws(()=>stage.advanceInternalPass(owner.current,token),/Observed outer/);assert.throws(()=>stage.abort(token),/busy/);
  await inFlight;
  await assert.rejects(()=>stage.observe(physical(context),owner.parameters(.125),[],token),/Applied outer/);
  assert.throws(()=>stage.postApplication([],token),/Final CCD/);
  assert.throws(()=>stage.commitOuter(owner.current,token),/Complete/);
  owner.advance();
  assert.throws(()=>stage.advanceInternalPass({},token),/Observed outer/);
  stage.applyCollisionOperations([],token);await stage.observe(physical(context),owner.parameters(.125),[],token);
  assert.throws(()=>stage.advanceInternalPass(owner.current,token),/nonfinal/);
  stage.postApplication([],token);
  assert.throws(()=>stage.postApplication([],token),/Observed/);assert.throws(()=>stage.advanceInternalPass(owner.current,token),/Observed outer/);
  assert.throws(()=>stage.commit(token),/commitOuter/);
  owner.commit();assert.throws(()=>stage.commit(token),/Complete/);assert.throws(()=>stage.commitOuter({},token),/Pending outer/);
  owner.begin(.125);owner.abort();
 }finally{owner.close();}
 assert.throws(()=>stage.beginOuter({},token),/Idle leased/);
});

test('aborting at every outer phase restores the exact committed snapshot and permits reuse',async()=>{
 for(const phase of['outer','frame','collision','observed','advanced','complete']){
  const initial=scene(),owner=owned(initial),{stage,token}=owner;
  try{
   owner.begin(phase==='advanced'?.5:.125);
   if(phase!=='outer'){
    stage.beginFrame({apiCalls:[{body:h(1),strongWake:true}],removedBodies:[]},token);
    if(phase!=='frame'){
     const context=stage.applyCollisionOperations([{type:'strong-wake',bodies:[h(2)]}],token);
     if(phase!=='collision'){
      await stage.observe(physical(context),owner.parameters(.125),[],token);
      if(phase==='advanced')owner.advance();
      if(phase==='complete')stage.postApplication([h(1)],token);
     }
    }
   }
   owner.abort();assert.deepEqual(stage.snapshot(),initial,phase);
   owner.begin(.125);stage.beginFrame(events(),token);const context=stage.applyCollisionOperations([],token);
   await stage.observe(physical(context),owner.parameters(.125),[],token);stage.postApplication([],token);owner.commit();
   assert.equal(rb(stage.snapshot(),1).activation.time_since_can_sleep,.125,phase+' retry');
  }finally{owner.close();}
 }
});

test('failed collision batches and failed observation do not leave partial internal mutations',async()=>{
 const initial=scene({groups:[[1],[2]],sleeping:[0],timer:{1:2,2:0}}),owner=owned(initial),{stage,token}=owner;
 try{
  owner.begin(.5);stage.beginFrame(events(),token);
  assert.throws(()=>stage.applyCollisionOperations([{type:'strong-wake',bodies:[h(1)]},{type:'not-source'}],token),/Unsupported/);
  let context=stage.applyCollisionOperations([],token);
  assert.deepEqual(awake(context),[h(2)]);assert.equal(context.manager.active_set_epoch,7);assert.deepEqual(context.modifiedBodies,[]);
  await assert.rejects(()=>stage.observe([],owner.parameters(.125),[],token),/Every source active body/);
  await assert.rejects(()=>stage.observe(physical(context),{...owner.parameters(.125),dt:0},[],token),/solve dt/);
  const first=await stage.observe(physical(context),owner.parameters(.125),[],token);
  assert.equal(rb(first.context,2).activation.time_since_can_sleep,.125);
  owner.advance();context=stage.applyCollisionOperations([{type:'strong-wake',bodies:[h(1)]}],token);
  const invalid=physical(context);invalid[0].invMass=[NaN,1,1];
  await assert.rejects(()=>stage.observe(invalid,owner.parameters(.25),[],token),/finite f32/);
  const second=await stage.observe(physical(context),owner.parameters(.25),[],token);
  assert.equal(rb(second.context,1).activation.time_since_can_sleep,.25,'failed observation retains the pending strong reset');
  assert.equal(rb(second.context,2).activation.time_since_can_sleep,.375);
 }finally{owner.close();}
});

test('all-sleeping empty passes advance without synthetic queue or epoch effects',async()=>{
 const initial=scene({groups:[[1],[2]],sleeping:[0,1],timer:2}),owner=owned(initial),{stage,token}=owner;
 try{
  owner.begin(.25);stage.beginFrame(events(),token);
  for(let i=0;i<2;i++){
   stage.applyCollisionOperations([],token);const out=await stage.observe([],owner.parameters(.125),[],token);
   assert.deepEqual(out.bodies,[]);assert.equal(out.context.manager.active_set_epoch,7);assert.equal(out.context.manager.persistent.sleep_scan_stamp,10);
   if(i===0)owner.advance();
  }
  stage.postApplication([],token);owner.commit();assert.deepEqual(stage.snapshot(),initial);
 }finally{owner.close();}
});

test('returned contexts and snapshots cannot mutate the staged transaction',async()=>{
 const initial=scene(),owner=owned(initial),{stage,token}=owner;
 try{
  const start=owner.begin(.5);start.manager.active_set_epoch=99;
  const frame=stage.beginFrame(events(),token);frame.bodies.length=0;
  const context=stage.applyCollisionOperations([],token);context.manager.islands.v[0].bodies.reverse();
  const first=await stage.observe(physical(initial),owner.parameters(.125),[],token);first.context.bodies.length=0;first.effects.processedModifiedBodies.push(h(9));
  const next=owner.advance();next.manager.active_set_epoch=99;
  const collision=stage.applyCollisionOperations([],token);assert.deepEqual(awake(collision),[h(1),h(2)]);
  const second=await stage.observe(physical(collision),owner.parameters(.375),[],token);assert.equal(second.context.manager.active_set_epoch,7);
  const final=stage.postApplication([],token);final.bodies.length=0;owner.commit();
  const snapshot=stage.snapshot();assert.equal(snapshot.bodies.length,2);snapshot.bodies.length=0;assert.equal(stage.snapshot().bodies.length,2);
 }finally{owner.close();}
});

test('outer authority rejects forged, cloned, expired, wrong-backend, and cross-outer capabilities',async()=>{
 const initial=scene(),owner=owned(initial),{stage,token}=owner;
 const foreign=Authority.createAuthority('cpu-reference'),gpu=Authority.createAuthority('webgpu'),foreignToken={},gpuToken={};foreign.claim(foreignToken);gpu.claim(gpuToken);
 const timing={dt:.5,minCcdDt:0,maxCcdSubsteps:4};
 try{
  assert.throws(()=>stage.beginOuter({kind:'source-ccd-outer-capability'},token),/capability/);
  const gpuOuter=gpu.beginOuter(timing,gpuToken);assert.throws(()=>stage.beginOuter(gpuOuter,token),/matching-backend/);
  const foreignOuter=foreign.beginOuter(timing,foreignToken);
  const foreignPass=foreign.selectPass({firstImpact:null,selection:{dt:.5,remainingTime:0,remainingSubsteps:0}},foreignToken);
  owner.begin();stage.beginFrame(events(),token);const context=stage.applyCollisionOperations([],token),valid=owner.parameters(.125);
  for(const ccdPass of[undefined,{kind:'source-ccd-pass-capability'},copy(valid.ccdPass),foreignPass]){
   await assert.rejects(()=>stage.observe(physical(context),{...valid,ccdPass},[],token),/capability/);
  }
  for(const dt of[.5,f(.125+2**-26),.125+Number.EPSILON])await assert.rejects(()=>stage.observe(physical(context),{...valid,dt},[],token),/solve dt/);
  await stage.observe(physical(context),valid,[],token);
  assert.throws(()=>stage.advanceInternalPass(foreignPass,token),/capability/);
  const firstPass=owner.current;owner.advance();stage.applyCollisionOperations([],token);
  await assert.rejects(()=>stage.observe(physical(context),{...valid,ccdPass:firstPass},[],token),/capability/);
  const finalParameters=owner.parameters(.375);await stage.observe(physical(context),finalParameters,[],token);stage.postApplication([],token);
  assert.throws(()=>stage.commitOuter(foreignPass,token),/capability/);assert.throws(()=>stage.commitOuter(copy(owner.current),token),/capability/);
  assert.deepEqual(stage.snapshot(),initial);owner.commit();
  assert.throws(()=>stage.beginOuter(owner.outer??copy(foreignOuter),token),/capability/);
  foreign.abort(foreignToken);assert.throws(()=>stage.beginOuter(foreignOuter,token),/capability/);
 }finally{owner.close();foreign.abort(foreignToken);gpu.abort(gpuToken);foreign.release(foreignToken);gpu.release(gpuToken);foreign.dispose();gpu.dispose();}
});

test('advancing authority before the scene, or revoking it during observation, cannot publish a partial pass',async()=>{
 for(const revokeDuringObserve of[false,true]){
  const initial=scene(),owner=owned(initial),{stage,authority,token}=owner;
  try{
   owner.begin();stage.beginFrame(events(),token);const context=stage.applyCollisionOperations([],token),params=owner.parameters(.125);
   if(revokeDuringObserve){
    const inFlight=stage.observe(physical(context),params,[],token);authority.abort(token);
    await assert.rejects(()=>inFlight,/capability/);
    assert.equal(stage.workingSnapshot(token).phase,'source-collision-and-connectivity-complete-pre-energy');
   }else{
    await stage.observe(physical(context),params,[],token);authority.advanceInternalPass(owner.current,token);
    assert.throws(()=>stage.advanceInternalPass(owner.current,token),/capability/);
    assert.throws(()=>stage.postApplication([],token),/capability/);
   }
   assert.deepEqual(stage.snapshot(),initial);owner.abort();assert.deepEqual(stage.snapshot(),initial);
  }finally{owner.close();}
 }
});

test('working snapshot is owner-only and rollback restores the most recent committed state',async()=>{
 const initial=scene(),owner=owned(initial),{stage,token}=owner;
 try{
  owner.begin(.125);stage.beginFrame(events(),token);const context=stage.applyCollisionOperations([],token);
  await stage.observe(physical(context),owner.parameters(.125),[],token);stage.postApplication([h(2)],token);owner.commit();
  const committed=stage.snapshot();assert.notDeepEqual(committed,initial);
  owner.begin(.5);stage.beginFrame(events(),token);
  assert.deepEqual(stage.snapshot(),committed);const working=stage.workingSnapshot(token);
  assert.equal(working.manager.active_set_epoch,8);assert.deepEqual(working.consumedModifiedBodies,[h(2)]);
  working.manager.active_set_epoch=99;assert.equal(stage.workingSnapshot(token).manager.active_set_epoch,8);
  owner.abort();assert.deepEqual(stage.snapshot(),committed);assert.deepEqual(stage.workingSnapshot(token),committed);
 }finally{owner.close();}
});

test('prepared initializer consumed flags clear before the first splitter without a new user-change drain',async()=>{
 const initial=scene();initial.phase='source-user-changes-and-connectivity-complete-pre-collision';initial.consumedModifiedBodies=[h(1)];rb(initial,1).changes=1;
 const owner=owned(initial),{stage,token}=owner;
 try{
  owner.begin(.125);stage.beginFrame(events(),token);const context=stage.applyCollisionOperations([],token);
  assert.equal(rb(context,1).changes,0);assert.deepEqual(context.consumedModifiedBodies,[]);assert.equal(context.manager.active_set_epoch,7);
  const out=await stage.observe(physical(context),owner.parameters(.125),[],token);
  assert.deepEqual(out.effects.processedModifiedBodies,[h(1)]);stage.postApplication([],token);owner.commit();
 }finally{owner.close();}
});


test('browser legacy API and later opt-in resolve authority lazily after scene load',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const context=vm.createContext({structuredClone,Float32Array,Uint32Array,LabSleepActivationExperimental:require('../src/experimental-sleep-activation'),LabArithmeticGraphExperimental:require('../src/experimental-arithmetic-graph'),LabStageRuntimeExperimental:require('../src/experimental-stage-runtime')});
 vm.runInContext(fs.readFileSync(require.resolve('../src/experimental-scene-activation'),'utf8'),context);
 const stage=context.LabSceneActivationExperimental.createReferenceStage(scene()),token={};stage.claim(token);
 const authority=Authority.createAuthority('cpu-reference');authority.claim(token);
 try{
  stage.beginFrame(events(),token);await stage.observe(physical(scene()),parameters(.125),[],token);stage.postApplication([],token);stage.commit(token);
  assert.equal(rb(stage.snapshot(),1).activation.time_since_can_sleep,.125);
  context.LabCcdPassAuthorityExperimental=Authority;
  const outer=authority.beginOuter({dt:.125,minCcdDt:0,maxCcdSubsteps:4},token);stage.beginOuter(outer,token);stage.beginFrame(events(),token);
  const current=stage.applyCollisionOperations([],token),pass=authority.selectPass({firstImpact:null,selection:{dt:.125,remainingTime:0,remainingSubsteps:0}},token);
  await stage.observe(physical(current),{...parameters(.125),ccdPass:pass},[],token);stage.postApplication([],token);stage.assertOuterPrepared(pass,token);stage.commitOuter(pass,token);authority.commit(pass,token);
  assert.equal(rb(stage.snapshot(),1).activation.time_since_can_sleep,.25);
 }finally{stage.abort(token);authority.abort(token);stage.release(token);authority.release(token);stage.dispose();authority.dispose();}
});
