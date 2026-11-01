import {MAX_CANONICAL_OPCODE_COST} from './opcode-cost.mjs';
/** Experimental four-dispatch GPU scheduler. Separate ordered passes are REQUIRED:
 * setup -> initialize -> advance -> commit. Source fault and VM error are distinct. */
import{parallelIntegerKernelWGSL}from'./parallel-kernel.mjs';
export function selectedSchedulerKernelWGSL(){
 let s=parallelIntegerKernelWGSL();const replace=(a,b)=>{if(s.split(a).length!==2)throw Error('Exact audited scheduler source transform required: '+a);s=s.replace(a,b);};
 const tail=s.indexOf('\nfn dimensionsValid()');if(tail<0)throw Error('Exact parallel template required');s=s.slice(0,tail);
 replace('@binding(3) var<storage,read> views','@binding(3) var<storage,read_write> views');replace('@binding(5) var<storage,read> dispatchInfo','@binding(5) var<storage,read_write> dispatchInfo');
 replace('arrayLength(&state)!=stateStride*dispatchInfo[0u]','arrayLength(&state)<stateStride*dispatchInfo[0u]');replace('arrayLength(&code)!=instructionCount*8u','(dispatchInfo[10u]>arrayLength(&code)||instructionCount>(arrayLength(&code)-dispatchInfo[10u])/5u)');replace('let ip=pc*8u;','let ip=dispatchInfo[10u]+pc*5u;');replace('field<8u','field<5u');
 return s+`
@group(0) @binding(7) var<storage,read> tables:array<u32>;
@group(0) @binding(8) var<storage,read_write> control:array<atomic<u32>>;
@group(0) @binding(9) var<storage,read_write> indirectArgs:array<u32>;
fn ctl(i:u32)->u32{return atomicLoad(&control[i]);}
fn failScheduler(bits:u32){atomicOr(&control[6u],bits);}
fn controlValid()->bool{return arrayLength(&control)==32u&&ctl(0u)==0x43534348u&&ctl(1u)==1u&&ctl(14u)==1u;}
fn stopped()->bool{return ctl(6u)!=0u||ctl(10u)!=0u;}
fn tableRange(base:u32,count:u32,stride:u32)->bool{return base<=arrayLength(&tables)&&count<=(arrayLength(&tables)-base)/stride;}
fn tablesValid()->bool{return arrayLength(&tables)>=16u&&tables[0u]==0x43535442u&&tables[1u]==1u&&tables[2u]==125u&&tables[3u]>0u&&tables[3u]<=66317u&&tables[4u]==66317u&&tables[11u]==arrayLength(&tables)&&tables[12u]>0u&&tables[12u]<=2097120u&&tables[13u]>0u&&tables[13u]<=arrayLength(&state)&&tables[14u]>=${MAX_CANONICAL_OPCODE_COST}u&&tables[14u]<=16384u&&tables[15u]>0u&&tables[15u]<=50000u&&tableRange(tables[7u],tables[2u],12u)&&tableRange(tables[6u],tables[3u],16u)&&tableRange(tables[5u],tables[4u],1u);}
fn frameValid()->bool{let lanes=dispatchInfo[0u];let stride=dispatchInfo[1u];return arrayLength(&dispatchInfo)==16u&&lanes>0u&&lanes<=65536u&&dispatchInfo[2u]>0u&&dispatchInfo[2u]<=1048576u&&dispatchInfo[3u]>0u&&dispatchInfo[3u]<=1048576u&&stride==16u+dispatchInfo[2u]+dispatchInfo[3u]&&stride<=arrayLength(&state)/lanes&&lanes<=arrayLength(&summary)/4u&&dispatchInfo[4u]>0u&&dispatchInfo[4u]<=1048576u&&dispatchInfo[10u]<=arrayLength(&code)&&dispatchInfo[4u]<=(arrayLength(&code)-dispatchInfo[10u])/5u&&dispatchInfo[7u]>0u&&dispatchInfo[8u]>0u&&dispatchInfo[9u]>0u&&dispatchInfo[7u]<=65536u/dispatchInfo[8u]&&dispatchInfo[7u]*dispatchInfo[8u]<=65536u/dispatchInfo[9u]&&lanes==dispatchInfo[7u]*dispatchInfo[8u]*dispatchInfo[9u];}
fn rangeSpanValid(offset:u32,words:u32,repetitions:u32,stride:u32)->bool{let n=arrayLength(&arena);return repetitions>0u&&repetitions<=3u&&words>0u&&stride>=words&&offset<=n&&words<=n-offset&&(repetitions-1u)<=(n-offset-words)/stride;}
fn rangesValid(kind:u32)->bool{let offset=dispatchInfo[11u];let words=dispatchInfo[12u];let destination=dispatchInfo[13u];let repetitions=dispatchInfo[7u];let sourceStride=dispatchInfo[8u];let destinationStride=dispatchInfo[9u];if((repetitions!=1u&&repetitions!=3u)||!rangeSpanValid(offset,words,repetitions,sourceStride)||words>tables[12u]/repetitions){return false;}if(kind==1u){return destination==0u&&destinationStride==0u;}if(kind!=2u||!rangeSpanValid(destination,words,repetitions,destinationStride)){return false;}let sourceEnd=offset+(repetitions-1u)*sourceStride+words;let destinationEnd=destination+(repetitions-1u)*destinationStride+words;return max(offset,destination)>=min(sourceEnd,destinationEnd);}
fn activeDomain()->u32{let phase=ctl(4u);if(phase==1u||phase==2u){if(!frameValid()){return 0u;}return dispatchInfo[0u];}if(phase==3u||phase==4u){if(!rangesValid(phase-2u)){return 0u;}return dispatchInfo[12u]*dispatchInfo[7u];}return 0u;}
fn gridValid(groups:vec3<u32>)->bool{let domain=activeDomain();return domain>0u&&domain<=tables[12u]&&all(groups==vec3<u32>((domain+31u)/32u,1u,1u));}
fn writeIndirectDomain(){if(stopped()||ctl(4u)==5u){return;}let domain=activeDomain();if(domain==0u||domain>tables[12u]){failScheduler(4u);return;}indirectArgs[0u]=(domain+31u)/32u;indirectArgs[1u]=1u;indirectArgs[2u]=1u;}
@compute @workgroup_size(1) fn setup(@builtin(global_invocation_id) gid:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
 if(arrayLength(&indirectArgs)!=4u){if(controlValid()&&all(gid==vec3<u32>(0u))){failScheduler(1u);}return;}if(all(gid==vec3<u32>(0u))){indirectArgs[0u]=0u;indirectArgs[1u]=0u;indirectArgs[2u]=0u;indirectArgs[3u]=0u;}
 if(!controlValid()){return;}if(any(groups!=vec3<u32>(1u))){if(all(gid==vec3<u32>(0u))){failScheduler(1u);}return;}if(stopped()){return;}if(!tablesValid()||arrayLength(&dispatchInfo)!=16u||arrayLength(&views)!=40u||ctl(11u)!=tables[4u]||ctl(9u)!=tables[15u]||ctl(3u)<ctl(2u)||ctl(3u)>tables[4u]){failScheduler(1u);return;}
 if(ctl(3u)!=ctl(17u)){if(ctl(4u)!=0u||ctl(2u)!=ctl(17u)||ctl(3u)<=ctl(2u)||ctl(3u)-ctl(2u)>256u){failScheduler(1u);return;}atomicStore(&control[17u],ctl(3u));}
 if(ctl(2u)>=ctl(3u)){return;}if(ctl(4u)!=0u){writeIndirectDomain();return;}let cursor=ctl(2u);let tid=tables[tables[5u]+cursor];if(tid>=tables[3u]){failScheduler(2u);return;}let t=tables[6u]+tid*16u;let kind=tables[t];for(var i=12u;i<16u;i++){if(tables[t+i]!=0u){failScheduler(2u);return;}}
 atomicStore(&control[8u],0u);atomicStore(&control[16u],0u);for(var i=0u;i<16u;i++){dispatchInfo[i]=0u;}dispatchInfo[14u]=kind;
 if(kind==0u){for(var i=9u;i<12u;i++){if(tables[t+i]!=0u){failScheduler(2u);return;}}let program=tables[t+1u];if(program>=tables[2u]||!tableRange(tables[t+2u],40u,1u)){failScheduler(2u);return;}let p=tables[7u]+program*12u;for(var i=9u;i<12u;i++){if(tables[p+i]!=0u){failScheduler(2u);return;}}var gx=tables[t+3u];let gy=tables[t+4u];let gz=tables[t+5u];
 // Genuine selected indirect dimensions are read from source arena ONLY here,
 // after all preceding source commands completed. Zero X is a normal no-op.
 if(tables[t+7u]!=0u){let at=tables[t+6u];let bound=tables[t+7u];let owner=tables[t+8u];if((bound!=1u&&bound!=4u)||at>arrayLength(&arena)||3u>arrayLength(&arena)-at||owner==0u||owner>cursor||gy!=1u||gz!=1u||tables[p+7u]!=1u||tables[p+8u]!=1u||gx!=bound*tables[p+6u]){failScheduler(64u);return;}let x=arena[at];let y=arena[at+1u];let z=arena[at+2u];if((x!=0u&&x!=bound)||y!=1u||z!=1u){failScheduler(64u);return;}if(x==0u){atomicStore(&control[5u],0u);atomicStore(&control[16u],1u);atomicStore(&control[4u],5u);return;}gx=x*tables[p+6u];}else if(tables[t+6u]!=0u||tables[t+8u]!=0u){failScheduler(64u);return;}
if(gx==0u||gy==0u||gz==0u||gx>65536u/gy||gx*gy>65536u/gz){failScheduler(2u);return;}let lanes=gx*gy*gz;
 dispatchInfo[0u]=lanes;dispatchInfo[1u]=tables[p+4u];dispatchInfo[2u]=tables[p+2u];dispatchInfo[3u]=tables[p+3u];dispatchInfo[4u]=tables[p+1u];dispatchInfo[5u]=tables[14u];dispatchInfo[6u]=tables[p+5u];dispatchInfo[7u]=gx;dispatchInfo[8u]=gy;dispatchInfo[9u]=gz;dispatchInfo[10u]=tables[p];if(!frameValid()||lanes>tables[12u]){failScheduler(4u);return;}for(var i=0u;i<40u;i++){views[i]=tables[tables[t+2u]+i];}atomicStore(&control[5u],lanes);atomicStore(&control[4u],1u);
 }else if(kind==1u||kind==2u){dispatchInfo[11u]=tables[t+6u];dispatchInfo[12u]=tables[t+7u];dispatchInfo[13u]=tables[t+8u];dispatchInfo[7u]=tables[t+9u];dispatchInfo[8u]=tables[t+10u];dispatchInfo[9u]=tables[t+11u];if(!rangesValid(kind)){failScheduler(8u);return;}atomicStore(&control[5u],0u);atomicStore(&control[4u],kind+2u);
 }else{failScheduler(2u);}
 writeIndirectDomain();
}
@compute @workgroup_size(32) fn initialize(@builtin(global_invocation_id) gid:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
 if(!controlValid()||stopped()||ctl(4u)!=1u){return;}if(!tablesValid()||!gridValid(groups)||!frameValid()){failScheduler(4u);return;}if(gid.x>=dispatchInfo[0u]){return;}let base=gid.x*dispatchInfo[1u];for(var i=0u;i<dispatchInfo[1u];i++){state[base+i]=0u;}state[base]=0x4349564du;state[base+1u]=1u;state[base+2u]=1u;state[base+10u]=dispatchInfo[2u];state[base+11u]=dispatchInfo[3u];state[base+12u]=dispatchInfo[4u];state[base+13u]=dispatchInfo[1u];state[base+14u]=dispatchInfo[5u];if(dispatchInfo[6u]!=0xffffffffu){if(dispatchInfo[6u]>=dispatchInfo[2u]||3u>dispatchInfo[2u]-dispatchInfo[6u]){state[base+2u]=3u;state[base+3u]=11u;}else{let slot=base+16u+dispatchInfo[3u]+dispatchInfo[6u];state[slot]=gid.x%dispatchInfo[7u];state[slot+1u]=(gid.x/dispatchInfo[7u])%dispatchInfo[8u];state[slot+2u]=gid.x/(dispatchInfo[7u]*dispatchInfo[8u]);}}
 summary[gid.x*4u]=state[base+2u];summary[gid.x*4u+1u]=state[base+3u];summary[gid.x*4u+2u]=0u;summary[gid.x*4u+3u]=0u;
}
@compute @workgroup_size(32) fn advance(@builtin(global_invocation_id) gid:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
 if(!controlValid()||stopped()){return;}let phase=ctl(4u);if(phase==0u){return;}if(!tablesValid()||!gridValid(groups)){failScheduler(4u);return;}
 if(phase==3u||phase==4u){let kind=phase-2u;if(!rangesValid(kind)){failScheduler(8u);return;}let words=dispatchInfo[12u];let n=words*dispatchInfo[7u];if(gid.x<n){let repetition=gid.x/words;let within=gid.x%words;let source=dispatchInfo[11u]+repetition*dispatchInfo[8u]+within;if(phase==3u){arena[source]=0u;}else{let destination=dispatchInfo[13u]+repetition*dispatchInfo[9u]+within;arena[destination]=arena[source];}}if(gid.x==0u){atomicStore(&control[16u],1u);}return;}
 if((phase!=1u&&phase!=2u)||!frameValid()){failScheduler(4u);return;}if(gid.x>=dispatchInfo[0u]){return;}let base=gid.x*dispatchInfo[1u];let before=state[base+2u];if(before==1u){runLane(base);}let after=state[base+2u];summary[gid.x*4u]=after;summary[gid.x*4u+1u]=state[base+3u];summary[gid.x*4u+2u]=state[base+6u];summary[gid.x*4u+3u]=state[base+7u];if(after!=1u&&after!=2u){atomicMin(&control[7u],gid.x);failScheduler(16u);return;}if(before==1u&&after==2u){let prior=atomicSub(&control[5u],1u);if(prior==0u){failScheduler(16u);}}
}
@compute @workgroup_size(1) fn commit(@builtin(global_invocation_id) gid:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
 if(!controlValid()){return;}if(any(groups!=vec3<u32>(1u))){if(all(gid==vec3<u32>(0u))){failScheduler(1u);}return;}if(stopped()){return;}let phase=ctl(4u);if(phase==0u){return;}if(ctl(3u)!=ctl(17u)||ctl(2u)>=ctl(3u)||ctl(2u)>=ctl(11u)){failScheduler(1u);return;}if(ctl(12u)==0xffffffffu){failScheduler(32u);return;}atomicAdd(&control[12u],1u);
 if(phase==1u||phase==2u){if(ctl(8u)>=ctl(9u)){failScheduler(32u);return;}atomicAdd(&control[8u],1u);if(ctl(5u)!=0u){if(ctl(8u)>=ctl(9u)){failScheduler(32u);return;}atomicStore(&control[4u],2u);return;}}
 else if((phase==3u||phase==4u||phase==5u)&&ctl(16u)==1u){}else{failScheduler(8u);return;}
 atomicAdd(&control[2u],1u);atomicStore(&control[4u],0u);if(ctl(2u)==ctl(11u)){atomicStore(&control[13u],1u);}
}
`;
}
