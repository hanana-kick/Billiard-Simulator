// TEST ONLY local cost/continue barrier. No GPU imports, expected files, physics,
// source-state readback, source writes, or qualification authority live here.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, linkSync, unlinkSync, existsSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {processInvocationIdentity} from './resident-candidate-invocation-identity.mjs';

export const PILOT_FILES = Object.freeze({cost:'pilot-cost.json', decision:'pilot-decision.json', incomplete:'pilot-incomplete.json'});
const hash = x => createHash('sha256').update(x).digest('hex');
const keys = (x, expected) => {assert.ok(x && Object.getPrototypeOf(x) === Object.prototype);assert.deepEqual(Object.keys(x).sort(), [...expected].sort(), 'exact local coordination schema');};
const sha = x => assert.match(x, /^[0-9a-f]{64}$/);
const identity = x => {keys(x,['kind','id','pid','startedAtEstimateMs']);assert.equal(x.kind,'resident-test-process-invocation-v1');assert.match(x.id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);assert.ok(Number.isSafeInteger(x.pid)&&x.pid>0);assert.ok(Number.isSafeInteger(x.startedAtEstimateMs));};
const finite = x => assert.ok(Number.isFinite(x)&&x>=0,'nonnegative host wall measurement');
const integer = x => assert.ok(Number.isSafeInteger(x)&&x>=0,'nonnegative integer counter');
const clone = x => structuredClone(x);
export function validatePilotOptions(options) {
  keys(options,['waitTimeoutMs']);
  assert.ok(Number.isSafeInteger(options.waitTimeoutMs)&&options.waitTimeoutMs>0&&options.waitTimeoutMs<=60*60*1000,'explicit operational wait timeout 1..3600000 ms, not physics horizon');
  return Object.freeze({...options});
}
export function assertFreshPilotFiles(dir) {
  for(const name of [...Object.values(PILOT_FILES),'actual.v8','actual-manifest.json','assertion.json'])
    assert.equal(existsSync(join(dir,name)),false,'fresh pilot output required: '+name);
}
// Complete bytes become visible atomically; link refuses replacement. This is
// local file provenance, not authentication against a malicious file owner.
export function writePilotJsonOnce(dir,name,value) {
  assert.ok(Object.values(PILOT_FILES).includes(name),'known pilot output');
  const bytes=Buffer.from(JSON.stringify(value,null,2)), temp=join(dir,'.pilot-'+randomUUID()+'.tmp');
  writeFileSync(temp,bytes,{flag:'wx'});
  try {linkSync(temp,join(dir,name));} finally {unlinkSync(temp);}
  return hash(bytes);
}

/** Bind only the exact callback sequence from this retained session. No bank
 * words or device error state enter this observer. Caller owns trace identity. */
export function createPilotTimingCollector({gpuInvocation,firstCycles,handlerCount}) {
  identity(gpuInvocation);assert.ok(Number.isSafeInteger(firstCycles)&&firstCycles>0);assert.ok([3,4].includes(handlerCount));
  const events=[];let sealed=false;
  return Object.freeze({
    trace(event){
      if(sealed)return;
      const index=events.length;
      if(index<2){
        keys(event,['stage','name','wallMs','dispatches','submissions','encodeWallMs','submitWallMs','queueDrainWallMs','externalHandlerDispatches','pumpCycles','timingKind']);
        assert.equal(event.stage,'execution-group-ready');assert.equal(event.name,index?'pump':'initialize');assert.equal(event.timingKind,'host-wall-not-gpu-timestamp');
        for(const k of ['wallMs','encodeWallMs','submitWallMs','queueDrainWallMs'])finite(event[k]);
        for(const k of ['dispatches','submissions','externalHandlerDispatches','pumpCycles'])integer(event[k]);
        assert.equal(event.pumpCycles,index?firstCycles:0);
        if(index){assert.equal(event.dispatches,firstCycles*(handlerCount+1));assert.equal(event.externalHandlerDispatches,firstCycles*handlerCount);assert.equal(event.submissions,Math.ceil(event.dispatches/1024));}
      }else{
        assert.equal(index,2,'exactly one initial capture');keys(event,['stage','name','pumpCycles','mapped','physicalBoundary']);
        assert.equal(event.stage,'microcode-checkpoint-copied');assert.equal(event.name,'fixed-cycles-'+firstCycles);assert.equal(event.pumpCycles,firstCycles);assert.equal(event.mapped,false);assert.equal(event.physicalBoundary,'unqualified-fixed-cycle-diagnostic');
      }
      events.push(clone(event));
    },
    seal(captureWallMs){assert.equal(sealed,false);assert.equal(events.length,3,'timing callbacks complete before pilot receipt');finite(captureWallMs);sealed=true;return {gpuInvocation:clone(gpuInvocation),timingKind:'host-wall-not-gpu-timestamp',initialization:events[0],pump:events[1],capture:events[2],captureWallMs};}
  });
}

