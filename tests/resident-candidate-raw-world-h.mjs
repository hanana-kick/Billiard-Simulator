import test from 'node:test';
import assert from 'node:assert/strict';
import {createRawFirstHFixture} from './resident-candidate-raw-whole-h-fixture.mjs';
import {compareWorldBank} from './resident-candidate-whole-h-fixture.mjs';
import {buildWorldInitializationCommands,packWorldInitializationRows} from '../src/resident-candidate/world-initialization.mjs';
import {generateWorldHPlan,worldHCommands} from '../src/resident-candidate/world-h.mjs';
import {NUMERIC_PROFILE} from '../src/resident-candidate/numeric-profile.mjs';
import {STATUS,unpackCandidates} from '../src/resident-candidate/abi.mjs';
let pending;
const fixture=()=>pending??=createRawFirstHFixture();

test('raw first-h oracle uses independent original strike snapshots, not edited created seeds',async()=>{
 const f=await fixture(),clear=f.results.filter(r=>r.kind==='clear');assert.equal(clear.length,4);assert.equal(f.results.length,6);
 assert.equal(new Set(clear.map(r=>r.seed.initialSnapshotSha256)).size,4,'actual parameter-dependent native created snapshots');
 const packed=unpackCandidates(packWorldInitializationRows(f.plan,f.rows));
 for(const[r,i]of f.rows.map((r,i)=>[r,i]))assert.deepEqual(packed[i].settings,r.settings,'unmodified raw input five Numbers');
 for(const r of clear){assert.equal(r.seed.sourceOrigin.preStrikeSnapshotSha256,f.plan.preStrikeIdentity);assert.deepEqual(r.seed.cueInitial.application.strikeSettings,r.row.settings);assert.equal(r.initial.frame,0);assert.equal(r.next.snapshot.frame,1);assert.ok(r.next.snapshot.time>r.initial.time);assert.equal(r.next.scoring.status,'running');}
 const init=buildWorldInitializationCommands(f.plan,f.rows.length),h=generateWorldHPlan(f.plan.template,{count:f.rows.length,numericProfile:NUMERIC_PROFILE.PRESERVED_F32});
 assert.equal(init.commands.at(-1).stage,'creation-finish');assert.equal(init.hostReadbacksBeforeH,0);assert.equal(h.stateWords,f.plan.template.state.length);assert.equal(h.scratchWords,f.plan.template.numericScratchWords);
 assert.deepEqual(f.results.filter(r=>r.status===STATUS.REJECTED).map(r=>r.kind),['blocked','invalid']);
 console.log(JSON.stringify({scope:'raw-source-first-h-oracle-host-only',rows:f.rows.length,sourceCreatedSnapshots:4,originalRejected:2,initDispatches:init.dispatches,hDispatches:[...worldHCommands(h)].length,expectedSnapshotsUploaded:false,defaultBackendChanged:false}));
});

