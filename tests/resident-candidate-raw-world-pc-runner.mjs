// Test-only reusable raw gate. The only initial authority accepted here is an
// authenticated common initialization plan plus raw parameter rows. No created
// candidate state, expected snapshot, or host physics result is an input.
import assert from 'node:assert/strict';
import {buildWorldInitializationCommands,packWorldInitializationRows} from '../src/resident-candidate/world-initialization.mjs';
import {generateWorldHPlan} from '../src/resident-candidate/world-h.mjs';
import {compileWorldDevicePc} from '../src/resident-candidate/world-device-pc.mjs';
import {NUMERIC_PROFILE} from '../src/resident-candidate/numeric-profile.mjs';
import {createRetainedNativePipelineCache,createOwnedNativeTestRun,nativeCacheDelta} from './resident-candidate-native-session.mjs';
export const RAW_PC_SAFE_TRANSPORTS=Object.freeze({coupledTransport:'micro',cueTransport:'flat',applicationTransport:'staged',ccdTransport:'staged',queryTransport:'staged'});
const bounded=(n,label,max=0xffffffff)=>assert.ok(Number.isSafeInteger(n)&&n>=1&&n<=max,label+' must be explicit positive bounded work');
export function createRawWorldPcPlan({initializationPlan,rows,frames=2,sweeps=512,numericProfile=NUMERIC_PROFILE.PRESERVED_F32,sourceMode='phases',...transports}){
 bounded(frames,'h request');bounded(sweeps,'Fixed transport',65536);
 const template=initializationPlan.template,count=rows.length,init=buildWorldInitializationCommands(initializationPlan,count),source=generateWorldHPlan(template,{count,numericProfile,...RAW_PC_SAFE_TRANSPORTS,...transports});
 const phasePc=compileWorldDevicePc(source,{programBase:template.program.length,controlTailBase:init.resources.worldState,maxH:frames});
 assert.ok(sourceMode==='phases'||sourceMode&&typeof sourceMode.name==='string'&&typeof sourceMode.compile==='function','Explicit phase or owner-router source compiler required');
 const pc=sourceMode==='phases'?phasePc:sourceMode.compile(phasePc,source);
 for(const key of['count','stateWords','scratchWords','programBase','controlTailBase','controlWords','maxH'])assert.equal(pc[key],phasePc[key],'Source-mode immutable '+key);
 assert.deepEqual(pc.bytecode,phasePc.bytecode,'Original PC schedule is sole authority');assert.deepEqual(pc.bindingTypes,phasePc.bindingTypes);assert.ok(pc.totalStateWords>=phasePc.totalStateWords&&Number.isSafeInteger(pc.totalStateWords));assert.ok(pc.pipelines.length&&pc.sweep.length);for(const id of pc.sweep)assert.ok(Number.isSafeInteger(id)&&id>=0&&id<pc.pipelines.length);
 const program=new Uint32Array(template.program.length+pc.bytecode.length);program.set(template.program);program.set(pc.bytecode,pc.programBase);
 return Object.freeze({template,count,init,source,phasePc,pc,program,input:packWorldInitializationRows(initializationPlan,rows),frames,sweeps,sourceMode:sourceMode==='phases'?'phases':sourceMode.name,dispatches:init.dispatches+1+pc.sweep.length*sweeps});
}
/** Fixed device-only completed-request handoff. An unfinished/failed request
 * remains untouched and therefore fails the later exact checkpoint gate. */
