import test from 'node:test';
import assert from 'node:assert/strict';
import {MICROCODE_ISA as I,microcodeInstruction as ins} from '../src/resident-candidate/microcode-isa.mjs';
import {MICROCODE_VM_CAPABILITY,microcodeVmLayout,createMicrocodeVmReferenceForTest as create,generateMicrocodeVmWGSL} from '../src/resident-candidate/microcode-vm.mjs';
const C=I.control,S=I.status,E=I.error,code=(...rows)=>Uint32Array.from(rows.flatMap(x=>Array.from(x))),bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
const machine=(instructions,options={})=>create({testOnly:true,code:instructions,localWords:16,entryPc:0,stackCapacity:8,...options});
const run=(name,a=0,b=0,c=0)=>{const vm=machine(code(ins('SET',0,a),ins('SET',1,b),ins('SET',2,c),ins(name,3,0,1,...(name==='SELECT'?[2]:[])),ins('HALT')));vm.begin();vm.advance();return vm;};
const unary=(name,a)=>{const vm=machine(code(ins('SET',0,a),ins(name,1,0),ins('HALT')));vm.begin();vm.advance();return vm;};
const sample=(name,a,b,expected)=>{const vm=run(name,a,b);assert.equal(vm.state[C.status],S.complete,name);assert.equal(vm.local(0,3),expected>>>0,name);};

test('scalar interpreter preserves u32/i32 wrap, bits, signed comparisons and explicit domains',()=>{
 for(const[n,a,b,r]of[
  ['UADD',0xffffffff,2,1],['USUB',0,1,0xffffffff],['UMUL',0xffffffff,0xffffffff,1],['UDIV',0xffffffff,3,1431655765],['UREM',0xffffffff,2,1],
  ['IADD',0x7fffffff,1,0x80000000],['ISUB',0x80000000,1,0x7fffffff],['IMUL',0x80000000,2,0],['IDIV',(-7)>>>0,3,(-2)>>>0],['IREM',(-7)>>>0,3,0xffffffff],
  ['AND',0x12345678,0xff,0x78],['OR',0x12345678,0xff,0x123456ff],['XOR',0x12345678,0xff,0x12345687],['SHL',1,33,2],['USHR',0x80000000,31,1],['ISHR',0x80000000,31,0xffffffff],
  ['EQ',1,1,1],['NE',1,2,1],['ULT',0xffffffff,0,0],['ULE',1,1,1],['UGT',0xffffffff,0,1],['UGE',1,1,1],['ILT',0xffffffff,0,1],['ILE',0xffffffff,0xffffffff,1],['IGT',0,0xffffffff,1],['IGE',0,0,1]
 ])sample(n,a,b,r);
 for(const[n,a,r]of[['MOV',0x80000000,0x80000000],['NOT',0,0xffffffff],['LNOT',0,1],['LNOT',42,0],['INEG',1,0xffffffff],['UCLZ',1,31],['UCLZ',0,32],['UCTZ',0x80000000,31],['UCTZ',0,32],['POPCOUNT',0xffffffff,32],['POPCOUNT',0x12345678,13]]){const vm=unary(n,a);assert.equal(vm.state[C.status],S.complete,n);assert.equal(vm.local(0,1),r,n);}
 for(const n of['UDIV','UREM','IDIV','IREM']){const vm=run(n,1,0);assert.equal(vm.state[C.status],S.unsupported,n);assert.equal(vm.state[C.error],E.sourceDomain);assert.equal(vm.state[C.pc],3);}
 for(const n of['IDIV','IREM'])assert.equal(run(n,0x80000000,0xffffffff).state[C.status],S.unsupported);
 assert.equal(run('SELECT',0x123,0x456,0).local(0,3),0x123);assert.equal(run('SELECT',0x123,0x456,1).local(0,3),0x456);
});

