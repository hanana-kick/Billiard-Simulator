// TEST-only recovery journal for one declared owned-HOST diagnostic request.
// No physics/VM execution. Original input and any prior archive stay immutable.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serialize,deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {saveHostContinuation} from './resident-candidate-host-continuation-store.mjs';
export const WITHDRAWAL_RECOVERY=Object.freeze({kind:'owned-host-h192-withdrawal-request129-v1',interval:4096,maxPumps:16384,maxWallMs:3600000,capacity:8,periodicPumps:Object.freeze([4096,8192,12288])});
const sha=x=>createHash('sha256').update(x).digest('hex');
export function withdrawalPeriodicCheckpointDue(totalPumps){assert.ok(Number.isSafeInteger(totalPumps)&&totalPumps>=0&&totalPumps<=WITHDRAWAL_RECOVERY.maxPumps);return WITHDRAWAL_RECOVERY.periodicPumps.includes(totalPumps);}
function validate(x,{initialSha256,bytecodeSha256}={}){assert.equal(x.kind,WITHDRAWAL_RECOVERY.kind);assert.equal(x.gpuAdmission,false);assert.equal(x.initialSha256,initialSha256);assert.equal(x.bytecodeSha256,bytecodeSha256);assert.ok(Number.isInteger(x.totalPumps)&&x.totalPumps>=0&&x.totalPumps<=WITHDRAWAL_RECOVERY.maxPumps);assert.ok(Number.isFinite(x.hostWallMs)&&x.hostWallMs>=0);assert.ok(x.vmState instanceof Uint32Array);assert.ok(Array.isArray(x.bindings)&&x.bindings.length===6&&x.bindings.every(a=>a instanceof Uint32Array));assert.equal(x.pauseDependentCounters,true);assert.ok(x.resourceCaps&&Number.isInteger(x.resourceCaps.maxPumps)&&x.resourceCaps.maxPumps>0&&x.resourceCaps.maxPumps<=WITHDRAWAL_RECOVERY.maxPumps&&Number.isInteger(x.resourceCaps.maxWallMs)&&x.resourceCaps.maxWallMs>0&&x.resourceCaps.maxWallMs<=WITHDRAWAL_RECOVERY.maxWallMs);assert.ok(x.totalPumps<=x.resourceCaps.maxPumps);assert.ok(['periodic','resource','failed','h306'].includes(x.checkpointKind));assert.equal(x.resumable,['periodic','resource'].includes(x.checkpointKind));if(x.checkpointKind==='periodic'){assert.ok(withdrawalPeriodicCheckpointDue(x.totalPumps));assert.equal(x.boundary,null);assert.equal(x.error,null);}if(x.resumable)assert.equal(x.error,null);if(x.checkpointKind==='h306')assert.equal(x.boundary?.h,306);}
export function saveWithdrawalCheckpoint({dir,receipt,kind,error=null,expectedPreviousSha256=null}){const x={...receipt,checkpointKind:kind,resumable:kind==='periodic'||kind==='resource',error};validate(x,x);const bytes=serialize(x),retention=saveHostContinuation({dir,bytes,expectedPreviousSha256,capacity:WITHDRAWAL_RECOVERY.capacity});return{retention,kind,resumable:x.resumable,totalPumps:x.totalPumps};}
/** Pointer and hash-addressed bytes are authoritative, not a potentially older
 * progress/result JSON. Thus a kill between pointer commit and progress write
 * can safely resume the last fully serialized OWN state without reconstruction. */
export function loadWithdrawalCheckpoint({dir,initialSha256,bytecodeSha256,resourceCaps={maxPumps:WITHDRAWAL_RECOVERY.maxPumps,maxWallMs:WITHDRAWAL_RECOVERY.maxWallMs}}){const bytes=readFileSync(join(dir,'continuation.v8')),hash=sha(bytes),archive=readFileSync(join(dir,'host-continuations',hash+'.v8'));assert.equal(sha(archive),hash);assert.deepEqual(archive,bytes);const x=deserialize(bytes);validate(x,{initialSha256,bytecodeSha256});assert.deepEqual(x.resourceCaps,resourceCaps,'declared total caps cannot change during resume');assert.equal(x.resumable,true,'failed or completed h306 archive cannot resume');assert.ok(x.totalPumps<x.resourceCaps.maxPumps&&x.hostWallMs<x.resourceCaps.maxWallMs,'declared total resource cap exhausted; no automatic extension');
 // V8 may expose views into bytes. Detach ALL working views before mutation;
 // retain the serialized file/hash authority separately from live source state.
 return{sha256:hash,receipt:{...x,bindings:x.bindings.map(a=>a.slice()),vmState:x.vmState.slice()}};
}
