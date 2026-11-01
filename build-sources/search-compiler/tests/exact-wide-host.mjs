import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {EXACT_WIDE_SOURCE,EXACT_WIDE_GPU_SOURCE} from '../src/canonical-integer-transport/exact-wide-source.mjs';
import {CANONICAL_MICROCODE_ISA as ISA} from '../src/canonical-integer-transport/isa.mjs';
import {validateIntegerProgram,integerKernelWGSL} from '../src/canonical-integer-transport/integer-core.mjs';
import {validateIntegerProgramStructure} from '../src/canonical-integer-transport/program-admission.mjs';
import {residentSchedulerKernelWGSL} from '../src/canonical-integer-transport/resident-scheduler-kernel.mjs';
const main='\n@group(0) @binding(0) var<storage,read_write> output:array<u32>; @compute @workgroup_size(1) fn main(){let x=wide(output[0],output[1]);output[0]=x.x;output[1]=x.y;}';
const sourceStoragePolicy=[{name:'output',binding:0,scalar:'u32',access:'read_write'}],compile=(s=EXACT_WIDE_SOURCE+main,exactWide=true)=>compileMicrocodeWGSL(s,{sourceStoragePolicy,exactWide});
const original=compile(undefined,false),candidate=compile();
for(const c of [original,candidate])validateIntegerProgram(c);
// This fixture interpreter is host-test-only, never runtime and never physics.
function execute(c,x,y){const r=new Uint32Array(c.localWords),out=Uint32Array.of(x,y),stack=[];let pc=0,steps=0;for(;steps<1000;steps++){const [op,d,a,b,e]=c.instructions.subarray(pc*8,pc*8+5),name=ISA.names[op];pc++;switch(name){case'CALL':stack.push(pc);pc=a;break;case'RET':pc=stack.pop();break;case'HALT':return {out:[...out],steps};case'SET':r[d]=a;break;case'MOV':r[d]=r[a];break;case'AND':r[d]=r[a]&r[b];break;case'USHR':r[d]=r[a]>>>(r[b]&31);break;case'SHL':r[d]=r[a]<<(r[b]&31);break;case'UMUL':r[d]=Math.imul(r[a],r[b]);break;case'UADD':r[d]=r[a]+r[b];break;case'LOAD':out.length>r[b]||assert.fail('bounds');r[d]=out[r[b]];break;case'STORE':out[r[b]]=r[e];break;case'WIDE_U32':{ // Literal source operations with u32 wrap, independently compared to BigInt.
const a0=r[a]&65535,a1=r[a]>>>16,b0=r[b]&65535,b1=r[b]>>>16,w0=Math.imul(a0,b0)>>>0,t=(Math.imul(a1,b0)+(w0>>>16))>>>0,w1=(Math.imul(a0,b1)+(t&65535))>>>0;r[d]=((w1<<16)+(w0&65535))>>>0;r[d+1]=(Math.imul(a1,b1)+(t>>>16)+(w1>>>16))>>>0;break;}default:assert.fail(name);}}assert.fail('budget');}
const values=[0,1,2,65534,65535,65536,65537,0x7fffffff,0x80000000,0xfffffffe,0xffffffff];let n=0;
for(const a of values)for(const b of values){const p=BigInt(a)*BigInt(b),expected=[Number(p&0xffffffffn),Number(p>>32n)];assert.deepEqual(execute(original,a,b).out,expected);assert.deepEqual(execute(candidate,a,b).out,expected);n++;}
for(const altered of [EXACT_WIDE_SOURCE.replace('w1<<16u','w1<<15u'),EXACT_WIDE_SOURCE.replace('vec2<u32>','vec2<i32>'),EXACT_WIDE_SOURCE.replace('let a0','/*comment*/let a0'),'alias u32 = i32;'+EXACT_WIDE_SOURCE,'fn vec2()->u32{return 0u;}'+EXACT_WIDE_SOURCE,EXACT_WIDE_SOURCE+EXACT_WIDE_SOURCE])assert.throws(()=>compile(altered+main));
assert.throws(()=>compileMicrocodeWGSL(EXACT_WIDE_SOURCE+main,{exactWide:true}));
const runtime=c=>({...c,functions:c.functions.filter(f=>f.name==='main')});validateIntegerProgramStructure(runtime(candidate));
const ip=candidate.instructions.findIndex((v,i)=>i%8===0&&v===ISA.opcodes.WIDE_U32);assert(ip>=0);
for(const [field,value] of [[1,candidate.localWords-1],[2,candidate.localWords],[3,candidate.localWords],[4,1],[5,1],[6,1],[7,1]]){const bad={...candidate,instructions:candidate.instructions.slice()};bad.instructions[ip+field]=value;assert.throws(()=>validateIntegerProgram(bad));assert.throws(()=>validateIntegerProgramStructure(runtime(bad)));}
const source=residentSchedulerKernelWGSL();assert(source.includes(EXACT_WIDE_GPU_SOURCE));assert(source.includes('if(2u>localCount-dst)'));assert(source.includes('let ip=dispatchInfo[10u]+pc*5u;'));assert(source.includes('field<5u'));
const a=execute(original,0xffffffff,0xffffffff),b=execute(candidate,0xffffffff,0xffffffff);const receipt={scope:'HOST-only exact pure wide boundary and rejection tests; not GPU qualification',boundaryPairs:n,sourceHelperInstructions:original.functions[1].entryPc-original.functions[0].entryPc,candidateHelperInstructions:candidate.functions[1].entryPc-candidate.functions[0].entryPc,syntheticWholeFixtureSteps:{original:a.steps,candidate:b.steps},realPhysicsDynamicEvidence:false,gpuExecuted:false};fs.writeFileSync(new URL('../wide-host-receipt.json',import.meta.url),JSON.stringify(receipt,null,2));console.log(receipt);
// Source-work accounting contract: quantum admits only whole native operations.
// Test-only model checks unchanged PC/data on yield and checked u64 addition.
const {EXACT_WIDE_COST,MAX_CANONICAL_OPCODE_COST}=await import('../src/canonical-integer-transport/exact-wide-cost.mjs');
const {initialIntegerState}=await import('../src/canonical-integer-transport/integer-core.mjs');
assert.equal(EXACT_WIDE_COST.nativeCost,58);assert.equal(EXACT_WIDE_COST.originalReachableRows,59);
assert.equal(a.steps+1,b.steps+1+EXACT_WIDE_COST.nativeCost-1);
assert.throws(()=>initialIntegerState(validateIntegerProgram(candidate),{budget:57}));
assert.equal(initialIntegerState(validateIntegerProgram(candidate),{budget:58})[14],58);
assert(source.includes('if(cost>instructionBudget-step){break;}'));
assert(source.includes('state[base+7u]==0xffffffffu&&state[base+6u]>0xffffffffu-cost'));
assert(source.indexOf('if(cost>instructionBudget-step){break;}')<source.indexOf('switch op{'));
assert(source.includes('state[base+6u]+=cost;'));
assert(source.includes('step+=cost;'));
const U64=(1n<<64n)-1n;
function admitCost({pc,low,high,used,budget,cost}){assert(budget>=MAX_CANONICAL_OPCODE_COST);if(cost>budget-used)return {status:'yield',pc,low,high,used};if(high===0xffffffff&&low>0xffffffff-cost)return {status:'overflow',pc,low,high,used};const next=(BigInt(high)<<32n)+BigInt(low)+BigInt(cost);return {status:'execute',pc:pc+1,low:Number(next&0xffffffffn),high:Number(next>>32n),used:used+cost};}
for(const used of [1,2,57,58]){const s={pc:7,low:123,high:0,used,budget:58,cost:58};assert.deepEqual(admitCost(s),{status:'yield',pc:7,low:123,high:0,used});}
for(const count of [0n,0xffffffffn-58n,0xffffffffn,1n<<32n,U64-58n,U64-57n,U64]){const s={pc:7,low:Number(count&0xffffffffn),high:Number(count>>32n),used:0,budget:58,cost:58},actual=admitCost(s);if(count>U64-58n){assert.equal(actual.status,'overflow');assert.equal(actual.pc,s.pc);assert.equal(actual.low,s.low);}else{assert.equal(actual.status,'execute');assert.equal((BigInt(actual.high)<<32n)+BigInt(actual.low),count+58n);}}
receipt.weightedSourceSteps={original:a.steps+1,candidate:b.steps+1+57};receipt.costCertificate=EXACT_WIDE_COST;receipt.weightedBudgetYieldAndOverflowHostTests=true;fs.writeFileSync(new URL('../wide-host-receipt.json',import.meta.url),JSON.stringify(receipt,null,2));console.log({weightedSourceSteps:receipt.weightedSourceSteps,weightedBudgetYieldAndOverflowHostTests:true});
