// Authentic INITIAL-only shared HOST fixture; no forward h, terminal states or GPU.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {prepareLiveFourBallCandidate} from '../src/browser-initial-import/prepare-live-candidate.mjs';
import {createWorldInitializationPlan} from '../src/resident-candidate/world-initialization.mjs';
import {createInverseWorldObservationPlan} from '../src/resident-candidate/inverse-world-observation.mjs';
import {createInverseWorldQueryJoinPlan} from '../src/resident-candidate/inverse-world-query-join.mjs';
import {DEFAULT_WHOLE_H_RULE} from './resident-candidate-whole-h-fixture.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');for(const n of ['render-cadence','game-rules','controller'])require('../src/'+n+'.js');
export const topology={id:'original-3-4',firstId:3,secondId:4,events:[{kind:'object',id:3},{kind:'object',id:4}]};
export const rows=[{id:17,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0}},{id:118,settings:{angle:23,elevation:37,speed:1.7,tipX:.2,tipY:-.1}},{id:219,settings:{angle:310,elevation:85,speed:4.5,tipX:.2,tipY:-.1}},{id:320,settings:{angle:180,elevation:37,speed:.5,tipX:-.3,tipY:.15}}];
function handle(h){const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);}
let pending;
export function createInverseQueryInitialFixture(){return pending??=(async()=>{
 await R.init();const source=await originalRegisteredFixture(),a=source.raw.capture.preStrikeApplication,bind=o=>({...structuredClone(o),bodyHandle:handle(o.body),colliderHandle:handle(o.collider),pairColliderHandle:o.pairCollider?handle(o.pairCollider):undefined,pos:{x:0,y:0,z:0},trail:[]}),controller=new LabController();controller.lab=PhysicsLab.fromSnapshot(R,{...structuredClone(a),world:source.raw.preStrikeSnapshot,objects:a.registry.objects.map(bind),statics:a.registry.statics.map(bind)});Object.assign(controller.state,{gameMode:'four',selectedId:a.controller.selectedId,paused:a.controller.paused,settings:structuredClone(a.controller.settings)});controller.game=new FourBallGame();controller.game.restore(structuredClone(a.game));controller.lab.onEvent=e=>controller.game.contact(e);controller.state.routeOptions.fourBallThreeCushion=a.game.threeCushion;
 try{
  const snapshot=controller.lab.snapshot({trails:false}),prepared=await prepareLiveFourBallCandidate({controller,decoder:source.decoder,candidate:{settings:structuredClone(a.controller.settings),rules:{fourBallThreeCushion:a.game.threeCushion}}});
  const initialization=await createWorldInitializationPlan({decoder:source.decoder,input:source.raw,rule:DEFAULT_WHOLE_H_RULE}),observer=createInverseWorldObservationPlan({seed:source.seed,template:initialization.template,topology}).plan;
  const request={snapshot,selectedId:a.controller.selectedId,settings:structuredClone(a.controller.settings),options:{gameMode:'four',mode:'carom',targetId:3,secondId:4,opponentId:a.controller.selectedId===1?2:1,fourBallThreeCushion:false,allowKiss:true,horizon:16,budget:48,objective:'shortest',spin:true,elevationMode:'search',minSpeed:.5,maxSpeed:4.5,minElevation:0,maxElevation:85}};
  const base={observer,initialization,prepared,request,topology,rows,purpose:'verify',generationId:'host-discrete-query-join-v1'},admitted=createInverseWorldQueryJoinPlan(base),clearances=[];
  for(const row of rows)clearances.push(controller.lab.cueClearance(controller.lab.get(request.selectedId),row.settings).distance);
  assert.deepEqual(controller.lab.snapshot({trails:false}),snapshot,'all initial capture and clearance reads leave original snapshot exact');
  return{...base,...admitted,clearances,source};
 }finally{clearTimeout(controller.noticeTimer);clearTimeout(controller.predictionTimer);controller.lab.dispose();}
})();}
