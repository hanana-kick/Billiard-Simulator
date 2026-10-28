import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../src/game-rules.js';
import {beginThreeBallGame,consumeThreeBallGameEvent,finishThreeBallGame,finishThreeBallGameAtRest,validateThreeBallGame} from '../src/resident-candidate/three-ball-game.mjs';
const rest=g=>({cuePresent:false,balls:g.objectIds.map(id=>({id,sleeping:true}))});
const hit=(cue,id,kind='ball',reverse=false)=>{const a={id:cue,kind:'ball'},b={id,kind};return{kind:'contact',label:'discrete source-rule fixture',time:0,a:reverse?b:a,b:reverse?a:b};};
test('HOST reducer equals independent original ThreeBallGame over bounded event permutations for both cue choices',()=>{
 // These are discrete semantic fixtures, NOT invented physical trajectories.
 let sequences=0;
 for(const cue of [1,2]){
  const targets=[1,2,3].filter(id=>id!==cue),alphabet=[hit(cue,targets[0]),hit(cue,targets[1],'ball',true),hit(cue,null,'cushion'),hit(cue,null,'floor'),hit(targets[0],targets[1]),{kind:'contact',label:'unkeyed compliant event',time:0}];
  for(let code=0;code<6**4;code++){
   const original=new globalThis.ThreeBallGame(),begun=beginThreeBallGame(original.snapshot(),cue);assert.equal(original.begin(cue),begun.accepted);let state=begun.game;
   let n=code;const events=[hit(cue,null,'cushion'),hit(cue,null,'cushion'),hit(cue,null,'cushion')];for(let i=0;i<4;i++){events.push(alphabet[n%6]);n=Math.floor(n/6);}
   for(const event of events){original.contact(event);state=consumeThreeBallGameEvent(state,event);assert.deepEqual(state,original.snapshot());}
   const out=finishThreeBallGame(state),{status,...controlled}=finishThreeBallGameAtRest(state,rest(state));assert.equal(status,'finished');assert.deepEqual(out,controlled);assert.deepEqual(out.result,original.finish());assert.deepEqual(out.game,original.snapshot());sequences++;
  }
 }
 assert.equal(sequences,2592);
});
test('late cushions never rescue an early second hit; a later floor cancels score, not minus one',()=>{
 for(const floor of [false,true]){
  let state=beginThreeBallGame(new ThreeBallGame().snapshot(),1).game;
  const events=floor?[...Array.from({length:3},()=>hit(1,null,'cushion')),hit(1,2),hit(1,3),hit(1,null,'floor')]:[hit(1,2),hit(1,3),...Array.from({length:3},()=>hit(1,null,'cushion'))];
  for(const e of events)state=consumeThreeBallGameEvent(state,e);
  assert.deepEqual(finishThreeBallGameAtRest(state,rest(state)).result,{cueId:1,delta:0,nextCue:2});
 }
});
test('source full-rest gate includes other target, no cue and all three identities; invalid contract is not a miss',()=>{
 const before=new ThreeBallGame().snapshot();assert.equal(beginThreeBallGame(before,3).accepted,false);
 let state=beginThreeBallGame(before,2).game;assert.equal(beginThreeBallGame(state,1).accepted,false);
 for(const e of [hit(2,1),...Array.from({length:3},()=>hit(2,null,'cushion')),hit(2,3)])state=consumeThreeBallGameEvent(state,e);
 for(const observation of [{...rest(state),cuePresent:true},{...rest(state),balls:rest(state).balls.map(b=>({...b,sleeping:b.id!==3}))}]){
  const out=finishThreeBallGameAtRest(state,observation);assert.equal(out.status,'pending');assert.equal(out.result,null);assert.deepEqual(out.game,state);
 }
 assert.deepEqual(finishThreeBallGameAtRest(state,rest(state)).result,{cueId:2,delta:1,nextCue:2});
 for(const change of [s=>s.objectIds.push(4),s=>s.pending.targets=[3,4],s=>s.pending.threeCushion=false,s=>s.redIds=[3,4],s=>s.pending.goalCushions=null]){const bad=structuredClone(state);change(bad);assert.throws(()=>validateThreeBallGame(bad));}
 assert.throws(()=>finishThreeBallGameAtRest(state,{cuePresent:false,balls:[...rest(state).balls,{id:4,sleeping:true}]}));
 assert.throws(()=>finishThreeBallGameAtRest(state,{...rest(state),opponentImpulse:true}));
});
