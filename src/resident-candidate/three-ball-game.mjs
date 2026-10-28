// SPDX-License-Identifier: Apache-2.0
// HOST discrete reference only. Exact ThreeBallGame semantics, not a forward
// solver, search reducer, GPU implementation, or production backend.
import * as O from '../experimental-live-three-ball-origin.js';
import {assertOwnedInputData} from '../browser-initial-import/exact-data.mjs';
const Origin=O.default??globalThis.LabLiveThreeBallOriginExperimental;
const copy=structuredClone,need=(ok,message)=>{if(!ok)throw Object.assign(new RangeError('Three-ball game HOST: '+message),{code:'three-ball-host-rule-contract'});};
export const THREE_BALL_GAME_CONTRACT=Object.freeze({version:1,kind:'ThreeBallGame',hostOnly:true,physics:false,gpu:false,runtimeIntegrated:false,
 source:'src/game-rules.js:12-17; src/controller.js:87',balls:3,cuePlayers:2,requiredCushions:3,
 opponentProhibited:false,missDelta:0,floorDelta:0,goalFrozenAtSecondDistinctTarget:true,sourceFinishHasNoPhysicalGate:true,
 controllerFinishOnlyAtFullPhysicalRest:true,searchTerminationImplemented:false});

export function validateThreeBallGame(input){
 assertOwnedInputData(input);Origin.validateGame(input);const g=copy(input),p=g.pending;
 if(p!==null){
  need(p&&Object.keys(p).sort().join(',')==='cueId,cushions,foul,goalCushions,reds,targets,threeCushion','exact pending fields');
  need(g.cueIds.includes(p.cueId)&&g.activeCue===p.cueId&&p.threeCushion===true,'original selected cue and fixed three-cushion rule');
  need(Origin.sameData(p.targets,g.objectIds.filter(id=>id!==p.cueId)),'both other balls in source object order');
  need(Array.isArray(p.reds)&&p.reds.length<=2&&new Set(p.reds).size===p.reds.length&&p.reds.every(id=>p.targets.includes(id)),'distinct actual targets');
  need(typeof p.foul==='boolean'&&Number.isSafeInteger(p.cushions)&&p.cushions>=0,'source foul/cushion state');
  need(p.reds.length===2?Number.isSafeInteger(p.goalCushions)&&p.goalCushions>=0&&p.goalCushions<=p.cushions:p.goalCushions===null,'second distinct hit freezes original cushion count');
 }
 return g;
}
// No state mutation on a rejected begin, matching the actual class.
export function beginThreeBallGame(input,cueId){
 const game=validateThreeBallGame(input);if(!game.cueIds.includes(cueId)||game.pending)return{accepted:false,game};
 game.activeCue=cueId;game.pending={cueId,reds:[],foul:false,threeCushion:true,cushions:0,goalCushions:null,targets:game.objectIds.filter(id=>id!==cueId)};
 return{accepted:true,game};
}
export function consumeThreeBallGameEvent(input,event){
 const game=validateThreeBallGame(input);assertOwnedInputData(event);
 need(event&&Object.getPrototypeOf(event)===Object.prototype,'original event data');
 const p=game.pending;if(!p||!event.a||!event.b)return game;
 const other=event.a.id===p.cueId?event.b:event.b.id===p.cueId?event.a:null;if(!other)return game;
 if(other.kind==='cushion'){need(p.cushions<Number.MAX_SAFE_INTEGER,'cushion counter overflow unsupported');p.cushions++;}
 if(p.targets.includes(other.id)&&!p.reds.includes(other.id)){p.reds.push(other.id);if(p.reds.length===2)p.goalCushions=p.cushions;}
 if(other.kind==='floor')p.foul=true;
 return game;
}
// Exact source game.finish() has NO physics/rest predicate. Keep this separate
// from the controller publication gate and from optimizer/search termination.
export function finishThreeBallGame(input){
 const game=validateThreeBallGame(input),p=game.pending;if(!p)return{result:null,game};
 const delta=!p.foul&&p.reds.length===2&&p.goalCushions>=3?1:0;
 need(game.scores[p.cueId]<=Number.MAX_SAFE_INTEGER-delta,'score overflow unsupported');game.scores[p.cueId]+=delta;
 game.activeCue=delta?p.cueId:game.cueIds.find(id=>id!==p.cueId);game.lastResult=delta?'득점 +1 · 차례 유지':'득점 없음 · 차례 교대';game.pending=null;
 return{result:{cueId:p.cueId,delta,nextCue:game.activeCue},game};
}
/** The controller waits for ALL THREE balls and cue removal, including after
 * a provisional goal. These are caller-owned source observations, not physics
 * predictions. No timeout, obstruction, or missing numerical owner becomes a
 * physical miss. No API accepts a fourth/opponent-only observation. */
export function finishThreeBallGameAtRest(input,observation){
 const game=validateThreeBallGame(input);assertOwnedInputData(observation);
 need(observation&&Object.keys(observation).sort().join(',')==='balls,cuePresent','exact source rest observation');
 need(typeof observation.cuePresent==='boolean'&&Array.isArray(observation.balls)&&observation.balls.length===3,'cue and three actual ball observations');
 observation.balls.forEach((b,i)=>need(b&&Object.keys(b).sort().join(',')==='id,sleeping'&&b.id===game.objectIds[i]&&typeof b.sleeping==='boolean','source-ordered original sleeping predicates'));
 if(!game.pending||observation.cuePresent||observation.balls.some(b=>!b.sleeping))return{status:game.pending?'pending':'idle',result:null,game};
 return{status:'finished',...finishThreeBallGame(game)};
}
