// HOST ONLY: source/address/schedule proofs, not a GPU or physics parity gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {composeRawMicrocodeSource,restoreRawMicrocodeStageSource,mapRawMicrocodeStageForTest} from '../src/resident-candidate/raw-microcode-source.mjs';
import {approveSourceIntrinsics} from '../src/resident-candidate/microcode-source-intrinsics.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
const sha=x=>createHash('sha256').update(typeof x==='string'?x:new Uint8Array(x.buffer,x.byteOffset,x.byteLength)).digest('hex');
let cached;
function fixture(){if(cached)return cached;const bytes=readFileSync('/tmp/resident-raw-pc-isolated-native-v2/runtime.v8');assert.equal(sha(bytes),'4f2db833f116034d5ffe979b0d748418b4022f26c8906e0ed5cb13cf15b878dc');const runtime=deserialize(bytes),composed=composeRawMicrocodeSource(runtime);return cached={runtime,composed};}

test('all nineteen authentic raw stages compose with reversible transport-only edits and the unchanged original call schedule',()=>{
 const {runtime:p,composed:m}=fixture();assert.equal(m.entries.length,19);assert.equal(m.originalInvocations,68313);assert.equal(m.schedule.length,2190);assert.equal(m.privateGlobals.length,15);assert.equal(m.capability.nativeQualified,false);assert.equal(m.capability.fullRestQualified,false);assert.equal(m.capability.sourceCapsUnchanged,true);assert.doesNotMatch(m.code,/@compute/);assert.match(m.code,/for\(var command=0u;command<1095u;command\+\+\)/);assert.match(m.code,/rc_micro_raw_reset_private\(\);switch stage/);
 for(const e of m.entries){assert.equal(e.sourceCode,p.init.stages[e.name].code);assert.equal(e.sourceSha256,sha(e.sourceCode));assert.equal(e.mappedSha256,sha(e.mappedCode));assert.equal(restoreRawMicrocodeStageSource(e.mappedCode,e.edits),e.sourceCode,'undo transport restores EVERY original byte');assert.ok(e.edits.every(x=>['binding-remap','logical-invocation-entry','logical-view-length','checked-logical-view-address','phase-adapter-name'].includes(x.kind)));assert.equal((e.mappedCode.match(new RegExp('fn '+e.entry+'\\(','g'))??[]).length,1);}
 const names=m.entries.map(x=>x.name);for(const [i,c]of p.init.commands.entries())assert.deepEqual(Array.from(m.schedule.slice(i*2,i*2+2)),[names.indexOf(c.stage),c.repeat]);
 assert.equal(p.init.commands.filter(x=>x.stage==='contact-gjk').reduce((n,x)=>n+x.repeat,0),60*3*256);assert.equal(p.init.commands.filter(x=>x.stage==='cast-cast').reduce((n,x)=>n+x.repeat,0),60*100);assert.equal(p.init.commands.filter(x=>x.stage==='cast-contact-gjk').reduce((n,x)=>n+x.repeat,0),60*256);
 assert.throws(()=>restoreRawMicrocodeStageSource(m.entries[0].mappedCode+' ',m.entries[0].edits.map((x,i)=>i===0?{...x,after:'changed'}:x)),/proof mismatch/);
});

