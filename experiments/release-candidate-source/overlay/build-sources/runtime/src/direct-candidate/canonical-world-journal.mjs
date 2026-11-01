/** Resident journal of one owned PW1 continuation interval, NOT a whole-shot origin attestation.
 * Capture at every actual pair/landing commit before its slot receipt is overwritten.
 * Cushions require the source-owned impact snapshot; no off-table or kiss producer is inferred.
 */
export const WORLD_JOURNAL_VERSION=0x574a3101;
export const WORLD_JOURNAL_HEADER=32;
const V=WORLD_JOURNAL_VERSION, NONE=0xffffffff;
export const WORLD_JOURNAL_AUX_VERSION=1;
function microDuration(count,num,den){
 if(count<1||count>128||num<2*count||num>254*count||num>32512||(num&1)||den<1||den>268435456)return null;
 const scaled=num*1048576,lo=Math.floor(scaled/den),hi=lo+(scaled%den?1:0);
 if(hi>128)return null;return {lo,hi};
}
function compositeValid(count,lo,hi,num,den,t,previous){const d=microDuration(count,num,den);return !!d&&hi===t&&lo<=hi&&hi-lo===d.hi-d.lo&&lo>=d.lo&&lo-d.lo>=previous;}
export const WORLD_JOURNAL_AUX_WGSL=String.raw`
fn journal_composite_valid(count:u32,lo:u32,hi:u32,num:u32,den:u32,t:u32,previous:u32)->bool{
 if(count<1u||count>128u||num<2u*count||num>254u*count||num>32512u||(num&1u)!=0u||den<1u||den>268435456u){return false;}
 let low=num<<20u;let high=num>>12u;var remainder=0u;var quotient=0u;
 for(var k=47i;k>=0i;k--){var bit=0u;if(k>=32i){bit=(high>>u32(k-32i))&1u;}else{bit=(low>>u32(k))&1u;}remainder=remainder*2u+bit;if(remainder>=den){remainder-=den;if(k>=32i){return false;}quotient|=1u<<u32(k);}}
 let upper=quotient+select(0u,1u,remainder!=0u);
 return upper<=128u&&hi==t&&lo<=hi&&hi-lo==upper-quotient&&lo>=quotient&&lo-quotient>=previous;
}
`;

