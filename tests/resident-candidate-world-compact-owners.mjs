import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCompactSourceOwner} from '../src/resident-candidate/world-compact-owners.mjs';
import {generateWorldHPlan} from '../src/resident-candidate/world-h.mjs';
import {packCreatedWorldTemplate} from '../src/resident-candidate/world-state.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {DEFAULT_WHOLE_H_RULE} from './resident-candidate-whole-h-fixture.mjs';
let pending;const fixture=()=>pending??=(async()=>{const f=await originalRegisteredFixture();return packCreatedWorldTemplate(f.seed,{rule:DEFAULT_WHOLE_H_RULE});})();
const ids=(plan,names)=>names.map(name=>{const i=plan.pipelines.findIndex(p=>p.name===name);assert.ok(i>=0,name);return i;});
const occurrences=(s,needle)=>s.split(needle).length-1;

test('compact source owners retain every exact body/guard while sharing identical heavy callsites',async()=>{
 const t=await fixture(),plan=generateWorldHPlan(t,{count:2,cueTransport:'flat',coupledTransport:'micro'});
 const groups=[['cue',['cue-application-begin','cue-application-flat','cue-application-done','cue-joint-begin','cue-joint-flat','cue-joint-done'],'rc_cue_flat_advance('],['coupled',['ball-solver-gather','ball-solver-transport','ball-solver-scatter'],'rc_coupled_transport_advance('],['application',['application-post-begin','application-post-gather','application-post-evaluate','application-post-scatter','application-post-finish','application-outer-gather','application-outer-evaluate','application-outer-scatter','application-outer-finish'],'rc_world_application_evaluate(']];
 for(const [id,[name,names,heavy]]of groups.entries()){
  const selected=ids(plan,names),owner=makeCompactSourceOwner(plan,{id,name,pipelineIds:selected,entry:'rc_owner_'+name});
  assert.deepEqual(owner.pipelineIds,selected.toSorted((a,b)=>a-b));assert.equal(owner.sourceBodies,selected.length);assert.equal(owner.heavy,true);assert.equal(owner.capability.nativeQualified,false);
  for(const index of selected){const p=plan.pipelines[index],body=owner.sourceCallsites.find(r=>r.ids.includes(index));assert.equal(body.body,p.devicePc.body);assert.ok(owner.sourceCode.includes(body.body),'verbatim original source body');assert.ok(owner.sourceCode.includes(p.devicePc.guard),'verbatim original entry guard');}
  assert.equal(owner.sourceCallsites.reduce((n,r)=>n+occurrences(r.body,heavy),0),1,'ONE heavy callsite even when original phases share it');
  assert.doesNotMatch(owner.sourceCode,/@compute/);assert.match(owner.sourceCode,/default:\{return 2u;\}/);assert.ok(owner.sourceCallsites.every(r=>owner.sourceCode.includes(r.entry+'(bank,scratch);return 1u;')),'original early returns finish one source CALL');
 }
});

test('flat application uses one shared source continuation call, not nested complete-program drivers',async()=>{
 const t=await fixture(),plan=generateWorldHPlan(t,{count:2,applicationTransport:'flat'}),selected=ids(plan,['application-post-begin','application-post-flat-begin','application-post-flat','application-post-finish','application-outer-flat-begin','application-outer-flat','application-outer-finish']),o=makeCompactSourceOwner(plan,{id:8,name:'application',pipelineIds:selected});
 assert.equal(o.sourceCallsites.reduce((n,r)=>n+occurrences(r.body,'rc_world_application_flat_advance('),0),1);assert.equal(o.sourceBodies,7);assert.equal(o.uniqueSourceBodies,5);assert.equal(o.capability.sourceCapsUnchanged,true);
});

test('unsafe IDs and conflicting phase adapters fail closed instead of choosing a source variant',async()=>{
 const t=await fixture(),plan=generateWorldHPlan(t,{count:1});
 assert.throws(()=>makeCompactSourceOwner(plan,{id:1,name:'bad',pipelineIds:[0,0]}),/Distinct original/);
 assert.throws(()=>makeCompactSourceOwner(plan,{id:1,name:'bad',pipelineIds:[999]}),/Distinct original/);
 assert.throws(()=>makeCompactSourceOwner(plan,{id:1,name:'query',pipelineIds:ids(plan,['ball-geometry-init','ball-geometry-gjk'])}),/Conflicting reachable WGSL function/);
});
