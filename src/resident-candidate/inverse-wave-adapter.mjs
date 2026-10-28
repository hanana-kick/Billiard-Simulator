// Optional HOST contract only. No physical producer, worker/backend activation,
// CPU-forward evaluation, generated residuals, or gameplay-policy adaptation.
import '../source-finalization-request.js';
import {createHash} from './source-sha256.mjs';
import {assertInverseQueryInitialInputs,INVERSE_QUERY_JOIN_PROFILE} from './inverse-world-query-join.mjs';
import {decodeInverseTerminalObservations} from './inverse-terminal-observation.mjs';
const proofs=new WeakMap(),sha=x=>createHash('sha256').update(x).digest('hex'),fp=x=>globalThis.LabSourceFinalizationRequest.fingerprint(x);
const need=(v,m)=>{if(!v)throw new RangeError('Resident inverse wave: '+m);};
const frozen=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;};
const keys=['angle','elevation','speed','tipX','tipY'];
function fields(x,keys){if(!x||typeof x!=='object')return false;const d=Object.getOwnPropertyDescriptors(x);return Reflect.ownKeys(d).length===keys.length&&keys.every(k=>d[k]&&'value'in d[k]);}
export const INVERSE_WAVE_ADAPTER_PROFILE='source-four-ball-inverse-wave-host-contract-v1';
export const INVERSE_WAVE_ADAPTER_CAPABILITY=Object.freeze({initialQueryAdmission:true,atomicRecordProjection:true,hostProjectionOnly:true,physicalProducerReceiptAvailable:false,solverCommitEnabled:false,winnerReplayImplemented:false,finalGameplayQualified:false,defaultEnabled:false});
function jobValue(j){return{id:j.id,kind:j.kind,solverId:j.solverId,branchId:j.branchId,purpose:j.purpose,settings:j.settings,topology:j.topology,wave:j.wave};}
function topologyId(t){return t.id||t.topologyId||JSON.stringify(globalThis.LabInverseEvents.expectedEvents(t));}
/** INITIAL-only authority: each query is an already admitted source plan plus
 * its exact raw input bank. A digest is not evidence that physics executed.
 * Nothing plans/reorders jobs or mutates the original planner here. */
export function createResidentInverseWaveContract({search,generationId,getGeneration,queries}={}){
 need(search&&search.req&&Array.isArray(search.pending)&&search.pending.length>0&&search.pending.length<=4096,'actual complete nonempty pending planner wave');
 need(typeof generationId==='string'&&generationId.length>0&&generationId.length<=256&&typeof getGeneration==='function'&&getGeneration()===generationId,'current exact generation authority');
 const req=search.req;need(!Object.hasOwn(req,'finalization')&&!search.finalization,'legacy source-query only; no automatic final-gameplay or route-policy upgrade');need(req.options?.gameMode==='four'&&req.options.mode==='carom','currently admitted four/carom source query only');
 need(Number.isSafeInteger(search.wave)&&search.wave>0,'original planner wave');const ids=new Set();for(const j of search.pending){need(j.req===req&&j.kind==='inverse-constraint'&&Number.isInteger(j.id)&&j.id>=0&&j.id<0xffffffff&&!ids.has(j.id)&&j.wave===search.wave-1,'distinct exact original job/req/wave');ids.add(j.id);need(typeof j.solverId==='string'&&typeof j.branchId==='string'&&j.settings&&Object.keys(j.settings).length===5&&keys.every(k=>Number.isFinite(j.settings[k])),'original solver/branch and five exact finite settings');fp(jobValue(j));}
 need(Array.isArray(queries)&&queries.length>0&&queries.length<=search.pending.length,'explicit bounded source query partitions');
 const jobs=Array.from(search.pending,j=>structuredClone(jobValue(j))),byId=new Map(jobs.map(j=>[j.id,j])),assigned=new Set(),bindings=[];
 for(const q of queries){need(fields(q,['plan','inputs']),'exact query plan/input pair');assertInverseQueryInitialInputs(q.plan,q.inputs);const p=q.plan,c=p.context,id=c.identity;need(p.kind===INVERSE_QUERY_JOIN_PROFILE&&id.generationId===generationId&&id.gameMode===req.options.gameMode&&id.mode===req.options.mode&&id.requiresFullRest===true,'exact source-query profile/generation/mode');need(id.initialSnapshotSha256===sha(req.snapshot.world),'exact current prestrike bytes');
  for(const row of id.candidates){const j=byId.get(row.id);need(j&&!assigned.has(row.id),'every original job belongs to exactly one query partition');need(row.purpose===j.purpose&&row.topologyId===topologyId(j.topology)&&row.topologyLength===globalThis.LabInverseEvents.expectedEvents(j.topology).length&&fp(row.settings)===fp(j.settings),'exact job purpose/topology/settings, including Number bits');need(id.requestSha256===sha(fp({request:req,topology:j.topology,purpose:j.purpose})),'complete original request/rules/source metadata and topology binding');assigned.add(row.id);}
  bindings.push({contractSha256:c.contractSha256,sourceSha256:id.sourceSha256,initialInputSha256:p.initialInputSha256,candidateIds:id.candidates.map(x=>x.id)});
 }
 need(assigned.size===jobs.length,'complete wave before any solver projection');
 const value={kind:INVERSE_WAVE_ADAPTER_PROFILE,version:1,generationId,wave:search.wave-1,requestSha256:sha(fp(req)),initialSnapshotSha256:sha(req.snapshot.world),jobs,queries:bindings,capability:INVERSE_WAVE_ADAPTER_CAPABILITY},contract=frozen({...value,contractSha256:sha(fp(value))});
 proofs.set(contract,{search,req,pending:search.pending,jobs:search.pending.slice(),requestFingerprint:fp(req),pendingFingerprint:fp(search.pending.map(jobValue)),generationId,getGeneration,wave:search.wave,queries:queries.map(q=>({plan:q.plan,inputs:q.inputs}))});return contract;
}
function current(contract){const p=proofs.get(contract);need(p,'same-realm original wave contract');need(p.getGeneration()===p.generationId,'stale request generation');need(p.search.req===p.req&&p.search.pending===p.pending&&p.search.wave===p.wave&&p.pending.length===p.jobs.length&&p.pending.every((j,i)=>j===p.jobs[i]&&j.req===p.req)&&fp(p.req)===p.requestFingerprint&&fp(p.pending.map(jobValue))===p.pendingFingerprint,'source/request/job order changed after admission');for(const q of p.queries)assertInverseQueryInitialInputs(q.plan,q.inputs);return p;}
/** Explicit test-only projection. Returned data NEVER grants permission to call
 * commitWave. No GPU/source truth is inferred from valid binary records.
 * Nonterminal/failed transport defers the WHOLE dependency wave: unlike calling
 * the legacy solver with missing arrays, it cannot become a malformed-residual
 * fallback or lose the resumable pending wave. */
