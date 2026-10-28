// Cohesive original capture -> strict initial import -> physical admission.
// No detached receipt/seed inputs, continuation, GPU dispatch or public switch.
import {captureLiveRegisteredFourBall} from './live-capture.mjs';
import {importLiveRegisteredFourBall} from './live-registered-four-ball.mjs';
import {captureAcceptedEventHistory,validateSeedEventHistory} from '../source-event-history.mjs';
import {assertOwnedInputData,copy,equalData,equal,requireThat} from './exact-data.mjs';
const preparedCandidates=new WeakMap();
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function bindCaptured(raw,a,p){
 const pre=raw.capture.preStrikeApplication,post=raw.capture.application;
 equal(a.kind,'original-prestrike-cue-clearance');equal(a.strikeAccepted,true);
 requireThat(a.clearance?.clear===true&&Number.isFinite(a.clearance.distance)&&a.clearance.distance>=0,'Genuine finite clear admission required');
 equalData(a.settings,p.requested.settings);equalData(a.settings,p.applied.settings);
 equalData(a.rules,p.requested.rules);equalData(a.rules,p.applied.rules);
 equalData(a.settings,pre.controller.settings);equalData(a.settings,post.controller.settings);
 equal(a.rules.fourBallThreeCushion,post.game.pending.threeCushion);
 equal(a.selectedId,p.selectedId);equal(a.selectedId,pre.controller.selectedId);equal(a.selectedId,post.controller.selectedId);
 equal(a.time,pre.time);equal(a.sourceApplicationSteps,pre.steps);equal(a.sourceRevision,pre.revision);equal(a.sourceShots,pre.shots);
 equal(post.time,a.time);equal(post.steps,a.sourceApplicationSteps);equal(post.revision,a.sourceRevision+1);equal(post.shots,a.sourceShots+1);
 equalData(a.selectedBody,pre.registry.objects.find(o=>o.id===a.selectedId)?.body);
 equal(a.historyContactCount,pre.events.filter(e=>e.kind==='contact').length);
 const configured=copy(p.sourceApplication);configured.controller.settings=copy(a.settings);
 equalData(configured,pre,'Private candidate must differ from source application only by requested settings');
 equal(p.captureNativeSteps,0);equal(p.clearancePolicy,'original-fire-no-settings-restoration');
}
/**
 * Trusted original controller/engine and admitted read-only decoder required.
 * Owns and releases its temporary native fork on every path. Does not own the
 * caller's controller or decoder. Returned seed keeps importer hull authority.
 * Admission is source-bound data, NOT a signature or full-shot certification.
 */
