import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createOriginalClearanceFixtures} from './direct-clearance-original-fixtures.mjs';
import {createRawPoseBank,decodePose,outwardBoundF32} from '../src/direct-candidate/raw-pose.mjs';
test('shared bounds are outward-rounded, including signed near-zero',()=>{
 for(const v of [-9.99999999,-.1,-1e-50,-0,0,1e-50,.1,9.99999999]){assert.ok(outwardBoundF32(v,true)<=v);assert.ok(outwardBoundF32(v,false)>=v);}
});
test('full-roster conservative swept clearance: original agreement for admitted rows, unresolved never blocked/miss',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:60000},async t=>{
 const original=await createOriginalClearanceFixtures();const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();const scenes=[];let accepted=0,unsupported=0,disagreements=0;
 try{for(const entry of original.scenes){
  const bank=await createRawPoseBank(device,entry.scene,entry.fixtures.map(f=>f.input));
  try{const run=await bank.initialize(),words=await bank.readDiagnostic(),rows=[];for(const [i,f]of entry.fixtures.entries()){
   const actual=decodePose(words,i);assert.equal(actual.status,4,'no physical integration authority');assert.equal(actual.pass,null);
   const certificate=actual.clearance.code===1;if(certificate){accepted++;if(!f.expected.clearance.clear)disagreements++;assert.equal(actual.clearance.pairs,entry.scene.obstacles.length*3-1,'all obstacle/part pairs checked, selected-tip only exempt');}else{unsupported++;assert.equal(actual.clearance.code,2,'explicit unresolved overlap');}
   rows.push({name:f.name,certificate:certificate?'separated':'unsupported-overlap',originalClear:f.expected.clearance.clear,originalObstacle:f.expected.clearance.obstacle,...actual.clearance});
  }scenes.push({name:entry.name,obstacleCount:entry.scene.obstacles.length,selectedIndex:entry.scene.selectedIndex,metrics:bank.metrics,...run,rows});
  }finally{bank.dispose();}
 }
 assert.ok(accepted>0,'no vacuous all-unsupported coverage');assert.ok(unsupported>0,'unresolved overlap cases tested');assert.equal(disagreements,0,'no false clearance admission');
 const receipt={accepted,unsupported,disagreements,scenes,guardMeters:.005,exactSignedDistanceOrCastShape:false,physicalIntegration:false,productionEnabled:false,hardwareSpeedClaim:false,referenceProvenance:original.provenance};t.diagnostic(JSON.stringify(receipt));if(process.env.DIRECT_CLEARANCE_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DIRECT_CLEARANCE_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
