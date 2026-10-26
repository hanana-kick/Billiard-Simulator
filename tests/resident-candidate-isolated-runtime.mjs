// TEST ONLY pure runtime handoff. This module imports no source generator,
// Rapier, importer, oracle, expected snapshot or world comparator.
import assert from 'node:assert/strict';
import {createRetainedNativePipelineCache,createOwnedNativeTestRun,nativeCacheDelta} from './resident-candidate-native-session.mjs';
export const ISOLATED_RAW_PC_KIND='resident-raw-pc-initial-only-runtime-v1';
export const ISOLATED_RAW_PC_RECURRENCE_KIND='resident-raw-pc-recurrence-initial-only-runtime-v1';
const pick=(x,keys)=>Object.fromEntries(keys.map(k=>[k,x[k]]));
/** Called only by the source preparation process. Every shader, original PC
 * instruction, original guard and scheduled owner visit is retained verbatim. */
export function serializeRawPcRuntime(g,identity){return serializeRawPc(g,identity,ISOLATED_RAW_PC_KIND,2);}
export function serializeRawPcRecurrenceRuntime(g,identity){return serializeRawPc(g,identity,ISOLATED_RAW_PC_RECURRENCE_KIND,8);}
function serializeRawPc(g,identity,kind,frames){
 const pc=pick(g.pc,['kind','count','stateWords','scratchWords','programBase','controlTailBase','controlWords','totalStateWords','maxH','bytecode','instructions','begin','pipelines','sweep','bindingTypes','controlVisitPolicy','controlPartition','requestTailBase','requestWordsPerCandidate']);
 const plan={kind,identity,count:g.count,frames:g.frames,sweeps:g.sweeps,sourceMode:g.sourceMode,dispatches:g.dispatches,transport:g.source.transport,init:g.init,pc,program:g.program,input:g.input,sharedGeometry:g.template.sharedGeometry};
 assertSerializedRawPc(plan,kind,frames);return plan;
}
export function assertSerializedRawPcRuntime(p){return assertSerializedRawPc(p,ISOLATED_RAW_PC_KIND,2);}
export function assertSerializedRawPcRecurrenceRuntime(p){return assertSerializedRawPc(p,ISOLATED_RAW_PC_RECURRENCE_KIND,8);}
function assertSerializedRawPc(p,kind,frames){
 assert.equal(p?.kind,kind);assert.deepEqual(Object.keys(p).sort(),['kind','identity','count','frames','sweeps','sourceMode','dispatches','transport','init','pc','program','input','sharedGeometry'].sort());
 const inspect=(x,path)=>{if(x===null||typeof x!=='object'){assert.notEqual(typeof x,'function',path+' serializable data only');return;}if(x instanceof Uint32Array)return;assert.ok(Array.isArray(x)||Object.getPrototypeOf(x)===Object.prototype,path+' plain runtime records only');for(const[k,v]of Object.entries(x)){if(k==='finalGatherIncluded'&&/^transport\.flatApplicationCapacity\.(post|outer)$/.test(path))assert.equal(typeof v,'boolean','source instruction-bound metadata');else assert.doesNotMatch(k,/seed|final|expected|snapshot|scoring|results|future/i,path+' cannot retain source future data');inspect(v,path+'.'+k);}};
 for(const[k,v]of Object.entries(p))if(k!=='identity')inspect(v,k);
 assert.deepEqual(Object.keys(p.identity).sort(),['sourceHead','sourceHashes','sourceArtifactSha256','preStrikeIdentity','sourceIdentity','rawRows','rawInputSha256','programSha256','sharedGeometrySha256','rule','frames','count','options','sourceCaps','pipelineIdentity','generationIdentity'].sort());
 for(const[k,v]of Object.entries(p.identity))if(k==='sourceHashes'){for(const digest of Object.values(v))assert.match(digest,/^[0-9a-f]{64}$/);}else inspect(v,'identity.'+k);
 assert.equal(p.identity.rawRows.length,6);for(const row of p.identity.rawRows){assert.deepEqual(Object.keys(row).sort(),['id','settings']);assert.deepEqual(Object.keys(row.settings).sort(),['angle','elevation','speed','tipX','tipY'].sort());for(const n of Object.values(row.settings))assert.equal(typeof n,'number');}
 const resourceNames=['inputs','rawState','rawProgram','rawGeometry','rawScratch','worldState','worldTemplate','worldProgram','numericScratch'];assert.deepEqual(Object.keys(p.init.resources).sort(),resourceNames.sort(),'only documented initial runtime resources');
 for(const key of['inputs','rawState','rawScratch','worldState','numericScratch'])assert.ok(Number.isSafeInteger(p.init.resources[key])&&p.init.resources[key]>0,key+' numeric fresh allocation size');
 for(const key of['rawProgram','rawGeometry','worldTemplate','worldProgram'])assert.ok(p.init.resources[key] instanceof Uint32Array,key+' authenticated immutable initial words');
 for(const descriptor of Object.values(p.init.stages))for(const name of descriptor.resources)assert.ok(resourceNames.includes(name),'known initialization binding resource');
 assert.equal(p.count,6,'same six original raw rows');assert.equal(p.frames,frames,frames===2?'same strict two-h gate':'explicit baked eight-h recurrence gate');assert.ok(Number.isSafeInteger(p.sweeps)&&p.sweeps>0&&p.sweeps<=65536);assert.equal(p.sourceMode,'owners');assert.equal(p.pc.count,p.count);assert.equal(p.pc.maxH,p.frames);assert.equal(p.pc.controlPartition,'source-closures-v1');assert.equal(p.pc.controlVisitPolicy,'single-call');
 assert.ok(p.program instanceof Uint32Array&&p.input instanceof Uint32Array&&p.sharedGeometry instanceof Uint32Array);assert.equal(p.input.length,p.count*16);assert.equal(p.pc.controlTailBase,p.init.resources.worldState);assert.equal(p.pc.controlWords,80);assert.equal(p.pc.totalStateWords,p.pc.controlTailBase+p.count*(80+24));assert.deepEqual(p.program.slice(p.pc.programBase),p.pc.bytecode);assert.deepEqual(p.program.slice(0,p.pc.programBase),p.init.resources.worldProgram);
 assert.equal(p.init.commands.at(-1).stage,'creation-finish');assert.equal(p.init.hostReadbacksBeforeH,0);assert.equal(p.init.dispatches,p.init.commands.reduce((n,c)=>n+c.repeat,0));assert.equal(p.dispatches,p.init.dispatches+1+p.pc.sweep.length*p.sweeps);
 assert.equal(p.init.initialUploads.length,1);assert.equal(p.init.initialUploads[0].resource,'worldState');assert.equal(p.init.initialUploads[0].offsetWords,p.count*p.pc.stateWords);
 assert.ok(p.pc.pipelines.length&&p.pc.sweep.length);for(const id of p.pc.sweep)assert.ok(Number.isSafeInteger(id)&&id>=0&&id<p.pc.pipelines.length);
 for(const p0 of[p.pc.begin,...p.pc.pipelines,...Object.values(p.init.stages)])assert.equal(typeof p0.code,'string');
 assert.ok(p.pc.pipelines.every(x=>x.receiptPolicy===undefined||x.receiptPolicy==='guarded'),'same guarded source owner receipts');
 if(kind===ISOLATED_RAW_PC_RECURRENCE_KIND){assert.equal(p.identity.frames,8);assert.equal(p.identity.count,6);assert.deepEqual(p.pc.begin.code.match(/rc_state\[cb\+6u\]=\d+u;/g),['rc_state[cb+6u]=8u;'],'source PC requestedH must be baked as eight before initialization');}
 assert.equal(p.identity.rawInputSha256.length,64);assert.equal(p.identity.generationIdentity.length,64);return p;
}
/** The same retained cache/arena as the original gate, but no runtime plan
 * generation or request compiler is imported. Fresh buffers on every run.
 * Initializer FIRST, then one begin plus the exact immutable owner sweep.
 * This fixed two-h harness intentionally has no request() continuation API. */
