// ASSERTION ONLY. One original PhysicsLab prefix, never a candidate runtime
// input. Captures the removal boundary before deciding if an inactive-only
// source-order extension is admissible. A probe mismatch is retained evidence.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {serialize,deserialize} from 'node:v8';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeRestOracle} from './resident-candidate-native-rest-fixture.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {POST_IMPACT_NATIVE_SETTINGS,POST_IMPACT_NATIVE_PINS} from './resident-candidate-post-impact-native-projection.mjs';
import {FOUR_PRECCD_PROBE,sourcePreCcdInput} from './resident-candidate-four-preccd-source-order-witness.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import CCD from '../src/experimental-ccd-inactive.js';
import Graph from '../src/experimental-arithmetic-graph.js';
const hash=x=>createHash('sha256').update(x).digest('hex'),copy=structuredClone,key=h=>h.index+':'+h.generation;
const words=a=>Array.from(new Uint32Array(a.buffer,a.byteOffset,a.length));
const f64words=x=>Array.from(new Uint32Array(Float64Array.of(x).buffer));
const rawHandle=n=>{const a=new Uint32Array(Float64Array.of(n).buffer);return{index:a[0],generation:a[1]};};
const bodyList=s=>s.bodies.bodies.items.flatMap((x,index)=>x?.value?[{handle:{index,generation:x.generation},...x.value}]:[]);
const awake=s=>s.islands.awake_island===null?[]:copy(s.islands.islands.v[s.islands.awake_island].bodies);
export const FOUR_WITHDRAWAL_WITNESS_H=Object.freeze([306,307,308]);
export const FOUR_WITHDRAWAL_WITNESS_SCOPE=Object.freeze({candidate:219,actualControls:POST_IMPACT_NATIVE_SETTINGS,innerH:FOUR_WITHDRAWAL_WITNESS_H,sourceRun:'five complete original latched outer calls, 320 native h',runtimeInput:false,sourceObserver:'pinned read-only native pre-energy/post-activation probe after persistent split',defaultChanged:false,gpuExecuted:false,scalarMicrocodeReplay:false,releaseProfile:false});
function probeIdentity(){
 const p=JSON.parse(readFileSync(FOUR_PRECCD_PROBE.provenance));
 assert.equal(p.schema,'four-ball-scene-probe-build-v1');assert.equal(p.original.sourceRevision,'b716d375efc0201003f0cd9ef7168eee0b62c177');assert.equal(p.productionRuntimeChanged,false);
 assert.equal(hash(readFileSync(FOUR_PRECCD_PROBE.binary)),FOUR_PRECCD_PROBE.sha256);assert.equal(p.binarySha256,FOUR_PRECCD_PROBE.sha256);
 for(const[name,field]of[['capture.rs','captureSha256'],['main.rs','hostSha256'],['restore-journal.rs','restorationSha256']])assert.equal(hash(readFileSync(new URL('./four-ball-scene-probe/'+name,import.meta.url))),p.instrumentation[field]);
 assert.deepEqual(p.instrumentation.replacements.map(x=>[x.marker,x.position]),[['        islands.persistent.run_pending_split(bodies);','after'],['        // Substep solve-groups: partition the awake body list by effective','before']]);
 return{...FOUR_PRECCD_PROBE,provenanceSha256:hash(readFileSync(FOUR_PRECCD_PROBE.provenance)),sourceRevision:p.original.sourceRevision,sourceManifestSha256:p.original.rapier.sourceManifestSha256};
}
/** Transparent forwarding observers only; no throw to truncate an outer, no
 * setters, no restored future state. Include the exact API removal snapshot so
 * any missing serde-skipped removal journal can be diagnosed independently. */
