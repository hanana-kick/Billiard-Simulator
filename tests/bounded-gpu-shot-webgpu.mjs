// Actual software Dawn/WGSL integration, opt-in. No fake device or CPU fallback.
// The sole candidate input is the fresh live-browser collector download.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {hash,loadLiveInput,forbidNativeContinuation} from './bounded-gpu-shot-source.mjs';
import {loadExpectedShards} from './bounded-gpu-shot-shards.mjs';
import {createBoundedFourBallShotService} from '../src/bounded-gpu-shot/four-ball.mjs';
const require=createRequire(import.meta.url),Graph=require('./four-ball-broad-graph-seed.cjs'),ROOT=path.resolve(import.meta.dirname,'..');
const same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
function near(a,b,tol,label,stats){
  if(Array.isArray(b)){assert.equal(a?.length,b.length,label);b.forEach((v,i)=>near(a[i],v,tol,label+'['+i+']',stats));return;}
  const e=Math.abs(a-b);stats.maxAbsolute=Math.max(stats.maxAbsolute,e);assert.ok(Number.isFinite(a)&&e<=tol,label+': '+a+' != '+b+' ('+e+')');
}
function cache(pair){if(!pair)return{pairPresent:0,pointPresent:0,active:0,recycleValid:0};assert.equal(pair.contacts.variant,'Rigid');const r=pair.contacts.value,m=r.manifolds[0],p=m?.points[0],sc=m?.data.solver_contacts[0],c={pairPresent:1,pointPresent:+!!p,active:+!!sc,recycleValid:+!!r.recycle_state,solverColor:r.solver_color};if(p){const d=p.data;Object.assign(c,{localP1:p.local_p1,localP2:p.local_p2,localN2:m.local_n2,contactDistance:p.dist,dp1:d.solver_dp1,dp2:d.solver_dp2,impulse:d.impulse,warmImpulse:d.warmstart_impulse,tangentImpulse:d.tangent_impulse,warmTangent:d.warmstart_tangent_impulse,warmWorld:d.warmstart_tangent_world});}if(sc)Object.assign(c,{normal:m.data.normal,anchor1:sc.anchor1,anchor2:sc.anchor2,contactId:sc.contact_id[0]});if(r.recycle_state)Object.assign(c,{recycleTranslation:r.recycle_state.pos12.translation,recycleRotation:r.recycle_state.pos12.rotation,maxExtent:r.recycle_state.max_extent,maxDrift:r.recycle_state.max_drift});return c;}
function compareCache(own,want,label,stats,{floor=false,pair=false}={}){for(const[k,v]of Object.entries(want)){if(k==='solverColor'&&floor||k==='recycleRotation'&&pair)continue;const a=['pairPresent','pointPresent','active','recycleValid'].includes(k)&&floor?+own.topology[k]:own[k];if(['pairPresent','pointPresent','active','recycleValid','solverColor','contactId'].includes(k))assert.equal(a,v,label+'.'+k);else near(a,v,2e-6,label+'.'+k,stats);}}
function checkpoint(out,row,capture,stats){
  assert.deepEqual(out.scene.manager,row.state.islands);assert.deepEqual(out.scene.modifiedBodies,row.queues.modifiedBodies);
  const graph=Graph.graphView(row);assert.deepEqual(out.globalEdges,graph.edges);assert.deepEqual(out.contactGraph.adjacency,graph.adjacency);
  for(const b of row.bodies){const a=out.scene.bodies.find(x=>same(x.handle,b.handle));assert.ok(a);assert.deepEqual(a.ids,b.ids);assert.equal(a.changes,b.changes);if(b.body_type==='Dynamic'){for(const k of['normalized_linear_threshold','angular_threshold','time_until_sleep','time_since_can_sleep','sleeping'])assert.equal(a.activation[k],b.activation[k]);for(const k of['translation','rotation'])near(a.activation.sleep_prev_pose[k],b.activation.sleep_prev_pose[k],2e-6,'History'+b.handle.index,stats);}}
  const registry=capture.application.registry,floor=registry.statics.find(x=>x.kind==='cloth'),rails=registry.statics.filter(x=>x.kind==='cushion');
  for(let i=0;i<4;i++){const ball=registry.objects[i],s=out.balls[i].state;compareCache(s,cache(row.contactPairs.find(p=>same(p.collider1,floor.collider)&&same(p.collider2,ball.collider))),'Cloth'+i,stats,{floor:true});const p=row.proxies.find(p=>p.index===ball.collider.index);assert.deepEqual(s.topology.ballMin,p.min);assert.deepEqual(s.topology.ballMax,p.max);for(let j=0;j<4;j++)compareCache(out.cushions[i][j],cache(row.contactPairs.find(p=>same(p.collider1,rails[j].collider)&&same(p.collider2,ball.collider))),'Cushion'+i+':'+j,stats);}
  for(const binding of out.pairs){const[a,b]=binding.ballIndices.map(i=>registry.objects[i].pairCollider);compareCache(binding.pair,cache(row.contactPairs.find(p=>same(p.collider1,a)&&same(p.collider2,b))),'Pair'+binding.key,stats,{pair:true});}
  stats.checkpoints++;
}
function compareFrame(out,want,stats){
  assert.equal(out.frame,want.hCount);assert.equal(out.time,want.time);assert.equal(out.lastStep.h,want.h);
  assert.equal(out.outerStep,want.outerStep);assert.equal(out.outerSubstep,want.outerSubstep);assert.equal(out.cue.present,want.cuePresent);
  assert.equal(out.contactGraph.sequence,out.frame);assert.equal(out.contactGraph.liveColliders.length,out.cue.present?27:24);
  for(let i=0;i<4;i++){const a=out.balls[i].state,b=want.balls[i];for(const k of['translation','rotation','linear','angular','invInertia'])near(a[k],b[k],['translation','rotation'].includes(k)?1e-6:3e-6,'h'+out.frame+'.ball'+i+'.'+k,stats);assert.equal(a.sleeping,b.sleeping);}
  if(want.cue)for(const role of['shaft','head'])for(const k of['translation','rotation','linear','angular'])near(out.cue.cue[role][k],want.cue[role][k],3e-6,'h'+out.frame+'.cue.'+role+'.'+k,stats);
  const events=want.events.filter(e=>e.kind==='contact');assert.equal(out.contactEvents.length,events.length);
  for(let i=0;i<events.length;i++){const a=out.contactEvents[i],b=events[i];for(const k of['kind','key','label','time'])assert.equal(a[k]??null,b[k]??null);for(const k of['a','b'])assert.deepEqual(a[k]??null,b[k]??null);near([a.position.x,a.position.y,a.position.z],[b.position.x,b.position.y,b.position.z],1e-6,'Event'+i,stats);}
  assert.deepEqual(out.game,want.game,'Original scoring is not finalized early');stats.hCompared++;
}

