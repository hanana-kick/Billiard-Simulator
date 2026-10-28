/** Proposed low-cost, genuine MMQ2 width-boundary fixture. Not runtime routing. */
import assert from 'node:assert/strict';
import {mmq2RawFixture} from './canonical-selected-mmq2-raw.mjs';
import {createCanonicalCandidate} from '../../src/direct-candidate/canonical-engine-contract.mjs';
import {preparedWorldWords} from '../../src/direct-candidate/deterministic-prepared-world-gpu.mjs';
export const WIDE_REFERENCE_WORDS=2916;
export const WIDE_REFERENCE_LAYOUT=Object.freeze({prepared:0,journal:768,auxiliary:1824,rawStatus:2848,ruleState:2864,compact:2912,words:WIDE_REFERENCE_WORDS});
export function wideReferenceSettings(index){if(!Number.isInteger(index)||index<0||index>=33)throw RangeError('Reviewed 33-candidate fixture index');return{angle:(index-16)/10,elevation:25+(index%3)/4,speed:.5+(index%11)/1000,tipX:0,tipY:0};}
export function wideReferenceCandidateId(index){if(!Number.isInteger(index)||index<0||index>=33)throw RangeError('Reviewed 33-candidate fixture index');return index===0?100:index===31?0xfffffffe:index===32?0xffffffff:0x80000000+index;}
export function liveWorldWideFixture(count=33){if(![32,33].includes(count))throw RangeError('Proposed N32/N33 fixture only');const f=mmq2RawFixture({x:0}),candidates=Array.from({length:count},(_,i)=>createCanonicalCandidate(f.request,wideReferenceCandidateId(i),wideReferenceSettings(i)));assert.ok(candidates.every(c=>c.admitted));return{...f,candidates};}
export function flattenWideReference(result){const c=result?.continuation;assert.ok(c,'Defined original CPU continuation required');assert.equal(result.rawHandoffStatus.length,16);assert.equal(c.journalWords.length,1056);assert.equal(c.journalAuxWords.length,1024);assert.equal(c.ruleState.length,48);assert.equal(c.compactResult.length,4);const prepared=preparedWorldWords(c);assert.equal(prepared.length,768);const words=new Uint32Array(WIDE_REFERENCE_WORDS);for(const[at,source]of[[0,prepared],[768,c.journalWords],[1824,c.journalAuxWords],[2848,result.rawHandoffStatus],[2864,c.ruleState],[2912,c.compactResult]])words.set(source,at);return words;}
