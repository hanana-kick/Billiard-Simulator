import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createWorldInitializationPlan,assertWorldInitializationPlan,packWorldInitializationRows,buildWorldInitializationCommands,planWorldInitializationBanks,WORLD_INITIALIZATION_CAPABILITY} from '../src/resident-candidate/world-initialization.mjs';
import {executeSourceNumberProgramReference} from '../src/resident-candidate/raw-strike.mjs';
import {unpackCandidates,STATUS,REASON} from '../src/resident-candidate/abi.mjs';
import {numberWords} from '../src/resident-candidate/source-number.mjs';
import {RAW_POSE_LAYOUT} from '../src/resident-candidate/raw-strike.mjs';
import Init from '../src/experimental-cue-initialization.js';
import Graph from '../src/experimental-arithmetic-graph.js';
const require=createRequire(import.meta.url),H=require('./cue-obstacle-fixtures.cjs'),R=H.R;
const rule={firstId:3,secondId:4,method:'none',allowKiss:true,maxOuterSteps:12000},bits=a=>new Uint32Array(Float32Array.from(a).buffer),read=(a,p,n)=>Array.from(new Float32Array(a.buffer,a.byteOffset,a.length).slice(p,p+n));
let pending;const fixture=()=>pending??=(async()=>{const source=await originalRegisteredFixture(),plan=await createWorldInitializationPlan({decoder:source.decoder,input:source.raw,rule});return{...source,plan};})();
function nativeHandle(h){const b=new ArrayBuffer(8),v=new DataView(b);v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);}
function restore(raw){const a=raw.capture.preStrikeApplication,bind=o=>({...o,bodyHandle:nativeHandle(o.body),colliderHandle:nativeHandle(o.collider),pairColliderHandle:o.pairCollider?nativeHandle(o.pairCollider):undefined,pos:{x:0,y:0,z:0},trail:[]});const lab=globalThis.PhysicsLab.fromSnapshot(R,{...a,world:raw.preStrikeSnapshot,objects:a.registry.objects.map(bind),statics:a.registry.statics.map(bind)});lab.world.step=()=>{throw Error('Creation test must not step physics');};return lab;}
// TEST ONLY execution of the actual integer transport/binding WGSL. Numeric
// evaluator is replaced with the independent ORIGINAL Init.buildPlan oracle.
// None of this adapter is exported to runtime or offered as a CPU fallback.
function shader(code,bindings,{evaluate=false,count=1}={}){if(evaluate)code='const RC_INIT_COUNT:u32='+count+'u;'+code.slice(code.lastIndexOf('\nfn rc_world_creation_stage'));
 code=code.replace(/@group\([^\n]+\n/g,'').replace(/@compute\s+@workgroup_size\([^)]*\)\s*/g,'').replace(/@builtin\([^)]*\)\s*/g,'').replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?\s*\{/g,(_,n,args)=>`function ${n}(${args.replace(/:(?:u32|bool|vec3<u32>)/g,'')}){`).replace(/:(?:u32|bool)(?=\s*=)/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/arrayLength\(&(rc_\w+)\)/g,'$1.length');return new Function(...Object.keys(bindings),code+'\nreturn main;')(...Object.values(bindings));}
function transport(plan,rows,prepared){const input=packWorldInitializationRows(plan,rows),commands=buildWorldInitializationCommands(plan,rows.length),state=new Uint32Array(commands.resources.worldState),scratch=new Uint32Array(commands.resources.numericScratch),bindings={rc_inputs:input,rc_prepared:prepared,rc_state:state,rc_template:plan.clone,rc_program:plan.template.program,rc_scratch:scratch};
 const entry=plan.template.bundles.cue.entries[2].compiled,np=plan.template.programOffsets.cue+plan.template.program[plan.template.programOffsets.cue+24];bindings.rc_num_eval=(program,base)=>{assert.equal(program,np);const out=Graph.execute(new Float32Array(scratch.slice(base,base+40).buffer),Init.buildPlan()),indices=program+bindings.rc_program[program+8];for(let i=0;i<out.length;i++)scratch[base+bindings.rc_program[indices+i]]=bits([out[i]])[0];return 1;};assert.equal(entry.outputCount,30);
 const main=shader(commands.stages['world-transfer'].code,bindings);for(let row=0;row<rows.length;row++)main({x:row});const stages=Object.fromEntries(['begin','gather','evaluate','scatter','finish'].map(stage=>[stage,shader(commands.stages['creation-'+stage].code,bindings,{evaluate:stage==='evaluate',count:rows.length})]));return{input,commands,state,scratch,bindings,run(){for(const stage of['begin','gather','evaluate','scatter','gather','evaluate','scatter','gather','evaluate','scatter','finish'])for(let row=0;row<rows.length;row++)stages[stage]({x:row});},stages};}
