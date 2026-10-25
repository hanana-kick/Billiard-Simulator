// Test-only independent raw -> ORIGINAL creation -> ORIGINAL reference h.
// Per-row created snapshots and future states are assertions, never GPU inputs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createWholeHOracleFromSource,DEFAULT_WHOLE_H_RULE} from './resident-candidate-whole-h-fixture.mjs';
import {prepareLiveFourBallCandidate} from '../src/browser-initial-import/prepare-live-candidate.mjs';
import {createWorldInitializationPlan} from '../src/resident-candidate/world-initialization.mjs';
import {STATUS,REASON} from '../src/resident-candidate/abi.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');
for(const name of['math','render-cadence','physics','game-rules','controller'])require('../src/'+name+'.js');
const settings=(angle,elevation,speed,tipX=0,tipY=0)=>({angle,elevation,speed,tipX,tipY});
export const RAW_FIRST_H_CASES=Object.freeze([
 {id:17,settings:settings(0,8,2),kind:'clear'},
 {id:118,settings:settings(23,37,1.7,.2,-.1),kind:'clear'},
 {id:219,settings:settings(310,85,4.5,.2,-.1),kind:'clear'},
 {id:320,settings:settings(180,37,.5,-.3,.15),kind:'clear'},
 {id:421,settings:settings(180,8,2),kind:'blocked',reason:REASON.CUE_BLOCKED},
 {id:522,settings:settings(9,8,0),kind:'invalid',reason:REASON.SOURCE_INPUT_RANGE}
].map(row=>Object.freeze({...row,settings:Object.freeze(row.settings)})));
function nativeHandle(h){const d=new DataView(new ArrayBuffer(8));d.setUint32(0,h.index,true);d.setUint32(4,h.generation,true);return d.getFloat64(0,true);}
function restoreController(raw){
 const a=raw.capture.preStrikeApplication,bind=o=>({...o,bodyHandle:nativeHandle(o.body),colliderHandle:nativeHandle(o.collider),pairColliderHandle:o.pairCollider?nativeHandle(o.pairCollider):undefined,pos:{x:0,y:0,z:0},trail:[]});
 const c=new globalThis.LabController();
 c.lab=globalThis.PhysicsLab.fromSnapshot(R,{...a,world:raw.preStrikeSnapshot,objects:a.registry.objects.map(bind),statics:a.registry.statics.map(bind)});
 Object.assign(c.state,{gameMode:a.controller.gameMode,selectedId:a.controller.selectedId,paused:a.controller.paused,settings:structuredClone(a.controller.settings)});
 c.state.routeOptions.fourBallThreeCushion=a.game.threeCushion;c.game=new globalThis.FourBallGame();c.game.restore(structuredClone(a.game));c.lab.onEvent=e=>c.game.contact(e);
 // Recorded input contains undo COUNTS, not undo contents. Keep this test
 // controller's presentation history truly empty instead of fabricating it.
 // Undo history is neither native physics nor a represented resident owner.
 assert.deepEqual(c.undoStack,[]);assert.deepEqual(c.lab.world.takeSnapshot(),raw.preStrikeSnapshot);
 c.lab.step=()=>{throw Error('Common prestrike source must not advance');};
 return c;
}
/** Real capture invokes original fork/controller.fire/PhysicsLab.strike, the
 * unchanged 13-call creation observer and byte-verifying initial importer.
 * Original expected evolution begins only AFTER that independent admission. */
export async function createRawFirstHFixture({cases=RAW_FIRST_H_CASES,rule=DEFAULT_WHOLE_H_RULE,frames=1}={}){
 assert.ok(Number.isSafeInteger(frames)&&frames>=1&&frames<=8,'Explicit bounded source-oracle diagnostic frames required');
 await R.init();const source=await originalRegisteredFixture(),plan=await createWorldInitializationPlan({decoder:source.decoder,input:source.raw,rule}),controller=restoreController(source.raw),before=controller.lab.snapshot({trails:false}),results=[];
 try{
  for(const c of cases){
   const row={id:c.id,settings:structuredClone(c.settings)};
   if(c.kind!=='clear'){
    const lab=controller.lab.fork();try{lab.world.step=()=>{throw Error('Rejected raw source must not step');};const rejected=lab.strike(controller.state.selectedId,row.settings,{saveSnapshot:false});assert.equal(rejected.ok,false);assert.equal(lab.cue,null);results.push({row,status:STATUS.REJECTED,reason:c.reason,kind:c.kind});}finally{lab.dispose();}
    continue;
   }
   const prepared=await prepareLiveFourBallCandidate({controller,decoder:source.decoder,candidate:{settings:row.settings,rules:{fourBallThreeCushion:source.seed.game.threeCushion}}});
   const seed=prepared.seed;
   assert.equal(seed.sourceOrigin.preStrikeSnapshotSha256,plan.preStrikeIdentity,'every expected row begins at exact common original native source');
   assert.deepEqual(seed.sourceOrigin.settings,row.settings,'no expected candidate normalization');
   assert.deepEqual(seed.cueInitial.sourceCreation.roles,source.seed.cueInitial.sourceCreation.roles,'original allocator handle order unchanged');
   assert.equal(prepared.candidateProvenance.captureNativeSteps,0);
   const oracle=await createWholeHOracleFromSource({seed,artifactSha256:source.artifactSha256},{rule});
   try{const initial=oracle.snapshot(),steps=[];assert.equal(initial.frame,0);for(let frame=1;frame<=frames;frame++){const step=await oracle.step();assert.equal(step.snapshot.frame,frame);steps.push(step);}const next=steps[0],final=steps.at(-1);results.push({row,status:STATUS.RUNNING,reason:REASON.NONE,kind:c.kind,seed,initial,next,...(frames===1?{}:{steps,final}),admission:prepared.admission});}
   finally{oracle.dispose();}
   assert.deepEqual(controller.lab.snapshot({trails:false}),before,'expected candidate capture/evolution never changes common original source');
  }
 }finally{clearTimeout(controller.noticeTimer);clearTimeout(controller.predictionTimer);controller.lab.dispose();}
 return{plan,source,rows:results.map(r=>r.row),results,rule,...(frames===1?{}:{frames})};
}