test('f32 scalar opcodes use explicit per-op word round trips; this is not device float qualification',()=>{
 for(const[n,a,b,r]of[['FADD',1,2,3],['FSUB',1,2,-1],['FMUL',1.5,2.5,3.75],['FDIV',1,3,Math.fround(1/3)],['FMIN',-2,3,-2],['FMAX',-2,3,3]])sample(n,bits(a),bits(b),bits(r));
 for(const[n,a,b,r]of[['FEQ',0,-0,1],['FNE',NaN,0,1],['FLT',-1,0,1],['FLE',1,1,1],['FGT',2,1,1],['FGE',1,1,1]])sample(n,bits(a),bits(b),r);
 for(const[n,a,r]of[['FNEG',0,-0],['FNEG',-0,0],['FABS',-2,2],['FSQRT',4,2],['FLOOR',-1.2,-2],['CEIL',-1.2,-1],['TRUNC',-1.2,-1],['ROUND',2.5,2],['ROUND',3.5,4],['ROUND',-0.5,-0]])assert.equal(unary(n,bits(a)).local(0,1),bits(r),n+' '+a);
 assert.equal(unary('UTOF',0xffffffff).local(0,1),bits(4294967295));assert.equal(unary('ITOF',0xffffffff).local(0,1),bits(-1));assert.equal(unary('FTOU',bits(3.9)).local(0,1),3);assert.equal(unary('FTOI',bits(-3.9)).local(0,1),(-3)>>>0);
 for(const[n,x]of[['FTOU',-1],['FTOU',2**32],['FTOI',2**31],['FTOI',NaN],['FTOU',Infinity]]){const vm=unary(n,bits(x));assert.equal(vm.state[C.status],S.unsupported);assert.equal(vm.state[C.error],E.sourceDomain);}
 assert.equal(MICROCODE_VM_CAPABILITY.nativeQualified,false);assert.equal(MICROCODE_VM_CAPABILITY.hardwarePerformance,false);
});

test('storage loads/stores, readonly bindings, lengths and indirect locals are checked before access',()=>{
 const bindings=Array.from({length:5},(_,k)=>Uint32Array.of(k+10,k+20));const vm=machine(code(ins('SET',0,1),ins('LOAD',1,2,0),ins('STORE',0,0,0,1),ins('LENGTH',2,4),ins('SET',3,7),ins('LOCAL_STORE',0,3,1),ins('LOCAL_LOAD',4,3),ins('HALT')),{bindings});vm.begin();vm.advance();assert.equal(vm.state[C.status],S.complete);assert.equal(bindings[0][1],22);assert.equal(vm.local(0,2),2);assert.equal(vm.local(0,4),22);assert.equal(vm.local(0,7),22);
 for(const [op,error]of[[ins('STORE',0,1,0,0),E.readonlyStorage],[ins('LOAD',0,5,0),E.storageRange],[ins('LOCAL_LOAD',1,0),E.localRange]]){const v=machine(code(ins('SET',0,100),op));v.begin();v.advance();assert.equal(v.state[C.status],S.invalid);assert.equal(v.state[C.error],op[0]===I.opcodes.STORE?E.storageRange:error);}
 const readonly=machine(code(ins('STORE',0,1,0,0)));readonly.begin();readonly.advance();assert.equal(readonly.state[C.error],E.readonlyStorage);
 const writeScratch=machine(code(ins('SET',0,0),ins('SET',1,55),ins('STORE',0,3,0,1),ins('HALT')));writeScratch.begin();writeScratch.advance();assert.equal(writeScratch.bindings[3][0],55);
});

test('bounded chunks resume only from copied device-equivalent PC/local/stack words and preserve lane independence',()=>{
 // main sums 1..5 through a call. Function locals are fixed, call frames keep PC only.
 const program=code(ins('SET',0,0),ins('SET',1,1),ins('SET',2,6),ins('CALL',0,9),ins('UADD',1,1,3),ins('ULT',4,1,2),ins('BRANCH',0,4,3,7),ins('RET'),ins('HALT'),ins('SET',3,1),ins('UADD',0,0,1),ins('RET'));
 const first=machine(program,{count:2,initialSlots:[{slot:8,candidateStride:10,value:7}]});first.begin(0);first.begin(1);assert.equal(first.local(0,8),7);assert.equal(first.local(1,8),17);assert.equal(first.advance(0,4),S.ready);assert.equal(first.state[C.sp],1);assert.equal(first.state[C.pc],9);assert.equal(first.state[C.yields],1);assert.equal(first.state[first.layout.stride+C.pc],0);
 const copied=first.state.slice(),second=machine(program,{count:2,state:copied,initialSlots:[{slot:8,candidateStride:10,value:7}]});while(second.advance(0,3)===S.ready){}assert.equal(second.local(0,0),15);assert.equal(second.state[C.status],S.complete);assert.equal(second.state[C.sp],0);assert.equal(second.advance(1,100),S.complete);assert.equal(second.local(1,0),15);assert.equal(first.state[C.status],S.ready,'independent copied authority');
});

