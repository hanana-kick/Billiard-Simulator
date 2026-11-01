/** Build-time-only certificate verification. No host physics result production.
 * Full original body bytes are pinned, then CFG longest paths are calculated.
 * Single natural loop has immutable i32 induction 31..0, no calls/storage.
 */
import {createHash} from '../resident-candidate/source-sha256.mjs';
import {CANONICAL_MICROCODE_ISA as ISA} from './isa.mjs';
import {EXACT_DIVIDE_SOURCE} from './exact-divide-source.mjs';
import {EXACT_DIVIDE_COST as C} from './exact-divide-cost.mjs';
let verified;
const fail=m=>{throw Error('Exact divideWide cost certificate: '+m);},sha=x=>createHash('sha256').update(x).digest('hex');
export function verifyExactDivideCost(compile){
 if(verified)return verified;
 const source=EXACT_DIVIDE_SOURCE+'\n@group(0) @binding(0) var<storage,read_write> certificateOutput:array<u32>; @compute @workgroup_size(1) fn main(){let r=divideWide(certificateOutput[0],certificateOutput[1],certificateOutput[2]);certificateOutput[0]=r.x;certificateOutput[1]=r.y;certificateOutput[2]=r.z;}';
 const c=compile(source,{sourceStoragePolicy:[{name:'certificateOutput',binding:0,scalar:'u32',access:'read_write'}]}),f=c.functions.find(x=>x.name==='divideWide'),end=c.functions.find(x=>x.name==='main').entryPc,words=c.instructions.slice(f.entryPc*8,end*8),rows=Array.from({length:words.length/8},(_,i)=>[...words.subarray(i*8,i*8+8)]);
 if(words.length/8!==C.staticRows||sha(words)!==C.baselineRowsSHA256||sha(EXACT_DIVIDE_SOURCE)!==C.sourceSHA256)fail('body/source fingerprint');
 if(f.params.map(x=>x.slot).join(',')!=='0,1,2'||f.returnSlot!==3||f.returnWords!==3)fail('fixed baseline signature/slots');
 const pure=new Set(['MOV','SET','EQ','UGE','IGE','USHR','SHL','AND','OR','NE','USUB','ISUB','BRANCH','JUMP','RET']);
 for(const r of rows)if(!pure.has(ISA.names[r[0]]))fail('impure/unsupported opcode');
 const edges=rows.map(r=>{const name=ISA.names[r[0]];return name==='RET'?[]:name==='JUMP'?[r[2]-f.entryPc]:name==='BRANCH'?[r[3]-f.entryPc,r[4]-f.entryPc]:null;}).map((e,i)=>e??[i+1]);
 for(const e of edges)if(e.some(n=>n<0||n>=rows.length))fail('edge outside body');
 const seen=new Set();function reach(i){if(seen.has(i))return;seen.add(i);edges[i].forEach(reach);}reach(0);
 const backs=[...seen].flatMap(i=>edges[i].filter(j=>j<=i).map(j=>[i,j]));if(JSON.stringify(backs)!==JSON.stringify([[C.loopBackedge,C.loopHeader]]))fail('unique loop backedge');
 // These row identities pin initial value, condition, decrement and every write
 // to the induction slot. Source literal independently fixes the same for-loop.
 const expect=(i,name,...operands)=>{if(ISA.names[rows[i][0]]!==name||operands.some((v,j)=>rows[i][j+1]!==v))fail('induction row '+i);};
 expect(26,'SET',24,31);expect(27,'MOV',25,24);expect(28,'MOV',26,25);expect(29,'SET',27,0);expect(30,'IGE',28,26,27);expect(31,'BRANCH',0,28,32+f.entryPc,74+f.entryPc);expect(69,'MOV',59,25);expect(70,'SET',60,1);expect(71,'ISUB',61,59,60);expect(72,'MOV',25,61);expect(73,'JUMP',0,28+f.entryPc);
 const bitWrites=rows.flatMap((r,i)=>!['JUMP','BRANCH','RET'].includes(ISA.names[r[0]])&&r[1]===25?[i]:[]);if(bitWrites.join(',')!=='27,72'||C.loopIterations!==32)fail('induction mutated outside one decrement');
 for(const i of seen)if(i>=28&&i<=73&&edges[i].some(j=>(j<28||j>73)&&!(i===31&&j===74)))fail('extra loop exit');
 function maxPath(start,{stopBefore=-1,stopAfter=-1,decisions={}}={}){const pending=new Set(),memo=new Map();function visit(i){if(i===stopBefore)return 0;if(i===stopAfter)return 1;if(memo.has(i))return memo.get(i);if(pending.has(i))fail('unbounded CFG cycle');pending.add(i);let next=edges[i];if(Object.hasOwn(decisions,i)){if(ISA.names[rows[i][0]]!=='BRANCH')fail('decision is not branch');next=[next[decisions[i]?0:1]];}const cost=1+(next.length?Math.max(...next.map(visit)):0);pending.delete(i);memo.set(i,cost);return cost;}return visit(start);}
 const zero=maxPath(0,{decisions:{4:true,9:true}}),overflow=maxPath(0,{decisions:{4:false,9:true}}),prefix=maxPath(0,{stopBefore:28,decisions:{4:false,9:false}}),iteration=maxPath(28,{stopAfter:73,decisions:{31:true}}),exit=maxPath(28,{decisions:{31:false}}),validMaximum=prefix+C.loopIterations*iteration+exit;
 if(zero!==C.zeroCost+1||overflow!==C.overflowCost+1||validMaximum!==C.validCost+1)fail('derived path costs differ');
 verified=Object.freeze({zero,overflow,prefix,iteration,exit,iterations:C.loopIterations,validMaximum,reachableRows:seen.size,unreachableRows:rows.length-seen.size,backedges:Object.freeze(backs.map(Object.freeze)),validCharge:'conservative original-bytecode upper bound; not exact diagnostics'});return verified;
}