test('all five VM bindings contain only exact initial inputs with nonoverlapping raw tails and readonly clone geometry',()=>{
 const {runtime:p,composed:m}=fixture(),l=m.layout,[state,program,geometry,scratch,inputs]=m.bindings;
 assert.deepEqual(l,{count:6,worldStateWords:379496,rawStateBase:379496,rawStateWords:12060,stateWords:391556,worldProgramWords:874992,rawProgramBase:874992,rawProgramWords:5071,scheduleBase:880063,scheduleWords:2190,worldGeometryWords:25408,rawGeometryBase:25408,rawGeometryWords:11368,templateBase:36776,templateWords:62990,scratchWords:81792,scratchStride:13632,rawStateStride:2010});
 assert.equal(l.rawStateBase,p.pc.requestTailBase+p.count*p.pc.requestWordsPerCandidate);assert.deepEqual(program.slice(0,l.rawProgramBase),p.program);assert.deepEqual(program.slice(l.rawProgramBase,l.scheduleBase),p.init.resources.rawProgram);assert.deepEqual(program.slice(l.scheduleBase),m.schedule);
 assert.deepEqual(geometry.slice(0,l.rawGeometryBase),p.sharedGeometry);assert.deepEqual(geometry.slice(l.rawGeometryBase,l.templateBase),p.init.resources.rawGeometry);assert.deepEqual(geometry.slice(l.templateBase),p.init.resources.worldTemplate);assert.deepEqual(inputs,p.input);assert.notEqual(inputs,p.input);
 const upload=p.init.initialUploads[0],copy=state.slice();assert.deepEqual(copy.slice(upload.offsetWords,upload.offsetWords+upload.data.length),upload.data);copy.fill(0,upload.offsetWords,upload.offsetWords+upload.data.length);assert.ok(copy.every(x=>x===0),'no created or future candidate state upload');assert.ok(scratch.every(x=>x===0));
 const transfer=m.entries.find(x=>x.name==='world-transfer');assert.equal(transfer.views.find(x=>x.resource==='worldTemplate').target,'rc_geometry');assert.equal(transfer.views.find(x=>x.resource==='worldTemplate').writable,false);assert.equal(transfer.views.find(x=>x.resource==='rawState').offset,l.rawStateBase);
 for(let row=0;row<p.count;row++){const begin=row*l.scratchStride,end=begin+l.scratchStride;assert.equal(end,(row+1)*l.scratchStride);assert.ok(end<=scratch.length);}
});

test('logical original lengths survive concatenation, and changed numeric helpers cannot masquerade as approved intrinsics',()=>{
 const {composed:m}=fixture(),evaluate=m.entries.find(x=>x.name==='creation-evaluate'),finish=m.entries.find(x=>x.name==='creation-finish');
 assert.deepEqual(evaluate.logicalLengthNames,['rc_program','rc_scratch']);assert.ok(evaluate.edits.some(e=>e.kind==='logical-view-length'&&e.before==='arrayLength(&rc_program)'&&e.after==='874992u'));assert.ok(finish.edits.some(e=>e.kind==='logical-view-length'&&e.before==='arrayLength(&rc_state)'&&e.after==='379496u'));
 assert.equal(m.intrinsicProfile,'source-f64-v1');const approved=approveSourceIntrinsics(m.code,{profile:'source-f64-v1'});assert.equal(approved.entries.length,12);assert.ok(approved.entries.every(x=>x.family==='f64'));assert.throws(()=>approveSourceIntrinsics(m.code,{profile:'source-numeric-v1'}),/Exact intrinsic function signature\/body mismatch/);
 assert.match(m.code,/fn rc_micro_raw_address_worldState\(index:u32\)->u32\{if\(index>=379496u\)\{return 0xffffffffu;\}/);assert.match(m.code,/fn rc_micro_raw_address_rawState\(index:u32\)->u32\{if\(index>=12060u\)\{return 0xffffffffu;\}return 379496u\+index;/);
});

test('integer logical-view addresses trap out-of-view before adjacent physical storage can be read',()=>{
 const {composed:m}=fixture();const helper=/fn rc_micro_raw_address_rawState\(index:u32\)->u32\{if\(index>=\d+u\)\{return 0xffffffffu;\}return \d+u\+index;\}/.exec(m.code)[0];
 const source='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n'+helper+'\nfn main(index:u32){rc_state[0u]=rc_state[rc_micro_raw_address_rawState(index)];}',p=compileMicrocodeWGSL(source),root=p.functions.find(f=>f.name==='main');
 const run=index=>{const bindings=m.bindings.map(x=>x.slice());bindings[0][0]=123;bindings[0][m.layout.rawStateBase+12059]=91;const vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,bindings,initialSlots:[{slot:root.params[0].slot,value:index}]});vm.begin();let status;for(let i=0;i<20;i++){status=vm.advance(0,32);if(status!==1)break;}return{status,error:vm.state[3],value:bindings[0][0]};};
 assert.deepEqual(run(12059),{status:2,error:0,value:91});assert.deepEqual(run(12060),{status:3,error:5,value:123});assert.deepEqual(run(0xffffffff),{status:3,error:5,value:123});
});

