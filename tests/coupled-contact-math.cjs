'use strict';
// Prepared-manifold arithmetic tests. These do not certify broad-phase,
// activation, contact discovery, CCD, or an end-to-end four-ball world.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const Coupled=require('../src/experimental-coupled-contact-math');
const Cloth=require('../src/experimental-cloth-island-world');
const Cushion=require('../src/experimental-cushion-roster-world');
const Graph=require('../src/experimental-arithmetic-graph');
const f=Math.fround,vec=x=>x.map(f),clone=x=>structuredClone(x),zero=()=>[0,0,0];
const common=Object.freeze({dt:f(1/240),lengthUnit:1,normalizedMaxLinearVelocity:1000,dynamicFrequency:30,dynamicDamping:5,staticFrequency:120,staticDamping:5,warmstartCoefficient:1,normalizedMaxCorrectiveVelocity:10,frictionInBiasPass:false,gravity:[0,f(-9.81),0],substeps:4,pgsIterations:1,stabilizationIterations:1});
function body(x=0,z=0){
 const radius=f(.03),mass=f(.17),inertia=f(f(f(.4)*mass)*f(radius*radius)),inv=f(1/inertia);
 return {linear:vec([.4,0,.15]),angular:vec([1,2,-3]),translation:vec([x,radius-.00001,z]),rotation:[0,0,0,1],invMass:Array(3).fill(f(1/mass)),invInertia:[inv,0,0,0,inv,0,0,0,inv],principalInertia:Array(3).fill(inertia),invPrincipalInertia:Array(3).fill(inv),principalFrame:[0,0,0,1],userForce:zero(),userTorque:zero(),gravityScale:1,linearDamping:0,angularDamping:0,gyroscopic:true,allowFastRotation:false,radius};
}
function baseContact(){return{warmWorld:zero(),warmImpulse:0,impulse:0,friction:f(.2),restitution:f(.8)};}
function cloth(b){
 const p=b.translation,r=b.radius;
 return {...baseContact(),normal:[0,1,0],anchor1:[p[0],0,p[2]],anchor2:[0,-r,0],dp1:[p[0],f(p[1]-r),p[2]],dp2:[0,-r,0],friction:f(.25),restitution:0};
}
function pair(a,b){
 const delta=b.translation.map((x,i)=>f(x-a.translation[i])),length=Math.hypot(...delta),n=vec(delta.map(x=>x/length)),r1=a.radius,r2=b.radius;
 const p1=n.map(x=>f(x*r1)),p2=n.map(x=>f(-x*r2));
 return {...baseContact(),normal:n,anchor1:p1,anchor2:p2,dp1:p1,dp2:p2};
}
function convex(b,normal){
 const n=vec(normal),dp=n.map(x=>f(-b.radius*x));
 return {...baseContact(),normal:n,anchor1:b.translation.map((x,i)=>f(x+dp[i])),anchor2:dp,dp1:b.translation.map((x,i)=>f(x+dp[i])),dp2:dp,friction:f(.15),restitution:f(.7)};
}
function config(bodies,contacts,contactOrder=contacts.map((_,i)=>i)){
 return {bodyCount:bodies.length,substeps:common.substeps,pgsIterations:common.pgsIterations,stabilizationIterations:common.stabilizationIterations,contacts,contactOrder};
}
function twoFixture(){
 const bodies=[body(-.02995),body(.02995)];bodies[0].linear=vec([.5,0,.1]);bodies[1].linear=vec([-.3,0,-.08]);
 const contacts=[pair(...bodies),...bodies.map(cloth)];contacts[0].warmWorld=vec([0,.00001,-.00003]);contacts[0].warmImpulse=f(.0001);contacts[0].impulse=f(.0004);
 const spec=config(bodies,[{kind:'dynamic-sphere',body1:0,body2:1},{kind:'cloth',body1:null,body2:0},{kind:'cloth',body1:null,body2:1}],[0,2,1]);
 return {spec,input:{...common,bodies,contacts}};
}
function fourFixture(withCushions=false){
 const bodies=[body(-.0898),body(-.0299),body(.0299),body(.0898)];
 bodies[0].linear=vec([1,0,.02]);bodies[1].linear=vec([.1,0,-.03]);bodies[2].linear=vec([-.1,0,.01]);bodies[3].linear=vec([-.25,0,0]);
 const descriptors=[{kind:'dynamic-sphere',body1:0,body2:1},{kind:'dynamic-sphere',body1:1,body2:2},{kind:'dynamic-sphere',body1:2,body2:3},...bodies.map((_,body2)=>({kind:'cloth',body1:null,body2}))];
 const contacts=[pair(bodies[0],bodies[1]),pair(bodies[1],bodies[2]),pair(bodies[2],bodies[3]),...bodies.map(cloth)];
 const order=[0,2,1,3,4,5,6];
 if(withCushions){descriptors.push({kind:'static-convex',body1:null,body2:0},{kind:'static-convex',body1:null,body2:3});contacts.push(convex(bodies[0],[0,0,1]),convex(bodies[3],[-1,0,0]));order.splice(3,0,7,8);}
 return {spec:config(bodies,descriptors,order),input:{...common,bodies,contacts}};
}
function legacyTwo(input){
 const zeros={normal:zero(),anchor1:zero(),anchor2:zero(),dp1:zero(),dp2:zero(),warmWorld:zero(),warmTangent:[0,0],localP1:zero(),localP2:zero(),localN1:zero(),localN2:zero(),recycleTranslation:zero(),recycleRelativeRotation:[0,0,0,1],recycleRotation1:[0,0,0,1],recycleRotation2:[0,0,0,1],fatMin1:zero(),fatMax1:zero(),fatMin2:zero(),fatMax2:zero(),tangentImpulse:[0,0]};
 return {...zeros,...common,...input.contacts[0],bodies:input.bodies,floorContacts:input.contacts.slice(1),floorOrder:[1,0],normalizedPredictionDistance:f(.002),contactRecycleDistance:f(.001),contactDistance:0,maxExtent:.1,maxDrift:.001,recycleValid:1,pointPresent:1,active:1,pairPresent:1,contactId:0};
}
function disposeAll(stages){for(const stage of Object.values(stages)){if(stage instanceof Map){for(const x of stage.values())x.dispose();}else if(Array.isArray(stage))stage.forEach(x=>x.dispose());else if(stage?.dispose)stage.dispose();}}
function compareClose(actual,expected,label,tolerance=2e-6){
 assert.equal(actual.length,expected.length,label+'.length');
 for(let i=0;i<expected.length;i++){const error=Math.abs(actual[i]-expected[i]);assert.ok(Number.isFinite(actual[i])&&error<=tolerance*Math.max(1,Math.abs(expected[i])),label+'['+i+']: '+actual[i]+' != '+expected[i]);}
}

