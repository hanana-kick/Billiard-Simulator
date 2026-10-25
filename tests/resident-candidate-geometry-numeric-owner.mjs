// Host differential of real generated source prefixes/suffixes. The reference
// executes untouched source graph plans; the request path executes their actual
// lowered programs. This is not GPU or full-world qualification.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {DEFAULT_WHOLE_H_RULE} from './resident-candidate-whole-h-fixture.mjs';
import {packCreatedWorldTemplate} from '../src/resident-candidate/world-state.mjs';
import {generateGeometryNumericOwnerWGSL,geometryNumericSourceSeamsForTest,GEOMETRY_NUMERIC_REQUEST as R} from '../src/resident-candidate/geometry-numeric-owner.mjs';
import {generateNumericRequestWGSL} from '../src/resident-candidate/numeric-request.mjs';
import {generateNarrowphaseWGSL,packFloorNarrow} from '../src/resident-candidate/narrowphase.mjs';
import {generateWorldGeometryWGSL} from '../src/resident-candidate/world-geometry.mjs';
import {generateWorldCueGeometryWGSL} from '../src/resident-candidate/world-cue-geometry.mjs';
import {generateEmptyCueCacheWGSL,initializeEmptyCueCache} from '../src/resident-candidate/cue-empty-caches.mjs';
import {executeLowered} from '../src/resident-candidate/numeric-program.mjs';
import {NUMERIC_PROFILE as P} from '../src/resident-candidate/numeric-profile.mjs';
import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';
import Graph from '../src/experimental-arithmetic-graph.js';
import Guard from '../src/experimental-cue-rigid-exclusion.js';
import EmptyPair from '../src/experimental-cue-empty-pair-cache.js';
import EmptyConvex from '../src/experimental-cue-empty-convex-cache.js';
import Point from '../src/experimental-convex-point.js';

