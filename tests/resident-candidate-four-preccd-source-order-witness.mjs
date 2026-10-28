// ASSERTION ONLY: original PhysicsLab prefix and existing pinned native observer.
// No candidate VM, GPU, future-state initialization, or altered source rules.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {serialize} from 'node:v8';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeRestOracle} from './resident-candidate-native-rest-fixture.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {POST_IMPACT_NATIVE_SETTINGS,POST_IMPACT_NATIVE_PINS} from './resident-candidate-post-impact-native-projection.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import CCD from '../src/experimental-ccd-inactive.js';
import Graph from '../src/experimental-arithmetic-graph.js';
const hash=x=>createHash('sha256').update(x).digest('hex'),copy=structuredClone,key=h=>h.index+':'+h.generation;
const words=a=>Array.from(new Uint32Array(a.buffer,a.byteOffset,a.length));
const bodyList=s=>s.bodies.bodies.items.flatMap((x,index)=>x?.value?[{handle:{index,generation:x.generation},...x.value}]:[]);
const awake=s=>s.islands.awake_island===null?[]:copy(s.islands.islands.v[s.islands.awake_island].bodies);
export const FOUR_PRECCD_WITNESS_H=Object.freeze([2,128,164,165,192,193]);
export const FOUR_PRECCD_PROBE=Object.freeze({binary:'/tmp/billiard-n4-scene-probe-target/debug/four-ball-scene-probe',provenance:'/tmp/billiard-n4-scene-probe-target/scene-probe-provenance.json',sha256:'86dca271e2dee02b417b75f1ac9c406cffe0f2b0a184be0d6262362f6f114e84'});
export const FOUR_PRECCD_WITNESS_SCOPE=Object.freeze({candidate:219,actualControls:POST_IMPACT_NATIVE_SETTINGS,innerH:FOUR_PRECCD_WITNESS_H,sourceSemantics:'post-collision current awake list, retained forces, pre-energy',sourceObserver:'existing read-only pre-energy observer after persistent split; not a direct pre-CCD hook',nativeSnapshotInputs:'fresh original PhysicsLab preWorld snapshots, diagnostic source replay only',all193HProven:false,fullNativeMemoryEqualityClaim:false,defaultChanged:false,gpuExecuted:false,scalarMicrocodeReplay:false,releaseProfile:false});
function probeIdentity(){
 const binary=process.env.FOUR_PRECCD_SCENE_PROBE??FOUR_PRECCD_PROBE.binary,provenance=process.env.FOUR_PRECCD_SCENE_PROVENANCE??FOUR_PRECCD_PROBE.provenance,p=JSON.parse(readFileSync(provenance));
 assert.equal(p.schema,'four-ball-scene-probe-build-v1');assert.equal(p.original.sourceRevision,'b716d375efc0201003f0cd9ef7168eee0b62c177');assert.equal(p.productionRuntimeChanged,false);
 assert.equal(hash(readFileSync(binary)),FOUR_PRECCD_PROBE.sha256);assert.equal(p.binarySha256,FOUR_PRECCD_PROBE.sha256);
 for(const[name,field]of[['capture.rs','captureSha256'],['main.rs','hostSha256'],['restore-journal.rs','restorationSha256']])assert.equal(hash(readFileSync(new URL('./four-ball-scene-probe/'+name,import.meta.url))),p.instrumentation[field]);
 assert.deepEqual(p.instrumentation.replacements.map(x=>[x.marker,x.position]),[['        islands.persistent.run_pending_split(bodies);','after'],['        // Substep solve-groups: partition the awake body list by effective','before']]);
 return{binary,provenanceSha256:hash(readFileSync(provenance)),binarySha256:p.binarySha256,sourceRevision:p.original.sourceRevision,sourceManifestSha256:p.original.rapier.sourceManifestSha256};
}
/** Continuous native run. Observer returns original result and arguments;
 * private sentinel stops BEFORE h194, never abbreviating h193. */
