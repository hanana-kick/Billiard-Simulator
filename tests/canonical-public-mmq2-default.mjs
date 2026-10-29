import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(root+'package.json'),R=require(root+'vendor/rapier.cjs');await R.init();globalThis.RAPIER=R;
for(const name of ['math','physics','game-rules'])require(root+'src/'+name+'.js');
const load=p=>import(root+'src/direct-candidate/'+p+'.mjs');
const {createCanonicalPracticePreset}=await load('canonical-practice-entry');
const {canonicalApplicationRules}=await load('canonical-application-adapter');
const {createCanonicalRequest,createCanonicalCandidate}=await load('canonical-engine-contract');
const {prepareRawWorldBinding,prepareRawWorldBatch}=await load('deterministic-raw-world');
const {prepareCanonicalWorldContinuation,runCanonicalRawWorldContinuationCPU}=await load('canonical-world-continuation');
const p=createCanonicalPracticePreset();const o=p.requestOptions;
const rules=canonicalApplicationRules(new FourBallGame([50,19],[8,300],{threeCushion:false}).snapshot(),50,p.scene.slotToId);
const request=createCanonicalRequest({scene:p.scene,epoch:1,requestId:1,selectedId:50,purpose:'search',rules,executionProfile:o.executionProfile,budget:o.budget});
const raw=prepareRawWorldBinding(request,o.raw);
const binding=prepareCanonicalWorldContinuation(request,raw.shotClock,{...o.continuation,sceneKey:o.raw.sceneKey,requestKey:o.raw.requestKey,mixedMotionRevision:'mmq2',enableCushionContinuation:true});

const {advanceSupportedWorldCPU,chooseRecurringPrefixCPU,finishRecurringPrefixCPU}=await load('deterministic-world-supported');
let bridgeCase;
test('public default nine MMQ2 candidates finish actual gameplay under unchanged budgets',()=>{
 let id=0;for(const angle of p.searchOptions.parameterGrid.angles)for(const speed of p.searchOptions.parameterGrid.speeds){
 const candidate=createCanonicalCandidate(request,++id,{...p.settings,angle,speed});
 const result=runCanonicalRawWorldContinuationCPU(binding,prepareRawWorldBatch(raw,[candidate],{maximumSteps:o.raw.maximumSteps}));
 assert.equal(result.rawHandoffStatus[1],1);const c=result.continuation;
 assert.equal(c.state[1],9,`angle=${angle} speed=${speed}: world=${c.state[1]}/${c.state[2]}`);
 assert.deepEqual([...c.compactResult],[id,1,0,1]);
 assert.ok(c.history.length<=128);assert.ok(c.state[5]<o.budget.maximumTicks);
 for(let i=0;i<c.state[3];i++){const a=64+i*48;assert.equal(c.state[a+40],0);assert.deepEqual([...c.state.slice(a+27,a+33)],[0,0,0,0,0,0]);}
 const h=c.history.find(h=>h.mask&&h.priorState&&Array.from({length:h.priorState[3]},(_,i)=>h.priorState[64+i*48+40]).includes(3)&&h.state[1]===1);
 assert.ok(h,'actual original rolling plus slip/qt bridge prefix was committed');bridgeCase??=h;
 }
});
test('mixed bridge uses original endpoints and advances only its proved whole interval',()=>{
 assert.ok(bridgeCase);const h=bridgeCase,r=advanceSupportedWorldCPU({state:h.priorState.slice(),dense:h.priorDense.slice()},h.context,null,{rollingV2:true});
 assert.equal(r.state[1],1);assert.ok(r.mask);assert.equal(r.state[5],h.priorState[5]+r.state[4]);
 for(const field of [21,45,52,61,62,63])assert.equal(r.state[field],h.priorState[field],`no fabricated contact counter ${field}`);
 for(let i=0;i<r.state[3];i++){const a=64+i*48,z=i*128;if(r.mask&(1<<i)||h.priorState[a+40]===3){const source=new Int32Array((r.mask&(1<<i)?r.bridges:r.rolling).buffer),actual=new Int32Array(r.state.buffer);assert.deepEqual([...actual.slice(a+24,a+33)],[source[z+16],actual[a+25],source[z+17],source[z+18],0,source[z+19],source[z+20],source[z+22],source[z+21]]);}}
});
test('mixed bridge overlap, tangent and wall candidates remain unresolved without advancing',()=>{
 assert.ok(bridgeCase);const h=bridgeCase;
 for(const kind of ['overlap','tangent','wall']){
  const state=h.priorState.slice(),s=new Int32Array(state.buffer),dense=h.priorDense.slice();
  const rollingSlot=Array.from({length:state[3]},(_,i)=>i).find(i=>state[64+i*48+40]===3);
  const restSlot=Array.from({length:state[3]},(_,i)=>i).find(i=>state[64+i*48+40]===0);
  assert.notEqual(restSlot,undefined);const a=64+rollingSlot*48,b=64+restSlot*48;
  if(kind==='wall'){s[b+24]=new Int32Array(h.context.buffer)[9];}
  else {s[b+24]=s[a+24]+(kind==='tangent'?s[a+22]+s[b+22]:0);s[b+26]=s[a+26];}
  const r=advanceSupportedWorldCPU({state,dense},h.context,null,{rollingV2:true});
  assert.equal(r.state[1],7,kind);assert.equal(r.state[2],98,kind);assert.equal(r.state[5],state[5],kind);
 }
});

