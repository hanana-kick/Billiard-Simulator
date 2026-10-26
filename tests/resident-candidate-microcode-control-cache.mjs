// HOST transport differential proof. This is not a native numerical gate.
import test from 'node:test';import assert from 'node:assert/strict';
import {MICROCODE_ISA as I,microcodeInstruction as ins} from '../src/resident-candidate/microcode-isa.mjs';
import {createMicrocodeVmReferenceForTest as storage,createMicrocodeCachedVmReferenceForTest as cached,generateMicrocodeVmWGSL,generateMicrocodeExternalWGSL} from '../src/resident-candidate/microcode-vm.mjs';
import {MICROCODE_CACHED_CONTROL_FIELDS as fields} from '../src/resident-candidate/microcode-control-cache.mjs';
import {MICROCODE_SOURCE_MACROS as M,sourceMacroNativeWGSL,approveSourceMacros} from '../src/resident-candidate/microcode-source-macros.mjs';
import {requiredVmLocalOperands} from './resident-candidate-microcode-memory-access-audit.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
const C=I.control,S=I.status,code=(...rows)=>Uint32Array.from(rows.flatMap(x=>[...x])),bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
function pair(instructions,options={}){const common={testOnly:true,code:instructions,localWords:32,stackCapacity:4,...options},a=storage({...common,...(options.state?{state:options.state.slice()}:{}),...(options.bindings?{bindings:options.bindings.map(x=>x.slice())}:{})}),b=cached({...common,controlMode:'invocation-cache-v1',vmStateDisjoint:true,...(options.state?{state:options.state.slice()}:{}),...(options.bindings?{bindings:options.bindings.map(x=>x.slice())}:{})});return{a,b};}
function equal(p,label){assert.deepEqual(p.b.state.slice(),p.a.state.slice(),label+' full control/locals/stack');assert.deepEqual(p.b.bindings,p.a.bindings,label+' all source buffers');}
function complete(instructions,options={}){for(const budget of[1,2,3,7,64]){const p=pair(instructions,options);for(let lane=0;lane<(options.count??1);lane++){assert.equal(p.a.begin(lane),p.b.begin(lane));for(let n=0;n<256;n++){const status=p.a.advance(lane,budget);assert.equal(p.b.advance(lane,budget),status);equal(p,'budget '+budget+' lane '+lane+' boundary '+n);if(status!==S.ready)break;if(n===255)throw Error('bounded diagnostic did not terminate');}}}}
function functionText(source,name){const start=source.indexOf('fn '+name+'('),open=source.indexOf('{',start);assert.ok(start>=0);let end=open+1,depth=1;for(;depth;end++)depth+=+(source[end]==='{')-+(source[end]==='}');return source.slice(start,end);}

test('cached control is explicit, nonaliasing, and default storage shaders remain unchanged',()=>{
 const options={localWords:32,instructionCount:64};assert.equal(generateMicrocodeVmWGSL(options),generateMicrocodeVmWGSL({...options,controlMode:'storage-v1',vmStateDisjoint:true}));for(const extra of[{controlMode:'invocation-cache-v1'},{vmStateDisjoint:true},{controlMode:'unknown',vmStateDisjoint:true},{controlMode:null,vmStateDisjoint:true},{controlMode:undefined,vmStateDisjoint:true},{controlMode:'invocation-cache-v1',vmStateDisjoint:false}])assert.throws(()=>generateMicrocodeVmWGSL({...options,...extra}),/contract|control mode/);
 const instructions=code(ins('HALT')),state=new Uint32Array(52),bindings=[new Uint32Array(state.buffer,0,1),...Array.from({length:4},()=>new Uint32Array(1))];assert.throws(()=>cached({testOnly:true,code:instructions,localWords:32,stackCapacity:4,state,bindings,controlMode:'invocation-cache-v1',vmStateDisjoint:true}),/alias/);assert.throws(()=>cached({code:instructions,localWords:32,controlMode:'invocation-cache-v1',vmStateDisjoint:true}),/TEST ONLY/);
});