export function validatePilotCost(cost) {
  keys(cost,['kind','manifestSha256','runtimeSha256','sourceHashesSha256','sourceSha256','bytecodeSha256','vmShaderSha256','originalGeneration','gpuInvocation','work','frames','count','instructionBudget','completedBlocks','cumulativeCycles','remainingWork','handlerCount','waitTimeoutMs','createdAtMs','adapter','precompile','timing','readbacks','stateAuthority','physicalResult']);
  assert.equal(cost.kind,'resident-tip-impact-pilot-cost-v1');
  for(const k of ['manifestSha256','runtimeSha256','sourceHashesSha256','sourceSha256','bytecodeSha256','vmShaderSha256','originalGeneration'])sha(cost[k]);
  identity(cost.gpuInvocation);validatePilotOptions({waitTimeoutMs:cost.waitTimeoutMs});integer(cost.createdAtMs);
  assert.equal(cost.frames,192);assert.equal(cost.count,2);assert.equal(cost.instructionBudget,65536);
  assert.ok(Array.isArray(cost.work)&&cost.work.length>=2&&cost.work.length<=64,'pilot requires a remaining predetermined block');
  assert.ok(cost.work.every(x=>Number.isSafeInteger(x)&&x>0&&x<=65536));assert.ok(cost.work.reduce((a,b)=>a+b,0)<=65536);
  assert.equal(cost.completedBlocks,1);assert.equal(cost.cumulativeCycles,cost.work[0]);assert.deepEqual(cost.remainingWork,cost.work.slice(1));
  assert.equal(cost.readbacks,0);assert.equal(cost.stateAuthority,'same retained GPU banks; no map or host state access');assert.equal(cost.physicalResult,null);
  keys(cost.timing,['gpuInvocation','timingKind','initialization','pump','capture','captureWallMs']);assert.deepEqual(cost.timing.gpuInvocation,cost.gpuInvocation);assert.equal(cost.timing.timingKind,'host-wall-not-gpu-timestamp');
  const c=createPilotTimingCollector({gpuInvocation:cost.gpuInvocation,firstCycles:cost.work[0],handlerCount:cost.handlerCount});
  c.trace(cost.timing.initialization);c.trace(cost.timing.pump);c.trace(cost.timing.capture);assert.deepEqual(c.seal(cost.timing.captureWallMs),cost.timing);
  assert.ok(cost.precompile&&typeof cost.precompile==='object');finite(cost.precompile.wallMs);assert.equal(cost.precompile.beforeAnySourceAllocation,true);
  assert.ok(cost.adapter&&typeof cost.adapter==='object');
  return cost;
}
export function makePilotCost({manifest,manifestSha256,gpuInvocation,waitTimeoutMs,adapter,precompile,timing,createdAtMs=Date.now()}) {
  return validatePilotCost({kind:'resident-tip-impact-pilot-cost-v1',manifestSha256,runtimeSha256:manifest.runtimeSha256,
    sourceHashesSha256:hash(JSON.stringify(manifest.sourceHashes)),sourceSha256:manifest.sourceSha256,bytecodeSha256:manifest.bytecodeSha256,vmShaderSha256:manifest.vmShaderSha256,originalGeneration:manifest.originalGeneration,
    gpuInvocation:clone(gpuInvocation),work:[...manifest.work],frames:192,count:2,instructionBudget:65536,completedBlocks:1,cumulativeCycles:manifest.work[0],remainingWork:manifest.work.slice(1),handlerCount:manifest.handlers.length,
    waitTimeoutMs,createdAtMs,adapter:clone(adapter),precompile:clone(precompile),timing:clone(timing),readbacks:0,stateAuthority:'same retained GPU banks; no map or host state access',physicalResult:null});
}
export function validatePilotDecision(decision,{cost,costSha256}) {
  validatePilotCost(cost);sha(costSha256);
  keys(decision,['kind','decision','costSha256','gpuInvocationId','manifestSha256','runtimeSha256','coordinatorInvocation']);
  assert.equal(decision.kind,'resident-tip-impact-pilot-decision-v1');assert.ok(['continue','abort'].includes(decision.decision),'only continue or abort');
  assert.equal(decision.costSha256,costSha256,'exact immutable cost receipt');assert.equal(decision.gpuInvocationId,cost.gpuInvocation.id,'exact live GPU invocation');
  assert.equal(decision.manifestSha256,cost.manifestSha256);assert.equal(decision.runtimeSha256,cost.runtimeSha256);identity(decision.coordinatorInvocation);
  assert.notEqual(decision.coordinatorInvocation.id,cost.gpuInvocation.id,'distinct local coordinator invocation');
  return decision;
}
export function readPilotCost(dir) {
  const bytes=readFileSync(join(dir,PILOT_FILES.cost)), cost=validatePilotCost(JSON.parse(bytes));return {cost,costSha256:hash(bytes)};
}
/** Caller must explicitly identify the observed receipt and target process. */
export function writePilotDecision(dir,{decision,costSha256,gpuInvocationId,manifestSha256,runtimeSha256},coordinatorInvocation=processInvocationIdentity()) {
  const bound=readPilotCost(dir);
  const row={kind:'resident-tip-impact-pilot-decision-v1',decision,costSha256,gpuInvocationId,manifestSha256,runtimeSha256,coordinatorInvocation};
  validatePilotDecision(row,bound);return {decision:row,decisionSha256:writePilotJsonOnce(dir,PILOT_FILES.decision,row)};
}

