(function(G){
'use strict';
// SPDX-License-Identifier: Apache-2.0
// Pure opt-in decision policy only. No world step, event sorting, game-rule
// reimplementation, solver adaptation, default selection, or GPU implementation.
const ROUTE_QUERY_POLICY = 'source-route-query-v1';
const GAMEPLAY_FINALIZATION_POLICY = 'source-gameplay-finalization-v1';
const PURPOSES = ['evaluate','residual','jacobian','trial','clearance','verify'];
const need = (ok, message) => { if (!ok) throw new RangeError('Source finalization policy: ' + message); };
const own = (x, keys) => {
  need(x && Object.getPrototypeOf(x) === Object.prototype, 'plain source data');
  const d = Object.getOwnPropertyDescriptors(x);
  need(Reflect.ownKeys(d).length === keys.length && keys.every(k => d[k] && 'value' in d[k]), 'exact fields ' + keys.join(','));
};
const id = n => Number.isSafeInteger(n) && n >= 0;
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const ids = a => Array.isArray(a) && a.length > 0 && a.every(id) && new Set(a).size === a.length;
const source = s => need(typeof s === 'string' && /^[0-9a-f]{64}$/.test(s), 'bound initial source SHA256');
function binding(input, query, sourceIdentity) {
  own(input, ['kind','sourceIdentity','gameKind','snapshot','worldObjectIds','shotRules']);
  need(input.kind === 'original-game-binding-v1' && input.sourceIdentity === sourceIdentity, 'original source-game binding');
  need(['three','four'].includes(input.gameKind), 'original game class');
  need(ids(input.worldObjectIds), 'complete ordered source lab.objects IDs');
  own(input.shotRules, ['threeCushion']);
  need(typeof input.shotRules.threeCushion === 'boolean', 'actual per-shot rule');
  const s = input.snapshot;
  need(s && s.pending === null && ids(s.cueIds) && s.cueIds.length === 2 && s.cueIds.includes(query.selectedId), 'ready original game and selected cue');
  need(s.cueIds.includes(s.activeCue) && s.scores && s.cueIds.every(i => Number.isSafeInteger(s.scores[i])), 'original turn and scores');
  if (input.gameKind === 'three') {
    need(query.gameMode === 'free' && query.mode === 'three', 'final ThreeBallGame intent must explicitly use its three-cushion goal; target/direct remain route queries');
    need(s.kind === 'three' && ids(s.objectIds) && s.objectIds.length === 3 && s.cueIds.every(i => s.objectIds.includes(i)), 'original ThreeBallGame object roster');
    need(input.shotRules.threeCushion === true, 'ThreeBallGame.begin always uses its original three-cushion rule');
    const targets = s.objectIds.filter(i => i !== query.selectedId);
    need(same([...targets].sort(), [query.targetId,query.secondId].sort()), 'source game targets, branch order may differ');
    need(s.objectIds.every(i => input.worldObjectIds.includes(i)), 'every game object belongs to source world');
  } else {
    need(query.gameMode === 'four' && query.mode === 'carom', 'final FourBallGame carom intent');
    need(ids(s.redIds) && s.redIds.length === 2 && !s.redIds.some(i => s.cueIds.includes(i)), 'original FourBallGame reds');
    need(same([...s.redIds].sort(), [query.targetId,query.secondId].sort()), 'original red targets');
    need([...s.cueIds,...s.redIds].every(i => input.worldObjectIds.includes(i)), 'every game object belongs to source world');
  }
  return structuredClone(input);
}

/** Caller chooses the named intent; never infer gameplay from gameMode.
 * Optional owners use this helper; omission retains all legacy behavior.
 * An explicitly selected gameplay search still uses ordinary legacy queries
 * for residual/Jacobian/trial/clearance; ONLY verify gets finalization semantics.
 */
function createSourceFinalizationPolicy(input) {
  own(input, ['policy','purpose','sourceIdentity','query','gameBinding']);
  need([ROUTE_QUERY_POLICY,GAMEPLAY_FINALIZATION_POLICY].includes(input.policy), 'explicit named policy');
  need(PURPOSES.includes(input.purpose), 'original inverse purpose'); source(input.sourceIdentity);
  own(input.query, ['gameMode','mode','selectedId','targetId','secondId']);
  const q = input.query;
  need([null,'free','four'].includes(q.gameMode) && ['target','direct','carom','three'].includes(q.mode), 'explicit source query mode');
  need(id(q.selectedId) && id(q.targetId) && q.targetId !== q.selectedId && (q.secondId === null || id(q.secondId)), 'original query identities');
  const b = input.policy === GAMEPLAY_FINALIZATION_POLICY ? binding(input.gameBinding,q,input.sourceIdentity) : null;
  if (input.policy === ROUTE_QUERY_POLICY) need(input.gameBinding === null, 'route-only policy does not acquire game authority');
  return freeze({kind:'source-query-finalization-policy-v1',...structuredClone(input),gameBinding:b,
    effective:input.policy === GAMEPLAY_FINALIZATION_POLICY && input.purpose === 'verify' ? 'final-gameplay-verify' : 'legacy-source-query'});
}
function checkedPolicy(p) {
  own(p,['kind','policy','purpose','sourceIdentity','query','gameBinding','effective']);
  need(p.kind === 'source-query-finalization-policy-v1', 'known policy');
  const {kind,effective,...input} = p, expected = createSourceFinalizationPolicy(input);
  need(effective === expected.effective, 'unchanged effective purpose'); return expected;
}
function gameFrame(p, frame, rested) {
  own(frame, ['snapshot','finalResult']);
  const b = p.gameBinding, original = b.snapshot, s = frame.snapshot, cue = p.query.selectedId;
  need(s && same(s.cueIds,original.cueIds), 'retained original cue roster');
  if (b.gameKind === 'three') need(s.kind === 'three' && same(s.objectIds,original.objectIds), 'retained three-ball roster');
  else need(same(s.redIds,original.redIds), 'retained four-ball roster');
  need(s.threeCushion === original.threeCushion, 'original default game rule cannot be rewritten');
  if (frame.finalResult === null) {
    need(s.pending && s.pending.cueId === cue && typeof s.pending.foul === 'boolean', 'actual pending original game');
    need(s.pending.threeCushion === b.shotRules.threeCushion, 'unchanged actual per-shot rule');
    if (b.gameKind === 'three') need(same(s.pending.targets,original.objectIds.filter(i => i !== cue)), 'original pending targets');
    need(s.activeCue === cue && same(s.scores,original.scores), 'pending original game has not published score');
    return {foul:s.pending.foul,final:null};
  }
  need(rested, 'original game finish result cannot be supplied before controller rest boundary');
  const r = frame.finalResult; own(r, ['cueId','delta','nextCue']);
  need(r.cueId === cue && (b.gameKind === 'three' ? [0,1] : [-1,0,1]).includes(r.delta) && original.cueIds.includes(r.nextCue), 'original game finish result shape');
  need(s.pending === null && s.activeCue === r.nextCue, 'original game is actually finished');
  need(r.nextCue === (r.delta>0?cue:original.cueIds.find(i=>i!==cue)), 'original game finish turn');
  need(original.cueIds.every(i => s.scores[i] === original.scores[i] + (i === cue ? r.delta : 0)), 'source score delta must equal original game finish result');
  return {foul:false,final:structuredClone(r)};
}

/** Pure decision over ORIGINAL completed outer observations. Source owner must
 * keep calling unchanged game.contact in source order after a route goal; this
 * helper neither receives/sorts events nor manufactures a game.finish result.
 * No source result is mutated. Callers must preserve ordinary error handling.
 */
function decideSourceFinalization(policy, frame) {
  const p = checkedPolicy(policy);
  need(frame && frame.sourceIdentity === p.sourceIdentity, 'same current source identity');
  if (p.effective === 'legacy-source-query') return freeze({action:'delegate-source-query',scope:'legacy-source-query',changesSourceResult:false,gameplayVerified:false});
  own(frame,['sourceIdentity','execution','route','physical','game']);
  own(frame.execution,['status','reason']);
  need(['running','physical-horizon','request-timeout','cancelled','stale-source','unsupported','failed'].includes(frame.execution.status), 'explicit execution state');
  need(frame.execution.reason === null || typeof frame.execution.reason === 'string', 'explicit operational reason');
  const out = (status, extra={}) => freeze({policy:p.policy,purpose:p.purpose,status,routeSatisfied:frame.route?.goalSatisfied===true,
    gameplayVerified:false,finishedGameResult:null,...extra});
  // Interruptions never become observations/misses, even if a goal was latched.
  if (['request-timeout','cancelled','stale-source','unsupported','failed'].includes(frame.execution.status))
    return out(frame.execution.status === 'request-timeout' ? 'incomplete' : frame.execution.status === 'stale-source' ? 'stale' : frame.execution.status,{reason:frame.execution.reason ?? frame.execution.status,routeSatisfied:null});
  own(frame.route,['complete','goalSatisfied','irreversiblyRejected']);need(['complete','goalSatisfied','irreversiblyRejected'].every(k=>typeof frame.route[k]==='boolean'),'actual original query complete/goal/irreversible-rejection predicates');
  need(!frame.route.irreversiblyRejected || frame.route.complete&&!frame.route.goalSatisfied,'irreversible route rejection is terminal and cannot also satisfy goal');
  own(frame.physical,['cuePresent','objects']);need(typeof frame.physical.cuePresent==='boolean'&&Array.isArray(frame.physical.objects),'actual original rest observations');
  need(frame.physical.objects.length===p.gameBinding.worldObjectIds.length,'all source objects including non-game additions');
  frame.physical.objects.forEach((o,i)=>{own(o,['id','sleeping']);need(o.id===p.gameBinding.worldObjectIds[i]&&typeof o.sleeping==='boolean','ordered exact source rest roster');});
  const rested=!frame.physical.cuePresent&&frame.physical.objects.every(o=>o.sleeping),g=gameFrame(p,frame.game,rested);
  // Foul is monotonic in the original pending game. This is a query proof,
  // NOT a speculative final delta/turn or early call to original game.finish.
  if(g.foul)return out('evaluated-negative',{reason:'irreversible-source-game-foul',queryTerminal:true,physicalRest:rested});
  if(g.final){
    need(frame.route.complete,'original query must also reach its own completion');
    const success=frame.route.goalSatisfied&&g.final.delta>0;
    return out(success?'verified-final-gameplay':'evaluated-negative',{reason:success?null:g.final.delta<=0?'source-game-did-not-score':'source-route-or-constraints-rejected',gameplayVerified:success,queryTerminal:true,physicalRest:true,finishedGameResult:g.final});
  }
  if(rested)return out('awaiting-original-game-finish',{reason:'controller-rest-boundary-reached',queryTerminal:false,physicalRest:true});
  if(frame.route.irreversiblyRejected)return out('evaluated-negative',{reason:'original-route-query-rejected',queryTerminal:true,physicalRest:false});
  if(frame.execution.status==='physical-horizon')return out('incomplete',{reason:frame.execution.reason??'gameplay-finalization-horizon',queryTerminal:false,physicalRest:false});
  return out('continue',{reason:'route-goal-is-not-final-gameplay',queryTerminal:false,physicalRest:false});
}

G.LabSourceFinalizationPolicy=Object.freeze({ROUTE_QUERY_POLICY,GAMEPLAY_FINALIZATION_POLICY,createSourceFinalizationPolicy,decideSourceFinalization});
})(globalThis);
