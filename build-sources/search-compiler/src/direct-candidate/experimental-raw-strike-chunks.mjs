/** Isolated execution experiment; no production/default changes. */
import {generateRawStrikePhases,validateStrikeScene,validateRawStrikes} from './deterministic-raw-strike.mjs';
const signature='@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>)';
export function generateFullStepRawStrikePhases(){
 const old=generateRawStrikePhases();
 if(old.map(p=>p.name).join(',')!=='initialize,clearance_pre,cue_contact,cloth_advance,clearance_post,finalize')throw Error('Unreviewed raw stage graph');
 let header=null;const bodies=[];
 for(let i=1;i<=4;i++){const at=old[i].code.indexOf(signature);if(at<0||old[i].code.indexOf(signature,at+1)>=0)throw Error('Exact entry signature required');const h=old[i].code.slice(0,at);if(header!==null&&h!==header)throw Error('Identical raw ABI/arithmetic header required');header=h;bodies.push(old[i].code.slice(at).replace(signature,`fn raw_phase_${i}(id:vec3<u32>)`));}
 const step={name:'complete_original_step',code:header+bodies.join('\n')+'\n'+signature+'{raw_phase_1(id);raw_phase_2(id);raw_phase_3(id);raw_phase_4(id);}'};
 return Object.freeze([old[0],step,old[5]]);
}
export async function createExperimentalFullStepRawStrikeGPU(device,{onCompileStage=()=>{}}={}){
 if(typeof onCompileStage!=='function')throw TypeError('Compile diagnostic callback');
 const start=performance.now(),phases=generateFullStepRawStrikePhases(),compiled=[],compileStages=[];
 for(const phase of phases){
  onCompileStage({name:phase.name,phase:'start',milliseconds:performance.now()});
  const began=performance.now(),module=device.createShaderModule({code:phase.code,label:'experimental-fullstep-strike-'+phase.name}),info=await module.getCompilationInfo();
  if(info.messages.some(x=>x.type==='error'))throw Error(phase.name+': '+info.messages.map(x=>x.message).join('\n'));
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
  compiled.push(pipeline);compileStages.push({name:phase.name,compileMs:performance.now()-began,shaderBytes:new TextEncoder().encode(phase.code).length});onCompileStage({...compileStages.at(-1),phase:'complete'});
 }
 return Object.freeze({experimental:true,compileMs:performance.now()-start,compileStages,
  createBank(scene,rows){
   validateStrikeScene(scene);validateRawStrikes(rows);
   const owned=[],make=(size,usage)=>{const buffer=device.createBuffer({size,usage});owned.push(buffer);return buffer;},count=rows.length/16,shared=make(scene.byteLength,136),input=make(rows.byteLength,136),result=make(count*128*4,132),scratch=make(count*32*4,128);
   const groups=compiled.map(pipeline=>device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[shared,input,result,scratch].map((buffer,binding)=>({binding,resource:{buffer}}))}));
   device.queue.writeBuffer(shared,0,scene);device.queue.writeBuffer(input,0,rows);
   let disposed=false,maxSteps=0;for(let b=0;b<rows.length;b+=16)maxSteps=Math.max(maxSteps,rows[b+2]);
   const dispatch=(encoder,index)=>{const pass=encoder.beginComputePass();pass.setPipeline(compiled[index]);pass.setBindGroup(0,groups[index]);pass.dispatchWorkgroups(Math.ceil(count/32));pass.end();};
   return Object.freeze({count,resultBuffer:result,resultWordStride:128,maximumSteps:maxSteps,dispatches:2+maxSteps,
    encode(encoder){if(disposed)throw Error('Disposed experimental raw bank');dispatch(encoder,0);for(let step=0;step<maxSteps;step++)dispatch(encoder,1);dispatch(encoder,2);},
    dispose(){if(!disposed){disposed=true;owned.forEach(b=>b.destroy());}}
   });
  },
  async run(scene,rows){
   const bank=this.createBank(scene,rows),read=device.createBuffer({size:bank.count*128*4,usage:9});
   try{const encoder=device.createCommandEncoder(),encodeStart=performance.now();bank.encode(encoder);const encodeMs=performance.now()-encodeStart;encoder.copyBufferToBuffer(bank.resultBuffer,0,read,0,read.size);const finishStart=performance.now(),command=encoder.finish(),finishMs=performance.now()-finishStart,submitStart=performance.now();device.queue.submit([command]);await read.mapAsync(1);const submitToReadMs=performance.now()-submitStart,result=new Uint32Array(read.getMappedRange()).slice();read.unmap();return{result,metrics:{experimental:true,candidates:bank.count,dispatches:bank.dispatches,encodeMs,finishMs,submitToReadMs,exactInteger:true,hostPhysicsBetweenPhases:false,sourcePhases:6,executionPhases:3}};}
   finally{read.destroy();bank.dispose();}
  }
 });
}
export function validateRawChunkSize(value){if(typeof value!=='number'||!Number.isInteger(value)||![8,16].includes(value))throw RangeError('Experimental raw chunk size must be exactly8 or16');return value;}
export function generateChunkedRawStrikePhases(){
 const full=generateFullStepRawStrikePhases(),call=signature+'{raw_phase_1(id);raw_phase_2(id);raw_phase_3(id);raw_phase_4(id);}';
 if(!full[1].code.endsWith(call))throw Error('Exact full-step entry required');
 const body=signature+`{let b=id.x*16u;if(b>=arrayLength(&rows)){return;}let o=id.x*128u;let z=id.x*32u;
 for(var iteration=0u;iteration<chunkControl[0u];iteration++){
  if(scratch[z+2u]!=0u||output[o+3u]>=rows[b+2u]){break;}
  raw_phase_1(id);raw_phase_2(id);raw_phase_3(id);raw_phase_4(id);
 }}`;
 const step={name:'runtime_chunked_original_steps',code:'@group(0) @binding(4) var<storage,read> chunkControl:array<u32>;\n'+full[1].code.slice(0,-call.length)+body};
 return Object.freeze([full[0],step,full[2]]);
}
export async function createExperimentalChunkedRawStrikeGPU(device,{onCompileStage=()=>{}}={}){
 if(typeof onCompileStage!=='function')throw TypeError('Compile diagnostic callback');
 const start=performance.now(),phases=generateChunkedRawStrikePhases(),compiled=[],compileStages=[];
 for(const phase of phases){
  onCompileStage({name:phase.name,phase:'start',milliseconds:performance.now()});
  const began=performance.now(),module=device.createShaderModule({code:phase.code,label:'experimental-chunked-strike-'+phase.name}),info=await module.getCompilationInfo();
  if(info.messages.some(x=>x.type==='error'))throw Error(phase.name+': '+info.messages.map(x=>x.message).join('\n'));
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
  compiled.push(pipeline);compileStages.push({name:phase.name,compileMs:performance.now()-began,shaderBytes:new TextEncoder().encode(phase.code).length});onCompileStage({...compileStages.at(-1),phase:'complete'});
 }
 return Object.freeze({experimental:true,compileMs:performance.now()-start,compileStages,
  createBank(scene,rows,{chunkSize=8}={}){
   validateRawChunkSize(chunkSize);
   validateStrikeScene(scene);validateRawStrikes(rows);
   const owned=[],make=(size,usage)=>{const buffer=device.createBuffer({size,usage});owned.push(buffer);return buffer;},count=rows.length/16,shared=make(scene.byteLength,136),input=make(rows.byteLength,136),result=make(count*128*4,132),scratch=make(count*32*4,128),control=make(4,136);
   const groups=compiled.map((pipeline,index)=>device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[shared,input,result,scratch,...(index===1?[control]:[])].map((buffer,binding)=>({binding,resource:{buffer}}))}));
   device.queue.writeBuffer(control,0,new Uint32Array([chunkSize]));device.queue.writeBuffer(shared,0,scene);device.queue.writeBuffer(input,0,rows);
   let disposed=false,maxSteps=0;for(let b=0;b<rows.length;b+=16)maxSteps=Math.max(maxSteps,rows[b+2]);
   const dispatch=(encoder,index)=>{const pass=encoder.beginComputePass();pass.setPipeline(compiled[index]);pass.setBindGroup(0,groups[index]);pass.dispatchWorkgroups(Math.ceil(count/32));pass.end();};
   return Object.freeze({count,resultBuffer:result,resultWordStride:128,maximumSteps:maxSteps,chunkSize,dispatches:2+Math.ceil(maxSteps/chunkSize),
    encode(encoder){if(disposed)throw Error('Disposed experimental raw bank');dispatch(encoder,0);for(let chunk=0;chunk<Math.ceil(maxSteps/chunkSize);chunk++)dispatch(encoder,1);dispatch(encoder,2);},
    dispose(){if(!disposed){disposed=true;owned.forEach(b=>b.destroy());}}
   });
  },
  async run(scene,rows,options){
   const bank=this.createBank(scene,rows,options),read=device.createBuffer({size:bank.count*128*4,usage:9});
   try{const encoder=device.createCommandEncoder(),encodeStart=performance.now();bank.encode(encoder);const encodeMs=performance.now()-encodeStart;encoder.copyBufferToBuffer(bank.resultBuffer,0,read,0,read.size);const finishStart=performance.now(),command=encoder.finish(),finishMs=performance.now()-finishStart,submitStart=performance.now();device.queue.submit([command]);await read.mapAsync(1);const submitToReadMs=performance.now()-submitStart,result=new Uint32Array(read.getMappedRange()).slice();read.unmap();return{result,metrics:{experimental:true,candidates:bank.count,dispatches:bank.dispatches,chunkSize:bank.chunkSize,encodeMs,finishMs,submitToReadMs,exactInteger:true,hostPhysicsBetweenPhases:false,sourcePhases:6,executionPhases:3}};}
   finally{read.destroy();bank.dispose();}
  }
 });
}
