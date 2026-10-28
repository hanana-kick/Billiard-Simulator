import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {admitThreeBallHost,createThreeBallCreatedOwnerSeed} from '../src/resident-candidate/three-ball-host-admission.mjs';
import {packThreeBallCreatedOwnerTemplate} from '../src/resident-candidate/three-ball-created-owner.mjs';
import {createThreeBallInitialCuePrefixPlan,executeThreeBallInitialCuePrefixForTest} from '../src/resident-candidate/three-ball-initial-cue-prefix.mjs';
import {executeThreeBallCreatedInitializationForTest} from '../src/resident-candidate/three-ball-created-initialization.mjs';
import {createThreeBallInitialFloorPlan,assertThreeBallInitialFloorPlan,executeThreeBallInitialFloorWordsForTest,buildThreeBallInitialFloorSource} from '../src/resident-candidate/three-ball-initial-floor.mjs';
import {packFloorNarrow,generateNarrowphaseWGSL} from '../src/resident-candidate/narrowphase.mjs';
import {SCENE_LAYOUT as S} from '../src/resident-candidate/scene-activation.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from '../src/resident-candidate/contact-journal.mjs';
import Floor from '../src/experimental-world-lifecycle.js';
const root=path.resolve(import.meta.dirname,'..'),copy=structuredClone,fixtures=[];let tmp;
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-initial-floor-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-initialization-source-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
 const data=v8.deserialize(fs.readFileSync(file)),provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 const decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const row of data.rows){const admission=await admitThreeBallHost(decoder,row.raw),seed=await createThreeBallCreatedOwnerSeed(admission),owner=await packThreeBallCreatedOwnerTemplate(seed),plan=createThreeBallInitialFloorPlan(owner),prefix=await executeThreeBallInitialCuePrefixForTest(createThreeBallInitialCuePrefixPlan(owner),{testOnly:true}),registration=executeThreeBallCreatedInitializationForTest(owner.registration,{testOnly:true});
  const at={stateBase:owner.initialWords.length,programBase:37,scratchBase:19},before=new Uint32Array(at.stateBase+plan.stateWords);before.set(prefix.words);before.set(registration.words);before.set(plan.initialWords,at.stateBase);const words=before.slice();await executeThreeBallInitialFloorWordsForTest(plan,words,{...at,testOnly:true});
  // Reference owners execute AFTER candidate completion. They never supply
  // current cache, refresh, entry mask, dt, or a successful admission boolean.
  const expected=[];for(const ball of seed.balls){if(ball.state.sleeping){expected.push({state:copy(ball.state),metadata:{geometryRefreshed:false}});continue;}const token={},stage=Floor.createReferenceSettledContactStage(ball.state);stage.claim(token);try{expected.push(await stage.prepare(copy(ball.state),token));}finally{stage.abort(token);stage.release(token);stage.dispose();}}
  fixtures.push({row,seed,owner,plan,at,before,words,expected});
 }
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});
test('actual three floor source graphs publish every cache word and retained fat bound after all predicates',t=>{
 for(const {row,seed,owner,plan:p,at,words:a,expected}of fixtures){const c=at.stateBase,L=p.layout;assert.equal(a[c+2],1,JSON.stringify({name:row.name,head:Array.from(a.slice(c,c+16)),records:Array.from(a.slice(c+32,c+80)),edges:Array.from(a.slice(owner.segments.journal.offset+J.edgeOffset,owner.segments.journal.offset+J.edgeOffset+24)),body:Array.from(a.slice(S.bodyOffset+a[c+32]*S.bodyStride,S.bodyOffset+(a[c+32]+1)*S.bodyStride)),init:Array.from(a.slice(owner.registration.layout.initialization+32,owner.registration.layout.initialization+36))}));assert.equal(a[c+3],4);assert.equal(a[c+5],1);assert.equal(a[c+6],7);let mask=0;
  expected.forEach((e,i)=>{const want=packFloorNarrow(e.state);if(!seed.balls[i].state.sleeping){want[138]=+e.metadata.geometryRefreshed;want[139]=+e.metadata.oldActive;}if(e.metadata.geometryRefreshed)mask|=1<<i;assert.deepEqual(a.slice(owner.segments.floorCaches.offset+i*144,owner.segments.floorCaches.offset+(i+1)*144),want,'complete native cache and explicit owner sidecars '+i);assert.deepEqual(new Float32Array(a.buffer,(c+L.bounds+i*6)*4,6),Float32Array.from([...e.state.topology.ballMin,...e.state.topology.ballMax]));});assert.equal(a[c+8],mask);assert.equal(p.capability.wholeH,false);assert.equal(p.capability.collisionPhaseAuthority,false);
  t.diagnostic(JSON.stringify({fixture:row.name,sourceIdentity:p.sourceIdentity,refreshMask:mask,currentFloorMask:7,nativeBoundary:false}));
 }
});
test('emission keeps original narrow/fat equations and no source callback or runtime future input',()=>{
 for(const {plan:p,at}of fixtures){const source=buildThreeBallInitialFloorSource(p,at);assert.equal(source.stages.length,5);assert.deepEqual(source.commands,[{stage:0},{stages:[1,2,3],cycles:3},{stage:4}]);assert.match(source.source,/fn rc_narrow_floor/);assert.match(source.source,/fn rc_num_eval/);assert.doesNotMatch(source.stages[0].code,/fn rc_num_eval/);assert.equal(p.template.geometryCatalog.length,18);}
 const text=fs.readFileSync(new URL('../src/resident-candidate/three-ball-initial-floor.mjs',import.meta.url),'utf8');assert.doesNotMatch(text,/createReference|\.prepare\(|preparedFloors|sourceExpected/);
});
test('unsupported current edge/handle/sleep/topology/replay fails before any published cache changes',async()=>{
 const {owner,plan:p,at,before,words}=fixtures[0],d=owner.segments,L=p.layout,c=at.stateBase,cache=d.floorCaches.offset;
 const changes={generation:a=>a[d.journal.offset+J.colliderOffset+1]++,newEdge:a=>a[d.journal.offset+J.header.edges]++,floorInactive:a=>a[cache+131]=0,wrongRole:a=>a[c+L.records]++,narrowFeature:a=>{a[d.bodies.offset+6]=new Uint32Array(Float32Array.of(20).buffer)[0];},replayed:a=>a[c+5]=1};
 for(const [name,change]of Object.entries(changes)){const a=before.slice();change(a);const unchanged=a.slice(cache,cache+432);await executeThreeBallInitialFloorWordsForTest(p,a,{...at,testOnly:true});assert.equal(a[c+2],4,name);assert.deepEqual(a.slice(cache,cache+432),unchanged,name+' no partial cache publication');}
 const replay=words.slice(),prior=replay.slice(cache,cache+432);await executeThreeBallInitialFloorWordsForTest(p,replay,{...at,testOnly:true});assert.equal(replay[c+2],4);assert.deepEqual(replay.slice(cache,cache+432),prior);
 const bad=createThreeBallInitialFloorPlan(owner);bad.initialWords[20]++;assert.throws(()=>assertThreeBallInitialFloorPlan(bad),/mutated/);assert.throws(()=>createThreeBallInitialFloorPlan(copy(owner)));await assert.rejects(executeThreeBallInitialFloorWordsForTest(p,before.slice(),{...at,testOnly:true,expected:{}}));
});

test('source refresh branch witness retains every field; deliberately invalidated cache is a component input, not a reachable trajectory claim',async()=>{
 const {seed,owner,plan:p,at,before}=fixtures.find(f=>f.row.name==='selected-2'),a=before.slice(),cache=owner.segments.floorCaches.offset;
 a[cache+132]=0;a[cache+117]=0;await executeThreeBallInitialFloorWordsForTest(p,a,{...at,testOnly:true});assert.equal(a[at.stateBase+2],1);
 const token={},input=copy(seed.balls[0].state);input.topology.recycleValid=false;const stage=Floor.createReferenceSettledContactStage(input);stage.claim(token);try{const expected=await stage.prepare(copy(input),token),want=packFloorNarrow(expected.state);want[138]=+expected.metadata.geometryRefreshed;want[139]=+expected.metadata.oldActive;want[119]=new Uint32Array(Float32Array.of(Math.fround(expected.state.normalizedPredictionDistance*expected.state.lengthUnit)).buffer)[0];assert.equal(want[138],1);assert.deepEqual(a.slice(cache,cache+144),want);}finally{stage.abort(token);stage.release(token);stage.dispose();}
});

import {createThreeBallFirstScenePlan} from '../src/resident-candidate/three-ball-scene-first-collision.mjs';
import {createThreeBallFirstNumericalPlan,executeThreeBallFirstNumericalForTest,threeBallFirstEnergyTestKernels} from '../src/resident-candidate/three-ball-first-numerical.mjs';
import {createThreeBallFirstRosterPlan,executeThreeBallFirstRosterWordsForTest} from '../src/resident-candidate/three-ball-first-roster.mjs';
import {sceneWorldTestKernels} from '../src/resident-candidate/scene-world.mjs';
import {CONTACT_ROSTER_LAYOUT as R,decodeContactRoster} from '../src/resident-candidate/contact-roster.mjs';
const rosterCases=[];
test('produced floor entry masks and current source energy prepare exact dense roster without HOST hint rows',async()=>{
 for(const f of fixtures.filter(f=>f.row.name!=='selected-1')){const {owner,plan:floor,at,words:prepared}=f,first=createThreeBallFirstScenePlan(owner),numeric=createThreeBallFirstNumericalPlan(first),reference=await executeThreeBallFirstNumericalForTest(numeric,{testOnly:true}),d=numeric.layout,floorBase=numeric.initialWords.length,stateBase=floorBase+floor.stateWords,plan=createThreeBallFirstRosterPlan(numeric,floor),a=new Uint32Array(stateBase+8);
  // Component comparison only: first-scene's produced bank is the phase input.
  // Its HOST floor payload is replaced by this independently emitted owner.
  a.set(reference.beforeEnergy);a.set(prepared.subarray(at.stateBase,at.stateBase+floor.stateWords),floorBase);a.set(prepared.subarray(owner.segments.floorCaches.offset,owner.segments.floorCaches.offset+432),d.caches);a.set(plan.initialWords,stateBase);
  const begin=threeBallFirstEnergyTestKernels(a);assert.equal(begin.rc_scene_three_energy_begin(0,d.journal,d.firstBridge,d.energy),true);const k=sceneWorldTestKernels(a,numeric.programs);assert.equal(k.rc_scene_world_begin_observe(0,d.energy,a[floorBase+floor.layout.header.dt]),true);let count=0;while(k.rc_scene_world_gather(0,d.bodies,d.energy,0)){assert.equal(k.rc_scene_world_evaluate(0,d.energy,0,0),1);assert.equal(k.rc_scene_world_scatter(0,d.bodies,d.energy,0,0),true);assert.ok(++count<=24);}
  const before=a.slice();await executeThreeBallFirstRosterWordsForTest(plan,a,{stateBase,floorBase,testOnly:true});assert.equal(a[stateBase+2],1);assert.equal(a[stateBase+4],1);
  const actual=decodeContactRoster(a.subarray(d.roster,d.roster+R.words),{initialSnapshotSha256:f.seed.initialSnapshotSha256,backend:'cpu-reference'});assert.equal(actual.status,0);assert.deepEqual(actual.snapshot,reference.gathered.roster.snapshot,'all masks, hints, flags, solver colors/body ids, graph buckets, generations and exact awake order');
  rosterCases.push({plan,a,before,stateBase,floorBase,d});
 }
});
test('roster rejects changed edge lifetime, unproduced floor, new cue edge and replay before published roster changes',async()=>{
 assert.equal(rosterCases.length,2);const {plan,before,stateBase:c,floorBase:f,d,a:complete}=rosterCases[0];for(const mutate of[a=>a[f+5]=0,a=>a[d.journal+J.header.edges]++,a=>a[d.journal+J.edgeOffset+3]++,a=>a[d.caches+131]=0]){const a=before.slice();mutate(a);const old=a.slice(d.roster,d.roster+R.words);await executeThreeBallFirstRosterWordsForTest(plan,a,{stateBase:c,floorBase:f,testOnly:true});assert.equal(a[c+2],4);assert.deepEqual(a.slice(d.roster,d.roster+R.words),old);}
 const replay=complete.slice();await executeThreeBallFirstRosterWordsForTest(plan,replay,{stateBase:c,floorBase:f,testOnly:true});assert.equal(replay[c+2],4);
});

import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {packCreatedWorldTemplate} from '../src/resident-candidate/world-state.mjs';
import {generateContactHintWGSL,generateSceneIntegrationWGSL,generateSceneIntegrationEnergyWGSL,generateSceneIntegrationEvaluateWGSL} from '../src/resident-candidate/scene-integration.mjs';
test('additive hint export leaves every original four-ball scene shader byte identical to frozen baseline',async()=>{
 const prior=spawnSync('git',['show','370a086:src/resident-candidate/scene-integration.mjs'],{cwd:root,encoding:'utf8'});assert.equal(prior.status,0,prior.stderr);
 const source=prior.stdout.replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${new URL(p,new URL('../src/resident-candidate/scene-integration.mjs',import.meta.url)).href}'`),baseline=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const {seed}=await originalRegisteredFixture(),template=await packCreatedWorldTemplate(seed,{rule:{firstId:3,secondId:4,method:'none',allowKiss:true,maxOuterSteps:12000}});
 for(const [name,actual]of Object.entries({generateSceneIntegrationWGSL,generateSceneIntegrationEnergyWGSL,generateSceneIntegrationEvaluateWGSL}))assert.equal(actual(template),baseline[name](template),name+' old bytes');assert.ok(generateSceneIntegrationWGSL(template).includes(generateContactHintWGSL()));assert.equal(seed.balls.length,4);
});