export async function captureFourWithdrawalCcdWitness({throughNextOuter=false}={}){
 assert.equal(typeof throughNextOuter,'boolean');
 const oracle=await createNativeRestOracle({settings:POST_IMPACT_NATIVE_SETTINGS});assert.equal(oracle.sourceIdentity,POST_IMPACT_NATIVE_PINS.created);
 const p=globalThis.PhysicsLab.prototype,tip=p.compliantTipContact,step=p.step,remove=p.removeCue,rows=[],outer=[],removals=[];let h=0,world=null,originalWorldStep=null,originalRemoveBody=null,inRemoval=null;
 const started=performance.now();
 p.compliantTipContact=function(...args){h++;assert.equal(p.step,step);if(!world){world=this.world;originalWorldStep=world.step;originalRemoveBody=world.removeRigidBody;
  world.step=function(...a){const row=FOUR_WITHDRAWAL_WITNESS_H.includes(h)?{h,preSnapshot:this.takeSnapshot(),preApplication:oracle.snapshot({includeNative:false}),dt:this.integrationParameters.dt}:null;const result=originalWorldStep.apply(this,a);if(row){row.postSnapshot=this.takeSnapshot();row.postNativeApplication=oracle.snapshot({includeNative:false});rows.push(row);}return result;};
  world.removeRigidBody=function(...a){if(inRemoval)inRemoval.bodyCalls.push({handle:rawHandle(a[0].handle),argumentCount:a.length});return originalRemoveBody.apply(this,a);};
 }return tip.apply(this,args);};
 p.removeCue=function(...args){const record=this.cue?{h,beforeSnapshot:this.world.takeSnapshot(),before:oracle.snapshot({includeNative:false}),timeWords:f64words(this.time),bodyCalls:[],contactsSize:this.cue.contacts.size,contacted:this.cue.contacted}:null;inRemoval=record;let result;try{result=remove.apply(this,args);}finally{inRemoval=null;}if(record){record.afterSnapshot=this.world.takeSnapshot();record.after=oracle.snapshot({includeNative:false});removals.push(record);}return result;};
 try{for(let i=0;i<(throughNextOuter?6:5);i++)outer.push(oracle.stepOuter());assert.equal(oracle.snapshot({includeNative:false}).nativeSteps,throughNextOuter?321:320);assert.equal(h,throughNextOuter?321:320);}
 finally{p.compliantTipContact=tip;p.removeCue=remove;if(world){world.step=originalWorldStep;world.removeRigidBody=originalRemoveBody;}oracle.dispose();assert.equal(p.step,step);}
 assert.deepEqual(rows.map(x=>x.h),FOUR_WITHDRAWAL_WITNESS_H);assert.equal(removals.length,1);const removal=removals[0];assert.equal(removal.h,307);assert.equal(removal.before.nativeSteps,306);assert.equal(removal.after.nativeSteps,306);assert.equal(removal.after.cue,null);assert.equal(removal.contacted,true);assert.equal(removal.contactsSize,0);assert.deepEqual(removal.timeWords,[3722304639,1075218781]);assert.deepEqual(removal.before.objects.map(x=>x.body.linear),removal.after.objects.map(x=>x.body.linear));
 assert.deepEqual(removal.bodyCalls.map(x=>x.handle),[removal.before.cue.head.handle,removal.before.cue.shaft.handle,removal.before.cue.guide.handle]);assert.ok(removal.bodyCalls.every(x=>x.argumentCount===1));assert.deepEqual(removal.afterSnapshot,rows.find(x=>x.h===307).preSnapshot,'no native changes between original removal and world.step');
 assert.equal(outer[4].boundary.subdivisions,64);assert.equal(outer[4].boundary.nativeCalls.length,64);assert.ok(outer[4].boundary.nativeCalls.every(x=>x.dtWord===931694729));assert.equal(outer[4].boundary.nativeCalls.filter(x=>!x.cuePresent).length,14);
 if(throughNextOuter){assert.equal(outer[5].boundary.subdivisions,1);assert.equal(outer[5].boundary.nativeCalls.length,1);assert.equal(outer[5].boundary.nativeCalls[0].dtWord,982026377);assert.equal(outer[5].nativeSteps,321);assert.equal(outer[5].cue,null);}
 return{kind:'authentic-four-ball-withdrawal-ccd-witness-v1',scope:{...FOUR_WITHDRAWAL_WITNESS_SCOPE,sourceRun:throughNextOuter?'six complete original outer calls, 321 native h':FOUR_WITHDRAWAL_WITNESS_SCOPE.sourceRun},sourceIdentity:oracle.sourceIdentity,preStrikeIdentity:outer[0].origin.preStrikeSnapshotSha256,probe:probeIdentity(),rows,removals,outer,wallMs:performance.now()-started};
}
/** Do not turn probe failure/mismatch into a passing physical witness. Raw
 * snapshots are saved before this runs; every probe result remains available. */