test('malformed opcode/operands/PC/stack/control and counters fail explicitly, never become a physical miss',()=>{
 const badCases=[[code(Uint32Array.of(999,0,0,0,0,0,0,0)),E.unknownOpcode],[code(ins('SET',0,1,9)),E.unknownOpcode],[code(ins('MOV',99,0)),E.localRange],[code(ins('JUMP',0,99)),E.invalidBranch],[code(ins('BRANCH',0,0,99,99)),E.invalidBranch]];
 for(const[program,error]of badCases){const v=machine(program);v.begin();v.advance();assert.equal(v.state[C.status],S.invalid);assert.equal(v.state[C.error],error);}
 const recursive=machine(code(ins('CALL',0,0)),{stackCapacity:1});recursive.begin();recursive.advance();assert.equal(recursive.state[C.status],S.unsupported);assert.equal(recursive.state[C.error],E.callCapacity);
 for(const[field,value,error]of[[C.pc,99,E.instructionRange],[C.versionWord,2,E.malformedControl],[C.status,0,E.malformedControl],[C.sp,99,E.malformedControl],[C.reservedStart,1,E.malformedControl]]){const v=machine(code(ins('HALT')));v.begin();v.state[field]=value;v.advance();assert.equal(v.state[C.status],S.invalid);assert.equal(v.state[C.error],error);}
 const overflow=machine(code(ins('JUMP',0,0)));overflow.begin();overflow.state[C.stepsLow]=overflow.state[C.stepsHigh]=0xffffffff;overflow.advance();assert.equal(overflow.state[C.error],E.counterOverflow);
 const carry=machine(code(ins('HALT')));carry.begin();carry.state[C.stepsLow]=0xffffffff;carry.advance();assert.equal(carry.state[C.stepsLow],0);assert.equal(carry.state[C.stepsHigh],1);
 assert.throws(()=>create({code:code(ins('HALT')),localWords:1}),/TEST ONLY/);assert.throws(()=>microcodeVmLayout({count:0,localWords:1}),/candidate count/);assert.throws(()=>machine(code(ins('HALT')),{initialSlots:[{slot:0,value:0},{slot:0,value:1}]}),/Unique/);
});

