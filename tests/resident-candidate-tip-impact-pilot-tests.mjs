// HOST-only protocol fixtures are not physics or measured performance evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PILOT_FILES,validatePilotOptions,assertFreshPilotFiles,createPilotTimingCollector,makePilotCost,validatePilotCost,writePilotJsonOnce,readPilotCost,writePilotDecision,validatePilotDecision,waitForPilotDecision} from './resident-candidate-tip-impact-pilot-barrier.mjs';
import {runTipImpactFixedWork,executeTipImpact} from './resident-candidate-tip-impact-isolated.mjs';
import {parsePilotDecisionArguments} from './resident-candidate-tip-impact-pilot-decision.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const invocation=()=>({kind:'resident-test-process-invocation-v1',id:randomUUID(),pid:123,startedAtEstimateMs:1000});
const temp=t=>{const d=mkdtempSync(join(tmpdir(),'tip-impact-pilot-test-'));t.after(()=>rmSync(d,{recursive:true,force:true}));return d;};
function fixture(){
  const gpuInvocation=invocation(),work=[512,1536,14336],handlerCount=4;
  const initialization={stage:'execution-group-ready',name:'initialize',wallMs:3,dispatches:21,submissions:1,encodeWallMs:1,submitWallMs:.5,queueDrainWallMs:1.5,externalHandlerDispatches:0,pumpCycles:0,timingKind:'host-wall-not-gpu-timestamp'};
  const pump={...initialization,name:'pump',wallMs:9,dispatches:2560,submissions:3,externalHandlerDispatches:2048,pumpCycles:512};
  const capture={stage:'microcode-checkpoint-copied',name:'fixed-cycles-512',pumpCycles:512,mapped:false,physicalBoundary:'unqualified-fixed-cycle-diagnostic'};
  const collector=createPilotTimingCollector({gpuInvocation,firstCycles:512,handlerCount});for(const event of [initialization,pump,capture])collector.trace(event);
  const manifest={work,handlers:Array.from({length:4},(_,id)=>({id})),runtimeSha256:digest('runtime'),sourceSha256:digest('source'),bytecodeSha256:digest('code'),vmShaderSha256:digest('shader'),originalGeneration:digest('generation'),sourceHashes:{'test-source.mjs':digest('actual test source')}};
  const cost=makePilotCost({manifest,manifestSha256:digest('manifest bytes'),gpuInvocation,waitTimeoutMs:1000,adapter:{vendor:'HOST MOCK ONLY'},precompile:{wallMs:1,beforeAnySourceAllocation:true},timing:collector.seal(.1),createdAtMs:2000});
  return {cost,manifest,collector,initialization,pump,capture,gpuInvocation};
}
const decisionOptions=(bound,decision='continue')=>({decision,costSha256:bound.costSha256,gpuInvocationId:bound.cost.gpuInvocation.id,manifestSha256:bound.cost.manifestSha256,runtimeSha256:bound.cost.runtimeSha256});
const publish=(d,cost)=>{writePilotJsonOnce(d,PILOT_FILES.cost,cost);return readPilotCost(d);};

test('pilot requires explicit bounded operational wait and remaining immutable work',()=>{
  assert.deepEqual(validatePilotOptions({waitTimeoutMs:60000}),{waitTimeoutMs:60000});
  for(const x of [undefined,null,{}, {waitTimeoutMs:0},{waitTimeoutMs:3600001},{waitTimeoutMs:1.5},{waitTimeoutMs:1000,frames:8}])assert.throws(()=>validatePilotOptions(x));
  const{cost}=fixture();for(const change of [c=>c.work=[512],c=>c.remainingWork=[1536],c=>c.frames=128,c=>c.instructionBudget=32768,c=>c.completedBlocks=0,c=>c.cumulativeCycles=511,c=>c.physicalResult=false,c=>c.readbacks=1]){const c=structuredClone(cost);change(c);assert.throws(()=>validatePilotCost(c));}
});

