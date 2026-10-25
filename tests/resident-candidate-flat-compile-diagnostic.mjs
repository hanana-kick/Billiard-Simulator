// Compiler isolation ONLY. No queue submission or numerical acceptance.
// Every case is compiled against the real coupled bundle/4-body27-contact ABI;
// the existing seven-fixture gate remains the sole numerical completion gate.
import{test}from'node:test';import assert from'node:assert/strict';
import{generateNumericContinuationWGSL}from'../src/resident-candidate/numeric-continuation.mjs';
import{generateCoupledStagedWGSL,createCoupledProgramBundle,packCoupledInitialState}from'../src/resident-candidate/coupled-solver.mjs';
import{generateCoupledFlatWGSL}from'../src/resident-candidate/coupled-flat.mjs';
import{NUMERIC_PROFILE as P}from'../src/resident-candidate/numeric-profile.mjs';
import{linkResidentWGSL}from'../src/resident-candidate/wgsl-linker.mjs';
import{largestFixture}from'./resident-candidate-coupled-flat-fixtures.mjs';
import Source from'../src/experimental-coupled-contact-math.js';
const variants=['numeric','numeric-init-loop','gather-scatter','numeric-gather','full'];
const prefix=`@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> rc_jobs:array<u32>;
@group(0) @binding(4) var<storage,read_write> rc_results:array<u32>;
`;
function source(variant,numericProfile=P.PRESERVED_F32){
 assert.ok(variants.includes(variant));let lib='';
 if(variant==='full')lib=generateCoupledFlatWGSL({numericProfile});
 else{
  if(variant!=='gather-scatter')lib+=generateNumericContinuationWGSL({numericProfile});
  if(variant==='gather-scatter'||variant==='numeric-gather'){
   let gather=generateCoupledStagedWGSL('gather');const old='  for(var i=0u;i<352u;i++) { rc_scratch[scratch+i]=0u; }';assert.ok(gather.includes(old));gather=gather.replace(old,'  let inputWords=rc_program[np+3u];if(inputWords!=352u){return 2u;}\n  for(var i=0u;i<inputWords;i++) { rc_scratch[scratch+i]=0u; }');lib+=gather+generateCoupledStagedWGSL('scatter');
  }
 }
 const setup='let row=id.x;if(row>=arrayLength(&rc_jobs)/6u){return;}let j=row*6u;let commonBase=rc_jobs[j];let coefficient=rc_jobs[j+1u];let roster=rc_jobs[j+2u];let scratch=rc_jobs[j+3u];let budget=rc_jobs[j+4u];let np=rc_jobs[j+5u];let control=commonBase+28u;';
 let body;
 if(variant==='full')body='rc_results[row]=rc_coupled_flat_advance(commonBase,coefficient,roster,0u,scratch,budget);';
 else if(variant==='numeric')body='if(rc_state[control]==0u){let start=rc_num_cont_begin(np,scratch,control);if(start!=0u){rc_results[row]=start;return;}}for(var i=0u;i<budget;i++){let status=rc_num_cont_instruction(control);if(status!=0u){rc_results[row]=status;return;}}';
 else if(variant==='numeric-init-loop')body='for(var i=0u;i<budget;i++){if(rc_state[control]==0u){let start=rc_num_cont_begin(np,scratch,control);if(start!=0u){rc_results[row]=start;return;}}let status=rc_num_cont_instruction(control);if(status>1u){rc_results[row]=status;return;}if(status==1u){rc_state[control]=0u;}}';
 else if(variant==='gather-scatter')body='for(var i=0u;i<budget;i++){let gathered=rc_coupled_gather(commonBase,coefficient,roster,0u,scratch);if(gathered!=0u){rc_results[row]=gathered;return;}rc_state[commonBase+27u]=2u;let scattered=rc_coupled_scatter(commonBase,roster,scratch);if(scattered!=0u){rc_results[row]=scattered;return;}}';
 else body='for(var i=0u;i<budget;i++){if(rc_state[commonBase+27u]==0u){let gathered=rc_coupled_gather(commonBase,coefficient,roster,0u,scratch);if(gathered!=0u){rc_results[row]=gathered;return;}let start=rc_num_cont_begin(rc_state[commonBase+19u],scratch,control);if(start!=0u){rc_results[row]=start;return;}}let status=rc_num_cont_instruction(control);if(status>1u){rc_results[row]=status;return;}if(status==1u){rc_state[commonBase+27u]=0u;}}';
 return linkResidentWGSL([prefix,lib,`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){${setup}${body}}`]).code;
}
test('flat compiler diagnostic separates exact numeric continuation and source gather/scatter call trees',()=>{
 for(const variant of variants){const code=source(variant);assert.match(code,/@workgroup_size\(1\)/);assert.match(code,/let budget=rc_jobs/);assert.doesNotMatch(code,/fn rc_num_eval\(/);if(variant!=='gather-scatter')assert.match(code,/rc_num_cont_instruction/);if(!variant.startsWith('numeric')||variant==='numeric-gather')assert.match(code,/rc_coupled_gather/);}
});
test('actual native compile-only flat component diagnostic', {skip:process.env.REQUIRE_WEBGPU!=='1'},async t=>{
 const variant=process.env.RESIDENT_FLAT_COMPILE_CASE;assert.ok(variants.includes(variant),'Choose one independent case: '+variants.join(','));const profile=process.env.RESIDENT_NUMERIC_PROFILE??P.PRESERVED_F32;
 const bundle=createCoupledProgramBundle(),fx=largestFixture(),plan=Source.buildPlan(fx.spec),packed=packCoupledInitialState(fx.spec,Source.pack(fx.input,plan));assert.equal(fx.spec.bodyCount,4);assert.equal(fx.spec.contacts.length,27);assert.equal(fx.spec.substeps,12);assert.equal(fx.spec.pgsIterations,4);assert.equal(fx.spec.stabilizationIterations,1);
 const code=source(variant,profile),{createNativeOwner}=await import('./resident-candidate-gpu-support.mjs'),owner=await createNativeOwner('flat-compile-'+variant);
 try{console.log(JSON.stringify({stage:'compile-start',variant,profile,bytes:code.length,programs:bundle.entries.length,fixtureWords:packed.state.length,submission:false}));const shader=owner.device.createShaderModule({code,label:'flat-compile-'+variant}),info=await shader.getCompilationInfo();assert.deepEqual(info.messages.filter(x=>x.type==='error').map(x=>`${x.lineNum}:${x.linePos} ${x.message}`),[]);console.log(JSON.stringify({stage:'pipeline-start',variant}));await owner.device.createComputePipelineAsync({layout:'auto',compute:{module:shader,entryPoint:'main'}});console.log(JSON.stringify({stage:'pipeline-ready',variant,submission:false}));t.diagnostic(JSON.stringify({scope:'compile-only-not-physics-acceptance',variant,profile,adapterInfo:owner.adapterInfo}));}finally{owner.release();}
});