/** Operational timeout begins after the complete cost receipt is published.
 * Malformed/stale receipts refuse immediately, not a retry/fallback. Timers
 * never advance physical time or modify the predeclared transport schedule. */
export async function waitForPilotDecision(dir,bound,{now=()=>performance.now(),delay=sleep,pollMs=250}={}) {
  validatePilotCost(bound.cost);sha(bound.costSha256);assert.ok(Number.isSafeInteger(pollMs)&&pollMs>0&&pollMs<=1000);
  const start=now();
  for(;;){
    const elapsed=now()-start;finite(elapsed);
    if(elapsed>=bound.cost.waitTimeoutMs)return {decision:'incomplete',reason:'operational-timeout',waitWallMs:elapsed};
    try {
      assert.equal(hash(readFileSync(join(dir,PILOT_FILES.cost))),bound.costSha256,'published cost receipt immutable');
      if(existsSync(join(dir,PILOT_FILES.decision))){
        const bytes=readFileSync(join(dir,PILOT_FILES.decision)),decision=validatePilotDecision(JSON.parse(bytes),bound);
        const finished=now()-start;finite(finished);
        if(finished>=bound.cost.waitTimeoutMs)return {decision:'incomplete',reason:'operational-timeout',waitWallMs:finished};
        return {decision:decision.decision,decisionSha256:hash(bytes),coordinatorInvocation:decision.coordinatorInvocation,waitWallMs:finished};
      }
    }catch(error){return {decision:'incomplete',reason:'refused-local-receipt',diagnostic:String(error.message),waitWallMs:now()-start};}
    await delay(Math.min(pollMs,bound.cost.waitTimeoutMs-elapsed));
  }
}