export async function prepareLiveFourBallCandidate(options){
 requireThat(options&&typeof options==='object','Explicit preparation options required');
 const descriptors=Object.getOwnPropertyDescriptors(options),keys=Reflect.ownKeys(descriptors);
 requireThat(keys.every(k=>typeof k==='string'&&['controller','candidate','decoder','signal'].includes(k)&&'value'in descriptors[k])&&
   ['controller','candidate','decoder'].every(k=>Object.hasOwn(descriptors,k)),'Preparation accepts controller, candidate, decoder and optional signal only');
 const {controller,candidate,decoder,signal}=options;
 requireThat(typeof decoder?.decodeSnapshot==='function','Admitted read-only decoder required');
 const fixedDecoder={decodeSnapshot:decoder.decodeSnapshot.bind(decoder)};
 const check=()=>{if(signal?.aborted)throw signal.reason??new DOMException('Candidate preparation cancelled','AbortError');};
 check();let raw,admission,provenance;
 const sourceRequestSnapshot=copy(controller.lab.snapshot({trails:false}));
 const captured=captureLiveRegisteredFourBall({controller,candidate,signal});
 try{
  const owned={raw:{snapshot:captured.snapshot,preStrikeSnapshot:captured.preStrikeSnapshot,capture:captured.capture},admission:captured.candidateAdmission,provenance:captured.candidateProvenance};
  assertOwnedInputData(owned);const detached=copy(owned);assertOwnedInputData(detached);
  ({raw,admission,provenance}=detached);bindCaptured(raw,admission,provenance);equalData(sourceRequestSnapshot.world,raw.preStrikeSnapshot,'Prepared source request bytes differ');check();
 }finally{captured.dispose();}
 // No native fork remains live across decoder awaits. Raw bytes are private,
 // and importer independently copies/verifies both native snapshots.
 const seed=await importLiveRegisteredFourBall(fixedDecoder,raw);check();
 equal(seed.kind,'original-live-registered-four-ball-created-world');
 equal(seed.initialSnapshotSha256,seed.sourceOrigin.createdSnapshotSha256);
 equalData(seed.sourceOrigin.settings,admission.settings);equalData(seed.cueInitial.application.strikeSettings,admission.settings);
 equal(seed.selectedId,admission.selectedId);equalData(seed.sourceOrigin.selectedBody,admission.selectedBody);
 const clock=seed.sourceOrigin.preStrikeClock;
 equal(clock.time,admission.time);equal(clock.steps,admission.sourceApplicationSteps);equal(clock.shots,admission.sourceShots);equal(clock.revision,admission.sourceRevision);
 equal(seed.sourceApplicationTime,admission.time);equal(seed.sourceApplicationSteps,admission.sourceApplicationSteps);
 equal(seed.game.pending.threeCushion,admission.rules.fourBallThreeCushion);
 // The accepted stroke may evict the oldest event at the original120 cap.
 // Seed contacts describe CREATED history; admission count describes PRESTRIKE.
 equalData(seed.initialContactEvents,raw.capture.application.events.filter(e=>e.kind==='contact'));
 equal(raw.capture.preStrikeApplication.events.filter(e=>e.kind==='contact').length,admission.historyContactCount);
 const history=captureAcceptedEventHistory(raw.capture.preStrikeApplication,raw.capture.application);
 for(const [key,value]of Object.entries(history))equalData(seed[key],value,'Full application history must retain actual capture '+key);validateSeedEventHistory(seed);
 // The only added hash is supplied by the strict importer after byte checking.
 const result=Object.freeze({seed,admission:freeze({...admission,initialSnapshotSha256:seed.initialSnapshotSha256}),candidateProvenance:freeze(provenance)});
 preparedCandidates.set(result,{sourceRequestSnapshot,seed:ownSeed(seed)});return result;
}

// Same-realm identity, not a serializable authority or caller-supplied admission.
export function assertPreparedLiveFourBallCandidate(value,snapshot){
 const owned=preparedCandidates.get(value);requireThat(owned,'Cohesively prepared same-realm candidate required');
 requireThat(snapshot?.world instanceof Uint8Array,'Original source request snapshot required');
 equalData(snapshot,owned.sourceRequestSnapshot,'Request source snapshot differs from prepared source');
 for(const [key,expected]of Object.entries({time:value.admission.time,steps:value.admission.sourceApplicationSteps,revision:value.admission.sourceRevision,shots:value.admission.sourceShots}))equal(snapshot[key],expected,'Request source '+key+' differs');
 return Object.freeze({...value,seed:ownSeed(owned.seed)});
}

function ownSeed(seed){
 const owned=copy(seed);
 if(seed.cueEmptyConvexHulls)owned.cueEmptyConvexHulls=seed.cueEmptyConvexHulls.map((r,i)=>({...owned.cueEmptyConvexHulls[i],hull:r.hull}));
 if(seed.cushionSeeds)owned.cushionSeeds=seed.cushionSeeds.map((c,i)=>({...owned.cushionSeeds[i],cushions:c.cushions.map((r,j)=>({...owned.cushionSeeds[i].cushions[j],hull:r.hull}))}));
 return owned;
}
