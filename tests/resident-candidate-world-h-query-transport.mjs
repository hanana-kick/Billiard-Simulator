// Host-only source transport/linkage gate. No query numerical execution,
// native qualification, full-rest qualification, or timing claim is implied.
import test from 'node:test';
import assert from 'node:assert/strict';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {DEFAULT_WHOLE_H_RULE} from './resident-candidate-whole-h-fixture.mjs';
import {packCreatedWorldTemplate} from '../src/resident-candidate/world-state.mjs';
import {generateWorldHPlan,worldHCommands,WORLD_H_BOUNDS} from '../src/resident-candidate/world-h.mjs';
import {WORLD_GEOMETRY_LAYOUT} from '../src/resident-candidate/world-geometry.mjs';
import {WORLD_CUE_GEOMETRY_STAGES} from '../src/resident-candidate/world-cue-geometry.mjs';
import {CONVEX_POINT_LAYOUT} from '../src/resident-candidate/convex-point.mjs';
import {EMPTY_CUE_CACHE_LAYOUT} from '../src/resident-candidate/cue-empty-caches.mjs';

const queries=new Set(['ball-geometry-gjk','cue-geometry-contact-gjk','cue-geometry-normal-gjk']);
const queryStages=new Set(['ball-geometry-init','ball-geometry-gjk','ball-geometry-epa','ball-geometry-finish',
 'cue-geometry-contact-init','cue-geometry-contact-gjk','cue-geometry-contact-epa','cue-geometry-contact-finish',
 'cue-geometry-normal-init','cue-geometry-normal-gjk','cue-geometry-normal-finish']);
const walk=steps=>steps.flatMap(s=>[s,...(s.steps?walk(s.steps):[])]);
const queryName=(p,s)=>s.steps?.length===1&&queries.has(p.pipelines[s.steps[0].pipeline]?.name)?p.pipelines[s.steps[0].pipeline].name:null;
const normalize=(p,steps)=>steps.map(s=>queryName(p,s)?{query:queryName(p,s),sourceCalls:256}:s.steps?{repeat:s.repeat,steps:normalize(p,s.steps),devicePc:s.devicePc}:{pipeline:p.pipelines[s.pipeline].name});
const fn=(code,name)=>{const at=code.indexOf('fn '+name+'(');assert.ok(at>=0,name);let end=code.indexOf('{',at)+1,depth=1;for(;depth;end++){assert.ok(end<code.length,name+' closes');if(code[end]==='{')depth++;if(code[end]==='}')depth--;}return code.slice(at,end);};
let cached;const fixture=()=>cached??=(async()=>{const{seed}=await originalRegisteredFixture(),t=await packCreatedWorldTemplate(seed,{rule:DEFAULT_WHOLE_H_RULE});return{t,staged:generateWorldHPlan(t,{count:2})};})();

test('query chunks are opt-in and retain every geometry lifecycle, source cap, and non-query shader',async()=>{
 const{t,staged}=await fixture();assert.deepEqual(staged,generateWorldHPlan(t,{count:2,queryTransport:'staged',queryChunk:8}));
 assert.equal(staged.transport.query,'staged');assert.equal(staged.transport.queryChunk,8);
 assert.equal(WORLD_GEOMETRY_LAYOUT.rows,26);assert.equal(WORLD_GEOMETRY_LAYOUT.gjkDispatches,256);assert.equal(CONVEX_POINT_LAYOUT.gjkIterations,256);assert.equal(EMPTY_CUE_CACHE_LAYOUT.gjkIterations,256);assert.equal(WORLD_H_BOUNDS.ccdPasses,4);
 const stagedPumps=walk(staged.schedule).filter(s=>queryName(staged,s));assert.deepEqual(stagedPumps.map(s=>s.repeat),[256,256,256]);
 const stagedCount=[...worldHCommands(staged)].length;assert.equal(stagedCount,259202);
 for(const queryChunk of[2,4,8]){
  const chunked=generateWorldHPlan(t,{count:2,queryTransport:'chunked',queryChunk});
  assert.deepEqual(chunked.transport,{...staged.transport,query:'chunked',queryChunk});
  assert.deepEqual(normalize(chunked,chunked.schedule),normalize(staged,staged.schedule),'only query dispatch grouping changes, not source phase order or other no-op proofs');
  const pumps=walk(chunked.schedule).filter(s=>queryName(chunked,s));assert.deepEqual(pumps.map(s=>s.repeat),Array(3).fill(256/queryChunk));for(const pump of pumps)assert.equal(pump.repeat*queryChunk,256);
  const rowLoops=walk(chunked.schedule).filter(s=>s.repeat===26||s.repeat===56);assert.equal(rowLoops.length,2);
  assert.deepEqual(rowLoops[0].steps.map(s=>s.pipeline===undefined?queryName(chunked,s):chunked.pipelines[s.pipeline].name),WORLD_GEOMETRY_LAYOUT.stages.map(x=>'ball-geometry-'+x));
  assert.deepEqual(rowLoops[1].steps.map(s=>s.pipeline===undefined?queryName(chunked,s):chunked.pipelines[s.pipeline].name),WORLD_CUE_GEOMETRY_STAGES.map(x=>'cue-geometry-'+x));
  const unchanged=p=>p.pipelines.filter(x=>!queryStages.has(x.name));assert.deepEqual(unchanged(chunked),unchanged(staged),'EPA/cache lifecycle consumers, canonical solver, CCD and complete-h publication stay byte-identical');
  for(const field of['stateWords','scratchWords','fixedTailWords','count'])assert.equal(chunked[field],staged[field]);assert.deepEqual(chunked.bindingTypes,staged.bindingTypes);
  assert.equal(chunked.pipelines.length,staged.pipelines.length);assert.equal(stagedCount-[...worldHCommands(chunked)].length,4*(26+2*56)*(256-256/queryChunk));
  assert.equal(chunked.capability.nativeWholeHQualified,false);assert.equal(chunked.capability.fullRestQualified,false);assert.equal(chunked.capability.defaultBackend,false);
  if(queryChunk===8){assert.deepEqual(pumps.map(s=>s.repeat),[32,32,32]);assert.equal([...worldHCommands(chunked)].length,135554);}
 }
});

