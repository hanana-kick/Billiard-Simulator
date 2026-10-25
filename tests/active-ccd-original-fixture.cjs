'use strict';
// SPDX-License-Identifier: Apache-2.0
// Original PhysicsLab replay only. Candidate runtimes are never imported.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),v8=require('node:v8'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs'),D=require('../tools/rapier-snapshot-decoder'),input=require('./active-ccd-original-input.json');
require('../src/math');require('../src/physics');
const root=path.resolve(__dirname,'..'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const sourceFiles=['src/physics.js','src/math.js','vendor/rapier.cjs','tests/active-ccd-original-input.json','tests/active-ccd-original-fixture.cjs'];
const vector=v=>[v.x,v.y,v.z],rotation=q=>[q.x,q.y,q.z,q.w];
function handle(h){const bytes=Buffer.alloc(8);bytes.writeDoubleLE(h);return{index:bytes.readUInt32LE(0),generation:bytes.readUInt32LE(4)};}
function state(lab){return {time:lab.time,steps:lab.steps,cuePresent:!!lab.cue,objects:lab.objects.map(o=>({id:o.id,body:handle(o.body.handle),collider:handle(o.collider.handle),pairCollider:handle(o.pairCollider.handle),translation:vector(o.body.translation()),rotation:rotation(o.body.rotation()),linear:vector(o.body.linvel()),angular:vector(o.body.angvel()),sleeping:o.body.isSleeping()})),events:structuredClone(lab.events)};}
function identity(){return {schema:'original-active-ccd-snapshot-capture-v1',input:structuredClone(input),sourceRevision:D.SOURCE_REVISION,engineVersion:D.ENGINE_VERSION,engineSha256:D.ENGINE_SHA256,node:process.version,v8:process.versions.v8,sources:Object.fromEntries(sourceFiles.map(p=>[p,hash(fs.readFileSync(path.join(root,p)))]))};}
async function capture(file){assert.ok(path.isAbsolute(file),'Explicit absolute new output required');assert.ok(!fs.existsSync(file)&&!fs.existsSync(file+'.json'),'Original artifacts are never overwritten');const beforeIdentity=identity();await R.init();assert.equal(R.version(),D.ENGINE_VERSION);const lab=new PhysicsLab(R),frames=[],boundaries={},setterCalls=[];let h=0,outer=0;
 try{
  assert.equal(lab.dt,input.dt);assert.equal(lab.strokeSubsteps,input.strokeSubsteps);assert.equal(lab.world.integrationParameters.maxCcdSubsteps,4);
  const originalBodies=new Set(lab.objects.map(o=>o.body.handle));
  const originalCreate=lab.world.createRigidBody.bind(lab.world);lab.world.createRigidBody=(...args)=>{const body=originalCreate(...args),setter=body.setLinvel.bind(body);body.setLinvel=(...values)=>{setterCalls.push({body:handle(body.handle),isOriginalBall:originalBodies.has(body.handle),value:structuredClone(values[0])});return setter(...values);};return body;};
  boundaries.beforeStrike={snapshot:lab.world.takeSnapshot(),application:state(lab)};
  const strike=lab.strike(input.selectedId,{...input.settings},{saveSnapshot:false});assert.equal(strike.ok,true,JSON.stringify(strike));
  boundaries.created={snapshot:lab.world.takeSnapshot(),application:state(lab)};
  const registry={objects:state(lab).objects.map(({id,body,collider,pairCollider})=>({id,body,collider,pairCollider})),statics:lab.statics.map(o=>({label:o.label,kind:o.kind,body:handle(o.body.handle),collider:handle(o.collider.handle)}))};
  const nativeStep=lab.world.step.bind(lab.world);lab.world.step=(...args)=>{h++;if(h>=input.targetOriginalWorldStep-1&&h<=input.targetOriginalWorldStep){boundaries['h'+h+'Pre']={h,outer,snapshot:lab.world.takeSnapshot(),application:state(lab)};}
   const result=nativeStep(...args);
   if(h>=input.targetOriginalWorldStep-1&&h<=input.targetOriginalWorldStep)boundaries['h'+h+'Post']={h,outer,snapshot:lab.world.takeSnapshot(),application:state(lab)};
   frames.push({h,outer,dt:lab.world.integrationParameters.dt,...state(lab)});return result;};
  while(h<input.targetOriginalWorldStep){outer++;lab.step();}
  assert.equal(h,input.targetOriginalWorldStep,'Target remains ordinary single subdivision');
  const target=boundaries['h'+input.targetOriginalWorldStep+'Pre'];assert.equal(target.application.cuePresent,false);assert.equal(setterCalls.length,2);assert.ok(setterCalls.every(x=>!x.isOriginalBall),'Only original source-created cue velocities');
  boundaries.afterApplication={h,outer,snapshot:lab.world.takeSnapshot(),application:state(lab)};
  assert.deepEqual(identity(),beforeIdentity,'Source bytes frozen during capture');
  for(const b of Object.values(boundaries))b.snapshotSha256=hash(b.snapshot);
  const payload={identity:beforeIdentity,registry,setterCalls,frames,boundaries},bytes=v8.serialize(payload),manifest={identity:beforeIdentity,sha256:hash(bytes),bytes:bytes.length,frames:frames.length,sourceOnly:true,paritySuccess:false,boundaries:Object.fromEntries(Object.entries(boundaries).map(([k,b])=>[k,b.snapshotSha256]))};
  fs.writeFileSync(file,bytes,{flag:'wx'});fs.writeFileSync(file+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
 }finally{lab.dispose();}
}
function load(file){assert.ok(file&&path.isAbsolute(file),'Existing explicit capture required; never implicitly recapture');const bytes=fs.readFileSync(file),manifest=JSON.parse(fs.readFileSync(file+'.json'));assert.deepEqual(manifest.identity,identity());assert.equal(manifest.sha256,hash(bytes));assert.equal(manifest.bytes,bytes.length);const payload=v8.deserialize(bytes);assert.deepEqual(payload.identity,manifest.identity);for(const[name,b]of Object.entries(payload.boundaries)){assert.equal(hash(b.snapshot),b.snapshotSha256);assert.equal(b.snapshotSha256,manifest.boundaries[name]);}return{...payload,manifest};}
module.exports={input,identity,capture,load,hash,handle};
if(require.main===module)capture(process.argv[2]).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
