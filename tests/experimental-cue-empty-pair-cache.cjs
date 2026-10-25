'use strict';
// Narrow numeric-stage tests only. Frozen decoded original observations are
// read as an independent oracle; no Rapier/native decoder is loaded or run.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),{pathToFileURL}=require('node:url');
const E=require('../src/experimental-cue-empty-pair-cache'),f=Math.fround,copy=x=>structuredClone(x);
const SOURCE='b716d375efc0201003f0cd9ef7168eee0b62c177';
const evidenceDir=process.env.CUE_EMPTY_PAIR_EVIDENCE_DIR??path.resolve(__dirname,'../../billiard-generalized-cue-input-evidence');
const names=['yaw-minus37-side-draw','yaw61-25-elevated-holdout'];
const fields=['recycleTranslation','recycleRelativeRotation','recycleRotation1','recycleRotation2','maxExtent','maxDrift'];
function fixture(){return{kind:'separated-sphere-cylinder-empty-cache',separated:true,shapesChanged:false,sphere:{radius:f(.03075),translation:[0,0,0],rotation:[0,0,0,1],localTranslation:[0,0,0]},cylinder:{radius:f(.0058),halfHeight:f(.06),translation:[0,0,1],rotation:[0,0,0,1],localTranslation:[0,f(-.006-.12/2),0]},contactRecycleDistance:f(.003075),predictionDistance:f(.0000615),previous:null};}
const scalarLength=a=>f(Math.sqrt(f(f(f(a[0]*a[0])+f(a[1]*a[1]))+f(a[2]*a[2]))));
function numeric(cache){return Object.fromEntries(fields.map(k=>[k,cache[k]]));}
function freeze(x){if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;}
function nativeCache(raw){return{recycleTranslation:raw.pos12.translation,recycleRelativeRotation:raw.pos12.rotation,recycleRotation1:raw.rot1,recycleRotation2:raw.rot2,maxExtent:raw.max_extent,maxDrift:raw.max_drift};}
function observedInput(observation,previous){
 const raw=observation.raw,ball=raw.colliders.find(c=>c.handle.index===16),neck=raw.colliders.find(c=>c.handle.index===24),pose=b=>({translation:copy(b.pos.position.translation),rotation:copy(b.pos.position.rotation)});
 assert.equal(raw.sourceRevision,SOURCE);assert.equal(ball.shape.variant,'Ball');assert.equal(neck.shape.variant,'Cylinder');
 for(const collider of[ball,neck])assert.deepEqual(collider.parent.pos_wrt_parent.rotation,[0,0,0,1]);
 return{kind:'separated-sphere-cylinder-empty-cache',separated:true,shapesChanged:false,sphere:{...pose(raw.bodies.ball),radius:ball.shape.value.radius,localTranslation:copy(ball.parent.pos_wrt_parent.translation)},cylinder:{...pose(raw.bodies.head),radius:neck.shape.value.radius,halfHeight:neck.shape.value.half_height,localTranslation:copy(neck.parent.pos_wrt_parent.translation)},contactRecycleDistance:f(raw.integration.normalized_contact_recycle_distance*raw.integration.length_unit),predictionDistance:f(raw.integration.normalized_prediction_distance*raw.integration.length_unit),previous};
}
function targetPair(observation){const pair=observation.pairs.find(p=>p.collider1.index===16&&p.collider2.index===24);assert.ok(pair);assert.deepEqual(pair.manifolds,[{points:0,solverContacts:0}]);assert.equal(pair.rigid.workspace,null);assert.equal(pair.rigid.solver_color,255);assert.deepEqual(pair.rigid.manifolds[0].data.normal,[0,0,0]);return pair;}
const available=names.every(name=>fs.existsSync(path.join(evidenceDir,name+'-birth.v8')));
function observations(name){const x=v8.deserialize(fs.readFileSync(path.join(evidenceDir,name+'-birth.v8')));assert.equal(x.identity.schema,'original-cue-single-birth-boundary-v1');assert.equal(x.identity.case.id,name);assert.equal(x.identity.native.sourceRevision,SOURCE);assert.equal(x.observations.length,3);return x.observations;}

test('empty-cache birth uses source local AABB origin extents, not hardcoded cue dimensions',()=>{
 const stage=E.createReferenceStage();try{for(const dims of[[.03075,.0058,.06],[.08,.01,.025],[.025,.007,.45]]){
  const input=fixture();[input.sphere.radius,input.cylinder.radius,input.cylinder.halfHeight]=dims.map(f);input.predictionDistance=f(.0002);input.contactRecycleDistance=f(.0001);
  const output=stage.step(freeze(input)),r=input.sphere.radius,c=input.cylinder.radius,h=input.cylinder.halfHeight;
  assert.equal(output.maxExtent,Math.max(scalarLength([r,r,r]),scalarLength([c,h,c])));assert.equal(output.maxDrift,input.contactRecycleDistance);assert.equal(output.recycled,false);assert.equal(output.backend,'cpu-reference');assert.equal(output.actualDispatches,0);assert.deepEqual(output.shapeDimensions,dims.map(f));
 }}finally{stage.dispose();}
});

test('recycling preserves previous numeric cache and does not overwrite input',()=>{
 const stage=E.createReferenceStage();try{const initial=fixture(),cache=stage.step(initial),next=copy(initial);next.previous=cache;next.cylinder.translation[2]=f(next.cylinder.translation[2]+.00002);next.predictionDistance=0;const saved=copy(next),result=stage.step(freeze(next));
  assert.equal(result.recycled,true);assert.ok(result.drift>0);assert.deepEqual(numeric(result),numeric(cache));assert.deepEqual(next,saved);assert.notEqual(result.recycleTranslation,cache.recycleTranslation);
  const changed=copy(saved);changed.cylinder.translation[2]=f(changed.cylinder.translation[2]+.001);const refreshed=stage.step(changed);assert.equal(refreshed.recycled,false);assert.equal(refreshed.maxDrift,0);assert.equal(refreshed.maxExtent,cache.maxExtent);assert.notDeepEqual(refreshed.recycleTranslation,cache.recycleTranslation);
 }finally{stage.dispose();}
});