test('real software Dawn service resumes fresh browser input through source physical rest',
 {skip:process.env.REQUIRE_WEBGPU!=='1',timeout:1200000},async()=>{
  assert.ok(process.env.GPU_NATIVE_MODULE,'GPU_NATIVE_MODULE must identify installed official webgpu package');
  const restore=forbidNativeContinuation();let device,service,sentinel;
  const files=['src/bounded-gpu-shot/four-ball.mjs','src/bounded-gpu-shot/lifecycle.mjs','src/bounded-gpu-shot/resources.mjs',
    'tests/bounded-gpu-shot-webgpu.mjs','tests/bounded-gpu-shot-source.mjs','tests/bounded-gpu-shot-shards.mjs','tests/prepare-bounded-gpu-shot-oracle.mjs'];
  const hashes=Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync(path.join(ROOT,file)))]));
  try{
    const live=await loadLiveInput(),oracle=await loadExpectedShards();
    assert.equal(hash(live.input.snapshot),oracle.initialSnapshotSha256);
    const testedCommitSha=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
    assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:ROOT,encoding:'utf8'}).trim(),'','Freeze tracked source before actual GPU validation');
    const expectedOracleSha256=oracle.originalSha256;
    console.log(JSON.stringify({validationStart:true,testedCommitSha,liveArtifactSha256:live.liveArtifactSha256,
      initialSnapshotSha256:oracle.initialSnapshotSha256,expectedOracleSha256,expectedShardsManifestSha256:oracle.manifestSha256,sourceOnlyCandidateInput:true,
      expectedH:oracle.hCount,smokeH:Number(process.env.SERVICE_SMOKE_H??0),serviceSourceHashes:hashes,memory:process.memoryUsage(),processMaxRSSKiB:process.resourceUsage().maxRSS}));
    const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
    const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter,'Real Dawn Vulkan adapter required');
    device=await adapter.requestDevice();assert.ok(device instanceof GPUDevice);
    const errors=[];device.addEventListener('uncapturederror',event=>errors.push(String(event.error?.message)));
    sentinel=device.createBuffer({size:4,usage:9});device.queue.writeBuffer(sentinel,0,new Uint32Array([0x51afe]));
    service=createBoundedFourBallShotService({device,decoder:live.decoder,
      scheduling:{yieldControl:()=>new Promise(resolve=>setImmediate(resolve)),renderingBusy:()=>false}});
    assert.throws(()=>createBoundedFourBallShotService({device,decoder:live.decoder}),/already belongs/);
    const operation=service.start(live.input,{budget:{maxSteps:1,maxWallMs:30000}}),stats={maxAbsolute:0,hCompared:0,checkpoints:0,slices:0};
    // Expected states are never passed to service.start/resume or any initializer.
    let result=await operation.result,lastCompared=0;
    const smoke=Number(process.env.SERVICE_SMOKE_H??0),started=performance.now();
    assert.ok(Number.isSafeInteger(smoke)&&smoke>=0&&smoke<=oracle.hCount);
    while(true){
      stats.slices++;
      assert.ok(['budget-suspended','complete'].includes(result.status),JSON.stringify({status:result.status,phase:result.phase,reason:result.reason,error:result.error,progress:result.progress,resources:result.resources,memory:process.memoryUsage(),gpuErrors:errors}));
      const out=result.state;
      if(out?.frame>lastCompared){
        assert.equal(out.frame,lastCompared+1);assert.ok(out.frame<=oracle.hCount,'Never silently run past original expected physical rest');
        compareFrame(out,oracle.frame(out.frame-1),stats);lastCompared=out.frame;
        if(out.outerSubstep===0&&oracle.hasCheckpoint(out.outerStep))checkpoint(out,oracle.checkpoint(out.outerStep),live.input.capture,stats);
        if(out.frame===1||out.frame%500===0)console.log(JSON.stringify({progressH:out.frame,outerStep:out.outerStep,wallMs:performance.now()-started,memory:process.memoryUsage(),resources:result.resources,gpuErrors:errors,processMaxRSSKiB:process.resourceUsage().maxRSS,...stats}));
      }
      if(smoke&&lastCompared===smoke){assert.equal(result.status,'budget-suspended');result=await operation.cancel();assert.equal(result.status,'cancelled');break;}
      if(result.status==='complete')break;
      assert.equal(result.completed,false);assert.equal(result.scoring.result,null);
      result=await operation.resume({budget:{maxSteps:1,maxWallMs:30000}});
    }
    if(!smoke){assert.equal(result.status,'complete');assert.equal(result.completed,true);assert.equal(stats.hCompared,oracle.hCount);
      assert.equal(stats.checkpoints,oracle.checkpointCount);assert.equal(result.state.outerStep,oracle.firstRestOuter);
      assert.deepEqual(result.scoring.result,oracle.score);assert.deepEqual(result.scoring.game,oracle.lastGame);
      assert.ok(result.state.balls.every(b=>b.state.sleeping));assert.equal(result.state.cue.present,false);}
    assert.equal(result.resources.trackedBuffers,0,'Terminal service must destroy every remaining owned buffer');
    assert.equal(result.resources.buffersCreated,result.resources.buffersDestroyed+result.resources.buffersCollected);
    await service.dispose();
    // Owned buffers may be gone; the borrowed device and an unrelated renderer
    // allocation must remain usable after the service has released its world.
    const nextService=createBoundedFourBallShotService({device,decoder:live.decoder});await nextService.dispose();
    await sentinel.mapAsync(1);assert.equal(new Uint32Array(sentinel.getMappedRange())[0],0x51afe);sentinel.unmap();
    assert.deepEqual(errors,[],'Actual GPU validation errors');
    for(const[file,want]of Object.entries({...live.source.sources,...hashes}))assert.equal(hash(fs.readFileSync(path.join(ROOT,file))),want,'Frozen source '+file);
    const report={status:smoke?'smoke-prefix-only':'complete',backend:'actual-software-dawn-webgpu',adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description},
      scope:'fresh-live-browser-original-constructor72-default-first-strike-only',liveArtifactSha256:live.liveArtifactSha256,
      initialSnapshotSha256:oracle.initialSnapshotSha256,expectedOracleSha256,testedCommitSha,expectedShardsManifestSha256:oracle.manifestSha256,
      noNativeContinuation:true,noCpuFallback:true,sourceOnlyCandidateInput:true,borrowedDeviceSurvives:true,resources:result.resources,memory:process.memoryUsage(),processMaxRSSKiB:process.resourceUsage().maxRSS,
      firstRestOuter:smoke?null:result.state.outerStep,score:smoke?null:result.scoring.result,sourceHashes:hashes,...stats};
    console.log(JSON.stringify(report));
    if(process.env.SERVICE_EVIDENCE_OUT)fs.writeFileSync(process.env.SERVICE_EVIDENCE_OUT,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  }finally{await service?.dispose();sentinel?.destroy();device?.destroy();restore();}
});
