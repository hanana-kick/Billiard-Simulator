import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CANONICAL_DEFAULT_PARAMETERS,encodeCanonicalScene,createCanonicalRequest,createCanonicalCandidate} from '../../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch} from '../../src/direct-candidate/deterministic-raw-world.mjs';
import {prepareCanonicalWorldContinuation} from '../../src/direct-candidate/canonical-world-continuation.mjs';
const require=createRequire(import.meta.url),RAPIER=require('../../vendor/rapier.cjs');
await RAPIER.init();require('../../src/math.js');require('../../src/physics.js');
const lab=new PhysicsLab(RAPIER),base=lab.snapshot();lab.dispose();
const R=.03075,v=(x=0,y=0,z=0)=>({x,y,z});
/** Exactly three bodies before scene admission/raw packing; no hidden opponent. */
export function threeBallFixture(kind='two-target'){
  if(!['clear','two-target'].includes(kind))throw RangeError('Unknown three-ball fixture');
  const ids=[50,8,300],positions=kind==='clear'?[[0,R,0],[.7,R,.3],[-.6,R,.45]]:[[-.5,R,-.1],[-.42,R,-.08],[-.38645598584933644,R,-.1441006472903296]];
  const settings=kind==='clear'?{angle:35,elevation:25,speed:.5,tipX:.2,tipY:0}:{angle:0,elevation:25,speed:.5,tipX:0,tipY:.2};
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok(Math.hypot(...positions[i].map((x,k)=>x-positions[j][k]))>2*R);
  const snapshot=structuredClone(base);snapshot.params={...CANONICAL_DEFAULT_PARAMETERS};
  snapshot.objects=positions.map((p,i)=>({id:ids[i],shape:'sphere',kind:'ball',radius:R,mass:.21,pos:v(...p),v:v(),w:v(),rot:{x:0,y:0,z:0,w:1}}));
  const admission=encodeCanonicalScene(snapshot,{objectIds:ids,staticCount:snapshot.statics.length});assert.equal(admission.admitted,true);
  const request=createCanonicalRequest({scene:admission.scene,epoch:7,requestId:17,selectedId:ids[0],purpose:'search',executionProfile:'canonical-local-v1',budget:{maximumTicks:2**24,maximumEvents:1024,maximumWorkItems:1000000},rules:{game:3,firstId:ids[1],secondId:ids[2],opponentId:null,threeCushion:true,search:true,method:'carom',minCushions:3,allowKiss:true,kissFacts:false,conditionOnly:false}});
  const candidate=createCanonicalCandidate(request,100,settings),rawBinding=prepareRawWorldBinding(request,{absoluteTick:1234,sceneKey:11,requestKey:23}),batch=prepareRawWorldBatch(rawBinding,[candidate],{maximumSteps:2048}),binding=prepareCanonicalWorldContinuation(request,rawBinding.shotClock,{sceneKey:11,requestKey:23,durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:128});
  return {request,candidate,rawBinding,batch,binding};
}
