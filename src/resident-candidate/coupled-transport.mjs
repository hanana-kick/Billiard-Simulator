/* SPDX-License-Identifier: Apache-2.0
 * Opt-in fully flattened source transport around the unchanged liveness VM.
 * One bounded outer step is one validation/phase transition/word copy/numeric
 * instruction. No gather/scatter loop is nested inside the arithmetic loop.
 * Original ordered physics microprograms and all source iteration caps remain.
 */
import {generateNumericContinuationWGSL,beginNumericContinuationForTest,advanceNumericContinuationForTest} from './numeric-continuation.mjs';
import {NUMERIC_PROFILE} from './numeric-profile.mjs';
export const COUPLED_TRANSPORT=Object.freeze({numericControl:28,mode:36,index:37,reads:38,readCount:39,
 words:40,defaultInstructionBudget:32768,maxInstructionBudget:1000000,optIn:true,nativeQualified:false,defaultBackend:false});
function numericLibrary(profile){
 let code=generateNumericContinuationWGSL({numericProfile:profile});
 const old='  for(var i=0u;i<inputs;i++) {\n    if (!rc_num_finite(rc_scratch[scratchBase+i])) { return rc_num_fail(scratchBase,registers,3u); }\n  }';
 if(code.split(old).length!==2)throw Error('Original input finite-check boundary changed');
 // The identical checks run, in input slot order, in resident mode6. Header
 // validation still precedes them, and no numerical instruction runs before
 // every input has passed. This is loop externalization, not omitted checking.
 return code.replace('fn rc_num_cont_begin(','fn rc_ct_num_begin(').replace(old,'');
}
const CONTROL=`
fn rc_ct_fail(roster:u32,status:u32)->u32{rc_state[roster+6u]=status;return status;}
fn rc_ct_overlap(a:u32,n:u32,b:u32,m:u32)->bool{return n>0u&&m>0u&&a<b+m&&b<a+n;}
fn rc_ct_base(commonBase:u32,group:u32)->u32{
 switch group{case 0u:{return commonBase;}case 1u:{return rc_state[commonBase+20u];}case 2u:{return rc_state[commonBase+21u];}case 3u:{return rc_state[commonBase+22u];}case 4u:{return rc_state[commonBase+23u];}default:{return 0xffffffffu;}}
}
// Source f32(substeps), exactly represented for admitted integer1..32, without
// hardware conversion or changing the rounded value delivered to the graph.
fn rc_ct_substep_word(n:u32)->u32{let e=31u-countLeadingZeros(n);return ((e+127u)<<23u)|((n<<(23u-e))&0x7fffffu);}
fn rc_ct_initialize(commonBase:u32,coefficient:u32,roster:u32)->u32{
 let size=arrayLength(&rc_state);if(roster>size||size-roster<8u){return 2u;}
 let bodies=rc_state[roster];let contacts=rc_state[roster+1u];let count=rc_state[roster+2u];let steps=rc_state[roster+3u];let pgs=rc_state[roster+4u];let relax=rc_state[roster+5u];
 if(bodies<1u||bodies>4u||contacts>27u||count>contacts||steps<1u||steps>32u||pgs<1u||pgs>32u||relax<1u||relax>32u||rc_state[roster+7u]!=0u){return rc_ct_fail(roster,2u);}
 let commonWords=64u+bodies*64u+contacts*32u;let coefficientWords=contacts*128u;let rosterWords=8u+contacts*5u;
 if(commonBase>size||size-commonBase<commonWords||coefficient>size||size-coefficient<coefficientWords||size-roster<rosterWords){return rc_ct_fail(roster,2u);}
 if(rc_ct_overlap(commonBase,commonWords,coefficient,coefficientWords)||rc_ct_overlap(commonBase,commonWords,roster,rosterWords)||rc_ct_overlap(coefficient,coefficientWords,roster,rosterWords)){return rc_ct_fail(roster,2u);}
 if((rc_state[commonBase+9u]&0x7fffffffu)!=0u){return rc_ct_fail(roster,2u);}
 rc_state[commonBase+13u]=0u;rc_state[commonBase+14u]=0u;rc_state[commonBase+15u]=0u;rc_state[commonBase+16u]=0u;rc_state[commonBase+17u]=0u;
 rc_state[commonBase+18u]=0x52434354u;rc_state[commonBase+27u]=0u;rc_state[commonBase+36u]=0u;rc_state[commonBase+37u]=0u;rc_state[commonBase+38u]=0u;rc_state[commonBase+39u]=0u;return 0u;
}
fn rc_ct_select(commonBase:u32,coefficient:u32,roster:u32,bundle:u32,scratch:u32)->u32{
 let bodies=rc_state[roster];let contacts=rc_state[roster+1u];let count=rc_state[roster+2u];
 let substeps=rc_state[roster+3u];let pgs=rc_state[roster+4u];let relax=rc_state[roster+5u];
 var phase=rc_state[commonBase+14u];var step=rc_state[commonBase+15u];var sweep=rc_state[commonBase+16u];var item=rc_state[commonBase+17u];
 if(phase>10u||step>substeps||sweep>32u||item>27u){return rc_ct_fail(roster,2u);}if(phase==10u){rc_state[roster+6u]=1u;return 1u;}
 let bodyPhase=phase==1u||phase==2u||phase==5u||phase==9u;let limit=select(count,bodies,bodyPhase);
 if(item>=limit){
  item=0u;var repeatSweep=false;
  if(phase==4u||phase==6u){sweep++;let sweeps=select(pgs,relax,phase==6u);repeatSweep=sweep<sweeps;if(!repeatSweep){sweep=0u;}}
  if(!repeatSweep){if(phase==6u){step++;phase=select(7u,2u,step<substeps);}else{phase++;}}
  rc_state[commonBase+14u]=phase;rc_state[commonBase+15u]=step;rc_state[commonBase+16u]=sweep;rc_state[commonBase+17u]=item;return 0u;
 }
 var a=0xffffffffu;var b=0xffffffffu;var raw=0xffffffffu;var coeff=0xffffffffu;var program=0u;
 if(bodyPhase){b=commonBase+64u+item*64u;switch phase{case 1u:{program=3u;}case 2u:{program=4u;}case 5u:{program=9u;}default:{program=15u;}}}
 else{let descriptors=roster+8u;let order=descriptors+contacts*4u;let index=rc_state[order+item];let row=descriptors+index*4u;let kind=rc_state[row];let pair=kind==0u;
  if(pair){a=commonBase+64u+rc_state[row+1u]*64u;}b=commonBase+64u+rc_state[row+2u]*64u;raw=commonBase+64u+bodies*64u+index*32u;coeff=coefficient+index*128u;
  switch phase{case 0u:{program=select(select(2u,1u,kind==1u),0u,pair);}case 3u:{program=select(6u,5u,pair);}case 4u:{program=select(8u,7u,pair);}case 6u:{program=select(11u,10u,pair);}case 7u:{program=select(13u,12u,pair);}default:{program=14u;}}
 }
 let plen=arrayLength(&rc_program);let slen=arrayLength(&rc_scratch);
 if(bundle>plen||plen-bundle<100u||rc_program[bundle]!=0x52434353u||rc_program[bundle+1u]!=1u||rc_program[bundle+2u]!=16u||program>=16u){return rc_ct_fail(roster,2u);}
 let entry=bundle+4u+program*6u;let np=bundle+rc_program[entry];let reads=bundle+rc_program[entry+1u];let readCount=rc_program[entry+2u];let writes=bundle+rc_program[entry+3u];let writeCount=rc_program[entry+4u];let scratchWords=rc_program[entry+5u];
 if(scratch>slen||slen-scratch<scratchWords||scratchWords<353u||reads>plen||readCount>(plen-reads)/3u||writes>plen||writeCount>(plen-writes)/2u||np>plen||plen-np<12u||rc_program[np+3u]!=352u){return rc_ct_fail(roster,2u);}
 rc_state[commonBase+19u]=np;rc_state[commonBase+20u]=a;rc_state[commonBase+21u]=b;rc_state[commonBase+22u]=raw;rc_state[commonBase+23u]=coeff;rc_state[commonBase+24u]=writes;rc_state[commonBase+25u]=writeCount;rc_state[commonBase+26u]=scratchWords;rc_state[commonBase+27u]=1u;
 rc_state[commonBase+36u]=3u;rc_state[commonBase+37u]=0u;rc_state[commonBase+38u]=reads;rc_state[commonBase+39u]=readCount;return 0u;
}
fn rc_coupled_transport_advance(commonBase:u32,coefficient:u32,roster:u32,bundle:u32,scratch:u32,instructionBudget:u32)->u32{
 let size=arrayLength(&rc_state);if(commonBase>size||size-commonBase<64u||roster>size||size-roster<8u){return 2u;}let prior=rc_state[roster+6u];if(prior!=0u){return prior;}
 if(instructionBudget==0u||instructionBudget>1000000u){return rc_ct_fail(roster,2u);}
 if(rc_state[commonBase+18u]==0u){let started=rc_ct_initialize(commonBase,coefficient,roster);if(started!=0u){return started;}}else if(rc_state[commonBase+18u]!=0x52434354u){return rc_ct_fail(roster,2u);}
 var executed=0u;loop{
  if(executed>=instructionBudget){return 0u;}executed++;
  let mode=rc_state[commonBase+36u];let index=rc_state[commonBase+37u];
  if(mode==0u){
   let contacts=rc_state[roster+1u];if(index<contacts){let row=roster+8u+index*4u;let kind=rc_state[row];let a=rc_state[row+1u];let b=rc_state[row+2u];let bodies=rc_state[roster];
    if(kind>2u||b>=bodies||rc_state[row+3u]!=0u||(kind==0u&&(a>=bodies||a==b))||(kind!=0u&&a!=0xffffffffu)){return rc_ct_fail(roster,2u);}}
   if(index+1u>=contacts){rc_state[commonBase+36u]=1u;rc_state[commonBase+37u]=0u;}else{rc_state[commonBase+37u]=index+1u;}
  }else if(mode==1u){
   let count=rc_state[roster+2u];if(index<count){let contacts=rc_state[roster+1u];let at=roster+8u+contacts*4u+index;let chosen=rc_state[at];if(chosen>=contacts){return rc_ct_fail(roster,2u);}let bit=1u<<chosen;if((rc_state[commonBase+38u]&bit)!=0u){return rc_ct_fail(roster,2u);}rc_state[commonBase+38u]|=bit;}
   if(index+1u>=count){rc_state[commonBase+36u]=2u;rc_state[commonBase+37u]=0u;}else{rc_state[commonBase+37u]=index+1u;}
  }else if(mode==2u){let selected=rc_ct_select(commonBase,coefficient,roster,bundle,scratch);if(selected!=0u){return selected;}}
  else if(mode==3u){
   rc_scratch[scratch+index]=0u;if(index+1u>=352u){rc_state[commonBase+36u]=4u;rc_state[commonBase+37u]=0u;}else{rc_state[commonBase+37u]=index+1u;}
  }else if(mode==4u){
   let count=rc_state[commonBase+39u];if(index<count){let at=rc_state[commonBase+38u]+index*3u;let slot=rc_program[at];let group=rc_program[at+1u];let offset=rc_program[at+2u];if(slot>=352u||group>4u){return rc_ct_fail(roster,2u);}
    if(group==0u&&offset==63u){rc_scratch[scratch+slot]=rc_ct_substep_word(rc_state[roster+3u]);}
    else{let address=rc_ct_base(commonBase,group);if(address>=size||offset>=size-address){return rc_ct_fail(roster,2u);}rc_scratch[scratch+slot]=rc_state[address+offset];}}
   if(index+1u>=count){rc_state[commonBase+36u]=5u;rc_state[commonBase+37u]=0u;}else{rc_state[commonBase+37u]=index+1u;}
  }else if(mode==5u){
   let status=rc_ct_num_begin(rc_state[commonBase+19u],scratch,commonBase+28u);if(status!=0u){return rc_ct_fail(roster,status);}rc_state[commonBase+36u]=6u;rc_state[commonBase+37u]=0u;
  }else if(mode==6u){
   if(!rc_num_finite(rc_scratch[scratch+index])){let np=rc_state[commonBase+19u];rc_num_fail(scratch,rc_program[np+5u],3u);rc_state[commonBase+33u]=3u;return rc_ct_fail(roster,3u);}
   if(index+1u>=352u){rc_state[commonBase+36u]=7u;rc_state[commonBase+37u]=0u;}else{rc_state[commonBase+37u]=index+1u;}
  }else if(mode==7u){
   let status=rc_num_cont_instruction(commonBase+28u);if(status>1u){return rc_ct_fail(roster,status);}if(status==1u){let np=rc_state[commonBase+19u];if(rc_program[np+4u]!=rc_state[commonBase+25u]){return rc_ct_fail(roster,2u);}rc_state[commonBase+27u]=2u;rc_state[commonBase+36u]=8u;rc_state[commonBase+37u]=0u;}
  }else if(mode==8u){
   let count=rc_state[commonBase+25u];if(index<count){let at=rc_state[commonBase+24u]+index*2u;let group=rc_program[at];let offset=rc_program[at+1u];if(group<1u||group>4u){return rc_ct_fail(roster,2u);}let address=rc_ct_base(commonBase,group);if(address>=size||offset>=size-address){return rc_ct_fail(roster,2u);}
    let np=rc_state[commonBase+19u];let outMap=np+rc_program[np+8u];var word=rc_scratch[scratch+rc_program[outMap+index]];if(group==3u&&(word&0x7fffffffu)==0u){word=0u;}rc_state[address+offset]=word;}
   if(index+1u>=count){rc_state[commonBase+13u]++;rc_state[commonBase+17u]++;rc_state[commonBase+27u]=0u;rc_state[commonBase+36u]=2u;rc_state[commonBase+37u]=0u;}else{rc_state[commonBase+37u]=index+1u;}
  }else{return rc_ct_fail(roster,2u);}
 }
}
`;
export function generateCoupledTransportWGSL({numericProfile=NUMERIC_PROFILE.PRESERVED_F32}={}){return numericLibrary(numericProfile)+CONTROL;}
/** Static schema bound, independent of candidate data, including every original
 * clear/input-finite check and all largest-kind read/write maps. */
