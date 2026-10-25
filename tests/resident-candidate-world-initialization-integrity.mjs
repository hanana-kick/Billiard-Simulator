import test from 'node:test';
import assert from 'node:assert/strict';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createWorldInitializationPlan,assertWorldInitializationPlan,buildWorldInitializationCommands} from '../src/resident-candidate/world-initialization.mjs';
import {assertCreationTemplate} from '../src/resident-candidate/creation-template.mjs';
import Point from '../src/experimental-convex-point.js';

let pending;
const fixture=()=>pending??=(async()=>{
 const source=await originalRegisteredFixture();
 return createWorldInitializationPlan({decoder:source.decoder,input:source.raw,rule:{firstId:3,secondId:4,method:'none',allowKiss:true,maxOuterSteps:12000}});
})();

test('initial plan seals all reachable plain compiler metadata without replacing branded objects',async()=>{
 const plan=await fixture(),seen=new WeakSet();let objects=0,views=0;
 const visit=value=>{
  if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
  if(ArrayBuffer.isView(value)){views++;assert.equal(Object.isExtensible(value),false);return;}
  objects++;assert.equal(Object.isFrozen(value),true);
  for(const name of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,name);assert.ok(Object.hasOwn(d,'value'));visit(d.value);}
 };
 visit(plan);assert.ok(objects>1000,'actual original compiler graphs inspected');assert.ok(views>100,'all compiled maps/programs, not only upload arrays');
 assert.equal(assertCreationTemplate(plan.receipt),plan.receipt,'authenticated receipt identity preserved');
 for(const obstacle of plan.roster.obstacles.filter(o=>o.shape.type==='convex')){
  const hull=obstacle.shape.nativeTopology;
  assert.equal(obstacle.shape.points,hull.points,'original hull alias retained');
  assert.doesNotThrow(()=>Point.packQuery({hull,point:[0,0,0],solid:true}),'original weak brand still admitted');
 }
 assert.equal(assertWorldInitializationPlan(plan),plan);
});

test('numeric metadata, source graphs and nested input/output maps are immutable before code generation',async()=>{
 const plan=await fixture(),entry=plan.template.bundles.coupled.entries[0],ccd=plan.template.bundles.ccd.entries.pre;
 const mutations=[
  ()=>{entry.compiled.outputCount++;},
  ()=>{entry.compiled.scratchWords++;},
  ()=>{entry.reads[0][0]++;},
  ()=>{entry.writes[0][0]++;},
  ()=>{ccd.base++;},
  ()=>{ccd.plan.nodes[0].kind='const';},
  ()=>{plan.raw.initialSchedule[1].repeat=1;},
  ()=>{plan.roster.obstacles[0].position[0]=99;},
  ()=>{plan.template.bindings[0].sceneSlot=99;}
 ];
 for(const mutate of mutations)assert.throws(mutate,TypeError);
 assert.equal(assertWorldInitializationPlan(plan),plan);
 assert.doesNotThrow(()=>buildWorldInitializationCommands(plan,1));
});

test('every typed view including compiler-only output slots is compared byte-exactly on admission',async()=>{
 const plan=await fixture(),seen=new WeakSet(),views=[];
 const visit=(value,path)=>{
  if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
  if(ArrayBuffer.isView(value)){views.push([value,path]);return;}
  for(const name of Reflect.ownKeys(value))visit(Object.getOwnPropertyDescriptor(value,name).value,path+'.'+String(name));
 };
 visit(plan,'plan');
 // Mutate every unique view, including aliases not present in initial uploads.
 // Reuse one authenticated graph: restoration is test-only, never runtime repair.
 for(const [view,path]of views){
  assert.ok(view.byteLength>0,path);const bytes=new Uint8Array(view.buffer,view.byteOffset,view.byteLength),old=bytes[0];
  try{bytes[0]=old^1;assert.throws(()=>assertWorldInitializationPlan(plan),/initial data mutated/,path);}
  finally{bytes[0]=old;}
 }
 const slots=plan.template.bundles.ccd.entries.pre.compiled.outputSlots,old=slots[0];
 try{slots[0]=old^1;assert.throws(()=>buildWorldInitializationCommands(plan,1),/initial data mutated: .*outputSlots/,'code generation fails before a GPU object is needed');}
 finally{slots[0]=old;}
 assert.throws(()=>Object.defineProperty(slots,'byteLength',{value:0}),TypeError);
 assert.equal(assertWorldInitializationPlan(plan),plan);
});