function preparedRaw(plan,rows,clearances){const r=plan.raw.layout,a=new Uint32Array(rows.length*r.stateWords);rows.forEach((row,i)=>{const raw=executeSourceNumberProgramReference(plan.raw.program,[...['angle','elevation','speed','tipX','tipY'].map(k=>row.settings[k]),...plan.roster.center]).raw;a.set(raw,i*r.stateWords+r.raw);const c=i*r.stateWords+r.clearance;const status=clearances[i];a.set([status,60,0,plan.roster.selectedObstacleIndex,0,0,0,0,0,0xffffffff,177,59,0],c);});return a;}
const settings=(angle=0,elevation=8,speed=2,tipX=0,tipY=0)=>({angle,elevation,speed,tipX,tipY});
test('initialization authenticates one original prestrike, ordered obstacles and all initial uploads',async()=>{const{plan}=await fixture();assert.equal(assertWorldInitializationPlan(plan),plan);assert.equal(plan.receipt.nativeStepCount,0);assert.equal(plan.roster.obstacles.length,20);assert.equal(plan.roster.selectedObstacleIndex,17);assert.equal(plan.selectedIndex,1);assert.deepEqual(plan.roster.obstacles.map(x=>x.collider.index),[...Array.from({length:16},(_,i)=>i),16,18,20,22]);assert.equal(plan.roster.obstacles.filter(x=>x.shape.type==='convex').length,8);assert.equal(WORLD_INITIALIZATION_CAPABILITY.hostForwardFallback,false);assert.equal(WORLD_INITIALIZATION_CAPABILITY.nativeWholeH,false);assert.equal(plan.receipt.nativeAllocation,false);assert.throws(()=>assertWorldInitializationPlan({...plan}),/authentic/);
 const original=plan.raw.program.words[0];plan.raw.program.words[0]^=1;assert.throws(()=>assertWorldInitializationPlan(plan),/mutated/);plan.raw.program.words[0]=original;assert.equal(assertWorldInitializationPlan(plan),plan);
});
test('arbitrary raw five-parameter rows remain exact, including values only GPU may reject',async()=>{const{plan}=await fixture(),rows=[{id:7,settings:settings(-0,85,4.5,.55,.45)},{id:42,settings:settings(1e300,0,0,NaN,Infinity)}],packed=packWorldInitializationRows(plan,rows),actual=unpackCandidates(packed);for(let i=0;i<rows.length;i++){assert.equal(actual[i].id,rows[i].id);assert.equal(actual[i].selectedIndex,1);for(const k of Object.keys(rows[i].settings))assert.ok(Object.is(actual[i].settings[k],rows[i].settings[k]));}assert.throws(()=>packWorldInitializationRows(plan,[rows[0],rows[0]]),/Distinct/);assert.throws(()=>packWorldInitializationRows(plan,rows,{ruleId:1}),/common rule identity/);});
test('fixed device commands copy raw128 and clearance16 then initialize mass before admitting first h',async()=>{const{plan}=await fixture(),d=buildWorldInitializationCommands(plan,1024);assert.equal(Object.keys(d.stages).length,19);assert.equal(d.commands.filter(x=>x.stage==='creation-evaluate').length,3);assert.equal(d.commands.at(-1).stage,'creation-finish');assert.equal(d.commands.findIndex(x=>x.stage==='world-transfer'),d.commands.length-12);assert.equal(d.hostReadbacksBeforeH,0);assert.equal(d.numericalGpuExecuted,false);assert.equal(d.resources.rawState,1024*2010);assert.equal(d.initialUploads[0].offsetWords,1024*plan.template.state.length);assert.deepEqual(d.initialUploads[0].data,plan.template.fixedCcd);assert.equal(d.scratchAlias.words,1024*Math.max(plan.raw.layout.scratchWords,plan.template.numericScratchWords));assert.doesNotMatch(Object.values(d.stages).map(s=>s.code).join(''),/mapAsync|copyBufferToBuffer/);assert.match(d.stages['world-transfer'].code,/i<128u/);assert.match(d.stages['world-transfer'].code,/i<16u/);
 const p=planWorldInitializationBanks(plan,1024,{maxStorageBufferBindingSize:128*1024*1024,maxBufferSize:256*1024*1024});assert.equal(p.tiles.reduce((n,t)=>n+t.count,0),1024);for(const t of p.tiles){assert.ok(t.count*p.bytesPerCandidate.world+p.fixedCcdTailBytes<=128*1024*1024);for(const n of Object.values(p.bytesPerCandidate))assert.ok(t.count*n<=128*1024*1024);}assert.equal(p.hardwareMeasured,false);assert.equal(p.estimated,true);assert.throws(()=>planWorldInitializationBanks(plan,1,{maxStorageBufferBindingSize:4,maxBufferSize:4}),/exceeds/);
});
test('uncleared, incomplete, malformed and source-rejected raw transcripts cannot authorize a world',async()=>{const{plan}=await fixture(),rows=Array.from({length:6},(_,id)=>({id,settings:settings()}));rows[0].settings.speed=0;const prepared=preparedRaw(plan,rows,[3,2,3,0,1,1]),r=plan.raw.layout;prepared[2*r.stateWords+r.clearance+12]=4;prepared[4*r.stateWords+r.clearance+10]=176;const a=transport(plan,rows,prepared);a.run();const t=plan.template,o=t.segments;assert.deepEqual(rows.map((_,i)=>a.state[i*t.state.length+2]),[8,8,4,5,4,1]);assert.deepEqual(rows.map((_,i)=>a.state[i*t.state.length+3]),[2,3,4,11,11,0]);for(let i=0;i<5;i++)assert.equal(a.state[i*t.state.length+o.rawCreation.offset+4],0);assert.equal(a.state[5*t.state.length+o.rawCreation.offset+4],1);for(let i=0;i<6;i++){assert.equal(a.state[i*t.state.length+4],i);assert.deepEqual(a.state.slice(i*t.state.length+o.rawPose.offset,i*t.state.length+o.rawPose.offset+128),prepared.slice(i*r.stateWords+r.raw,i*r.stateWords+r.raw+128));}
});
test('generated creation stages agree with untouched original accepted native creations before any lateral or h',async()=>{await R.init();const{plan,raw}=await fixture(),rows=Array.from({length:16},(_,id)=>({id,settings:settings(id*23,8+id*4,0.5+id*.2,(id%3-1)*.2,(id%4-1.5)*.1)})),native=[],clear=[];
 for(const row of rows){const lab=restore(raw);try{const result=lab.strike(raw.capture.preStrikeApplication.controller.selectedId,row.settings,{saveSnapshot:false});clear.push(result.ok?1:2);if(!result.ok){native.push(null);continue;}native.push(['shaft','head','guide'].map(role=>{const body=role==='shaft'?lab.cue.body:lab.cue[role];return{translation:H.arr(body.translation()),rotation:H.quat(body.rotation()),linear:H.arr(body.linvel()),worldCom:H.arr(body.worldCom()),invMass:H.arr(body.effectiveInvMass()),ii:Array.from(body.effectiveWorldInvInertia().elements).slice(0,6)};}));}finally{lab.dispose();}}
 const prepared=preparedRaw(plan,rows,clear),a=transport(plan,rows,prepared);a.run();let accepted=0;for(let i=0;i<rows.length;i++){const bank=i*plan.template.state.length,q=bank+plan.template.segments.cue.offset,c=bank+plan.template.segments.rawCreation.offset;if(!native[i]){assert.equal(a.state[bank+2],8);continue;}accepted++;assert.equal(a.state[bank+2],1);assert.equal(a.state[c+4],1);assert.equal(a.state[c+5],3);for(const k of[5,6,7,13,47])assert.equal(a.state[q+k],0,'first source user changes remain pending');for(let role=0;role<3;role++){const p=q+64+role*48+(role<2?6:0),expected=native[i][role];assert.deepEqual(bits(read(a.state,p,3)),bits(expected.translation));assert.deepEqual(bits(read(a.state,p+3,4)),bits(expected.rotation));if(role<2){assert.deepEqual(bits(read(a.state,q+64+role*48,3)),bits(expected.linear));assert.deepEqual(bits(read(a.state,q+248+role*3,3)),bits(expected.worldCom));assert.deepEqual(bits(read(a.state,q+64+role*48+16,3)),bits(expected.invMass));assert.deepEqual(bits(read(a.state,q+64+role*48+19,6)),bits(expected.ii));const canonical=bank+plan.template.segments.bodies.offset+(4+role)*64;assert.deepEqual(a.state.slice(canonical+6,canonical+13),a.state.slice(p,p+7));}}}
 assert.ok(accepted>=3,'actually varied original accepted creation rows');console.log(JSON.stringify({scope:'raw-transfer-created-mass-host-not-gpu-or-h',rows:rows.length,accepted,nativeStepCount:0,firstLateralNotRun:true}));
});

