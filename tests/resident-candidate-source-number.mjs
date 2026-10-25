import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {numberWords, wordsNumber, sourceNumberReference as soft, generateSourceNumberWGSL, SOURCE_NUMBER_CAPABILITY} from '../src/resident-candidate/source-number.mjs';
const numberBits = x => Array.from(numberWords(x));
const f32view = new DataView(new ArrayBuffer(4));
const f32bits = x => {f32view.setFloat32(0,x,true);return f32view.getUint32(0,true);};
const fromF32 = b => {f32view.setUint32(0,b,true);return f32view.getFloat32(0,true);};
function cases(randomCount) {
  const special = [0,-0,1,-1,2,-2,0.5,-0.5,Number.MIN_VALUE,-Number.MIN_VALUE,
    2**-1022,-(2**-1022),Number.MAX_VALUE,-Number.MAX_VALUE,Infinity,-Infinity,NaN,
    2**-126,2**-149,2**127,Math.PI,Math.E,1+2**-52,1-2**-53,1+2**-24,1+2**-24+2**-49,
    .05,.95,.03075,1/61440,1/960,1e-300,1e300];
  const rows=[];
  for(const a of special)for(const b of special)rows.push([...numberWords(a),...numberWords(b)]);
  let seed=0x197aba39;
  const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
  for(let i=0;i<randomCount;i++)rows.push([next(),next(),next(),next()]);
  // Cancellation, halfway ties, and subnormal boundaries with adjacent words.
  for(const exponent of [0,1,2,126,1022,1023,1024,2045,2046])for(const low of [0,1,0x7fffffff,0x80000000,0xfffffffe,0xffffffff]) {
    const a=Uint32Array.of(low,(exponent<<20)|0xfffff);
    const b=Uint32Array.of(low,((exponent<<20)|0xfffff)^0x80000000);
    rows.push([...a,...b]); rows.push([...a,1,0]);
  }
  return rows;
}
function same64(actual,expected,label) {
  if(Number.isNaN(expected)) assert.ok(Number.isNaN(wordsNumber(actual)),label+' NaN');
  else assert.deepEqual(Array.from(actual),numberBits(expected),label);
}
function verifyHost(row,label) {
  const a=row.slice(0,2),b=row.slice(2,4),x=wordsNumber(a),y=wordsNumber(b);
  for(const [op,expected] of [['add',x+y],['sub',x-y],['mul',x*y],['div',x/y]])same64(soft[op](a,b),expected,label+'.'+op);
  same64(soft.sqrt(a),Math.sqrt(x),label+'.sqrt');
  if(!Number.isNaN(x))assert.equal(soft.toF32(a),f32bits(x),label+'.f32');
  same64(soft.fromF32(a[0]),fromF32(a[0]),label+'.fromF32');
  assert.equal(soft.lt(a,b),x<y,label+'.lt');assert.equal(soft.eq(a,b),x===y,label+'.eq');
}
test('integer binary64 reference matches native rounding, boundaries, signed zero and random bit patterns',()=>{
  const rows=cases(20000);rows.forEach((row,i)=>verifyHost(row,'case'+i));
  assert.equal(SOURCE_NUMBER_CAPABILITY.sourceTranscendentals,false);
  assert.equal(SOURCE_NUMBER_CAPABILITY.hardwareValidated,false);
});
test('binary64 WGSL has no native float arithmetic or floating conversions',()=>{
  const shader=generateSourceNumberWGSL();
  assert.doesNotMatch(shader,/\bf32\s*\(/);
  assert.doesNotMatch(shader,/\b(?:sin|cos|sqrt|normalize|length)\s*\(/);
  assert.match(shader,/fn rc_f64_sqrt/);assert.match(shader,/fn rc_f64_to_f32_bits/);
  assert.match(shader,/rc_u128_round/);
});

// Root owns the serialized numerical GPU slot. This is never a silent pass when
// REQUIRE_WEBGPU=1: missing module/adapter/compilation/dispatch is a failure.
test('actual WebGPU integer binary64 matches native bits, including subnormal and midpoint cases',async t=>{
  if(!process.env.REQUIRE_WEBGPU)return t.skip('REQUIRE_WEBGPU=1 in the assigned serial GPU slot');
  assert.ok(process.env.GPU_NATIVE_MODULE,'GPU_NATIVE_MODULE required');
  const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
  const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter,'actual adapter required');
  const device=await adapter.requestDevice(),buffers=[];
  const stride=17,rows=cases(Number(process.env.SOURCE_NUMBER_GPU_RANDOM??1024)),input=Uint32Array.from(rows.flat());
  const shader=generateSourceNumberWGSL()+`
@group(0) @binding(0) var<storage,read> inputs:array<u32>;
@group(0) @binding(1) var<storage,read_write> outputs:array<u32>;
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let id=gid.x; if(id>=arrayLength(&inputs)/4u){return;}
 let i=id*4u;let o=id*${stride}u;let a=RcF64(inputs[i],inputs[i+1u]);let b=RcF64(inputs[i+2u],inputs[i+3u]);
 let aa=rc_f64_add(a,b);let ss=rc_f64_sub(a,b);let mm=rc_f64_mul(a,b);let dd=rc_f64_div(a,b);let sq=rc_f64_sqrt(a);let ff=rc_f64_from_f32_bits(a.x);
 outputs[o]=aa.x;outputs[o+1u]=aa.y;outputs[o+2u]=ss.x;outputs[o+3u]=ss.y;outputs[o+4u]=mm.x;outputs[o+5u]=mm.y;outputs[o+6u]=dd.x;outputs[o+7u]=dd.y;outputs[o+8u]=sq.x;outputs[o+9u]=sq.y;outputs[o+10u]=ff.x;outputs[o+11u]=ff.y;
 outputs[o+12u]=rc_f64_to_f32_bits(a);outputs[o+13u]=select(0u,1u,rc_f64_lt(a,b));outputs[o+14u]=select(0u,1u,rc_f64_eq(a,b));outputs[o+15u]=select(0u,1u,rc_f64_finite(a));outputs[o+16u]=1u;
}`;
  try {
    const module=device.createShaderModule({code:shader,label:'resident binary64 numerical gate'}),info=await module.getCompilationInfo();
    assert.deepEqual(info.messages.filter(x=>x.type==='error'),[]);
    const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
    const make=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};
    const src=make(input.byteLength,136),size=rows.length*stride*4,out=make(size,132),read=make(size,9);
    device.queue.writeBuffer(src,0,input);
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[src,out].map((buffer,binding)=>({binding,resource:{buffer}}))});
    const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(rows.length/32));pass.end();encoder.copyBufferToBuffer(out,0,read,0,size);device.queue.submit([encoder.finish()]);
    await read.mapAsync(1);const values=new Uint32Array(read.getMappedRange().slice(0));read.unmap();
    rows.forEach((row,i)=>{
      const x=wordsNumber(row.slice(0,2)),y=wordsNumber(row.slice(2)),v=values.subarray(i*stride,(i+1)*stride);
      for(const[k,expected]of[x+y,x-y,x*y,x/y,Math.sqrt(x),fromF32(row[0])].entries())same64(v.subarray(k*2,k*2+2),expected,`GPU case${i} operation${k} input${row}`);
      if(!Number.isNaN(x))assert.equal(v[12],f32bits(x),`GPU case${i} f32`);
      assert.equal(v[13],+(x<y),`GPU case${i} lt`);assert.equal(v[14],+(x===y),`GPU case${i} eq`);assert.equal(v[15],+Number.isFinite(x),`GPU case${i} finite`);assert.equal(v[16],1,`GPU case${i} completion`);
    });
    console.log(JSON.stringify({gate:'source-number-native',cases:rows.length,bitwise:true,nanPayloadChecked:false,hardwarePerformance:false}));
  } finally {buffers.forEach(b=>b.destroy());device.destroy();}
});