export function projectResidentInverseWaveForHostTest({testOnly,contract,records}={}){
 need(testOnly===true,'explicit non-authoritative HOST test projection');const p=current(contract);need(Array.isArray(records)&&records.length===p.queries.length,'complete record partitions');const rows=new Map();
 records.forEach((record,i)=>{need(fields(record,['contractSha256','words'])&&record.contractSha256===contract.queries[i].contractSha256,'exact record partition/order identity');for(const row of decodeInverseTerminalObservations(p.queries[i].plan.context,record.words)){need(!rows.has(row.id),'duplicate result');rows.set(row.id,row);}});
 const ordered=contract.jobs.map(j=>rows.get(j.id));need(ordered.every(Boolean)&&rows.size===contract.jobs.length,'entire original result roster');
 const transport=ordered.map(r=>({id:r.id,status:r.status,reason:r.reason,boundary:r.boundary})),deferred=transport.filter(r=>!['evaluated','unsupported'].includes(r.status)),winners=ordered.filter(r=>r.status==='evaluated'&&r.observation.verified);
 const base={kind:'resident-inverse-wave-nonauthoritative-host-projection-v1',contractSha256:contract.contractSha256,generationId:contract.generationId,wave:contract.wave,qualificationGranted:false,committable:false,transport};
 if(deferred.length)return frozen({...base,status:'transport-unresolved',outcomes:null,deferred,winnerArtifactsRequired:[]});
 if(winners.length)return frozen({...base,status:'qualified-winner-artifact-required',outcomes:null,deferred:[],winnerArtifactsRequired:winners.map(r=>({id:r.id,purpose:'verify',requiresGenuineProducerReceipt:true,requiresSourceMatchedReplay:true,requiresFullRest:true}))});
 const outcomes=contract.jobs.map(j=>{const r=rows.get(j.id),common={id:topologyId(j.topology),settings:structuredClone(j.settings),purpose:j.purpose,physicalResult:null};return{id:j.id,outcome:r.status==='evaluated'?{...structuredClone(r.observation),...common}:{...common,status:'unsupported',reason:r.reason,unsupported:true,verified:false,goalVerified:false}};});
 return frozen({...base,status:'host-projection-only',outcomes,deferred:[],winnerArtifactsRequired:[]});
}
/** Intentionally NO public receipt-minting/qualification override. The current
 * resident runtime has not qualified the same-world observation producer to
 * terminal. A future reviewed source owner must supply an unforgeable receipt
 * path; hashes, Booleans, HOST projections and replay alone cannot replace it.
 * Reject before touching planner counters, solver state, pending jobs/archive.
 */
export function commitResidentInverseWave({contract}={}){current(contract);const error=new Error('Resident inverse observation producer is not qualified; original planner wave is unchanged');error.code='RESIDENT_INVERSE_PRODUCER_UNQUALIFIED';throw error;}
