/* HOST source-only constructor gates. Original fixture import occurs only here;
 * production never reads this fixture, V8 bytes or assertion snapshots. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {deserialize} from 'node:v8';import {createHash} from 'node:crypto';
import {createInitialMicrocodeRuntime,assertInitialMicrocodeRuntime,INITIAL_MICROCODE_CAPABILITY} from '../src/resident-candidate/initial-microcode-runtime.mjs';
import {inspectInitialMicrocodeBudget} from '../src/resident-candidate/initial-microcode-budget.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createWorldInitializationPlan} from '../src/resident-candidate/world-initialization.mjs';
import {isOwnedUint32Array} from '../src/resident-candidate/abi.mjs';
const directory=process.env.RESIDENT_INITIAL_RUNTIME_ARTIFACTS;
const options={experimental:true,maxHSteps:2,dispatchChunks:512};
const sha=x=>createHash('sha256').update(x).digest('hex');
let pending;const fixture=()=>pending??=(async()=>{assert.ok(directory,'explicit frozen initial-only identity fixture directory');const bytes=readFileSync(directory+'/runtime.v8');assert.equal(sha(bytes),'780872cc0105e20375dcbd2f84a2e1962176133feefb23fdaa0a0778b312b4de');const previous=deserialize(bytes),source=await originalRegisteredFixture(),initialization=await createWorldInitializationPlan({decoder:source.decoder,input:source.raw,rule:previous.original.identity.rule});const runtime=createInitialMicrocodeRuntime(initialization,previous.original.identity.rawRows,options);return{previous,source,initialization,runtime};})();
const enabled={skip:directory?false:'set RESIDENT_INITIAL_RUNTIME_ARTIFACTS for genuine initialization/source comparison'};
test('unbranded initialization/runtime, unknown authority, mandatory audit/observer and budgets reject before source generation',()=>{
 assert.throws(()=>createInitialMicrocodeRuntime({},[],options),/authentic local initialization/);assert.throws(()=>assertInitialMicrocodeRuntime({}),/locally constructed/);
 for(const extra of[{eventAudit:true},{eventAudit:false},{observer:{}},{observation:{}},{qualifiedMask:0xffffffff},{numericallyQualified:true},{intrinsics:'source-f64-v1'},{instructionBudget:32768},{maxHSteps:undefined},{dispatchChunks:undefined},{experimental:false}])assert.throws(()=>createInitialMicrocodeRuntime({},[],{...options,...extra}));
 let read=false;const accessor={...options};Object.defineProperty(accessor,'maxHSteps',{get(){read=true;return 2;}});assert.throws(()=>createInitialMicrocodeRuntime({},[],accessor));assert.equal(read,false);
 assert.equal(INITIAL_MICROCODE_CAPABILITY.numericallyQualified,false);assert.equal(INITIAL_MICROCODE_CAPABILITY.defaultBackend,false);
});
test('authentic production constructor exactly regenerates accepted six initializer/source/logical views/bytecode/core/macros',enabled,async()=>{
 const {runtime:r,previous:p,initialization}=await fixture();assert.equal(assertInitialMicrocodeRuntime(r),r);assert.equal(initialization.receipt.nativeStepCount,0);
 for(const key of['count','frames','sweeps','sourceMode','transport','init','pc','program','input','sharedGeometry'])assert.deepEqual(r.original[key],p.original[key],key+' exact independent frozen content');
 const {macroProfile:oldProfile,...oldVm}=p.vm,{macroProfile:newProfile,...newVm}=r.vm;assert.deepEqual(newVm,oldVm,'complete unchanged VM object except explicit envelope profile');assert.notEqual(newProfile,oldProfile);
 for(const key of['sourceSha256','bytecodeSha256','vmShaderSha256'])assert.equal(r.identity[key],p.identity[key]);assert.equal(r.source.code,readFileSync(directory+'/source.wgsl','utf8'));
 assert.equal(r.sourcePreparation.budget.sourceInstructionBudget,32768);assert.equal(r.sourcePreparation.budget.coupledCallPC,40072);assert.equal(r.sourcePreparation.eventAudit,false);assert.equal(r.sourcePreparation.observation,false);assert.equal(r.sourcePreparation.capability.numericallyQualified,false);
 assert.notEqual(r.original.input,p.original.input);assert.notEqual(r.original.sharedGeometry,initialization.template.sharedGeometry,'detached owned copy, no borrowed mutable initial view');
 assert.throws(()=>assertInitialMicrocodeRuntime(structuredClone(r)),/locally constructed/);
 const before=sha(readFileSync(directory+'/runtime.v8'));assert.equal(before,'780872cc0105e20375dcbd2f84a2e1962176133feefb23fdaa0a0778b312b4de');
});
test('every owned typed payload mutation rejects; data freezing blocks nested metadata edits',enabled,async()=>{
 const {runtime:r}=await fixture(),seen=new WeakSet(),views=[];const visit=x=>{if(!x||typeof x!=='object'||seen.has(x))return;seen.add(x);if(ArrayBuffer.isView(x)){assert.ok(isOwnedUint32Array(x));if(x.length)views.push(x);return;}assert.ok(Object.isFrozen(x));for(const v of Object.values(x))visit(v);};visit(r);assert.ok(views.length>=10);
 for(const view of views){const old=view[0];view[0]=old^1;assert.throws(()=>assertInitialMicrocodeRuntime(r),/contents changed/);view[0]=old;assert.equal(assertInitialMicrocodeRuntime(r),r);}
 for(const view of[r.vm.code,r.original.program,r.original.sharedGeometry]){const bytes=new Uint8Array(view.buffer,view.byteOffset,view.byteLength),last=bytes.length-1,old=bytes[last];bytes[last]^=0x80;assert.throws(()=>assertInitialMicrocodeRuntime(r),/contents changed/);bytes[last]=old;assert.equal(assertInitialMicrocodeRuntime(r),r);assert.throws(()=>Object.defineProperty(view,'byteOffset',{value:0}));assert.throws(()=>Object.setPrototypeOf(view,{}));}
 assert.throws(()=>{r.original.input=r.original.input.slice();});
 assert.throws(()=>{r.vm.dispatchChunks=1;});assert.throws(()=>{r.vm.externalFunctions[0].approval.bodySha256='0'.repeat(64);});
});
test('source budget proof rejects body, count-guard, compiled-guard, descriptor and layout drift',enabled,async()=>{
 const {runtime:r}=await fixture(),base=deserialize(readFileSync(directory+'/compiled.v8')),args={code:r.source.code,compiled:base,count:6,stateWords:62976,scratchWords:13632};assert.equal(inspectInitialMicrocodeBudget(args).sourceInstructionBudget,32768);
 for(const mutate of[a=>{a.code=a.code.replace('fn rc_owner_coupled_body_1(bank:u32,scratch:u32){if(rc_state[bank+62720u+24u]!=32768u)','fn rc_owner_coupled_body_1(bank:u32,scratch:u32){if(rc_state[bank+62720u+24u]!=32767u)');a.compiled.sourceSha256=sha(a.code);},a=>a.count=8,a=>a.stateWords++,a=>a.scratchWords++,a=>a.compiled.instructions[40017*8+2]=32769,a=>a.compiled.instructions[97346*8+2]++,a=>a.compiled.externalFunctions.find(x=>x.id===3).approval.bodySha256='0'.repeat(64)]){const a=structuredClone(args);mutate(a);assert.throws(()=>inspectInitialMicrocodeBudget(a));}
});
test('new identity binds real source/count/logical spans and has no historical fixture metadata',enabled,async()=>{
 const {runtime:r,previous:p,initialization}=await fixture();assert.deepEqual(r.original.identity.rule,p.original.identity.rule);assert.deepEqual(r.original.identity.options,p.original.identity.options);assert.deepEqual(r.original.identity.pipelineIdentity,p.original.identity.pipelineIdentity);
 assert.equal(r.sourcePreparation.generatorProfile,'resident-preparation-disabled-integrated-isa-source-v1');assert.deepEqual(r.sourcePreparation.logicalViews,{sourceState:379496,sourceProgram:874992,sourceGeometry:25408,sourceScratch:81792,sourceInputs:96,microcode:131112*8,vmState:46884});assert.equal(r.identity.originalGeneration,r.original.identity.generationIdentity);assert.equal('sourceHead'in r.original.identity,false);assert.equal('sourceArtifactSha256'in r.original.identity,false);
 const rows=structuredClone(p.original.identity.rawRows);rows[0].settings.angle=-0;rows[0].expected={};assert.throws(()=>createInitialMicrocodeRuntime(initialization,rows,options),/expected\/future/);
 const duplicate=structuredClone(p.original.identity.rawRows);duplicate[1].id=duplicate[0].id;assert.throws(()=>createInitialMicrocodeRuntime(initialization,duplicate,options),/Distinct unsigned/);
});
test('owned runtime detach rejects and cannot change separately authenticated source plan',enabled,async()=>{
 const {runtime:r,initialization}=await fixture(),before=sha(initialization.template.sharedGeometry);structuredClone(r.original.sharedGeometry,{transfer:[r.original.sharedGeometry.buffer]});assert.throws(()=>assertInitialMicrocodeRuntime(r));assert.equal(sha(initialization.template.sharedGeometry),before);
});
test('arbitrary raw values/IDs and explicit h ceiling are not replaced by the historical six-row fixture',enabled,async()=>{
 const {initialization,previous}=await fixture(),rows=structuredClone(previous.original.identity.rawRows);rows.forEach((r,i)=>{r.id=1000+i;});rows[0].settings={angle:-0,elevation:33.33333333333333,speed:1.001,tipX:Infinity,tipY:NaN};
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{configurable:true,get(){throw new Error('Source constructor must not request an ambient device');}});
 let r;try{r=createInitialMicrocodeRuntime(initialization,rows,{experimental:true,maxHSteps:43,dispatchChunks:3});}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
 assert.equal(assertInitialMicrocodeRuntime(r),r);assert.equal(r.original.frames,43);assert.equal(r.original.pc.maxH,43);assert.equal(r.vm.dispatchChunks,3);assert.equal(r.vm.instructionBudget,65536);assert.equal(r.sourcePreparation.budget.sourceInstructionBudget,32768);
 assert.deepEqual(r.original.identity.rawRows,rows);assert.ok(Object.is(r.original.identity.rawRows[0].settings.angle,-0));assert.equal(r.original.identity.rawRows[0].settings.tipX,Infinity);assert.ok(Number.isNaN(r.original.identity.rawRows[0].settings.tipY));assert.equal(r.original.input[0],1000);assert.equal('results'in r,false,'input transport has no fabricated success/miss');
});