export function completedRawPcRequestWGSL(pc){
 const signature='@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>)';assert.ok(pc.begin.code.includes(signature));
 return pc.begin.code.replace(signature,'fn rc_pc_test_begin(gid:vec3<u32>)')+`\n@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=${pc.count}u){return;}let bank=gid.x*${pc.stateWords}u;let cb=${pc.controlTailBase}u+gid.x*${pc.controlWords}u;if(rc_state[cb+4u]!=2u){return;}if(rc_state[bank+5u]!=rc_state[cb+5u]+rc_state[cb+7u]){rc_pc_fail(cb,1u);return;}rc_pc_test_begin(gid);}`;
}
export async function createRawWorldPcRunner({owner,cache=createRetainedNativePipelineCache(owner),plan,maxCheckpoints=1,trace=()=>{}}){
 const {template,init,pc,count}=plan,device=owner.device,before=cache.stats(),arena=createOwnedNativeTestRun(owner,cache,{label:'raw source retained device-PC',maxCheckpoints,trace});let scoped=true,initialized=false,finished=false;
 device.pushErrorScope('validation');
 try{
  arena.create('scratch',init.scratchAlias.words);
  for(const[name,initial]of Object.entries(init.resources)){
   if(name==='rawScratch'||name==='numericScratch'){arena.alias(name,'scratch');continue;}
   const value=name==='worldState'?pc.totalStateWords:name==='worldProgram'?plan.program:initial;arena.create(name,typeof value==='number'?value:value.length,{...(value instanceof Uint32Array?{input:value}:{})});
  }
  arena.create('worldGeometry',template.sharedGeometry.length,{input:template.sharedGeometry});arena.writeInitial('inputs',0,plan.input);for(const upload of init.initialUploads)arena.writeInitial(upload.resource,upload.offsetWords,upload.data);
  const initial={},world=[],compilationGroups={},executionGroups=[],names=['worldState','worldProgram','worldGeometry','scratch','inputs'],bind=p=>arena.stage({...p,bindingTypes:pc.bindingTypes},names,count);let begin;
  const compileGroup=async(name,compile)=>{const start=cache.stats();await compile();compilationGroups[name]=nativeCacheDelta(cache.stats(),start);trace({stage:'compile-group-ready',group:name,cache:compilationGroups[name]});};
  const compileInitial=()=>compileGroup('initializer',async()=>{for(const[name,stage]of Object.entries(init.stages))initial[name]=await arena.stage({...stage,name:'initialize '+name},stage.resources,stage.workgroups);});
  const compileRuntime=()=>compileGroup(plan.sourceMode,async()=>{begin=await bind(pc.begin);for(const p of pc.pipelines)world.push(await bind(p));});
  // Compiler order only: expose new merged owner boundaries before spending
  // time recompiling raw initialization. Dispatch remains initializer FIRST.
  if(plan.sourceMode==='phases'){await compileInitial();await compileRuntime();}else{await compileRuntime();await compileInitial();}arena.seal();
  const executeGroup=async(name,execute)=>{const start=arena.stats(),at=performance.now();await execute();const row={name,wallMs:performance.now()-at,...nativeCacheDelta(arena.stats(),start)};executionGroups.push(row);trace({stage:'execution-group-ready',...row,timingKind:'host-wall-not-gpu-timestamp'});};
  const stats=()=>({...arena.stats(),cache:nativeCacheDelta(cache.stats(),before),compilationGroups:structuredClone(compilationGroups),executionGroups:structuredClone(executionGroups),sourceMode:plan.sourceMode});
  return Object.freeze({plan,cache,stats,
   async initialize(){assert.equal(initialized,false,'Independent runs require fresh initial-only allocations');assert.equal(finished,false);initialized=true;await executeGroup('initialize',()=>arena.dispatch((function*(){for(const command of init.commands)for(let i=0;i<command.repeat;i++)yield initial[command.stage];yield begin;})()));},
   async pump(sweeps=plan.sweeps){bounded(sweeps,'Fixed transport',65536);assert.equal(initialized,true);assert.equal(finished,false);await executeGroup('pump',()=>arena.dispatch((function*(){for(let i=0;i<sweeps;i++)for(const id of pc.sweep)yield world[id];})()));},
   async request(frames){bounded(frames,'h request');assert.equal(initialized,true);assert.equal(finished,false);const next=compileWorldDevicePc(plan.source,{programBase:pc.programBase,controlTailBase:pc.controlTailBase,maxH:frames});assert.deepEqual(next.bytecode,pc.bytecode);const resume=await bind({name:'device-only completed request '+frames,code:completedRawPcRequestWGSL(next)});await arena.dispatch([resume]);},
   async capture(name){assert.equal(initialized,true);assert.equal(finished,false);await arena.capture(name,'worldState');},
   async finish(){assert.equal(finished,false);finished=true;const checkpoints=await arena.finish(),validation=await device.popErrorScope();scoped=false;assert.equal(validation,null,'retained raw device-PC validation');return{checkpoints,stats:stats()};},
   async dispose(){if(scoped){await device.popErrorScope();scoped=false;}await arena.dispose();}
  });
 }catch(error){if(scoped){await device.popErrorScope();scoped=false;}await arena.dispose();throw error;}
}
export async function runRawWorldPc({owner,cache,plan,trace=()=>{}}){
 const runner=await createRawWorldPcRunner({owner,cache,plan,trace});try{await runner.initialize();await runner.pump();await runner.capture('h'+plan.frames);const result=await runner.finish();assert.equal(result.stats.dispatches,plan.dispatches);return{words:result.checkpoints[0].words,stats:result.stats};}finally{await runner.dispose();}
}