test('generated compact WGSL contains one bounded primitive loop, seven source/data bindings and all fixed ISA opcodes',()=>{
 const code=generateMicrocodeVmWGSL({count:6,localWords:128,stackCapacity:32,instructionCount:4000,entryPc:5,instructionBudget:8192,initialSlots:[{slot:0,candidateStride:1}]});assert.ok(code.length<40000,'compact scalar code, not expanded original equations');assert.equal((code.match(/@binding\(/g)??[]).length,7);for(const name of I.names)assert.match(code,new RegExp('case '+I.opcodes[name]+'u:'));assert.match(code,/work<8192u/);assert.match(code,/fn begin/);assert.doesNotMatch(code,/rc_f64_|rc_num_eval|rc_world_|rc_point_|createReference|expected/);assert.match(code,/rc_vm_state\[base\+16u\]=gid.x\*1u\+0u/);
});

test('native source-number bytecode runs in compact GPU chunks with exact retained control and no intermediate map',async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('Coordinator exclusive numerical slot required');
 const {compileMicrocodeWGSL}=await import('../src/resident-candidate/microcode-compiler.mjs');
 const {generateSourceNumberWGSL,numberWords,sourceNumberReference}=await import('../src/resident-candidate/source-number.mjs');
 const {createNativeOwner}=await import('./resident-candidate-gpu-support.mjs');
 const {createHash}=await import('node:crypto'),{mkdirSync,writeFileSync}=await import('node:fs');
 const sha=x=>createHash('sha256').update(x).digest('hex'),artifactDir=process.env.MICROCODE_NATIVE_ARTIFACT_DIR??'/tmp/resident-microcode-vm-native-artifact';
 const {sourceIntrinsicNativeWGSL,MICROCODE_INTRINSIC_PROFILES}=await import('../src/resident-candidate/microcode-source-intrinsics.mjs');
 const intrinsics=process.env.MICROCODE_TEST_INTRINSICS??'none';assert.ok(MICROCODE_INTRINSIC_PROFILES.includes(intrinsics));
 const nativeSource=intrinsics==='none'?generateSourceNumberWGSL():sourceIntrinsicNativeWGSL(intrinsics),storage=intrinsics==='none'?'':'@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;';
 const source=nativeSource+storage+`\n@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;
 @group(0) @binding(4) var<storage,read> rc_inputs:array<u32>;
 @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x*4u;let o=gid.x*12u;let a=RcF64(rc_inputs[i],rc_inputs[i+1u]);let b=RcF64(rc_inputs[i+2u],rc_inputs[i+3u]);
 let sum=rc_f64_add(a,b);let difference=rc_f64_sub(a,b);let product=rc_f64_mul(a,b);let quotient=rc_f64_div(a,b);let root=rc_f64_sqrt(a);
 rc_state[o]=sum.x;rc_state[o+1u]=sum.y;rc_state[o+2u]=difference.x;rc_state[o+3u]=difference.y;
 rc_state[o+4u]=product.x;rc_state[o+5u]=product.y;rc_state[o+6u]=quotient.x;rc_state[o+7u]=quotient.y;rc_state[o+8u]=root.x;rc_state[o+9u]=root.y;
 rc_state[o+10u]=select(0u,1u,rc_f64_lt(a,b));rc_state[o+11u]=rc_f64_to_f32_bits(a);
 }`;
 const pairs=[[1,3],[1e-300,2],[Number.MIN_VALUE,Number.MIN_VALUE],[Number.MAX_VALUE,2],[0,-0],[-1,2],[Math.PI,Math.E],[2**-1022,2**-52]],input=Uint32Array.from(pairs.flatMap(([a,b])=>[...numberWords(a),...numberWords(b)]));
 const {microcodeIntrinsicReference}=await import('./resident-candidate-microcode-intrinsic-reference.mjs');
 const workgroupSize=Number(process.env.MICROCODE_TEST_WORKGROUP_SIZE??1);assert.ok([1,64].includes(workgroupSize),'Explicit debug1 or parallel64 native gate');
 const compiled=compileMicrocodeWGSL(source,{intrinsics}),count=pairs.length,budget=2048,chunks=256,root=compiled.functions.find(f=>f.name==='main'),options={count,workgroupSize,intrinsics,localWords:compiled.localWords,stackCapacity:Math.max(1,compiled.callDepth),instructionCount:compiled.instructions.length/8,entryPc:compiled.entryPc,instructionBudget:budget,initialSlots:[{slot:root.params[0].slot,candidateStride:1}]};
 const bindings=[new Uint32Array(count*12),new Uint32Array(1),new Uint32Array(1),new Uint32Array(1),input],reference=create({...options,testOnly:true,code:compiled.instructions,bindings,intrinsicHandler:microcodeIntrinsicReference});
 for(let lane=0;lane<count;lane++)reference.begin(lane);
 const checkpoints=[1,7,chunks],expected=[];
 for(let chunk=1;chunk<=chunks;chunk++){for(let lane=0;lane<count;lane++)reference.advance(lane);if(checkpoints.includes(chunk))expected.push({state:reference.state.slice(),output:bindings[0].slice()});}
 for(let lane=0;lane<count;lane++){const base=lane*reference.layout.stride;assert.equal(reference.state[base+C.status],S.complete,'authentic source host fixture complete lane '+lane);const a=numberWords(pairs[lane][0]),b=numberWords(pairs[lane][1]),out=bindings[0].subarray(lane*12,lane*12+12),want=Uint32Array.from([...sourceNumberReference.add(a,b),...sourceNumberReference.sub(a,b),...sourceNumberReference.mul(a,b),...sourceNumberReference.div(a,b),...sourceNumberReference.sqrt(a),+sourceNumberReference.lt(a,b),sourceNumberReference.toF32(a)]);assert.deepEqual(out,want,'independent integer binary64 oracle lane '+lane);}
 const shader=generateMicrocodeVmWGSL(options),identity={sourceSha256:compiled.sourceSha256,programSha256:sha(compiled.instructions),inputSha256:sha(input),shaderSha256:sha(shader),guardInstructions:Array.from({length:options.instructionCount},(_,i)=>compiled.instructions[i*8]).filter(op=>op===I.opcodes.GUARD).length};mkdirSync(artifactDir,{recursive:true});writeFileSync(artifactDir+'/source.wgsl',source);writeFileSync(artifactDir+'/vm.wgsl',shader);writeFileSync(artifactDir+'/program.bin',compiled.instructions);writeFileSync(artifactDir+'/input.bin',input);writeFileSync(artifactDir+'/manifest.json',JSON.stringify({...identity,options,scope:'source-number primitive only',futureStateRuntimeInput:false},null,2));
 const owner=await createNativeOwner('resident-compact-microcode-source-number'),device=owner.device,resources=[],make=(words,usage,label)=>{const b=device.createBuffer({size:words*4,usage,label});resources.push(b);return b;};let scoped=true,submitted=false;
 try{
  assert.ok(workgroupSize<=device.limits.maxComputeInvocationsPerWorkgroup&&workgroupSize<=device.limits.maxComputeWorkgroupSizeX,'Explicit workgroup fits actual adapter limits');
  device.pushErrorScope('validation');const preflightAt=performance.now(),module=device.createShaderModule({code:shader,label:'compact scalar VM'}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(x=>x.type==='error').map(x=>`${x.lineNum}:${x.linePos} ${x.message}`),[]);const preflightMs=performance.now()-preflightAt;console.log(JSON.stringify({stage:'microcode-preflight-passed',...identity,shaderBytes:shader.length,bytecodeInstructions:options.instructionCount,localWords:compiled.localWords,callDepth:compiled.callDepth,preflightMs,adapter:owner.adapterInfo}));
  const layout=device.createBindGroupLayout({entries:['storage','read-only-storage','read-only-storage','storage','read-only-storage','read-only-storage','storage'].map((type,binding)=>({binding,visibility:4,buffer:{type}}))}),pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]}),compileAt=performance.now();
  const begin=await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:'begin'}}),step=await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:'main'}}),compileMs=performance.now()-compileAt;console.log(JSON.stringify({stage:'microcode-pipelines-ready',compileMs}));
  const sourceBuffers=[make(count*12,128|4|8,'source output'),make(1,128|8,'source program unused'),make(1,128|8,'source geometry unused'),make(1,128|8,'source scratch unused'),make(input.length,128|8,'source inputs'),make(compiled.instructions.length,128|8,'immutable microcode'),make(reference.state.length,128|4|8,'resident VM')];device.queue.writeBuffer(sourceBuffers[4],0,input);device.queue.writeBuffer(sourceBuffers[5],0,compiled.instructions);
  const captureWords=reference.state.length+count*12,read=make(captureWords*checkpoints.length,1|8,'final-only continuation checkpoints'),group=device.createBindGroup({layout,entries:sourceBuffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
  const encodeAt=performance.now(),encoder=device.createCommandEncoder();let pass=encoder.beginComputePass();pass.setPipeline(begin);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(count/workgroupSize));pass.end();
  for(let chunk=1;chunk<=chunks;chunk++){pass=encoder.beginComputePass();pass.setPipeline(step);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(count/workgroupSize));pass.end();const ci=checkpoints.indexOf(chunk);if(ci>=0){encoder.copyBufferToBuffer(sourceBuffers[6],0,read,ci*captureWords*4,reference.state.byteLength);encoder.copyBufferToBuffer(sourceBuffers[0],0,read,(ci*captureWords+reference.state.length)*4,count*12*4);}}
  const command=encoder.finish(),encodeMs=performance.now()-encodeAt,submitAt=performance.now();device.queue.submit([command]);submitted=true;const submitMs=performance.now()-submitAt,drainAt=performance.now();await device.queue.onSubmittedWorkDone();const queueDrainWallMs=performance.now()-drainAt,mapAt=performance.now();await read.mapAsync(1);const values=new Uint32Array(read.getMappedRange().slice(0));read.unmap();const mapAndCopyMs=performance.now()-mapAt;assert.equal(await device.popErrorScope(),null);scoped=false;
  for(let i=0;i<checkpoints.length;i++){assert.deepEqual(values.subarray(i*captureWords,i*captureWords+reference.state.length),expected[i].state,'exact retained VM state at chunk '+checkpoints[i]);assert.deepEqual(values.subarray(i*captureWords+reference.state.length,(i+1)*captureWords),expected[i].output,'original primitive outputs at chunk '+checkpoints[i]);}
  console.log(JSON.stringify({stage:'native-source-microcode-pass',...identity,scope:'original binary64 helper bytecode; not physical world or full-rest',count,workgroupSize,intrinsics,workgroups:Math.ceil(count/workgroupSize),functions:compiled.functions.length,bytecodeInstructions:options.instructionCount,shaderBytes:shader.length,dispatches:1+chunks,submissions:1,finalMappings:1,checkpointCopies:checkpoints.length*2,preflightMs,compileMs,encodeMs,submitMs,queueDrainWallMs,mapAndCopyMs,steps:pairs.map((_,lane)=>reference.state[lane*reference.layout.stride+C.stepsLow]),f32ArithmeticQualified:false,hardwarePerformance:false,adapter:owner.adapterInfo}));
 }finally{if(scoped)await device.popErrorScope();if(submitted)await device.queue.onSubmittedWorkDone();for(const resource of resources)resource.destroy();owner.release();}
});

