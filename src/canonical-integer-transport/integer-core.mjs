/** Experimental canonical integer transport, not a production backend.
 * No Number/f64, resident source-PC pump, CPU physics, or result substitution.
 * Exact source scalar bytecode is data. Unknown instructions fail closed.
 */
import {CANONICAL_MICROCODE_ISA as ABI} from './isa.mjs';
const expressions={MOV:'a',UADD:'a+b',IADD:'a+b',USUB:'a-b',ISUB:'a-b',UMUL:'a*b',IMUL:'a*b',UDIV:'a/b',UREM:'a%b',IDIV:'bitcast<u32>(bitcast<i32>(a)/bitcast<i32>(b))',IREM:'bitcast<u32>(bitcast<i32>(a)%bitcast<i32>(b))',AND:'a&b',OR:'a|b',XOR:'a^b',SHL:'a<<(b&31u)',USHR:'a>>(b&31u)',ISHR:'bitcast<u32>(bitcast<i32>(a)>>(b&31u))',EQ:'select(0u,1u,a==b)',NE:'select(0u,1u,a!=b)',ULT:'select(0u,1u,a<b)',ULE:'select(0u,1u,a<=b)',UGT:'select(0u,1u,a>b)',UGE:'select(0u,1u,a>=b)',ILT:'select(0u,1u,bitcast<i32>(a)<bitcast<i32>(b))',ILE:'select(0u,1u,bitcast<i32>(a)<=bitcast<i32>(b))',IGT:'select(0u,1u,bitcast<i32>(a)>bitcast<i32>(b))',IGE:'select(0u,1u,bitcast<i32>(a)>=bitcast<i32>(b))',NOT:'~a',LNOT:'select(0u,1u,a==0u)',INEG:'0u-a',UCLZ:'countLeadingZeros(a)',UCTZ:'countTrailingZeros(a)',POPCOUNT:'countOneBits(a)',SELECT:'select(a,b,c!=0u)'};
const unary=new Set(['MOV','NOT','LNOT','INEG','UCLZ','UCTZ','POPCOUNT']);
const special={ATOMIC_LOAD_U32:[1,2,3],ATOMIC_OR_U32:[1,2,3,4],HALT:[],SET:[1,2],LOAD:[1,2,3],STORE:[2,3,4],LENGTH:[1,2],LOCAL_LOAD:[1,2],LOCAL_STORE:[2,3],JUMP:[2],BRANCH:[2,3,4],CALL:[2],RET:[],GUARD:[2]};
export const INTEGER_OPERATIONS=Object.freeze([...Object.keys(special),...Object.keys(expressions)]);
const regs=name=>name in expressions?[1,2,...(unary.has(name)?[]:[3]),...(name==='SELECT'?[4]:[])]:({ATOMIC_LOAD_U32:[1,3],ATOMIC_OR_U32:[1,3,4],SET:[1],LOAD:[1,3],STORE:[3,4],LENGTH:[1],LOCAL_LOAD:[1,2],LOCAL_STORE:[2,3],BRANCH:[2],GUARD:[2]})[name]??[];
const used=name=>special[name]??regs(name);
export function validateIntegerProgram(c){
 if(c?.kind!=='canonical-wgsl-microcode-v1'||!(c.instructions instanceof Uint32Array)||c.instructions.length%8||!c.instructions.length||!Array.isArray(c.sourceStoragePolicy)||!c.sourceStoragePolicy.length||c.sourceStoragePolicy.length>10)throw Error('Explicit canonical integer source compilation required');
 for(const k of ['localWords','callDepth'])if(!Number.isSafeInteger(c[k])||c[k]<1||c[k]>1048576)throw Error('Bounded local/stack capacity required');
 for(let ip=0;ip<c.instructions.length;ip+=8){const row=c.instructions.subarray(ip,ip+8),name=ABI.names[row[0]];if(!INTEGER_OPERATIONS.includes(name))throw Error('Unsupported integer opcode '+name);for(let i=1;i<8;i++)if(!used(name).includes(i)&&row[i])throw Error('Nonzero unused operand');for(const i of regs(name))if(row[i]>=c.localWords)throw Error('Register outside local frame');if(['LOAD','STORE','LENGTH','ATOMIC_LOAD_U32','ATOMIC_OR_U32'].includes(name)&&!c.sourceStoragePolicy.some(p=>p.binding===row[2]))throw Error('Undeclared storage binding');if(['STORE','ATOMIC_OR_U32'].includes(name)&&!c.sourceStoragePolicy.some(p=>p.binding===row[2]&&p.access==='read_write'))throw Error('Readonly storage write');for(const i of name==='BRANCH'?[3,4]:['CALL','JUMP'].includes(name)?[2]:[])if(row[i]>=c.instructions.length/8)throw Error('Branch outside program');}
 return Object.freeze({instructions:c.instructions.length/8,locals:c.localWords,stack:c.callDepth,stride:16+c.callDepth+c.localWords});
}
export function integerKernelWGSL({locals,stack,stride,instructions}, {budget=1024,operations=INTEGER_OPERATIONS}={}){
 if(stride!==16+stack+locals||![locals,stack,instructions,budget].every(x=>Number.isInteger(x)&&x>0&&x<=1048576))throw Error('Exact bounded transport layout required');
 const failure=n=>`state[2u]=3u;state[3u]=${n}u;return;`,store=v=>`state[lb+dst]=${v};`;
 if(!Array.isArray(operations)||!operations.length||operations.some(x=>!INTEGER_OPERATIONS.includes(x))||new Set(operations).size!==operations.length)throw Error("Exact supported integer opcode subset required");
 const cases=operations.map(name=>{const id=ABI.opcodes[name];let body='';
 if(name in expressions){if(['UDIV','UREM','IDIV','IREM'].includes(name))body+=`if(b==0u){${failure(3)}}`;if(['IDIV','IREM'].includes(name))body+=`if(a==0x80000000u&&b==0xffffffffu){${failure(3)}}`;body+=store(expressions[name]);}
 else if(name==='HALT')body+='state[2u]=2u;';else if(name==='SET')body+=store('aa');
 else if(name==='GUARD')body+=`if(a==0u){${failure(3)}}`;
 else if(['JUMP','BRANCH','CALL'].includes(name)){body+=`next=${name==='BRANCH'?'select(cc,bb,a!=0u)':'aa'};`;if(name==='CALL')body+=`let sp=state[5u];if(sp>=stackCount){${failure(4)}}state[16u+sp]=pc+1u;state[5u]=sp+1u;`;}
 else if(name==='RET')body+=`let sp=state[5u];if(sp==0u){state[2u]=2u;}else{if(sp>stackCount){${failure(4)}}next=state[16u+sp-1u];state[5u]=sp-1u;}`;
 else if(['LOAD','STORE','LENGTH','ATOMIC_LOAD_U32','ATOMIC_OR_U32'].includes(name)){body+=`if(aa>=arrayLength(&views)/4u){${failure(5)}}let v=aa*4u;let offset=views[v];let length=views[v+1u];`;const atomic=name.startsWith('ATOMIC_'),target=atomic?'atomicArena':'arena';if(name==='LENGTH')body+=`let capacity=select(arrayLength(&arena),arrayLength(&atomicArena),views[v+3u]==1u);if(views[v+3u]>1u||offset>capacity||length>capacity-offset){${failure(5)}}`;else body+=`if(views[v+3u]!=${atomic?1:0}u||offset>arrayLength(&${target})||length>arrayLength(&${target})-offset){${failure(5)}}`;if(name==='LENGTH')body+=store('length');else{body+=`if(b>=length){${failure(5)}}`;if(atomic){body+=`if(views[v+2u]!=1u){${failure(6)}}`;body+=store(name==='ATOMIC_LOAD_U32'?'atomicLoad(&atomicArena[offset+b])':'atomicOr(&atomicArena[offset+b],c)');}else body+=name==='LOAD'?store('arena[offset+b]'):`if(views[v+2u]!=1u){${failure(6)}}arena[offset+b]=c;`;}}
 else if(name==='LOCAL_LOAD'||name==='LOCAL_STORE')body+=`if(a>=localCount){${failure(1)}}`+(name==='LOCAL_LOAD'?store('state[lb+a]'):'state[lb+a]=b;');
 return `case ${id}u:{${body}}`;
 }).join('\n');
 const masks=Array.from({length:Math.max(...INTEGER_OPERATIONS.map(x=>ABI.opcodes[x]))+1},()=>65535);for(const name of operations)masks[ABI.opcodes[name]]=used(name).reduce((a,i)=>a|(1<<i),0)|(regs(name).reduce((a,i)=>a|(1<<i),0)<<8);
 return `const OP_FLAGS:array<u32,${masks.length}>=array<u32,${masks.length}>(${masks.map(x=>x+'u').join(',')});
@group(0) @binding(0) var<storage,read> code:array<u32>;
@group(0) @binding(1) var<storage,read_write> state:array<u32>;
@group(0) @binding(2) var<storage,read_write> arena:array<u32>;
@group(0) @binding(3) var<storage,read> views:array<u32>;
@group(0) @binding(4) var<storage,read_write> atomicArena:array<atomic<u32>>;
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
if(any(groups!=vec3<u32>(1u))){if(all(gid==vec3<u32>(0u))&&arrayLength(&state)>=4u){state[2u]=3u;state[3u]=10u;}return;}
if(arrayLength(&state)<16u){return;}
let localCount=state[10u];let stackCount=state[11u];let instructionCount=state[12u];let stateStride=state[13u];let instructionBudget=state[14u];
if(localCount==0u||localCount>1048576u||stackCount==0u||stackCount>1048576u||instructionCount==0u||instructionCount>1048576u||instructionBudget==0u||instructionBudget>1048576u||stateStride!=16u+stackCount+localCount||arrayLength(&state)!=stateStride||arrayLength(&code)!=instructionCount*8u||state[15u]!=0u){${failure(7)}}
if(state[0u]!=0x4349564du||state[1u]!=1u||state[5u]>stackCount){${failure(7)}}
if(state[2u]!=1u){return;}let lb=16u+stackCount;
for(var step=0u;step<instructionBudget;step++){
if(state[6u]==0xffffffffu&&state[7u]==0xffffffffu){${failure(9)}}
let pc=state[4u];if(pc>=instructionCount){${failure(8)}}let ip=pc*8u;let op=code[ip];let dst=code[ip+1u];let aa=code[ip+2u];let bb=code[ip+3u];let cc=code[ip+4u];var next=pc+1u;
if(op>=${masks.length}u){${failure(2)}}let flags=OP_FLAGS[op];if(flags==65535u){${failure(2)}}
for(var field=1u;field<8u;field++){let value=code[ip+field];if((flags&(1u<<field))==0u&&value!=0u){${failure(2)}}if((flags&(1u<<(field+8u)))!=0u&&value>=localCount){${failure(1)}}}
var a=0u;var b=0u;var c=0u;if((flags&1024u)!=0u){a=state[lb+aa];}if((flags&2048u)!=0u){b=state[lb+bb];}if((flags&4096u)!=0u){c=state[lb+cc];}
switch op{${cases}\ndefault:{${failure(2)}}}
if(state[2u]==1u&&next>=instructionCount){${failure(8)}}state[4u]=next;state[6u]++;if(state[6u]==0u){state[7u]++;}if(state[2u]!=1u){return;}
}
if(state[8u]==0xffffffffu){${failure(9)}}state[8u]++;
}`;
}
export function initialIntegerState(layout,{budget=1024}={}){if(!Number.isInteger(budget)||budget<1||budget>1048576)throw Error('Bounded instruction slice required');const s=new Uint32Array(layout.stride);s.set([0x4349564d,1,1]);s.set([layout.locals,layout.stack,layout.instructions,layout.stride,budget,0],10);return s;}