test('every scalar arithmetic opcode has identical control, local and stack words at every original budget boundary',()=>{
 const special=new Set(['HALT','SET','LOAD','STORE','LENGTH','LOCAL_LOAD','LOCAL_STORE','JUMP','BRANCH','CALL','RET','GUARD','EXTERNAL_CALL']);
 for(const name of I.names){if(special.has(name)||name.startsWith('F64_')||name.startsWith('NUM_')||name==='SOURCE_PROGRAM_INSTRUCTION')continue;const args=requiredVmLocalOperands(name),floating=name.startsWith('F')&&!['FTOU','FTOI'].includes(name)||['FTOU','FTOI','FLOOR','CEIL','TRUNC','ROUND'].includes(name),a=floating?bits(1.5):7,b=floating?bits(2.25):3;complete(code(ins('SET',0,a),ins('SET',1,b),ins('SET',2,1),ins(name,3,...args.map((x)=>({a:0,b:1,c:2}[x]))),ins('HALT')));}
});

test('nested CALL/RET, storage/local addressing and untouched dirty slots preserve each yielded prefix',()=>{
 complete(code(ins('SET',0,5),ins('CALL',0,6),ins('MOV',1,0),ins('CALL',0,6),ins('MOV',2,0),ins('RET'),ins('UADD',0,0,0),ins('RET')),{count:2,initialSlots:[{slot:31,candidateStride:1,value:77}]});
 complete(code(ins('SET',0,0),ins('SET',1,7),ins('SET',2,99),ins('LOCAL_STORE',0,1,2),ins('LOCAL_LOAD',3,1),ins('STORE',0,0,0,3),ins('LOAD',4,0,0),ins('LENGTH',5,4),ins('GUARD',0,4),ins('BRANCH',0,4,11,10),ins('HALT'),ins('JUMP',0,12),ins('HALT')));
 complete(code(ins('SET',0,0),ins('SET',1,73),ins('STORE',0,5,0,1),ins('LOAD',2,5,0),ins('HALT')),{eventAudit:true});
 const p=pair(code(ins('CALL',0,2),ins('HALT'),ins('RET')));p.a.begin();p.b.begin();p.a.advance(0,2);p.b.advance(0,2);equal(p,'committed RET flush');assert.ok(p.b.controlCacheStats().retFlushes>=1);
});

test('malformed, domain, counter and capacity boundaries flush the same successful prefix',()=>{
 const programs=[code(Uint32Array.of(999,0,0,0,0,0,0,0)),code(ins('SET',0,1,2)),code(ins('MOV',99,0)),code(ins('JUMP',0,999)),code(ins('BRANCH',0,0,999,999)),code(ins('CALL',0,0)),code(ins('SET',0,0),ins('GUARD',0,0)),code(ins('SET',0,1),ins('SET',1,0),ins('UDIV',2,0,1)),code(ins('SET',0,bits(-1)),ins('FTOU',1,0)),code(ins('STORE',0,1,0,0)),code(ins('SET',0,99),ins('LOCAL_LOAD',1,0))];for(const program of programs)complete(program,{stackCapacity:1});
 for(const[field,value]of[[C.magicWord,0],[C.versionWord,2],[C.entryPc,99],[C.status,0],[C.reservedStart,1],[C.pendingMacro,1],[C.sp,99],[C.pc,99]]){const p=pair(code(ins('HALT')));p.a.begin();p.b.begin();p.a.state[field]=p.b.state[field]=value;assert.equal(p.a.advance(),p.b.advance());equal(p,'malformed field '+field);}
 for(const budget of[1,2,3])for(const high of[2,0xffffffff]){const p=pair(code(ins('SET',0,1),ins('SET',1,2),ins('HALT')));p.a.begin();p.b.begin();for(const v of[p.a,p.b]){v.state[C.stepsLow]=0xfffffffe;v.state[C.stepsHigh]=high;}for(let i=0;i<4;i++){assert.equal(p.a.advance(0,budget),p.b.advance(0,budget));equal(p,'64-bit counter prefix '+budget+'/'+high);}}
 const yieldOverflow=pair(code(ins('JUMP',0,0)));for(const v of Object.values(yieldOverflow)){v.begin();v.state[C.yields]=0xffffffff;}assert.equal(yieldOverflow.a.advance(0,1),yieldOverflow.b.advance(0,1));equal(yieldOverflow,'yield overflow');
 const invalidRet=pair(code(ins('RET')));for(const v of Object.values(invalidRet)){v.begin();v.state[C.sp]=1;v.state[v.layout.stackOffset]=999;}assert.equal(invalidRet.a.advance(),invalidRet.b.advance());equal(invalidRet,'invalid RET');
});

