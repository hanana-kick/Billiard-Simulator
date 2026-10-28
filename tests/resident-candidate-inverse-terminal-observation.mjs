// HOST-only codec/consumer proofs; no world, GPU, replay, or solver activation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import '../src/inverse-events.js';
import '../src/inverse-solver.js';
import {RESULT_WORDS} from '../src/resident-candidate/abi.mjs';
import {INVERSE_TERMINAL_ABI as A,inverseTerminalObservationScope,createInverseTerminalContract,selectSourceInverseTerminalObservation as select,packInverseTerminalObservations as pack,decodeInverseTerminalObservations as decode,assertInverseWinnerReplayAgreement as replayAgreement} from '../src/resident-candidate/inverse-terminal-observation.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fixtureBytes=readFileSync(new URL('./fixtures/inverse-observation-original.json',import.meta.url)), golden=JSON.parse(fixtureBytes);
const E=globalThis.LabInverseEvents,S=globalThis.LabInverseSolver;
// These are explicitly synthetic envelope identities for CODEC tests, not
// invented physical snapshot hashes or evidence of GPU provenance.
const sourceIdentity={sourceSha256:sha(readFileSync(new URL('../src/inverse-events.js',import.meta.url))),initialSnapshotSha256:sha('HOST codec identity only'),requestSha256:sha('HOST request identity only'),generationId:'host-codec-contract',gameMode:'free',mode:'target',requiresFullRest:false};
function context(outcomes,{requiresFullRest=false}={}){return createInverseTerminalContract({...sourceIdentity,...(requiresFullRest?{gameMode:'four',mode:'carom'}:{}),requiresFullRest,candidates:outcomes.map((o,id)=>({id,purpose:o.purpose,topologyId:String(o.id),topologyLength:o.stageResiduals.length,settings:o.settings}))});}
function evaluated(o,id=0,boundary='physical-stop'){return{id,status:'evaluated',reason:'none',boundary,observation:select(o)};}
function projected({purpose='residual',missing=false,clearance=false,inequalities=[-.02,-1.5,-2.5,-8,-77,-.55,-.45,-.6,-1]}={}){
 const e=E.observation.create({events:[{kind:'object',id:2}]},0);Object.assign(e,{topologyId:'current-source',purpose,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},inequalities,clearance:clearance?null:.02});
 if(clearance)e.blockedReason='strike-rejected';
 else E.observation.initial(e,{phase:'initial-before-world-step',sequence:0,time:0,stepDt:0,cue:{radius:.03,position:{x:-.1,y:.04,z:-0}},objects:missing?[]:[{id:2,radius:.03,position:{x:0,y:.03,z:0},impact:false}],rails:[]});
 return E.projectResult(e,null,0);
}

test('independent optional ABI preserves all original golden terminal scalar values, not full physical artifacts',()=>{
 const outcomes=golden.rows.map(r=>r.outcome),c=context(outcomes),words=pack(c,outcomes.map((o,i)=>evaluated(o,i))),rows=decode(c,words);
 assert.equal(golden.sourceCommit,'2ed077e');assert.equal(words.length,3*64);assert.equal(A.bytes,256);assert.equal(RESULT_WORDS,4,'public id/status/pass/reason remains 16 bytes');
 rows.forEach((r,i)=>{assert.deepEqual(r.observation,select(outcomes[i]));assert.equal(Object.hasOwn(r.observation,'physicalResult'),false);assert.equal(Object.hasOwn(r.observation,'events'),false);assert.equal(Object.hasOwn(r.observation,'stageResiduals'),false);assert.equal(Object.hasOwn(r.observation,'distance'),false);});
 assert.equal(rows[0].observation.contactCell,'[2,0.0010416667209938169,374]');
 assert.equal(Object.isFrozen(c.identity.candidates[0].settings),true);
});

test('current source projector: unavailable is not a zero root; clearance null and inequality nonfinite bits survive',()=>{
 const out=projected({clearance:true}),c=context([out]),row=evaluated(out,0,'initial-clearance');
 assert.equal(out.residualAvailable,false);assert.equal(out.residual,null);assert.deepEqual(decode(c,pack(c,[row]))[0].observation,select(out));
 row.observation.inequalities=[-0,Infinity,-Infinity,NaN,-77,-.55,-.45,-.6,-1];
 const decoded=decode(c,pack(c,[row]))[0].observation;
 assert.equal(Object.is(decoded.inequalities[0],-0),true);assert.equal(decoded.inequalities[1],Infinity);assert.equal(decoded.inequalities[2],-Infinity);assert.equal(Number.isNaN(decoded.inequalities[3]),true);assert.equal(decoded.clearance,null);
 const ordinary=projected(),c2=context([ordinary]);assert.deepEqual(decode(c2,pack(c2,[evaluated(ordinary)]))[0].observation,select(ordinary));
 assert.throws(()=>select(projected({missing:true})),/unsupported/);
});

