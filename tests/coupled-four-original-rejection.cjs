'use strict';
// Reproduce the unmodified pre-coupled owner boundary. This is not a parity claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('./coupled-four-original-fixture.cjs'),F=require('./four-ball-created-fixture.cjs'),E=require('./goal-four-world-seed.cjs'),Graph=require('./goal-four-broad-graph-seed.cjs');
const EXPECTED_OWNER_SHA256='21d4ca204e122c184938ff318a0d57e76af28e562a3b139c1a1587e882dd10f2';
function close(actual,expected,label,stats){if(Array.isArray(expected)){assert.equal(actual.length,expected.length,label);expected.forEach((v,i)=>close(actual[i],v,label+'['+i+']',stats));}else{const delta=Math.abs(actual-expected);stats.maxAbsolute=Math.max(stats.maxAbsolute,delta);assert.ok(Number.isFinite(actual)&&delta<=3e-6,label+': '+actual+' != '+expected);}}
async function run(file){assert.equal(process.env.COUPLED_FOUR_SERIAL_SLOT,'1','Coordinator serial CPU slot required');
 const expectedBoundary=process.env.EXPECTED_COUPLED_BOUNDARY??'fresh-bvtt';assert.ok(['fresh-bvtt','retained-owner'].includes(expectedBoundary),'Explicit supported diagnostic boundary required');
 const p=C.load(file),r=p.record,ownerRoot=process.env.COUPLED_FOUR_OWNER_ROOT??process.env.COUPLED_FOUR_BASELINE_ROOT??path.resolve(__dirname,'..'),ownerFile=path.resolve(ownerRoot,'src/experimental-four-ball-world.js'),ownerSha256=F.hash(fs.readFileSync(ownerFile));
 if(expectedBoundary==='fresh-bvtt')assert.equal(ownerSha256,EXPECTED_OWNER_SHA256,'Fresh-BVTT diagnostic admits only frozen pre-coupled owner');
 else assert.ok(process.env.COUPLED_FOUR_OWNER_ROOT&&path.isAbsolute(process.env.COUPLED_FOUR_OWNER_ROOT),'Retained-owner diagnostic needs explicit absolute candidate root');
 const World=require(ownerFile),seed=E.exportInitialSeed({goalStrikeCreated:r.boundaries.goalStrikeCreated,strikeCreationJournal:r.strikeCreationJournal},E.placementProvenanceFromRecord(r)),own=await World.createReferenceStepper(seed),stats={framesCompared:0,maxAbsolute:0};
 let prior=own.snapshot();try{for(const frame of r.frames){prior=own.snapshot();let out;try{out=await own.step();}catch(error){
  assert.equal(error.message,expectedBoundary==='fresh-bvtt'?'Unsupported simultaneous fresh-pair BVTT order':'Overlapping retained dynamic pairs require one larger coupled source solver');
  assert.equal(prior.frame+1,p.firstRetained.h);assert.deepEqual(own.snapshot(),prior,'Unsupported step must not commit anything');
  if(expectedBoundary==='fresh-bvtt')assert.equal(error.boundary,undefined,'Frozen journal rejects before retained-component owner boundary');
  else{assert.deepEqual(error.boundary.bindings,['02','03']);assert.equal(error.boundary.frame,p.firstRetained.h);assert.deepEqual(error.boundary.retained.map(e=>[e.collider1,e.collider2,e.active]),p.firstRetained.pairs.map(e=>[e.collider1,e.collider2,e.active]),'Current owned BVTT preserves actual original dense pair creation order');}
  const nativePrior=p.rows.find(row=>row.hCount===prior.frame&&row.boundary.endsWith('-postApplication')),nativeGraph=Graph.graphView(nativePrior);assert.deepEqual(prior.globalEdges,nativeGraph.edges);assert.deepEqual(prior.contactGraph.adjacency,nativeGraph.adjacency);assert.deepEqual(prior.scene.manager,nativePrior.state.islands);
  assert.equal(F.hash(fs.readFileSync(ownerFile)),ownerSha256,'Owner source remains frozen across bounded diagnostic');
  const result={schema:'coupled-four-frozen-owner-rejection-v1',backend:'cpu-reference',status:'unsupported-boundary',paritySuccess:false,ownerSha256,expectedBoundary,
   initialSnapshotSha256:p.manifest.initialSnapshotSha256,lastGoodH:prior.frame,attemptedH:prior.frame+1,error:error.message,boundary:error.boundary??null,
   originalFirstRetained:p.firstRetained,originalFirstActive:p.firstActive,rollbackVerified:true,...stats};console.log(JSON.stringify(result,null,2));return result;
 }assert.equal(out.frame,frame.hCount);assert.equal(out.time,frame.time);assert.equal(out.cue.present,frame.cuePresent);assert.deepEqual(out.game,frame.game);
 for(let i=0;i<4;i++){for(const k of['translation','rotation','linear','angular','invInertia'])close(out.balls[i].state[k],frame.balls[i][k],'h'+out.frame+'.ball'+i+'.'+k,stats);assert.equal(out.balls[i].state.sleeping,frame.balls[i].sleeping);}
 stats.framesCompared++;if(out.frame%128===0)console.error(JSON.stringify({expectedBoundary,h:out.frame,maxAbsolute:stats.maxAbsolute}));if(out.frame>=p.firstRetained.h)throw Error('Frozen baseline unexpectedly crossed its unsupported boundary');}
 throw Error('Frozen baseline did not reject the shared retained component');
 }finally{own.dispose();}}
module.exports={run,EXPECTED_OWNER_SHA256};if(require.main===module)run(process.argv[2]??process.env.COUPLED_FOUR_REPLAY).catch(e=>{console.error(e.stack);process.exitCode=1;});
