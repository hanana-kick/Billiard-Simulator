// HOST ONLY authentic CPU preparation and assertion plumbing. No GPU execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,renameSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createNativeRestOracle} from './resident-candidate-native-rest-fixture.mjs';
import {prepareNativeStrikeContinuation} from './resident-candidate-strike-continuation-fixture.mjs';
import {assertStrikeInitialRuntime} from './resident-candidate-strike-continuation-handoff.mjs';
import {loadNativeStrikeEvidence,expectedNativeStrikeEmissions,compareNativeStrikeEmissionAudit,projectNativeStrikeCheckpoint,compareNativeStrikeCheckpoint} from './resident-candidate-strike-continuation-bank.mjs';
import {firstWorldMismatch} from './resident-candidate-whole-h-fixture.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
let pending;const fixture=()=>pending??=(async()=>{const directory=mkdtempSync('/tmp/resident-strike-continuation-host-'),m=await prepareNativeStrikeContinuation(directory);return{directory,...m,runtime:deserialize(readFileSync(join(directory,'runtime.v8'))),evidence:deserialize(readFileSync(join(directory,'expectations.v8')))};})();
test('every accepted raw variant authenticates its actual unstepped CREATED snapshot, not the baseline identity',async()=>{
 const controls=[{angle:0,elevation:8,speed:2,tipX:0,tipY:0},{angle:23,elevation:37,speed:1.7,tipX:.2,tipY:-.1},{angle:310,elevation:85,speed:4.5,tipX:.2,tipY:-.1},{angle:180,elevation:37,speed:.5,tipX:-.3,tipY:.15}],identities=[];
 for(const settings of controls){const o=await createNativeRestOracle({settings});try{assert.equal(o.initial.nativeSteps,0);assert.equal(o.initial.outerSteps,0);assert.deepEqual(o.initial.settings,settings);const identity=hash(o.initial.nativeSnapshot);assert.equal(o.sourceIdentity,identity);assert.equal(o.initial.origin.createdSnapshotSha256,identity);identities.push(identity);const next=o.stepOuter({includeNative:false});assert.equal(next.origin.createdSnapshotSha256,identity,'future evidence retains its own initial creation identity');}finally{o.dispose();}}
 assert.equal(new Set(identities).size,4);assert.equal(identities[0],'a93473fceb1da27bb580a2981d3e536057eb30856e49d64405ad2b96f8b51e0f');
});
test('untouched native six-outer trial brackets a real h371 impulse at complete h320 and h384 boundaries',async()=>{
 const{evidence:e,assertionManifest:m}=await fixture(),[before,after]=e.checkpoints.map(x=>x.state);assert.equal(before.nativeSteps,320);assert.equal(before.outerSteps,5);assert.equal(after.nativeSteps,384);assert.equal(after.outerSteps,6);assert.equal(before.cue.contacted,false);assert.equal(after.cue.contacted,true);assert.equal(after.cue.stats.normalImpulse,0.09432352299549525);assert.equal(after.objects.find(x=>x.id===2).body.sleeping,false);assert.equal(after.objects.find(x=>x.id===2).body.linear.x,0.4313703179359436);
 assert.deepEqual(e.outerReceipts.map(x=>x.subdivisions),[64,64,64,64,64,64]);assert.ok(e.outerReceipts.every(x=>x.nativeCalls.length===64));assert.equal(after.scoring.status,'running');assert.equal(after.scoring.accumulator.steps,6);assert.equal(after.fullRest,false);assert.equal(e.rule.horizon,16);assert.equal(m.summary.tip.beforeNativeH,371);assert.equal(m.summary.tip.nativeStepsCompleted,370);assert.equal(m.summary.tip.substepAtEntry,50);assert.equal(e.coverage.futureStatesRuntimeInputs,false);assert.equal(e.coverage.gpuExecution,false);
});
test('post-execution evidence loader requires exact prepared hash and unchanged source',async()=>{const{directory,assertionManifest:m,evidence:e}=await fixture();assert.deepEqual(loadNativeStrikeEvidence({directory,expectationsSha256:m.expectationsSha256}),e);assert.throws(()=>loadNativeStrikeEvidence({directory}),/explicit prepared/);assert.throws(()=>loadNativeStrikeEvidence({directory,expectationsSha256:'0'.repeat(64)}),/exact native strike/);});
test('lean initial-only handoff has no future bank and can inspect with all expectations files hidden',async()=>{
 const{directory,runtime:p,runtimeManifest:m}=await fixture();assertStrikeInitialRuntime(p);assert.equal(hash(readFileSync(join(directory,'runtime.v8'))),m.runtimeSha256);assert.equal(p.physicsExecutorIncluded,false);assert.equal(typeof p.init.resources.worldState,'number');assert.equal(p.identity.rule.maxOuterSteps,15360);assert.equal(p.init.dispatches,68313);assert.deepEqual(p.checkpointSchedule.map(x=>[x.targetH,x.requestH]),[[320,320],[384,64]]);
 for(const mutate of [p=>p.expected={},p=>p.init.resources.worldState=new Uint32Array(4),p=>p.init.resources.futureBank=new Uint32Array(4),p=>p.identity.rule.maxOuterSteps=6,p=>p.checkpointSchedule[1].requestH=1]){const q=structuredClone(p);mutate(q);assert.throws(()=>assertStrikeInitialRuntime(q));}
 const hidden=['expectations.v8','assertion-manifest.json'];for(const name of hidden)renameSync(join(directory,name),join(directory,name+'.hidden'));
 try{const cli=fileURLToPath(new URL('./resident-candidate-strike-continuation-handoff.mjs',import.meta.url)),run=spawnSync(process.execPath,[cli,'inspect',directory],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);const info=JSON.parse(run.stdout);assert.equal(info.expectedFileOpened,false);assert.equal(info.gpuExecuted,false);assert.equal(info.physicsExecutorIncluded,false);assert.ok(info.rssBytes>0);}
 finally{for(const name of hidden)renameSync(join(directory,name+'.hidden'),join(directory,name));}
});
test('native strike projection checks actual original getters and rejects an initial or receipt-only bank',async()=>{
 const{runtime:p,evidence:e}=await fixture(),words=p.init.resources.worldTemplate.slice(0,p.layout.stateWords),args={words,template:p.layout,evidence:e,name:'after-tip'},projection=projectNativeStrikeCheckpoint(args);
 assert.deepEqual(Object.keys(projection.actual),['balls','cue','clock','rules','history','game']);assert.deepEqual(projection.actual.balls[0],projection.expected.balls[0],'untouched original sleeping ball');assert.equal(firstWorldMismatch(projection.actual.balls[1],projection.expected.balls[1]).path,'$.translation[0]');assert.equal(projection.actual.clock.h,0);assert.equal(projection.expected.clock.h,384);assert.equal(projection.expected.cue.normalImpulse.length,2);assert.equal(projection.coverage.wholeOwnerEquality,false);assert.throws(()=>compareNativeStrikeCheckpoint(args),/Whole-h status/);
 const receipts=words.slice();receipts[2]=1;receipts[5]=384;assert.throws(()=>compareNativeStrikeCheckpoint({...args,words:receipts}),/Post application scene phase/,'transport receipt does not create native physical evidence');
 const changed=words.slice();changed[p.layout.segments.bodies.offset+9]^=1;const next=projectNativeStrikeCheckpoint({...args,words:changed});assert.equal(firstWorldMismatch(next.actual.balls[0],next.expected.balls[0]).path,'$.rotation[0]');assert.throws(()=>projectNativeStrikeCheckpoint({...args,evidence:{...e,sourceIdentity:'wrong'}}));
});
test('native first-tip emission audit requires exact source time and before-world discrete receipts',async()=>{
 const{evidence:e}=await fixture();assert.deepEqual(expectedNativeStrikeEmissions(e,'before-tip'),[]);const expected=expectedNativeStrikeEmissions(e,'after-tip');assert.equal(expected.length,1);assert.deepEqual(Object.fromEntries(['keyed','pairId','hCommitted','nativeHCompleted','outerOrdinal','substepAtEntry','substepCompleted','subdivisions','worldPhase'].map(k=>[k,expected[0][k]])),{keyed:0,pairId:0,hCommitted:370,nativeHCompleted:370,outerOrdinal:6,substepAtEntry:50,substepCompleted:50,subdivisions:64,worldPhase:2});
 const rows=expected.map(({time,...r})=>({...r,timeLo:time[0],timeHi:time[1]}));assert.deepEqual(compareNativeStrikeEmissionAudit(rows,e),{events:1,initialPrefixNotReemitted:1});assert.throws(()=>compareNativeStrikeEmissionAudit(undefined,e),/complete final-only/);assert.throws(()=>compareNativeStrikeEmissionAudit([],e));for(const field of ['timeLo','hCommitted','nativeHCompleted','outerOrdinal','substepAtEntry','substepCompleted','subdivisions','worldPhase','keyed','pairId','order']){const altered=structuredClone(rows);altered[0][field]^=1;assert.throws(()=>compareNativeStrikeEmissionAudit(altered,e),/native strike accepted-emission/);}
});
