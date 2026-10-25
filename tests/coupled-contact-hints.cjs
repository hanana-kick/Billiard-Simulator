'use strict';
// Exact source metadata protocol tests, not a simulation/trajectory oracle.
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../src/experimental-coupled-contact-hints');
const U=0xffffffff,pos=(bucket,local=0)=>bucket*2**22+local;
const manifold=(activeContactCount=1,solverFlags=1,graphPos=U)=>({activeContactCount,solverFlags,graphPos});
const prior=(hint=32769,solverColor=127,manifolds=[manifold(1,1,pos(127))])=>({hint,solverColor,manifolds});
const observation=(changes={})=>({entryAwake:[false,true],entryDynamicAwake:[false,true],colliderNeedsNarrowPhaseUpdate:false,visited:true,refreshed:false,...changes});
const metadata=ms=>ms.map(({activeContactCount,solverFlags})=>({activeContactCount,solverFlags}));
const full=(p,changes={})=>H.updateHint(p,observation({refreshed:true,manifolds:metadata(p.manifolds),...changes}));

test('h555 sleeping red cloth stays count-cleared through deferred pair wake; h556 entry-awake recycle repairs it',()=>{
 const before=prior(32768,127,[manifold()]),saved=structuredClone(before);
 const h555=H.updateHint(before,observation({entryAwake:[false,false],entryDynamicAwake:[false,false],visited:false}));
 assert.deepEqual(h555,{hint:32768,hintDyn:true,hintCount:0,updated:false,solverGraphDirty:false,outcome:'skipped',outcomeCode:0,manifolds:[{solverFlags:1,activeContactCount:1}]});
 // Scene wake happens later: it must not be fed back into this pair-loop input.
 const h556=H.updateHint({...before,hint:h555.hint},observation());
 assert.equal(h556.hint,32769);assert.equal(h556.outcome,'recycled-requalified');assert.equal(h556.updated,true);assert.equal(h556.solverGraphDirty,true);
 assert.deepEqual(before,saved,'pure metadata transition never edits source state');
});

test('entry asleep dense-scan visit is also skipped, even when activation and awake mask disagree',()=>{
 const p=prior(32768,127,[manifold()]);
 const q=H.updateHint(p,observation({entryAwake:[false,false],entryDynamicAwake:[false,true]}));
 assert.equal(q.hint,32768);assert.equal(q.outcome,'skipped');assert.equal(q.updated,false);
});

test('recycling preserves a nonzero hint count and its old dyn bit without recomputation',()=>{
 const q=H.updateHint(prior(1),observation());assert.equal(q.hint,1);assert.equal(q.outcome,'recycled');assert.equal(q.updated,false);assert.equal(q.solverGraphDirty,false);
 const r=H.updateHint(prior(),observation({entryDynamicAwake:[false,false]}));assert.equal(r.hint,32769);assert.equal(r.updated,false);
});

test('recycled count-zero repair may change dyn bit without becoming graph-dirty',()=>{
 const p=prior(0,255,[manifold(0)]),q=H.updateHint(p,observation());
 assert.equal(q.hint,32768);assert.equal(q.updated,true);assert.equal(q.outcome,'recycled');assert.equal(q.solverGraphDirty,false);
 const r=H.updateHint({...p,hint:32768},observation({entryDynamicAwake:[false,false]}));assert.equal(r.hint,0);assert.equal(r.updated,true);assert.equal(r.solverGraphDirty,false);
});

test('actual inactive sphere/cylinder pair birth has one empty manifold and a dynamic-only hint; retained recycle preserves it',()=>{
 const born=H.updateHint(null,observation({refreshed:true,colliderNeedsNarrowPhaseUpdate:true,manifolds:[{solverFlags:1,activeContactCount:0}]}));
 assert.equal(born.hint,32768);assert.equal(born.hintCount,0);assert.equal(born.manifolds.length,1);assert.equal(born.outcome,'full');assert.equal(born.solverGraphDirty,true);
 const retained=H.updateHint(prior(born.hint,255,[manifold(0)]),observation());
 assert.equal(retained.hint,32768);assert.equal(retained.outcome,'recycled');assert.equal(retained.updated,false);assert.equal(retained.solverGraphDirty,false);
});

test('inactive dynamic pair full refresh, true active birth and end-touch update qualification from actual flags/count',()=>{
 const p=prior(32768,255,[manifold(0)]),inactive=full(p),active=full(p,{manifolds:[{solverFlags:1,activeContactCount:1}]});
 assert.equal(inactive.outcome,'full-clean');assert.equal(inactive.updated,true);assert.equal(inactive.solverGraphDirty,false);
 assert.equal(active.hint,32769);assert.equal(active.outcome,'full');assert.equal(active.solverGraphDirty,true);
 const end=full(prior(),{manifolds:[{solverFlags:1,activeContactCount:0}]});assert.equal(end.hint,32768);assert.equal(end.solverGraphDirty,true);
 const disabled=full(prior(),{manifolds:[{solverFlags:0,activeContactCount:1}]});assert.equal(disabled.hintCount,0);assert.equal(disabled.solverGraphDirty,true);
});

