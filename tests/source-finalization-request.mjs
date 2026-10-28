// Data/admission tests only. Synthetic world bytes are not a physical snapshot
// proof; original game classes supply real ready game snapshot structures.
import test from 'node:test';import assert from 'node:assert/strict';
import '../src/game-rules.js';import * as policy from '../src/source-query-finalization-policy.mjs';
globalThis.LabSourceFinalizationPolicy=policy;await import('../src/source-finalization-request.js');
const A=globalThis.LabSourceFinalizationRequest;
const settings=()=>({angle:0,elevation:8,speed:2,tipX:-0,tipY:0});
function source({four=false}={}){const game=four?new FourBallGame():new ThreeBallGame(),ids=four?[1,2,3,4]:[1,2,3],req={snapshot:{world:Uint8Array.of(1,2,3),dt:1/960,objects:ids.map(id=>({id,shape:'sphere'})),optional:undefined},selectedId:1,settings:settings(),options:{gameMode:four?'four':'free',mode:four?'carom':'three',targetId:four?3:2,secondId:four?4:3,fourBallThreeCushion:false}};return{req,game,binding:{gameKind:four?'four':'three',snapshot:game.snapshot(),worldObjectIds:ids,shotRules:{threeCushion:!four}}};}
const topology=()=>({id:'branch1',method:'any',firstId:2,secondId:3,events:[{kind:'object',id:2},{kind:'object',id:3}],detail:{sourceNumber:-0}});
async function bound(){const s=source();return A.bind(s.req,s.binding);}
test('fingerprint preserves binary64/typed bytes and rejects hidden executable data',()=>{
 assert.notEqual(A.fingerprint(0),A.fingerprint(-0));assert.notEqual(A.fingerprint(Number.MIN_VALUE),A.fingerprint(0));assert.notEqual(A.fingerprint({a:undefined}),A.fingerprint({}));assert.notEqual(A.fingerprint(Uint8Array.of(1,2)),A.fingerprint(Uint16Array.of(513)));
 assert.equal(A.fingerprint({b:2,a:1}),A.fingerprint({a:1,b:2}));for(const bad of [NaN,Infinity,()=>{},1n,{get x(){assert.fail('getter executed');}}])assert.throws(()=>A.fingerprint(bad));const cycle={};cycle.x=cycle;assert.throws(()=>A.fingerprint(cycle),/acyclic/);
});
test('binding is detached and exact source/game digest is recomputed, not trusted',async()=>{
 const s=source(),r=await A.bind(s.req,s.binding);assert.match(r.finalization.sourceIdentity,/^[a-f0-9]{64}$/);s.req.snapshot.world[0]=9;s.game.scores[1]=99;s.binding.snapshot.scores[1]=99;assert.equal(r.snapshot.world[0],1);assert.equal(r.finalization.gameBinding.snapshot.scores[1],0);
 const token=await A.admit(r);assert.equal(Object.isFrozen(token),true);assert.equal(A.policyFor(token,r,topology(),'verify').effective,'final-gameplay-verify');assert.throws(()=>A.policyFor({},r,topology(),'verify'),/same-realm/);
 const forged=structuredClone(r);forged.finalization.sourceIdentity=forged.finalization.gameBinding.sourceIdentity='f'.repeat(64);await assert.rejects(()=>A.admit(forged),/digest mismatch/);r.snapshot.world[0]^=1;assert.throws(()=>A.policyFor(token,r,topology(),'verify'),/changed after/);
});
test('admission rejects a request changed while digest awaits; structured transport can readmit',async()=>{
 const r=await bound(),pending=A.admit(r);r.settings.angle=1;await assert.rejects(()=>pending,/changed during/);const clean=await bound(),copy=structuredClone(clean),token=await A.admit(copy);assert.equal(A.policyFor(token,copy,topology(),'verify').sourceIdentity,clean.finalization.sourceIdentity);
});
test('game roster, ready state and actual per-shot rule are bound rather than inferred',async()=>{
 for(const change of [x=>x.binding.worldObjectIds.reverse(),x=>x.binding.snapshot.pending={},x=>x.binding.shotRules.threeCushion=false]){const s=source();change(s);await assert.rejects(()=>A.bind(s.req,s.binding));}
 const s=source({four:true});s.binding.shotRules.threeCushion=true;await assert.rejects(()=>A.bind(s.req,s.binding),/per-shot/);s.req.options.fourBallThreeCushion=true;assert.equal((await A.bind(s.req,s.binding)).finalization.gameBinding.shotRules.threeCushion,true);
});
test('omission, route-only and intermediate detection do not acquire gameplay authority',async()=>{
 const s=source();assert.equal(A.validate(s.req),null);assert.equal(await A.admit(s.req),undefined);s.req.options.mode='direct';const r=A.route(s.req),token=await A.admit(r);assert.equal(A.policyFor(token,r,topology(),'verify').effective,'legacy-source-query');assert.deepEqual(Object.keys(r.finalization),['kind','policy']);assert.equal(A.needsAdmission(r,'verify'),false);
 const game=await bound();for(const purpose of ['evaluate','residual','jacobian','trial','clearance'])assert.equal(A.needsAdmission(game,purpose),false);assert.equal(A.needsAdmission(game,'verify'),true);assert.throws(()=>A.needsAdmission({...game,finalization:{kind:'source-finalization-request-v1',policy:'automatic'}},'residual'),/known explicit/);
});
test('archive receipt matches full topology, actual controls, signed zero and verification purpose',async()=>{
 const req=await bound(),token=await A.admit(req),job={purpose:'verify',settings:settings(),topology:topology()},evaluationBinding=A.evaluationBindingFor(token,req,job.topology,job.settings,job.purpose),finalization={kind:'source-gameplay-finalization-result-v1',policy:A.GAMEPLAY_FINALIZATION_POLICY,sourceIdentity:req.finalization.sourceIdentity,purpose:'verify',status:'verified-final-gameplay',gameplayVerified:true,physicalRest:true,finishedGameResult:{cueId:1,delta:1,nextCue:1},reason:null,evaluationBinding},outcome={purpose:'verify',settings:structuredClone(job.settings),verified:true,goalVerified:true,physicalResult:{success:true,settings:structuredClone(job.settings),firstId:2,secondId:3},finalization};
 outcome.routeQueryPhysicalResult=structuredClone(outcome.physicalResult);assert.equal(A.verifiedGameplay(req,job,outcome),true);assert.equal(Object.isFrozen(evaluationBinding.topology.detail),true);
 for(const mutate of [x=>x.settings.tipX=0,x=>x.settings.speed=3,x=>x.topology.detail.sourceNumber=0,x=>x.topology.id='branch2',x=>x.purpose='trial']){const changed=structuredClone(job);mutate(changed);assert.equal(A.verifiedGameplay(req,changed,outcome),false);}
 for(const mutate of [x=>x.incomplete=true,x=>x.unsupported=true,x=>x.verified=false,x=>x.finalization.status='incomplete',x=>x.finalization.physicalRest=false,x=>x.finalization.finishedGameResult.delta=0,x=>x.finalization.sourceIdentity='1'.repeat(64),x=>x.physicalResult.settings.speed=3,x=>x.physicalResult.firstId=99,x=>x.settings.tipX=0,x=>x.routeQueryPhysicalResult.distance=99,x=>delete x.routeQueryPhysicalResult]){const changed=structuredClone(outcome);mutate(changed);assert.equal(A.verifiedGameplay(req,job,changed),false);}
});