test('generic two-body pair/cloth solve is bit-identical to existing source arithmetic',()=>{
 const {spec,input}=twoFixture(),legacy=Cloth.createReferenceMathStages({...common,floorOrder:[1,0]}),stage=Coupled.createReferenceMathStage(spec);
 try{
  const expected=legacy.contact[1].step(legacyTwo(input)),actual=stage.step(input);
  for(let i=0;i<2;i++)assert.deepEqual(actual['body'+i],expected['body'+i]);
  assert.deepEqual(actual.contact0,[expected.impulse,expected.warmImpulse,...expected.warmTangent,...expected.warmWorld]);
  assert.deepEqual(actual.contact1,expected.floor0.map(x=>x===0?0:x));assert.deepEqual(actual.contact2,expected.floor1.map(x=>x===0?0:x));
  assert.deepEqual(actual.basis0,[expected.basisSign,...expected.basisNormal,...expected.tangentBasis1]);
 }finally{disposeAll(legacy);stage.dispose();}
});

test('generic fixed convex/cloth solve preserves existing three-contact source arithmetic',()=>{
 const b=body(),floor=cloth(b),cushions=[convex(b,[-1,0,0]),convex(b,[0,0,-1])],contacts=[floor,...cushions],spec=config([b],contacts.map((_,i)=>({kind:i?'static-convex':'cloth',body1:null,body2:0})),[2,1,0]);
 const old={...common,normalizedPredictionDistance:f(.002),contactRecycleDistance:f(.001),body:b,floor,cushions,hullBounds:[{min:[-1,-1,-1],max:[1,1,1]}],topology:{ballMin:zero(),ballMax:zero(),floorMin:zero(),floorMax:zero()}};
 old.cushions.forEach(c=>c.proxy={min:zero(),max:zero()});
 const legacy=Cushion.createReferenceMathStages(common),stage=Coupled.createReferenceMathStage(spec);
 try{const expected=legacy.contacts.get('2,1').step(old),actual=stage.step({...common,bodies:[b],contacts});assert.deepEqual(actual.body0,expected.body0);for(let i=0;i<3;i++)assert.deepEqual(actual['contact'+i],expected['contact'+i].map(x=>x===0?0:x));for(let i=1;i<3;i++)assert.deepEqual(actual['basis'+i],expected['basis'+i]);}
 finally{disposeAll(legacy);stage.dispose();}
});

test('four-body chain uses shared velocities, caller source order, and all original roster indexes',()=>{
 const {spec,input}=fourFixture(true),stage=Coupled.createReferenceMathStage(spec),reverse=Coupled.createReferenceMathStage({...spec,contactOrder:[...spec.contactOrder].reverse()});
 const saved=clone(input);
 try{
  const actual=stage.step(input),reversed=reverse.step(input);
  assert.equal(actual.bodies.length,4);assert.equal(actual.contacts.length,9);assert.deepEqual(input,saved,'prepared manifold input is immutable');
  assert.ok(actual.contacts.slice(0,3).every(x=>x.impulse>0),'all three pair constraints bear load');
  assert.ok(actual.bodies.some((x,i)=>x.linear.some((v,j)=>v!==reversed.bodies[i].linear[j])),'ordered shared-velocity sweeps must not collapse into independent pair results');
  assert.deepEqual(actual,stage.step(input),'identical plan and inputs are deterministic');
  for(let i=0;i<4;i++){assert.equal(actual['body'+i].length,25);assert.deepEqual(actual.bodies[i].force,input.gravity.map((v,j)=>f(f(v*f(1/input.bodies[i].invMass[j]))*input.bodies[i].gravityScale)));}
 }finally{stage.dispose();reverse.dispose();}
});