const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0],number=x=>new Float32Array(Uint32Array.of(x).buffer)[0];
const words=a=>new Uint32Array(a.buffer,a.byteOffset,a.length).slice(),f=Math.fround;
let pending;const fixture=()=>pending??=(async()=>{
 const{seed}=await originalRegisteredFixture(),t=await packCreatedWorldTemplate(seed,{rule:DEFAULT_WHOLE_H_RULE}),known=new Map();
 for(const e of Object.values(t.bundles.narrow.entries))known.set(t.programOffsets.narrow+e.base,{compiled:e.compiled,plan:e.plan});
 const cg=t.bundles.cueGeometry,p=t.programOffsets.cueGeometry;known.set(p+cg.words[1],{compiled:cg.pose,plan:Guard.buildPlan()});known.set(p+cg.words[2],{compiled:cg.cache.pair,plan:EmptyPair.buildPlan()});known.set(p+cg.words[3],{compiled:cg.cache.convex,plan:EmptyConvex.buildPlan()});
 const requestTailBase=2*t.state.length+t.fixedCcd.length+160,options={includeNumericLibrary:false,requestTailBase,candidateCount:2};
 return{seed,t,known,requestTailBase,options,requestCode:generateGeometryNumericOwnerWGSL(t,options),originalCode:generateNarrowphaseWGSL(t.bundles.narrow)+'\n'+generateEmptyCueCacheWGSL()+'\n'+generateWorldCueGeometryWGSL()+'\n'+generateWorldGeometryWGSL(t,'control')};
})();
function dialect(source){const edits=[];for(const m of source.matchAll(/(?:case [^:]+|default):\s*\{/g)){let depth=1,end=m.index+m[0].length;for(;depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}edits.push(end);}for(const at of edits.reverse())source=source.slice(0,at)+'break;'+source.slice(at);return source.replace(/switch (\w+)\s*\{/g,'switch($1){').replace(/fn (\w+)\(([^)]*)\)(?:\s*->\s*(?:u32|bool))?\s*\{/g,(_,name,args)=>`function ${name}(${args.replace(/:(?:u32|bool)/g,'')}){`)
 .replace(/:(?:u32|bool)(?=\s*=)/g,'').replace(/\b(0x[\da-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/arrayLength\(&([a-z_]+)\)/g,'$1.length')
 .replaceAll('bitcast<f32>','number').replaceAll('bitcast<u32>','bits').replace(/case (\d+):/g,'case $1:');}
function kernels(a,state,scratch,{request=false,failNumeric=0}={}){
 let calls=0;const evalGraph=(pb,sb)=>{calls++;if(failNumeric)return failNumeric;const e=a.known.get(pb);assert.ok(e,'exact registered original program '+pb);const input=new Float32Array(scratch.buffer,sb*4,e.compiled.inputCount).slice();let out;try{out=request?executeLowered(e.compiled,input,{testOnly:true}):Graph.execute(input,e.plan);}catch(error){return error.numericStatus??3;}const raw=words(out);e.compiled.outputSlots.forEach((slot,i)=>scratch[sb+slot]=raw[i]);return 1;};
 const source=request?a.requestCode:a.originalCode,names=[...source.matchAll(/fn (\w+)\(/g)].map(m=>m[1]);
 const api=new Function('rc_state','rc_scratch','rc_program','rc_geometry','rc_num_eval','select','u32','f32','bits','number','min',dialect(source)+';return {'+names.join(',')+'};')(state,scratch,a.t.program,a.t.sharedGeometry,evalGraph,(x,y,b)=>b?y:x,x=>x>>>0,Math.fround,bits,number,Math.min);
 return{...api,calls:()=>calls};
}
function bank(a,lane=0){const state=new Uint32Array(a.requestTailBase+48+8).fill(0x12345678),n=a.t.state.length;state.fill(0,a.requestTailBase,a.requestTailBase+48);for(let i=0;i<2;i++){state.set(a.t.state,i*n);for(const offset of a.t.relocations)state[i*n+offset]+=i*n;state[i*n+2]=1;state[i*n+5]=7;state[i*n+a.t.segments.worldH.offset+2]=2;}return{state,base:lane*n,scratchBase:lane*a.t.numericScratchWords,request:a.requestTailBase+lane*24};}
function selectRow(a,b,row,{present=1,visited=1,projection=true}={}){const at=a.t.geometryOffsets.catalog+row*16,cache=b.base+a.t.segments.caches.offset+a.t.sharedGeometry[at+7];b.state.set([0,row,cache,present,visited,+projection,0,1],b.base+24);return cache;}
function original(a,k,b,kind){const s=b.state,base=b.base,cache=s[base+26],p=a.t.programOffsets.narrow,scratch=b.scratchBase,g=base+a.t.segments.cueGeometry.offset;let result=0;
 if(kind===1)result=k.rc_narrow_floor(cache,scratch,p,s[base+27],s[base+28]);else if(kind===2)result=k.rc_narrow_pair(cache,scratch,p,s[base+27],s[base+28]);else if(kind===3)result=k.rc_narrow_convex_prepare(cache,scratch,p,s[base+27],s[base+28]);else if(kind===4)result=k.rc_narrow_convex_finish(cache,scratch,p,base+a.t.segments.projectionOutput.offset);else if(kind===5)k.rc_world_cue_geometry_pose(g,a.t.programOffsets.cueGeometry,scratch);else k.rc_world_cue_geometry_cache(g,a.t.programOffsets.cueGeometry,scratch);
 if(kind===3){if(result===2)k.rc_world_geometry_fail(base,2);else s[base+29]=result;}else if(kind<=4&&result)k.rc_world_geometry_fail(base,2);return result;
}
function differential(a,b,kind,{split=false,failNumeric=0}={}){
 const expected=b.state.slice(),actual=b.state.slice(),se=new Uint32Array(a.t.numericScratchWords*2),sa=se.slice(),ref=kernels(a,expected,se,{failNumeric}),got=kernels(a,actual,sa,{request:true,failNumeric}),eb={...b,state:expected},ab={...b,state:actual},want=original(a,ref,eb,kind);let result;
 if(split){got.rc_geometry_numeric_prepare(b.base,b.scratchBase,b.request,11,29,kind);const prepared=actual.slice();got.rc_geometry_numeric_prepare(b.base,b.scratchBase,b.request,11,29,kind);if(prepared[b.request+3]===1)assert.deepEqual(actual,prepared,'prepared request is resumed without repeating original prefix');got.rc_geometry_numeric_evaluate(b.base,b.scratchBase,b.request,11,29);const evaluated=actual.slice();got.rc_geometry_numeric_evaluate(b.base,b.scratchBase,b.request,11,29);assert.deepEqual(actual,evaluated,'evaluator completion is idempotent');result=got.rc_geometry_numeric_finish(b.base,b.scratchBase,b.request,11,29);}
 else result=got.rc_geometry_numeric_run(b.base,b.scratchBase,b.request,11,29,kind);
 assert.equal(result,want,'kind'+kind+' exact source result (not transport status)');assert.equal(actual[b.request+3],3);assert.equal(actual[b.request+19],want);assert.equal(got.calls(),ref.calls(),'same source evaluation count');
 assert.deepEqual(actual.subarray(0,a.requestTailBase),expected.subarray(0,a.requestTailBase),'kind'+kind+' all original state words');assert.deepEqual(sa,se,'kind'+kind+' exact numerical scratch outputs');
 const ended=actual.slice();assert.equal(got.rc_geometry_numeric_finish(b.base,b.scratchBase,b.request,11,29),want);assert.deepEqual(actual,ended,'suffix cannot run twice');assert.deepEqual(actual.slice(a.requestTailBase+48),expected.slice(a.requestTailBase+48),'tail guards');
 return{state:actual,scratch:sa,calls:got.calls(),result};
}

test('six extracted graph boundaries keep original source text and one shared evaluator outside new loops',async()=>{
 const a=await fixture(),seams=geometryNumericSourceSeamsForTest(a.t,{testOnly:true});assert.equal(seams.length,6);assert.deepEqual(seams.map(x=>x.name),['rc_narrow_floor','rc_narrow_pair','rc_narrow_convex_prepare','rc_narrow_convex_finish','rc_world_cue_geometry_pose','rc_empty_cache_numeric']);
 for(const s of seams){assert.ok(a.requestCode.includes(s.prefix));assert.ok(a.requestCode.includes(s.suffix));assert.ok(a.requestCode.includes(s.failure));}
 assert.equal([...a.requestCode.matchAll(/rc_num_eval\(/g)].length,1);assert.match(a.requestCode,/rc_state\[request\+16u\]=oldPair;rc_state\[request\+17u\]=oldPoint/);assert.match(a.requestCode,/let oldPair=rc_state\[request\+16u\]!=0u/);
 const main='@compute @workgroup_size(1) fn main(){rc_geometry_numeric_run(0u,0u,999999u,11u,29u,1u);}';for(const numericProfile of Object.values(P)){const code=generateGeometryNumericOwnerWGSL(a.t,{...a.options,numericProfile,includeNumericLibrary:true});const linked=linkResidentWGSL([code,main]);assert.match(linked.code,/fn rc_num_eval\(/);assert.doesNotMatch(linked.code,/undefinedu|NaNu/);}
 assert.equal(R.words,24);assert.equal(R.capability.nativeQualified,false);assert.throws(()=>geometryNumericSourceSeamsForTest(a.t),/test-only/);assert.throws(()=>generateNumericRequestWGSL(a.t,{requestTailBase:0,candidateCount:2}),/Disjoint/);
});

test('floor/pair/recycle source prefixes, live old flags, birth/reuse/removal and both candidate lanes remain exact',async()=>{
 const a=await fixture();let evaluations=0,cases=0;
 for(const [row,kind]of[[0,1],[1,1],[4,2],[7,2],[10,3],[25,3]])for(const present of[0,1])for(const visited of[0,1])for(const prior of[0,1]){
  const b=bank(a,cases%2),cache=selectRow(a,b,row,{present,visited});
  if(kind===1){b.state[cache+128]=prior;b.state[cache+129]=prior;b.state[cache+130]=prior;b.state[cache+131]=prior;b.state[cache+132]=prior;}
  if(kind===2){b.state[cache+203]=bits(prior);b.state[cache+201]=bits(prior);b.state[cache+202]=bits(prior);b.state[cache+200]=bits(prior);b.state[cache+70]=bits(number(b.state[cache+6])+.04);b.state[cache+71]=b.state[cache+7];b.state[cache+72]=b.state[cache+8];}
  if(kind===3){b.state[cache+390]=prior;b.state[cache+317]=bits(prior);b.state[cache+316]=bits(prior);}
  const out=differential(a,b,kind,{split:cases%2===0});evaluations+=out.calls;cases++;
 }
 const text=readFileSync(new URL('./floor-cache-lifecycle.cjs',import.meta.url),'utf8'),body=text.slice(text.indexOf('function synthetic(){'),text.indexOf('\nasync function prepare(')),synthetic=new Function('f','zero','identity',body+';return synthetic;')(f,()=>[0,0,0],()=>[0,0,0,1]);
 for(const y of[.5,.501,.525,.625,2])for(const prior of[0,1]){const s=synthetic();s.translation[1]=f(y);if(prior)Object.assign(s.topology,{pairPresent:true,manifoldPresent:true,pointPresent:true,active:true,recycleValid:true});const b=bank(a),cache=selectRow(a,b,0);b.state.set(packFloorNarrow(s),cache);evaluations+=differential(a,b,1,{split:true}).calls;cases++;}
 assert.equal(cases,58);assert.ok(evaluations>=20,'original graph paths actually executed, not only guards');
});

test('convex finish consumes genuine original point projection, retains feature IDs and exact failure stores',async()=>{
 const a=await fixture();let cases=0;
 for(const row of[10,13,18,25]){const b=bank(a,cases%2),cache=selectRow(a,b,row),ball=Math.floor((row-10)/4),hull=a.seed.cushionSeeds[ball].cushions[(row-10)%4].hull,point=Array.from(b.state.slice(cache+6,cache+9),number),projection=Point.diagnoseReference({hull,point}).output;b.state.set(words(projection),b.base+a.t.segments.projectionOutput.offset);b.state[cache+387]=0;b.state[cache+392]=1;differential(a,b,4,{split:true});cases++;
  const invalid={...b,state:b.state.slice()};invalid.state[b.base+a.t.segments.projectionOutput.offset]=0;assert.equal(differential(a,invalid,4).result,3);cases++;
 }
 const b=bank(a),cache=selectRow(a,b,10);b.state[cache+392]=1;b.state[b.base+a.t.segments.projectionOutput.offset]=bits(1);assert.equal(differential(a,b,4,{failNumeric:3}).result,1);assert.equal(cases,8);
});

test('cue pose original132-input guard and both empty-cache source programs preserve complete caller suffixes',async()=>{
 const a=await fixture();let pose=0,empty=0;
 for(const row of[0,3,10,20,40,55]){const b=bank(a,row%2),g=b.base+a.t.segments.cueGeometry.offset,k=kernels(a,b.state,new Uint32Array(a.t.numericScratchWords*2));b.state[b.base+a.t.segments.journal.offset+1]=2;k.rc_world_cue_geometry_begin(g,b.base+a.t.segments.journal.offset);b.state[g+2]=row;k.rc_world_cue_geometry_gather(g,b.base+a.t.segments.journal.offset,b.base+a.t.segments.bodies.offset);pose+=differential(a,b,5,{split:true}).calls;}
 const hull=a.seed.cushionSeeds[0].cushions[0].hull;
 for(const convex of[false,true])for(const prior of[false,true])for(const lane of[0,1]){
  const b=bank(a,lane),g=b.base+a.t.segments.cueGeometry.offset,c=g+32,input={kind:convex?'separated-convex-cylinder-empty-cache':'separated-sphere-cylinder-empty-cache',separated:true,shapesChanged:false,[convex?'convex':'sphere']:{...(convex?{}:{radius:f(.03075)}),translation:[0,0,0],rotation:[0,0,0,1],localTranslation:[0,0,0]},cylinder:{radius:f(.0058),halfHeight:f(.06),translation:[0,2,0],rotation:[0,0,0,1],localTranslation:[0,f(-.066),0]},contactRecycleDistance:f(.003075),predictionDistance:f(.0000615),previous:null};
  const source=convex?EmptyConvex:EmptyPair,binding=convex?source.hullBinding({hull}):undefined;if(prior){const stage=convex?source.createReferenceStage({hull}):source.createReferenceStage();try{input.previous=stage.step(input);}finally{stage.dispose();}input.cylinder.translation[0]=f(.00001);}
  b.state.set(initializeEmptyCueCache({kind:convex?'convex-cylinder':'sphere-cylinder',pairId:0,sphereRadius:f(.03075),cylinderRadius:input.cylinder.radius,cylinderHalfHeight:input.cylinder.halfHeight}),c);b.state[c+2]=2;b.state[c+3]=+prior;b.state[g]=0;b.state[g+2]=0;b.state[g+6]=c;b.state[g+7]=convex?2:1;b.state[g+11]=1;b.state.set(words(source.pack(input,binding)),g+3202);
  empty+=differential(a,b,6,{split:true}).calls;
  differential(a,b,6,{failNumeric:4});
 }
 assert.ok(pose>=4);assert.equal(empty,8);
});

test('pending requests fail stale PC/h/pass/profile/program and cross-candidate addresses closed without source publication',async()=>{
 const a=await fixture();for(const field of[4,5,6,7,9,10,11,22,23]){const b=bank(a),cache=selectRow(a,b,0);b.state[cache+128]=0;const scratch=new Uint32Array(a.t.numericScratchWords*2),k=kernels(a,b.state,scratch,{request:true});k.rc_geometry_numeric_prepare(b.base,b.scratchBase,b.request,11,29,1);assert.equal(b.state[b.request+3],1);const before=b.state.slice();b.state[b.request+field]++;assert.equal(k.rc_geometry_numeric_evaluate(b.base,b.scratchBase,b.request,11,29),0xffffffff);assert.equal(k.calls(),0);assert.equal(b.state[b.request+3],4);assert.equal(b.state[b.base+2],4);assert.deepEqual(b.state.slice(cache,cache+144),before.slice(cache,cache+144));}
 const b=bank(a),scratch=new Uint32Array(a.t.numericScratchWords*2),k=kernels(a,b.state,scratch,{request:true}),other=a.requestTailBase+24;b.state.fill(0xabcdef12,other,other+24);const guard=b.state.slice(other,other+24);assert.equal(k.rc_geometry_numeric_run(0,0,other,11,29,1),0xffffffff);assert.deepEqual(b.state.slice(other,other+24),guard);assert.equal(k.calls(),0);
});

test('router WAIT/completion is independent from source result and preserves early and numeric-error returns',async()=>{
 const a=await fixture();
 for(const [kind,row,entry,errorResult]of[[1,0,'floor',1],[2,4,'pair',1],[3,10,'convex_prepare',2]])for(const failNumeric of[0,3]){
  const b=bank(a),cache=selectRow(a,b,row);if(kind===1)b.state[cache+128]=0;if(kind===2)b.state[cache+203]=0;if(kind===3)b.state[cache+390]=0;
  const scratch=new Uint32Array(a.t.numericScratchWords*2),k=kernels(a,b.state,scratch,{request:true,failNumeric}),run=k['rc_geometry_'+entry+'_entry'];
  assert.equal(run(b.base,b.scratchBase,b.request,11,29),0,'source graph is pending; original CALL has not completed');assert.equal(b.state[b.request+3],1);assert.equal(k.calls(),0);
  const before=b.state.slice();assert.equal(run(b.base,b.scratchBase,b.request,11,29),0);assert.deepEqual(b.state,before,'router WAIT resumes the same prefix');
  k.rc_numeric_request_evaluate(b.base,b.scratchBase,b.request,11,29);assert.equal(k.calls(),1);assert.equal(run(b.base,b.scratchBase,b.request,11,29),1,'original source error return also completes its CALL, never transport INVALID');assert.equal(b.state[b.request+3],3);
  if(failNumeric){assert.equal(b.state[b.request+19],errorResult);assert.equal(b.state[b.base+24],2);}else if(kind===3)assert.equal(b.state[b.request+19],1,'projection-needed source result1 is not router WAIT');
 }
 for(const kind of[1,2,3]){const b=bank(a);selectRow(a,b,kind===1?0:kind===2?4:10,{present:0});const k=kernels(a,b.state,new Uint32Array(a.t.numericScratchWords*2),{request:true});assert.equal(k.rc_geometry_numeric_entry(0,0,b.request,11,29,kind),1,'original pair-absent early return completes immediately');assert.equal(k.calls(),0);}
 const b=bank(a);selectRow(a,b,0);const k=kernels(a,b.state,new Uint32Array(a.t.numericScratchWords*2),{request:true});assert.equal(k.rc_geometry_floor_entry(0,0,b.request,11,29),0);assert.equal(k.rc_geometry_pair_entry(0,0,b.request,11,29),2,'changed request owner while pending is transport INVALID');
});
