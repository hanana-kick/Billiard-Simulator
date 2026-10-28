import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {admitThreeBallHost,assertThreeBallHostAdmission,createThreeBallHostObserver,requireThreeBallResidentOwner,packThreeBallInitialHistory,projectThreeBallCreatedRegistration,assertThreeBallCreatedRegistration} from '../src/resident-candidate/three-ball-host-admission.mjs';
import {describeThreeBallResidentRoster,assertThreeBallResidentRoster} from '../src/resident-candidate/three-ball-resident-roster.mjs';
import {packThreeBallCreatedControlLayout,assertThreeBallCreatedControlLayout,decodeThreeBallCreatedControlLayout} from '../src/resident-candidate/three-ball-created-control-layout.mjs';
import {SCENE_LAYOUT as S,decodeSceneActivation} from '../src/resident-candidate/scene-activation.mjs';
import {SCENE_INITIALIZATION_LAYOUT as I} from '../src/resident-candidate/scene-initialization.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
const root=path.resolve(import.meta.dirname,'..'),copy=structuredClone,hash=x=>createHash('sha256').update(x).digest('hex');let tmp,rows,decoder;const receipts=[];
const absent=()=>{for(const k of ['RAPIER','PhysicsLab','LabController'])assert.equal(globalThis[k],undefined,'HOST admission must not load '+k);};
before(async()=>{
 absent();tmp=fs.mkdtempSync(path.join(os.tmpdir(),'resident-true-three-host-'));const file=path.join(tmp,'source.v8'),sourceHash=hash(fs.readFileSync(path.join(root,'src/physics.js')));
 const child=spawnSync(process.execPath,['tests/resident-three-ball-source-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
 assert.equal(hash(fs.readFileSync(path.join(root,'src/physics.js'))),sourceHash);rows=v8.deserialize(fs.readFileSync(file));for(const row of rows)assert.equal(row.evidence.temporaryRoot,os.tmpdir(),'independent original process inherits only the process-local temp root');
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const row of rows)receipts.push(await admitThreeBallHost(decoder,row.raw));absent();
});
after(()=>{absent();if(tmp)fs.rmSync(tmp,{recursive:true});});
test('independent ORIGINAL default and selected-cue2 bytes produce exact 3-ball native allocation/selection receipts',()=>{
 for(const [i,row] of rows.entries()){
  const r=receipts[i],a=row.raw.capture.application;assertThreeBallHostAdmission(r);
  assert.equal(r.counts.balls,3);assert.equal(r.counts.ballCapacity,3);assert.equal(r.counts.unusedBallSlots,0);assert.equal(r.counts.createdColliders,25);assert.equal(r.native.bindings.length,3);
  assert.equal(r.source.createdSnapshotSha256,row.evidence.createdHash);assert.equal(r.source.preStrikeSnapshotSha256,row.evidence.sourceHash);
  assert.equal(r.selection.selectedId,row.selectedId);assert.equal(r.selection.selectedIndex,row.selectedId-1);assert.equal(r.selection.opponentProhibited,false);
  assert.deepEqual(r.selection.targetIds,[1,2,3].filter(id=>id!==row.selectedId));
  assert.deepEqual(r.native.bindings.map(b=>b.body),a.registry.objects.map(b=>b.body));assert.deepEqual(r.native.bindings.map(b=>b.id),[1,2,3]);
  assert.deepEqual(r.gameBefore,row.expected.gameBefore);assert.deepEqual(r.gameCreated,row.expected.gameCreated);
  for(const [name,methods] of [['bodies','createRigidBody'],['colliders','createCollider'],['joints','createImpulseJoint']]){
   const handles=row.raw.capture.strikeCreationJournal.filter(e=>e.method===methods).map(e=>e.result.handle),arena=r.native.arenas[name];
   assert.deepEqual(arena.allocated,handles);assert.deepEqual(handles.map(h=>h.index),arena.freeBefore.slice(0,handles.length));assert.deepEqual(arena.freeAfter,arena.freeBefore.slice(handles.length));
  }
  assert.equal(r.capability.physicsSteps,0);assert.equal(r.capability.gpuWork,false);assert.equal(r.capability.runtimeIntegrated,false);
  assert.throws(()=>requireThreeBallResidentOwner(r),e=>e.code==='three-ball-resident-owner-unavailable');assert.throws(()=>assertThreeBallHostAdmission(copy(r)));
  assert.throws(()=>{r.native.bindings[0].body.index=999;},TypeError);
 }
});
test('history stores all original emits once, while observer equals independent bounded ORIGINAL emission/game snapshots',()=>{
 for(const [i,row] of rows.entries()){
  const r=receipts[i],observer=createThreeBallHostObserver(r);
  assert.ok(row.expected.emissions.length>0,'bounded ORIGINAL fixture must actually emit, not vacuously replay zero events');
  assert.deepEqual(r.history.preStrikeEvents,row.raw.capture.preStrikeApplication.events);assert.deepEqual(r.history.createdEvents,row.expected.eventsCreated);assert.deepEqual(r.rules.routeOptions,row.raw.capture.application.controller.routeOptions);
  assert.deepEqual(observer.snapshot().game,row.expected.gameCreated);assert.equal(observer.snapshot().postCreationEmissionCount,0);
  assert.equal(r.history.created.words[(r.history.created.count-1)*4+3],0,'accepted stroke is a non-key history entry');
  for(const expected of row.expected.emissions){const actual=observer.emit(expected.event);assert.deepEqual(actual.game,expected.game);assert.deepEqual(actual.eventHistory,expected.events);}
  const last=row.expected.outer.at(-1),end=observer.finish({cuePresent:last.cuePresent,balls:last.balls});
  assert.equal(end.status,'pending');assert.equal(end.result,null);assert.deepEqual(end.game,last.game);assert.deepEqual(end.eventHistory,last.events);
 }
});
test('copy-before-await and local branding protect the whole immutable initial contract',async()=>{
 const raw=copy(rows[0].raw),pending=admitThreeBallHost(decoder,raw);raw.snapshot.fill(0);raw.preStrikeSnapshot.fill(0);raw.capture.application.game.pending.targets.reverse();raw.capture.preStrikeApplication.events.length=0;
 assert.deepEqual(await pending,receipts[0]);
});
test('HOST resident roster declares three actual ball slots plus two cue slots, never a fake fourth or resident world',()=>{
 for(const receipt of receipts){
  const r=describeThreeBallResidentRoster(receipt);assertThreeBallResidentRoster(r);
  assert.equal(r.kind,'resident-genuine-three-ball-roster-description-v1');assert.equal(r.capability.residentExecution,false);
  assert.deepEqual(r.dynamicBindings.map(b=>b.canonicalIndex),[0,1,2,3,4]);assert.deepEqual(r.dynamicBindings.map(b=>b.role),['ball','ball','ball','shaft','head']);
  assert.deepEqual(r.otherBallIndices,[0,1,2].filter(i=>i!==receipt.selection.selectedIndex));assert.equal(r.fixedGuide.canonicalIndex,null);
  assert.equal(r.movingColliderBindings.filter(b=>b.canonicalBodyIndex<3).length,6);assert.equal(r.movingColliderBindings.filter(b=>b.canonicalBodyIndex>=3).length,3);
  assert.deepEqual(r.dynamicBindings.slice(0,3).map(b=>b.objectId),receipt.native.bindings.map(b=>b.id));
  assert.equal(r.sourceColliderOrder.length,25);assert.equal(r.sourceBodyOrder.length,22);assert.equal('state'in r,false);assert.equal('segments'in r,false);
  assert.throws(()=>describeThreeBallResidentRoster(copy(receipt)));assert.throws(()=>assertThreeBallResidentRoster(copy(r)));assert.throws(()=>r.dynamicBindings.push({role:'ball'}),TypeError);
 }
});
async function checkCreatedLayout(receipt,raw){
 const before=[hash(raw.snapshot),hash(raw.preStrikeSnapshot)],registration=await projectThreeBallCreatedRegistration(receipt),layout=packThreeBallCreatedControlLayout(registration);
 assertThreeBallCreatedRegistration(registration);assertThreeBallCreatedControlLayout(layout);
 const source=plain((await decoder.decodeSnapshot(raw.snapshot)).state),decoded=decodeThreeBallCreatedControlLayout(layout),scene=decodeSceneActivation(layout.sceneWords,layout.template);
 assert.deepEqual(scene.manager,source.islands);assert.deepEqual(decoded.manager,source.islands);assert.equal(scene.bodies.length,22);assert.equal(scene.bodies.filter(b=>b.type==='Dynamic').length,5);
 const bits=x=>{const d=new DataView(new ArrayBuffer(4));d.setFloat32(0,x,true);return d.getUint32(0,true);};
 for(const [i,b]of scene.bodies.entries()){
  const slot=source.bodies.bodies.items[b.handle.index];assert.equal(slot.generation,b.handle.generation);const n=slot.value;
  assert.deepEqual(b.ids,n.ids);assert.deepEqual(b.activation,n.activation);assert.equal(b.maxExtent,n.mprops.max_extent);assert.equal(b.changes,n.changes);assert.equal(b.type,n.body_type);
  const q=S.bodyOffset+i*S.bodyStride;assert.equal(layout.sceneWords[q+S.body.maxExtent],bits(n.mprops.max_extent));
  if(b.type==='Dynamic'){const x=n.activation,values=[x.normalized_linear_threshold,x.angular_threshold,x.time_until_sleep,x.time_since_can_sleep,+x.sleeping,...x.sleep_prev_pose.translation,...x.sleep_prev_pose.rotation];assert.deepEqual(Array.from(layout.sceneWords.slice(q+S.body.activation,q+S.body.activation+12)),values.map(bits));}
 }
 for(const [i,c]of decoded.colliders.entries()){
  const slot=source.colliders.colliders.items[c.handle.index];assert.equal(slot.generation,c.handle.generation);const {handle,...native}=c;assert.deepEqual(native,slot.value);
  assert.deepEqual(Array.from(layout.initializationWords.slice(I.poseOffset+i*7,I.poseOffset+i*7+7)),[...slot.value.pos.translation,...slot.value.pos.rotation].map(bits));
 }
 for(const b of decoded.bodies){const native=source.bodies.bodies.items[b.handle.index].value,{handle,...rawBody}=b.raw;assert.deepEqual(rawBody,native);}
 assert.deepEqual(decoded.modifiedBodies,source.bodies.modified_bodies[0]);assert.deepEqual(decoded.modifiedColliders,source.colliders.modified_colliders[0]);assert.deepEqual(decoded.jointEventJournal,[]);
 assert.equal(layout.sceneWords[S.header.phase],8);assert.equal(layout.initializationWords[I.header.numericReady],0);assert.ok(layout.initializationWords.slice(I.numericOffset,I.numericOffset+90).every(x=>x===0));
 assert.equal(layout.initializationWords[I.header.colliderCount],25);assert.equal(layout.sceneWords[S.header.bodyCount],22);assert.equal(layout.roster.dynamicBindings.length,5);
 for(const b of layout.bindings.dynamic)assert.deepEqual(scene.bodies[b.sceneSlot].handle,layout.roster.dynamicBindings[b.canonicalIndex].body);
 assert.equal(layout.bindings.dynamic[receipt.selection.selectedIndex].sceneSlot,0,'selected-first scene-role order must not silently become canonical object order');assert.equal(layout.bindings.guide.canonicalIndex,null);
 assert.ok(layout.sceneWords.slice(S.bodyOffset+22*S.bodyStride,S.bodyOffset+32*S.bodyStride).every(x=>x===0),'unused generic scene capacity is not a physical body');
 assert.ok(layout.initializationWords.slice(I.colliderOffset+25*I.colliderStride,I.colliderOffset+27*I.colliderStride).every(x=>x===0),'unused collider capacity has no handle/live entry');
 const graph=source.impulse_joints.joint_graph.graph,slotByBody=new Map(scene.bodies.map((b,i)=>[b.handle.index+':'+b.handle.generation,i])),slot=h=>slotByBody.get(h.index+':'+h.generation);
 for(const [i,n]of graph.nodes.entries())assert.deepEqual(Array.from(layout.initializationWords.slice(I.nodeOffset+i*I.nodeStride,I.nodeOffset+i*I.nodeStride+4)),[slot(n.weight),...n.next,0]);
 for(const [i,e]of graph.edges.entries()){assert.deepEqual(Array.from(layout.initializationWords.slice(I.edgeOffset+i*I.edgeStride,I.edgeOffset+i*I.edgeStride+5)),[i,...e.node,...e.next]);assert.deepEqual(Array.from(layout.sceneWords.slice(S.jointOffset+i*S.jointStride,S.jointOffset+i*S.jointStride+6)),[e.weight.handle.index,e.weight.handle.generation,0xffffffff,0xffffffff,slot(e.weight.body1),slot(e.weight.body2)]);}
 assert.deepEqual(layout.history,receipt.history);assert.equal(layout.sourceIdentity,hash(raw.snapshot));assert.equal(layout.capability.residentExecution,false);assert.equal(layout.capability.numericInitialized,false);assert.equal('segments'in layout,false);assert.equal('state'in layout,false);
 assert.deepEqual([hash(raw.snapshot),hash(raw.preStrikeSnapshot)],before,'projection and layout must not modify native bytes');
 assert.throws(()=>requireThreeBallResidentOwner(receipt),e=>e.code==='three-ball-resident-owner-unavailable');
 return{registration,layout};
}
test('distinct created control bridge exactly preserves original t0 managers, body/collider numeric words and full history',async t=>{
 for(const [i,row]of rows.entries())await checkCreatedLayout(receipts[i],row.raw);
 t.diagnostic(JSON.stringify({processTmpdir:os.tmpdir(),configuredTmpdir:process.env.TMPDIR??null,initialNativeNumericWords:'bit-exact against independent verified native decode',bridgePhysicsSteps:0,numericInitialization:false,gpu:false}));
});
test('created-control local authority, immutable metadata and byte-sealed arrays reject projected/future/mutated inputs',async()=>{
 const initial=await projectThreeBallCreatedRegistration(receipts[0]);assert.throws(()=>packThreeBallCreatedControlLayout(copy(initial)));assert.throws(()=>packThreeBallCreatedControlLayout(rows[0].raw));
 await assert.rejects(projectThreeBallCreatedRegistration({...receipts[0],expected:{}}));
 const layout=packThreeBallCreatedControlLayout(initial);assert.throws(()=>{initial.record.created.bodies.shaft.pos.position.translation[0]+=1;},TypeError);assert.throws(()=>assertThreeBallCreatedControlLayout(copy(layout)));
 for(const field of ['sceneWords','initializationWords']){const x=packThreeBallCreatedControlLayout(initial);x[field][0]^=1;assert.throws(()=>decodeThreeBallCreatedControlLayout(x),/mutated/);}
 assert.throws(()=>Object.defineProperty(layout.sceneWords,'every',{value:()=>true}),TypeError);
 const detached=packThreeBallCreatedControlLayout(initial);structuredClone(detached.sceneWords.buffer,{transfer:[detached.sceneWords.buffer]});assert.throws(()=>assertThreeBallCreatedControlLayout(detached),/detached/);
 const copyOut=decodeThreeBallCreatedControlLayout(layout);copyOut.manager.active_set_epoch++;assert.notEqual(decodeThreeBallCreatedControlLayout(layout).manager.active_set_epoch,copyOut.manager.active_set_epoch);
});
test('four-ball substitution, fake fourth, changed selection/history, extra future fields and unavailable generations fail explicitly',async()=>{
 const changes=[x=>x.capture.application.controller.gameMode='four',x=>x.capture.application.registry.objects.push(copy(x.capture.application.registry.objects[2])),x=>x.capture.application.controller.selectedId=2,
  x=>x.capture.application.game.pending.targets=[3,4],x=>x.capture.application.game.pending.threeCushion=false,x=>x.capture.application.events=x.capture.application.events.filter(e=>e.kind==='contact'),
  x=>x.expected={},x=>x.capture.application.registry.objects[0].body.generation++,x=>x.capture.strikeCreationJournal[0].result.handle.generation++];
 for(const change of changes){const raw=copy(rows[0].raw);change(raw);await assert.rejects(admitThreeBallHost(decoder,raw));}
 let reads=0,calls=0;const raw=copy(rows[0].raw);Object.defineProperty(raw,'snapshot',{get(){reads++;throw Error('executed');},enumerable:true});await assert.rejects(admitThreeBallHost({decodeSnapshot(){calls++;}},raw));assert.equal(reads,0);assert.equal(calls,0);
});
test('distinct 25-collider history maps exact generations, keeps non-key eviction, and rejects stale last-eight keys',()=>{
 const r=receipts[0],colliders=r.native.colliderOrder.map(handle=>({handle})),number=h=>{const d=new DataView(new ArrayBuffer(8));d.setUint32(0,h.index,true);d.setUint32(4,h.generation,true);return d.getFloat64(0,true);};
 const pair=[number(colliders[0].handle),number(colliders[24].handle)].sort().join(':'),events=[{kind:'contact',label:'explicit representation fixture',time:0,key:pair},...Array.from({length:7},(_,i)=>({kind:'contact',label:'non-key compliant fixture',time:i+.5}))];
 const packed=packThreeBallInitialHistory(events,colliders);assert.equal(packed.count,8);assert.equal(packed.head,0);assert.equal(packed.words[0],24);assert.equal(packed.words[3],1);
 const shifted=packThreeBallInitialHistory([...events,{kind:'stroke',label:'stroke fixture',time:8}],colliders);assert.ok(shifted.words.filter((_,i)=>i%4===3).every(x=>x===0));
 assert.throws(()=>packThreeBallInitialHistory([{...events[0],key:[number({...colliders[0].handle,generation:123}),number(colliders[24].handle)].sort().join(':')}],colliders),/generation unavailable/);
 assert.throws(()=>packThreeBallInitialHistory(events,[...colliders,colliders[0],colliders[1]]),/25/);
});
test('optional existing actual after-turn capture keeps recycled generations and full prestrike history without another fullshot',async t=>{
 const prefix=process.env.THREE_BALL_LIVE_CAPTURE_PREFIX;if(!prefix){t.skip('Supply pre-existing original after-turn capture; this test never generates a full shot');return;}
 const raw=v8.deserialize(fs.readFileSync(prefix+'.after-turn.v8')),r=await admitThreeBallHost(decoder,raw);
 assert.equal(r.selection.selectedId,2);assert.equal(r.selection.selectedIndex,1);assert.deepEqual(r.selection.targetIds,[1,3]);
 assert.ok(r.source.clock.steps>0);assert.ok(r.history.preStrikeEvents.length>1);assert.deepEqual(r.history.createdEvents,raw.capture.application.events);
 const roster=describeThreeBallResidentRoster(r);assert.deepEqual(roster.dynamicBindings.slice(3).map(b=>b.body),[{index:21,generation:3},{index:19,generation:3}]);assert.deepEqual(roster.fixedGuide.body,{index:20,generation:3});assert.deepEqual(roster.otherBallIndices,[0,2]);
 const {layout}=await checkCreatedLayout(r,raw);assert.deepEqual(layout.history.preStrikeEvents,raw.capture.preStrikeApplication.events);assert.equal(layout.history.createdEvents.length,8);
 t.diagnostic(JSON.stringify({created:r.source.createdSnapshotSha256,preStrike:r.source.preStrikeSnapshotSha256,bodyAllocations:r.native.arenas.bodies.allocated,colliderAllocations:r.native.arenas.colliders.allocated,preStrikeHistory:r.history.preStrikeEvents.length,createdHistory:r.history.createdEvents.length}));
});