// Deliberately fixed source cases, not adaptively filtered to make a GPU gate
// pass. The complete five Numbers travel unchanged. Expected original physics
// data below are TEST ONLY and are never bound to the device.
const initializationCases=()=>[
 {settings:settings(0,8,2),kind:'clear'},
 {settings:settings(23,37,1.7,.2,-.1),kind:'clear'},
 {settings:settings(310,85,4.5,.2,-.1),kind:'clear'},
 {settings:settings(180,37,.5,-.3,.15),kind:'clear'},
 {settings:settings(180,8,2),kind:'blocked'},
 {settings:settings(315,0,3),kind:'blocked'},
 {settings:settings(9,8,0),kind:'invalid',reason:REASON.SOURCE_INPUT_RANGE},
 {settings:settings(0,8,2,.8,.6),kind:'invalid',reason:REASON.SOURCE_INPUT_RANGE},
 {settings:settings(NaN,8,2),kind:'invalid',reason:REASON.NONFINITE_INPUT},
 {settings:settings(83,86,2),kind:'invalid',reason:REASON.SOURCE_INPUT_RANGE}
];
let nativeCasesPending;
const originalInitializationCases=()=>nativeCasesPending??=(async()=>{
 await R.init();const{plan,raw}=await fixture(),cases=initializationCases(),rows=cases.map((c,i)=>({id:17+i*101,settings:c.settings})),expected=[];
 for(const[rowIndex,row]of rows.entries()){
  const lab=restore(raw),c=cases[rowIndex];
  try{
   const selected=lab.get(raw.capture.preStrikeApplication.controller.selectedId);
   const pose=c.kind==='invalid'?null:lab.pose(selected,row.settings);
   const clearance=c.kind==='invalid'?null:lab.cueClearance(selected,row.settings);
   const result=lab.strike(selected.id,row.settings,{saveSnapshot:false});
   assert.equal(result.ok,c.kind==='clear','unchanged original fixed case '+rowIndex);
   if(clearance)assert.equal(clearance.clear,c.kind==='clear','unchanged original clearance case '+rowIndex);
   const bodies=result.ok?['shaft','head','guide'].map(role=>{
    const body=role==='shaft'?lab.cue.body:lab.cue[role];return{
     translation:H.arr(body.translation()),rotation:H.quat(body.rotation()),linear:H.arr(body.linvel()),angular:H.arr(body.angvel()),
     localCom:H.arr(body.localCom()),worldCom:H.arr(body.worldCom()),invMass:H.arr(body.effectiveInvMass()),
     ii:Array.from(body.effectiveWorldInvInertia().elements).slice(0,6)
    };
   }):null;
   expected.push({kind:c.kind,status:result.ok?STATUS.RUNNING:STATUS.REJECTED,reason:result.ok?REASON.NONE:c.kind==='blocked'?REASON.CUE_BLOCKED:c.reason,pose,clearance,bodies});
  }finally{lab.dispose();}
 }
 return{plan,rows,expected};
})();
function assertInitializedBank(words,plan,row,wanted,index){
 const t=plan.template,base=index*t.state.length,o=t.segments,q=base+o.cue.offset,c=base+o.rawCreation.offset,r=base+o.rawPose.offset,cl=base+o.rawClearance.offset;
 const label=`candidate ${row.id}`;
 assert.equal(words[base+4],row.id,label+' original ID');
 assert.equal(words[base+2],wanted.status,label+' exact terminal initialization status; unsupported cannot be a miss');
 assert.equal(words[base+3],wanted.reason,label+' exact rejection reason');
 assert.equal(words[base+5],0,label+' no h has run');
 if(wanted.pose){
  assert.equal(words[r],1,label+' raw pose ready');assert.equal(words[cl],wanted.kind==='clear'?1:2,label+' complete source clearance');
  assert.equal(words[cl+10],177,label+' all original sampled queries');assert.equal(words[cl+11],59,label+' all original part/obstacle pairs');
  assert.equal(Boolean(words[cl+8]),wanted.clearance.swept,label+' continuous original sweep predicate');
  const pose={...wanted.pose,linear:Object.fromEntries(['x','y','z'].map(k=>[k,wanted.pose.direction[k]*row.settings.speed]))};
  for(const key of['direction','side','up','surface','contact','tip','rotation','linear','shaftCenter']){
   const components=key==='rotation'?H.quat(pose[key]):H.arr(pose[key]);
   for(let axis=0;axis<components.length;axis++)assert.deepEqual(words.slice(r+RAW_POSE_LAYOUT[key]+2*axis,r+RAW_POSE_LAYOUT[key]+2*axis+2),numberWords(components[axis]),label+' original binary64 '+key+' '+axis);
  }
 }else{assert.equal(words[r],STATUS.REJECTED,label+' original input rejection');assert.equal(words[r+1],wanted.reason);}
 if(!wanted.bodies){assert.equal(words[c+4],0,label+' rejected candidate has no admitted creation');return;}
 assert.equal(words[c+4],1,label+' numerical creation complete');assert.equal(words[c+5],3,label+' creation transport complete');
 for(const k of[5,6,7,13,47])assert.equal(words[q+k],0,label+' original first user changes still pending '+k);
 for(let role=0;role<3;role++){
  const expected=wanted.bodies[role],joint=q+64+role*48,pose=joint+(role<2?6:0),input=q+374+role*40;
  const same=(offset,a,field)=>assert.deepEqual(words.slice(offset,offset+a.length),bits(a),label+' '+role+' '+field);
  same(pose,expected.translation,'created translation');same(pose+3,expected.rotation,'created rotation');
  same(input,expected.translation,'pending Init translation');same(input+3,expected.rotation,'pending Init rotation');
  if(role<2){
   const canonical=base+o.bodies.offset+(4+role)*64;
   same(joint,expected.linear,'created linear');same(joint+3,expected.angular,'created angular');same(joint+13,expected.localCom,'local COM');
   same(q+248+role*3,expected.worldCom,'created world COM');same(joint+16,expected.invMass,'created inverse mass');same(joint+19,expected.ii,'created world inverse inertia');
   same(canonical,expected.linear,'canonical linear');same(canonical+3,expected.angular,'canonical angular');same(canonical+6,expected.translation,'canonical translation');same(canonical+9,expected.rotation,'canonical rotation');
   same(canonical+13,expected.invMass,'canonical inverse mass');same(canonical+56,expected.localCom,'canonical local COM');same(canonical+59,expected.worldCom,'canonical world COM');
   const m=expected.ii;same(canonical+16,[m[0],m[1],m[2],m[1],m[3],m[4],m[2],m[4],m[5]],'canonical world inverse inertia');
  }
 }
}
test('native initializer holdouts are fixed original clear, blocked and invalid source cases',async()=>{
 const{plan,rows,expected}=await originalInitializationCases();assert.equal(rows.length,10);
 assert.deepEqual(expected.reduce((n,e)=>(n[e.kind]++,n),{clear:0,blocked:0,invalid:0}),{clear:4,blocked:2,invalid:4});
 const clearances=expected.map(e=>e.kind==='clear'?1:e.kind==='blocked'?2:3),prepared=preparedRaw(plan,rows,clearances);
 expected.forEach((e,i)=>{prepared[i*plan.raw.layout.stateWords+plan.raw.layout.clearance+8]=Number(e.clearance?.swept??false);});
 const a=transport(plan,rows,prepared);a.run();
 rows.forEach((row,i)=>assertInitializedBank(a.state,plan,row,expected[i],i));
});

