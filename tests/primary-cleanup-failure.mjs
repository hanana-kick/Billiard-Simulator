import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {withCleanupFailure,isOwnedCleanupFailure} from '../build-sources/runtime/src/canonical-integer-transport/primary-cleanup-failure.mjs';
test('first genuine operation failure remains primary, cleanup is distinct and unverified',()=>{
 for(const message of ['Worker GPU lost: Device was destroyed.','Pipeline creation failed before device-lost callback']){
  const primary=Error(message),cleanup=Error('Worker endpoint unavailable');primary.deviceLoss=Object.freeze({reason:'destroyed',message:'Device was destroyed.'});
  const e=withCleanupFailure(primary,cleanup,'Initial Worker cleanup failed');assert.ok(e instanceof AggregateError);assert.equal(e.primaryFailure,primary);assert.equal(e.cause,primary);assert.deepEqual(e.errors,[primary,cleanup]);assert.ok(e.message.startsWith(message+'\n'));assert.match(e.message,/완료 미확인/);assert.equal(e.deviceLoss,primary.deviceLoss);assert.equal(e.cleanupVerified,false);assert.deepEqual(e.cleanupFailures,[{stage:'Initial Worker cleanup failed',message:cleanup.message}]);assert.equal(primary.message,message);assert.equal('cleanupVerified'in primary,false);
 }
});
test('nested cleanup wrappers preserve earliest primary and retain both secondary failures',()=>{
 const p=Error('first native failure'),one=Error('owner disposal failed'),two=Error('endpoint disposal failed');p.gpuPreparation={stage:'compile'};
 const a=withCleanupFailure(p,one,'owner'),b=withCleanupFailure(a,two,'endpoint');assert.equal(b.primaryFailure,p);assert.equal(b.cause,a);assert.equal(b.gpuPreparation,p.gpuPreparation);assert.equal(b.cleanupVerified,false);assert.equal(b.cleanupFailures.length,2);assert.ok(b.message.startsWith(p.message));assert.ok(Object.isFrozen(b.cleanupFailures));assert.ok(Object.isFrozen(b.cleanupFailures[0]));
});
test('actual production startup catch preserves primary on secondary endpoint cleanup rejection',async()=>{
 const source=await readFile(new URL('../build-sources/runtime/src/canonical-integer-transport/compiled-production-runtime.mjs',import.meta.url),'utf8');const start=source.indexOf('export async function createWasmGpuProductionRuntime(');assert.ok(start>0);
 for(const secondary of [false,true]){
  const primary=Error('original first pipeline/device failure'),cleanup=Error('dead endpoint cannot acknowledge retirement');let destroyed=0,created=0;
  const endpoint={destroy:async()=>{destroyed++;if(secondary)throw cleanup;}};
  const create=new Function('configuration','createSealedWorkerOwnerEndpoint','createComputeGenerationFacade','createWorkerGenerationRuntime','runtimes','withCleanupFailure',source.slice(start).replace('export async function','async function')+';return createWasmGpuProductionRuntime;')(()=>({}),async()=>{created++;return endpoint;},async()=>{throw primary;},()=>{throw Error('unreached');},new WeakMap(),withCleanupFailure);
  await assert.rejects(create(),e=>{if(secondary){assert.equal(e.primaryFailure,primary);assert.equal(e.cleanupVerified,false);assert.ok(e.message.startsWith(primary.message));assert.deepEqual(e.errors,[primary,cleanup]);}else assert.equal(e,primary);return true;});assert.equal(created,1);assert.equal(destroyed,1);
 }
});
test('all initial generation cleanup sites preserve their caught primary without changing cleanup order',async()=>{
 const s=await readFile(new URL('../build-sources/runtime/src/canonical-integer-transport/compiled-production-runtime.mjs',import.meta.url),'utf8');
 assert.match(s,/catch\(error\)\{try\{await destroy\(item\);\}catch\(cleanup\)\{throw withCleanupFailure\(error,cleanup,'Prepared owner cleanup failed'\);\}throw error;\}/);
 assert.match(s,/try\{await search.dispose\(\);await selected.dispose\(\);await coordinator.dispose\(\);\}catch\(cleanup\)\{throw withCleanupFailure\(error,cleanup,'Initial generation cleanup failed'\);\}throw error;/);
});

test('preparation diagnostics added after first cleanup wrapper survive outer retirement failure',()=>{const p=Error('first failure'),a=withCleanupFailure(p,Error('owner cleanup'),'owner');a.gpuPreparation=Object.freeze({stage:'compile'});const b=withCleanupFailure(a,Error('endpoint cleanup'),'endpoint');assert.equal(b.primaryFailure,p);assert.equal(b.gpuPreparation,a.gpuPreparation);assert.equal(b.cleanupFailures.length,2);});

test('frozen ordinary unverified error is not mutated or mistaken for owned cleanup aggregate',async()=>{
 const original=Object.freeze(Object.assign(Error('frozen first GPU failure'),{cleanupVerified:false}));assert.equal(isOwnedCleanupFailure(original),false);
 const source=await readFile(new URL('../build-sources/runtime/src/canonical-integer-transport/compiled-production-runtime.mjs',import.meta.url),'utf8'),start=source.indexOf('   if(isOwnedCleanupFailure(error))'),end=source.indexOf('\n  }finally{scope.dispose();}',start);assert.ok(start>0&&end>start);
 const format=new Function('error','diagnostic','isOwnedCleanupFailure',source.slice(start,end)),diagnostic={program:'selected',stage:'compile',elapsedMs:10};
 assert.throws(()=>format(original,diagnostic,isOwnedCleanupFailure),e=>{assert.notEqual(e,original);assert.equal(e.cause,original);assert.equal(e.cleanupVerified,false);assert.match(e.message,/frozen first GPU failure/);assert.equal(e.gpuPreparation,diagnostic);return true;});assert.equal(Object.hasOwn(original,'gpuPreparation'),false);
});
