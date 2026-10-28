import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createPreparationSourceReference} from './resident-candidate-preparation-source-reference.mjs';
const root=body=>`fn rc_geometry_numeric_prepare(a:u32,b:u32,c:u32,d:u32,e:u32,f:u32)->u32{${body}}`;
const ref=code=>createPreparationSourceReference({testOnly:true,code});
const bindings=()=>[new Uint32Array(16),new Uint32Array(4),new Uint32Array(4),new Uint32Array(16),new Uint32Array(4),new Uint32Array(4)];
const args=[0,0,0,0,0,0];

test('source scalar arithmetic wraps exactly with lexical scopes, calls, for/switch and bool cast',()=>{
 const code=root(`var sum=0u;for(var i=0u;i<4u;i++){sum+=i;}let x=mul(0xffffffffu,0xffffffffu);let n=(0xffffffffu+2u)+(0u-1u);switch sum {case 6u:{rc_state[0u]=x;rc_state[1u]=n;rc_state[2u]=0xffffffffu/3u;rc_state[3u]=0xffffffffu%2u;}default:{return 99u;}}return sum+u32(true);`)+`fn mul(x:u32,y:u32)->u32{return x*y;}`;
 const b=bindings(),r=ref(code).execute(args,{bindings:b});assert.equal(r.status,'complete');assert.equal(r.result,7);assert.deepEqual(Array.from(b[0].slice(0,4)),[1,0,1431655765,1]);assert.deepEqual(r.writes.map(w=>w.index),[0,1,2,3]);
});

test('short-circuit skips illegal reads; select evaluates both source operands eagerly in source order',()=>{
 const b=bindings();b[0][0]=7;b[0][1]=9;
 const safe=ref(root(`if(false&&rc_state[999u]!=0u){return 1u;}if(true||rc_state[998u]!=0u){rc_state[2u]=select(rc_state[0u],rc_state[1u],false);}return 2u;`)).execute(args,{bindings:b});
 assert.equal(safe.status,'complete');assert.deepEqual(safe.reads.map(r=>r.index),[0,1]);assert.equal(b[0][2],7);
 const bad=ref(root(`rc_state[0u]=11u;let x=select(rc_state[0u],rc_state[999u],false);rc_state[1u]=12u;return x;`)).execute(args,{bindings:b});
 assert.equal(bad.status,'invalid');assert.equal(bad.error,'storageRange');assert.equal(bad.result,null);assert.deepEqual(bad.reads,[{binding:0,index:0,value:11}]);assert.deepEqual(bad.writes,[{binding:0,index:0,value:11}]);assert.equal(b[0][1],9);
});

test('first out-of-range write stops with prior writes intact and read-only writes cannot mutate input',()=>{
 const b=bindings();const r=ref(root(`rc_state[0u]=12u;rc_scratch[16u]=13u;rc_state[1u]=14u;return 0u;`)).execute(args,{bindings:b});
 assert.equal(r.error,'storageRange');assert.equal(b[0][0],12);assert.equal(b[0][1],0);assert.equal(r.writes.length,1);
 const ro=ref(root(`rc_state[1u]=7u;rc_program[0u]=99u;rc_state[2u]=8u;return 0u;`)).execute(args,{bindings:b});
 assert.equal(ro.status,'invalid');assert.equal(ro.error,'readonlyBinding');assert.equal(b[1][0],0);assert.equal(b[0][1],7);assert.equal(b[0][2],0);
});

test('optional candidate state/request/scratch spans reject cross-object accesses but arrayLength remains physical',()=>{
 const b=bindings(),source=root(`rc_state[0u]=arrayLength(&rc_state);rc_state[8u]=rc_program[3u];rc_scratch[4u]=1u;rc_state[4u]=2u;return 0u;`);b[1][3]=55;
 const r=ref(source).execute(args,{bindings:b,spans:{0:[[0,2],[8,2]],3:[[4,2]]}});
 assert.equal(r.status,'invalid');assert.equal(r.error,'storageRange');assert.deepEqual(r.writes.map(x=>[x.binding,x.index,x.value]),[[0,0,16],[0,8,55],[3,4,1]]);assert.equal(b[0][4],0);
 assert.equal(ref(source).execute(args,{bindings:bindings()}).status,'complete');
 assert.throws(()=>ref(source).execute(args,{bindings:b,spans:{1:[[0,1]]}}),/Only mutable/);
 assert.throws(()=>ref(source).execute(args,{bindings:b,spans:{0:[[15,2]]}}),/within/);
});

