// Independent coordinator-only raw input -> original initialization -> device
// schedule -> two complete h gate. Expected source futures are assertions only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,rmSync} from 'node:fs';
import {createRawFirstHFixture} from './resident-candidate-raw-whole-h-fixture.mjs';
import {compareRawWorldPcResult} from './resident-candidate-raw-world-pc-compare.mjs';
import {worldDevicePcCommands,WORLD_DEVICE_PC as PC} from '../src/resident-candidate/world-device-pc.mjs';
import {NUMERIC_PROFILE} from '../src/resident-candidate/numeric-profile.mjs';
import {createRawWorldPcPlan,runRawWorldPc,completedRawPcRequestWGSL} from './resident-candidate-raw-world-pc-runner.mjs';
import {compileWorldSourceOwners} from '../src/resident-candidate/world-owners.mjs';
import {createRetainedNativePipelineCache} from './resident-candidate-native-session.mjs';
import {STATUS,unpackCandidates} from '../src/resident-candidate/abi.mjs';
const FRAMES=2;
let pending;const fixture=()=>pending??=createRawFirstHFixture({frames:FRAMES});
const ownerMode=(template,{controlVisitPolicy='static-chain',controlPartition='merged'}={})=>({name:'owners',compile:(pc,source)=>compileWorldSourceOwners(template,source,pc,{controlVisitPolicy,controlPartition})});
const gate=(f,options={})=>createRawWorldPcPlan({initializationPlan:f.plan,rows:f.rows,frames:FRAMES,...options});

test('raw device-PC gate retains independent original two-h variants and only common initial uploads',async()=>{
 const f=await fixture(),g=gate(f),{template:t,pc,init}=g,clear=f.results.filter(r=>r.kind==='clear');
 assert.equal(f.frames,2);assert.equal(clear.length,4);assert.equal(f.results.length,6);assert.equal(new Set(clear.map(r=>r.seed.initialSnapshotSha256)).size,4);
 for(const r of clear){assert.equal(r.seed.sourceOrigin.preStrikeSnapshotSha256,f.plan.preStrikeIdentity);assert.deepEqual(r.seed.sourceOrigin.settings,r.row.settings);assert.equal(r.initial.frame,0);assert.equal(r.next,r.steps[0]);assert.equal(r.final,r.steps[1]);assert.deepEqual(r.steps.map(x=>x.snapshot.frame),[1,2]);assert.equal(r.final.scoring.status,'running');}
 assert.deepEqual(unpackCandidates(g.input).map(r=>r.settings),f.rows.map(r=>r.settings));
 assert.deepEqual(f.results.filter(r=>r.status===STATUS.REJECTED).map(r=>r.kind),['blocked','invalid']);
 assert.equal(init.commands.at(-1).stage,'creation-finish');assert.equal(init.hostReadbacksBeforeH,0);assert.equal(pc.maxH,2);assert.equal(pc.controlTailBase,g.count*t.state.length+t.fixedCcd.length);assert.equal(pc.totalStateWords,pc.controlTailBase+g.count*pc.controlWords);
 assert.deepEqual(g.program.slice(0,pc.programBase),t.program);assert.deepEqual(g.program.slice(pc.programBase),pc.bytecode);assert.equal(init.resources.worldTemplate,f.plan.clone,'only authenticated common allocation template');assert.equal(init.resources.worldState,pc.controlTailBase,'no per-row CPU-created bank upload');assert.equal(init.initialUploads.length,1);assert.equal(init.initialUploads[0].data,t.fixedCcd);assert.equal(init.initialUploads[0].offsetWords,g.count*t.state.length);
 assert.equal(g.source.transport.coupled,'micro');assert.equal(g.source.transport.cue,'flat');assert.equal(g.source.transport.application,'staged');assert.equal(g.source.transport.ccd,'staged');assert.equal(g.source.transport.query,'staged');
 let begins=0,commands=0;for(const id of worldDevicePcCommands(pc,{sweeps:3})){if(id===-1)begins++;else assert.ok(id>=0&&id<pc.pipelines.length);commands++;}assert.equal(begins,1);assert.equal(commands,1+3*pc.pipelines.length);
 assert.throws(()=>gate(f,{sweeps:0}),/Fixed transport/);assert.equal(pc.capability.nativeQualified,false);assert.equal(pc.capability.fullRestQualified,false);
 console.log(JSON.stringify({scope:'raw-device-PC-two-h-host-only',rows:g.count,originalCreatedVariants:4,rejected:2,frames:FRAMES,initializerDispatches:init.dispatches,sourcePipelines:pc.pipelines.length,pcInstructions:pc.instructions,controlWordsPerCandidate:pc.controlWords,fixedSweeps:g.sweeps,totalDispatches:g.dispatches,expectedSnapshotsUploaded:false,defaultBackendChanged:false}));
});

