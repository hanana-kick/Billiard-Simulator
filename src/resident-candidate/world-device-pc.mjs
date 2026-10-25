/* SPDX-License-Identifier: Apache-2.0
 * Experimental transport of the immutable source h schedule. Numerical owners
 * are NEVER called from the PC interpreter: one ordinary phase dispatch calls
 * its unchanged source entry once, then advances only integer control. A
 * repeat may be omitted only under its owner's explicit no-op proof, or when
 * every descendant original entry guard is false. No source capacity changes.
 */
import {linkResidentWGSL} from './wgsl-linker.mjs';

export const WORLD_DEVICE_PC=Object.freeze({magic:0x52435043,version:1,headerWords:16,frameWords:4,
 status:Object.freeze({uninitialized:0,ready:1,complete:2,worldTerminal:3,invalid:4}),
 header:Object.freeze({magic:0,version:1,pc:2,depth:3,status:4,initialH:5,requestedH:6,completedH:7,calls:8,skippedCalls:9,skippedRepeats:10,transitions:11,lastPipeline:12,error:13,dispatchVisits:14,reserved1:15}),
 opcode:Object.freeze({call:1,repeat:2,endRepeat:3,endH:4}),
 capability:Object.freeze({optIn:true,defaultBackend:false,hostStateReadback:false,sourceCapsUnchanged:true,nativeQualified:false,fullRestQualified:false})});