test('scratch aliases, source bindings, complete tails and immutable templates fail closed when changed',()=>{
 const {runtime:p}=fixture();for(const mutate of [q=>q.init.resources.rawScratch-=6,q=>q.pc.requestTailBase-=1,q=>q.pc.totalStateWords=q.init.resources.worldState,q=>q.init.stages['world-transfer'].bindingTypes[3]='storage',q=>q.init.commands[0].repeat=0,q=>q.init.commands[0].stage='omitted-source',q=>q.init.stages['raw-init'].code=q.init.stages['raw-init'].code.replace('@workgroup_size(1)','@workgroup_size(2)')]){const q=structuredClone(p);mutate(q);assert.throws(()=>composeRawMicrocodeSource(q));}
});


test('full authentic initializer lowers without changing array-valued binary64 center or claiming mapped numeric intrinsics',()=>{
 const {composed:m}=fixture(),p=compileMicrocodeWGSL(m.code,{entry:m.entry,intrinsics:m.intrinsicProfile});assert.ok(p.instructions.length>0);assert.equal(p.intrinsicApproval.entries.length,12);assert.ok(p.functions.some(f=>f.name==='rc_num_eval'&&!f.intrinsic));assert.ok(p.functions.some(f=>f.name==='rc_raw_program_init'&&f.params.at(-1).words===6));assert.equal(m.capability.interpretedOnly,true);assert.equal(m.capability.worldPcBegun,false);console.log(JSON.stringify({scope:'host-only-raw-source-lowering',instructions:p.instructions.length/8,localWords:p.localWords,callDepth:p.callDepth,sourceCalls:m.originalInvocations,nativeExecuted:false}));
});

const walk=(x,visit)=>{if(!x||typeof x!=='object')return;visit(x);for(const value of Object.values(x))if(Array.isArray(value))value.forEach(y=>walk(y,visit));else walk(value,visit);};
const storageName=expr=>expr?.kind==='index'&&expr.object.kind==='name'&&['rc_state','rc_scratch','rc_prepared','rc_inputs','rc_program','rc_geometry','rc_template'].includes(expr.object.name)?expr.object.name:null;
test('actual nineteen-stage inventory covers source storage assignments, compound read-modify-write and updates without index duplication',()=>{
 const {composed:m}=fixture(),counts={assignments:0,compoundAssignments:0,increments:0,decrements:0,indexCalls:0};const cases=[];
 for(const row of m.entries){const ast=parseMicrocodeWGSL(row.sourceCode);for(const fn of ast.functions)walk(fn.body,node=>{const target=node.kind==='assign'?node.left:node.kind==='update'?node.arg:null;if(!storageName(target))return;let calls=0;walk(target.index,x=>{if(x.kind==='call')calls++;});counts.indexCalls+=calls;if(node.kind==='assign'){counts.assignments++;if(node.op!=='=')counts.compoundAssignments++;}else if(node.op==='++')counts.increments++;else if(node.op==='--')counts.decrements++;cases.push({stage:row.name,function:fn.name,operation:node.op,indexCalls:calls});});}
 assert.ok(counts.assignments>500);assert.ok(counts.increments>0);assert.ok(cases.some(x=>x.function==='rc_clearance_reduce_contact'));assert.ok(cases.some(x=>x.function==='rc_raw_program_step'));console.log(JSON.stringify({scope:'authentic-source-storage-index-inventory',...counts,stages:m.entries.length}));
});