test('source drift comparison includes equality and rejects the next representable displacement',()=>{
 const stage=E.createReferenceStage();try{const input=fixture();input.cylinder.translation=[0,0,.5];input.cylinder.localTranslation=[0,0,0];input.predictionDistance=2**-10;input.contactRecycleDistance=2**-9;input.previous=stage.step(input);input.cylinder.translation[2]=.5+2**-10;
  const equal=stage.step(input);assert.equal(equal.drift,input.predictionDistance);assert.equal(equal.recycled,true);input.cylinder.translation[2]+=(2**-24);const outside=stage.step(input);assert.ok(outside.drift>input.predictionDistance);assert.equal(outside.recycled,false);
 }finally{stage.dispose();}
});

test('source absolute-rotation gate refreshes a pair with unchanged relative pose',()=>{
 const stage=E.createReferenceStage();try{const input=fixture();input.cylinder.localTranslation=[0,0,0];input.previous=stage.step(input);const q=[0,0,f(Math.sin(.2)),f(Math.cos(.2))];input.sphere.rotation=q.slice();input.cylinder.rotation=q.slice();const result=stage.step(input);
  assert.ok(result.drift<input.previous.maxDrift);assert.ok(result.rotationCos<f(.98));assert.equal(result.recycled,false);assert.notDeepEqual(result.recycleRotation1,input.previous.recycleRotation1);
 }finally{stage.dispose();}
});

test('source relative rotation contributes the chord bound even without translation',()=>{
 const stage=E.createReferenceStage();try{const input=fixture();input.cylinder.localTranslation=[0,0,0];input.previous=stage.step(input);input.cylinder.rotation=[0,0,f(Math.sin(.001)),f(Math.cos(.001))];const result=stage.step(input);assert.ok(result.rotationCos>f(.98));assert.ok(result.drift>input.previous.maxDrift);assert.equal(result.recycled,false);
 }finally{stage.dispose();}
});

test('empty-cache stage fails closed for contacts, shape changes, malformed source values, and disposal',()=>{
 const stage=E.createReferenceStage();try{const base=fixture(),previous=stage.step(base);const mutations=[s=>{s.separated=false;},s=>{s.shapesChanged=true;},s=>{s.activeContacts=1;},s=>{s.sphere.radius=.03075;},s=>{s.sphere.rotation=[0,0,0,2];},s=>{s.cylinder.halfHeight=0;},s=>{s.contactRecycleDistance=0;},s=>{s.predictionDistance=-1;},s=>{delete s.previous;},s=>{s.previous=copy(previous);s.cylinder.radius=f(.006);},s=>{s.previous=copy(previous);delete s.previous.shapeDimensions;}];
  for(const mutate of mutations){const input=copy(base);mutate(input);assert.throws(()=>stage.step(input),RangeError);}assert.equal(E.CAPABILITY.separationProof,false);assert.equal(E.CAPABILITY.contactSolver,false);
 }finally{stage.dispose();}assert.throws(()=>stage.step(fixture()),/disposed/);
});

test('frozen original birth and reuse caches match exactly from previous-h own body poses',{skip:!available},()=>{
 const stage=E.createReferenceStage();try{for(const name of names){const observed=observations(name);let previous=null;assert.equal(observed[0].pairs.some(p=>p.collider1.index===16&&p.collider2.index===24),false);for(let i=0;i<2;i++){
  const expected=targetPair(observed[i+1]).rigid.recycle_state,input=observedInput(observed[i],previous),result=stage.step(freeze(input));assert.equal(result.recycled,i===1);assert.deepEqual(numeric(result),nativeCache(expected),name+' h'+observed[i].h+' -> h'+observed[i+1].h);previous=result;
 }}}finally{stage.dispose();}
});

test('actual WGSL uses the same f32 graph for birth, reuse, and drift refresh',{timeout:60000,skip:!process.env.GPU_NATIVE_MODULE&&process.env.REQUIRE_WEBGPU!=='1'},async()=>{
 assert.ok(process.env.GPU_NATIVE_MODULE,'GPU_NATIVE_MODULE required for actual WGSL');const{create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice(),cpu=E.createReferenceStage();let stage;
 try{stage=await E.createGpuStage(device);const inputs=[fixture()];for(const dims of[[.08,.01,.025],[.025,.007,.45]]){const s=fixture();[s.sphere.radius,s.cylinder.radius,s.cylinder.halfHeight]=dims.map(f);inputs.push(s);}for(const s of inputs){let previous=null;for(const displacement of[0,.00002,.001]){const input=copy(s);input.previous=previous;input.cylinder.translation[2]=f(input.cylinder.translation[2]+displacement);const expected=cpu.step(input),actual=await stage.step(input);assert.equal(actual.backend,'webgpu');assert.equal(actual.actualDispatches,1);assert.deepEqual({...actual,backend:'cpu-reference',actualDispatches:0},expected);previous=actual;}}
  if(available)for(const name of names){const observed=observations(name);let previous=null;for(let i=0;i<2;i++){const input=observedInput(observed[i],previous),actual=await stage.step(input);assert.deepEqual(numeric(actual),nativeCache(targetPair(observed[i+1]).rigid.recycle_state));assert.equal(actual.recycled,i===1);previous=actual;}}
 }finally{stage?.dispose();cpu.dispose();device.destroy();}
});