const U=0xffffffff;
const uint=(x,name,max=U)=>{if(!Number.isSafeInteger(x)||x<0||x>max)throw new RangeError(name+' must be a bounded unsigned integer');return x;};
const normalize=x=>x.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s+/g,'');
function functions(code){
 const masked=code.replace(/\/\*[\s\S]*?\*\//g,s=>s.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,s=>' '.repeat(s.length)),rows=[];
 for(const match of masked.matchAll(/\bfn\s+(\w+)\s*\(/g)){const brace=masked.indexOf('{',match.index);let end=brace+1,depth=1;for(;end<masked.length&&depth;end++){if(masked[end]==='{')depth++;else if(masked[end]==='}')depth--;}if(depth)throw new SyntaxError('Unclosed source WGSL function');rows.push({name:match[1],code:code.slice(match.index,end)});}
 return rows;
}
function renameEntry(code){
 const rows=functions(code),entry=rows.find(x=>x.name==='main');if(!entry)throw new RangeError('Original phase compute main required');
 const signature=entry.code.slice(0,entry.code.indexOf('{'));
 if(!/^fn\s+main\s*\(\s*@builtin\(global_invocation_id\)\s+gid\s*:\s*vec3<u32>\s*\)\s*$/.test(signature))throw new RangeError('Only the original single-gid WG1 phase ABI is admitted');
 const at=code.indexOf(entry.code),before=code.slice(0,at),attribute=/@compute\s+@workgroup_size\(1\)\s*$/.exec(before);
 if(!attribute)throw new RangeError('Original one-candidate WG1 phase is required');
 return code.slice(0,attribute.index)+entry.code.replace(signature,'fn rc_pc_source_stage(gid:vec3<u32>)')+code.slice(at+entry.code.length);
}
function originalGuard(p){const value=p.devicePc?.guard??p.entryGuard;if(typeof value!=='string'||!value.trim())throw new TypeError('Every phase needs its exact original entry guard');return value;}
function sourceNoOp(p){const value=p.sourceNoOp;if(value===undefined)return null;if(typeof value?.skip!=='string'||!value.skip.trim()||typeof value?.proof!=='string'||!value.proof.trim())throw new TypeError('Source no-op skip requires a nonempty predicate and explicit proof');return Object.freeze({skip:value.skip,proof:value.proof});}
function repeatSkip(s){const value=s.devicePc?.skip??(s.continueGuard?`!(${s.continueGuard})`:null);if(value!==null&&(!s.devicePc?.proof&&!s.noOpProof))throw new TypeError('Repeat skip requires an explicit source no-op proof');return value;}
function sequenceStats(steps){let first=null,last=null,calls=0n,back=0n;for(const step of steps){let x;if(Number.isInteger(step.pipeline))x={first:step.pipeline,last:step.pipeline,calls:1n,back:0n};else{const b=sequenceStats(step.steps),n=BigInt(step.repeat);x={first:b.first,last:b.last,calls:b.calls*n,back:b.back*n+(b.first!==null&&b.first<=b.last?n-1n:0n)};}if(x.first===null)continue;if(last!==null&&x.first<=last)back++;first??=x.first;last=x.last;calls+=x.calls;back+=x.back;}return{first,last,calls,back};}

/** programBase is a WORD offset in existing rc_program. controlTailBase is a
 * WORD offset after all candidate banks AND the shared fixed-CCD tail. The
 * caller appends bytecode/state, preserving the original five bindings.
 * A finite number of sweeps is transport work, not a physics/horizon cap: a
 * ready cursor after those sweeps is incomplete and must never publish MISS.
 */
export function compileWorldDevicePc(plan,{programBase,controlTailBase,maxH=2,maxLoopDepth=16}={}){
 if(plan?.kind!=='resident-source-world-h-plan')throw new TypeError('Original immutable whole-h plan required');
 uint(programBase,'programBase');uint(controlTailBase,'controlTailBase');uint(maxH,'maxH');uint(maxLoopDepth,'maxLoopDepth',64);if(!maxH||!maxLoopDepth)throw new RangeError('Positive h request and stack capacity required');
 if(controlTailBase<plan.count*plan.stateWords+plan.fixedTailWords)throw new RangeError('PC tail must not overlap any candidate or shared fixed-CCD word');
 const controlWords=16+4*maxLoopDepth,totalStateWords=controlTailBase+plan.count*controlWords;uint(totalStateWords,'totalStateWords');
 const originalEntryGuards=plan.pipelines.map(originalGuard),sourceNoOpProofs=plan.pipelines.map(sourceNoOp),guards=originalEntryGuards.map((g,i)=>sourceNoOpProofs[i]?`(${g})&&!(${sourceNoOpProofs[i].skip})`:g),rows=[],repeats=[];let depthUsed=0;
 const walk=(steps,depth=0)=>{if(!Array.isArray(steps))throw new TypeError('Immutable source steps required');for(const step of steps){if(Number.isInteger(step.pipeline)){uint(step.pipeline,'pipeline',plan.pipelines.length-1);rows.push([1,step.pipeline,0,0]);continue;}uint(step.repeat,'repeat');if(!step.repeat||!step.steps?.length)throw new RangeError('Positive nonempty source repeat required');depthUsed=Math.max(depthUsed,depth+1);if(depthUsed>maxLoopDepth)throw new RangeError('Exact source repeat depth exceeds allocated PC stack');const pc=rows.length,skip=repeatSkip(step),ids=new Set();const visit=ss=>{for(const s of ss)if(Number.isInteger(s.pipeline))ids.add(s.pipeline);else visit(s.steps);};visit(step.steps);const index=repeats.length;repeats.push({pc,skip,pipelines:[...ids],proof:step.devicePc?.proof??step.noOpProof??'all descendant original entry guards false; no call can mutate state'});rows.push([2,step.repeat,0,index]);walk(step.steps,depth+1);const end=rows.length;rows.push([3,pc,pc+1,0]);rows[pc][2]=end;}};walk(plan.schedule);rows.push([4,0,0,0]);
 const bytecode=Uint32Array.from(rows.flat());uint(programBase+bytecode.length,'program end');
 // Predicate helpers are extracted only from named closures. Other stage
 // variants (e.g. rc_world_geometry_stage) are not imported or merged.
 const pool=new Map();for(const p of plan.pipelines)for(const f of functions(p.code)){const prior=pool.get(f.name)??[];prior.push(f.code);pool.set(f.name,prior);}
 const predicateExpressions=[...guards,...repeats.flatMap(x=>x.skip?[x.skip]:[])],todo=predicateExpressions.flatMap(x=>[...x.matchAll(/\b(\w+)\s*\(/g)].map(m=>m[1])),seen=new Set(),predicateHelpers=[];
 while(todo.length){const name=todo.pop();if(seen.has(name)||!pool.has(name))continue;seen.add(name);const candidates=pool.get(name);if(candidates.some(x=>normalize(x)!==normalize(candidates[0])))throw new RangeError('Conflicting PC predicate helper '+name);predicateHelpers.push(candidates[0]);todo.push(...[...candidates[0].matchAll(/\b(\w+)\s*\(/g)].map(m=>m[1]));}
 const guardCases=guards.map((g,i)=>`case ${i}u:{return ${g};}`).join('\n');
 const skipCases=repeats.map((r,i)=>`case ${i}u:{return ${r.skip?`(${r.skip})||`:''}(${[...new Set(r.pipelines.map(id=>guards[id]))].map(g=>`!(${g})`).join('&&')});}`).join('\n');
 const transitionLimit=rows.length*2+maxLoopDepth+4;
 const controller=`
fn rc_pc_guard(bank:u32,scratch:u32,id:u32)->bool{switch id{${guardCases}default:{return false;}}}
fn rc_pc_skip(bank:u32,scratch:u32,id:u32)->bool{switch id{${skipCases}default:{return false;}}}
fn rc_pc_fail(cb:u32,why:u32){rc_state[cb+4u]=4u;rc_state[cb+13u]=why;}
fn rc_pc_terminal(bank:u32,cb:u32){let expected=rc_state[cb+5u]+rc_state[cb+7u];let actual=rc_state[bank+5u];if(actual==expected+1u){rc_state[cb+7u]++;}else if(actual!=expected){rc_pc_fail(cb,1u);return;}rc_state[cb+4u]=3u;}
fn rc_pc_advance(bank:u32,scratch:u32,cb:u32){
 if(rc_state[cb+4u]!=1u){return;}
 if(rc_state[bank+2u]!=1u){rc_pc_terminal(bank,cb);return;}
 for(var transition=0u;transition<${transitionLimit}u;transition++){
  let pc=rc_state[cb+2u];if(pc>=${rows.length}u){rc_pc_fail(cb,2u);return;}
  let ip=${programBase}u+pc*4u;let op=rc_program[ip];rc_state[cb+11u]++;
  switch op{
   case 1u:{let id=rc_program[ip+1u];if(id>=${plan.pipelines.length}u){rc_pc_fail(cb,3u);return;}if(rc_pc_guard(bank,scratch,id)){return;}rc_state[cb+9u]++;rc_state[cb+2u]=pc+1u;}
   case 2u:{let end=rc_program[ip+2u];if(end<=pc||end>=${rows.length}u||rc_program[ip+1u]==0u){rc_pc_fail(cb,4u);return;}if(rc_pc_skip(bank,scratch,rc_program[ip+3u])){rc_state[cb+10u]++;rc_state[cb+2u]=end+1u;}else{let depth=rc_state[cb+3u];if(depth>=${maxLoopDepth}u){rc_pc_fail(cb,5u);return;}let frame=cb+16u+depth*4u;rc_state[frame]=pc;rc_state[frame+1u]=pc+1u;rc_state[frame+2u]=end;rc_state[frame+3u]=rc_program[ip+1u];rc_state[cb+3u]=depth+1u;rc_state[cb+2u]=pc+1u;}}
   case 3u:{let depth=rc_state[cb+3u];if(depth==0u){rc_pc_fail(cb,6u);return;}let frame=cb+16u+(depth-1u)*4u;let begin=rc_state[frame];if(rc_state[frame+2u]!=pc||begin!=rc_program[ip+1u]||rc_state[frame+1u]!=rc_program[ip+2u]||rc_state[frame+3u]==0u){rc_pc_fail(cb,7u);return;}let rp=${programBase}u+begin*4u;if(rc_state[frame+3u]==1u||rc_pc_skip(bank,scratch,rc_program[rp+3u])){if(rc_state[frame+3u]>1u){rc_state[cb+10u]++;}rc_state[cb+3u]=depth-1u;rc_state[cb+2u]=pc+1u;}else{rc_state[frame+3u]--;rc_state[cb+2u]=rc_state[frame+1u];}}
   case 4u:{if(rc_state[cb+3u]!=0u||rc_state[bank+5u]!=rc_state[cb+5u]+rc_state[cb+7u]+1u){rc_pc_fail(cb,8u);return;}rc_state[cb+7u]++;if(rc_state[cb+7u]==rc_state[cb+6u]){rc_state[cb+4u]=2u;return;}rc_state[cb+2u]=0u;}
   default:{rc_pc_fail(cb,9u);return;}
  }
 }
 rc_pc_fail(cb,10u);
}
`;
 const common=`if(gid.x>=${plan.count}u){return;}let bank=gid.x*${plan.stateWords}u;let scratch=gid.x*${plan.scratchWords}u;let cb=${controlTailBase}u+gid.x*${controlWords}u;`;
 const bindings=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(2) var<storage,read> rc_geometry:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;@group(0) @binding(4) var<storage,read> rc_inputs:array<u32>;`;
 const begin=linkResidentWGSL([bindings,...predicateHelpers,controller,`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){${common}for(var i=0u;i<${controlWords}u;i++){rc_state[cb+i]=0u;}rc_state[cb]=${WORLD_DEVICE_PC.magic}u;rc_state[cb+1u]=1u;rc_state[cb+4u]=1u;rc_state[cb+5u]=rc_state[bank+5u];rc_state[cb+6u]=${maxH}u;rc_state[cb+12u]=0xffffffffu;rc_pc_advance(bank,scratch,cb);}`]);
 const pipelines=plan.pipelines.map((p,id)=>{const entry=`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){${common}if(rc_state[cb]!=${WORLD_DEVICE_PC.magic}u||rc_state[cb+1u]!=1u||rc_state[cb+4u]!=1u){return;}rc_state[cb+14u]++;let pc=rc_state[cb+2u];if(pc>=${rows.length}u){rc_pc_fail(cb,2u);return;}let ip=${programBase}u+pc*4u;if(rc_program[ip]!=1u||rc_program[ip+1u]!=${id}u){return;}rc_pc_source_stage(gid);rc_state[cb+8u]++;rc_state[cb+12u]=${id}u;rc_state[cb+2u]=pc+1u;rc_pc_advance(bank,scratch,cb);}`;const linked=linkResidentWGSL([renameEntry(p.code),...predicateHelpers,controller,entry]);return Object.freeze({name:'device-pc-'+p.name,code:linked.code,functions:linked.functions,sourcePipeline:id});});
 const stats=sequenceStats(plan.schedule),worstCaseSweeps=stats.back*BigInt(maxH)+(stats.first<=stats.last?BigInt(maxH-1):0n)+1n;
 return Object.freeze({kind:'resident-world-device-pc',capability:WORLD_DEVICE_PC.capability,count:plan.count,stateWords:plan.stateWords,scratchWords:plan.scratchWords,programBase,controlTailBase,controlWords,totalStateWords,maxH,maxLoopDepth,depthUsed,bytecode,instructions:rows.length,repeatProofs:Object.freeze(repeats),entryGuards:Object.freeze(guards),originalEntryGuards:Object.freeze(originalEntryGuards),sourceNoOpProofs:Object.freeze(sourceNoOpProofs),begin:Object.freeze({name:'device-pc-begin',code:begin.code,functions:begin.functions}),pipelines:Object.freeze(pipelines),sweep:Object.freeze(pipelines.map((_,i)=>i)),bindingTypes:plan.bindingTypes,sourceCallsPerH:stats.calls.toString(),worstCaseSweeps:worstCaseSweeps.toString(),transitionLimit});
}

/** Fixed host work only. Insufficient sweeps leave status READY, never MISS. */
export function* worldDevicePcCommands(compiled,{sweeps,includeBegin=true}={}){if(compiled?.kind!=='resident-world-device-pc')throw new TypeError('Compiled source PC plan required');uint(sweeps,'sweeps');if(includeBegin)yield-1;for(let i=0;i<sweeps;i++)yield* compiled.sweep;}

/** TEST ONLY packed PC reference. Callbacks independently model source stages
 * and exact predicates; no host reference is used by the production driver. */
export function createWorldDevicePcReferenceForTest(compiled,state,{testOnly=false,guard,skip=()=>false,call}={}){
 if(!testOnly||!(state instanceof Uint32Array)||typeof guard!=='function'||typeof call!=='function')throw new TypeError('Explicit test-only packed state and source callbacks required');
 const p=compiled,B=p.bytecode,H=WORLD_DEVICE_PC.header,status=WORLD_DEVICE_PC.status;
 const fail=(cb,why)=>{state[cb+H.status]=status.invalid;state[cb+H.error]=why;};
 const cbFor=c=>p.controlTailBase+c*p.controlWords;
 const pureSkip=(id,c)=>skip(id,c)||p.repeatProofs[id].pipelines.every(x=>!guard(x,c));
 function advance(c){const cb=cbFor(c),bank=c*stateWords;if(state[cb+4]!==1)return;if(state[bank+2]!==1){const expected=(state[cb+5]+state[cb+7])>>>0,actual=state[bank+5];if(actual===((expected+1)>>>0))state[cb+7]++;else if(actual!==expected){fail(cb,1);return;}state[cb+4]=3;return;}for(let k=0;k<p.transitionLimit;k++){const pc=state[cb+2],ip=pc*4;if(pc>=p.instructions){fail(cb,2);return;}state[cb+11]++;switch(B[ip]){case 1:{const id=B[ip+1];if(id>=p.pipelines.length){fail(cb,3);return;}if(guard(id,c))return;state[cb+9]++;state[cb+2]=pc+1;break;}case 2:{const end=B[ip+2];if(end<=pc||end>=p.instructions||!B[ip+1]){fail(cb,4);return;}if(pureSkip(B[ip+3],c)){state[cb+10]++;state[cb+2]=end+1;}else{const d=state[cb+3];if(d>=p.maxLoopDepth){fail(cb,5);return;}const f=cb+16+d*4;state.set([pc,pc+1,end,B[ip+1]],f);state[cb+3]=d+1;state[cb+2]=pc+1;}break;}case 3:{const d=state[cb+3];if(!d){fail(cb,6);return;}const f=cb+16+(d-1)*4,b=state[f];if(state[f+2]!==pc||b!==B[ip+1]||state[f+1]!==B[ip+2]||!state[f+3]){fail(cb,7);return;}if(state[f+3]===1||pureSkip(B[b*4+3],c)){if(state[f+3]>1)state[cb+10]++;state[cb+3]=d-1;state[cb+2]=pc+1;}else{state[f+3]--;state[cb+2]=state[f+1];}break;}case 4:if(state[cb+3]!==0||state[bank+5]!==((state[cb+5]+state[cb+7]+1)>>>0)){fail(cb,8);return;}state[cb+7]++;if(state[cb+7]===state[cb+6]){state[cb+4]=2;return;}state[cb+2]=0;break;default:fail(cb,9);return;}}fail(cb,10);}
 // The candidate bank stride is retained explicitly in the compiled ABI.
 const stateWords=p.stateWords;
 return{begin(c){const cb=cbFor(c),bank=c*stateWords;state.fill(0,cb,cb+p.controlWords);state[cb]=WORLD_DEVICE_PC.magic;state[cb+1]=1;state[cb+4]=1;state[cb+5]=state[bank+5];state[cb+6]=p.maxH;state[cb+12]=U;advance(c);},phase(c,id){const cb=cbFor(c);if(state[cb]!==WORLD_DEVICE_PC.magic||state[cb+1]!==1||state[cb+4]!==1)return;state[cb+14]++;const pc=state[cb+2];if(pc>=p.instructions){fail(cb,2);return;}if(B[pc*4]!==1||B[pc*4+1]!==id)return;call(id,c);state[cb+8]++;state[cb+12]=id;state[cb+2]=pc+1;advance(c);},advance,control(c){return state.slice(cbFor(c),cbFor(c)+p.controlWords);}};
}
