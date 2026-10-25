import test from 'node:test';import assert from 'node:assert/strict';
import {createWorldQueryOwner,WORLD_QUERY_OWNER} from '../src/resident-candidate/world-query-owner.mjs';
import {compileWorldDevicePc} from '../src/resident-candidate/world-device-pc.mjs';
import {compileWorldDeviceOwners} from '../src/resident-candidate/world-owner-routing.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {packCreatedWorldTemplate} from '../src/resident-candidate/world-state.mjs';
import {generateWorldHPlan} from '../src/resident-candidate/world-h.mjs';
import {DEFAULT_WHOLE_H_RULE} from './resident-candidate-whole-h-fixture.mjs';
function functions(code){const out=new Map();for(const m of code.matchAll(/\bfn\s+(\w+)\s*\(/g)){let open=code.indexOf('{',m.index),end=open+1,depth=1;for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;else if(code[end]==='}')depth--;}assert.equal(depth,0);assert.equal(out.has(m[1]),false,'shared helper deduplicated '+m[1]);out.set(m[1],code.slice(m.index,end));}return out;}
let pending;const fixture=()=>pending??=(async()=>{const{seed}=await originalRegisteredFixture(),template=await packCreatedWorldTemplate(seed,{rule:DEFAULT_WHOLE_H_RULE}),source=generateWorldHPlan(template,{count:2,cueTransport:'flat',coupledTransport:'micro'}),pc=compileWorldDevicePc(source,{programBase:template.program.length,controlTailBase:2*template.state.length+template.fixedCcd.length,maxH:2});return{template,source,pc};})();
test('point/contact/normal custom owners alpha-rename only original phase adapters and preserve every helper',async()=>{
 const{source,pc}=await fixture();
 for(const[family,id]of[['point',10],['contact',11],['normal',12]]){
  const owner=createWorldQueryOwner(pc,source,{family,id}),actual=functions(owner.sourceCode),allowed=new Set(['rc_pc_source_stage',...WORLD_QUERY_OWNER.families[family].adapters]);assert.equal(owner.heavy,true);assert.doesNotMatch(owner.sourceCode,/@compute/);assert.equal(owner.pipelineIds.length,family==='normal'?3:4);
  const entry=actual.get(owner.entry);assert.doesNotMatch(entry,/\bfor\s*\(|\bwhile\s*\(|\bloop\s*\{/);assert.doesNotMatch(entry,/return 0u/,'no artificial WAIT after a complete original source call');
  for(const p of owner.queryAdapter.phaseRenames){
   const original=functions(pc.pipelines[p.pipeline].code),reverse=new Map(Object.entries(p.renames).map(([a,b])=>[b,a]));assert.ok(Object.keys(p.renames).every(x=>allowed.has(x)));
   for(const[from,to]of Object.entries(p.renames)){const restored=actual.get(to).replace(/\b(\w+)(?=\s*\()/g,x=>reverse.get(x)??x);assert.equal(restored,original.get(from),'verbatim original phase closure '+family+'/'+from);}
   for(const[name,body]of original)if(!allowed.has(name)&&actual.has(name))assert.equal(actual.get(name),body,'shared source equation unchanged '+name);
  }
  assert.equal(owner.queryAdapter.capability.nativeQualified,false);assert.equal(owner.queryAdapter.capability.fullRestQualified,false);
 }
});
test('query request switch executes exactly one original phase and source error is CALL completion, not a miss',async()=>{
 const{source,pc}=await fixture();for(const[family,id]of[['point',10],['contact',11],['normal',12]]){
  const owner=createWorldQueryOwner(pc,source,{family,id}),entry=functions(owner.sourceCode).get(owner.entry),js=entry.replace(/fn (\w+)\(([^)]*)\)->u32/g,(_,n,args)=>'function '+n+'('+args.replace(/:u32/g,'')+')').replace(/\b(\d+)u\b/g,'$1').replace(/vec3<u32>/g,'v3').replace(/switch originalPipeline/g,'switch(originalPipeline)'),names=owner.queryAdapter.phaseRenames.map(x=>x.renames.rc_pc_source_stage),program=new Uint32Array(pc.programBase+pc.bytecode.length);program.set(pc.bytecode,pc.programBase);let trace=[],sourceStatus=1;
  const run=new Function('rc_program','v3',...names,js+';return '+owner.entry)(program,(x,y,z)=>({x,y,z}),...names.map((name,i)=>gid=>{sourceStatus=4;trace.push([owner.pipelineIds[i],gid.x]);}));
  for(const pipeline of owner.pipelineIds){const originalPC=Array.from({length:pc.instructions},(_,i)=>i).find(i=>pc.bytecode[i*4]===1&&pc.bytecode[i*4+1]===pipeline);for(const candidate of[0,1]){trace=[];assert.equal(run(candidate*pc.stateWords,candidate*pc.scratchWords,0,originalPC,pipeline),1);assert.deepEqual(trace,[[pipeline,candidate]]);assert.equal(sourceStatus,4,'original source error stores survive CALL completion');}trace=[];assert.equal(run(1,0,0,originalPC,pipeline),2);assert.equal(run(0,pc.scratchWords,0,originalPC,pipeline),2);assert.equal(run(0,0,0,pc.instructions,pipeline),2);assert.equal(run(0,0,0,originalPC,0xffffffff),2);assert.deepEqual(trace,[]);}
 }
});
test('all query families route as explicit owners without dropping EPA, finish or nonquery lifecycle phases',async()=>{
 const{source,pc}=await fixture(),query=['point','contact','normal'].map((family,i)=>createWorldQueryOwner(pc,source,{family,id:100+i})),taken=new Set(query.flatMap(o=>o.pipelineIds)),other=source.pipelines.flatMap((p,i)=>taken.has(i)?[]:[{id:1000+i,name:'unchanged-'+i,pipelineIds:[i],heavy:true}]);
 const routed=compileWorldDeviceOwners(pc,{owners:[...query,...other]});assert.equal(routed.bytecode,pc.bytecode);assert.equal(routed.pipelines.length,pc.pipelines.length-8);assert.equal(routed.phasePipelineCount,pc.pipelines.length);assert.equal(routed.begin,pc.begin);
 for(const owner of query){const pipeline=routed.pipelines.find(p=>p.ownerId===owner.id);assert.equal(pipeline.heavy,true);assert.equal((pipeline.code.match(new RegExp(owner.entry+'\\(bank,scratch,request,originalPC,id\\)','g'))??[]).length,1);}
 const lifecycle=source.pipelines.flatMap((p,i)=>['ball-geometry-advance','cue-geometry-advance','cue-geometry-after-query','cue-geometry-cache'].includes(p.name)?[i]:[]);assert.equal(lifecycle.length,4);for(const id of lifecycle)assert.equal(taken.has(id),false,'source lifecycle remains its own actual phase');
});
test('query owner rejects unknown math conflicts, missing source phases and unqualified chunk transport',async()=>{
 const{source,pc}=await fixture();assert.throws(()=>createWorldQueryOwner(pc,{...source,transport:{...source.transport,query:'chunked'}},{family:'point',id:1}),/staged/);assert.throws(()=>createWorldQueryOwner(pc,source,{family:'unknown',id:1}),/family/);
 const changed={...pc,pipelines:[...pc.pipelines]},id=source.pipelines.findIndex(p=>p.name==='ball-geometry-gjk');assert.ok(changed.pipelines[id].code.includes('fn rc_point_addf('));
 // Explicitly mutate one existing shared source helper, preserving syntax and
 // its name. The linker must reject rather than hide it under a phase suffix.
 const code=pc.pipelines[id].code,func=functions(code).get('rc_point_addf');assert.ok(func);changed.pipelines[id]={...pc.pipelines[id],code:code.replace(func,func.replace('{','{let unexpected_owner_conflict=1u;'))};assert.throws(()=>createWorldQueryOwner(changed,source,{family:'point',id:1}),/Conflicting reachable WGSL function rc_point_addf/);
});
