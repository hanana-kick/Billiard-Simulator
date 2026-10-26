// TEST/ANALYSIS ONLY: source-level generated accesses, NOT measured GPU traffic.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
const unary=new Set(['MOV','NOT','LNOT','INEG','FNEG','UCLZ','UCTZ','POPCOUNT','FABS','FSQRT','FLOOR','CEIL','TRUNC','ROUND','UTOF','ITOF','FTOU','FTOI']);
const binary=new Set(['UADD','USUB','UMUL','UDIV','UREM','IADD','ISUB','IMUL','IDIV','IREM','FADD','FSUB','FMUL','FDIV','AND','OR','XOR','SHL','USHR','ISHR','EQ','NE','ULT','ULE','UGT','UGE','ILT','ILE','IGT','IGE','FEQ','FNE','FLT','FLE','FGT','FGE','FMIN','FMAX']);
export function requiredVmLocalOperands(name){return unary.has(name)?['a']:binary.has(name)?['a','b']:({SELECT:['a','b','c'],GUARD:['a'],BRANCH:['a'],LOCAL_LOAD:['a'],LOCAL_STORE:['a','b'],LOAD:['b'],STORE:['b','c']})[name]??[];}
export function auditMicrocodeLocalReads(data,{localWords}){
 const code=data.instructions,counts=data.pcCounters;assert.ok(code instanceof Uint32Array&&counts instanceof Uint32Array&&code.length===counts.length*8);assert.ok(Number.isSafeInteger(localWords)&&localWords>0);assert.equal(createHash('sha256').update(code).digest('hex'),data.bytecodeSha256);
 let before=0,after=0,total=0;const perOpcode={};for(let pc=0;pc<counts.length;pc++){const n=counts[pc],name=I.names[code[pc*8]];assert.ok(name);const required=requiredVmLocalOperands(name),read=[2,3,4].reduce((sum,i)=>sum+ +(code[pc*8+i]<localWords),0);if(n)for(const key of required)assert.ok(code[pc*8+{a:2,b:3,c:4}[key]]<localWords,'successful original local operand');before+=n*read;after+=n*required.length;total+=n;perOpcode[name]=(perOpcode[name]??0)+n*(read-required.length);}
 return{bytecodeSha256:data.bytecodeSha256,totalInstructions:total,localWords,generatedLocalReadsBefore:before,generatedLocalReadsAfter:after,generatedReadsAvoided:before-after,perOpcode,notMeasuredMemoryTraffic:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){assert.ok(process.argv[2]&&process.argv[3],'explicit diagnostic sidecar and exact localWords required');console.log(JSON.stringify(auditMicrocodeLocalReads(deserialize(readFileSync(process.argv[2])),{localWords:Number(process.argv[3])}),null,2));}
