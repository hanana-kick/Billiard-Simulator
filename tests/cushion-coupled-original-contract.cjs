'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./cushion-coupled-original-fixture.cjs'),G=require('./cushion-coupled-original-controller.cjs'),F=require('./four-ball-created-fixture.cjs');
const same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
test('cushion hypothesis uses true source move legality and untouched default shot',()=>{
 G.validateInput(C.INPUT);assert.deepEqual(F.SETTINGS,{angle:0,elevation:8,tipX:0,tipY:0,speed:2});
 assert.equal(C.GEOMETRY.placementY,C.GEOMETRY.radius+.00005);assert.equal(C.INPUT.placements[0].z,.68062);
 assert.ok(C.INPUT.placements[0].z>.71-C.GEOMETRY.radius,'Rounded cushion permits more than a guessed rectangular envelope');
 assert.throws(()=>G.validateInput({...C.INPUT,placements:C.INPUT.placements.map(p=>p.id===1?{...p,z:NaN}:p)}));
 assert.equal(C.SCHEMA,'original-controller-cushion-coupled-four-ball-oracle-v1');
});
test('coupled predicate requires shared sphere-pair and cushion contacts with independently positive impulses',()=>{
 const pair={kind:'sphere-pair',ids:[1,3],active:true,positive:true},cushion={kind:'cushion',ids:[1],active:true,positive:true};
 assert.equal(C.shared([pair,cushion],x=>x.positive),true);
 assert.equal(C.shared([pair,{...cushion,ids:[2]}],x=>x.positive),false);
 assert.equal(C.shared([pair,{...cushion,positive:false}],x=>x.positive),false);
 assert.equal(C.shared([pair,{...pair,ids:[1,4]}],x=>x.positive),false);
});
test('original native cushion-plus-pair witness preserves source cache, default strike, full rest and actual score',{skip:!process.env.CUSHION_COUPLED_REPLAY},()=>{
 const p=C.load(process.env.CUSHION_COUPLED_REPLAY),r=p.record,initial=r.boundaries.goalStrikeCreated;
 assert.equal(p.manifest.probe,false);assert.deepEqual(p.observerAgreement,{independentOriginalRecreations:3,unobservedOriginalAgreement:true,byteIdenticalBoundaryCount:29,exactContactAndGameObservables:true});
 assert.deepEqual(r.placements.map(x=>[x.id,x.method,x.accepted,x.position.y]),[1,2,3,4].map(i=>[i,'LabController.move',true,.0308]));
 assert.deepEqual(r.settings,F.SETTINGS);assert.deepEqual(r.control.settings,F.SETTINGS);assert.equal(r.control.fireAccepted,true);assert.equal(r.control.clearance.clear,true);assert.deepEqual(p.setterCalls,[]);
 assert.deepEqual(r.strikeCreationJournal.map(x=>x.method),G.CUE_METHODS);assert.ok(r.strikeCreationJournal.every(x=>x.nativeStepsBefore===initial.nativeSteps&&x.nativeStepsAfter===initial.nativeSteps));
 assert.equal(initial.snapshotSha256,'b4498d6c80d1c4bbae65eb264e1eaa1688ef7b61581a5064cac545cb5ec32a14');
 assert.deepEqual(initial.contactPairs.map(p=>[p.collider1.index,p.collider2.index]),[[0,16],[0,20],[0,18],[0,22],[8,16]]);
 assert.equal(initial.state.narrow_phase.contact_graph.graph.edges.length,5);
 const cache=initial.contactPairs.at(-1),rigid=cache.contacts.value,m=rigid.manifolds[0];
 assert.equal(cache.event_status,1);assert.equal(cache.contacts.variant,'Rigid');assert.equal(rigid.solver_color,126);assert.equal(rigid.workspace,null);assert.ok(rigid.recycle_state);
 assert.equal(m.data.graph_pos,0xffffffff);assert.deepEqual(m.data.solver_body_ids,[0xffffffff,0]);assert.equal(m.points.length,1);assert.equal(m.data.solver_contacts.length,1);assert.equal(m.points[0].data.impulse,0);
 assert.deepEqual(m.data.solver_contacts[0].contact_id,[0x80000000]);assert.equal(m.data.friction,Math.fround(.15));assert.equal(m.data.restitution,Math.fround(.82));
 assert.equal(p.firstRetained.h,546);assert.equal(p.firstActive.h,549);assert.equal(p.firstPositive.h,549);
 assert.deepEqual(p.firstPositive.contacts.map(c=>[c.kind,c.collider1.index,c.collider2.index,c.active,c.positive]),[['sphere-pair',17,21,true,true],['cushion',8,16,true,true]]);
 assert.deepEqual(p.firstPositive.contacts.map(c=>c.manifolds[0].impulses[0]),[.43702271580696106,.034451987594366074]);
 const row=p.rows.find(x=>x.hCount===549&&x.boundary.endsWith('-postWorld'));
 for(const c of p.firstPositive.contacts){const native=row.contactPairs.find(p=>same(p.collider1,c.collider1)&&same(p.collider2,c.collider2));assert.ok(native);assert.equal(native.contacts.value.manifolds[0].points[0].data.impulse,c.manifolds[0].impulses[0]);}
 assert.equal(r.firstRestOuter,6734);assert.equal(r.hCount,7175);assert.deepEqual(r.score,{cueId:1,delta:0,nextCue:2});
 assert.equal(r.boundaries.physicalRest.application.cue,null);assert.equal(r.boundaries.controllerFinished.application.game.pending,null);assert.equal(r.boundaries.controllerFinished.application.controller.selectedId,2);
 assert.ok(r.boundaries.physicalRest.bodies.filter(b=>b.body_type==='Dynamic').every(b=>b.activation.sleeping));
 assert.deepEqual(r.boundaries.physicalRest.snapshot,r.boundaries.controllerFinished.snapshot);
 assert.deepEqual(Object.values(r.boundaries).filter(x=>x.candidateInput).map(x=>x.boundary),['goalStrikeCreated']);
 assert.equal(p.rows.length,18);assert.deepEqual([...new Set(p.rows.map(x=>x.hCount))],[545,546,547,548,549,550]);assert.ok(p.rows.every(x=>x.candidateInput===false));assert.deepEqual(p.assertions,p.rows.map(C.projection));
 assert.equal(r.nativeRestoreUsed,false);assert.equal(r.candidateStateUsed,false);
});
