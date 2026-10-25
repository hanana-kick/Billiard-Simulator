/* SPDX-License-Identifier: Apache-2.0
 * Shared candidate-local numeric request ABI and exactly one evaluator callsite.
 * Owner-specific source prefixes/suffixes validate their own request payload.
 * This library never invokes a source owner inside a control loop.
 */
import {generateProfiledNumericWGSL,numericProfileCode,NUMERIC_PROFILE} from './numeric-profile.mjs';
export const NUMERIC_REQUEST=Object.freeze({words:24,magic:0x5243474e,version:1,
 kind:Object.freeze({floor:1,pair:2,convexPrepare:3,convexFinish:4,cuePose:5,cueCache:6}),
 status:Object.freeze({idle:0,prepared:1,evaluated:2,completed:3,failed:4}),
 header:Object.freeze({magic:0,version:1,kind:2,status:3,originalPC:4,originalPipeline:5,hSequence:6,collisionPass:7,
  ownerBase:8,program:9,scratch:10,inputCount:11,arg0:12,arg1:13,arg2:14,arg3:15,savedOldPair:16,savedOldPoint:17,
  numericStatus:18,sourceResult:19,outputBase:20,outputCount:21,outputMap:22,numericProfile:23}),
 capability:Object.freeze({sourcePrefixesAndSuffixes:true,oneEvaluatorCallsite:true,hostForwardFallback:false,
  nativeQualified:false,fullWorldQualified:false,defaultBackend:false})});
export function generateNumericRequestWGSL(t,{numericProfile=NUMERIC_PROFILE.PRESERVED_F32,includeNumericLibrary=true,
 requestTailBase,candidateCount,validator='rc_numeric_request_validate_owner'}={}){
 if(t?.kind!=='resident-created-world-layout'||!Number.isInteger(t.state?.length)||!Number.isInteger(t.numericScratchWords)||!Number.isInteger(t.segments?.worldH?.offset)||!/^\w+$/.test(validator))throw TypeError('Exact world numeric request layout and validator required');
 const profile=numericProfileCode(numericProfile),o=t.segments,n=t.state.length,allocated=requestTailBase!==undefined||candidateCount!==undefined;
 if(allocated&&(!Number.isSafeInteger(requestTailBase)||requestTailBase<0||!Number.isInteger(candidateCount)||candidateCount<1||candidateCount>4096||requestTailBase<candidateCount*n+t.fixedCcd.length||requestTailBase+candidateCount*24>0xffffffff))throw RangeError('Disjoint bounded geometry request tail allocation required');
 return(includeNumericLibrary?generateProfiledNumericWGSL(numericProfile):'')+`
fn rc_gn_span(request:u32)->bool{return request<=arrayLength(&rc_state)&&arrayLength(&rc_state)-request>=24u;}
fn rc_gn_fail(bank:u32,request:u32)->u32{if(rc_gn_span(request)${allocated?`&&bank%${n}u==0u&&bank/${n}u<${candidateCount}u&&request==${requestTailBase}u+(bank/${n}u)*24u`:''}){rc_state[request+3u]=4u;rc_state[request+19u]=0xffffffffu;}if(bank+3u<arrayLength(&rc_state)&&rc_state[bank+2u]==1u){rc_state[bank+2u]=4u;rc_state[bank+3u]=6u;}return 0xffffffffu;}
fn rc_gn_address(bank:u32,scratch:u32,request:u32)->bool{
 if(bank%${n}u!=0u||bank>arrayLength(&rc_state)||arrayLength(&rc_state)-bank<${n}u||!rc_gn_span(request)||scratch!=(bank/${n}u)*${t.numericScratchWords}u||scratch>arrayLength(&rc_scratch)||arrayLength(&rc_scratch)-scratch<${t.numericScratchWords}u){return false;}
 if(request<bank+${n}u&&bank<request+24u){return false;}
 ${allocated?`if(bank/${n}u>=${candidateCount}u||request!=${requestTailBase}u+(bank/${n}u)*24u){return false;}`:''}
 return true;
}
fn rc_gn_identity(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->bool{
 return rc_gn_address(bank,scratch,request)&&rc_state[request]==0x5243474eu&&rc_state[request+1u]==1u&&rc_state[request+4u]==originalPC&&rc_state[request+5u]==originalPipeline&&rc_state[request+6u]==rc_state[bank+5u]&&rc_state[request+7u]==rc_state[bank+${o.worldH.offset+2}u]&&rc_state[request+10u]==scratch&&rc_state[request+23u]==${profile}u;
}
fn rc_gn_mark(request:u32,program:u32,scratch:u32){
 rc_state[request+9u]=program;rc_state[request+10u]=scratch;rc_state[request+11u]=rc_program[program+3u];rc_state[request+21u]=rc_program[program+4u];rc_state[request+22u]=program+rc_program[program+8u];rc_state[request+3u]=1u;
}
fn rc_numeric_request_evaluate(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->u32{
 if(!rc_gn_identity(bank,scratch,request,originalPC,originalPipeline)){return rc_gn_fail(bank,request);}
 let status=rc_state[request+3u];if(status==3u||status==2u){return rc_state[request+19u];}if(status!=1u||!${validator}(bank,request)){return rc_gn_fail(bank,request);}
 rc_state[request+18u]=rc_num_eval(rc_state[request+9u],scratch);rc_state[request+3u]=2u;return rc_state[request+19u];
}

fn rc_geometry_numeric_evaluate(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->u32{return rc_numeric_request_evaluate(bank,scratch,request,originalPC,originalPipeline);}
`;
}
