import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {prepareWideReference} from '../scripts/prepare-live-world-wide-reference.mjs';
import {createLiveWorldSealReviewCandidate} from '../tools/build-live-world-upload-seal.mjs';
import {verifyWideReference} from '../tools/verify-live-world-wide-reference.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
test('flat reference verification binds exact CPU source closure and terminal semantics',async()=>{
 const {metadata,bytes}=await prepareWideReference();
 // Test-local review marker only; never writes or refreshes the repository pin.
 const pin={...await createLiveWorldSealReviewCandidate(fileURLToPath(new URL('../',import.meta.url))),reviewStatus:'reviewed'};
 const result=verifyWideReference(metadata,bytes,pin);
 assert.equal(result.expectedWords,96228);assert.equal(result.maximumObservedRawSteps,1664);assert.equal(result.remainingRawStepMargin,36);
 const clone=x=>structuredClone(x);
 for(const change of [m=>{m.cpuSourceSHA256.extra='abc';},m=>{delete m.cpuSourceSHA256[Object.keys(m.cpuSourceSHA256)[0]];},m=>{m.cpuSourceSHA256[Object.keys(m.cpuSourceSHA256)[0]]='abc';},m=>{m.candidates[32].candidateId=m.candidates[0].candidateId;},m=>{m.maximumSteps=2048;}]){const m=clone(metadata);change(m);assert.throws(()=>verifyWideReference(m,bytes,pin));}
 assert.throws(()=>verifyWideReference(metadata,bytes,{...pin,reviewStatus:'UNREVIEWED'}));
 for(const [word,value]of [[1,5],[2849,2],[2855,1701*16],[2913,1],[61,1],[64+27,1],[768+32,7]]){const bad=Buffer.from(bytes);bad.writeUInt32LE(value,word*4);const m={...metadata,expectedSHA256:sha(bad)};assert.throws(()=>verifyWideReference(m,bad,pin),'Changed semantic word '+word);}
 const corrupted=Buffer.from(bytes);corrupted[8]^=1;assert.throws(()=>verifyWideReference(metadata,corrupted,pin));
});