export function coupledTransportWorkBound(bundle,{bodyCount=4,contactCount=27,substeps=12,pgsIterations=4,stabilizationIterations=1,instructionBudget=32768}={}){
 for(const[x,min,max]of[[bodyCount,1,4],[contactCount,0,27],[substeps,1,32],[pgsIterations,1,32],[stabilizationIterations,1,32],[instructionBudget,1,1000000]])if(!Number.isInteger(x)||x<min||x>max)throw RangeError('Admitted static coupled schema bound required');
 const cost=i=>{const e=bundle.entries[i];return 1+352+Math.max(1,e.reads.length)+1+352+Math.max(1,e.compiled.nodeCount)+Math.max(1,e.writes.length);},max=(...ids)=>Math.max(...ids.map(cost));
 const numericalAndCopies=contactCount*(max(0,1,2)+max(12,13)+cost(14))+bodyCount*(cost(3)+cost(15))+substeps*(bodyCount*(cost(4)+cost(9))+contactCount*(max(5,6)+pgsIterations*max(7,8)+stabilizationIterations*max(10,11)));
 const transitions=6+substeps*(4+pgsIterations+stabilizationIterations),validation=2*Math.max(1,contactCount),instructions=validation+numericalAndCopies+transitions+1;
 return Object.freeze({instructions,dispatches:Math.ceil(instructions/instructionBudget),instructionBudget,sourceBodies:bodyCount,sourceContacts:contactCount,sourceSubsteps:substeps,sourcePgs:pgsIterations,sourceRelax:stabilizationIterations});
}
/** TEST ONLY exact transport dialect plus unchanged one-instruction arithmetic
 * oracle. Never a production fallback. */