export async function inspectFourWithdrawalCcdWitness(capture){
 assert.equal(capture.kind,'authentic-four-ball-withdrawal-ccd-witness-v1');assert.equal(capture.sourceIdentity,POST_IMPACT_NATIVE_PINS.created);assert.deepEqual(capture.rows.map(x=>x.h),FOUR_WITHDRAWAL_WITNESS_H);const source=await originalRegisteredFixture(),identity=probeIdentity(),plans=CCD.sourcePlans();const rows=[];
 for(const row of capture.rows){
  const entry=plain((await source.decoder.decodeSnapshot(row.preSnapshot)).state),actualPost=plain((await source.decoder.decodeSnapshot(row.postSnapshot)).state),run=spawnSync(identity.binary,[],{input:row.preSnapshot,maxBuffer:64*1024*1024,timeout:30000});
  const result={h:row.h,inputSha256:hash(row.preSnapshot),actualNativePostSha256:hash(row.postSnapshot),status:run.status,signal:run.signal,stderr:run.stderr?.toString(),entry,actualPost};
  if(run.status!==0){result.admission='blocked-source-probe';rows.push(result);continue;}
  const record=JSON.parse(run.stdout);result.record=record;assert.equal(record.schema,'original-four-ball-scene-source-boundary-v1');assert.equal(record.inputSha256,result.inputSha256);assert.equal(record.sourceRevision,identity.sourceRevision);assert.equal(record.originalWasmOracle,false);assert.equal(record.instrumentedAndIndependentPostBytesEqual,true);assert.equal(record.serializedInitialStatePreserved,true);assert.equal(record.sourceJointJournalReplayed,false);
  if(record.nativePostSha256!==result.actualNativePostSha256){result.admission='blocked-original-wasm-post-bytes-mismatch';rows.push(result);continue;}
  const [preEnergy,postEnergy]=record.boundaries.map(plain);assert.equal(preEnergy.phase,'pre-energy');assert.equal(postEnergy.phase,'post-activation');result.preEnergy=preEnergy;result.postEnergy=postEnergy;
  assert.equal(preEnergy.integration_parameters.dt,row.dt);assert.equal(postEnergy.integration_parameters.dt,row.dt);assert.equal(entry.integration_parameters.max_ccd_substeps,4);assert.equal(words(Float32Array.of(row.dt))[0],931694729);
  const current=bodyList(preEnergy),post=bodyList(actualPost),lookup=(list,h)=>list.find(b=>key(b.handle)===key(h)),preOrder=awake(preEnergy),postOrder=awake(postEnergy);assert.ok(current.every(b=>['Dynamic','Fixed'].includes(b.body_type)));assert.deepEqual(awake(actualPost),postOrder);
  result.prePredicates=preOrder.map(handle=>{const b=lookup(current,handle);assert.ok(b);const input=CCD.pack(sourcePreCcdInput(b,row.dt)),output=Graph.execute(input,plans.pre);return{handle,inputWords:words(input),outputWords:words(output),active:!!output[plans.pre.layout.active.offset],supported:!!output[plans.pre.layout.supported.offset],nativePreActive:b.ccd.ccd_active};});
  result.postPredicates=postOrder.map(handle=>{const b=lookup(current,handle),after=lookup(post,handle);assert.ok(b&&after);const input=CCD.pack(CCD.validate({...sourcePreCcdInput(b,row.dt),nextTranslation:copy(after.pos.position.translation),nextRotation:copy(after.pos.position.rotation)},true)),output=Graph.execute(input,plans.post);assert.deepEqual(words(output.slice(plans.post.layout.ccdLinear.offset,plans.post.layout.ccdLinear.offset+3)),words(Float32Array.from(after.ccd_vels.linvel)),'source solved linear CCD velocity '+row.h+' '+key(handle));assert.deepEqual(words(output.slice(plans.post.layout.ccdAngular.offset,plans.post.layout.ccdAngular.offset+3)),words(Float32Array.from(after.ccd_vels.angvel)),'source solved angular CCD velocity '+row.h+' '+key(handle));return{handle,inputWords:words(input),outputWords:words(output),active:!!output[plans.post.layout.active.offset],supported:!!output[plans.post.layout.supported.offset],nativePostActive:after.ccd.ccd_active,nativeCcdVels:copy(after.ccd_vels)};});
  result.currentAwakeOrder=preOrder;result.postAwakeOrder=postOrder;result.dynamicBodyCount=current.filter(b=>b.body_type==='Dynamic').length;
  result.allPreInactive=result.prePredicates.every(x=>x.supported&&!x.active&&x.nativePreActive===false);result.allPostInactive=result.postPredicates.every(x=>x.supported&&!x.active&&x.nativePostActive===false);
  result.admission=result.allPreInactive&&result.allPostInactive?'observed-source-inactive':'requires-active-or-unsupported-ccd';rows.push(result);
 }
 return{kind:'authentic-four-ball-withdrawal-ccd-inspection-v1',scope:capture.scope,sourceIdentity:capture.sourceIdentity,probe:identity,rows,inactiveExtensionWitness:rows.every(x=>x.admission==='observed-source-inactive'),qualification:'Only these three reached boundaries; no resident transition, release, GPU or arbitrary-input qualification.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=process.argv[2];assert.ok(out&&!existsSync(out));mkdirSync(out);const capture=await captureFourWithdrawalCcdWitness({throughNextOuter:process.argv[3]==='--through-next-outer'}),bytes=serialize(capture);writeFileSync(join(out,'capture.v8'),bytes,{flag:'wx'});const inspection=await inspectFourWithdrawalCcdWitness(deserialize(bytes)),report={...inspection,captureSha256:hash(bytes)};writeFileSync(join(out,'inspection.v8'),serialize(report),{flag:'wx'});const summary={...report,rows:report.rows.map(({entry,actualPost,record,preEnergy,postEnergy,prePredicates,postPredicates,...rest})=>({...rest,probeNativePostSha256:record?.nativePostSha256,prePredicates:prePredicates?.map(({inputWords,outputWords,...p})=>p),postPredicates:postPredicates?.map(({inputWords,outputWords,...p})=>p)}))};writeFileSync(join(out,'inspection.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(summary));
}
