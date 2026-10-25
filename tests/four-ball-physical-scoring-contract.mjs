// Structural adapter tests only. These synthetic inputs are NOT physics evidence.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createFourBallPhysicalScoring} from '../src/experimental-four-ball-physical-scoring.mjs';
const h=index=>({index,generation:0});
function fixture(){
 const settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0},objects=[1,2,3,4].map(id=>({id,shape:'sphere',radius:.03,body:h(id),pairCollider:{handle:h(2*id+1)}}));
 const balls=objects.map(o=>({id:o.id,body:o.body,pairCollider:o.pairCollider.handle,state:{translation:[o.id*.1,.03,0],sleeping:false}}));
 const pairSeeds=[];for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)pairSeeds.push({key:`${a}${b}`,ballIndices:[a,b],seed:{bodies:[objects[a],objects[b]].map(o=>({bodyHandle:o.body,pairCollider:o.pairCollider.handle}))}});
 const seed={kind:'original-live-registered-four-ball-created-world',selectedId:1,initialSnapshotSha256:'unit-only',sourceApplicationTime:2,sourceApplicationSteps:100,sceneRegistry:{objects},balls,pairSeeds,initialContactEvents:[],cueInitial:{application:{strikeSettings:settings,dt:1/960}}};
 const initial={frame:0,outerStep:0,outerSubstep:0,subdivisions:2,time:2,sourceApplicationSteps:100,contactEvents:[],cue:{present:true},balls,pairs:pairSeeds.map(p=>({key:p.key,ballIndices:p.ballIndices,pair:{pairPresent:1,pointPresent:1,impulse:0}}))};
 const request={selectedId:1,settings,options:{gameMode:'four',mode:'carom',opponentId:2,targetId:3,secondId:4,fourBallThreeCushion:false,horizon:8,objective:'shortest'}};
 const admission={kind:'original-prestrike-cue-clearance',initialSnapshotSha256:'unit-only',selectedId:1,settings,time:2,sourceApplicationSteps:100,historyContactCount:0,strikeAccepted:true,clearance:{clear:true,distance:.01}};
 const calls=[],core={createPhysicalAccumulator:()=>({steps:0}),observePhysicalEvent:(r,t,e)=>calls.push(['event',e]),observePhysicalStep:(r,t,input)=>{t.steps++;calls.push(['outer',input.positiveImpulse(1,2)]);return false;},finishPhysicalHorizon:()=>false,physicalResult:()=>{throw Error('not a physical fixture');}};
 const next=(n,events=[])=>({...structuredClone(initial),frame:n,outerStep:Math.floor(n/2),outerSubstep:n%2,time:2+n/1920,sourceApplicationSteps:100+Math.floor(n/2),contactEvents:events});
 return{seed,initial,request,admission,core,calls,next};
}
test('only completed outer boundaries score, events delivered exactly once in order',()=>{
 const f=fixture(),c=createFourBallPhysicalScoring(f),event={kind:'contact',time:2.0001};
 c.consume(f.next(1,[event]));assert.deepEqual(f.calls,[['event',event]]);
 c.consume(f.next(2,[event]));assert.deepEqual(f.calls,[['event',event],['outer',false]]);
 assert.throws(()=>c.consume(f.next(2,[event])),/next committed/);assert.throws(()=>c.finish(),/partial/);
});
test('final point presence and impulse, not graph active/game score/earlier substep OR, control impact',()=>{
 const f=fixture(),c=createFourBallPhysicalScoring(f),a=f.next(1),b=f.next(2);a.pairs[0].pair.impulse=1;b.pairs[0].pair.impulse=1;b.pairs[0].pair.pointPresent=0;b.game={score:100};
 c.consume(a);c.consume(b);assert.deepEqual(f.calls,[['outer',false]]);
 const q=fixture(),d=createFourBallPhysicalScoring(q);d.consume(q.next(1));const end=q.next(2);end.pairs[0].pair.impulse=1;end.pairs[0].pair.active=0;d.consume(end);assert.deepEqual(q.calls,[['outer',true]]);
});
test('missing admission, altered identities, missing final cache and skipped phase fail closed',()=>{
 const f=fixture();for(const admission of [undefined,{...f.admission,clearance:{clear:true}},{...f.admission,initialSnapshotSha256:'wrong'}])assert.throws(()=>createFourBallPhysicalScoring({...f,admission}),/admission|distance/);
 const bad=structuredClone(f.seed);bad.pairSeeds[0].seed.bodies[0].pairCollider=h(99);assert.throws(()=>createFourBallPhysicalScoring({...f,seed:bad}),/identities/);
 const c=createFourBallPhysicalScoring(f);assert.throws(()=>c.consume({...f.next(1),outerSubstep:8}),/consecutive outer/);
 c.consume(f.next(1));const end=f.next(2);delete end.pairs;assert.throws(()=>c.consume(end),/pair identity/);
});
test('initial presentation history is skipped, not mistaken for this shot contacts',()=>{
 const f=fixture(),old={kind:'contact',time:1};f.initial.contactEvents=[old];f.seed.initialContactEvents=[old];f.admission.historyContactCount=1;
 const c=createFourBallPhysicalScoring(f);c.consume(f.next(1,[old]));assert.deepEqual(f.calls,[]);
});