export async function captureFourPreCcdOriginalWitness(){
 const source=await originalRegisteredFixture(),oracle=await createNativeRestOracle({settings:POST_IMPACT_NATIVE_SETTINGS});assert.equal(oracle.sourceIdentity,POST_IMPACT_NATIVE_PINS.created);
 const p=globalThis.PhysicsLab.prototype,tip=p.compliantTipContact,step=p.step,stop=Object.freeze({beforeH:194}),rows=[],outer=[];let h=0,world=null,originalWorldStep=null;
 const started=performance.now();
 p.compliantTipContact=function(...args){assert.equal(p.step,step);if(++h===194)throw stop;if(!world){world=this.world;originalWorldStep=world.step;world.step=function(...a){const row=FOUR_PRECCD_WITNESS_H.includes(h)?{h,preSnapshot:this.takeSnapshot(),time:oracle.snapshot({includeNative:false}).time,dt:this.integrationParameters.dt}:null,result=originalWorldStep.apply(this,a);if(row){row.postSnapshot=this.takeSnapshot();rows.push(row);}return result;};}return tip.apply(this,args);};
 try{for(let i=0;i<3;i++)outer.push(oracle.stepOuter());assert.throws(()=>oracle.stepOuter(),e=>e===stop);assert.equal(oracle.snapshot({includeNative:false}).nativeSteps,193);}
 finally{p.compliantTipContact=tip;if(world)world.step=originalWorldStep;oracle.dispose();assert.equal(p.step,step);}
 assert.deepEqual(rows.map(x=>x.h),FOUR_PRECCD_WITNESS_H);
 const identity=probeIdentity();
 for(const row of rows){
  row.entry=plain((await source.decoder.decodeSnapshot(row.preSnapshot)).state);row.actualPost=plain((await source.decoder.decodeSnapshot(row.postSnapshot)).state);
  const run=spawnSync(identity.binary,[],{input:row.preSnapshot,maxBuffer:64*1024*1024,timeout:30000});assert.equal(run.status,0,run.stderr?.toString());const record=JSON.parse(run.stdout);
  assert.equal(record.schema,'original-four-ball-scene-source-boundary-v1');assert.equal(record.sourceRevision,identity.sourceRevision);assert.equal(record.inputSha256,hash(row.preSnapshot));assert.equal(record.originalWasmOracle,false);assert.equal(record.instrumentedAndIndependentPostBytesEqual,true);assert.equal(record.serializedInitialStatePreserved,true);assert.equal(record.sourceJointJournalReplayed,false,'h>=2; first creation pending journal has already been consumed');
  assert.equal(record.nativePostSha256,hash(row.postSnapshot),'independently replayed source output equals actual untouched WASM native post-step bytes');
  const [preEnergy,postEnergy]=record.boundaries.map(plain);assert.equal(preEnergy.phase,'pre-energy');assert.equal(postEnergy.phase,'post-activation');row.preEnergy=preEnergy;row.postEnergy=postEnergy;
  row.probe={inputSha256:record.inputSha256,nativePostSha256:record.nativePostSha256,instrumentedAndIndependentPostBytesEqual:true,originalWasmPostBytesEqual:true};
 }
 return{kind:'authentic-four-ball-current-pre-ccd-source-witness-v1',scope:FOUR_PRECCD_WITNESS_SCOPE,sourceIdentity:oracle.sourceIdentity,preStrikeIdentity:outer[0].origin.preStrikeSnapshotSha256,artifactSha256:source.artifactSha256,probe:identity,rows,outer,wallMs:performance.now()-started};
}
export function sourcePreCcdInput(body,dt){
 assert.equal(body.body_type,'Dynamic');assert.equal(body.ccd.ccd_enabled,true);assert.equal(body.ccd.soft_ccd_prediction,0);const m=body.mprops.effective_world_inv_inertia;
 return CCD.validate({kind:'dynamic-body-ccd-check',bodyType:'dynamic',sleeping:false,softFrame:false,ccdEnabled:true,maxCcdSubsteps:4,softCcdPrediction:0,linear:copy(body.vels.linvel),angular:copy(body.vels.angvel),translation:copy(body.pos.position.translation),rotation:copy(body.pos.position.rotation),force:copy(body.forces.force),torque:copy(body.forces.torque),invMass:copy(body.mprops.effective_inv_mass),invInertia:[m.m11,m.m12,m.m13,m.m12,m.m22,m.m23,m.m13,m.m23,m.m33],localCom:copy(body.mprops.local_mprops.local_com),maxExtent:body.mprops.max_extent,ccdThickness:body.ccd.ccd_thickness,dt});
}
export function compareFourPreCcdOriginalWitness(witness){
 assert.equal(witness.kind,'authentic-four-ball-current-pre-ccd-source-witness-v1');assert.equal(witness.sourceIdentity,POST_IMPACT_NATIVE_PINS.created);assert.deepEqual(witness.rows.map(x=>x.h),FOUR_PRECCD_WITNESS_H);const graph=CCD.sourcePlans().pre;
 const reports=witness.rows.map(row=>{
  const before=bodyList(row.entry),current=bodyList(row.preEnergy),after=bodyList(row.postEnergy),order=awake(row.preEnergy),entryAwake=before.filter(b=>b.body_type==='Dynamic'&&!b.activation.sleeping).map(b=>b.handle),lookup=(a,h)=>a.find(b=>key(b.handle)===key(h));
  assert.equal(current.filter(b=>b.body_type==='Dynamic').length,6);assert.ok(current.every(b=>['Dynamic','Fixed'].includes(b.body_type)),'no kinematic interpolation can modify a dynamic predicate');assert.equal(row.preEnergy.integration_parameters.dt,row.dt);assert.equal(row.postEnergy.integration_parameters.dt,row.dt);assert.equal(row.entry.integration_parameters.max_ccd_substeps,4);
  // Early world-h gate runs AFTER the original pending API wake drain. Compare
  // actual body activation membership, not the stale preWorld awake-chunk list.
  assert.deepEqual(order.map(key).sort(),entryAwake.map(key).sort(),'no collision-only wake in this reached witness');assert.deepEqual(awake(row.postEnergy),order,'no sleep/reorder in these observed source energy phases');assert.deepEqual(awake(row.actualPost),order);
  const bodies=order.map(handle=>{
   const old=lookup(before,handle),now=lookup(current,handle),updated=lookup(after,handle),input=CCD.pack(sourcePreCcdInput(now,row.dt)),early=CCD.pack(sourcePreCcdInput(old,row.dt)),late=CCD.pack(sourcePreCcdInput(updated,row.dt));
   assert.deepEqual(words(input),words(early),'ALL64 early/current predicate words '+row.h+' '+key(handle));assert.deepEqual(words(input),words(late),'ALL64 retained/new-force predicate words '+row.h+' '+key(handle));
   const output=Graph.execute(input,graph),earlyOutput=Graph.execute(early,graph),lateOutput=Graph.execute(late,graph);assert.deepEqual(words(output),words(earlyOutput));assert.deepEqual(words(output),words(lateOutput));assert.equal(output[graph.layout.active.offset],0);assert.equal(output[graph.layout.supported.offset],1);assert.equal(now.ccd.ccd_active,false,'actual source fast-body flag');
   return{body:handle,inputWords:words(input),outputWords:words(output),all64InputWordsEqual:true,all11OutputWordsEqual:true,active:false,force:copy(now.forces.force),torque:copy(now.forces.torque)};
  });
  assert.ok(row.probe.originalWasmPostBytesEqual&&row.probe.instrumentedAndIndependentPostBytesEqual);
  return{h:row.h,rawEntryChunk:awake(row.entry),currentAwakeOrder:order,bodyActivationAwake:entryAwake,collisionOnlyWake:[],sourceFullHWord:words(Float32Array.of(row.dt))[0],allInactive:true,solveDtEqual:true,bodies,probe:row.probe};
 });
 return{kind:'authentic-four-ball-current-pre-ccd-source-comparison-v1',status:'pass',scope:FOUR_PRECCD_WITNESS_SCOPE,sourceIdentity:witness.sourceIdentity,probe:witness.probe,reports,invalidatesFrozenRawH192:false,qualification:'only six reached native boundaries; neither arbitrary rows nor all intervening h nor native release qualification',wallMs:witness.wallMs};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=process.argv[2];assert.ok(out&&!existsSync(out));const capture=await captureFourPreCcdOriginalWitness(),comparison=compareFourPreCcdOriginalWitness(capture);mkdirSync(out);const bytes=serialize(capture);writeFileSync(join(out,'capture.v8'),bytes,{flag:'wx'});writeFileSync(join(out,'comparison.json'),JSON.stringify({...comparison,captureSha256:hash(bytes)},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...comparison,reports:comparison.reports.map(x=>({...x,bodies:x.bodies.map(b=>({...b,inputWords:undefined,outputWords:undefined}))}))}));
}