test('unsupported syntax/types/names and recursive calls reject before any branch execution',()=>{
 assert.throws(()=>createPreparationSourceReference({code:root('return 0u;')}),/testOnly/);
 for(const code of[root('if(false){let x=unknown();}return 0u;'),root('let x:f32=1.0;return 0u;'),root('var x=vec2<u32>(0u);return 0u;'),root('while(true){return 0u;}return 1u;'),root('let x=0u;x=1u;return x;'),root('return recurse();')+'fn recurse()->u32{return recurse();}',root('if(false){let x=missing;}return 0u;')])assert.throws(()=>ref(code),/Preparation source subset/);
 assert.throws(()=>ref(root('return 0u;')).execute([0],{bindings:bindings()}),/Six u32/);
});

test('authentic 27-function closure: all six preparation kinds and first malformed source read, HOST ONLY',t=>{
 const path='/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp/geometry-preparation-closure.wgsl';if(!existsSync(path))return t.skip('Exact local extracted source closure unavailable; no generation/GPU run requested');
 const source=readFileSync(path,'utf8');assert.equal([...source.matchAll(/\bfn\s+/g)].length,27);const reference=ref(source),request=127128;
 const make=()=>[new Uint32Array(127176),new Uint32Array(850000),new Uint32Array(2048),new Uint32Array(27264),new Uint32Array(0),new Uint32Array(0)];
 for(let kind=1;kind<=6;kind++){
  const b=make(),base=37504,g=57856;b[0][31]=1;b[0][26]=base;b[0][27]=1;b[0][28]=1;b[0][29]=1;b[2][0]=kind===1?0:kind===2?1:2;
  if(kind===4){b[0][base+392]=1;b[0][55936]=0x3f800000;}
  if(kind===5){b[0][g+9]=1;b[2][5]=100;b[2][107]=200;b[1][840951]=100;}
  if(kind===6){b[0][g+11]=1;b[0][g+32+2]=2;b[1][840952]=100;b[1][841053]=48;b[1][841054]=20;}
  const r=reference.execute([0,0,request,22,33,kind],{bindings:b,spans:{0:[[0,62976],[request,24]],3:[[0,13632]]}});
  assert.equal(r.status,'complete','kind '+kind);assert.equal(r.result,0);assert.equal(b[0][request+3],1,'kind '+kind+' started numerical request');assert.ok(r.writes.some(w=>w.binding===3),'kind '+kind+' copied actual source inputs');
 }
 const b=make();b[0][31]=1;b[0][25]=25;b[2]=new Uint32Array(2);
 const bad=reference.execute([0,0,request,22,33,1],{bindings:b});assert.equal(bad.status,'invalid');assert.equal(bad.error,'storageRange');assert.equal(b[0][request],0x5243474e);assert.ok(bad.writes.length>=34);assert.equal(bad.reads.at(-1).index,25);
 t.diagnostic(JSON.stringify({sourceFunctions:27,kinds:6,sourceOnly:true,gpuExecuted:false,bytecodeImported:false}));
});