export function executeCoupledTransportForTest(bundle,initial,{testOnly=false,stateBase=0,coefficientBase,rosterBase,scratchBase=0,instructionBudget=32768,dispatches=1000,onProgram}={}){
 if(testOnly!==true)throw TypeError('Coupled transport oracle is TEST-ONLY');if(!(initial instanceof Uint32Array)||!(bundle?.program instanceof Uint32Array)||!Number.isInteger(dispatches)||dispatches<1)throw TypeError('Owned state and immutable program schedule required');
 const rc_state=initial.slice(),rc_program=bundle.program,rc_scratch=new Uint32Array(scratchBase+bundle.scratchWords),contexts=new Map();
 const begin=(pb,sb,cb)=>{let s;try{s=beginNumericContinuationForTest(rc_program,new Float32Array(rc_scratch.buffer,sb*4,rc_program[pb+3]),{testOnly:true,programBase:pb});}catch(e){return e.numericStatus??2;}
  // The actual header-only initializer defers finite status to mode6. Retain
  // identical slot words; the host numerical oracle must likewise not publish
  // an early finite error before the explicit source-ordered check cursor.
  s.status=0;s.words[s.registers]=0;contexts.set(cb,s);rc_state.set([0x52434e43,pb,sb,0,s.initialized,0,0,0],cb);onProgram?.({programBase:pb,input:new Float32Array(s.words.buffer,0,s.inputs).slice()});return 0;};
 const instruction=cb=>{const s=contexts.get(cb);if(!s)return 2;const status=advanceNumericContinuationForTest(s,{testOnly:true});rc_scratch.set(s.words,rc_state[cb+2]);rc_state[cb+3]=s.instruction;rc_state[cb+4]=s.initialized;rc_state[cb+5]=status;return status;};
 let code=CONTROL.replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?\s*\{/g,(_,name,args)=>`function ${name}(${args.replace(/:(?:u32|bool)/g,'')}){`).replace(/:(?:u32|bool)(?=\s*=)/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/\bloop\s*\{/g,'while(true){').replace(/\bswitch\s+(\w+)\s*\{/g,'switch($1){').replace(/}\s*(?=case\b|default\s*:)/g,'break;}').replace(/arrayLength\(&([a-z_]+)\)/g,'$1.length');
 const run=new Function('rc_state','rc_program','rc_scratch','rc_ct_num_begin','rc_num_cont_instruction','rc_num_finite','rc_num_fail','select','countLeadingZeros',code+'\nreturn rc_coupled_transport_advance;')(rc_state,rc_program,rc_scratch,begin,instruction,w=>(w&0x7f800000)!==0x7f800000,(b,s,status)=>(rc_scratch[b+s]=status),(a,b,p)=>p?b:a,Math.clz32);
 let used=0,status=0;for(;used<dispatches&&status===0;used++)status=run(stateBase,coefficientBase,rosterBase,0,scratchBase,instructionBudget);
 return{state:rc_state,scratch:rc_scratch,status,dispatches:used};
}