test('raw runner source mode cannot replace source schedule or overlap owner request storage',async()=>{
 const f=await fixture(),g=gate(f),routed=gate(f,{sourceMode:{name:'test-shape-only',compile:pc=>({...pc,totalStateWords:pc.totalStateWords+6*24})}});
 assert.equal(routed.sourceMode,'test-shape-only');assert.deepEqual(routed.pc.bytecode,g.pc.bytecode);assert.equal(routed.pc.controlTailBase,g.pc.controlTailBase);
 assert.throws(()=>gate(f,{sourceMode:{name:'bad',compile:pc=>({...pc,stateWords:pc.stateWords+1})}}),/Source-mode immutable/);
 assert.throws(()=>gate(f,{sourceMode:{name:'bad',compile:pc=>({...pc,bytecode:Uint32Array.of(4,0,0,0)})}}),/sole authority/);
 const resume=completedRawPcRequestWGSL(g.pc),entry=resume.slice(resume.lastIndexOf('@compute'));
 assert.match(entry,/if\(rc_state\[cb\+4u\]!=2u\)\{return;\}/);assert.ok(entry.indexOf('rc_state[bank+5u]!=rc_state[cb+5u]+rc_state[cb+7u]')<entry.indexOf('rc_pc_test_begin(gid);'));
 assert.doesNotMatch(entry,/rc_state\[bank[^\]]*\]\s*=(?!=)/,'request handoff never overwrites physical bank state');
});

test('explicit raw owner mode retains all six initialization rows and exact source PC authority',async()=>{
 const f=await fixture(),g=gate(f,{sourceMode:ownerMode(f.plan.template)}),phase=gate(f);
 assert.equal(g.sourceMode,'owners');assert.equal(g.pc.pipelines.length,10);assert.equal(g.pc.phasePipelineCount,phase.pc.pipelines.length);assert.deepEqual(g.pc.bytecode,phase.pc.bytecode);assert.equal(g.pc.requestTailBase,phase.pc.totalStateWords);assert.equal(g.pc.totalStateWords,phase.pc.totalStateWords+g.count*24);assert.deepEqual(g.input,phase.input);assert.equal(g.init.dispatches,phase.init.dispatches);assert.equal(g.dispatches,g.init.dispatches+1+g.pc.sweep.length*g.sweeps);assert.equal(g.pc.capability.nativeQualified,false);assert.equal(g.pc.controlVisitPolicy,'static-chain');
 const single=compileWorldSourceOwners(f.plan.template,g.source,g.phasePc,{controlVisitPolicy:'single-call'});assert.equal(single.controlVisitPolicy,'single-call');assert.equal(single.owners.find(o=>o.name==='control').visitPolicy,'single-call');assert.deepEqual(single.bytecode,g.pc.bytecode);assert.equal(single.totalStateWords,g.pc.totalStateWords);assert.notEqual(single.pipelines[0].code,g.pc.pipelines[0].code);for(let i=1;i<single.pipelines.length;i++)assert.equal(single.pipelines[i].code,g.pc.pipelines[i].code,'only control dispatch transport changes');
 assert.throws(()=>compileWorldSourceOwners(f.plan.template,g.source,g.phasePc,{controlVisitPolicy:'shortened'}),/control visit policy/);
});

test('shared strict comparator rejects unadvanced source banks and retains complete failure diagnostics',async()=>{
 const f=await fixture(),g=gate(f),words=new Uint32Array(g.pc.totalStateWords),path='/tmp/resident-shared-raw-compare-'+process.pid+'.bin',trace=[];
 for(let i=0;i<g.count;i++){const b=i*g.template.state.length;words.set(g.template.state,b);for(const at of g.template.relocations)words[b+at]+=b;words[b+4]=f.rows[i].id;}words.set(g.template.fixedCcd,g.count*g.template.state.length);const before=words.slice();
 try{assert.throws(()=>compareRawWorldPcResult({fixture:f,plan:g,words,artifactPath:path,trace:e=>trace.push(e)}));assert.deepEqual(words,before,'comparison cannot repair or evolve resident state');const details=JSON.parse(readFileSync(path+'.json','utf8'));assert.equal(details.frames,2);assert.equal(details.count,6);assert.equal(details.candidate,f.rows[0].id);assert.equal(readFileSync(path).byteLength,words.byteLength);assert.equal(details.differences.length,11,'same complete represented-owner diagnostics');assert.ok(trace.some(x=>x.stage==='mismatch'));assert.equal(details.preStrikeIdentity,f.plan.preStrikeIdentity);}
 finally{rmSync(path,{force:true});rmSync(path+'.json',{force:true});}
});

