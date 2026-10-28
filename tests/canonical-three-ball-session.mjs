import test from 'node:test';import assert from 'node:assert/strict';
import {threeBallFixture} from './fixtures/canonical-three-ball-source.mjs';
import {runCanonicalRawWorldContinuationCPU} from '../src/direct-candidate/canonical-world-continuation.mjs';
import {createCanonicalCPUSelectedTrace} from '../src/direct-candidate/canonical-selected-trace-cpu.mjs';
import {exportSelectedShotTraceRecords,selectedTraceWorldBoundary,sampleSelectedShotTrace} from '../src/direct-candidate/canonical-selected-trace.mjs';
for(const kind of ['clear','two-target'])test('genuine three-ball raw '+kind+' reaches REST without falsely scoring three cushions',t=>{
 const f=threeBallFixture(kind);assert.equal(f.request.scene.physical.bodies.length,3);assert.deepEqual(f.request.slotToId,[8,50,300]);assert.equal(f.request.rules.game,3);assert.equal(f.request.rules.opponentId,null);assert.equal(f.request.rules.minCushions,3);
 const capture=createCanonicalCPUSelectedTrace(f.request,f.candidate,f.batch,{sourceFormat:'resident-v1'}),result=runCanonicalRawWorldContinuationCPU(f.binding,f.batch,{selectedTraceCapture:capture.selectedTraceCapture}).continuation,receipt=capture.finish(result);
 assert.equal(result.state[3],3);assert.equal(receipt.physicsResultComplete,true);assert.equal(receipt.captureComplete,true,JSON.stringify(receipt.adapterErrors));assert.equal(result.ruleState[13],1);assert.equal(result.ruleState[1],0);assert.equal(result.ruleState[0],kind==='clear'?0:3);assert.equal(result.compactResult[3],0);assert.equal(result.ruleState[18],2);assert.equal(result.ruleState[19],2);
 for(const r of exportSelectedShotTraceRecords(receipt.trace))for(let i=0;i<3;i++){assert.equal(r[32+10*i],f.request.slotToId[i]);assert.equal(r[72+10*i],f.request.slotToId[i]);}
 assert.deepEqual(sampleSelectedShotTrace(receipt.trace,result.state[5]).state,selectedTraceWorldBoundary(result.state));
 t.diagnostic(JSON.stringify({kind,bodyCount:result.state[3],tick:result.state[5],compact:Array.from(result.compactResult),targetMask:result.ruleState[0],cushions:result.ruleState[1],records:receipt.trace.recordCount,threeCushionGoal:false}));
});
