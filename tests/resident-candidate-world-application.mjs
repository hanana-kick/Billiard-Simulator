import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {packCreatedWorldTemplate} from '../src/resident-candidate/world-state.mjs';
import {WORLD_APPLICATION_LAYOUT as L,WORLD_APPLICATION_DETAIL as D,encodeWorldApplication,generateWorldApplicationWGSL,generateWorldApplicationEvaluateWGSL,worldApplicationTestKernels} from '../src/resident-candidate/world-application.mjs';
import {APPLICATION_LAYOUT as A,generateApplicationWGSL} from '../src/resident-candidate/application.mjs';
import {SCENE_LAYOUT as S,generateSceneActivationWGSL,decodeSceneActivation} from '../src/resident-candidate/scene-activation.mjs';
import {sceneInitializationTestKernels,generateSceneInitializationWGSL} from '../src/resident-candidate/scene-initialization.mjs';
import {SCENE_WORLD_LAYOUT as W,sceneWorldTestKernels,generateSceneWorldWGSL} from '../src/resident-candidate/scene-world.mjs';
import {sceneIntegrationTestKernels,generateSceneIntegrationWGSL} from '../src/resident-candidate/scene-integration.mjs';
import {CONTACT_JOURNAL_LAYOUT as J,generateContactJournalWGSL} from '../src/resident-candidate/contact-journal.mjs';
import {generateContactRosterWGSL} from '../src/resident-candidate/contact-roster.mjs';
import {generateCueCanonicalBridgeWGSL,cueBridgeTestKernels} from '../src/resident-candidate/cue-bridge.mjs';
import {executeCueForTest} from '../src/resident-candidate/cue-orchestration.mjs';
import {executeSourceNumberProgramReference,generateRawStrikeProgramWGSL} from '../src/resident-candidate/raw-strike.mjs';
import {numberWords,wordsNumber,sourceNumberReference as N} from '../src/resident-candidate/source-number.mjs';
import {executeLowered,generateNumericLibraryWGSL} from '../src/resident-candidate/numeric-program.mjs';
import {RULE_LAYOUT as R,RULE_FLAG as F,consumeRuleEvent,appendNonkeyEventHistory,filterNativeEvent,sampleKiss,finishOuter,generatePhysicalRulesWGSL} from '../src/resident-candidate/physical-rules.mjs';
import {STATUS,REASON,UNSET,decodeResults} from '../src/resident-candidate/abi.mjs';
const require=createRequire(import.meta.url);for(const name of ['optimizer-core','game-rules'])require('../src/'+name+'.js');
const Core=globalThis.ShotSearchCore,U=0xffffffff,bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0],float=w=>new Float32Array(Uint32Array.of(w).buffer)[0];
const vec=(...xs)=>Object.assign(xs,{x:xs[0],y:xs[1],z:xs[2],w:xs[3]});
function dialect(code){return code.replace(/struct RcApplicationWork\s*\{[^}]+\}/g,'').replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool|RcF64|RcApplicationWork|vec[24]<u32>))?\s*\{/g,(_,n,args)=>`function ${n}(${args.replace(/:(?:u32|bool|RcF64|RcApplicationWork|vec[24]<u32>)/g,'')}){`).replace(/:(?:u32|bool)(?=\s*=)/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/\bloop\s*\{/g,'while(true){').replace(/vec2<u32>/g,'Vec2').replace(/vec4<u32>/g,'Vec4').replace(/bitcast<f32>/g,'float').replace(/arrayLength\(&rc_state\)/g,'rc_state.length').replace(/\b(\w+)\/32(?!\d)/g,'Math.floor($1/32)');}
function compile(code,words,deps={}){const names=[...code.matchAll(/fn (rc_\w+)\(/g)].map(m=>m[1]);return new Function('rc_state','select','min','max','float',...Object.keys(deps),dialect(code)+'\nreturn {'+names.join(',')+'};')(words,(a,b,p)=>p?b:a,Math.min,Math.max,float,...Object.values(deps));}
let pending;
const fixture=()=>pending??=(async()=>{const f=await originalRegisteredFixture();return{...f,template:await packCreatedWorldTemplate(f.seed,{rule:{firstId:3,secondId:4,method:'none',allowKiss:true,maxOuterSteps:12000}})};})();
function sourceNumberDeps(){const pair=fn=>(...xs)=>vec(...fn(...xs));return{RcF64:vec,Vec2:vec,Vec4:vec,rc_f64_add:pair(N.add),rc_f64_sub:pair(N.sub),rc_f64_div:pair(N.div),rc_f64_eq:N.eq,rc_f64_le:(a,b)=>N.eq(a,b)||N.lt(a,b),rc_f64_zero:a=>wordsNumber(a)===0,rc_f64_to_f32_bits:N.toF32,rc_f64_from_f32_bits:pair(N.fromF32),rc_f64_from_u32:x=>vec(...numberWords(x))};}
function applicationKernels(words,t,deps,scratch){
 const bundle=t.bundles.application,programBase=t.programOffsets.application,programs=new Map(Object.values(bundle.entries).filter(e=>e!==bundle.entries.native).map(e=>[programBase+e.base,e.compiled])),jobs=new Map(),rule=b=>words.subarray(b,b+128);
 const d={...deps,...sourceNumberDeps(),rc_scratch:scratch,RcApplicationWork:(program,registers,control,output,numeric)=>({program,registers,control,output,numeric}),
  rc_source_program_init:(p,r,c)=>{assert.ok(programs.has(p));jobs.set(r,{p,c,input:Array(programs.get(p).words[10]).fill(0)});},
  rc_source_program_input:(p,r,i,v)=>{const j=jobs.get(r);assert.equal(j.p,p);j.input[i]=wordsNumber(v);},
  rc_source_program_step:(p,r,c)=>{const j=jobs.get(r);assert.equal(j.p,p);assert.equal(j.c,c);j.result=executeSourceNumberProgramReference(programs.get(p),j.input);},
  rc_source_program_finish:(p,r,c,out)=>{const j=jobs.get(r);assert.equal(j.p,p);assert.equal(j.c,c);assert.ok(j.result.done);words.set(j.result.raw,out);return 1;},
  rc_num_eval:(p,s)=>{const e=bundle.entries.native;assert.equal(p,programBase+e.base);const out=executeLowered(e.compiled,Float32Array.from(scratch.subarray(s,s+12),float),{testOnly:true});e.compiled.outputSlots.forEach((slot,i)=>scratch[s+slot]=bits(out[i]));return 1;},
  rc_rules_append_nonkey_history:(b,time)=>appendNonkeyEventHistory(rule(b),time),
  rc_rules_event:(b,kind,id,rail,time,sameGroup)=>consumeRuleEvent(rule(b),{kind,id,rail,time,sameGroup}),
  rc_rules_filter_native:(b,pairId,time,flags,recentMask)=>filterNativeEvent(rule(b),{pairId,time,started:!!(flags&1),movingBall:!!(flags&2),clothEarly:!!(flags&4),clothOrFloorSlow:!!(flags&8),recentMask}),
  rc_rules_sample_kiss:(b,objectSlot,impact,separated,time)=>sampleKiss(rule(b),{objectSlot,impact,separated,time}),
  rc_rules_finish_outer:(b,flags)=>finishOuter(rule(b),{finitePosition:!!(flags&1),cuePresent:!!(flags&2),allSleeping:!!(flags&4),opponentImpulse:!!(flags&8),offTable:!!(flags&16),firstKissBeforeGoal:!!(flags&32)})};
 return{...d,...compile(generateApplicationWGSL(bundle),words,d)};
}
async function harness(input){const f=await fixture(),t=f.template,a=input?.slice()??t.state.slice(),off=Object.fromEntries(Object.entries(t.segments).map(([k,v])=>[k,v.offset]));if(!input){a[2]=1;a[4]=73;}
 const dep={...sceneInitializationTestKernels(a),...sceneWorldTestKernels(a,t.bundles.scene),...compile(generateContactRosterWGSL()+generateContactJournalWGSL(),a),...cueBridgeTestKernels(a)};
 const all=generateSceneWorldWGSL({includeNumericLibrary:false}),text=all.slice(all.indexOf('fn rc_scene_world_roster(')),constants=Object.entries({SH:S.header,SB:S.body,SP:S.persistent,SL:S,SW:W.header,SWL:W}).flatMap(([p,g])=>Object.entries(g).filter(([,v])=>Number.isInteger(v)).map(([k,v])=>`const ${p}_${k}:u32=${v}u;`)).join('\n');
 dep.rc_scene_world_roster=compile(constants+text,a,dep).rc_scene_world_roster;const scene=sceneIntegrationTestKernels(a,t,dep);Object.assign(dep,scene);
 const scratch=new Uint32Array(t.numericScratchWords),app=applicationKernels(a,t,dep,scratch),k=worldApplicationTestKernels(a,t,app);return{...f,t,a,off,dep,scene,app,k,scratch};
}
function cuePre(h){const{a,t,off}=h,body=off.bodies+t.selectedIndex*64,r=executeCueForTest(t.bundles.cue,a.slice(off.cue,off.cue+t.segments.cue.words),{ball:a.slice(body,body+64),others:Array.from({length:4},(_,i)=>i).filter(i=>i!==t.selectedIndex).map(i=>a.slice(off.bodies+i*64,off.bodies+(i+1)*64)),testOnly:true});a.set(r.state,off.cue);a.set(r.ball,body);}
function scenePrepare(h){const{a,off,dep,scene}=h;dep.rc_journal_begin(off.journal);a[off.journal+J.header.phase]=2;assert.equal(scene.rc_world_scene_after_broad(0),true);
 // Prepared unchanged original geometry is a declared component input. This
 // suite owns application, not a substitute BVH/narrow or CCD calculation.
 for(let e=0;e<a[off.journal+J.header.edges];e++){const p=off.journal+J.edgeOffset+e*8;a.set([e,a[p+3],a[p+4],a[p+2],1,0],off.geometryFacts+e*6);a[off.geometryRefreshed+e]=0;}
 dep.rc_journal_narrow(off.journal,off.geometryFacts,a[off.journal+J.header.edges]);assert.equal(scene.rc_world_scene_after_narrow(0),true);assert.equal(scene.rc_world_scene_begin_energy(0),true);
 while(scene.rc_world_scene_energy_gather(0,0)){assert.equal(dep.rc_scene_world_evaluate(off.scene,off.sceneWorld,h.t.programOffsets.scene,0),1);assert.equal(scene.rc_world_scene_energy_scatter(0,0),true);}assert.equal(scene.rc_world_scene_prepare_roster(0),true);
 const r=executeCueForTest(h.t.bundles.cue,a.slice(off.cue,off.cue+h.t.segments.cue.words),{mode:1,ball:a.slice(off.bodies,off.bodies+64),testOnly:true});a.set(r.state,off.cue);assert.equal(scene.rc_world_scene_after_solve(0),true);
 a[off.broad+1]=3;a[off.ccd+1184]=15; // Declared completed world component receipt.
}
let prepared;
async function firstPrepared(){prepared??=(async()=>{const h=await harness();assert.equal(h.k.rc_world_application_begin_outer(0),true);assert.equal(h.k.rc_world_application_begin_h(0),true);cuePre(h);assert.equal(h.scene.rc_world_scene_after_cue_pre(0),true);assert.equal(h.k.rc_world_application_after_cue_pre(0),true);scenePrepare(h);return h.a.slice();})();return harness(await prepared);}
function runJobs(h){const{a,off,k}=h;let n=0;while(!a[off.application+A.header.complete]&&a[2]===1){k.rc_world_application_gather(0,0);k.rc_world_application_evaluate(0,0);k.rc_world_application_scatter(0,0);assert.ok(++n<1544);}assert.equal(a[off.application],0);return n;}
function postAndSeal(h){const{a,off,k,dep,scene}=h;assert.equal(k.rc_world_application_capture_events(0),true);assert.equal(k.rc_world_application_begin_post_h(0),true);runJobs(h);assert.equal(k.rc_world_application_finish_post_h(0),true);if(a[off.journal+1]===3)dep.rc_journal_finish(off.journal);a[off.broad+1]=0;assert.equal(scene.rc_world_scene_finish(0),true);assert.equal(k.rc_world_application_finish_h(0),true);}

test('new application bank is exact bounded data and compiler-separated from its numerical evaluator',async()=>{const{template:t}=await fixture();assert.equal(encodeWorldApplication().length,1056);const code=generateWorldApplicationWGSL(t);assert.doesNotMatch(code,/rc_source_program_step\(|rc_num_eval\(|rc_application_stage_evaluate\(/);assert.equal((generateWorldApplicationEvaluateWGSL(t).match(/rc_application_stage_evaluate\(/g)||[]).length,1);assert.match(code,/WA_PROFILE_REASON:u32=12u/);});
test('original first cue/world receipt gets one exact post-h clock and sealed hSequence, not an outer score',async()=>{const h=await firstPrepared(),{a,off,k}=h,old=wordsNumber(a.subarray(off.application+4,off.application+6)),dt=wordsNumber(a.subarray(off.application+8,off.application+10));postAndSeal(h);assert.equal(wordsNumber(a.subarray(off.application+4,off.application+6)),old+dt);assert.equal(a[5],1);assert.equal(a[off.worldApplication+L.header.substep],1);assert.equal(a[off.worldApplication+L.header.subdivisions],64);assert.equal(a[off.rules+R.steps],0);assert.equal(a[2],1);assert.equal(k.rc_world_application_result(0)[2],UNSET);});
test('compliant birth evicts native debounce history at OLD time and cannot replay',async()=>{const h=await harness(),{a,off,k,scene}=h;k.rc_world_application_begin_outer(0);k.rc_world_application_begin_h(0);cuePre(h);scene.rc_world_scene_after_cue_pre(0);
 // Exact numerical receipt boundary is tested independently by cue source
 // arithmetic; here exercise an admitted birth versus a stale frame.
 a[off.cue+43]=1;a[off.cue+9]=1;const old=wordsNumber(a.subarray(off.application+4,off.application+6)),head=a[off.rules+R.ringHead];assert.equal(k.rc_world_application_after_cue_pre(0),true);const row=off.rules+R.ring+head*4;assert.equal(a[row+3],0);assert.equal(wordsNumber(a.subarray(row+1,row+3)),old);assert.equal(k.rc_world_application_after_cue_pre(0),false);assert.equal(a[2],4);});
test('original elapsed >= .02 created-cue guard has its own unsupported reason, no false horizon',async()=>{
 for(const elapsed of [.02-Number.EPSILON,.02,.02001]){const h=await harness(),{a,off,k}=h;a.set(numberWords(elapsed),off.cue+22);k.rc_world_application_begin_outer(0);const ok=k.rc_world_application_begin_h(0);assert.equal(ok,elapsed<.02);if(!ok){assert.equal(a[off.worldApplication+L.header.detail],D.createdCueContinuationProfile);const row=decodeResults(Uint32Array.from(k.rc_world_application_result(0)),[73])[0];assert.equal(row.status,'unsupported');assert.equal(row.pass,null);assert.equal(row.reasonCode,REASON.CUE_CONTINUATION_PROFILE);}}
});
test('CCD event spool keeps source pass order and includes stopped/removal events exactly once',async()=>{const h=await firstPrepared(),{a,off,k}=h,b=off.worldApplication,j=off.journal,rows=[[0,1,1,0],[1,2,0,2],[2,3,1,0],[3,4,0,0]];a[b+L.header.cueAtEntry]=0;a[off.cue+4]=0;a[off.application+24]=0;
 for(let pass=0;pass<4;pass++){a[j+J.header.sequence]=pass+1;a[j+J.header.events]=1;a.set(rows[pass],j+J.eventOffset);assert.equal(k.rc_world_application_capture_events(0),true);assert.equal(k.rc_world_application_capture_events(0),true);assert.equal(a[b+L.header.events],pass+1);}
 assert.deepEqual(Array.from(a.subarray(b+32,b+48)),rows.flat());a[j+1]=0;a[off.broad+1]=0;a[off.ccd+1]=3;a[off.ccd+1184]=5;assert.equal(k.rc_world_application_begin_post_h(0),true);assert.equal(a[j+J.header.events],4);assert.deepEqual(Array.from(a.subarray(j+J.eventOffset,j+J.eventOffset+16)),rows.flat());
});
test('missing, nonfinal, skipped or overflowing CCD events are unsupported, never a miss',async()=>{
 for(const kind of['missing','nonfinal','skipped','overflow']){const h=await firstPrepared(),{a,off,k}=h,j=off.journal,b=off.worldApplication;
  if(kind==='skipped'){a[j+4]=2;assert.equal(k.rc_world_application_capture_events(0),false);}else if(kind==='overflow'){a[b+L.header.events]=256;a[j+10]=1;a.set([0,1,1,0],j+J.eventOffset);assert.equal(k.rc_world_application_capture_events(0),false);assert.equal(a[3],REASON.CAPACITY);}else{if(kind==='nonfinal'){k.rc_world_application_capture_events(0);a[b+L.header.cueAtEntry]=0;a[off.ccd+1184]=4;}assert.equal(k.rc_world_application_begin_post_h(0),false);}assert.equal(a[2],4);assert.equal(k.rc_world_application_result(0)[2],UNSET);
 }
});
test('the cue separation h retains inactive-CCD ownership and all 64 latched substeps',async()=>{const h=await firstPrepared(),{a,off,k,dep}=h;
 // Source numerical separation supplies this already-consumed receipt. The
 // adapter must not select active CCD merely because present is now false.
 for(const role of[0,1,2])assert.equal(dep.rc_scene_remove_body(off.scene,a[off.cue+16+role]),true);a[off.cue+4]=0;a[off.cue+11]=3;a.set([0,1,2],off.cue+606);a[off.application+24]=0;postAndSeal(h);assert.equal(a[off.worldApplication+L.header.subdivisions],64);assert.equal(a[off.worldApplication+L.header.phase],1);assert.equal(k.rc_world_application_begin_h(0),true);assert.equal(a[off.worldApplication+L.header.cueAtEntry],0);
});
test('expiry performs real head-shaft-guide removal after angular and preserves the queued next-h withdrawal',async()=>{const h=await firstPrepared(),{a,off,k,dep}=h;postAndSeal(h);const before=decodeSceneActivation(a.subarray(off.scene,off.scene+S.words),h.t.sceneTemplate);a.set(numberWords(123.7),off.application+4);a[off.application+27]=1;const frame=a[off.cue+7],epoch=a[off.scene+S.header.epoch];assert.equal(k.rc_world_application_expire_cue(0),true);assert.equal(a[off.scene+S.header.epoch],epoch+3);assert.equal(a[off.scene+S.header.phase],3);for(const role of[0,1,2])assert.equal(dep.rc_scene_valid_body(off.scene,a[off.cue+16+role]),false);const after=decodeSceneActivation(a.subarray(off.scene,off.scene+S.words),h.t.sceneTemplate);assert.equal(after.bodies.length,before.bodies.length-3);assert.equal(a[off.cue+7],frame);assert.equal(a[off.cue+11],3);assert.deepEqual(Array.from(a.subarray(off.cue+606,off.cue+609)),[0,1,2]);assert.equal(wordsNumber(a.subarray(off.cue+36,off.cue+38)),123.7);assert.equal(a[off.application+24],0);assert.equal(a[off.application+27],0);assert.equal(a[off.journal+J.header.cuePresent],1,'native collider queue is deferred until the next h');assert.equal(k.rc_world_application_expire_cue(0),true);assert.equal(a[off.scene+S.header.epoch],epoch+3);});
test('cancellation at every device boundary keeps compact terminal pass unset and never overwrites a final result',async()=>{for(const phase of Object.values(L.phases)){const h=await harness(),{a,off,k}=h;a[off.worldApplication+L.header.phase]=phase;k.rc_world_application_cancel(0);const row=decodeResults(Uint32Array.from(k.rc_world_application_result(0)),[73])[0];assert.equal(row.status,'cancelled');assert.equal(row.pass,null);assert.equal(a[5],0);}const h=await harness();h.a[2]=2;h.k.rc_world_application_cancel(0);assert.equal(h.a[2],2);});

// This source-level outer test exercises the actual GPU application's compact
// Number programs + integer continuation against unchanged optimizer-core,
// using explicit physical boundary inputs rather than a toy forward model.
test('outer source goal latch waits for full rest and late foul/horizon remain distinct',async()=>{
 for(const ending of['sleep','foul','horizon']){const h=await firstPrepared(),{a,off,k}=h,b=off.worldApplication,r=off.rules;postAndSeal(h);a[off.cue+4]=0;a[off.application+24]=0;a[b+L.header.phase]=6;a[b+L.header.substep]=64;a[off.application+A.header.complete]=1;
  const ids=[a[r+R.cueId],a[r+R.firstId],a[r+R.secondId],a[r+R.opponentId]],start=wordsNumber(a.subarray(off.application+6,off.application+8)),req={selectedId:ids[0],options:{gameMode:'four',mode:'carom',targetId:ids[1],secondId:ids[2],opponentId:ids[3],allowKiss:true,horizon:ending==='horizon'?2:20,objective:'shortest'}};
  a[r+R.maxSteps]=req.options.horizon;const trial=Core.createPhysicalAccumulator({speed:2},undefined,start,{x:0,y:.03075,z:0});
  for(const[id,time]of[[ids[1],.1],[ids[2],.2]]){consumeRuleEvent(a.subarray(r,r+128),{kind:2,id,time:numberWords(time)});Core.observePhysicalEvent(req,trial,{kind:'contact',a:{id:ids[0],kind:'ball'},b:{id,kind:'ball'},time:start+time});}
  const selected=a[off.application+A.header.selected],member=a[off.application+A.objectOffset+selected*16+4],sleepWord=off.scene+S.bodyOffset+member*32+S.body.activation+4;a[sleepWord]=0;
  const sourceInput=(now,sleeping)=>({dt:1,time:start+now,cuePresent:()=>false,allSleeping:()=>sleeping,sphereIds:()=>ids,positiveImpulse:()=>false,radius:()=>.03075,position:id=>({x:ids.indexOf(id)*.2,y:.03075,z:0})});
  a.set(numberWords(start+.3),off.application+4);h.app.rc_application_stage_begin(off.application,16);runJobs(h);assert.equal(k.rc_world_application_finish_outer(0),true);assert.equal(Core.observePhysicalStep(req,trial,sourceInput(.3,false)),false);assert.equal(a[2],1);assert.ok(a[r+R.flags]&F.goalLatched);
  if(ending==='foul'){consumeRuleEvent(a.subarray(r,r+128),{kind:2,id:ids[3],time:numberWords(.4)});Core.observePhysicalEvent(req,trial,{kind:'contact',a:{id:ids[0],kind:'ball'},b:{id:ids[3],kind:'ball'},time:start+.4});}
  if(ending==='sleep')a[sleepWord]=bits(1);a.set(numberWords(start+.5),off.application+4);a[b+L.header.phase]=6;h.app.rc_application_stage_begin(off.application,16);runJobs(h);assert.equal(k.rc_world_application_finish_outer(0),true);const input=sourceInput(.5,ending==='sleep');assert.equal(Core.observePhysicalStep(req,trial,input)||Core.finishPhysicalHorizon(req,trial,input),true);
  const expected=trial.verificationIncomplete?5:trial.success&&!trial.invalid?2:3;assert.equal(a[2],expected);const row=decodeResults(Uint32Array.from(k.rc_world_application_result(0)),[73])[0];assert.equal(row.pass,ending==='sleep'?true:ending==='foul'?false:null);
 }
});

test('actual device application adapter consumes 1024 resident prepared-world receipts without state readback between stages',{skip:process.env.RUN_RESIDENT_WORLD_APPLICATION_GPU!=='1'},async t=>{
 const {createNativeOwner,dispatchWordStages}=await import('./resident-candidate-gpu-support.mjs'),{generateBvhWGSL}=await import('../src/resident-candidate/bvh.mjs'),h=await firstPrepared(),{a,off,k}=h;
 assert.equal(k.rc_world_application_capture_events(0),true);const input=a.slice();postAndSeal(h);const expected=a.slice(),owner=await createNativeOwner('resident world application');
 const tile=256,tiles=4,stride=input.length,ss=h.t.numericScratchWords,bindings='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n@group(0) @binding(1) var<storage,read> rc_program:array<u32>;\n@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;\n@group(0) @binding(3) var<storage,read> rc_inputs:array<u32>;\n';
 const common=bindings+generateRawStrikeProgramWGSL()+generateNumericLibraryWGSL()+generateBvhWGSL()+generateContactRosterWGSL()+generateContactJournalWGSL()+generateSceneActivationWGSL()+generateSceneInitializationWGSL()+generateSceneWorldWGSL({includeNumericLibrary:false,includeRosterBridge:true,continuationOnly:true})+generateCueCanonicalBridgeWGSL()+generateSceneIntegrationWGSL(h.t)+generatePhysicalRulesWGSL()+generateApplicationWGSL(h.t.bundles.application);
 const control=common+generateWorldApplicationWGSL(h.t),evaluate=common+generateWorldApplicationEvaluateWGSL(h.t),prefix=`let id=gid.x;if(id>=${tile}u){return;}let bank=id*${stride}u;let scratch=id*${ss}u;let b=bank+${off.worldApplication}u;`,entry=body=>`\n@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){${prefix}${body}}`;
 const stages=[{code:control+entry(`if(rc_state[b+2u]==3u){rc_world_application_begin_post_h(bank);}rc_world_application_gather(bank,scratch);`)},{code:evaluate+entry('rc_world_application_evaluate(bank,scratch);')},{code:control+entry(`rc_world_application_scatter(bank,scratch);if(rc_state[b+2u]==4u&&rc_state[bank+${off.application+52}u]==1u){if(!rc_world_application_finish_post_h(bank)){return;}rc_journal_finish(bank+${off.journal}u);rc_state[bank+${off.broad+1}u]=0u;if(rc_world_scene_finish(bank)){rc_world_application_finish_h(bank);}}`)}];
 try{for(let batch=0;batch<tiles;batch++){const state=new Uint32Array(tile*stride);for(let i=0;i<tile;i++){const base=i*stride;state.set(input,base);for(const p of h.t.relocations)state[base+p]+=base;}
  const[actual]=await dispatchWordStages(owner,{stages,cycles:3,buffers:[{input:state,readback:true},{input:h.t.program},{words:tile*ss},{words:4}],bindingTypes:['storage','read-only-storage','storage','read-only-storage'],workgroups:tile/32,label:'world-application-'+batch});
  for(let i=0;i<tile;i++){const base=i*stride;for(const name of['header','worldApplication','application','rules','scene','bodies','journal']){const seg=h.t.segments[name],want=expected.slice(seg.offset,seg.offset+seg.words);for(const p of h.t.relocations)if(p>=seg.offset&&p<seg.offset+seg.words)want[p-seg.offset]+=base;assert.deepEqual(actual.slice(base+seg.offset,base+seg.offset+seg.words),want,`tile ${batch} lane ${i} ${name}`);}}
 }t.diagnostic(JSON.stringify({candidates:1024,tiles,dispatchesPerTile:9,preparedComponentInputs:['cue receipt','unchanged geometry','completed broad and inactive CCD receipt'],sourceClock:'computed on device',eventReadbackBetweenStages:false,completeH:false,performanceClaim:false}));}finally{owner.release();}
});
