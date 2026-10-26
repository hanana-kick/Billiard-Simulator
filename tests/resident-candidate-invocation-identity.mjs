// TEST-process identity, not a cryptographic attestation or physics input.
// PID namespaces can reuse the same PID in genuinely separate executor runs.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const key=Symbol.for('billiard.resident.test-process-invocation-v1');
export function processInvocationIdentity(){
 if(!globalThis[key])globalThis[key]=Object.freeze({kind:'resident-test-process-invocation-v1',id:randomUUID(),pid:process.pid,startedAtEstimateMs:Math.round(Date.now()-process.uptime()*1000)});
 return globalThis[key];
}
const valid=x=>{assert.equal(x?.kind,'resident-test-process-invocation-v1');assert.match(x.id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);assert.ok(Number.isInteger(x.pid)&&x.pid>0);assert.ok(Number.isSafeInteger(x.startedAtEstimateMs));};
export function assertSeparateTestProcesses({gpu,prepared,current=processInvocationIdentity()}){
 valid(gpu);valid(prepared);valid(current);assert.notEqual(gpu.id,prepared.id,'GPU process cannot be the source-preparation process');assert.notEqual(gpu.id,current.id,'GPU and independent assertion processes must differ');return true;
}
