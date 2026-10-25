'use strict';
// Independent assertion-only replay of the original coupled four-ball shot.
// The candidate receives only the created snapshot/journal and original move
// provenance. Native future states are read exclusively by comparison functions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {pathToFileURL}=require('node:url');
const POSTSLEEP=process.env.INITIAL_PAIR_AWAKE_POSTSLEEP==='1',FIXTURE=POSTSLEEP?'initial-pair-original-awake-postsleep-fixture.cjs':'initial-pair-original-awake-fixture.cjs',LIMIT=POSTSLEEP?924:922;
const C=require('./'+FIXTURE),F=require('./four-ball-created-fixture.cjs');
const E=require('./goal-four-world-seed.cjs'),Graph=require('./goal-four-broad-graph-seed.cjs');
// Reuse the established exact graph/scene/registry and numeric cache gates.
const Native=require('./four-ball-active-ccd-native-compare.cjs');
const copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
// Explicit cpu/gpu/both replay to original sleep h922, or h924 with POSTSLEEP=1.
// This bounded observation ends while the cue sphere moves; it is not a full shot.
const CHECKPOINTS=Object.freeze([439,440,441,921,922,...(POSTSLEEP?[923,924]:[])]);
const TOLERANCES=Object.freeze({frame:3e-6,pose:1e-6,velocityAndInertia:3e-6,cacheAndProxy:2e-6});
function close(a,b,label,stats,tolerance=TOLERANCES.frame){
 if(Array.isArray(b)){assert.equal(a?.length,b.length,label);b.forEach((v,i)=>close(a[i],v,label+'['+i+']',stats,tolerance));}
 else{const d=Math.abs(a-b);stats.maxAbsolute=Math.max(stats.maxAbsolute,d);assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&d<=tolerance,label+': '+a+' != '+b+' ('+d+')');}
}
function sourceHashes(){const root=path.resolve(__dirname,'..'),files=fs.readdirSync(path.join(root,'src')).filter(n=>n.startsWith('experimental-')&&n.endsWith('.js')).map(n=>'src/'+n);
 for(const n of['initial-pair-awake-world-replay.cjs',FIXTURE,'goal-four-world-seed.cjs','four-ball-active-ccd-native-compare.cjs','native-gpu-test-owner.cjs'])files.push('tests/'+n);
 return Object.fromEntries(files.map(p=>[p,F.hash(fs.readFileSync(path.join(root,p)))]));}
// Pass-through fault observation only. No solver arithmetic, input, result,
// contact selection or integration count is replaced. Throw after the actual
// final Scene preflight, before any public transaction can commit.
function instrument(){const file=require.resolve('../src/experimental-four-ball-world'),source=fs.readFileSync(file,'utf8'),base=Module.createRequire(file),m=new Module(file,module);m.filename=file;m.paths=module.paths;
 let armed=null,hits=0;
 function wrap(stage){const out={...stage};for(const method of['assertPrepared','assertOuterPrepared'])if(typeof stage[method]==='function')out[method]=function(...args){const result=Reflect.apply(stage[method],stage,args);if(armed){const error=armed;armed=null;hits++;error.observedPreflight=method;throw error;}return result;};return Object.freeze(out);}
 m.require=id=>{const actual=base(id);if(id!=='./experimental-scene-activation')return actual;const result={...actual};for(const name of['createReferenceStage','createGpuStage'])if(typeof actual[name]==='function')result[name]=(...args)=>{const value=actual[name](...args);return value?.then?value.then(wrap):wrap(value);};return result;};
 m._compile(source,file);return{World:m.exports,arm(h){assert.equal(armed,null);armed=Object.assign(Error('Injected coupled original checkpoint preflight failure h'+h),{injectedCoupledPreflight:true,h});return armed;},hits:()=>hits,assertDisarmed(){assert.equal(armed,null,'Fault must reach the actual final source preflight');}};
}
// This is a comparison projection, deliberately not the runtime seed exporter.
// Future rows remain candidateInput:false and are never relabeled as created.
function sourceSolverRoster(row){assert.equal(row.candidateInput,false);const s=row.state,np=s.narrow_phase,awake=s.islands.awake_island===null?[]:s.islands.islands.v[s.islands.awake_island].bodies;
 return{edges:Graph.graphView(row).edges,pairs:np.contact_graph.graph.edges.map(({weight:p},i)=>{assert.equal(p.contacts.variant,'Rigid');const c=p.contacts.value;return{hint:np.pair_solver_hints[i],solverColor:c.solver_color,solverColorBodies:copy(c.solver_color_bodies),manifolds:c.manifolds.map(m=>({activeContactCount:m.data.solver_contacts.length,solverFlags:m.data.solver_flags,solverColor:m.data.solver_color,solverBodyIds:copy(m.data.solver_body_ids),graphPos:m.data.graph_pos}))};}),
  bodySolverColorMasks:np.body_solver_color_masks.map(x=>{if(typeof x==='number')assert.ok(Number.isSafeInteger(x)&&x>=0,'Never round a source u128 mask');return BigInt(x).toString();}),
  buckets:copy(np.solver_contact_graph.buckets),solverGraphValid:np.solver_graph_valid,solverGraphEpoch:np.solver_graph_epoch,solverGraphMultibodyEpoch:np.solver_graph_mb_epoch,
  activeSetEpoch:s.islands.active_set_epoch,multibodyTopologyEpoch:s.multibody_joints.topology_epoch,
  awakeBodies:awake.map(body=>({body:copy(body),activeSetId:row.bodies.find(b=>same(b.handle,body)).ids.active_set_id}))};}