test('every non-evaluated terminal is distinct, valueless and never manufactured into a miss',()=>{
 const out=projected(),c=context([out]);
 for(const[status,reason]of [['unsupported','missing-target'],['unsupported','missing-cushion-geometry'],['unsupported','capacity'],['incomplete','transport-budget'],['incomplete','physical-verification-incomplete'],['cancelled','cancelled'],['stale','stale-source'],['failed','device-lost'],['failed','execution-error']]){
  const row={id:0,status,reason,boundary:'none',observation:null};assert.deepEqual(decode(c,pack(c,[row]))[0],row);
  assert.throws(()=>pack(c,[{...row,observation:select(out)}]));assert.throws(()=>pack(c,[{...row,reason:'none'}]));
 }
 for(const failureReason of ['four-ball-shot-incomplete','cue-tail-incomplete'])assert.throws(()=>select({...out,physicalResult:{success:false,failureReason}}),/incomplete/);
 assert.throws(()=>pack(c,[{id:0,status:'miss',reason:'none',boundary:'none',observation:null}]));
});

test('horizon probe can retain genuine values, but cannot turn unfinished verification into evaluated failure/success',()=>{
 const probe=projected(),c=context([probe]);assert.equal(decode(c,pack(c,[evaluated(probe,0,'horizon-probe')]))[0].boundary,'horizon-probe');
 const verify=projected({purpose:'verify'});assert.throws(()=>pack(context([verify]),[evaluated(verify,0,'horizon-probe')]),/incomplete/);
 const positive=golden.rows[0].outcome,full=context([positive],{requiresFullRest:true});assert.throws(()=>pack(full,[evaluated(positive)]),/full rest/);
 // Structural boundary guard only; relabelling this stored target fixture does
 // NOT qualify four-ball physics. No successful four-ball evidence is claimed.
 assert.equal(decode(full,pack(full,[evaluated(positive,0,'full-rest')]))[0].boundary,'full-rest');
});

test('source game/mode and query scope cannot promote early free-mode search success into final gameplay',()=>{
 const out=golden.rows[0].outcome,c=context([out]);
 assert.deepEqual(inverseTerminalObservationScope(c),{gameMode:'free',mode:'target',requiresFullRest:false,qualificationScope:'original-early-search-query-only',finalGameplayQualified:false,gpuProducerImplemented:false});
 assert.throws(()=>createInverseTerminalContract({...c.identity,gameMode:'four',mode:'carom'}),/derives/);
 assert.throws(()=>createInverseTerminalContract({...c.identity,requiresFullRest:true}),/derives/);
 assert.throws(()=>createInverseTerminalContract({...c.identity,gameMode:'four',requiresFullRest:true}),/carom only/);
 assert.throws(()=>pack(c,[evaluated(out,0,'full-rest')]),/non-four source-query/);
 const query=decode(c,pack(c,[evaluated(out)]))[0];assert.equal(query.observation.verified,true);assert.equal(query.boundary,'physical-stop');
});

test('actual direct query mode is explicit early route-only scope, not final gameplay or a new physical fixture',()=>{
 const c=context([projected()]),direct=createInverseTerminalContract({...c.identity,mode:'direct'});
 assert.equal(inverseTerminalObservationScope(direct).mode,'direct');assert.equal(inverseTerminalObservationScope(direct).qualificationScope,'original-early-search-query-only');
 assert.equal(inverseTerminalObservationScope(direct).finalGameplayQualified,false);assert.equal(inverseTerminalObservationScope(direct).gpuProducerImplemented,false);
 assert.notEqual(direct.contractSha256,c.contractSha256,'original request mode is bound to identity');
 const words=pack(c,[evaluated(projected())]);assert.throws(()=>decode(direct,words),/binding/);
 assert.throws(()=>createInverseTerminalContract({...direct.identity,gameMode:'four',requiresFullRest:true}),/carom only/);
});

