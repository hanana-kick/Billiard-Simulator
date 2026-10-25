'use strict';
// Test-only exposure of the real shared-core branch code. No production API
// accepts injected query/world state; only these bounded control-state fixtures do.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const file=require.resolve('../src/experimental-cue-obstacle-contact'),source=fs.readFileSync(file,'utf8'),moduleForTest={exports:{}};
const returnOld='return {init,gjk_step,epa,finish}',returnNew='return {init,gjk_step,epa,finish,epa_heap_push,epa_require_heap,epa_require_silhouette,epa_require_new_faces,epa_miss}';
assert.equal(source.split(returnOld).length,2);
const exportOld="if(typeof module!=='undefined')module.exports=api;",exportNew="if(typeof module!=='undefined')module.exports={...api,testOnly:{interpreter,decode,decodeTermination}};";
assert.equal(source.split(exportOld).length,2);
vm.runInNewContext(source.replace(returnOld,returnNew).replace(exportOld,exportNew),{module:moduleForTest,require:createRequire(file),Float32Array,Math,Number,Array,Object,Map,Error,TypeError,RangeError},{filename:file+'#test-only-control-state'});
const Q=moduleForTest.exports;
const pair={shape1:{type:'cylinder',halfHeight:.615,radius:.011},shape2:{type:'box',halfExtents:[.4,.08,.3]},position1:[.412,.03,.02],position2:[0,0,0],rotation1:[0,0,0,1],rotation2:[0,0,0,1],prediction:.1};
function prepared(name){const p=structuredClone(pair),packed=Q.packQuery(p),state=new Float32Array(Q.STATE_FLOATS),output=new Float32Array(Q.OUTPUT_FLOATS),core=Q.testOnly.interpreter(state,packed.input,output,packed.hulls);core.init();let cpu,stage='epa',call;
 if(name==='gjk-cap'){state[7]=99;stage='gjk';call='gjk_step();';cpu=()=>core.gjk_step();}
 else if(name==='epa-heap-distance'){state[0]=2;state[205]=0;call='epa_heap_push(0,1.0);';cpu=()=>core.epa_heap_push(0,1);}
 else if(name==='epa-empty-heap'){state[0]=2;state[202]=0;call='let ignored:bool=epa_require_heap();';cpu=()=>core.epa_require_heap();}
 else if(name==='epa-empty-silhouette'){state[0]=2;state[203]=0;call='let ignored:bool=epa_require_silhouette();';cpu=()=>core.epa_require_silhouette();}
 else if(name==='epa-no-new-face'){state[0]=2;state[201]=4;call='let ignored:bool=epa_require_new_faces(4);';cpu=()=>core.epa_require_new_faces(4);}
 else if(name==='zero-uncompleted'){call=null;cpu=()=>{};}
 else throw Error('Unknown control-state fixture '+name);
 return{name,pair:p,...packed,state,output,core,cpu,stage,call};
}
const CASES=Object.freeze(['gjk-cap','epa-heap-distance','epa-empty-heap','epa-empty-silhouette','epa-no-new-face','zero-uncompleted']);
function decode(output,prediction){return{contact:Q.testOnly.decode(output),termination:Q.testOnly.decodeTermination(output,0,prediction)};}
function runReference(name){const x=prepared(name);x.cpu();if(x.call)x.core.finish();return {...x,result:decode(x.output,x.pair.prediction)};}
async function runGpu(device,name){const x=prepared(name),owned=[],buf=(n,u)=>{const b=device.createBuffer({size:n,usage:u});owned.push(b);return b;};try{const input=buf(x.input.byteLength,136),state=buf(x.state.byteLength,136),out=buf(x.output.byteLength,132),hulls=buf(x.hulls.byteLength,136),read=buf(x.output.byteLength,9),buffers=[input,state,out,hulls];device.queue.writeBuffer(input,0,x.input);device.queue.writeBuffer(state,0,x.state);device.queue.writeBuffer(hulls,0,x.hulls);const enc=device.createCommandEncoder();let dispatches=0;if(x.call){for(const finish of[false,true]){let code=Q.generateWGSL(finish?'finish':x.stage);if(!finish){const target=x.stage==='gjk'?'gjk_step':'epa';const old='query_id=i32(gid.x);'+target+'();';assert.equal(code.split(old).length,2);code=code.replace(old,'query_id=i32(gid.x);'+x.call);}const shader=device.createShaderModule({code}),info=await shader.getCompilationInfo();assert.ok(!info.messages.some(m=>m.type==='error'),info.messages.map(m=>m.message).join('\n'));const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:shader,entryPoint:'main'}}),indices=finish?[0,1,2]:x.stage==='gjk'?[0,1,3]:[1],group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:indices.map(binding=>({binding,resource:{buffer:buffers[binding]}}))}),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();dispatches++;}}
 enc.copyBufferToBuffer(out,0,read,0,x.output.byteLength);device.queue.submit([enc.finish()]);await read.mapAsync(1);const raw=new Float32Array(read.getMappedRange().slice(0));read.unmap();return{result:decode(raw,x.pair.prediction),raw,actualDispatches:dispatches};}finally{owned.forEach(b=>b.destroy());}}
module.exports={Q,CASES,prepared,decode,runReference,runGpu};