test('actual six raw rows initialize and retain source owners across one device-PC two-h request',{
 skip:process.env.RUN_RESIDENT_RAW_WORLD_PC_GPU!=='1',timeout:1200000
},async t=>{
 const{createNativeOwner}=await import('./resident-candidate-gpu-support.mjs'),f=await fixture();
 const options={sweeps:Number(process.env.RESIDENT_RAW_WORLD_PC_SWEEPS??process.env.RESIDENT_WORLD_PC_SWEEPS??512),numericProfile:process.env.RESIDENT_WORLD_PC_NUMERIC_PROFILE??NUMERIC_PROFILE.PRESERVED_F32};
 for(const[key,env]of Object.entries({coupledTransport:'COUPLED',cueTransport:'CUE',applicationTransport:'APPLICATION',ccdTransport:'CCD',queryTransport:'QUERY'}))if(process.env['RESIDENT_WORLD_PC_'+env+'_TRANSPORT']!==undefined)options[key]=process.env['RESIDENT_WORLD_PC_'+env+'_TRANSPORT'];
 const sourceMode=process.env.RESIDENT_WORLD_SOURCE_MODE??'phases',runs=Number(process.env.RESIDENT_RAW_WORLD_PC_RUNS??1);assert.ok(['phases','owners'].includes(sourceMode));assert.ok([1,2].includes(runs));if(sourceMode==='owners')options.sourceMode=ownerMode(f.plan.template,{controlVisitPolicy:process.env.RESIDENT_WORLD_CONTROL_VISIT_POLICY??'static-chain',controlPartition:process.env.RESIDENT_WORLD_CONTROL_PARTITION??'merged'});
 const g=gate(f,options),{count,template,init,source,pc,sweeps}=g,owner=await createNativeOwner('raw parameters through device-PC two h');
 try{
  const trace=e=>console.log(JSON.stringify({gate:'raw-device-pc',...e})),cache=createRetainedNativePipelineCache(owner,{trace});
  let firstWords=null;for(let run=1;run<=runs;run++){
  console.log(JSON.stringify({gate:'raw-device-pc',stage:'begin',run,runs,sourceMode,controlVisitPolicy:pc.controlVisitPolicy??null,controlPartition:pc.controlPartition??null,rawInput:true,rows:count,frames:FRAMES,sweeps,epochMode:'single',transport:source.transport,initializerDispatches:init.dispatches,pcPipelines:pc.pipelines.length,pcInstructions:pc.instructions,totalDispatches:g.dispatches,intermediateMappings:0,expectedSnapshotsUploaded:false,adapter:owner.adapterInfo}));
  const{words,stats}=await runRawWorldPc({owner,cache,plan:g,trace}),{dispatches,submissions}=stats;
  const expectedRequests=Object.keys(init.stages).length+pc.pipelines.length+1;assert.equal(stats.cache.requests,expectedRequests);if(run===2){assert.equal(stats.cache.coldCompiles,0,'identical source/code/count uses retained native pipelines');assert.equal(stats.cache.warmHits,expectedRequests);assert.equal(stats.cache.entries,0);assert.deepEqual(words,firstWords,'fresh source inputs reproduce independent complete bank, never previous-state upload');}else firstWords=words.slice();
  console.log(JSON.stringify({gate:'raw-device-pc',stage:'submitted',run,runs,sourceMode,controlVisitPolicy:pc.controlVisitPolicy??null,controlPartition:pc.controlPartition??null,...stats,timingKind:'host-wall-not-gpu-timestamp'}));
  const{controls}=compareRawWorldPcResult({fixture:f,plan:g,words,run,artifactPath:process.env.RESIDENT_RAW_WORLD_PC_ACTUAL_PATH??'/tmp/resident-raw-world-pc-native-actual.bin',trace});
  t.diagnostic(JSON.stringify({rawInput:true,run,runs,sourceMode,controlVisitPolicy:pc.controlVisitPolicy??null,controlPartition:pc.controlPartition??null,cache:stats.cache,rows:count,originalCreatedVariants:4,rejected:2,hPerAcceptedRow:FRAMES,epochMode:'single',sweeps,dispatches,submissions,intermediateCopies:0,intermediateMappings:0,finalMappings:1,expectedSnapshotsUploaded:false,lastNeededSweeps:controls.map(c=>Math.ceil(c[PC.header.dispatchVisits]/pc.pipelines.length)),fullRest:false,native1024:false,hardwarePerformance:false,adapter:owner.adapterInfo}));
  }
 }finally{owner.release();}
});