test('full refresh alone recomputes dyn bit from entry dynamic activation, not generic awake membership',()=>{
 const p=prior(32769),q=full(p,{entryDynamicAwake:[false,false]});assert.equal(q.hint,1);assert.equal(q.hintDyn,false);
 const kinematic=H.updateHint(null,observation({entryDynamicAwake:[false,false],refreshed:true,manifolds:[{solverFlags:1,activeContactCount:1}]}));assert.equal(kinematic.hint,1);
 const changedAsleep=full(prior(32768,127,[manifold()]),{entryAwake:[false,false],entryDynamicAwake:[false,false],colliderNeedsNarrowPhaseUpdate:true});assert.equal(changedAsleep.hint,1);assert.equal(changedAsleep.hintDyn,false);
});

test('FULL_CLEAN follows native GraphPos/color membership, not geometry-refreshed alone',()=>{
 const p=prior(),clean=full(p);assert.equal(clean.updated,true);assert.equal(clean.solverGraphDirty,false);assert.equal(clean.outcomeCode,4);
 assert.equal(full(prior(32769,126,[manifold(1,1,pos(127))])).solverGraphDirty,true,'color drift');
 assert.equal(full(prior(32769,127,[manifold()])).solverGraphDirty,true,'selected but no graph slot');
 assert.equal(full(prior(32768,127,[manifold(0,1,pos(127))])).solverGraphDirty,true,'unselected but old graph slot');
 assert.equal(full(prior(32769,255,[manifold(1,1,pos(128))])).solverGraphDirty,false,'native uncolored maps to overflow');
 assert.equal(full(prior(32769,0,[manifold(1,1,pos(129))])).solverGraphDirty,false,'generic graph membership is topology-epoch owned');
});

test('truly absent manifolds are distinct from retained empty manifolds',()=>{
 const absent=prior(32768,255,[]),q=full(absent);assert.deepEqual(q.manifolds,[]);assert.equal(q.outcome,'full-clean');
 const born=H.updateHint(null,observation({refreshed:true,manifolds:[]}));assert.equal(born.hint,32768);assert.deepEqual(born.manifolds,[]);assert.equal(born.solverGraphDirty,true);
});

test('helper fails closed on missing entry evidence, fake recycling, changed retained metadata and unsupported multi-contact geometry',()=>{
 const p=prior();assert.throws(()=>H.updateHint(p,{...observation(),entryAwake:undefined}),/entry awake-mask/);
 assert.throws(()=>H.updateHint(p,observation({postSceneAwake:[true,true]})),/entry-phase/);
 assert.throws(()=>H.updateHint(p,observation({visited:false})),/must be visited/);
 assert.throws(()=>full(p,{entryAwake:[false,false],entryDynamicAwake:[false,false]}),/cannot be geometry-refreshed/);
 assert.throws(()=>H.updateHint(null,observation()),/no recyclable cache/);
 assert.throws(()=>H.updateHint(p,observation({manifolds:[{solverFlags:1,activeContactCount:0}]})),/retained unchanged/);
 assert.throws(()=>full(p,{manifolds:undefined}),/must supply/);
 assert.throws(()=>full(p,{manifolds:[{solverFlags:1,activeContactCount:2}]}),/zero\/one active-contact/);
 assert.throws(()=>full(p,{manifolds:[manifold(),manifold()]}),/zero\/one solver manifold/);
 assert.throws(()=>H.updateHint({...p,hint:65536},observation()),/u16/);
});

// Assertion-only optional source snapshots: no native stepping and no post-state
// values become an input to the recurrence or any production world constructor.
if(process.env.SOLVER_ROSTER_SOURCE_ARTIFACT)test('original native snapshots confirm h555 exclusion and h556 hint repair on the two red cloth pairs',()=>{
 const p=require('node:v8').deserialize(require('node:fs').readFileSync(process.env.SOLVER_ROSTER_SOURCE_ARTIFACT));
 const row=(h,phase)=>p.rows.find(r=>r.hCount===h&&r.boundary.endsWith('-'+phase));
 const pre=row(555,'preWorld'),post=row(555,'postWorld'),later=row(556,'postWorld');
 assert.equal(pre.sourceRevision,H.SOURCE_REVISION);
 assert.deepEqual(pre.state.narrow_phase.pair_solver_hints,[32769,32768,32768,32768,32768,32768]);
 assert.deepEqual(post.state.narrow_phase.pair_solver_hints,[32769,32768,32768,32768,32769,32769]);
 assert.deepEqual(later.state.narrow_phase.pair_solver_hints,[32769,32769,32768,32769,32769,32769]);
 for(const i of[1,3]){const pair=pre.state.narrow_phase.contact_graph.graph.edges[i].weight.contacts.value;
  assert.equal(pair.manifolds.length,1);assert.equal(pair.manifolds[0].data.solver_flags,1);assert.equal(pair.manifolds[0].data.solver_contacts.length,1);assert.equal(pair.manifolds[0].data.graph_pos,U);}
});