test('mixed bridge preserves an early smooth budget failure rather than relabeling it unresolved',()=>{
 const h=bridgeCase,prepared=chooseRecurringPrefixCPU({state:h.priorState.slice(),dense:h.priorDense.slice()},h.context,h.proposals,h.bridgeProbes);
 assert.equal(prepared.state[1],0);assert.ok(prepared.mask);
 const restSlot=Array.from({length:prepared.state[3]},(_,i)=>i).find(i=>prepared.state[64+i*48+40]===0);
 // Fault injection into the stage input, not a manufactured complete receipt.
 prepared.dense[restSlot*64]=1;
 const r=finishRecurringPrefixCPU(prepared,h.smooth,h.bridges,h.rolling,null,true);
 assert.equal(r.state[1],5);assert.equal(r.state[2],5);assert.equal(r.state[5],h.priorState[5]);
});

test('all nine default selected manual traces retain original full-rest endpoints within 256 records',async()=>{
 const {createCanonicalCPUSelectedTrace}=await load('canonical-selected-trace-cpu');
 const {sampleSelectedShotTrace,selectedTraceWorldBoundary}=await load('canonical-selected-trace');
 const manual=createCanonicalRequest({...request,purpose:'manual',executionProfile:o.executionProfile});
 const raw=prepareRawWorldBinding(manual,o.raw);
 const binding=prepareCanonicalWorldContinuation(manual,raw.shotClock,{...o.continuation,sceneKey:o.raw.sceneKey,requestKey:o.raw.requestKey,mixedMotionRevision:'mmq2',enableCushionContinuation:true});
 let id=0;for(const angle of p.searchOptions.parameterGrid.angles)for(const speed of p.searchOptions.parameterGrid.speeds){
 const candidate=createCanonicalCandidate(manual,++id,{...p.settings,angle,speed}),batch=prepareRawWorldBatch(raw,[candidate],{maximumSteps:o.raw.maximumSteps});
 const collector=createCanonicalCPUSelectedTrace(manual,candidate,batch,{maximumRecords:256});
 const result=runCanonicalRawWorldContinuationCPU(binding,batch,{selectedTraceCapture:collector.selectedTraceCapture,selectedTraceMaxRecords:256}).continuation;
 const receipt=collector.finish(result);
 assert.equal(receipt.physicsResultComplete,true);assert.equal(receipt.captureComplete,true,JSON.stringify({angle,speed,errors:receipt.adapterErrors}));
 assert.equal(receipt.endpointMatches,true);assert.deepEqual(receipt.adapterErrors,[]);assert.equal(receipt.trace.overflow,false);assert.ok(receipt.trace.recordCount<=256);
 assert.deepEqual(sampleSelectedShotTrace(receipt.trace,result.state[5]).state,selectedTraceWorldBoundary(result.state));
 assert.equal(receipt.gpuProduced,false);assert.equal(receipt.rawContactInteriorImplemented,false);
 assert.deepEqual([...result.compactResult],[id,1,0,1]);
 }
});