test('actual generated checked helper preserves all six source paths, first fault writes and sticky private guard state',async()=>{
 const {preparationNativeWGSL,preparationSourceWGSL,preparationSpans}=await import('../src/resident-candidate/microcode-preparation.mjs');
 const native=ref(preparationNativeWGSL()),original=ref(preparationSourceWGSL()),request=127128;
 const make=kind=>{const b=[new Uint32Array(127176),new Uint32Array(874992),new Uint32Array(25408),new Uint32Array(27264),new Uint32Array(0),new Uint32Array(0)],base=37504,g=57856;b[0][31]=1;b[0][26]=base;b[0][27]=1;b[0][28]=1;b[0][29]=1;b[2][0]=kind===1?0:kind===2?1:2;if(kind===4){b[0][base+392]=1;b[0][55936]=0x3f800000;}if(kind===5){b[0][g+9]=1;b[2][5]=100;b[2][107]=200;b[1][840951]=100;}if(kind===6){b[0][g+11]=1;b[0][g+32+2]=2;b[1][840952]=100;b[1][841053]=48;b[1][841054]=20;}return b;};
 for(let kind=1;kind<=6;kind++){
  const input=[0,0,request,22,33,kind],expectedBindings=make(kind),actualBindings=expectedBindings.map(x=>x.slice());
  const expected=original.execute(input,{bindings:expectedBindings,spans:preparationSpans(0)}),actual=native.execute(input,{bindings:actualBindings,before:{entry:'rc_gp_begin',args:[0]}});
  assert.equal(expected.status,'complete');assert.equal(actual.status,'complete');assert.equal(actual.result,expected.result);assert.equal(actual.beforeResult,true);assert.deepEqual(actual.globals,{rc_gp_error:0,rc_gp_bank:0});assert.deepEqual(actualBindings,expectedBindings);assert.deepEqual(actual.reads,expected.reads);assert.deepEqual(actual.writes,expected.writes);
 }
 // Cue-pose source copies eight valid geometry words before the ninth access
 // faults. The emitted helper must suppress every later physical write.
 const expectedBindings=make(5);expectedBindings[2][107]=25400;for(let i=25400;i<25408;i++)expectedBindings[2][i]=i;
 const actualBindings=expectedBindings.map(x=>x.slice()),input=[0,0,request,22,33,5];
 const expected=original.execute(input,{bindings:expectedBindings,spans:preparationSpans(0)}),actual=native.execute(input,{bindings:actualBindings,before:{entry:'rc_gp_begin',args:[0]}});
 assert.equal(expected.status,'invalid');assert.equal(expected.error,'storageRange');assert.equal(actual.status,'complete','source helper returns; its explicit private guard reports failure');assert.equal(actual.globals.rc_gp_error,5);assert.equal(actual.writes.filter(w=>w.binding===3).length,8);assert.deepEqual(actualBindings,expectedBindings);assert.deepEqual(actual.writes,expected.writes);assert.deepEqual(actual.reads,expected.reads);
 // A logical cross-candidate state read is physically in-bounds, but invalid.
 const scoped=make(6);scoped[0][57856+2]=100;const scopedCopy=scoped.map(x=>x.slice());
 const sourceResult=original.execute([0,0,request,22,33,6],{bindings:scoped,spans:preparationSpans(0)}),nativeResult=native.execute([0,0,request,22,33,6],{bindings:scopedCopy,before:{entry:'rc_gp_begin',args:[0]}});
 assert.equal(sourceResult.error,'storageRange');assert.equal(nativeResult.globals.rc_gp_error,5);assert.deepEqual(scopedCopy,scoped);assert.deepEqual(nativeResult.writes,sourceResult.writes);
 // Globals initialize once for each new execution; nested calls retain errors.
 const b=make(1),bad=native.execute([0,0],{entry:'rc_gp_read',bindings:b,before:{entry:'rc_gp_begin',args:[1]}});
 assert.equal(bad.beforeResult,false);assert.deepEqual(bad.globals,{rc_gp_error:8,rc_gp_bank:1});assert.equal(bad.reads.length,0);
 const fresh=native.execute([0,0],{entry:'rc_gp_read',bindings:b,before:{entry:'rc_gp_begin',args:[0]}});assert.equal(fresh.beforeResult,true);assert.equal(fresh.globals.rc_gp_error,0);assert.equal(fresh.reads.length,1);
 const readonly=native.execute([1,0,99],{entry:'rc_gp_write',bindings:b,before:{entry:'rc_gp_begin',args:[0]}});assert.equal(readonly.globals.rc_gp_error,6);assert.equal(readonly.writes.length,0);
});

test('only the two observed implicit-zero private u32 globals are admitted',()=>{
 for(const global of['var<private> extra:u32;','var<private> rc_gp_error:bool;','var<workgroup> rc_gp_error:u32;','var<private> rc_gp_error:u32=1u;'])assert.throws(()=>ref(global+root('return 0u;')),/observed zero-initialized private/);
 const reference=ref('var<private> rc_gp_error:u32;'+root('rc_gp_error+=1u;return rc_gp_error;'));
 assert.equal(reference.execute(args,{bindings:bindings()}).globals.rc_gp_error,1);assert.equal(reference.execute(args,{bindings:bindings()}).globals.rc_gp_error,1);
});
