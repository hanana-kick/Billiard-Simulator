'use strict';
// Original source operations drive this COMPONENT test. World integration must
// independently derive them; future expected trees are never stage inputs.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const B=require('../src/experimental-ccd-bvh-state'),O=require('../src/experimental-ccd-order-certificate'),W=require('./multi-toi-original-source-witness.json');
async function run(device){
 const data=JSON.parse(fs.readFileSync(process.env.CCD_BVH_OPERATION_TRACE)),first=data.frames[0],updates=first.records.find(r=>r.operation.kind==='update').operation.updates,seed={sourceRevision:data.sourceRevision,sourcePipelineCompleted:true,initialSnapshotSha256:data.initialSnapshotSha256,initialBroadPhase:data.initialBroadPhase,modifiedColliders:updates.filter(u=>data.initialBroadPhase.tree.leaf_node_indices.v[u.leaf]==null).map(u=>({index:u.leaf,generation:0}))};
 const stage=device?await B.createGpuStage(device,seed):await B.createReferenceStage(seed),roster=W.groups[0].rows.map(r=>({id:r.id,pointsA:r.query.pointsA})),evaluator=device?await O.createGpuEvaluator(device,roster):null,results=[];let oldReceipt;
 try{for(const frame of data.frames){stage.begin();for(const row of frame.records){const op=row.operation;switch(op.kind){case 'update':{const {kind,...v}=op;await stage.prepareUpdate(v);break;}case 'join':await stage.joinDeferredOptimize();break;case 'setAabb':{const {kind,...v}=op;await stage.setAabbs([v]);break;}case 'query':{
   if(frame.h!==396||row.moving.index!==16)break;
   const group=W.groups.find(g=>g.phase===row.phase);assert.ok(group,'native pre/post group');const receipt=stage.query(op.sweptAabb),context={stage,receipt,bounds:op.sweptAabb,movingColliderIds:['16:0','17:0']},c=group.rows.map(({id,query})=>({id,query}));
   const actual=device?await evaluator.step(c,context):await O.referenceOwned(c,context),expected=Math.min(1,...group.rows.map(r=>r.sourceResult.fraction).filter(x=>Number.isFinite(x)&&x>0));
   assert.equal(actual.fraction,expected);assert.equal(actual.admitted,true);assert.deepEqual(actual.verification.map(x=>x.id),group.rows.map(x=>x.id));for(let i=0;i<group.rows.length;i++){assert.equal(actual.verification[i].bound,group.rows[i].sourceIncomingMaxFraction);assert.equal(actual.verification[i].result.fraction,group.rows[i].sourceResult.fraction);}
   await assert.rejects(()=>device?evaluator.step(c,{...context,receipt:{}}):O.referenceOwned(c,{...context,receipt:{}}),/query required/);
   await assert.rejects(()=>device?evaluator.step(c,{...context,movingColliderIds:['17:0']}):O.referenceOwned(c,{...context,movingColliderIds:['17:0']}),/identity/);
   if(!device){const pending=O.referenceOwned(c,context);const mutation=stage.joinDeferredOptimize();await assert.rejects(()=>O.referenceOwned(c,context),/query required/);await mutation;context.receipt=stage.query(op.sweptAabb);await assert.rejects(()=>pending,/query required/);}
   const wrongGeneration=c.map((r,i)=>i? r:{...r,id:r.id.replace(/:0$/,':999')});await assert.rejects(()=>device?evaluator.step(wrongGeneration,context):O.referenceOwned(wrongGeneration,context));await assert.rejects(()=>device?evaluator.step(c,{...context,movingColliderIds:['17:0','16:0']}):O.referenceOwned(c,{...context,movingColliderIds:['17:0','16:0']}),/identity/);
   oldReceipt={c,context};results.push({phase:row.phase,fraction:actual.fraction,verification:actual.verification});break;}
   default:throw Error('Unknown source operation');}}
 stage.commit();}
 assert.equal(results.length,2);await assert.rejects(()=>device?evaluator.step(oldReceipt.c,oldReceipt.context):O.referenceOwned(oldReceipt.c,oldReceipt.context),/query required/);return results;
 }finally{stage.abort();stage.dispose();evaluator?.dispose();}
}
let cpu;
test('owned recurrent BVH drives original current-bound corner casts, not a guessed ordering',{timeout:600000},async t=>{if(!process.env.CCD_BVH_OPERATION_TRACE)return t.skip('independent source operation trace required');cpu=await run();console.log(JSON.stringify({scope:'component-original-operations-not-owned-world',backend:'cpu',results:cpu.map(({phase,fraction})=>({phase,fraction}))}));});
test('actual WGSL ordered corner casts equal original native with owned recurrence',{timeout:600000},async t=>{if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('serialized actual WGSL slot required');assert.ok(cpu);const {create,globals}=await import(require('node:url').pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice(),release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'owned-bvh-sequential-corner');try{assert.deepEqual(await run(device),cpu);}finally{release();}});