function scalarTransportProbe(body){
 const {composed:m}=fixture(),l=m.layout,views=[{target:'rc_state',offset:l.rawStateBase,words:l.rawStateWords,writable:true,resource:'rawState'}];
 const source=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;
 fn lhs()->u32{rc_state[0u]++;rc_state[10u]=rc_state[10u]*10u+1u;return 1u;}
 fn rhs()->u32{rc_state[10u]=rc_state[10u]*10u+2u;rc_state[1u]=99u;return 3u;}
 @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){${body}}`;
 const mapped=mapRawMicrocodeStageForTest({source,views,testOnly:true}),helper=/fn rc_micro_raw_address_rawState\(index:u32\)->u32\{if\(index>=\d+u\)\{return 0xffffffffu;\}return \d+u\+index;\}/.exec(m.code)[0];
 assert.equal(restoreRawMicrocodeStageSource(mapped.code,mapped.edits),source);
 const execute=(code,entry,state)=>{const p=compileMicrocodeWGSL(code,{entry}),root=p.functions.find(f=>f.name===entry),vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,bindings:[state,...Array.from({length:4},()=>new Uint32Array(1))],initialSlots:[0,1,2].map(i=>({slot:root.params[0].slot+i,value:0}))});vm.begin();let status;for(let chunks=0;chunks<1000;chunks++){status=vm.advance(0,7);if(status!==1)break;}assert.equal(status,2);return state;};
 const original=execute(source,'main',new Uint32Array(l.rawStateWords)),physical=new Uint32Array(l.stateWords);physical.fill(0xabababab,0,l.rawStateBase);
 const after=execute('@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n'+helper+'\n'+mapped.code,'rc_micro_raw_probe',physical);assert.ok(after.subarray(0,l.rawStateBase).every(x=>x===0xabababab),'never touch neighboring original world/PC/request words');assert.deepEqual(after.slice(l.rawStateBase),original);return original;
}

test('mapped LHS index evaluates once and before RHS; compound old value precedes RHS; increment/decrement retain source order',()=>{
 const simple=scalarTransportProbe('rc_state[lhs()]=rhs();');assert.equal(simple[0],1);assert.equal(simple[1],3);assert.equal(simple[10],12);
 const compound=scalarTransportProbe('rc_state[1u]=10u;rc_state[lhs()]+=rhs();');assert.equal(compound[0],1);assert.equal(compound[1],13,'read old 10 before RHS replaces cell with 99');assert.equal(compound[10],12);
 const updates=scalarTransportProbe('rc_state[1u]=10u;rc_state[lhs()]++;rc_state[lhs()]--;');assert.equal(updates[0],2);assert.equal(updates[1],10);assert.equal(updates[10],11);
 const wrapped=scalarTransportProbe('rc_state[0xffffffffu+1u]=77u;rc_state[1u]=rc_state[0xffffffffu+1u];');assert.equal(wrapped[0],77);assert.equal(wrapped[1],77,'original u32 index arithmetic wraps BEFORE logical view check; base addition never wraps');
 assert.throws(()=>mapRawMicrocodeStageForTest({source:'',views:[]}),/TEST ONLY/);
});


test('checked view helper result is the FINAL physical index; no caller can add to or wrap a rejection sentinel',()=>{
 const {composed:m}=fixture();for(const row of m.entries){const ast=parseMicrocodeWGSL(row.mappedCode);for(const fn of ast.functions)walk(fn.body,node=>{if(!storageName(node))return;assert.equal(node.index.kind,'call');assert.match(node.index.callee.name,/^rc_micro_raw_address_/);assert.equal(node.index.args.length,1);});}
 assert.equal(m.capability.logicalViewAddress,'final physical address; no offset after sentinel');assert.equal(m.capability.requiresCompleteVmBeforeWorld,true);assert.match(m.capability.outOfViewAccess,/unsupported, never ordinary miss/);assert.deepEqual(m.worldBindingViews.map(v=>v.sizeBytes),[379496,874992,25408,81792,96].map(n=>n*4));assert.ok(m.worldBindingViews.every(v=>v.offsetBytes===0));
});
