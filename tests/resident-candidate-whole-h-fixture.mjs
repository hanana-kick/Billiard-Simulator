// Test-only independent original full-h oracle and semantic bank diagnostics.
// Expected snapshots are NEVER inputs to the resident candidate or its programs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import World from '../src/experimental-four-ball-world.js';
import SourceCueBroad from '../src/experimental-cue-broad-phase.js';
import SourceJournal from '../src/experimental-contact-graph-journal.js';
import SourceCushion from '../src/experimental-cushion-contact-stage.js';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {decodeContactJournal} from '../src/resident-candidate/contact-journal.mjs';
import {decodeContactRoster} from '../src/resident-candidate/contact-roster.mjs';
import {decodeSceneActivation,SCENE_LAYOUT} from '../src/resident-candidate/scene-activation.mjs';
import {unpackBvhState} from '../src/resident-candidate/bvh.mjs';
import {decodeCueClothCache} from '../src/resident-candidate/cue-cloth-cache.mjs';
import {COUPLED_BODY_OFFSETS as B} from '../src/resident-candidate/coupled-solver.mjs';
import {CUE_LAYOUT as Q} from '../src/resident-candidate/cue.mjs';
import {APPLICATION_LAYOUT as A} from '../src/resident-candidate/application.mjs';
import {WORLD_APPLICATION_LAYOUT as WA} from '../src/resident-candidate/world-application.mjs';
import {decodeRuleState,RULE_LAYOUT as R} from '../src/resident-candidate/physical-rules.mjs';
import {createWorldComparison,WHOLE_H_COMPARISON_COVERAGE} from './resident-candidate-world-comparison.mjs';
export {WHOLE_H_COMPARISON_COVERAGE};
export const {firstWorldMismatch,assertWorldEquivalent,projectWorldComparison,assertWholeHCommitted,compareWorldBank}=createWorldComparison(assert,{decodeContactJournal,decodeContactRoster,decodeSceneActivation,SCENE_LAYOUT,unpackBvhState,decodeCueClothCache,B,Q,A,WA,decodeRuleState,R});
const require=createRequire(import.meta.url);for(const n of ['math','physics','route-rules','optimizer-core','game-rules'])require('../src/'+n+'.js');
const Core=globalThis.ShotSearchCore,clone=structuredClone,U=0xffffffff;
export const DEFAULT_WHOLE_H_RULE=Object.freeze({firstId:3,secondId:4,method:'none',allowKiss:true,maxOuterSteps:15360});
/** Only this wrapper advances the untouched original CPU owner. It accepts no
 * prepared future receipts and gives the GPU harness only the INITIAL seed. */
export async function createWholeHOracle({rule=DEFAULT_WHOLE_H_RULE}={}){return createWholeHOracleFromSource(await originalRegisteredFixture(),{rule});}
/** Test-only variant: `source.seed` must be an independently admitted original
 * created seed with its original native hull ownership brands intact. Never
 * reconstruct it from resident outputs or feed its future snapshots to GPU. */