test('receipt binds exact timing callback order, counters and invocation; callbacks contain no state',()=>{
  const f=fixture();assert.equal(validatePilotCost(f.cost),f.cost);
  for(const mutate of [c=>c.timing.gpuInvocation=invocation(),c=>c.timing.pump.dispatches++,c=>c.timing.pump.submissions++,c=>c.timing.pump.externalHandlerDispatches--,c=>c.timing.pump.queueDrainWallMs=NaN,c=>c.timing.capture.mapped=true,c=>c.timing.capture.words=[123],c=>c.timing.initialization.name='pump',c=>c.sourceHashesSha256='bogus']){const cost=structuredClone(f.cost);mutate(cost);assert.throws(()=>validatePilotCost(cost));}
  const collector=createPilotTimingCollector({gpuInvocation:f.gpuInvocation,firstCycles:512,handlerCount:4});
  assert.throws(()=>collector.seal(1),/callbacks complete/);assert.throws(()=>collector.trace(f.pump));
  collector.trace(f.initialization);collector.trace(f.pump);collector.trace(f.capture);collector.seal(1);assert.throws(()=>collector.seal(1));
  // Once the pilot is sealed, later legitimate session callbacks cannot mutate it.
  collector.trace({stage:'microcode-final-mapped',controls:[999]});assert.equal(f.cost.readbacks,0);
});

test('cost publication is atomic, immutable and fresh; duplicate decision refuses',t=>{
  const dir=temp(t),{cost}=fixture();assertFreshPilotFiles(dir);const bound=publish(dir,cost);
  assert.equal(bound.costSha256,digest(readFileSync(join(dir,PILOT_FILES.cost))));
  assert.throws(()=>assertFreshPilotFiles(dir));assert.throws(()=>writePilotJsonOnce(dir,PILOT_FILES.cost,cost),/EEXIST/);
  const row=writePilotDecision(dir,decisionOptions(bound),invocation());assert.equal(row.decision.decision,'continue');
  assert.throws(()=>writePilotDecision(dir,decisionOptions(bound,'abort'),invocation()),/EEXIST/);
  assert.equal(existsSync(join(dir,'actual.v8')),false);assert.equal(existsSync(join(dir,'assertion.json')),false);
});

test('mismatch, stale invocation, hidden fields and unknown decision refuse before publication',t=>{
  const dir=temp(t),bound=publish(dir,fixture().cost);
  const valid={kind:'resident-tip-impact-pilot-decision-v1',...decisionOptions(bound),coordinatorInvocation:invocation()};
  assert.equal(validatePilotDecision(valid,bound),valid);
  for(const mutate of [d=>d.decision='resume',d=>d.decision='pass',d=>d.costSha256=digest('other'),d=>d.gpuInvocationId=randomUUID(),d=>d.manifestSha256=digest('changed manifest'),d=>d.runtimeSha256=digest('changed runtime'),d=>d.coordinatorInvocation=bound.cost.gpuInvocation,d=>d.frames=8,d=>d.state=[]]){const d=structuredClone(valid);mutate(d);assert.throws(()=>validatePilotDecision(d,bound));}
  assert.throws(()=>writePilotDecision(dir,{...decisionOptions(bound),costSha256:digest('stale')},invocation()));
  assert.equal(existsSync(join(dir,PILOT_FILES.decision)),false);
});

test('matching continue/abort receipt only; changed published cost and malformed decisions are terminal refusal',async t=>{
  for(const action of ['continue','abort','malformed','stale','changed-cost']){
    const dir=temp(t),bound=publish(dir,fixture().cost);
    if(action==='changed-cost')writeFileSync(join(dir,PILOT_FILES.cost),'{}');
    else if(action==='malformed')writeFileSync(join(dir,PILOT_FILES.decision),'{');
    else if(action==='stale')writeFileSync(join(dir,PILOT_FILES.decision),JSON.stringify({kind:'resident-tip-impact-pilot-decision-v1',...decisionOptions(bound),gpuInvocationId:randomUUID(),coordinatorInvocation:invocation()}));
    else writePilotDecision(dir,decisionOptions(bound,action),invocation());
    const result=await waitForPilotDecision(dir,bound);assert.equal(result.decision,['continue','abort'].includes(action)?action:'incomplete');
    if(result.decision==='incomplete')assert.equal(result.reason,'refused-local-receipt');
  }
});

test('operational timeout never auto-continues, even if a decision arrives at the deadline',async t=>{
  for(const late of [false,true]){
    const dir=temp(t),bound=publish(dir,fixture().cost);let clock=0,delays=0;
    const result=await waitForPilotDecision(dir,bound,{now:()=>clock,pollMs:250,delay:async ms=>{clock+=ms;delays++;if(late&&clock===1000)writePilotDecision(dir,decisionOptions(bound),invocation());}});
    assert.equal(result.decision,'incomplete');assert.equal(result.reason,'operational-timeout');assert.equal(result.waitWallMs,1000);assert.equal(delays,4);
  }
});