// The sole GPU coordinator opts in. This is not the public fail-closed compact
// publisher: it is an independent diagnostic parity gate for all source owners.
test('actual raw parameters remain resident through source creation and one full h',{
 skip:process.env.RUN_RESIDENT_RAW_WORLD_H_GPU!=='1',timeout:1200000
},async t=>{
 const{createNativeOwner}=await import('./resident-candidate-gpu-support.mjs');
 const f=await fixture(),count=f.rows.length,template=f.plan.template,init=buildWorldInitializationCommands(f.plan,count),h=generateWorldHPlan(template,{count,numericProfile:NUMERIC_PROFILE.PRESERVED_F32}),input=packWorldInitializationRows(f.plan,f.rows);
 const owner=await createNativeOwner('raw parameters through source first h'),device=owner.device,owned=[];let scoped=false,submitted=false;
 const make=(words,usage,label)=>{assert.ok(Number.isSafeInteger(words)&&words>0);assert.ok(words*4<=device.limits.maxBufferSize,label+' capacity');const b=device.createBuffer({size:words*4,usage,label});owned.push(b);return b;};
 try{
  device.pushErrorScope('validation');scoped=true;
  const resources={},scratch=make(init.scratchAlias.words,128,'raw then whole-h reused scratch');assert.ok(init.scratchAlias.words*4<=device.limits.maxStorageBufferBindingSize);
  for(const[name,value]of Object.entries(init.resources)){
   if(name==='rawScratch'||name==='numericScratch'){resources[name]=scratch;continue;}
   const words=typeof value==='number'?value:value.length;assert.ok(words*4<=device.limits.maxStorageBufferBindingSize,name+' exact source binding capacity');
   resources[name]=make(words,128|8|4,name);if(value instanceof Uint32Array)device.queue.writeBuffer(resources[name],0,value);
  }
  assert.ok(template.sharedGeometry.byteLength<=device.limits.maxStorageBufferBindingSize);resources.worldGeometry=make(template.sharedGeometry.length,128|8,'common original immutable geometry');device.queue.writeBuffer(resources.worldGeometry,0,template.sharedGeometry);
  device.queue.writeBuffer(resources.inputs,0,input);for(const upload of init.initialUploads)device.queue.writeBuffer(resources[upload.resource],upload.offsetWords*4,upload.data);
  const compile=async(name,code,bindingTypes,buffers,workgroups,entryPoint='main')=>{
   console.log(JSON.stringify({gate:'raw-world-h',stage:'compile-start',name,bytes:code.length}));
   const groupLayout=device.createBindGroupLayout({entries:bindingTypes.map((type,binding)=>({binding,visibility:4,buffer:{type}}))}),layout=device.createPipelineLayout({bindGroupLayouts:[groupLayout]}),module=device.createShaderModule({code,label:name}),info=await module.getCompilationInfo();
   assert.deepEqual(info.messages.filter(m=>m.type==='error').map(m=>`${m.lineNum}:${m.linePos} ${m.message}`),[],name+' WGSL');
   console.log(JSON.stringify({gate:'raw-world-h',stage:'pipeline-start',name}));
   const pipeline=await device.createComputePipelineAsync({layout,compute:{module,entryPoint}}),group=device.createBindGroup({layout:groupLayout,entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
   console.log(JSON.stringify({gate:'raw-world-h',stage:'pipeline-ready',name}));return{pipeline,group,workgroups};
  };
  const initial={};for(const[name,stage]of Object.entries(init.stages))initial[name]=await compile('initialize '+name,stage.code,stage.bindingTypes,stage.resources.map(key=>resources[key]),stage.workgroups,stage.entryPoint);
  const world=[];for(const stage of h.pipelines)world.push(await compile('world '+stage.name,stage.code,h.bindingTypes,[resources.worldState,resources.worldProgram,resources.worldGeometry,scratch,resources.inputs],count));
  const schedule=function*(){for(const command of init.commands)for(let repeat=0;repeat<command.repeat;repeat++)yield initial[command.stage];for(const index of worldHCommands(h))yield world[index];};
  let encoder=null,pass=null,chunk=0,submissions=0,dispatches=0;
  const submit=async()=>{if(!chunk)return;pass.end();device.queue.submit([encoder.finish()]);submitted=true;await device.queue.onSubmittedWorkDone();submissions++;chunk=0;encoder=null;pass=null;};
  // The same allocations survive the raw-to-world handoff. No diagnostic copy
  // or mapping separates initialization from h; no CPU-created lane is uploaded.
  for(const stage of schedule()){
   if(!pass){encoder=device.createCommandEncoder({label:'raw then h fixed chunk '+submissions});pass=encoder.beginComputePass();}
   pass.setPipeline(stage.pipeline);pass.setBindGroup(0,stage.group);pass.dispatchWorkgroups(stage.workgroups);dispatches++;chunk++;if(chunk===1024)await submit();
  }
  await submit();assert.equal(dispatches,init.dispatches+[...worldHCommands(h)].length);
  const readback=make(init.resources.worldState,1|8,'final raw plus h diagnostics'),copy=device.createCommandEncoder();copy.copyBufferToBuffer(resources.worldState,0,readback,0,init.resources.worldState*4);device.queue.submit([copy.finish()]);submitted=true;
  await readback.mapAsync(1);const actual=new Uint32Array(readback.getMappedRange().slice(0));readback.unmap();const validation=await device.popErrorScope();scoped=false;assert.equal(validation,null,'raw plus h device validation');
  for(const[i,r]of f.results.entries()){
   const base=i*template.state.length;console.log(JSON.stringify({gate:'raw-world-h',stage:'boundary',candidate:r.row.id,kind:r.kind,status:actual[base+2],reason:actual[base+3],hSequence:actual[base+5],worldHDetail:actual[base+template.segments.worldH.offset+3]}));
   assert.equal(actual[base+4],r.row.id);assert.equal(actual[base+2],r.status,'source candidate status; unsupported is not an ordinary failed shot');assert.equal(actual[base+3],r.reason);
   if(r.status===STATUS.REJECTED){assert.equal(actual[base+5],0,'rejected candidate never advances h');assert.equal(actual[base+template.segments.rawCreation.offset+4],0);}
   else compareWorldBank({words:actual,base,template,seed:r.seed,expected:r.next.snapshot,scoring:r.next.scoring});
  }
  assert.deepEqual(actual.slice(count*template.state.length),template.fixedCcd);
  t.diagnostic(JSON.stringify({rawInput:true,rows:count,sourceCreatedVariants:4,rejected:2,hPerAcceptedRow:1,dispatches,submissions,intermediateMappings:0,finalMappings:1,expectedSnapshotsUploaded:false,fullRest:false,native1024:false,hardwarePerformance:false,adapter:owner.adapterInfo}));
 }finally{if(scoped)await device.popErrorScope();if(submitted)await device.queue.onSubmittedWorkDone();for(const b of owned){try{b.unmap();}catch{}b.destroy();}owner.release();}
});
