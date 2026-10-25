'use strict';
// SPDX-License-Identifier: Apache-2.0
// Source-only original WASM shot. Native diagnostics never participate in recurrence.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),v8=require('node:v8'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs'),D=require('../tools/rapier-snapshot-decoder'),input=require('./positive-ccd-input.json');
require('../src/math');require('../src/physics');
const root=path.resolve(__dirname,'..'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const sourceFiles=['src/physics.js','src/math.js','vendor/rapier.cjs','tests/positive-ccd-input.json','tests/positive-ccd-original-fixture.cjs'];
const vector=v=>[v.x,v.y,v.z],rotation=q=>[q.x,q.y,q.z,q.w];
function handle(h){const b=Buffer.alloc(8);b.writeDoubleLE(h);return{index:b.readUInt32LE(0),generation:b.readUInt32LE(4)};}
function state(lab){return{time:lab.time,steps:lab.steps,cuePresent:!!lab.cue,objects:lab.objects.map(o=>({id:o.id,body:handle(o.body.handle),collider:handle(o.collider.handle),pairCollider:handle(o.pairCollider.handle),translation:vector(o.body.translation()),rotation:rotation(o.body.rotation()),linear:vector(o.body.linvel()),angular:vector(o.body.angvel()),sleeping:o.body.isSleeping(),ccdEnabled:o.body.isCcdEnabled()}))};}
function identity(){return{schema:'original-positive-ccd-snapshot-capture-v1',input:structuredClone(input),sourceRevision:D.SOURCE_REVISION,engineVersion:D.ENGINE_VERSION,engineSha256:D.ENGINE_SHA256,node:process.version,v8:process.versions.v8,sources:Object.fromEntries(sourceFiles.map(p=>[p,hash(fs.readFileSync(path.join(root,p)))]))};}
function snapshot(lab){const bytes=lab.world.takeSnapshot();return{snapshot:bytes,snapshotSha256:hash(bytes),application:state(lab)};}
function newFile(file){assert.ok(file&&path.isAbsolute(file),'Explicit absolute create-new output required');assert.ok(!fs.existsSync(file)&&!fs.existsSync(file+'.json'),'Never overwrite original evidence');}
function write(file,payload){newFile(file);const bytes=v8.serialize(payload),manifest={schema:payload.identity.schema,identity:payload.identity,sha256:hash(bytes),bytes:bytes.length,frameCount:payload.frames.length,firstOrdinaryH:payload.frames[0].h,lastOrdinaryH:payload.frames.at(-1).h,sourceOnly:true,originalWasmOracle:true,paritySuccess:false};fs.writeFileSync(file,bytes,{flag:'wx'});fs.writeFileSync(file+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;}
async function capture(file){newFile(file);const before=identity();await R.init();assert.equal(R.version(),D.ENGINE_VERSION);const lab=new PhysicsLab(R),frames=[],outerEvents=[],setterCalls=[],worldSteps=[];let h=0,outer=0;
 try{
  assert.equal(lab.dt,input.dt);assert.equal(lab.strokeSubsteps,input.strokeSubsteps);assert.equal(lab.world.integrationParameters.maxCcdSubsteps,input.maxCcdSubsteps);assert.equal(lab.objects.length,3);
  const originalBodies=new Set(lab.objects.map(o=>o.body.handle));
  const observe=body=>{for(const name of ['setLinvel','setAngvel','setTranslation','setRotation','enableCcd']){const method=body[name]?.bind(body);if(!method)continue;body[name]=(...args)=>{setterCalls.push({h,outer,body:handle(body.handle),isOriginalBall:originalBodies.has(body.handle),method:name,args:structuredClone(args)});return method(...args);};}return body;};
  lab.objects.forEach(o=>observe(o.body));const create=lab.world.createRigidBody.bind(lab.world);lab.world.createRigidBody=(...args)=>observe(create(...args));
  const beforeStrike=snapshot(lab),strike=lab.strike(input.selectedId,{...input.settings},{saveSnapshot:false});assert.equal(strike.ok,true,JSON.stringify(strike));const created=snapshot(lab);
  const registry={objects:state(lab).objects.map(({id,body,collider,pairCollider})=>({id,body,collider,pairCollider})),statics:lab.statics.map(o=>({label:o.label,kind:o.kind,body:handle(o.body.handle),collider:handle(o.collider.handle)}))};
  const step=lab.world.step.bind(lab.world);lab.world.step=(...args)=>{h++;const dt=lab.world.integrationParameters.dt;assert.equal(lab.world.integrationParameters.maxCcdSubsteps,4);assert.ok(lab.objects.every(o=>o.body.isCcdEnabled()));const ordinary=!lab.cue&&dt===Math.fround(input.dt);worldSteps.push({h,outer,dt,cuePresent:!!lab.cue});const frame=ordinary?{h,outer,ordinaryIndex:frames.length+1,pre:snapshot(lab)}:null;const result=step(...args);if(frame){frame.post=snapshot(lab);frames.push(frame);}return result;};
  while(frames.length<input.ordinaryWorldSteps&&outer<input.maxOuterSteps){outer++;const first=lab.events.length;lab.step();if(lab.events.length>first)outerEvents.push({outer,h,events:structuredClone(lab.events.slice(first))});}
  assert.equal(frames.length,input.ordinaryWorldSteps,'Fixed bounded horizon must complete without changing source subdivisions');assert.equal(setterCalls.length,2);assert.ok(setterCalls.every(x=>!x.isOriginalBall&&x.method==='setLinvel'),'Only unchanged cue shaft/head source velocity assignments');assert.deepEqual(identity(),before,'Original source bytes frozen during capture');
  return write(file,{identity:before,registry,beforeStrike,created,frames,worldSteps,outerEvents,setterCalls,afterApplication:snapshot(lab)});
 }finally{lab.dispose();}
}
function load(file){assert.ok(file&&path.isAbsolute(file),'Explicit original artifact required; never regenerate expectations');const bytes=fs.readFileSync(file),manifest=JSON.parse(fs.readFileSync(file+'.json'));assert.equal(hash(bytes),manifest.sha256);assert.equal(bytes.length,manifest.bytes);assert.deepEqual(manifest.identity,identity());const payload=v8.deserialize(bytes);assert.deepEqual(payload.identity,manifest.identity);assert.equal(payload.frames.length,input.ordinaryWorldSteps);for(const b of[payload.beforeStrike,payload.created,payload.afterApplication,...payload.frames.flatMap(f=>[f.pre,f.post])])assert.equal(hash(b.snapshot),b.snapshotSha256);return{...payload,manifest};}
module.exports={input,identity,capture,load,hash,handle,state,newFile};
if(require.main===module)capture(process.argv[2]).then(p=>console.log(JSON.stringify(p,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