// The coordinator alone enables this gate. It exercises the actual public
// initializer descriptors, not a test replacement or CPU-prepared pose seed.
test('actual raw rows initialize source-created resident aliases with one final readback',{
 skip:process.env.RUN_RESIDENT_WORLD_INITIALIZATION_GPU!=='1',timeout:900000
},async t=>{
 const{createNativeOwner}=await import('./resident-candidate-gpu-support.mjs');
 const{plan,rows,expected}=await originalInitializationCases(),commands=buildWorldInitializationCommands(plan,rows.length),input=packWorldInitializationRows(plan,rows);
 const owner=await createNativeOwner('raw source world initialization'),device=owner.device,allocations=[];let scoped=false,submitted=false;
 const make=(words,usage,label)=>{assert.ok(words*4<=device.limits.maxBufferSize,label+' buffer capacity');const b=device.createBuffer({size:words*4,usage,label});allocations.push(b);return b;};
 try{
  device.pushErrorScope('validation');scoped=true;
  const resource={},sharedScratch=make(commands.scratchAlias.words,128,'initializer liveness-reused scratch');
  assert.ok(commands.scratchAlias.words*4<=device.limits.maxStorageBufferBindingSize,'source scratch capacity unchanged');
  for(const[name,value]of Object.entries(commands.resources)){
   if(name==='rawScratch'||name==='numericScratch'){resource[name]=sharedScratch;continue;}
   const words=typeof value==='number'?value:value.length;assert.ok(words*4<=device.limits.maxStorageBufferBindingSize,name+' storage capacity unchanged');
   resource[name]=make(words,128|8|4,'initializer '+name);
   if(value instanceof Uint32Array)device.queue.writeBuffer(resource[name],0,value);
  }
  device.queue.writeBuffer(resource.inputs,0,input);
  for(const upload of commands.initialUploads)device.queue.writeBuffer(resource[upload.resource],upload.offsetWords*4,upload.data);
  const stages={};
  for(const[name,stage]of Object.entries(commands.stages)){
   console.log(JSON.stringify({gate:'world-initialization',stage:'compile-start',name,bytes:stage.code.length}));
   const groupLayout=device.createBindGroupLayout({entries:stage.bindingTypes.map((type,binding)=>({binding,visibility:4,buffer:{type}}))}),layout=device.createPipelineLayout({bindGroupLayouts:[groupLayout]}),module=device.createShaderModule({code:stage.code,label:name}),info=await module.getCompilationInfo();
   assert.deepEqual(info.messages.filter(m=>m.type==='error').map(m=>`${m.lineNum}:${m.linePos} ${m.message}`),[],name+' original WGSL');
   console.log(JSON.stringify({gate:'world-initialization',stage:'pipeline-start',name}));
   const pipeline=await device.createComputePipelineAsync({layout,compute:{module,entryPoint:stage.entryPoint}}),group=device.createBindGroup({layout:groupLayout,entries:stage.resources.map((key,binding)=>({binding,resource:{buffer:resource[key]}}))});
   stages[name]={pipeline,group,workgroups:stage.workgroups};console.log(JSON.stringify({gate:'world-initialization',stage:'pipeline-ready',name}));
  }
  const schedule=function*(){for(const command of commands.commands)for(let repeat=0;repeat<command.repeat;repeat++)yield command.stage;};
  let encoder=null,pass=null,chunk=0,submissions=0,dispatches=0;
  const submit=async()=>{if(!chunk)return;pass.end();device.queue.submit([encoder.finish()]);submitted=true;await device.queue.onSubmittedWorkDone();submissions++;chunk=0;encoder=null;pass=null;};
  for(const name of schedule()){
   if(!pass){encoder=device.createCommandEncoder({label:'fixed initialization chunk '+submissions});pass=encoder.beginComputePass();}
   const stage=stages[name];pass.setPipeline(stage.pipeline);pass.setBindGroup(0,stage.group);pass.dispatchWorkgroups(stage.workgroups);dispatches++;chunk++;
   if(chunk===1024)await submit();
  }
  await submit();assert.equal(dispatches,commands.dispatches);
  // No host mapping, decision inspection or re-upload occurs above. This final
  // diagnostic copy is not a runtime input and never authorizes future physics.
  const readback=make(commands.resources.worldState,1|8,'final initialized bank diagnostics'),copy=device.createCommandEncoder();
  copy.copyBufferToBuffer(resource.worldState,0,readback,0,commands.resources.worldState*4);device.queue.submit([copy.finish()]);submitted=true;
  await readback.mapAsync(1);const actual=new Uint32Array(readback.getMappedRange().slice(0));readback.unmap();
  const validation=await device.popErrorScope();scoped=false;assert.equal(validation,null,'actual initializer device validation');
  rows.forEach((row,i)=>assertInitializedBank(actual,plan,row,expected[i],i));
  assert.deepEqual(actual.slice(rows.length*plan.template.state.length),plan.template.fixedCcd,'shared immutable original CCD tail');
  t.diagnostic(JSON.stringify({rawRows:rows.length,clear:4,blocked:2,sourceInvalid:4,dispatches,submissions,intermediateReadbacks:0,finalMappings:1,createdAliasesBitwise:true,nativeStepCount:0,wholeH:false,fullRest:false,nativeAllocation:false,hardwarePerformance:false,adapter:owner.adapterInfo}));
 }finally{
  if(scoped)await device.popErrorScope();if(submitted)await device.queue.onSubmittedWorkDone();for(const b of allocations){try{b.unmap();}catch{}b.destroy();}owner.release();
 }
});
