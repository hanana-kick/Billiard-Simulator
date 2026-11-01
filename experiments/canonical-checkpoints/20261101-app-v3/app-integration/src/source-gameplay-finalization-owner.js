/* Explicit CPU-only final-gameplay continuation. This owns no physics rules,
 * contacts, or scores: original PhysicsLab and original Game classes do. */
(function(G){
'use strict';
const KIND='source-gameplay-finalization-result-v1';
const need=(ok,message)=>{if(!ok)throw new Error('Source gameplay owner: '+message);};
function receipt(policy,decision,identity){
 return Object.freeze({kind:KIND,policy:policy.policy,sourceIdentity:policy.sourceIdentity,purpose:'verify',evaluationBinding:identity,
  status:decision.status,gameplayVerified:decision.gameplayVerified===true,
  physicalRest:decision.physicalRest===true,finishedGameResult:decision.finishedGameResult?Object.freeze({...decision.finishedGameResult}):null,
  reason:decision.reason??null});
}
function create(policy,search,trial,identity){
 need(policy?.effective==='final-gameplay-verify','explicit admitted verification policy required');
 need(trial?.lab instanceof G.PhysicsLab,'the retained original PhysicsLab is required');
 const b=policy.gameBinding,lab=trial.lab;
 need(trial.steps===0&&trial.start===lab.time&&lab.cue?.selectedId===policy.query.selectedId,'attach only at original accepted-strike t0');
 need(JSON.stringify(lab.objects.map(o=>o.id))===JSON.stringify(b.worldObjectIds),'complete original object roster');
 const game=b.gameKind==='three'?new G.ThreeBallGame():new G.FourBallGame();
 game.restore(b.snapshot);
 // Controller.strike first accepts PhysicsLab.strike and only THEN game.begin.
 // beginTrial has already accepted that original strike; do not replay stroke.
 need(game.begin(policy.query.selectedId,b.shotRules)===true,'original game must accept the selected cue');
 need(identity?.kind==='source-finalization-evaluation-binding-v1'&&identity.sourceIdentity===policy.sourceIdentity&&identity.purpose==='verify','exact admitted evaluation binding');
 const candidate=identity;
 need(['angle','elevation','speed','tipX','tipY'].every(k=>Object.is(candidate.settings[k],trial.settings[k])),'accepted strike uses exact requested inputs');
 const owner={policy,search,trial,game,identity:candidate,queryStopped:false,finishedGameResult:null,decision:null,restored:false,originalOnEvent:lab.onEvent};
 owner.onEvent=function(event){owner.originalOnEvent?.call(this,event);game.contact(event);};
 lab.onEvent=owner.onEvent;
 return owner;
}
function observe(owner,readRoute,execution='running',reason=null){
 const {policy,trial,game}=owner,lab=trial.lab;
 const physical={cuePresent:!!lab.cue,objects:lab.objects.map(o=>({id:o.id,sleeping:o.body.isSleeping()}))};
 const rested=!physical.cuePresent&&physical.objects.every(o=>o.sleeping);
 // Exact Controller.finishGameShot guard, after the complete original outer.
 // No inferred score, no synthetic sleeping and no early game.finish call.
 if(rested&&game.pending)owner.finishedGameResult=game.finish();
 const route=readRoute(owner.queryStopped||rested||execution==='physical-horizon');
 owner.decision=G.LabSourceFinalizationPolicy.decideSourceFinalization(policy,{
  sourceIdentity:policy.sourceIdentity,execution:{status:execution,reason},route,physical,
  game:{snapshot:game.snapshot(),finalResult:owner.finishedGameResult}
 });
 return !['continue','awaiting-original-game-finish'].includes(owner.decision.status);
}
function advance(owner,readRoute){
 need(!owner.restored&&!owner.decision?.queryTerminal,'retained continuation is still active');
 const {search,trial}=owner,max=Math.round(search.req.options.horizon/trial.input.dt);
 if(trial.steps>=max)return observe(owner,readRoute,'physical-horizon','gameplay-finalization-horizon');
 // Bypass ONLY the legacy QUERY early return. This is the same authentic
 // PhysicsLab.step and unchanged route observation, never a toy forward step.
 owner.queryStopped=G.ShotSearchCore.stepTrialOuter(search,trial)||owner.queryStopped;
 return observe(owner,readRoute,trial.steps>=max?'physical-horizon':'running',trial.steps>=max?'gameplay-finalization-horizon':null);
}
function interrupt(owner,status,reason=null){
 need(['request-timeout','cancelled','stale-source','unsupported','failed'].includes(status),'explicit operational interruption');
 owner.decision=G.LabSourceFinalizationPolicy.decideSourceFinalization(owner.policy,{
  sourceIdentity:owner.policy.sourceIdentity,execution:{status,reason},route:null,physical:null,game:null
 });
 return receipt(owner.policy,owner.decision,owner.identity);
}
function result(owner){need(owner.decision&&!['continue','awaiting-original-game-finish'].includes(owner.decision.status),'terminal decision required');return receipt(owner.policy,owner.decision,owner.identity);}
function rejected(policy,reason,identity){return receipt(policy,{status:'evaluated-negative',reason,gameplayVerified:false,physicalRest:false,finishedGameResult:null},identity);}
function restore(owner){if(!owner||owner.restored)return;owner.trial.lab.onEvent=owner.originalOnEvent;owner.restored=true;}
G.LabSourceGameplayFinalizationOwner=Object.freeze({create,advance,interrupt,result,rejected,restore});
})(globalThis);