function compareRoster(out,row,seed){const own=out.solverContactRoster;assert.ok(own,'Public snapshot must expose the committed solverContactRoster');const expected=sourceSolverRoster(row);
 assert.equal(own.initialSnapshotSha256,seed.initialSnapshotSha256);assert.equal(own.sequence,out.contactGraph.sequence);assert.equal(own.revision,out.contactGraph.revision);
 for(const [name,value]of Object.entries(expected))assert.deepEqual(own[name],value,'h'+out.frame+'.solverContactRoster.'+name);
 assert.equal(own.buckets.length,130);return{fullSourceRoster:true,retainedPairs:expected.pairs.length,solverContacts:expected.buckets.reduce((n,b)=>n+b.length,0)};}
function checkpoint(out,row,frame,seed,passes,stats){assert.equal(row.candidateInput,false);const expected={h:frame.hCount,initialSnapshotSha256:seed.initialSnapshotSha256,row,application:frame,balls:frame.balls};
 const comparison=Native.compare(out,seed,expected,passes);
 // The generic initial-four helper omits these four fields, but the genuine
 // placed-goal initial exporter represents them. Check them here, unchanged.
 for(let i=0;i<4;i++){const ball=seed.balls[i],pair=row.contactPairs.find(p=>same(p.collider1,seed.pairSeed.floorCollider)&&same(p.collider2,ball.collider));assert.ok(pair);const native=Native.cache(pair),own=out.balls[i].state;
  for(const key of['solverColor','feature1','feature2'])if(key in native)assert.equal(own[key],native[key],'h'+out.frame+'.floor'+i+'.'+key);
  if('localN1'in native)close(own.localN1,native.localN1,'h'+out.frame+'.floor'+i+'.localN1',stats,TOLERANCES.cacheAndProxy);
 }
 const roster=compareRoster(out,row,seed);stats.checkpoints.push({...comparison,omittedUnrepresentedFields:[],...roster});stats.maxAbsolute=Math.max(stats.maxAbsolute,comparison.maxAbsoluteError);}
function compareFrame(out,frame,seed,record,stats){assert.equal(out.frame,frame.hCount);assert.equal(out.time,frame.time);assert.equal(out.lastStep.h,frame.h);assert.equal(out.outerStep,frame.outerStep);assert.equal(out.outerSubstep,frame.outerSubstep);assert.equal(out.sourceApplicationSteps,seed.sourceApplicationSteps+frame.outerStep);assert.equal(out.cue.present,frame.cuePresent);
 for(let i=0;i<4;i++){for(const k of['translation','rotation','linear','angular','invInertia'])close(out.balls[i].state[k],frame.balls[i][k],'h'+out.frame+'.ball'+i+'.'+k,stats);assert.equal(out.balls[i].state.sleeping,frame.balls[i].sleeping);}
 if(frame.cue)for(const role of['shaft','head'])for(const k of['translation','rotation','linear','angular'])close(out.cue.cue[role][k],frame.cue[role][k],'h'+out.frame+'.'+role+'.'+k,stats);
 const contacts=frame.events.filter(e=>e.kind==='contact');assert.equal(out.contactEvents.length,contacts.length);for(let i=0;i<contacts.length;i++){const a=out.contactEvents[i],b=contacts[i];for(const k of['kind','key','label','time','a','b'])assert.deepEqual(a[k]??null,b[k]??null,'h'+out.frame+'.event'+i+'.'+k);close([a.position.x,a.position.y,a.position.z],[b.position.x,b.position.y,b.position.z],'h'+out.frame+'.event'+i+'.position',stats,TOLERANCES.pose);}
 assert.deepEqual(out.game,record.status==='native-rest-complete'&&out.frame===record.frames.length?record.boundaries.controllerFinished.application.game:frame.game);stats.framesCompared++;}