test('unknown/malformed/aliased/stale payloads reject; no silent shape narrowing or finite replacement',()=>{
 const out=projected(),c=context([out]),good=pack(c,[evaluated(out)]);
 for(const mutate of [w=>w[0]^=1,w=>w[1]=2,w=>w[2]=1,w=>w[3]=0,w=>w[4]=99,w=>w[5]=5,w=>w[6]|=32,w=>w[7]=2,w=>w[8]=9,w=>w[9]=9,w=>w[11]=0,w=>w[12]^=1,w=>w[47]=1,w=>w[52]=1]){const w=good.slice();mutate(w);assert.throws(()=>decode(c,w));}
 assert.throws(()=>decode(c,new Uint32Array(new SharedArrayBuffer(good.byteLength))));assert.throws(()=>decode(c,good.slice(1)));
 const changed=createInverseTerminalContract({...c.identity,generationId:'stale generation'});assert.throws(()=>decode(changed,good),/binding/);
 const changedSource=createInverseTerminalContract({...c.identity,sourceSha256:sha('different source')});assert.throws(()=>decode(changedSource,good),/binding/);
 for(const mutate of [o=>o.residuals=Array(3),o=>o.inequalities=Array(9),o=>o.residuals[0]=Infinity,o=>o.clearance=undefined,o=>o.contactCell='[2, 0.1,1]',o=>o.contactCell='[2,0,1]',o=>o.contactCell='[2,0.1,null]',o=>o.unsupported=true,o=>o.physicalResult={success:true},o=>o.residualAvailable=1]){const r=evaluated(out);mutate(r.observation);assert.throws(()=>pack(c,[r]));}
 for(const field of ['reason','verification','physicalGoal'])assert.throws(()=>select({...out,[field]:undefined}),/versioned contract extension/);
 const omitted={...out};delete omitted.residuals;assert.throws(()=>pack(c,[evaluated(omitted)]));
});

test('nullable cell/clearance cannot hide payload and purpose/verification cannot be promoted',()=>{
 const out=projected(),c=context([out]),good=pack(c,[evaluated(out)]);
 for(const at of [46,48,49,50,51]){const words=good.slice();words[at]=1;assert.throws(()=>decode(c,words),/absent contact cell/);}
 const r=evaluated(out);r.observation.clearance=null;const absent=pack(c,[r]);absent[44]=1;assert.throws(()=>decode(c,absent),/absent clearance/);
 r.observation.verified=true;assert.throws(()=>pack(c,[r]),/verify purpose/);
});

test('current solver sees exactly the same continuation from original vs decoded terminal observations',()=>{
 const source=projected(),c=context([source]),decoded=decode(c,pack(c,[evaluated(source)]))[0].observation;
 const problem={seed:source.settings,topology:{id:'current-source',events:[{kind:'object',id:2}]}};
 const a=S.create(problem),b=S.create(problem),pa=S.next(a),pb=S.next(b);assert.deepEqual(pa,pb);
 S.accept(a,[{...source,id:pa[0].id}]);S.accept(b,[{...decoded,id:pb[0].id}]);assert.deepEqual(b,a);assert.deepEqual(S.next(b),S.next(a));
 // Original nonfinite policy remains solver rejection, not invented feasibility.
 const bad=projected({inequalities:[NaN,-1,-2,-3,-4,-5,-6,-7,-8]}),cb=context([bad]),ob=decode(cb,pack(cb,[evaluated(bad)]))[0].observation;
 const state=S.create(problem),p=S.next(state);S.accept(state,[{...ob,id:p[0].id}]);assert.equal(S.result(state).status,'unconverged');assert.equal(S.result(state).reason,'Non-finite initial residual');
});

test('winner replay comparison is exact/source-bound/separately timed and never grants GPU qualification or replacement results',()=>{
 const out=structuredClone(golden.rows[0].outcome),c=context([out]),words=pack(c,[evaluated(out)]),replay={sourceSha256:c.identity.sourceSha256,initialSnapshotSha256:c.identity.initialSnapshotSha256,requestSha256:c.identity.requestSha256,generationId:c.identity.generationId,candidateId:0,outcome:out,wallMs:12};
 const result=replayAgreement({context:c,words,id:0,replay});assert.equal(result.comparison,'equal');assert.equal(result.qualificationGranted,false);assert.equal(result.finalGameplayQualified,false);assert.equal(result.qualificationScope,'original-early-search-query-only');assert.equal(result.solverAdapterImplemented,false);assert.equal(result.replayWallMs,12);assert.equal(Object.hasOwn(result,'physicalResult'),false);
 for(const mutate of [r=>r.sourceSha256=sha('wrong source'),r=>r.initialSnapshotSha256=sha('wrong snapshot'),r=>r.generationId='stale',r=>r.candidateId=1,r=>r.wallMs=-1,r=>r.outcome.id='other-topology',r=>r.outcome.settings.angle+=1,r=>r.outcome.residuals[0]=Number.EPSILON,r=>r.outcome.contactCell='[2,0.0010416667209938169,375]',r=>r.outcome.physicalResult.success=false,r=>r.outcome.physicalResult.settings.speed+=.1,r=>r.outcome.physicalResult.distance=NaN]){const bad=structuredClone(replay);mutate(bad);assert.throws(()=>replayAgreement({context:c,words,id:0,replay:bad}));}
 const negative=golden.rows[1].outcome,nc=context([negative]);assert.throws(()=>replayAgreement({context:nc,words:pack(nc,[evaluated(negative)]),id:0,replay}),/verified winner/);
});
