import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {numberWords,wordsNumber} from '../src/resident-candidate/source-number.mjs';
import {packCandidates} from '../src/resident-candidate/abi.mjs';
import {rawStrikePoseReference,rawStrikeClearanceGeometryReference,pinnedSinCosReference,pinnedHypot2Reference,pinnedHypot3Reference,generateRawStrikeWGSL,compileRawStrikeProgram,executeRawStrikeProgramReference,generateRawStrikeProgramWGSL,SourceNumberProgramBuilder,compileSourceNumberProgram,executeSourceNumberProgramReference,defineSourceNumberHypotFunctions,RAW_POSE_LAYOUT,RAW_STRIKE_CAPABILITY} from '../src/resident-candidate/raw-strike.mjs';
const require=createRequire(import.meta.url);require('../src/math.js');require('../src/physics.js');
const center=[-.66,.0308,.1].map(Math.fround),vector=a=>({x:a[0],y:a[1],z:a[2]});
const bitArray=n=>Array.from(numberWords(n));
function sourcePose(settings){
 const p=globalThis.PhysicsLab.prototype.pose.call({}, {body:{translation:()=>vector(center)},radius:.03075},settings);
 return {...Object.fromEntries(['direction','side','up','surface','contact','tip','shaftCenter'].map(k=>[k,[p[k].x,p[k].y,p[k].z]])),rotation:[p.rotation.x,p.rotation.y,p.rotation.z,p.rotation.w],linear:[p.direction.x*settings.speed,p.direction.y*settings.speed,p.direction.z*settings.speed]};
}
function randomSettings(n){let seed=0x856d39f1;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};return Array.from({length:n},()=>({angle:random()*360-180,elevation:random()*85,speed:.01+random()*9.99,tipX:(random()-.5)*1.1,tipY:(random()-.5)*.9}));}
const base={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
const fixed=[];for(const angle of [-180,-135,-90,-45,-0,0,45,90,135,180,360,310,1e6])for(const elevation of [0,8,37,85])fixed.push({...base,angle,elevation});
for(const settings of [{tipX:.999999,tipY:0},{tipX:.6,tipY:.8},{tipX:1,tipY:0},{speed:0},{speed:-0},{speed:10},{speed:10.000000000000002},{elevation:-Number.MIN_VALUE},{elevation:85.00000000000001},{angle:Infinity},{angle:NaN},{angle:1e100},{angle:1e300},{angle:-1e300},{angle:1e20},{angle:Number.MAX_VALUE},{tipX:NaN},{tipY:Infinity}])fixed.push({...base,...settings});
const sourceAdmitted=s=>Object.values(s).every(Number.isFinite)&&Math.hypot(s.tipX,s.tipY)<1&&s.speed>0&&s.speed<=10&&s.elevation>=0&&s.elevation<=85;
function verifyPose(actual,settings,label){
 if(!sourceAdmitted(settings)){assert.equal(actual.status,'rejected',label);return;}
 const angle=settings.angle*Math.PI/180;if(!pinnedSinCosReference(angle)){assert.equal(actual.status,'unsupported',label);return;}
 assert.equal(actual.status,'pose-ready',label);const expected=sourcePose(settings);
 for(const key of Object.keys(expected))assert.deepEqual(actual[key].map(bitArray),expected[key].map(bitArray),label+'.'+key);
 assert.equal(actual.clearanceRequired,true);assert.equal(actual.allocationRequired,true);
}
test('pinned binary64 trig/hypot algorithm matches current original JS source independently',()=>{
 for(let i=0;i<20000;i++){
  const angle=(i-10000)/10000*Math.PI,r=pinnedSinCosReference(angle);
  assert.deepEqual(bitArray(r.sin),bitArray(Math.sin(angle)),'sin '+angle);assert.deepEqual(bitArray(r.cos),bitArray(Math.cos(angle)),'cos '+angle);
 }
 for(const s of randomSettings(3000)){
  assert.deepEqual(bitArray(pinnedHypot2Reference(s.tipX,s.tipY)),bitArray(Math.hypot(s.tipX,s.tipY)));
  assert.deepEqual(bitArray(pinnedHypot3Reference(s.angle,s.speed,s.elevation)),bitArray(Math.hypot(s.angle,s.speed,s.elevation)));
 }
 for(const x of [1e100,-1e100,1e300,Number.MAX_VALUE,0,-0,Number.MIN_VALUE,-Number.MIN_VALUE,Math.PI/2,Math.PI,2000,1e5,Math.PI*2**18]){
  const r=pinnedSinCosReference(x);assert.ok(r);assert.deepEqual(bitArray(r.sin),bitArray(Math.sin(x)));assert.deepEqual(bitArray(r.cos),bitArray(Math.cos(x)));
 }
 let seed=89132;const rng=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
 for(let i=0;i<10000;i++){const x=wordsNumber(Uint32Array.of(rng(),rng()));if(!Number.isFinite(x))continue;const r=pinnedSinCosReference(x);assert.ok(r);assert.deepEqual(bitArray(r.sin),bitArray(Math.sin(x)),'large sin '+x);assert.deepEqual(bitArray(r.cos),bitArray(Math.cos(x)),'large cos '+x);}
 assert.equal(pinnedSinCosReference(Infinity),null);
});
test('raw pose preserves original five controls, operation order, f32 boundary and source rejection',()=>{
 for(const [i,settings]of fixed.concat(randomSettings(2000)).entries())verifyPose(rawStrikePoseReference(settings,center),settings,'pose'+i);
 assert.equal(RAW_STRIKE_CAPABILITY.continuousClearance,false);
 assert.equal(RAW_STRIKE_CAPABILITY.completeStrikeInitialization,false);
});
test('clearance descriptors match original sampled AND continuous query arguments',()=>{
 for(const settings of fixed.concat(randomSettings(100)).filter(sourceAdmitted)){
  const actual=rawStrikeClearanceGeometryReference(settings,center);if(actual.status==='unsupported')continue;
  const contacts=[],casts=[],other={collider:{contactShape(...a){contacts.push(a);return null;},castShape(...a){casts.push(a);return null;}},label:'test obstacle'};
  const selected={shape:'sphere',radius:.03075,body:{translation:()=>vector(center)}};
  const lab={R:{Cylinder:class{constructor(halfHeight,radius){this.halfHeight=halfHeight;this.radius=radius;}},Ball:class{constructor(radius){this.radius=radius;}}},
   pose:globalThis.PhysicsLab.prototype.pose,world:{propagateModifiedBodyPositionsToColliders(){}},statics:[other],objects:[]};
  const source=globalThis.PhysicsLab.prototype.cueClearance.call(lab,selected,settings);assert.equal(source.clear,true);assert.equal(contacts.length,9);assert.equal(casts.length,3);
  for(let part=0;part<3;part++){
   const p=actual.parts[part],cast=casts[part];assert.deepEqual(Object.values(cast[2]).map(bitArray),p.center.map(bitArray));assert.deepEqual(Object.values(cast[4]).map(bitArray),actual.velocity.map(bitArray));assert.equal(cast[0].x,0);assert.equal(cast[5],0);assert.equal(cast[6],1);assert.equal(cast[7],true);
   assert.deepEqual(Object.values(cast[3]).map(bitArray),actual.rotation.map(bitArray));assert.deepEqual(bitArray(cast[1].radius),bitArray(p.radius));if(part<2)assert.deepEqual(bitArray(cast[1].halfHeight),bitArray(p.halfHeight));
   for(let sample=0;sample<3;sample++){const contact=contacts[part*3+sample];assert.deepEqual(Object.values(contact[1]).map(bitArray),p.samples[sample].map(bitArray));assert.equal(contact[3],.1);}
  }
  assert.equal(actual.continuousCastRequired,true);assert.equal(actual.sampledContactsRequired,true);
 }
});
test('compact raw program preserves every source pose word and bounded instruction state',()=>{
 const program=compileRawStrikeProgram();let maximumSteps=0;
 for(const settings of fixed.concat(randomSettings(2000))){
  const expected=rawStrikePoseReference(settings,center),actual=executeRawStrikeProgramReference(settings,center);maximumSteps=Math.max(maximumSteps,actual.steps);assert.equal(actual.done,true);
  const status={rejected:8,unsupported:4,'pose-ready':1}[expected.status];assert.equal(actual.raw[0],status);
  if(status===1){const original=sourcePose(settings);for(const[k,values]of Object.entries(original))values.forEach((x,j)=>assert.deepEqual(Array.from(actual.raw.subarray(RAW_POSE_LAYOUT[k]+j*2,RAW_POSE_LAYOUT[k]+j*2+2)),bitArray(x),'program '+k));}
 }
 assert.ok(maximumSteps<program.maximumInstructions);assert.equal(executeRawStrikeProgramReference(base,center,{maximumInstructions:1}).raw[0],4);
 assert.doesNotMatch(generateRawStrikeProgramWGSL(),/var\s+\w+\s*:\s*array/);console.log(JSON.stringify({gate:'raw-program-host',instructions:program.instructionCount,registerWords:program.registerWords,maximumObservedSteps:maximumSteps,completeShot:false}));
});
test('optional native clearance geometry is computed from raw parameters in source order',()=>{
 const program=compileRawStrikeProgram({clearanceGeometry:true});assert.equal(program.outputWords,128);
 for(const settings of randomSettings(128)){
  const values=['angle','elevation','speed','tipX','tipY'].map(k=>settings[k]),actual=executeSourceNumberProgramReference(program,[...values,...center]),expected=rawStrikeClearanceGeometryReference(settings,center),f=new Float32Array(actual.raw.buffer);assert.equal(actual.raw[0],1);
  assert.deepEqual(Array.from(f.subarray(64,68)),expected.rotation.map(Math.fround));assert.deepEqual(Array.from(f.subarray(68,71)),expected.velocity.map(Math.fround));
  expected.parts.forEach((part,i)=>{const at=72+i*16;assert.deepEqual(Array.from(f.subarray(at,at+3)),part.center.map(Math.fround));part.samples.forEach((point,j)=>assert.deepEqual(Array.from(f.subarray(at+3+j*3,at+6+j*3)),point.map(Math.fround)));assert.equal(f[at+12],part.shape==='sphere'?3:0);assert.equal(f[at+13],Math.fround(part.halfHeight));assert.equal(f[at+14],Math.fround(part.radius));});
 }
});
test('reusable compact binary64 hypot programs preserve special values and fail-closed capacity',()=>{
 const b=new SourceNumberProgramBuilder(),jump=b.emit('jump'),names=defineSourceNumberHypotFunctions(b);b.patch(jump,b.code.length);
 const inputs=[b.alloc(),b.alloc(),b.alloc()],two=b.call(names.hypot2,inputs.slice(0,2))[0],three=b.call(names.hypot3,inputs)[0];b.emit('halt');
 const p=compileSourceNumberProgram(b,{inputs,outputs:[[0,two,0],[2,three,0]],outputWords:4});
 for(const values of [[0,0,0],[-0,-0,-0],[Infinity,NaN,3],[NaN,Infinity,NaN],[NaN,1,2],[Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE],[1e308,1e308,1e308],...randomSettings(100).map(s=>[s.tipX,s.elevation,s.speed])]){
  const result=executeSourceNumberProgramReference(p,values);assert.equal(result.completion,1);const actual=[wordsNumber(result.raw.subarray(0,2)),wordsNumber(result.raw.subarray(2,4))],expected=[Math.hypot(...values.slice(0,2)),Math.hypot(...values)];
  for(let i=0;i<2;i++){if(Number.isNaN(expected[i]))assert.ok(Number.isNaN(actual[i]));else assert.deepEqual(bitArray(actual[i]),bitArray(expected[i]));}
 }
 const exhausted=executeSourceNumberProgramReference(p,[1,2,3],{maximumInstructions:1});assert.equal(exhausted.done,false);assert.equal(exhausted.completion,3);assert.throws(()=>b.emit('approximate-hypot'),/Unknown source opcode/);
});
test('raw WGSL owns validation and preserves binary64 pose, without ordinary shader sin/cos',()=>{
 const code=generateRawStrikeWGSL();assert.match(code,/fn rc_raw_strike_pose/);assert.match(code,/rc_f64_div\(rc_f64_mul\(s.angle/);
 assert.doesNotMatch(code,/\b(?:sin|cos|sqrt|hypot|normalize|length)\s*\(/);
 assert.match(code,/do not commit cue allocation before original swept clearance/);
});
test('actual WGSL raw-parameter pose matches original PhysicsLab bit patterns',async t=>{
 if(!process.env.REQUIRE_WEBGPU)return t.skip('REQUIRE_WEBGPU=1 in the assigned serial GPU slot');
 assert.ok(process.env.GPU_NATIVE_MODULE,'GPU_NATIVE_MODULE required');
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice(),buffers=[];
 const cases=fixed.concat(randomSettings(Number(process.env.RAW_STRIKE_GPU_RANDOM??128))),input=packCandidates(cases.map((settings,id)=>({id,settings})),{selectedIndex:0});
 const F=x=>{const w=numberWords(x);return`RcF64(${w[0]}u,${w[1]}u)`;};
 const program=compileRawStrikeProgram(),stride=program.registerWords+program.controlWords+64,cb=program.registerWords,ob=cb+program.controlWords;
 const code=generateRawStrikeProgramWGSL()+`
@group(0) @binding(0) var<storage,read> rc_inputs:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read> rc_program:array<u32>;
@compute @workgroup_size(32) fn init(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=arrayLength(&rc_inputs)/16u){return;}let base=gid.x*${stride}u;rc_raw_program_init(0u,base,base+${cb}u,gid.x*16u,array<RcF64,3>(${center.map(F).join(',')}));}
@compute @workgroup_size(32) fn step(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=arrayLength(&rc_inputs)/16u){return;}let base=gid.x*${stride}u;rc_raw_program_step(0u,base,base+${cb}u,256u);}
@compute @workgroup_size(32) fn finish(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=arrayLength(&rc_inputs)/16u){return;}let base=gid.x*${stride}u;rc_raw_program_finish(0u,base,base+${cb}u,base+${ob}u);}
`;
 try{
  console.log(JSON.stringify({stage:'raw-program-module',bytes:code.length,cases:cases.length}));
  const module=device.createShaderModule({code,label:'resident raw strike bounded source-program gate'}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(m=>m.type==='error'),[]);
  const pipelines={};for(const entryPoint of ['init','step','finish']){console.log(JSON.stringify({stage:'raw-program-pipeline-start',entryPoint}));pipelines[entryPoint]=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint}});console.log(JSON.stringify({stage:'raw-program-pipeline-ready',entryPoint}));}
  const make=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;},src=make(input.byteLength,136),size=cases.length*64*4,out=make(cases.length*stride*4,132),read=make(size,9),prog=make(program.words.byteLength,136);device.queue.writeBuffer(src,0,input);device.queue.writeBuffer(prog,0,program.words);
  const groups={};for(const name of Object.keys(pipelines))groups[name]=device.createBindGroup({layout:pipelines[name].getBindGroupLayout(0),entries:[src,out,prog].map((buffer,binding)=>({binding,resource:{buffer}}))});
  const enc=device.createCommandEncoder();for(const name of ['init',...Array(Math.ceil(program.maximumInstructions/256)).fill('step'),'finish']){const pass=enc.beginComputePass();pass.setPipeline(pipelines[name]);pass.setBindGroup(0,groups[name]);pass.dispatchWorkgroups(Math.ceil(cases.length/32));pass.end();}
  for(let i=0;i<cases.length;i++)enc.copyBufferToBuffer(out,(i*stride+ob)*4,read,i*64*4,64*4);
  console.log(JSON.stringify({stage:'raw-program-submit',dispatches:Math.ceil(program.maximumInstructions/256)+2}));device.queue.submit([enc.finish()]);await read.mapAsync(1);console.log(JSON.stringify({stage:'raw-program-mapped'}));const raw=new Uint32Array(read.getMappedRange().slice(0));read.unmap();
  cases.forEach((settings,i)=>{
   const words=raw.subarray(i*64,(i+1)*64),expected=rawStrikePoseReference(settings,center);
   if(expected.status==='rejected'){assert.equal(words[0],8,'GPU rejected '+i);assert.ok([1,2].includes(words[1]));return;}
   if(expected.status==='unsupported'){assert.equal(words[0],4,'GPU unsupported '+i);assert.equal(words[1],6);return;}
   assert.equal(words[0],1,'GPU pose ready '+i);assert.equal(words[1],0);
   const original=sourcePose(settings);for(const[k,values]of Object.entries(original)){const start=RAW_POSE_LAYOUT[k];values.forEach((x,j)=>assert.deepEqual(Array.from(words.subarray(start+j*2,start+j*2+2)),bitArray(x),`GPU original pose${i}.${k}.${j}`));}
  });
  console.log(JSON.stringify({gate:'raw-strike-native-pose',transport:'bounded-resident-source-program',cases:cases.length,bitwise:true,continuousClearance:false,nativeAllocation:false,fullShot:false}));
 }finally{buffers.forEach(b=>b.destroy());device.destroy();}
});
