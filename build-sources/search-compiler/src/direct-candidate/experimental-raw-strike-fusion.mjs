/** Opt-in execution-only experiment. Original raw engine/default is unchanged.
 * Fuse two consecutive candidate-local stage bodies without rewriting their
 * arithmetic, storage transitions, error bits or early-return guards. */
import {generateRawStrikePhases,validateStrikeScene,validateRawStrikes} from './deterministic-raw-strike.mjs';
export function generateFusedRawStrikePhases(){
 const stages=generateRawStrikePhases();
 if(stages.map(p=>p.name).join(',')!=='initialize,clearance_pre,cue_contact,cloth_advance,clearance_post,finalize')throw Error('Unreviewed raw stage graph');
 const signature='@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>)';
 const extract=(stage,name)=>{const at=stage.code.indexOf(signature);if(at<0||stage.code.indexOf(signature,at+1)>=0)throw Error('Exact raw stage entry required');return{header:stage.code.slice(0,at),body:stage.code.slice(at).replace(signature,`fn ${name}(id:vec3<u32>)`)};};
 const advance=extract(stages[3],'fused_cloth_advance'),post=extract(stages[4],'fused_clearance_post');
 if(advance.header!==post.header)throw Error('Identical stage arithmetic/ABI header required');
 const fused={name:'cloth_advance_clearance_post',code:advance.header+advance.body+'\n'+post.body+'\n'+signature+'{fused_cloth_advance(id);fused_clearance_post(id);}'};
 return Object.freeze([stages[0],stages[1],stages[2],fused,stages[5]]);
}
export async function createExperimentalFusedRawStrikeGPU(device,{onCompileStage=()=>{}}={}){
 if(typeof onCompileStage!=='function')throw TypeError('Compile diagnostic callback');
 const start=performance.now(),phases=generateFusedRawStrikePhases(),compiled=[],compileStages=[];
 for(const phase of phases){
  onCompileStage({name:phase.name,phase:'start',milliseconds:performance.now()});
  const began=performance.now(),module=device.createShaderModule({code:phase.code,label:'experimental-fused-strike-'+phase.name}),info=await module.getCompilationInfo();
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
   return Object.freeze({count,resultBuffer:result,resultWordStride:128,maximumSteps:maxSteps,dispatches:2+3*maxSteps,
    encode(encoder){if(disposed)throw Error('Disposed experimental raw bank');dispatch(encoder,0);for(let step=0;step<maxSteps;step++)for(let phase=1;phase<4;phase++)dispatch(encoder,phase);dispatch(encoder,4);},
    dispose(){if(!disposed){disposed=true;owned.forEach(b=>b.destroy());}}
   });
  },
  async run(scene,rows){
   const bank=this.createBank(scene,rows),read=device.createBuffer({size:bank.count*128*4,usage:9});
   try{const encoder=device.createCommandEncoder(),encodeStart=performance.now();bank.encode(encoder);const encodeMs=performance.now()-encodeStart;encoder.copyBufferToBuffer(bank.resultBuffer,0,read,0,read.size);const finishStart=performance.now(),command=encoder.finish(),finishMs=performance.now()-finishStart,submitStart=performance.now();device.queue.submit([command]);await read.mapAsync(1);const submitToReadMs=performance.now()-submitStart,result=new Uint32Array(read.getMappedRange()).slice();read.unmap();return{result,metrics:{experimental:true,candidates:bank.count,dispatches:bank.dispatches,encodeMs,finishMs,submitToReadMs,exactInteger:true,hostPhysicsBetweenPhases:false,sourcePhases:6,executionPhases:5}};}
   finally{read.destroy();bank.dispose();}
  }
 });
}