test('chunked query wrappers preserve exact original arithmetic and require the whole 256-call cursor before finish',async()=>{
 const{t,staged}=await fixture(),chunked=generateWorldHPlan(t,{count:2,queryTransport:'chunked',queryChunk:8}),code=(p,name)=>p.pipelines.find(x=>x.name===name).code;
 for(const[name,helper,wrapper]of[
  ['ball-geometry-gjk','rc_point_gjk_step','rc_project_convex_stage'],
  ['cue-geometry-contact-gjk','rc_contact_contact_gjk','rc_raw_contact_stage'],
  ['cue-geometry-normal-gjk','rc_empty_query_gjk_step','rc_empty_convex_query_stage']]){
  const original=code(staged,name),compact=code(chunked,name),body=fn(compact,wrapper);
  assert.equal(fn(compact,helper),fn(original,helper),'unchanged original '+helper+' arithmetic and terminal behavior');
  assert.equal([...fn(original,wrapper).matchAll(new RegExp(helper+'\\(\\)','g'))].length,1);
  assert.equal([...body.matchAll(new RegExp(helper+'\\(\\)','g'))].length,8);
  assert.doesNotMatch(body,/\bfor\b|\bwhile\b|\bloop\b/,'no nested query driver loop');
  assert.match(body,/>256u/);assert.match(body,/%8u!=0u/);assert.match(body,/==256u/);
  const pump=walk(chunked.schedule).find(s=>queryName(chunked,s)===name);assert.ok(pump.devicePc?.proof);assert.doesNotMatch(pump.devicePc.skip,/rc_scratch\[/,'source terminal no-op calls still advance the mandatory chunk cursor');
 }
 const pointInit=fn(code(chunked,'ball-geometry-init'),'rc_project_convex_stage'),pointEpa=fn(code(chunked,'ball-geometry-epa'),'rc_project_convex_stage'),pointFinish=fn(code(chunked,'ball-geometry-finish'),'rc_project_convex_stage');
 assert.match(pointInit,/rc_state\[output\+14u\]=0u;rc_state\[output\+15u\]=256u/);assert.match(pointEpa,/rc_state\[output\+14u\]!=256u\|\|rc_state\[output\+15u\]!=256u/);assert.match(pointEpa,/rc_state\[output\+14u\]=0u;rc_state\[output\+15u\]=0u/);assert.match(pointFinish,/rc_state\[output\+14u\]!=0u\|\|rc_state\[output\+15u\]!=0u/);
 const contactEpa=fn(code(chunked,'cue-geometry-contact-epa'),'rc_raw_contact_stage'),contactFinish=fn(code(chunked,'cue-geometry-contact-finish'),'rc_raw_contact_stage');assert.match(contactEpa,/rc_state\[metadata\+14u\]!=256u\|\|rc_state\[metadata\+15u\]!=256u/);assert.match(contactEpa,/rc_state\[metadata\]=0x40400000u;return/);assert.match(contactFinish,/rc_state\[metadata\+14u\]!=0u\|\|rc_state\[metadata\+15u\]!=0u/);
 const normalFinish=fn(code(chunked,'cue-geometry-normal-finish'),'rc_empty_convex_query_stage');assert.match(normalFinish,/rc_scratch\[scratch\+116u\]!=256u\|\|rc_scratch\[scratch\+117u\]!=256u/);assert.match(normalFinish,/rc_state\[cache\+2u\]=4u;return/);assert.match(normalFinish,/rc_scratch\[scratch\+116u\]=0u;rc_scratch\[scratch\+117u\]=0u/);
 assert.ok(CONVEX_POINT_LAYOUT.outputWords>=16);assert.equal(EMPTY_CUE_CACHE_LAYOUT.queryChunkScratchWords,118);assert.ok(t.numericScratchWords>=118);
 assert.equal(code(chunked,'narrow-commit'),code(staged,'narrow-commit'));assert.match(code(chunked,'narrow-commit'),/!rc_world_geometry_complete\(bank\)/);assert.match(code(chunked,'narrow-commit'),/\+2u\]!=56u/);
});

test('query chunk options reject ambiguous or reduced source bounds before plan creation',async()=>{
 const{t}=await fixture();for(const queryTransport of['auto','resident-loop','native',null,0])assert.throws(()=>generateWorldHPlan(t,{count:2,queryTransport}),/Explicit source query transport/);
 for(const queryChunk of[0,1,3,16,32,256,2.5,null,'8'])for(const queryTransport of['staged','chunked'])assert.throws(()=>generateWorldHPlan(t,{count:2,queryTransport,queryChunk}),/Explicit source query transport/);
});