test('object-bound GUARD fails unsupported before address arithmetic or adjacent local write',()=>{
 const program=code(ins('SET',0,0),ins('GUARD',0,0),ins('SET',4,0xdeadbeef),ins('HALT')),v=machine(program);v.begin();v.advance();assert.equal(v.state[C.status],S.unsupported);assert.equal(v.state[C.error],E.sourceDomain);assert.equal(v.state[C.pc],1);assert.equal(v.local(0,4),0);assert.equal(v.state[C.stepsLow],1);
 const success=machine(code(ins('SET',0,1),ins('GUARD',0,0),ins('HALT')));success.begin();success.advance();assert.equal(success.state[C.status],S.complete);assert.equal(success.state[C.stepsLow],3);
 const malformed=machine(code(ins('GUARD',1,0)));malformed.begin();malformed.advance();assert.equal(malformed.state[C.status],S.invalid);assert.equal(malformed.state[C.error],E.unknownOpcode);
});

test('optional event audit uses source ID5 and GPU binding7 without aliasing code or VM storage',()=>{
 const program=code(ins('SET',0,0),ins('SET',1,73),ins('STORE',0,5,0,1),ins('LOAD',2,5,0),ins('LENGTH',3,5),ins('HALT')),v=machine(program,{eventAudit:true});v.begin();v.advance();assert.equal(v.state[C.status],S.complete);assert.equal(v.bindings[5][0],73);assert.equal(v.local(0,2),73);assert.equal(v.local(0,3),1);
 const noAudit=machine(program);noAudit.begin();noAudit.advance();assert.equal(noAudit.state[C.status],S.invalid);assert.equal(noAudit.state[C.error],E.storageRange);
 const shader=generateMicrocodeVmWGSL({count:1,localWords:16,stackCapacity:8,instructionCount:program.length/8,eventAudit:true});assert.match(shader,/@binding\(7\) var<storage,read_write> rc_event_audit/);assert.equal((shader.match(/@binding\(/g)??[]).length,8);assert.match(shader,/case 5u:\{return rc_event_audit\[address\];\}/);
});

test('explicit64-lane workgroup opt-in keeps candidate addresses unchanged and guards excess invocations',()=>{
 const options={count:65,localWords:16,stackCapacity:4,instructionCount:2,workgroupSize:64,initialSlots:[{slot:0,candidateStride:1}]},shader=generateMicrocodeVmWGSL(options),v=create({...options,testOnly:true,code:code(ins('MOV',1,0),ins('HALT'))});assert.equal(v.configuration.workgroups,2);assert.equal((shader.match(/@workgroup_size\(64\)/g)??[]).length,2);assert.equal((shader.match(/gid.x>=65u/g)??[]).length,2);for(const lane of[0,1,63,64]){v.begin(lane);v.advance(lane);assert.equal(v.local(lane,1),lane);assert.equal(v.state[lane*v.layout.stride+C.status],S.complete);}assert.equal(microcodeVmLayout(options).stride,microcodeVmLayout({...options,workgroupSize:1}).stride);assert.throws(()=>generateMicrocodeVmWGSL({...options,workgroupSize:257}),/workgroup size/);
});

test('exact-source intrinsic transport is opt-in, copies contiguous operands and never silently runs a CPU fallback',async()=>{
 const {sourceIntrinsicNativeWGSL,MICROCODE_SOURCE_INTRINSICS,sourceIntrinsicProfileAllows}=await import('../src/resident-candidate/microcode-source-intrinsics.mjs');
 const program=code(ins('SET',0,10),ins('SET',1,11),ins('SET',2,20),ins('SET',3,21),ins('F64_ADD',0,0,2),ins('HALT'));let calls=0;
 const handler=(spec,args,{bindings})=>{calls++;assert.equal(spec.opcode,'F64_ADD');assert.deepEqual(args.map(a=>Array.from(a)),[[10,11],[20,21]]);assert.equal(bindings.length,5);args[0][0]=999;return Uint32Array.of(30,32);};
 const disabled=machine(program,{intrinsicHandler:handler});disabled.begin();disabled.advance();assert.equal(disabled.state[C.status],S.unsupported);assert.equal(disabled.state[C.error],E.unsupportedPrimitive);assert.equal(calls,0);
 const missing=machine(program,{intrinsics:'source-f64-v1'});missing.begin();missing.advance();assert.equal(missing.state[C.status],S.unsupported);assert.equal(missing.state[C.error],E.unsupportedPrimitive);
 const enabled=machine(program,{intrinsics:'source-f64-v1',intrinsicHandler:handler});enabled.begin();enabled.advance();assert.equal(enabled.state[C.status],S.complete);assert.equal(calls,1);assert.equal(enabled.local(0,0),30);assert.equal(enabled.local(0,1),32);
 for(const profile of['source-f64-v1','source-numeric-v1','source-continuations-v1']){const shader=generateMicrocodeVmWGSL({localWords:32,instructionCount:10,intrinsics:profile});assert.ok(shader.includes(sourceIntrinsicNativeWGSL(profile)),'verbatim original native source, not rewritten math');for(const d of MICROCODE_SOURCE_INTRINSICS.filter(d=>sourceIntrinsicProfileAllows(profile,d)))assert.match(shader,new RegExp('intrinsicResult='+d.name+'\\('));}
 assert.equal(MICROCODE_SOURCE_INTRINSICS.filter(d=>sourceIntrinsicProfileAllows('source-continuations-v1',d)).length,17,'existing numerical profile must not acquire preparation');
 const none=generateMicrocodeVmWGSL({localWords:16,instructionCount:1});assert.doesNotMatch(none,/fn rc_f64_add/);assert.throws(()=>generateMicrocodeVmWGSL({localWords:16,instructionCount:1,intrinsics:'math-shortcut'}),/intrinsic profile/);
});

test('intrinsic argument/result spans fail before touching neighboring slots and numeric source status is not VM failure',()=>{
 for(const row of[ins('F64_ADD',15,0,2),ins('F64_ADD',0,15,2),ins('F64_ADD',0,0,15)]){let called=false;const v=machine(code(row),{intrinsics:'source-f64-v1',intrinsicHandler:()=>{called=true;return Uint32Array.of(0,0);}});v.begin();v.advance();assert.equal(v.state[C.status],S.invalid);assert.equal(v.state[C.error],E.localRange);assert.equal(called,false);}
 const program=code(ins('SET',0,123),ins('SET',1,456),ins('NUM_EVAL',2,0,1),ins('HALT'));const v=machine(program,{intrinsics:'source-numeric-v1',intrinsicHandler:(spec,args,{bindings})=>{assert.equal(spec.name,'rc_num_eval');assert.deepEqual(args.map(a=>Array.from(a)),[[123],[456]]);bindings[3][0]=77;return Uint32Array.of(2);}});v.begin();v.advance();assert.equal(v.state[C.status],S.complete);assert.equal(v.local(0,2),2);assert.equal(v.bindings[3][0],77);
 const wrongFamily=machine(program,{intrinsics:'source-f64-v1',intrinsicHandler:()=>{throw Error('must not run');}});wrongFamily.begin();wrongFamily.advance();assert.equal(wrongFamily.state[C.status],S.unsupported);
});

test('continuation intrinsics are explicitly isolated from earlier f64/numeric profiles',()=>{
 for(const[opcode,args]of[['NUM_CONT_INSTRUCTION',[0]],['SOURCE_PROGRAM_INSTRUCTION',[0,1,2]]]){
  const program=code(ins(opcode,3,...args),ins('HALT'));for(const intrinsics of['none','source-f64-v1','source-numeric-v1']){let called=false;const v=machine(program,{intrinsics,intrinsicHandler:()=>{called=true;return Uint32Array.of(0);}});v.begin();v.advance();assert.equal(v.state[C.status],S.unsupported,intrinsics+' '+opcode);assert.equal(called,false);}
  const v=machine(program,{intrinsics:'source-continuations-v1',intrinsicHandler:(spec,words)=>{assert.equal(spec.opcode,opcode);assert.equal(words.length,args.length);return Uint32Array.of(0);}});v.begin();v.advance();assert.equal(v.state[C.status],S.complete);assert.equal(v.local(0,3),0,'source pending status is not VM transport failure');
 }
});

test('explicit immutable-program intrinsic allowlist removes unneeded native call sites and fails closed',()=>{
 const options={localWords:16,instructionCount:1,intrinsics:'source-continuations-v1',intrinsicFunctions:['rc_num_cont_instruction','rc_source_program_instruction']},shader=generateMicrocodeVmWGSL(options);assert.match(shader,/intrinsicResult=rc_num_cont_instruction\(/);assert.match(shader,/intrinsicResult=rc_source_program_instruction\(/);assert.doesNotMatch(shader,/intrinsicResult=rc_f64_add\(|intrinsicResult=rc_num_eval\(/);
 const v=machine(code(ins('F64_ADD',0,2,4)),{...options,instructionCount:1,intrinsicHandler:()=>{throw Error('unlisted must not run');}});v.begin();v.advance();assert.equal(v.state[C.status],S.unsupported);assert.equal(v.state[C.error],E.unsupportedPrimitive);
 const noFunctions=generateMicrocodeVmWGSL({...options,intrinsicFunctions:[]});assert.doesNotMatch(noFunctions,/intrinsicResult=/);assert.throws(()=>generateMicrocodeVmWGSL({...options,intrinsicFunctions:['rc_num_cont_instruction','rc_num_cont_instruction']}),/Unique/);assert.throws(()=>generateMicrocodeVmWGSL({...options,intrinsics:'source-f64-v1'}),/out-of-profile/);assert.throws(()=>generateMicrocodeVmWGSL({...options,intrinsicFunctions:['fake']}),/Unknown/);
});


test('TEST-only call observer counts validated source entries across lanes and retained chunks without state authority',()=>{
 const program=code(ins('CALL',0,3),ins('CALL',0,3),ins('HALT'),ins('CALL',0,5),ins('RET'),ins('RET')),calls=[],observed=machine(program,{count:2,onCall:row=>{assert.ok(Object.isFrozen(row));assert.deepEqual(Object.keys(row),['lane','pc','targetPc']);calls.push(row);}}),plain=machine(program,{count:2});
 for(const lane of[0,1]){observed.begin(lane);plain.begin(lane);for(let chunk=0;chunk<16;chunk++){assert.equal(observed.advance(lane,1),plain.advance(lane,1));assert.deepEqual(observed.state,plain.state);}}
 assert.deepEqual(calls,[0,1].flatMap(lane=>[{lane,pc:0,targetPc:3},{lane,pc:3,targetPc:5},{lane,pc:1,targetPc:3},{lane,pc:3,targetPc:5}]));
 for(const invalid of[code(ins('CALL',0,99)),code(ins('CALL',0,0))]){let count=0;const v=machine(invalid,{stackCapacity:1,onCall:()=>count++});v.begin();v.advance();assert.equal(count,invalid[2]===99?0:1,'invalid branch or exhausted stack is not an entered call');}
 const pending=machine(program,{onCall:row=>calls.push(row)});pending.begin();pending.advance(0,1);const resumeCalls=[],resumed=machine(program,{state:pending.state.slice(),onCall:row=>resumeCalls.push(row)});while(resumed.advance(0,1)===S.ready){}assert.deepEqual(resumeCalls,[{lane:0,pc:3,targetPc:5},{lane:0,pc:1,targetPc:3},{lane:0,pc:3,targetPc:5}]);
 assert.throws(()=>machine(program,{onCall:{}}),/observer/);assert.throws(()=>create({code:program,localWords:16,onCall:()=>{}}),/TEST ONLY/);
});


test('TEST-only return observer exposes exact validated source return boundaries without mutable storage',()=>{
 const program=code(ins('CALL',0,3),ins('CALL',0,3),ins('RET'),ins('CALL',0,5),ins('RET'),ins('RET')),returns=[],observed=machine(program,{onReturn:row=>{assert.ok(Object.isFrozen(row));assert.deepEqual(Object.keys(row),['lane','pc','targetPc']);returns.push(row);}}),plain=machine(program);observed.begin();plain.begin();while(observed.state[C.status]===S.ready){assert.equal(observed.advance(0,1),plain.advance(0,1));assert.deepEqual(observed.state,plain.state);}
 assert.deepEqual(returns,[{lane:0,pc:5,targetPc:4},{lane:0,pc:4,targetPc:1},{lane:0,pc:5,targetPc:4},{lane:0,pc:4,targetPc:2},{lane:0,pc:2,targetPc:null}]);
 let calls=0;const bad=machine(code(ins('RET')),{onReturn:()=>calls++});bad.begin();bad.state[C.sp]=1;bad.state[bad.layout.stackOffset]=99;assert.equal(bad.advance(),S.invalid);assert.equal(calls,0);assert.throws(()=>machine(program,{onReturn:0}),/observer/);
});


test('TEST-only PC counters count committed scalar steps across candidate lanes without changing execution',()=>{
 const program=code(ins('SET',0,7),ins('CALL',0,4),ins('MOV',1,0),ins('HALT'),ins('UADD',0,0,0),ins('RET')),pcCounters=new Uint32Array(6),a=machine(program,{count:2,pcCounters}),b=machine(program,{count:2});assert.equal(a.pcCounters,pcCounters);
 for(const lane of[0,1]){a.begin(lane);b.begin(lane);while(a.state[lane*a.layout.stride+C.status]===S.ready){a.advance(lane,1);b.advance(lane,1);assert.deepEqual(a.state,b.state);}assert.equal(pcCounters.reduce((n,x)=>n+x,0),[0,1].reduce((n,l)=>n+a.state[l*a.layout.stride+C.stepsLow],0));}
 assert.deepEqual([...pcCounters],[2,2,2,2,2,2]);a.begin(0);assert.deepEqual([...pcCounters],[2,2,2,2,2,2],'begin does not erase diagnostic totals');
 const rejected=machine(code(ins('SET',0,0),ins('GUARD',0,0)),{pcCounters:new Uint32Array(2)});rejected.begin();assert.equal(rejected.advance(),S.unsupported);assert.deepEqual([...rejected.pcCounters],[1,0]);
});

test('TEST-only PC counters reject aliased or malformed storage and fail rather than wrapping',()=>{
 const program=code(ins('HALT'));assert.throws(()=>machine(program,{pcCounters:new Uint32Array(2)}),/instructionCount/);assert.throws(()=>machine(program,{pcCounters:new Uint32Array(program.buffer,0,1)}),/alias/);
 const state=new Uint32Array(40);assert.throws(()=>machine(program,{state,pcCounters:new Uint32Array(state.buffer,0,1)}),/alias/);const source=new Uint32Array(8),bindings=[source,...Array.from({length:4},()=>new Uint32Array(1))];assert.throws(()=>machine(program,{bindings,pcCounters:new Uint32Array(source.buffer,4,1)}),/alias/);
 const counters=Uint32Array.of(0xffffffff),v=machine(program,{pcCounters:counters});v.begin();assert.throws(()=>v.advance(),/counter overflow/);assert.equal(counters[0],0xffffffff);assert.equal(v.state[C.stepsLow],0);
});