const prefix='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;';
function macroDescriptor(spec,entryPc){return{id:spec.id,name:spec.name,entryPc,params:spec.parameterWords.map((words,slot)=>({slot,words})),returnSlot:spec.resultWords?12:0,returnWords:spec.resultWords,approval:approveSourceMacros(prefix+sourceMacroNativeWGSL(spec.name),{functionNames:[spec.name]}).entries[0]};}
test('external wait, wrong handler, duplicate handler and ordinary RET expose identical full state in both modes',()=>{
 for(const spec of M){const d=macroDescriptor(spec,2),program=code(ins('CALL',0,2),ins('HALT'),ins('EXTERNAL_CALL',0,d.id),ins('RET')),options={externalFunctions:[d]},p=pair(program,options),handler=(descriptor,args,{bindings})=>{bindings[0][0]=91;return Uint32Array.from({length:descriptor.returnWords},()=>2);};p.a.begin();p.b.begin();for(const budget of[1,2,64]){assert.equal(p.a.advance(0,budget),p.b.advance(0,budget));equal(p,'pending macro '+d.name);}assert.equal(p.a.serviceExternal(0,d.id,handler),p.b.serviceExternal(0,d.id,handler));equal(p,'serviced '+d.name);assert.equal(p.a.serviceExternal(0,d.id,()=>{throw Error('duplicate');}),p.b.serviceExternal(0,d.id,()=>{throw Error('duplicate');}));equal(p,'duplicate');assert.equal(p.a.advance(),p.b.advance());equal(p,'macro RET '+d.name);
  const common={localWords:32,instructionCount:4,externalFunctions:[d],macroId:d.id};assert.equal(generateMicrocodeExternalWGSL(common),generateMicrocodeExternalWGSL({...common,controlMode:'invocation-cache-v1',vmStateDisjoint:true}),'separate handler is byte-identical');
  for(const mutation of[v=>v.state[C.pendingMacro]=99,v=>v.state[C.pc]=1,v=>{v.state[C.stepsLow]=v.state[C.stepsHigh]=0xffffffff;}]){const q=pair(program,options);for(const v of[q.a,q.b]){v.begin();v.advance();mutation(v);}assert.equal(q.a.serviceExternal(0,d.id,handler),q.b.serviceExternal(0,d.id,handler));equal(q,'malformed external');}
 }
});