export async function createWholeHOracleFromSource(source,{rule=DEFAULT_WHOLE_H_RULE,cueNumberProfile}={}){
 assert.ok(source?.seed,'independently created original source seed required');
 const seed=source.seed,world=await World.createReferenceStepper(seed,cueNumberProfile===undefined?undefined:{cueNumberProfile}),initial=world.snapshot();
 // World.snapshot intentionally omits these owners until the first step. Read
 // their UNCHANGED original factories at frame0; no step, hand-written default,
 // resident encoder/decoder, or later reference receipt supplies expectations.
 const broad=await SourceCueBroad.createLiveRegisteredFourBallReferenceStage(seed.cueBroadSeed);let journal;try{journal=SourceJournal.createReferenceStageWithLiveRegisteredFourBallCue(seed.contactGraphSeed,broad);initial.contactGraph=journal.snapshot();}finally{journal?.dispose();broad.dispose();}
 initial.cushions=seed.cushionSeeds.map((s,i)=>{const owner=SourceCushion.createReferenceLiveRegisteredFourBallStage(s,seed.balls[i].state);try{return owner.snapshot().cushions;}finally{owner.dispose();}});
 const selected=seed.balls.find(b=>b.id===seed.selectedId),position=b=>({x:b.state.translation[0],y:b.state.translation[1],z:b.state.translation[2]});
 const request={selectedId:seed.selectedId,options:{gameMode:'four',mode:'carom',targetId:rule.firstId,secondId:rule.secondId,opponentId:seed.game.cueIds.find(id=>id!==seed.selectedId),fourBallThreeCushion:seed.game.threeCushion,allowKiss:rule.allowKiss,horizon:rule.maxOuterSteps*seed.cueInitial.application.dt,objective:'shortest',...(rule.method==='none'?{}:{methodId:rule.method})}};
 const accumulator=Core.createPhysicalAccumulator(clone(seed.cueInitial.application.strikeSettings),undefined,initial.time,position(selected));
 const game=new globalThis.FourBallGame();game.restore(initial.game);let lastGamePending=clone(initial.game.pending),restObserved=false;
 let current=initial,cursor=initial.contactEvents.length,stopped=false,disposed=false;
 const scoring=()=>({accumulator:clone(accumulator),game:{pending:clone(lastGamePending),finished:restObserved,firstId:rule.firstId,secondId:rule.secondId},stopped,status:stopped?(accumulator.verificationIncomplete?'incomplete':accumulator.success&&!accumulator.invalid?'pass':'miss'):'running'});
 return Object.freeze({...(cueNumberProfile===undefined?{}:{cueNumberProfile}),seed,initial:clone(initial),rule:clone(rule),artifactSha256:source.artifactSha256,scoring,
  async step(){assert.equal(disposed,false);assert.equal(stopped,false,'Do not continue an already-terminal physical query');const previous=current,next=await world.step();assert.equal(next.frame,previous.frame+1);assert.ok(next.time>previous.time);assert.equal(next.outerSubstep,(previous.outerSubstep+1)%previous.subdivisions);
   assert.ok(next.contactEvents.length>=cursor);for(let i=0;i<cursor;i++)assert.deepEqual(next.contactEvents[i],previous.contactEvents[i],'original append-only history');
   for(;cursor<next.contactEvents.length;cursor++){Core.observePhysicalEvent(request,accumulator,next.contactEvents[cursor]);game.contact(next.contactEvents[cursor]);}
   if(game.pending)lastGamePending=clone(game.pending);if(next.shotComplete)game.finish();assert.deepEqual(game.snapshot(),next.game,'independent unchanged gameplay observer');
   if(next.outerStep!==previous.outerStep){assert.equal(next.outerStep,previous.outerStep+1);const ball=id=>next.balls.find(b=>b.id===id);const input={dt:seed.cueInitial.application.dt,time:next.time,cuePresent:()=>next.cue.present,allSleeping:()=>next.balls.every(b=>b.state.sleeping),sphereIds:()=>next.balls.map(b=>b.id),radius:id=>ball(id)?.radius,position:id=>position(ball(id)),positiveImpulse:(id1,id2)=>{const indices=[ball(id1).index,ball(id2).index].sort((a,b)=>a-b),p=next.pairs.find(p=>p.ballIndices[0]===indices[0]&&p.ballIndices[1]===indices[1])?.pair;assert.ok(p,'Actual source pair cache required');return!!(p.pairPresent&&p.pointPresent&&p.impulse>0);}};restObserved||=!input.cuePresent()&&input.allSleeping();stopped=Core.observePhysicalStep(request,accumulator,input)||Core.finishPhysicalHorizon(request,accumulator,input);}
   current=next;return{snapshot:clone(next),scoring:scoring()};},
  snapshot:()=>clone(current),dispose(){if(!disposed){disposed=true;world.dispose();}}
 });
}
