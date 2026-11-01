/* SPDX-License-Identifier: Apache-2.0
 * Opt-in seams for existing broad/scene/cloth/CCD graph callers. The source
 * programs, source control, gather/scatter order and numerical profile do not
 * change. prepare/finish NEVER call a numerical evaluator: numeric-request's
 * single common worker runs between them, outside the owner/router loop.
 */
import {generateCcdWGSL} from './ccd.mjs';
import {generateCueInactiveCcdWGSL} from './cue-bridge.mjs';
import {generateWorldCcdWGSL} from './world-ccd.mjs';
import {NUMERIC_PROFILE,numericProfileCode} from './numeric-profile.mjs';

export const REMAINING_NUMERIC_OWNER=Object.freeze({
 kind:Object.freeze({broad:16,scene:17,cloth:18,activeCcd:19,inactiveCcd:20,cueBodyCcd:21}),
 requestWords:24,capability:Object.freeze({optIn:true,defaultBackend:false,sourceCapsUnchanged:true,
 sourceProgramDataUnchanged:true,hostForwardFallback:false,nativeQualified:false,fullWorldQualified:false})
});
function sourceFunction(source,name){const at=source.indexOf('fn '+name+'(');if(at<0)throw Error('Missing original source function '+name);const open=source.indexOf('{',at);let end=open+1,depth=1;for(;depth&&end<source.length;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}if(depth)throw Error('Unclosed original function '+name);return{code:source.slice(at,end),body:source.slice(open+1,end-1),signature:source.slice(at,open)};}
function split(source,name,needle){const f=sourceFunction(source,name),at=f.body.indexOf(needle);if(at<0||f.body.indexOf(needle,at+1)>=0)throw Error('Original unique evaluator seam changed: '+name);return{...f,name,prefix:f.body.slice(0,at),suffix:f.body.slice(at+needle.length)};}
function parts(t){
 const ccd=generateCcdWGSL(t.bundles.ccd),cue=generateCueInactiveCcdWGSL({includeNumericLibrary:false,includeBridge:false});
 const evalSeam=split(ccd,'rc_ccd_eval','if(rc_num_eval(program,scratch)!=1u)'),cueSeam=split(cue,'rc_cue_inactive_ccd','let status=rc_num_eval(np,scratch);');
 const ccdPrefix=evalSeam.prefix,ccdSuffix=evalSeam.suffix;
 const world=generateWorldCcdWGSL(t,t.bundles.ccd);
 return {ccd,world,evalSeam,cueSeam,support:['rc_ccd_fail','rc_ccd_sweep_numeric_request','rc_ccd_body_numeric_request','rc_ccd_pre_numeric_request'].map(n=>sourceFunction(ccd,n).code).join('\n'),
 lowered:`
fn rc_rn_ccd_prepare(b:u32,input:u32,which:u32,scratch:u32,programBase:u32,request:u32)->bool{
 ${ccdPrefix}rc_state[request+12u]=input;rc_state[request+13u]=which;rc_state[request+20u]=b+704u;rc_gn_mark(request,program,scratch);return true;
}
fn rc_rn_ccd_finish(b:u32,scratch:u32,request:u32)->bool{
 let program=rc_state[request+9u];let outputs=rc_state[request+21u];if(rc_state[request+18u]!=1u)${ccdSuffix}
}
fn rc_rn_cue_prepare(cue:u32,bodies:u32,saved:u32,np:u32,scratch:u32,role:u32,post:bool,request:u32)->u32{
 ${cueSeam.prefix}rc_gn_mark(request,np,scratch);return 0u;
}
fn rc_rn_cue_finish(cue:u32,np:u32,scratch:u32,post:bool,request:u32)->u32{
 let status=rc_state[request+18u];${cueSeam.suffix}
}
${sourceFunction(generateCueInactiveCcdWGSL({includeNumericLibrary:false}),'rc_cue_bridge_fail').code}
`};
}
function validate(t){if(t?.kind!=='resident-created-world-layout'||!Number.isInteger(t.state?.length)||!t.bundles?.ccd||!t.bundles?.cueCcd)throw TypeError('Exact created world template required');for(const n of['broad','scene','sceneWorld','cueCloth','ccd','cue','bodies','cuePreSolve','worldH'])if(!Number.isInteger(t.segments?.[n]?.offset))throw TypeError('Missing source owner segment '+n);for(const n of['broad','scene','cueCloth','ccd','cueCcd'])if(!Number.isInteger(t.programOffsets?.[n]))throw TypeError('Missing source owner program '+n);}
/** Include alongside numeric-request.mjs. Caller provides rc_gn_* common
 * helpers and the common worker validator dispatch. No library/eval is emitted.
 * Request kinds16..21 are disjoint from geometry1..6. */
