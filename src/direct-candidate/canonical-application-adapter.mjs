/** Opt-in application boundary; submission/presentation remain read-only.
 * Stored manual results may explicitly commit canonical REST. It never strikes/steps/restores a
 * PhysicsLab, mutates the game, or treats a selected-shot loop as batch search. */
import {encodeCanonicalScene, createCanonicalRequest, createCanonicalCandidate,
  canonicalResultIdentity, CanonicalContractError} from './canonical-engine-contract.mjs';
import {createCanonicalSessionService} from './canonical-session-service.mjs';
const own = x => structuredClone(x);
const stable = x => Array.isArray(x) ? '['+x.map(stable).join(',')+']' : x && typeof x==='object'
  ? '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}' : JSON.stringify(x);
const fail = (code, message) => new CanonicalContractError(code, message);
const sameSet = (a,b) => Array.isArray(a) && a.length===b.length && new Set(a).size===a.length && [...a].sort((x,y)=>x-y).every((x,i)=>x===[...b].sort((x,y)=>x-y)[i]);
export const CANONICAL_APPLICATION_CAPABILITIES = Object.freeze({
  experimental:true, productionEnabled:false, mutatesLab:false, mutatesGame:false,
  searchBatchImplemented:false, scoreAndTurnCommitImplemented:false,
  presentation:'exact source points only; bounded/unavailable samples remain explicit',
  physicalHardwareVerified:false,
});
/** Match actual game snapshots, not route-search filters. This does not begin,
 * finish, score, or change the active cue of either game. */