test('generated cache shader changes only seven control references and explicitly covers every exit and RET',()=>{
 for(const intrinsics of['none','source-f64-v1','source-numeric-v1','source-continuations-v1']){const p={localWords:32,instructionCount:64,instructionBudget:7,intrinsics},original=generateMicrocodeVmWGSL(p),shader=generateMicrocodeVmWGSL({...p,controlMode:'invocation-cache-v1',vmStateDisjoint:true});parseMicrocodeWGSL(shader);let step=functionText(shader,'rc_vm_step');assert.match(step,/if\(op==11u\)\{rc_vm_cache_store\(base,\*control\);\}/);step=step.replace('fn rc_vm_step(base:u32,control:ptr<function,RcMicroCachedControl>)->bool{','fn rc_vm_step(base:u32)->bool{').replaceAll('return rc_vm_cache_fail(control,','return rc_vm_fail(base,').replaceAll('rc_vm_cache_store(base,*control);','').replace('if(op==11u){}','');for(const{name,offset}of fields)step=step.replaceAll(`(*control).${name}`,`rc_vm_state[base+${offset}u]`);assert.equal(step,functionText(original,'rc_vm_step'),'all opcode guards/source/local/stack/control expressions unchanged');
  const main=functionText(shader,'main');assert.match(main,/if\(!rc_vm_step\(base,&control\)\)\{rc_vm_cache_store\(base,control\);return;\}/);assert.match(main,/rc_vm_cache_store\(base,control\);\n if\(rc_vm_state\[base\+8u\]/,'budget flush before yield-counter overflow');assert.equal(functionText(shader,'begin'),functionText(original,'begin'));assert.equal(functionText(shader,'rc_vm_external_valid'),functionText(original,'rc_vm_external_valid'));assert.doesNotMatch(functionText(shader,'rc_vm_cache_store'),/rc_state\[|rc_scratch\[|rc_vm_state\[base\+(?:1[0-9]|8)u\]/,'cache flush has no source/local/stack/pending/yield authority');
 }
 const d=macroDescriptor(M[1],2),shader=generateMicrocodeVmWGSL({localWords:32,instructionCount:4,externalFunctions:[d],controlMode:'invocation-cache-v1',vmStateDisjoint:true});assert.match(functionText(shader,'rc_vm_step'),/rc_vm_cache_store\(base,\*control\);if\(!rc_vm_external_valid\(base,aa\)\)/,'existing external validator receives fully materialized current prefix');
});


test('diagnostic observers see the current committed prefix through backing subarray views',()=>{
 const program=code(ins('SET',0,17),ins('CALL',0,3),ins('HALT'),ins('UADD',0,0,0),ins('RET')),snapshots=[[],[]];let a,b;
 const observer=(which,event)=>{const vm=which===0?a:b;snapshots[which].push({event,words:[...vm.state.subarray(0,vm.layout.totalWords)]});};
 const options={testOnly:true,code:program,localWords:32,stackCapacity:4};a=storage({...options,onCall:e=>observer(0,e),onReturn:e=>observer(0,e)});b=cached({...options,controlMode:'invocation-cache-v1',vmStateDisjoint:true,onCall:e=>observer(1,e),onReturn:e=>observer(1,e)});a.begin();b.begin();a.advance(0,64);b.advance(0,64);assert.deepEqual(snapshots[1],snapshots[0]);equal({a,b},'diagnostic callback boundaries');
});

test('every ISA operand mutation preserves full failure or yielded prefix, including disabled intrinsic opcodes',()=>{
 for(let opcode=0;opcode<I.names.length;opcode++)for(let operand=1;operand<8;operand++){
  const row=Uint32Array.of(opcode,0,0,0,0,0,0,0);row[operand]=32;
  for(const budget of[1,2,4]){const p=pair(code(ins('SET',0,19),row,ins('HALT')),{stackCapacity:1});p.a.begin();p.b.begin();for(let boundary=0;boundary<3;boundary++){assert.equal(p.a.advance(0,budget),p.b.advance(0,budget));equal(p,I.names[opcode]+' operand '+operand+' budget '+budget+' boundary '+boundary);}}
 }
});

test('generated main retains all pre-admission and post-budget validation outside the cached loop',()=>{
 const options={localWords:32,instructionCount:64,instructionBudget:7},original=generateMicrocodeVmWGSL(options),shader=generateMicrocodeVmWGSL({...options,controlMode:'invocation-cache-v1',vmStateDisjoint:true});
 const cacheLoop='var control=rc_vm_cache_load(base);\n for(var work=0u;work<7u;work++){if(!rc_vm_step(base,&control)){rc_vm_cache_store(base,control);return;}}\n rc_vm_cache_store(base,control);',storageLoop='for(var work=0u;work<7u;work++){if(!rc_vm_step(base)){return;}}';
 assert.equal(functionText(shader,'main').replace(cacheLoop,storageLoop),functionText(original,'main'),'invalid admission, waiting/terminal, code length and yield-overflow logic is unchanged');
});