function mockSession(events){return {async pump(n){events.push(['pump',n]);},async capture(label){events.push(['capture',label]);},async finish(){throw Error('scheduler must not map');},async initialize(){throw Error('scheduler must not reset');}};}
test('retained scheduler continues exact original blocks with one barrier and no map/reset',async()=>{
  const work=[512,1536,14336],events=[],session=mockSession(events);let calls=0;
  const result=await runTipImpactFixedWork(session,work,{trace:()=>{},afterFirstCapture:async({captureWallMs})=>{calls++;assert.ok(captureWallMs>=0);assert.deepEqual(events,[['pump',512],['capture','fixed-cycles-512']]);return {decision:'continue'};}});
  assert.equal(result.completed,true);assert.equal(calls,1);assert.equal(result.cumulativeCycles,16384);
  assert.deepEqual(events,[['pump',512],['capture','fixed-cycles-512'],['pump',1536],['capture','fixed-cycles-2048'],['pump',14336],['capture','fixed-cycles-16384']]);
  const baseline=[];await runTipImpactFixedWork(mockSession(baseline),work,{trace:()=>{}});assert.deepEqual(events,baseline,'default schedule byte-for-byte unchanged');
});

test('abort/refusal stops before remaining work, never finish; invalid callback cannot pass',async()=>{
  for(const decision of ['abort','incomplete']){const events=[];const result=await runTipImpactFixedWork(mockSession(events),[512,1536],{trace:()=>{},afterFirstCapture:async()=>({decision})});assert.equal(result.completed,false);assert.equal(result.cumulativeCycles,512);assert.equal(events.length,2);}
  await assert.rejects(runTipImpactFixedWork(mockSession([]),[512],{afterFirstCapture:async()=>({decision:'continue'})}),/remaining/);
  await assert.rejects(runTipImpactFixedWork(mockSession([]),[512,1536],{trace:()=>{},afterFirstCapture:async()=>({decision:'pass'})}),/explicit pilot decision/);
});

test('lean coordinator CLI demands explicit decision and all target identities',t=>{
  const dir=temp(t),bound=publish(dir,fixture().cost),args=[dir,'abort','--cost-sha256='+bound.costSha256,'--gpu-invocation-id='+bound.cost.gpuInvocation.id,'--manifest-sha256='+bound.cost.manifestSha256,'--runtime-sha256='+bound.cost.runtimeSha256];
  assert.equal(parsePilotDecisionArguments(args).options.decision,'abort');
  for(const bad of [args.slice(0,-1),[dir,'continue'],[dir,'auto',...args.slice(2)],[...args.slice(0,-1),args[2]]])assert.throws(()=>parsePilotDecisionArguments(bad));
  const output=JSON.parse(execFileSync(process.execPath,[new URL('./resident-candidate-tip-impact-pilot-decision.mjs',import.meta.url).pathname,...args],{encoding:'utf8'}));
  assert.equal(output.decision.decision,'abort');assert.notEqual(output.decision.coordinatorInvocation.id,bound.cost.gpuInvocation.id);
});

test('native role remains opt-in; no expected/CPU access; abort disposal precedes incomplete receipt and no map',async()=>{
  const prior=process.env.RUN_RESIDENT_TIP_IMPACT_GPU;delete process.env.RUN_RESIDENT_TIP_IMPACT_GPU;
  try{await assert.rejects(executeTipImpact('/not-opened',{pilot:{waitTimeoutMs:1000}}),/explicit coordinator numerical slot/);}finally{if(prior!==undefined)process.env.RUN_RESIDENT_TIP_IMPACT_GPU=prior;}
  const code=readFileSync(new URL('./resident-candidate-tip-impact-isolated.mjs',import.meta.url),'utf8');
  const native=code.slice(code.indexOf('export async function executeTipImpact'),code.indexOf('export async function assertTipImpact'));
  assert.doesNotMatch(native,/read\([^\n]*expected|json\([^\n]*expected|import\([^\n]*(?:fixture|compiler|physics)|\.mapAsync\(/);
  assert.match(native,/await runTipImpactFixedWork[\s\S]*if\(!schedule.completed\)[\s\S]*await session.dispose\(\);session=undefined;[\s\S]*writePilotJsonOnce[\s\S]*return incomplete;[\s\S]*await session.finish/);
  assert.match(native,/sha\(read\(dir,'manifest.json'\)\)[\s\S]*sha\(read\(dir,'runtime.v8'\)\)[\s\S]*sourceHashes\(\),manifest.sourceHashes/);
});
