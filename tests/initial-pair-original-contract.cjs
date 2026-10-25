'use strict';
// SPDX-License-Identifier: Apache-2.0
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./initial-pair-original-fixture.cjs'),G=require('./cushion-coupled-original-controller.cjs'),F=require('./four-ball-created-fixture.cjs');
test('initial pair fixture proposes separated legal original moves, unchanged default strike, no synthetic pair input',()=>{
 G.validateInput(C.INPUT);assert.deepEqual(F.SETTINGS,{angle:0,elevation:8,tipX:0,tipY:0,speed:2});
 assert.equal(C.GEOMETRY.placementY,C.GEOMETRY.radius+.00005);
 const cue=C.INPUT.placements.find(p=>p.id===1),red=C.INPUT.placements.find(p=>p.id===3),distance=Math.hypot(red.x-cue.x,red.z-cue.z);
 assert.ok(distance>C.GEOMETRY.diameter);assert.ok(distance<C.GEOMETRY.diameter+C.GEOMETRY.predictionDistance);
 assert.equal(C.SCHEMA,'original-controller-initial-pair-four-ball-oracle-v1');
 assert.equal(G.SCHEMA,'original-controller-four-ball-cushion-holdout-v1');
 assert.ok(C.SOURCES.every(p=>!p.includes('experimental')&&!p.includes('import')));
 assert.deepEqual(C.selectedHs({record:{hCount:9},milestones:{one:{h:1},two:{h:4}},sleepTransitions:[{h:9}]}),[1,2,3,4,5,8,9]);
});
test('original graph projection preserves native edge orientation and directional traversal without candidate helpers',()=>{
 const h=index=>({index,generation:0}),pair=(a,b,active)=>({collider1:h(a),collider2:h(b),contacts:{variant:'Rigid',value:{manifolds:[{data:{solver_contacts:active?[{}]:[]}}]}}}),U=0xffffffff;
 const row={colliders:[1,2,3].map(index=>({handle:h(index),parent:{handle:h(index+10)}})),state:{narrow_phase:{contact_graph:{graph:{
  nodes:[{weight:h(1),next:[1,U]},{weight:h(2),next:[U,0]},{weight:h(3),next:[U,1]}],
  edges:[{weight:pair(1,2,true),next:[U,U]},{weight:pair(1,3,false),next:[0,U]}]
 }}}}};
 const view=C.graphView(row);assert.deepEqual(view.edges.map(e=>[e.collider1.index,e.collider2.index,e.body1.index,e.body2.index,e.active]),[[1,2,11,12,true],[1,3,11,13,false]]);
 assert.deepEqual(view.adjacency.map(a=>[a.outgoing,a.incoming]),[[[1,0],[]],[[],[0]],[[],[1]]]);
 row.state.narrow_phase.contact_graph.graph.edges[0].next[0]=1;assert.throws(()=>C.graphView(row));
});
test('read-only graph projection keeps pending original removal edges with exact manifold body handles',()=>{
 const h=index=>({index,generation:0}),U=0xffffffff,contact={collider1:h(5),collider2:h(8),contacts:{variant:'Rigid',value:{manifolds:[{data:{rigid_body1:h(15),rigid_body2:h(18),solver_contacts:[]}}]}}};
 const row={colliders:[{handle:h(8),parent:{handle:h(18)}}],state:{narrow_phase:{contact_graph:{graph:{nodes:[{weight:h(5),next:[0,U]},{weight:h(8),next:[U,0]}],edges:[{weight:contact,next:[U,U]}]}}}}};
 const g=C.graphView(row);assert.equal(g.edges.length,1);assert.deepEqual(g.edges[0].body1,h(15));assert.deepEqual(g.edges[0].body2,h(18));assert.equal(g.edges[0].active,false);
 assert.deepEqual(g.adjacency,[{collider:h(8),outgoing:[],incoming:[0]}]);
 contact.contacts.value.manifolds.push({data:{rigid_body1:h(99),rigid_body2:h(18),solver_contacts:[]}});assert.throws(()=>C.graphView(row),'Never guess conflicting native stale endpoint bodies');
});
test('source-only initial retained dynamic pair preserves exact original cache, coupled impulse, separation, island sleep and actual score',{skip:!process.env.INITIAL_PAIR_ORACLE},()=>{
 const p=C.load(process.env.INITIAL_PAIR_ORACLE),r=p.record,initial=r.boundaries.goalStrikeCreated,cache=initial.contactPairs.find(x=>x.collider1.index===17&&x.collider2.index===21),m=cache.contacts.value.manifolds[0];
 assert.equal(p.manifest.probe,false);assert.equal(p.observerAgreement.independentOriginalRecreations,3);assert.equal(p.observerAgreement.unobservedOriginalAgreement,true);assert.equal(p.observerAgreement.exactContactAndGameObservables,true);
 assert.equal(p.observerAgreement.byteIdenticalBoundaryCount,Object.keys(r.boundaries).length+p.rows.length);
 assert.deepEqual(r.placements.map(x=>[x.id,x.method,x.accepted,x.position.y]),[1,2,3,4].map(id=>[id,'LabController.move',true,.0308]));
 assert.deepEqual(r.placements.map(x=>x.after.translation),C.INPUT.placements.map(x=>[x.x,.0308,x.z].map(Math.fround)));
 assert.equal(r.control.fireAccepted,true);assert.equal(r.control.clearance.clear,true);assert.deepEqual(r.settings,F.SETTINGS);assert.deepEqual(p.setterCalls,[]);
 assert.equal(initial.snapshotSha256,'c33b49296935238b0c20227f8fdbe15e378f584fd703d3e88ccff41cb6e112b6');
 assert.deepEqual(initial.contactPairs.map(x=>[x.collider1.index,x.collider2.index]),[[0,16],[0,20],[0,18],[0,22],[17,21]]);
 assert.equal(cache.event_status,1);assert.equal(cache.contacts.value.solver_color,0);assert.deepEqual(cache.contacts.value.solver_color_bodies,[16,18]);assert.equal(cache.contacts.value.workspace,null);assert.ok(cache.contacts.value.recycle_state);
 assert.equal(m.points.length,1);assert.equal(m.data.solver_contacts.length,1);assert.deepEqual(m.data.solver_body_ids,[0,2]);assert.equal(m.data.graph_pos,0xffffffff);assert.equal(m.data.solver_color,0);
 assert.equal(m.points[0].data.impulse,0);assert.equal(m.points[0].data.warmstart_impulse,0);assert.equal(m.points[0].dist,.00002000853419303894);assert.deepEqual(m.data.solver_contacts[0].contact_id,[0x80000000]);
 const island=initial.state.islands.persistent.islands.v.find(x=>x&&x.bodies.some(b=>b.index===16));assert.deepEqual(island.bodies.map(x=>x.index),[16,18]);assert.equal(island.sleeping,true);assert.ok(island.contact_links.some(x=>x.edge_id===4&&x.body1.index===16&&x.body2.index===18));
 assert.deepEqual(p.sleepTransitions.map(x=>[x.h,x.sleeping.map(x=>x[1])]),[[363,[false,true,false,true]],[2232,[false,true,true,true]],[6275,[true,true,true,true]]]);
 assert.equal(p.milestones.firstPositive.h,372);assert.equal(p.milestones.firstPositive.cuePresent,true);assert.equal(p.milestones.firstClothCoupledPositive.h,372);assert.equal(p.milestones.firstCompliantCueCoupledPositive.h,372);
 assert.equal(p.milestones.firstPositive.contacts.find(C.isTarget).manifolds[0].impulses[0],.05566643923521042);
 assert.equal(p.milestones.cueWithdrawal.h,458);assert.equal(p.milestones.firstInactiveAfterPositive.h,946);assert.equal(p.milestones.firstRemovedAfterPositive.h,1663);
 const tip=p.applicationImpulseJournal.filter(j=>j.sourceMethod==='compliantTipContact');assert.ok(tip.length>0);assert.equal(tip[0].h,363);assert.ok(tip.every(j=>j.id===1&&j.method==='applyImpulseAtPoint'&&j.args[2]===true));
 const rolling=p.applicationImpulseJournal.filter(j=>j.sourceMethod==='angularPatchResistance');assert.ok(rolling.length>0);assert.ok(rolling.every(j=>j.method==='applyTorqueImpulse'&&j.args[1]===false));
 assert.deepEqual(r.strikeCreationJournal.map(x=>x.method),G.CUE_METHODS);assert.ok(r.strikeCreationJournal.every(x=>x.nativeStepsBefore===initial.nativeSteps&&x.nativeStepsAfter===initial.nativeSteps));
 assert.equal(r.settleOuter,484);assert.equal(r.firstRestOuter,5771);assert.equal(r.hCount,6275);assert.deepEqual(r.score,{cueId:1,delta:0,nextCue:2});
 assert.deepEqual(r.boundaries.physicalRest.snapshot,r.boundaries.controllerFinished.snapshot);assert.ok(r.boundaries.physicalRest.bodies.filter(x=>x.body_type==='Dynamic').every(x=>x.activation.sleeping));
 assert.equal(r.boundaries.controllerFinished.application.game.pending,null);assert.equal(r.boundaries.controllerFinished.application.controller.selectedId,2);
 assert.deepEqual(Object.values(r.boundaries).filter(x=>x.candidateInput).map(x=>x.boundary),['goalStrikeCreated']);assert.ok(p.rows.every(x=>x.candidateInput===false));assert.deepEqual(p.assertions,p.rows.map(C.projection));
 assert.equal(r.nativeRestoreUsed,false);assert.equal(r.candidateStateUsed,false);
});