export function generateRemainingNumericOwnerWGSL(t,{numericProfile=NUMERIC_PROFILE.PRESERVED_F32}={}){
 validate(t);const z=parts(t),o=Object.fromEntries(Object.entries(t.segments).map(([k,v])=>[k,v.offset])),p=t.programOffsets,profile=numericProfileCode(numericProfile),entries=t.bundles.ccd.entries;
 const ccdPrograms=Object.values(entries).map(e=>`case ${e.id}u:{return ${p.ccd+e.base}u;}`).join('');
 const cuePrograms=[p.cueCcd+t.bundles.cueCcd.pre.base,p.cueCcd+t.bundles.cueCcd.post.base];
 return `${z.support}\n${z.lowered}
fn rc_rn_ccd_program(which:u32)->u32{switch which{${ccdPrograms}default:{return 0xffffffffu;}}}
fn rc_rn_world_fail(bank:u32,detail:u32){if(rc_state[bank+2u]==1u){rc_state[bank+2u]=4u;rc_state[bank+3u]=6u;rc_state[bank+${o.worldH+3}u]=detail;}}
fn rc_rn_scene_result(scene:u32,bridge:u32,status:u32){rc_state[bridge+15u]=status;rc_state[bridge+16u]=rc_state[bridge+16u]+1u;if(status!=1u){rc_state[bridge+1u]=4u;rc_state[scene+1u]=4u;rc_state[scene+2u]=5u;}}
fn rc_rn_source_result(bank:u32,request:u32,result:u32)->u32{
 rc_state[request+19u]=result;if(rc_state[request+2u]==21u&&result!=1u){rc_rn_world_fail(bank,select(4u,12u,rc_state[request+13u]!=0u));}return result;
}
fn rc_remaining_numeric_prepare(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32,kind:u32,role:u32,post:bool)->u32{
 if(!rc_gn_address(bank,scratch,request)||kind<16u||kind>21u||(kind==21u&&role>1u)){return rc_gn_fail(bank,request);}
 if(rc_state[request]==0x5243474eu&&(rc_state[request+3u]==1u||rc_state[request+3u]==2u)){
  if(!rc_gn_identity(bank,scratch,request,originalPC,originalPipeline)||rc_state[request+2u]!=kind||(kind==21u&&(rc_state[request+12u]!=role||rc_state[request+13u]!=u32(post)))){return rc_gn_fail(bank,request);}return rc_state[request+19u];
 }
 if(rc_state[request]==0x5243474eu&&rc_state[request+3u]==4u){return rc_gn_fail(bank,request);}
 for(var i=0u;i<24u;i++){rc_state[request+i]=0u;}
 rc_state[request]=0x5243474eu;rc_state[request+1u]=1u;rc_state[request+2u]=kind;rc_state[request+3u]=3u;rc_state[request+4u]=originalPC;rc_state[request+5u]=originalPipeline;rc_state[request+6u]=rc_state[bank+5u];rc_state[request+7u]=rc_state[bank+${o.worldH+2}u];rc_state[request+10u]=scratch;rc_state[request+23u]=${profile}u;
 var result=0u;
 switch kind{
  case 16u:{let b=bank+${o.broad}u;rc_state[request+8u]=b;if(rc_state[b]==0u&&rc_state[b+19u]==1u&&rc_state[b+21u]==0u){rc_gn_mark(request,${p.broad}u,scratch);}}
  case 17u:{let scene=bank+${o.scene}u;let bridge=bank+${o.sceneWorld}u;rc_state[request+8u]=bridge;rc_state[request+12u]=scene;
   if(rc_state[bank+2u]!=1u||rc_state[bank+12u]!=3u||rc_state[bridge+1u]!=1u||rc_state[bridge+10u]==10u){return 0u;}let phase=rc_state[bridge+10u];if((phase!=2u&&phase!=4u&&phase!=6u&&phase!=8u)||rc_state[bridge+15u]!=0u){rc_state[bridge+1u]=4u;rc_state[scene+1u]=4u;rc_state[scene+2u]=6u;return 0u;}
   let bundle=${p.scene}u;let index=rc_state[bridge+14u];let length=arrayLength(&rc_program);if(bundle>length||length-bundle<8u||rc_program[bundle]!=0x52435357u||rc_program[bundle+1u]!=1u||rc_program[bundle+2u]!=2u||index>=2u){rc_rn_scene_result(scene,bridge,2u);return rc_rn_source_result(bank,request,2u);}rc_state[request+13u]=index;rc_state[request+14u]=phase;rc_state[request+16u]=rc_state[bridge+16u];rc_gn_mark(request,bundle+rc_program[bundle+4u+index],scratch);
  }
  case 18u:{let b=bank+${o.cueCloth}u;rc_state[request+8u]=b;if(rc_state[b]==0u&&rc_state[b+1u]==1u&&rc_state[b+18u]==0u){rc_gn_mark(request,${p.cueCloth}u,scratch);}}
  case 19u,20u:{let b=bank+${o.ccd}u;let a=b+1184u;rc_state[request+8u]=b;if(rc_state[b]!=0u){return 0u;}let phase=rc_state[a];var job=vec2<u32>(0u,0u);
   if(kind==19u){if(phase!=1u&&phase!=3u){return 0u;}if(rc_state[a+1u]!=0u||rc_state[b+14u]==0u){rc_ccd_fail(b,4u);return 0u;}if(phase==1u){job=rc_ccd_pre_numeric_request(b);}else{job=rc_ccd_body_numeric_request(b);}}
   else{if(phase!=10u&&phase!=12u&&phase!=14u){return 0u;}if(rc_state[a+1u]!=0u){rc_ccd_fail(b,4u);return 0u;}job=vec2<u32>(select(${entries.pre.id}u,${entries.post.id}u,phase==14u),b+448u);}
   rc_state[request+14u]=phase;rc_state[request+15u]=select(6u,7u,phase==3u||phase==14u);rc_state[request+16u]=rc_state[a+rc_state[request+15u]];rc_rn_ccd_prepare(b,job.y,job.x,scratch,${p.ccd}u,request);
  }
  default:{let cue=bank+${o.cue}u;rc_state[request+8u]=cue;rc_state[request+12u]=role;rc_state[request+13u]=u32(post);rc_state[request+14u]=bank+${o.bodies}u;rc_state[request+15u]=bank+${o.cuePreSolve}u;result=rc_rn_cue_prepare(cue,bank+${o.bodies}u,bank+${o.cuePreSolve}u,select(${cuePrograms[0]}u,${cuePrograms[1]}u,post),scratch,role,post,request);}
 }
 if(rc_state[request+3u]==3u){return rc_rn_source_result(bank,request,result);}return result;
}
fn rc_remaining_numeric_request_valid(bank:u32,request:u32)->bool{
 let kind=rc_state[request+2u];let base=rc_state[request+8u];var expected=0u;
 switch kind{
  case 16u:{if(base!=bank+${o.broad}u||rc_state[base]!=0u||rc_state[base+19u]!=1u||rc_state[base+21u]!=0u){return false;}expected=${p.broad}u;}
  case 17u:{let scene=bank+${o.scene}u;if(base!=bank+${o.sceneWorld}u||rc_state[request+12u]!=scene||rc_state[bank+2u]!=1u||rc_state[bank+12u]!=3u||rc_state[base+1u]!=1u||rc_state[base+10u]!=rc_state[request+14u]||rc_state[base+14u]!=rc_state[request+13u]||rc_state[base+15u]!=0u||rc_state[base+16u]!=rc_state[request+16u]){return false;}let index=rc_state[request+13u];if(index>=2u){return false;}expected=${p.scene}u+rc_program[${p.scene+4}u+index];}
  case 18u:{if(base!=bank+${o.cueCloth}u||rc_state[base]!=0u||rc_state[base+1u]!=1u||rc_state[base+18u]!=0u){return false;}expected=${p.cueCloth}u;}
  case 19u,20u:{let a=base+1184u;let phase=rc_state[request+14u];if(base!=bank+${o.ccd}u||rc_state[base]!=0u||rc_state[a]!=phase||rc_state[a+1u]!=0u||rc_state[request+15u]!=select(6u,7u,phase==3u||phase==14u)||rc_state[a+rc_state[request+15u]]!=rc_state[request+16u]||rc_state[request+20u]!=base+704u){return false;}var job=vec2<u32>(0u,0u);if(kind==19u){if((phase!=1u&&phase!=3u)||rc_state[base+14u]==0u){return false;}if(phase==1u){job=rc_ccd_pre_numeric_request(base);}else{job=rc_ccd_body_numeric_request(base);}}else{if(phase!=10u&&phase!=12u&&phase!=14u){return false;}job=vec2<u32>(select(${entries.pre.id}u,${entries.post.id}u,phase==14u),base+448u);}if(job.x!=rc_state[request+13u]||job.y!=rc_state[request+12u]){return false;}expected=rc_rn_ccd_program(job.x);if(expected==0xffffffffu){return false;}}
  case 21u:{if(base!=bank+${o.cue}u||rc_state[request+12u]>1u||rc_state[request+13u]>1u||rc_state[request+14u]!=bank+${o.bodies}u||rc_state[request+15u]!=bank+${o.cuePreSolve}u){return false;}expected=select(${cuePrograms[0]}u,${cuePrograms[1]}u,rc_state[request+13u]!=0u);}
  default:{return false;}
 }
 return rc_state[request+9u]==expected&&rc_state[request+11u]==rc_program[expected+3u]&&rc_state[request+21u]==rc_program[expected+4u]&&rc_state[request+22u]==expected+rc_program[expected+8u];
}
fn rc_remaining_numeric_finish(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->u32{
 if(!rc_gn_identity(bank,scratch,request,originalPC,originalPipeline)){return rc_gn_fail(bank,request);}let transport=rc_state[request+3u];if(transport==3u){return rc_state[request+19u];}if(transport!=2u||!rc_remaining_numeric_request_valid(bank,request)){return rc_gn_fail(bank,request);}
 let kind=rc_state[request+2u];let base=rc_state[request+8u];let status=rc_state[request+18u];var result=0u;
 switch kind{
  case 16u:{rc_state[base+21u]=status;}
  case 17u:{rc_rn_scene_result(rc_state[request+12u],base,status);result=status;}
  case 18u:{rc_state[base+18u]=status;}
  case 19u,20u:{if(rc_rn_ccd_finish(base,scratch,request)){let a=base+1184u;rc_state[a+1u]=1u;rc_state[a+rc_state[request+15u]]++;}}
  case 21u:{result=rc_rn_cue_finish(base,rc_state[request+9u],scratch,rc_state[request+13u]!=0u,request);}
  default:{return rc_gn_fail(bank,request);}
 }
 rc_state[request+3u]=3u;return rc_rn_source_result(bank,request,result);
}
fn rc_remaining_numeric_entry(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32,kind:u32,role:u32,post:bool)->u32{
 if(!rc_gn_address(bank,scratch,request)){rc_gn_fail(bank,request);return 2u;}
 let transport=rc_state[request+3u];if(transport==1u||transport==2u){if(!rc_gn_identity(bank,scratch,request,originalPC,originalPipeline)||rc_state[request+2u]!=kind||(kind==21u&&(rc_state[request+12u]!=role||rc_state[request+13u]!=u32(post)))){rc_gn_fail(bank,request);return 2u;}if(transport==1u){return 0u;}rc_remaining_numeric_finish(bank,scratch,request,originalPC,originalPipeline);}
 else{rc_remaining_numeric_prepare(bank,scratch,request,originalPC,originalPipeline,kind,role,post);}
 if(rc_state[request+3u]==4u){return 2u;}return select(0u,1u,rc_state[request+3u]==3u);
}
${[['broad',16],['scene',17],['cloth',18],['active_ccd',19],['inactive_ccd',20]].map(([name,kind])=>`fn rc_remaining_${name}_entry(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->u32{return rc_remaining_numeric_entry(bank,scratch,request,originalPC,originalPipeline,${kind}u,0u,false);}`).join('\n')}
${[false,true].flatMap(post=>[0,1].map(role=>`fn rc_remaining_cue_${post?'post':'pre'}_${role}_entry(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->u32{return rc_remaining_numeric_entry(bank,scratch,request,originalPC,originalPipeline,21u,${role}u,${post});}`)).join('\n')}
`;}
export function remainingNumericSourceSeamsForTest(template,{testOnly=false}={}){if(!testOnly)throw TypeError('Explicit test-only seam inspection required');validate(template);const p=parts(template);return{ccd:p.evalSeam,cue:p.cueSeam};}
