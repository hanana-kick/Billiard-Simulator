import fs from 'node:fs';import v8 from 'node:v8';import assert from 'node:assert/strict';
import {hydrateCanonicalSelectedV2GPUTrace,hydrateSelectedPreparedV2GPUTrace} from '../../src/direct-candidate/canonical-selected-world-trace-v2-hydrate.mjs';
import {exportSelectedShotTraceRecords} from '../../src/direct-candidate/canonical-selected-trace.mjs';
import {sampleMixedMotionV2CPU} from '../../src/direct-candidate/deterministic-mixed-motion-v2.mjs';
import {runClothMicrotailsCPU} from '../../src/direct-candidate/deterministic-cloth-microtail.mjs';
assert.throws(()=>sampleMixedMotionV2CPU(),/SOURCE_DYNAMICS_FORBIDDEN/);assert.throws(()=>runClothMicrotailsCPU(),/FORBIDDEN/);
const name=process.argv[2];assert.ok(['raw','0.2','0.1','2'].includes(name));let receipt,dump;
if(name==='raw'){const {mmq2RawFixture}=await import('./canonical-selected-mmq2-raw.mjs');dump=v8.deserialize(fs.readFileSync('/tmp/swg2-native-raw-dump.v8'));receipt=hydrateCanonicalSelectedV2GPUTrace({...mmq2RawFixture(),...dump,maximumRecords:256});}
else{dump=v8.deserialize(fs.readFileSync('/tmp/swg2-prepared-'+name+'.v8'));receipt=hydrateSelectedPreparedV2GPUTrace({...dump,maximumRecords:256});}
assert.deepEqual(receipt.adapterErrors,[]);assert.equal(receipt.captureComplete,true);assert.deepEqual(exportSelectedShotTraceRecords(receipt.trace),dump.expected);console.log(JSON.stringify({case:name,records:receipt.trace.recordCount,cpuDynamicsAndSamplingForbidden:true,physicsResultComplete:receipt.physicsResultComplete}));
