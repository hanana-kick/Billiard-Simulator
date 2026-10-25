// COORDINATOR-ONLY compile isolation. No variant is ever submitted, and no
// compile-only result is CCD numerical evidence or a runtime fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCcdPrograms,generateCcdWGSL,pruneCcdWGSL} from '../src/resident-candidate/ccd.mjs';
import {generateCcdFlatWGSL} from '../src/resident-candidate/ccd-flat.mjs';
import {generateBvhWGSL} from '../src/resident-candidate/bvh.mjs';
const prefix=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(1) var<storage,read> rc_program:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;\n`;
function replaceFunction(source,name,replacement){const start=source.indexOf('fn '+name+'(');assert.ok(start>=0);const open=source.indexOf('{',start);let d=1,end=open+1;for(;d;end++){if(source[end]==='{')d++;else if(source[end]==='}')d--;}return source.slice(0,start)+replacement+source.slice(end);}
export function ccdFlatCompileDiagnostic(variant){
 const p=createCcdPrograms({pointCounts:[8,22]});let source,entry;
 if(variant==='control'){
  source=generateBvhWGSL()+generateCcdWGSL(p);
  entry=`@compute @workgroup_size(1) fn main(){if(arrayLength(&rc_state)<4u){return;}let b=rc_state[0u];let scratch=rc_state[1u];let program=rc_state[2u];let budget=rc_state[3u];var executed=0u;loop{if(executed>=budget||rc_state[b]!=0u||rc_state[b+14u]==0u){return;}rc_ccd_pre_control(b,scratch,program);executed++;}}`;
 }else if(variant==='transport'||variant==='full'){
  source=generateCcdFlatWGSL(p,{mode:'pre'});
  if(variant==='transport')source=replaceFunction(source,'rc_ccd_flat_control',`fn rc_ccd_flat_control(b:u32,control:u32,scratch:u32,programBase:u32)->u32{rc_state[control+10u]++;rc_state[control+11u]=0u;return 0u;}`);
  entry=`@compute @workgroup_size(1) fn main(){if(arrayLength(&rc_state)<5u){return;}let b=rc_state[0u];let control=rc_state[1u];let scratch=rc_state[2u];let program=rc_state[3u];let budget=rc_state[4u];rc_ccd_flat_advance(b,control,scratch,program,budget);}`;
 }else throw new RangeError('Explicit CCD compile isolation variant required');
 return {code:pruneCcdWGSL(prefix+source+entry),programs:p};
}

test('compile probes isolate remaining original control backedges without executing a replacement controller',()=>{
 const control=ccdFlatCompileDiagnostic('control').code,transport=ccdFlatCompileDiagnostic('transport').code,full=ccdFlatCompileDiagnostic('full').code;
 assert.match(control,/fn rc_ccd_pre_control\(/);assert.match(control,/fn rc_ccd_gjk_resume\(/);assert.doesNotMatch(control,/fn rc_num_cont_instruction\(|fn rc_num_eval\(|fn rc_ccd_eval\(/);
 assert.match(transport,/fn rc_num_cont_instruction\(/);assert.match(transport,/fn rc_ccd_flat_gather_one\(/);assert.match(transport,/fn rc_ccd_flat_publish_one\(/);assert.doesNotMatch(transport,/fn rc_ccd_pre_control\(|fn rc_ccd_gjk_resume\(/);
 assert.match(full,/fn rc_num_cont_instruction\(/);assert.match(full,/fn rc_ccd_pre_control\(/);assert.doesNotMatch(full,/fn rc_num_eval\(|fn rc_ccd_eval\(/);
});

test('actual native CCD flat compile-only isolation, never a numerical gate',{
 skip:process.env.RUN_RESIDENT_CCD_FLAT_COMPILE!=='1',timeout:240000
},async t=>{
 const variant=process.env.RESIDENT_CCD_COMPILE_VARIANT??'control',probe=ccdFlatCompileDiagnostic(variant);
 const {createNativeOwner}=await import('./resident-candidate-gpu-support.mjs'),owner=await createNativeOwner('ccd-flat-compile-'+variant);
 try{
  const device=owner.device;console.log(JSON.stringify({stage:'compile-start',variant,bytes:probe.code.length,sourcePointCounts:probe.programs.pointCounts,submission:false}));
  const module=device.createShaderModule({code:probe.code,label:'CCD compile-only '+variant}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(m=>m.type==='error'),[]);
  const group=device.createBindGroupLayout({entries:['storage','read-only-storage','storage'].map((type,binding)=>({binding,visibility:4,buffer:{type}}))});
  console.log(JSON.stringify({stage:'pipeline-start',variant,submission:false}));await device.createComputePipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[group]}),compute:{module,entryPoint:'main'}});
  console.log(JSON.stringify({stage:'pipeline-ready',variant,submission:false}));t.diagnostic(JSON.stringify({scope:'compile-only-no-CCD-physics-evidence',variant,submitted:false,adapter:owner.adapterInfo}));
 }finally{owner.release();}
});
