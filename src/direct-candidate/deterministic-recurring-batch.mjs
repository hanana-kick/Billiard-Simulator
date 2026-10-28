/** Prepared canonical recurrence batch protocol. Physics receipts, NOT verdicts. */
import {validateDirectionalRows} from './deterministic-directional-event.mjs';
import {validateResidentScene} from './deterministic-resident-transition.mjs';
import {validateCushionHull} from './deterministic-cushion-geometry.mjs';
import {runRecurringLoopCPU} from './deterministic-recurring-loop.mjs';
import {recurringWords} from './deterministic-recurring-gpu.mjs';
export const RECURRING_BATCH_VERSION='prepared-recurring-batch-v1';
export const RECURRING_DIAGNOSTIC_WORDS=2096;
export const RECURRING_COMPACT_WORDS=4;
export const RECURRING_MODEL_REST_FLAG=1;
export const ownedWords=x=>x instanceof Uint32Array&&Object.prototype.toString.call(x.buffer)!=='[object SharedArrayBuffer]';
export function checkCancelled(signal){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');}
export function snapshotRecurringBatch(original,scene,options){
 const signal=options?.signal;checkCancelled(signal);
 if(!ownedWords(original)||!original.length||original.length%96||original.length/96>65535)throw TypeError('1..65535 owned complete prepared candidates');
 if(!ownedWords(scene))throw TypeError('Owned immutable scene');validateResidentScene(scene);
 if(!options||!Number.isInteger(options.maxPrefixes)||options.maxPrefixes<1||options.maxPrefixes>64||!['strict-carried-v1','canonical-local-v1'].includes(options.executionProfile))throw RangeError('Explicit bounded recurrence profile');
 const tailMaxNodes=options.tailMaxNodes??256;if(!Number.isInteger(tailMaxNodes)||tailMaxNodes<1||tailMaxNodes>256)throw RangeError('Bounded tail geometry budget');
 if(options.diagnostic!==undefined&&options.diagnostic!=='all-words')throw RangeError('Diagnostic mode must be all-words');
 const rows=original.slice(),sc=scene.slice(),ids=new Set();
 for(let i=0;i<rows.length;i+=96){validateDirectionalRows(rows.subarray(i,i+96));if(ids.has(rows[i]))throw RangeError('Unique batch candidate IDs');ids.add(rows[i]);}
 return {rows,scene:sc,count:rows.length/96,signal,options:{...options,signal,tailMaxNodes,budgets:options.budgets?.slice()}};
}
export function batchEnvelope(count,options){return {
 protocol:RECURRING_BATCH_VERSION,candidateCount:count,profile:options.executionProfile,
 compactWordsPerCandidate:4,compactLayout:['candidateId','physicsStateStatus','physicsStateReason','physicsFlags'],
 physicsFlags:{modelRest:1},gameplayVerdict:'not-evaluated',globalReceiptCertified:false,
 physicalRestCertified:false,preImpactPhysicalEnclosurePreserved:false,
 tailReceiptReference:options.executionProfile==='canonical-local-v1'?'canonical-tail-anchor':'carried-flow-receipt',
 diagnosticWordsPerCandidate:options.diagnostic==='all-words'?RECURRING_DIAGNOSTIC_WORDS:0
 };}
export function runRecurringBatchCPU(original,scene,hulls,options){
 const p=snapshotRecurringBatch(original,scene,options);
 if(!Array.isArray(hulls)||hulls.length!==4||hulls.some(x=>!ownedWords(x)))throw TypeError('Owned actual hull assets');const assets=hulls.map(x=>x.slice());assets.forEach(validateCushionHull);
 const compact=new Uint32Array(p.count*4),words=p.options.diagnostic==='all-words'?new Uint32Array(p.count*RECURRING_DIAGNOSTIC_WORDS):undefined;
 for(let i=0;i<p.count;i++){checkCancelled(p.signal);const cpu=runRecurringLoopCPU(p.rows.subarray(i*96,(i+1)*96),p.scene,assets,p.options);compact.set([cpu.state[0],cpu.state[1],cpu.state[2],cpu.nominalRest?1:0],i*4);if(words)words.set(recurringWords(cpu),i*RECURRING_DIAGNOSTIC_WORDS);}
 checkCancelled(p.signal);return {compact,...(words?{words}:{}),envelope:batchEnvelope(p.count,p.options)};
}
