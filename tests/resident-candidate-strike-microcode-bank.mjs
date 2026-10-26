// ASSERTION ONLY. Import/call after the retained run has stopped and its single
// final readback completed. This module is never part of runtime/source input.
import assert from 'node:assert/strict';
import {decodeStrikeMicrocodeCheckpoints} from '../src/resident-candidate/strike-microcode-checkpoints.mjs';
import {decodeWorldEmissionAudit} from './resident-candidate-event-audit.mjs';

/** Both saved source banks AND the entire actual emission tape are mandatory.
 * A prefix selected for the first checkpoint cannot hide an extra later event:
 * the complete tape is first compared with the last original native boundary.
 * This is a native-observable strike gate, not the independent all11 owner
 * equality gate, full-rest result, throughput claim, or production readback. */
export async function compareStrikeMicrocodeCheckpoints({words,layout,template,evidence,candidate=0,expectedCandidateId}={}){
 assert.ok(Number.isInteger(expectedCandidateId)&&expectedCandidateId>=0&&expectedCandidateId<=0xffffffff,'explicit original raw-row candidate ID required');
 const decoded=decodeStrikeMicrocodeCheckpoints(words,layout,{candidate});
 for(const snapshot of decoded.snapshots)assert.equal(snapshot.header[4],expectedCandidateId,'retained original raw-row candidate ID');
 const auditPlan={count:layout.count,audit:{words:layout.auditWords,strideWords:layout.auditStride,capacityPerCandidate:layout.auditCapacityPerCandidate}},rows=decodeWorldEmissionAudit(decoded.auditPrefix,auditPlan,{candidate});
 // Only now may assertion-only original physics modules/evidence be used.
 const {compareNativeStrikeEmissionAudit,compareNativeStrikeCheckpoint}=await import('./resident-candidate-strike-continuation-bank.mjs');
 const receipt=compareNativeStrikeEmissionAudit(rows,evidence,'after-tip'),coverage=[];
 for(const snapshot of decoded.snapshots){
  const completedOuter=snapshot.header[6],prefix=rows.filter(row=>row.outerOrdinal<=completedOuter);
  coverage.push(compareNativeStrikeCheckpoint({words:snapshot.words,base:0,template,evidence,name:snapshot.name,emissionAudit:prefix}));
 }
 return Object.freeze({kind:'resident-strike-checkpoint-native-observable-comparison-v1',candidateId:expectedCandidateId,checkpoints:decoded.snapshots.map(x=>x.name),events:receipt.events,coverage:Object.freeze(coverage),wholeOwnerEquality:false,fullRest:false,hardwarePerformance:false});
}