const owned=x=>x instanceof Uint32Array&&Object.prototype.toString.call(x.buffer)!=='[object SharedArrayBuffer]';
function capacityGate(capacity){if(!Number.isInteger(capacity)||capacity<1||capacity>1024)throw RangeError('Bounded journal capacity 1..1024');}
function initialize(world,j){j.fill(0);j.set([V,1,0,0,world[2],world[3],world[3],0,0,world[8],world[9],world[1],world[7]]);for(let i=0;i<4;i++)j[16+i]=world[32+40*i];j[31]=(j.length-32)/8;if(world[0]!==0x50575201||![3,4].includes(world[2])||world[3]>0x7fffffff||world[7]>=world[2]){j[1]=3;j[2]=1;}}
function emit(j,k,a,b,d,t,flags){if(j[3]>=j[31]){j[1]=3;j[2]=2;return false;}const z=32+8*j[3];j.set([k,a,b,d,t,j[3]+1,flags,0],z);j[3]++;return true;}
function fail(j,reason,t){if(j[1]!==1)return;j[1]=3;j[2]=reason;emit(j,10,0,0,11,t,0);}
export function captureWorldJournalCPU(j,s,{final=false,auxWords=null}={}){
 if(!owned(j)||j.length<40||(j.length-32)%8||j[0]!==V||j[31]!==((j.length-32)/8)||!owned(s)||s.length!==256)throw TypeError('Owned journal and actual 256-word world state');
 if(j[1]!==1)return j;const n=j[4],t=s[5];
 if(s[0]!==j[11]||s[3]!==n||s[41]!==j[9]||s[42]!==j[10]||s[44]!==j[12]||t<j[6]||t>0x7fffffff||Array.from({length:n},(_,i)=>s[64+48*i]!==j[16+i]).some(Boolean)){fail(j,3,j[6]);return j;}
 if(s[45]<j[7]||s[45]-j[7]>1||s[21]<j[8]||s[21]-j[8]>1||s[61]<j[15]||s[61]-j[15]>1){fail(j,4,t);return j;}
 const pair=s[45]!==j[7],landing=s[21]!==j[8],cushion=s[61]!==j[15];
 // Commit stages must be observed separately: never invent simultaneous ordering.
 if(Number(pair)+Number(landing)+Number(cushion)>1){fail(j,5,t);return j;}
 if(pair){const a=Math.floor(s[6]/4),b=s[6]%4;if(s[6]===NONE||a>=n||b>=n||a===b||s[46]!==t){fail(j,6,t);return j;}if(!emit(j,1,a,b,0,t,1))return j;j[7]=s[45];}
 if(landing){if(s[22]>=n||s[23]!==t){fail(j,7,t);return j;}const composite=s[51]===1;if(s[51]>1||(composite&&(!(auxWords instanceof Uint32Array)||auxWords.length!==j[31]*8||!compositeValid(s[53],s[54],s[55],s[58],s[59],t,j[6])))){fail(j,11,t);return j;}if(!emit(j,5,s[22],0,composite?1:0,t,1))return j;if(composite){auxWords.set([s[53],s[54],s[55],s[58],s[59],s[22],j[3],1],(j[3]-1)*8);j[13]++;j[14]=1;}j[8]=s[21];}
 if(cushion){const body=Math.floor(s[63]/8),rail=s[63]%8;if(body>=n||rail<1||rail>4||s[62]!==t){fail(j,12,t);return j;}if(!emit(j,2,body,rail,0,t,1))return j;j[15]=s[61];}
 j[6]=t;if(!final)return j;
 if(s[1]===9){const rest=s[6]===NONE&&s[7]===0&&Array.from({length:n},(_,i)=>{const a=64+48*i;return s[a+40]===0&&s.slice(a+27,a+33).every(x=>x===0);}).every(Boolean);if(!rest){fail(j,8,t);return j;}const mask=(1<<n)-1;if(emit(j,6,mask,mask,1,t,1)){j[1]=2;j[2]=0;}return j;}
 j[1]=3;j[2]=9;emit(j,s[1]===5?7:10,0,0,s[1]===5?0:11,t,0);return j;
}
export function createWorldJournalCPU(world,{capacity=128}={}){capacityGate(capacity);if(!owned(world)||world.length!==192)throw TypeError('Owned complete PW1');const words=new Uint32Array(32+8*capacity),auxWords=new Uint32Array(8*capacity);initialize(world,words);return {words,auxWords,capture(state,options){return captureWorldJournalCPU(words,state,{...options,auxWords});}};}
export function validateWorldJournalAux(words,auxWords){if(!(words instanceof Uint32Array)||words.length!==32+8*words[31]||words[3]>words[31])return false;let count=0,previous=words[5];for(let i=0;i<words[3];i++){const z=32+8*i;if(words[z]!==5||words[z+3]!==1){previous=words[z+4];continue;}count++;if(!(auxWords instanceof Uint32Array)||auxWords.length!==8*words[31])return false;const a=8*i;if(!compositeValid(auxWords[a],auxWords[a+1],auxWords[a+2],auxWords[a+3],auxWords[a+4],words[z+4],previous)||auxWords[a+5]!==words[z+1]||auxWords[a+6]!==words[z+5]||auxWords[a+7]!==1)return false;previous=words[z+4];}return count===words[13]&&words[14]===(count?1:0);}
export function inspectWorldJournal(words,auxWords=null){if(!owned(words)||words[0]!==V||words.length!==32+8*words[31]||words[3]>words[31])throw TypeError('Valid journal');return {scope:'prepared-world-continuation-interval',wholeShotOriginBound:false,kissCoverage:false,complete:words[1]===2&&validateWorldJournalAux(words,auxWords),compositeMetadataComplete:validateWorldJournalAux(words,auxWords),status:words[1],reason:words[2],startingTick:words[5],endingTick:words[6],events:Array.from({length:words[3]},(_,i)=>words.slice(32+8*i,40+8*i))};}
export const WORLD_JOURNAL_WGSL=WORLD_JOURNAL_AUX_WGSL+String.raw`
@group(0) @binding(0) var<storage,read> world:array<u32>;
@group(0) @binding(1) var<storage,read> state:array<u32>;
@group(0) @binding(2) var<storage,read_write> journal:array<u32>;
@group(0) @binding(3) var<storage,read_write> auxiliary:array<u32>;
fn emit(k:u32,a:u32,b:u32,d:u32,t:u32,f:u32)->bool{if(journal[3]>=journal[31]){journal[1]=3u;journal[2]=2u;return false;}let z=32u+8u*journal[3];journal[z]=k;journal[z+1u]=a;journal[z+2u]=b;journal[z+3u]=d;journal[z+4u]=t;journal[z+5u]=journal[3]+1u;journal[z+6u]=f;journal[z+7u]=0u;journal[3]++;return true;}
fn fail(reason:u32,t:u32){if(journal[1]!=1u){return;}journal[1]=3u;journal[2]=reason;let ignored=emit(10u,0u,0u,11u,t,0u);}
@compute @workgroup_size(1) fn initialize(){for(var k=0u;k<arrayLength(&journal);k++){journal[k]=0u;}for(var k=0u;k<arrayLength(&auxiliary);k++){auxiliary[k]=0u;}journal[0]=0x574a3101u;journal[1]=1u;journal[4]=world[2];journal[5]=world[3];journal[6]=world[3];journal[9]=world[8];journal[10]=world[9];journal[11]=world[1];journal[12]=world[7];for(var i=0u;i<4u;i++){journal[16u+i]=world[32u+40u*i];}journal[31]=(arrayLength(&journal)-32u)/8u;if(world[0]!=0x50575201u||(world[2]!=3u&&world[2]!=4u)||world[3]>2147483647u||world[7]>=world[2]){journal[1]=3u;journal[2]=1u;}}
fn capture(last:bool){if(journal[1]!=1u){return;}let n=journal[4];let t=state[5];var mismatch=state[0]!=journal[11]||state[3]!=n||state[41]!=journal[9]||state[42]!=journal[10]||state[44]!=journal[12]||t<journal[6]||t>2147483647u;for(var i=0u;i<n;i++){mismatch=mismatch||state[64u+48u*i]!=journal[16u+i];}if(mismatch){fail(3u,journal[6]);return;}if(state[45]<journal[7]||state[45]-journal[7]>1u||state[21]<journal[8]||state[21]-journal[8]>1u||state[61]<journal[15]||state[61]-journal[15]>1u){fail(4u,t);return;}let pair=state[45]!=journal[7];let landing=state[21]!=journal[8];let cushion=state[61]!=journal[15];if(select(0u,1u,pair)+select(0u,1u,landing)+select(0u,1u,cushion)>1u){fail(5u,t);return;}
if(pair){let a=state[6]/4u;let b=state[6]%4u;if(state[6]==0xffffffffu||a>=n||b>=n||a==b||state[46]!=t){fail(6u,t);return;}if(!emit(1u,a,b,0u,t,1u)){return;}journal[7]=state[45];}
if(landing){if(state[22]>=n||state[23]!=t){fail(7u,t);return;}let composite=state[51]==1u;if(state[51]>1u||(composite&&(arrayLength(&auxiliary)!=journal[31]*8u||!journal_composite_valid(state[53],state[54],state[55],state[58],state[59],t,journal[6])))){fail(11u,t);return;}if(!emit(5u,state[22],0u,select(0u,1u,composite),t,1u)){return;}if(composite){let a=(journal[3]-1u)*8u;auxiliary[a]=state[53];auxiliary[a+1u]=state[54];auxiliary[a+2u]=state[55];auxiliary[a+3u]=state[58];auxiliary[a+4u]=state[59];auxiliary[a+5u]=state[22];auxiliary[a+6u]=journal[3];auxiliary[a+7u]=1u;journal[13]++;journal[14]=1u;}journal[8]=state[21];}
if(cushion){let body=state[63]/8u;let rail=state[63]%8u;if(body>=n||rail<1u||rail>4u||state[62]!=t){fail(12u,t);return;}if(!emit(2u,body,rail,0u,t,1u)){return;}journal[15]=state[61];}
journal[6]=t;if(!last){return;}if(state[1]==9u){var rest=state[6]==0xffffffffu&&state[7]==0u;for(var i=0u;i<n;i++){let a=64u+48u*i;rest=rest&&state[a+40u]==0u;for(var k=27u;k<33u;k++){rest=rest&&state[a+k]==0u;}}if(!rest){fail(8u,t);return;}let mask=(1u<<n)-1u;if(emit(6u,mask,mask,1u,t,1u)){journal[1]=2u;journal[2]=0u;}return;}journal[1]=3u;journal[2]=9u;let ignored=emit(select(10u,7u,state[1]==5u),0u,0u,select(11u,0u,state[1]==5u),t,0u);}
@compute @workgroup_size(1) fn snapshot(){capture(false);}
@compute @workgroup_size(1) fn finish(){capture(true);}
`;
export async function createWorldJournalGPU(device){const module=device.createShaderModule({code:WORLD_JOURNAL_WGSL}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));const layout=device.createBindGroupLayout({entries:[0,1,2,3].map(binding=>({binding,visibility:4,buffer:{type:binding>=2?'storage':'read-only-storage'}}))}),pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]}),pipelines=await Promise.all(['initialize','snapshot','finish'].map(entryPoint=>device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint}})));return {createBank(worldBuffer,{capacity=128}={}){capacityGate(capacity);if(worldBuffer.size<768)throw RangeError('Complete PW1 input buffer');const byteLength=(32+8*capacity)*4,buffer=device.createBuffer({size:byteLength,usage:128|4|8}),auxByteLength=capacity*32,auxBuffer=device.createBuffer({size:auxByteLength,usage:128|4|8}),encode=(encoder,stateBuffer,index)=>{const group=device.createBindGroup({layout,entries:[worldBuffer,stateBuffer,buffer,auxBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))}),pass=encoder.beginComputePass();pass.setPipeline(pipelines[index]);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();};return {buffer,byteLength,auxBuffer,auxByteLength,encodeInitialize(encoder){encode(encoder,worldBuffer,0);},encodeCapture(encoder,stateBuffer,{final=false}={}){if(stateBuffer.size<1024)throw RangeError('Complete world state buffer');encode(encoder,stateBuffer,final?2:1);},destroy(){buffer.destroy();auxBuffer.destroy();}};}};}