test('an uncoupled roster body integrates only once despite many other contacts',()=>{
 const {spec,input}=fourFixture();
 const retained=spec.contactOrder.filter(i=>![2,6].includes(i)),coupled=Coupled.createReferenceMathStage({...spec,contactOrder:retained}),free=Coupled.createReferenceMathStage({...spec,contactOrder:[]});
 try{const actual=coupled.step(input),expected=free.step(input);assert.deepEqual(actual.body3,expected.body3);assert.equal(actual.contacts[2],null);assert.equal(actual.contacts[6],null);assert.equal(expected.contacts.filter(Boolean).length,0);}
 finally{coupled.dispose();free.dispose();}
});

test('body and manifold storage permutation does not change a fixed native execution order',()=>{
 const {spec,input}=fourFixture(true),bodyOrder=[2,0,3,1],contactOrder=[8,3,1,6,2,0,7,5,4],bi=old=>bodyOrder.indexOf(old),ci=old=>contactOrder.indexOf(old);
 const remapped={...spec,contacts:contactOrder.map(i=>({...spec.contacts[i],body1:spec.contacts[i].body1===null?null:bi(spec.contacts[i].body1),body2:bi(spec.contacts[i].body2)})),contactOrder:spec.contactOrder.map(ci)};
 const a=Coupled.createReferenceMathStage(spec),b=Coupled.createReferenceMathStage(remapped);
 try{const x=a.step(input),y=b.step({...input,bodies:bodyOrder.map(i=>input.bodies[i]),contacts:contactOrder.map(i=>input.contacts[i])});for(let i=0;i<4;i++)assert.deepEqual(x['body'+i],y['body'+bi(i)]);for(let i=0;i<9;i++)assert.deepEqual(x['contact'+i],y['contact'+ci(i)]);}
 finally{a.dispose();b.dispose();}
});

test('configuration and prepared data reject unsupported or ambiguous domains',()=>{
 const {spec,input}=twoFixture();
 for(const edit of[x=>x.bodyCount=5,x=>x.contacts[0].body1=x.contacts[0].body2,x=>x.contacts[1].body1=0,x=>x.contactOrder=[0,0],x=>x.contactOrder=[99],x=>x.stabilizationIterations=0]){const bad=clone(spec);edit(bad);assert.throws(()=>Coupled.createReferenceMathStage(bad));}
 const stage=Coupled.createReferenceMathStage(spec);
 try{for(const edit of[x=>x.frictionInBiasPass=true,x=>x.bodies[0].localCom=[1,0,0],x=>x.contacts[0].tangentVelocity=[1,0,0],x=>x.contacts[0].normal=[0,0,0],x=>x.contacts[1].normal=[1,0,0],x=>x.contacts[0].body2=0,x=>x.dt=NaN,x=>x.contacts[0].warmImpulse=-1,x=>x.bodies[0].rotation=[0,0,0,2],x=>x.substeps=2]){const bad=clone(input);edit(bad);assert.throws(()=>stage.step(bad));}}
 finally{stage.dispose();}assert.throws(()=>stage.step(input),/disposed/);
 const plan=Coupled.buildPlan(spec),packed=Coupled.pack(input,plan);assert.ok(packed instanceof Float32Array);assert.deepEqual(Coupled.unpack(Graph.execute(packed,plan),plan).bodies.length,2);
});

test('actual WGSL executes two-/four-body shared contact plans and matches the scalar graph',{skip:!process.env.GPU_NATIVE_MODULE&&process.env.REQUIRE_WEBGPU!=='1',timeout:180000},async t=>{
 assert.ok(process.env.GPU_NATIVE_MODULE,'GPU_NATIVE_MODULE is required');
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter,'Actual Vulkan WebGPU adapter required');const device=await adapter.requestDevice();
 const release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'coupled-contact-math');
 try{
  for(const [id,fixture]of[['two-body',twoFixture()],['four-body-chain',fourFixture()],['four-body-chain-two-cushions',fourFixture(true)]]){
   const cpu=Coupled.createReferenceMathStage(fixture.spec),actual=await Coupled.createGpuMathStage(device,fixture.spec);
   try{
    const expected=cpu.step(fixture.input),got=await actual.step(fixture.input);
    for(let i=0;i<fixture.spec.bodyCount;i++)compareClose(got['body'+i],expected['body'+i],id+'.body'+i);
    for(const i of fixture.spec.contactOrder){compareClose(got['contact'+i],expected['contact'+i],id+'.contact'+i);compareClose(got['basis'+i],expected['basis'+i],id+'.basis'+i,0);}
    t.diagnostic(id+': actual WGSL shared solve matched all body, impulse and basis fields');
   }finally{cpu.dispose();actual.dispose();}
  }
 }finally{release();}
});
