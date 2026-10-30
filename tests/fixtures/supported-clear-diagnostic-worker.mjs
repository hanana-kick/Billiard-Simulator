/** Test-only isolated replay of ACTUAL GPU intermediate inputs, not a CPU oracle. */
export const FIXTURE_SHA256='cd1729d2c94a900f022d8ecbfd9f58466084450dc8d1af41fbf7b02113f1e238';
export const SHADER_SHA256='95541ac4ad5d0e0df6b5db610127b784a9946a9057a4335313e96fa642e99a22';
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
export function deriveSupportedClearCases(f){
 const declarations=f.shader.match(/@group\(0\) @binding\(\d\) var<storage,[^;]+;/g);
 if(declarations?.length!==4||f.entryPoint!=='main'||JSON.stringify(f.dispatch)!=='[1,1,1]'||f.layout!=='auto')throw Error('Frozen four-binding direct dispatch required');
 const start=f.shader.indexOf('@compute @workgroup_size(1) fn main(){'),end=f.shader.indexOf('let n=u32(state[3]);',start);
 if(start<0||end<start)throw Error('Exact early guard boundary required');
 const prefix=declarations.join('\n')+'\n'+f.shader.slice(start,end)+'}';
 const probe=declarations.join('\n')+'\n@compute @workgroup_size(1) fn main(){state[62]=dense[0]^segments[0]^ctx[0];state[63]=0x13579bdf;}';
 return [{name:'original-auto',code:f.shader,explicit:false},{name:'original-explicit',code:f.shader,explicit:true},{name:'early-guard-explicit',code:prefix,explicit:true},{name:'binding-invocation-probe',code:probe,explicit:true}];
}
export async function validateSupportedClearFixture(f){
 if(f.shaderSHA256!==SHADER_SHA256||await sha(new TextEncoder().encode(f.shader))!==SHADER_SHA256||f.inputs?.length!==4)throw Error('Frozen shader/input identity required');
 for(const [i,r] of f.inputs.entries()){if(r.binding!==i||r.words.length!==[256,256,256,160][i]||r.words.some(n=>!Number.isInteger(n)||n<0||n>0xffffffff)||await sha(new Uint8Array(Uint32Array.from(r.words).buffer))!==r.sha256)throw Error('Exact captured buffer words/hash required');}
 const s=f.inputs[0].words;if(s[1]!==0||s[3]!==4||s[40]!==0||s[200]!==3)throw Error('Independent early-branch precondition required');
 return deriveSupportedClearCases(f);
}
let used=false;
if(typeof self!=='undefined'&&typeof self.postMessage==='function')self.onmessage=async()=>{
 if(used)return;used=true;let device,adapterEvidence=null;
 const result={kind:'isolated-supported-clear-native-v1',applicationPass:false,gpuConditionedInput:true,independentCPUExpected:false,cases:[],gpuErrors:[]};
 try{
  const bytes=new Uint8Array(await(await fetch(new URL('./fixture.json',import.meta.url))).arrayBuffer());if(await sha(bytes)!==FIXTURE_SHA256)throw Error('Fixture bytes changed');
  const f=JSON.parse(new TextDecoder().decode(bytes)),cases=await validateSupportedClearFixture(f);result.fixtureSHA256=FIXTURE_SHA256;result.originalShaderSHA256=SHADER_SHA256;result.inputHashes=f.inputs.map(r=>r.sha256);result.provenance=f.provenance;
  const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw Error('Native Worker WebGPU unavailable');const info=adapter.info??{};adapterEvidence={vendor:info.vendor??'',architecture:info.architecture??'',device:info.device??'',description:info.description??'',isFallbackAdapter:info.isFallbackAdapter??adapter.isFallbackAdapter??null,maxStorageBuffersPerShaderStage:adapter.limits.maxStorageBuffersPerShaderStage};
  result.requiredLimits={maxStorageBuffersPerShaderStage:10};device=await adapter.requestDevice({requiredLimits:result.requiredLimits});result.deviceLimits={maxStorageBuffersPerShaderStage:device.limits.maxStorageBuffersPerShaderStage};device.addEventListener('uncapturederror',e=>result.gpuErrors.push(e.error.message));
  for(const c of cases){
   self.postMessage({event:'progress',case:c.name});const buffers=[];let read;
   for(const filter of ['validation','internal','out-of-memory'])device.pushErrorScope(filter);
   let failure,row;
   try{
    const module=device.createShaderModule({code:c.code}),compilation=await module.getCompilationInfo();if(compilation.messages.some(m=>m.type==='error'))throw Error(compilation.messages.map(m=>m.message).join('\n'));
    const entries=[0,1,2,3].map(binding=>({binding,visibility:4,buffer:{type:binding<2?'storage':'read-only-storage'}}));
    const layout=c.explicit?device.createPipelineLayout({bindGroupLayouts:[device.createBindGroupLayout({entries})]}):'auto';
    const pipeline=await device.createComputePipelineAsync({layout,compute:{module,entryPoint:f.entryPoint}});
    for(const input of f.inputs){const b=device.createBuffer({size:input.words.length*4,usage:128|8|4});buffers.push(b);device.queue.writeBuffer(b,0,Uint32Array.from(input.words));}
    read=device.createBuffer({size:3712,usage:1|8});const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:buffers.map((buffer,binding)=>({binding,resource:{buffer,offset:0,size:f.inputs[binding].words.length*4}}))});
    const e=device.createCommandEncoder(),pass=e.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1,1,1);pass.end();let offset=0;for(const [i,b]of buffers.entries()){e.copyBufferToBuffer(b,0,read,offset,f.inputs[i].words.length*4);offset+=f.inputs[i].words.length*4;}
    device.queue.submit([e.finish()]);await device.queue.onSubmittedWorkDone();await read.mapAsync(1);const words=new Uint32Array(read.getMappedRange()).slice();read.unmap();
    let at=0;const outputs=f.inputs.map(input=>{const out=Array.from(words.slice(at,at+input.words.length));at+=input.words.length;return out;});
    const expected=f.inputs.map(r=>r.words.slice());if(c.name==='binding-invocation-probe'){expected[0][62]=(expected[1][0]^expected[2][0]^expected[3][0])>>>0;expected[0][63]=0x13579bdf;}else{expected[0][1]=7;expected[0][2]=6;}
    const differences=[];for(let b=0;b<4;b++)for(let i=0;i<outputs[b].length;i++)if(outputs[b][i]!==expected[b][i])differences.push({binding:b,word:i,expected:expected[b][i],actual:outputs[b][i]});
    row={name:c.name,shaderSHA256:await sha(new TextEncoder().encode(c.code)),explicitLayout:c.explicit,dispatch:[1,1,1],outputs,expectedEarlyBranch:c.name==='binding-invocation-probe'?null:[7,6],matchesExpected:differences.length===0,differences};
   }catch(e){failure=e;}finally{read?.destroy();for(const b of buffers)b.destroy();for(let i=0;i<3;i++){const error=await device.popErrorScope();if(error)failure??=Error(error.message);}}
   if(failure)throw failure;result.cases.push(row);
  }
  result.adapter=adapterEvidence;result.pass=result.cases.every(c=>c.matchesExpected)&&result.gpuErrors.length===0;
 }catch(e){result.adapter=adapterEvidence;result.error={name:e.name,message:e.message,stack:e.stack};}finally{device?.destroy();}
 self.postMessage({event:result.error?'error':'result',result});
};