function horizon(record){const n=Number(process.env.INITIAL_PAIR_AWAKE_HORIZON??LIMIT);assert.ok(n===LIMIT&&n===record.frames.length,'Replay the exact original bounded sleep/persistence horizon');return n;}
async function run(file,{device=null}={}){assert.equal(process.env.INITIAL_PAIR_AWAKE_SERIAL_SLOT,'1','Coordinator serial native/GPU slot required');const frozen=sourceHashes(),p=C.load(file),r=p.record,limit=horizon(r),backend=device?'actual-webgpu':'cpu-reference';
 const initial={goalStrikeCreated:r.boundaries.goalStrikeCreated,strikeCreationJournal:r.strikeCreationJournal};assert.deepEqual(Object.keys(initial).sort(),['goalStrikeCreated','strikeCreationJournal']);
 const seed=E.exportInitialSeed(initial,E.placementProvenanceFromRecord(r)),expectedRows=new Map(p.rows.filter(row=>row.boundary.endsWith('-postApplication')).map(row=>[row.hCount,row]));
 for(const h of CHECKPOINTS)assert.ok(expectedRows.has(h),'Original expected-only checkpoint h'+h);
 const firstH=r.boundaries['firstH.postApplication'];assert.ok(firstH);assert.equal(firstH.candidateInput,false);expectedRows.set(1,{...firstH,boundary:'expected-only-h1-postApplication'});
 // Optional full-shot terminal cache assertions decode only the stored original
 // snapshot. It is never used as a runtime seed, recurrence or numerical input.
 if(r.status==='native-rest-complete'&&limit===r.frames.length)expectedRows.set(limit,F.decodeBoundary({...r.boundaries.physicalRest,boundary:'expected-only-h'+limit+'-postApplication',candidateInput:false}));
 const probe=instrument(),own=device?await probe.World.createGpuStepper(device,seed):await probe.World.createReferenceStepper(seed),stats={backend,horizon:limit,framesCompared:0,maxAbsolute:0,internalPasses:0,checkpoints:[],rollbacks:0};
 assert.equal(own.capability.wholeWorld,false);assert.ok(seed.initialContactOrigin.retainedDynamicPairs.length>0);assert.equal(own.capability.initialRetainedDynamicContacts,true);assert.equal(own.capability.sourceObservedComponentSleep,true);assert.equal(own.capability.simultaneousDynamicPairs,true);assert.equal(own.capability.newDynamicContacts,'source-roster-owned-original-six-bindings');
 let prior=own.snapshot(),attemptedH=0,stepCommitted=false;const rollbackHs=new Set([1,...CHECKPOINTS]);
 try{await assert.rejects(()=>own.step({unexpectedArgument:true}),/injection/i);assert.deepEqual(own.snapshot(),prior,'Argument rejection leaves public snapshot untouched');
  for(const frame of r.frames.slice(0,limit)){attemptedH=frame.hCount;prior=own.snapshot();stepCommitted=false;
   if(rollbackHs.has(attemptedH)){const injected=probe.arm(attemptedH),beforeHits=probe.hits();await assert.rejects(()=>own.step(),e=>e===injected&&e.injectedCoupledPreflight===true);
    probe.assertDisarmed();assert.equal(probe.hits(),beforeHits+1);assert.deepEqual(own.snapshot(),prior,'h'+attemptedH+' final-preflight failure rolls back every public field, including solver roster');stats.rollbacks++;}
   let out;try{out=await own.step();stepCommitted=true;}catch(error){assert.deepEqual(own.snapshot(),prior,'Real failed owner step cannot commit any public state');throw error;}
   compareFrame(out,frame,seed,r,stats);stats.internalPasses+=out.lastStep.ccd?.sourceInternalPasses.length??1;assert.equal(out.contactGraph.sequence,stats.internalPasses);
   if(expectedRows.has(out.frame))checkpoint(out,expectedRows.get(out.frame),r.status==='native-rest-complete'&&out.frame===r.frames.length?{...frame,game:r.boundaries.controllerFinished.application.game}:frame,seed,stats.internalPasses,stats);
   if(out.frame%128===0||CHECKPOINTS.includes(out.frame))console.error(JSON.stringify({backend,h:out.frame,framesCompared:stats.framesCompared,maxAbsolute:stats.maxAbsolute,checkpoints:stats.checkpoints.length,rollbacks:stats.rollbacks}));
  }
  const state=own.snapshot(),full=r.status==='native-rest-complete'&&limit===r.frames.length;assert.equal(stats.framesCompared,limit);assert.deepEqual(stats.checkpoints.filter(x=>CHECKPOINTS.includes(x.h)).map(x=>x.h),CHECKPOINTS);
  assert.equal(stats.rollbacks,1+CHECKPOINTS.length);assert.equal(state.shotComplete,false);assert.ok(state.balls[2].state.sleeping&&state.balls[3].state.sleeping);assert.equal(state.balls[0].state.sleeping,false);assert.ok(state.pairs.some(p=>p.key==='23'&&p.pair.active),'Original active red-pair cache must survive natural island sleep');
  if(full){assert.equal(r.status,'native-rest-complete');assert.equal(state.shotComplete,true);assert.equal(state.scene.manager.awake_island,null);assert.ok(state.balls.every(b=>b.state.sleeping));assert.deepEqual(state.scoreResult,r.score);assert.deepEqual(state.game,r.boundaries.controllerFinished.application.game);
   assert.deepEqual(await own.step(),state,'First completed step cannot change score/state');assert.deepEqual(await own.step(),state,'Repeated completed step cannot change score/state');assert.deepEqual(own.snapshot(),state);}
  const result={schema:'initial-pair-awake-world-replay-v1',status:'native-coupled-sleep-h'+limit+'-matched',fullShot:full,initialSnapshotSha256:seed.initialSnapshotSha256,originalArtifactSha256:p.manifest.sha256,tolerances:TOLERANCES,...stats};console.log(JSON.stringify(result));return{result,state};
 }catch(error){console.error(JSON.stringify({status:stepCommitted?'comparison-failed':'owner-step-failed',backend,attemptedH,lastVerifiedH:stats.framesCompared,stepCommitted,error:error.message,boundary:error.boundary??null}));throw error;}
 finally{try{own.dispose();}finally{assert.deepEqual(sourceHashes(),frozen,'Loaded candidate and assertion sources stayed frozen for this run');}}
}
async function main(file){const backend=process.env.INITIAL_PAIR_AWAKE_BACKEND??'cpu';assert.ok(['cpu','gpu','both'].includes(backend),'Explicit cpu, gpu or both backend required');let cpu,gpuResult;if(backend!=='gpu')cpu=await run(file);
 if(backend!=='cpu'){assert.ok(process.env.GPU_NATIVE_MODULE&&path.isAbsolute(process.env.GPU_NATIVE_MODULE),'Explicit actual native WebGPU module required; no CPU fallback');
  const{create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter,'Actual Vulkan WebGPU adapter required');console.error(JSON.stringify({backend:'actual-webgpu',adapter:Object.fromEntries(['vendor','architecture','device','description','isFallbackAdapter'].map(k=>[k,adapter.info?.[k]??null])),hardwarePerformanceClaim:false}));const device=await adapter.requestDevice(),release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'coupled-four-original-replay');
  try{gpuResult=await run(file,{device});if(cpu){assert.deepEqual(gpuResult.state.scene,cpu.state.scene,'CPU/WGSL final scene');assert.deepEqual(gpuResult.state.globalEdges,cpu.state.globalEdges,'CPU/WGSL final graph');assert.deepEqual(gpuResult.state.game,cpu.state.game,'CPU/WGSL final game');
    const withoutBackend=r=>{const{backend,...rest}=r;return rest;};assert.deepEqual(withoutBackend(gpuResult.state.solverContactRoster),withoutBackend(cpu.state.solverContactRoster),'CPU/WGSL exact solver roster');}}
  finally{release();}}
 return{cpu:cpu?.result,gpu:gpuResult?.result};}
module.exports={CHECKPOINTS,TOLERANCES,instrument,sourceSolverRoster,compareRoster,checkpoint,run,main};
if(require.main===module)main(process.argv[2]??process.env.INITIAL_PAIR_AWAKE_REPLAY).catch(e=>{console.error(e.stack);process.exitCode=1;});
