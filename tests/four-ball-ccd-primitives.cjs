'use strict';
// Frozen original creation is the only seed. Later native state is assertion-only.
const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../src/experimental-ccd-bvh-state'),Bridge=require('../src/experimental-ccd-bvh-world-bridge');
const copy=x=>structuredClone(x);
function orderProtocol(){const Module=require('node:module'),fs=require('node:fs'),filename=require.resolve('../src/experimental-ccd-order-certificate'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m.require=n=>n==='./experimental-ccd-bvh-state'?B:{validate:q=>copy(q),reference:q=>({fraction:1,status:'NoImpact'})};m._compile(fs.readFileSync(filename,'utf8'),filename);return m.exports;}

test('source optimizer formula covers bounded three/four sphere domains',()=>{
 for(let n=22;n<=27;n++)for(const frame of[0,1,2,3,31,33]){const c=B.optimizationConfig(n,frame,27);assert.equal(c.targetRoot,Math.ceil(Math.sqrt(n)));assert.equal(c.targetSubtree,Math.ceil(4*Math.sqrt(n)));assert.equal(c.targetSubtreeCount,frame%2?0:1);}
 assert.throws(()=>B.optimizationConfig(28,0,27));
});
async function verifyOriginal(t,device){
 const file=process.env.FOUR_BALL_CREATION_REPLAY;if(!file)return t.skip('Explicit frozen original four-ball creation artifact required');
 const F=require('./four-ball-created-fixture.cjs'),E=require('./four-ball-broad-graph-seed.cjs');
 const {record}=F.loadArtifact(file),{broadSeed,own}=E.exportInitialSeeds({strikeCreated:record.boundaries.strikeCreated,modeCreationJournal:record.modeCreationJournal,strikeCreationJournal:record.strikeCreationJournal});
 const bridge=device?await Bridge.createGpuStage(device,broadSeed):await Bridge.createReferenceStage(broadSeed);
 try{bridge.begin();await bridge.collision(copy(own));await bridge.beforeQueries();const state=bridge.stage.preview();assert.equal(state.tree.leaf_node_indices.n,27);
 const expected=record.boundaries['firstH.postWorld'].state.broad_phase.tree;
 for(const k of['parents','leaf_node_indices','free_wide_nodes','optimization'])assert.deepEqual(state.tree[k],expected[k],'Original native first insertion '+k);
 const bounds={min:[-10,-10,-10],max:[10,10,10]},r=bridge.stage.query(bounds),view=B.assertQueryReceipt(r,bridge.stage,device?'webgpu':'cpu-reference',bounds);assert.equal(view.roster.moving.length,4);assert.deepEqual(view.roster.moving[3],['22:0','23:0']);assert.equal(view.leaves.length,27);
 if(!device){const protocol=orderProtocol(),context={stage:bridge.stage,receipt:r,bounds,movingColliderIds:view.roster.moving[3]},rows=[{id:'22:0/0:0',query:{maxFraction:1}}];assert.equal((await protocol.referenceOwned(rows,context)).admitted,true);await assert.rejects(()=>protocol.referenceOwned(rows,{...context,movingColliderIds:['22:1','23:1']}),/identity/);await assert.rejects(()=>protocol.referenceOwned([{id:'22:0/0:1',query:{maxFraction:1}}],context),/identity/);}
 bridge.commit();
 bridge.begin();await bridge.collision({...copy(own),cue:null,removedBodies:['shaft','head','guide'].map(k=>broadSeed.roles[k])});await bridge.beforeQueries();assert.equal(bridge.stage.preview().tree.leaf_node_indices.n,24);bridge.commit();
 bridge.begin();await assert.rejects(()=>bridge.stage.prepareUpdate({updates:[],removedLeaves:[22]}),/cue withdrawal/);bridge.abort();assert.equal(bridge.snapshot().tree.leaf_node_indices.n,24);return bridge.snapshot();
 }finally{bridge.abort();bridge.dispose();}
 }
let reference;
test('original fresh fourth sphere insertion and cue retirement retain exact protected roster',async t=>{reference=await verifyOriginal(t,null);});
test('actual WGSL four-ball primitive states equal reference',async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('Explicit serialized actual WGSL slot required');assert.ok(reference,'Reference frozen fixture must pass first');
 const {pathToFileURL}=require('node:url'),{create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice(),release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'four-ball-ccd-primitives');
 try{assert.deepEqual(await verifyOriginal(t,device),reference);}finally{release();}
});