export async function runSerializedRawPc({owner,cache=createRetainedNativePipelineCache(owner),plan,trace=()=>{}}){
 assertSerializedRawPcRuntime(plan);const {init,pc,count}=plan,device=owner.device,before=cache.stats(),arena=createOwnedNativeTestRun(owner,cache,{label:'isolated raw source retained device-PC',maxCheckpoints:1,trace});let scoped=true;
 device.pushErrorScope('validation');
 try{
  await cache.validateAll([{...pc.begin,bindingTypes:pc.bindingTypes},...pc.pipelines.map(p=>({...p,bindingTypes:pc.bindingTypes})),...Object.entries(init.stages).map(([name,p])=>({...p,name:'initialize '+name}))]);
  arena.create('scratch',init.scratchAlias.words);
  for(const[name,initial]of Object.entries(init.resources)){if(name==='rawScratch'||name==='numericScratch'){arena.alias(name,'scratch');continue;}const value=name==='worldState'?pc.totalStateWords:name==='worldProgram'?plan.program:initial;arena.create(name,typeof value==='number'?value:value.length,{...(value instanceof Uint32Array?{input:value}:{})});}
  arena.create('worldGeometry',plan.sharedGeometry.length,{input:plan.sharedGeometry});arena.writeInitial('inputs',0,plan.input);for(const u of init.initialUploads)arena.writeInitial(u.resource,u.offsetWords,u.data);
  const initial={},world=[],compilationGroups={},executionGroups=[],names=['worldState','worldProgram','worldGeometry','scratch','inputs'],bind=p=>arena.stage({...p,bindingTypes:pc.bindingTypes},names,count);let begin;
  const compileGroup=async(name,fn)=>{const start=cache.stats();await fn();compilationGroups[name]=nativeCacheDelta(cache.stats(),start);trace({stage:'compile-group-ready',group:name,cache:compilationGroups[name]});};
  // Same owners-first COMPILE order as the existing owners-mode runner. This
  // never changes the initializer-first EXECUTION order or source schedule.
  await compileGroup(plan.sourceMode,async()=>{begin=await bind(pc.begin);for(const p of pc.pipelines)world.push(await bind(p));});
  await compileGroup('initializer',async()=>{for(const[name,p]of Object.entries(init.stages))initial[name]=await arena.stage({...p,name:'initialize '+name},p.resources,p.workgroups);});arena.seal();
  const executeGroup=async(name,fn)=>{const start=arena.stats(),at=performance.now();await fn();const row={name,wallMs:performance.now()-at,...nativeCacheDelta(arena.stats(),start)};executionGroups.push(row);trace({stage:'execution-group-ready',...row,timingKind:'host-wall-not-gpu-timestamp'});};
  await executeGroup('initialize',()=>arena.dispatch((function*(){for(const c of init.commands)for(let i=0;i<c.repeat;i++)yield initial[c.stage];yield begin;})()));
  await executeGroup('pump',()=>arena.dispatch((function*(){for(let i=0;i<plan.sweeps;i++)for(const id of pc.sweep)yield world[id];})()));
  await arena.capture('h'+plan.frames,'worldState');const checkpoints=await arena.finish(),validation=await device.popErrorScope();scoped=false;assert.equal(validation,null,'isolated retained raw device-PC validation');
  const stats={...arena.stats(),cache:nativeCacheDelta(cache.stats(),before),compilationGroups,executionGroups,sourceMode:plan.sourceMode};assert.equal(stats.dispatches,plan.dispatches);return{words:checkpoints[0].words,stats};
 }finally{if(scoped)await device.popErrorScope();await arena.dispose();}
}