export function canonicalApplicationRules(game, selectedId, objectIds) {
  if (!game || game.pending) throw fail('GAME_NOT_READY','A complete idle game snapshot is required');
  if (!Array.isArray(game.cueIds) || game.cueIds.length!==2 || new Set(game.cueIds).size!==2 || !game.cueIds.includes(selectedId))
    throw fail('GAME_ROSTER_MISMATCH','Selected ID must be one of the actual two cue IDs');
  let firstId,secondId,opponentId=null,threeCushion;
  if (game.kind==='three') {
    if (objectIds.length!==3 || !sameSet(game.objectIds,objectIds) || game.cueIds.some(id=>!objectIds.includes(id)))
      throw fail('GAME_ROSTER_MISMATCH','Three-ball game must describe the entire physical roster');
    [firstId,secondId]=objectIds.filter(id=>id!==selectedId);threeCushion=true;
  } else {
    if (game.kind!==undefined && game.kind!=='four') throw fail('GAME_UNSUPPORTED','Unknown game implementation');
    if (objectIds.length!==4 || !Array.isArray(game.redIds) || game.redIds.length!==2 ||
        !sameSet([...game.cueIds,...game.redIds],objectIds) || typeof game.threeCushion!=='boolean')
      throw fail('GAME_ROSTER_MISMATCH','Four-ball cue/red IDs must account for every physical ball');
    [firstId,secondId]=game.redIds;opponentId=game.cueIds.find(id=>id!==selectedId);threeCushion=game.threeCushion;
  }
  return Object.freeze({game:objectIds.length,firstId,secondId,opponentId,threeCushion,
    search:false,method:'carom',minCushions:threeCushion?3:0,allowKiss:true,kissFacts:false,conditionOnly:false});
}
function core({lab,stateStore,selectedWorldProfile,readContext,session},implementation) {
  const canonicalSource=stateStore!==undefined;
  if(canonicalSource && (!stateStore || ['readScene','readRevision','readProvenance','readClock'].some(k=>typeof stateStore[k]!=='function') ||
      !['mmq1-ball-ball','mmq2-cushion'].includes(selectedWorldProfile) ||
      stateStore.capabilities?.selectedWorldProfile!==selectedWorldProfile ||
      session?.selectedWorldProfile!==selectedWorldProfile || session?.capabilities?.selectedWorldProfile!==selectedWorldProfile))
    throw fail('APPLICATION_SOURCE_PROFILE_MISMATCH','Explicit store and selected-session profiles must match exactly');
  if ((!canonicalSource && (!lab || typeof lab.snapshot!=='function' || !Array.isArray(lab.objects) || !Array.isArray(lab.statics))) ||
      typeof readContext!=='function' || typeof session?.runSelected!=='function' || typeof session?.cancel!=='function')
    throw TypeError('Complete PhysicsLab, context reader and selected-session interface required');
  let epoch=0,disposed=false;
  const open=()=>{if(disposed)throw fail('APPLICATION_DISPOSED','Create a new application adapter');};
  const capture=()=>{
    const context=own(readContext());
    if (!context || Object.keys(context).sort().join(',')!=='game,selectedId,settings')
      throw TypeError('Context must contain exactly selectedId, settings and complete game snapshot');
    if(canonicalSource) {
      const revision=stateStore.readRevision(),scene=stateStore.readScene(),provenance=stateStore.readProvenance(),clock=stateStore.readClock();
      if(provenance!==null && (provenance.selectedWorldProfile!==selectedWorldProfile ||
          (selectedWorldProfile==='mmq2-cushion' && provenance.identity?.selectedWorldProfile!==selectedWorldProfile)))
        throw fail('APPLICATION_SOURCE_PROVENANCE_MISMATCH','State provenance must retain the selected-world profile');
      if(revision!==stateStore.readRevision())throw fail('STALE_APPLICATION_RESULT','State changed during capture');
      return {context,admission:{admitted:true,scene},revision,clock,stamp:stable({sceneId:scene.sceneId,provenance,clock,context})};
    }
    // Snapshot is authoritative. No rounding, height snap, subset, material
    // substitution or native-world replay. This currently serializes native
    // snapshot bytes too; no cheap revision-only/per-frame performance claim.
    const snapshot=lab.snapshot({trails:false});
    const manifest={objectIds:lab.objects.map(o=>o.id),staticCount:lab.statics.length};
    const admission=encodeCanonicalScene(snapshot,manifest);
    const stamp=stable({sceneId:admission.scene?.sceneId??null,admitted:admission.admitted,
      clock:{revision:snapshot.revision,steps:snapshot.steps,time:snapshot.time,shots:snapshot.shots},context,manifest});
    return {context,admission,stamp};
  };
  const invalidate=reason=>{epoch++;session.cancel(reason);};
  return Object.freeze({
    capabilities:Object.freeze({...CANONICAL_APPLICATION_CAPABILITIES,implementation,
      ...(canonicalSource?{stateSource:'canonical-state-store-v1',selectedWorldProfile}:{}),
      selectedSession:own(session.capabilities??{})}),
    cancel(reason='application cancelled'){invalidate(reason);},
    dispose(){if(!disposed){disposed=true;invalidate('application disposed');session.dispose?.();}},
    runSearch(){throw fail('APPLICATION_SEARCH_UNIMPLEMENTED','Use an explicitly compatible current-source batch service; selected-shot loops and frozen-model fallback are forbidden');},
    async runSelected({purpose,requestId,candidateId,raw,continuation,budget,executionProfile,
      maximumRecords=128,strikeBackend='staged',signal}={}) {
      open();invalidate('application request replacement');const token=epoch;
      if (!['manual','forecast'].includes(purpose)) throw fail('APPLICATION_PURPOSE_UNSUPPORTED','Only selected manual/forecast requests are implemented');
      const start=capture();
      if(canonicalSource&&start.clock!==null&&raw?.absoluteTick!==start.clock)throw fail('APPLICATION_CLOCK_MISMATCH','Request must retain the owned absolute clock');
      const current=(expectedRevision=start.revision)=>{
        open();if(token!==epoch)throw fail('STALE_APPLICATION_RESULT','Application request was superseded');
        if(signal?.aborted)throw fail('CANCELLED','Discard externally cancelled result');
        let now;try{now=capture();}catch{invalidate('live scene unavailable');throw fail('STALE_APPLICATION_RESULT','Live scene cannot still authorize this result');}
        if(now.stamp!==start.stamp || now.revision!==expectedRevision){invalidate('physical scene or game/context changed');throw fail('STALE_APPLICATION_RESULT','Physical scene, settings, game or clock changed');}
      };
      current();
      if(!start.admission.admitted)return Object.freeze({kind:'canonical-application-rejected-v1',implementation,
        reasons:own(start.admission.reasons),physicsResultComplete:false,captureComplete:false,assertCurrent:current});
      const rules=canonicalApplicationRules(start.context.game,start.context.selectedId,start.admission.scene.slotToId);
      const input=own({request:{scene:start.admission.scene,requestId,selectedId:start.context.selectedId,purpose,rules,executionProfile,budget},
        candidateId,settings:start.context.settings,raw,continuation,maximumRecords,strikeBackend});
      let result;try{result=await session.runSelected({...own(input),signal});}catch(error){current();throw error;}
      current();
      if(!result?.identity)throw fail('APPLICATION_IDENTITY_MISMATCH','Session output is missing its immutable identity');
      const request=createCanonicalRequest({...input.request,epoch:result.identity.epoch});
      const candidate=createCanonicalCandidate(request,candidateId,input.settings),baseIdentity=canonicalResultIdentity(candidate),
        expected=canonicalSource&&selectedWorldProfile==='mmq2-cushion'?{...baseIdentity,selectedWorldProfile}:baseIdentity;
      if(canonicalSource&&result.selectedWorldProfile!==selectedWorldProfile)
        throw fail('APPLICATION_IDENTITY_MISMATCH','Session receipt selected-world profile must match the authoritative source');
      if(stable(expected)!==stable(result?.identity))throw fail('APPLICATION_IDENTITY_MISMATCH','Session output must match exact snapshot, game rules and raw settings');
      if(result.kind==='canonical-session-selected-result-v1'&&!candidate.admitted)throw fail('APPLICATION_BACKEND_CONTRACT','Unsupported raw settings cannot produce an evaluated result');
      if(typeof result.assertCurrent!=='function')throw fail('APPLICATION_BACKEND_CONTRACT','Session result requires an epoch guard');
      const valid=()=>{current();result.assertCurrent();};valid();
      if(result.kind!=='canonical-session-selected-result-v1')return Object.freeze({
        kind:'canonical-application-incomplete-v1',implementation,identity:own(expected),
        sourceKind:result.kind,reasons:own(result.reasons??[]),physicsResultComplete:false,captureComplete:false,
        assertCurrent:valid,
      });
      if(!['readCompact','readFinalState','sample'].every(k=>typeof result[k]==='function') ||
         !['physicsResultComplete','captureComplete','samplingComplete'].every(k=>typeof result[k]==='boolean'))
        throw fail('APPLICATION_BACKEND_CONTRACT','Selected result must retain independent completion flags and source accessors');
      const {physicsResultComplete,captureComplete,samplingComplete}=result;
      const finalState=own(result.readFinalState()),compact=own(result.readCompact());valid();
      if(!(finalState instanceof Uint32Array)||finalState.length!==256||finalState[0]!==candidateId||
         finalState[3]!==request.slotToId.length||finalState[41]!==input.raw.sceneKey||finalState[42]!==input.raw.requestKey||
         request.slotToId.some((id,i)=>finalState[64+48*i]!==id)||
         finalState[5]<input.raw.absoluteTick||finalState[5]>input.raw.absoluteTick+input.request.budget.maximumTicks||
         physicsResultComplete!==(finalState[1]===9)||
         !(compact instanceof Uint32Array)||compact.length!==4||compact[0]!==candidateId)
        throw fail('APPLICATION_BACKEND_CONTRACT','Selected final state, clock, completion and compact identity must match the whole request');
      const sampleAt=(tick,options)=>{valid();const sample=own(result.sample(tick,options));valid();
        if(['exact-boundary','exact-source'].includes(sample.status)&&
           (sample.tick!==tick||sample.interpolation!==false||stable(sample.slotToId)!==stable(request.slotToId)||
            !(sample.state instanceof Uint32Array)||sample.state.length!==40||request.slotToId.some((id,i)=>sample.state[10*i]!==id)))
          throw fail('APPLICATION_BACKEND_CONTRACT','Exact source sample must retain the entire stable-ID roster and requested clock');
        return sample;};
      return Object.freeze({kind:'canonical-application-selected-v1',implementation,identity:own(expected),
        purpose,physicsResultComplete,captureComplete,
        samplingComplete,scoreAndTurnCommitted:false,assertCurrent:valid,
        ...(canonicalSource && purpose==='manual'?{commitState(){
          valid();
          if(!physicsResultComplete)throw fail('APPLICATION_COMMIT_INCOMPLETE','Only complete physical REST may commit');
          if(typeof result.readSubmission!=='function'||typeof stateStore.begin!=='function')
            throw fail('APPLICATION_BACKEND_CONTRACT','Commit requires the guarded original session submission and state owner');
          const submission=result.readSubmission();valid();
          if(stable(submission?.request)!==stable(request)||stable(submission?.candidate)!==stable(candidate)||
             stable(submission?.raw)!==stable(input.raw))
            throw fail('APPLICATION_IDENTITY_MISMATCH','Commit must use the exact session-created request, candidate and raw settings');
          // No await or caller-owned epoch. begin alone advances the revision;
          // all other source/context/epoch guards remain live during commit.
          const transaction=stateStore.begin(submission),commitRevision=start.revision+1;
          const commitGuard=()=>{current(commitRevision);result.assertCurrent();};
          commitGuard();
          const snapshot=transaction.commit({...result,assertCurrent:commitGuard});
          return Object.freeze({kind:'canonical-application-state-commit-v1',
            identity:own(expected),sourceRevision:start.revision,revision:stateStore.readRevision(),
            provenance:stateStore.readProvenance(),snapshot,scoreAndTurnCommitted:false});
        }}:{}),
        readSourceContext(){valid();return own(start.context);},
        readOutcome(){valid();return {packet:compact.slice(),scoringEligible:physicsResultComplete&&[1,2].includes(compact[1])&&compact[3]!==0x80000000,
            scoreAndTurnCommitted:false};},
        readFinalState(){valid();return finalState.slice();},
        sampleAt,
        presentAt(tick,present,options){if(typeof present!=='function')throw TypeError('Presentation callback required');
          const sample=sampleAt(tick,options);
          // A bounded reference state is NOT an exact canonical point. No
          // interpolation/replay or conversion of missing data into a path.
          if(!captureComplete||!['exact-boundary','exact-source'].includes(sample.status))return {presented:false,sample};
          valid();present(own(sample));valid();return {presented:true,sample};},
      });
    },
  });
}
export function createCanonicalApplicationAdapter({lab,readContext,device}={}) {
  return core({lab,readContext,session:createCanonicalSessionService({device})},'webgpu-session-adapter-v1');
}
/** Explicit test seam, never reported as a real GPU or application qualification. */
export function createCanonicalApplicationAdapterHarness({lab,readContext,session}={}) {
  return core({lab,readContext,session},'injected-test-adapter-v1');
}

/** Explicit alternative source; never reads presentation/Rapier poses.
 * runSelected stays read-only; manual results offer an explicit commitState(). */
export function createCanonicalStateApplicationAdapter({stateStore,selectedWorldProfile,readContext,device}={}) {
  return core({stateStore,selectedWorldProfile,readContext,
    session:createCanonicalSessionService({device,selectedWorldProfile})},'webgpu-state-session-adapter-v1');
}
/** Injected lifecycle evidence only, not native GPU physics qualification. */
export function createCanonicalStateApplicationAdapterHarness({stateStore,selectedWorldProfile,readContext,session}={}) {
  return core({stateStore,selectedWorldProfile,readContext,session},'injected-test-state-adapter-v1');
}
