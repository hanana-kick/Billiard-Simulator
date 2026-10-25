'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {completionEvidence,parseTestJsonLine}=require('./run-cue-input-full-shot.cjs');
function complete(backend='gpu'){return {backend,code:0,signal:null,spawnError:null,intentionalInterrupt:false,resultRows:[{backend:backend==='cpu'?'cpu-reference':'actual-webgpu',status:'rest-complete',fullShot:true}],sourceHashRows:[{sourceHashCheckCompleted:true,sourceHashes:{'src/world.js':'a'.repeat(64)}}]};}
test('supervisor requires typed selected backend completion and completed source hashes',()=>{for(const backend of['cpu','gpu'])assert.deepEqual(completionEvidence(complete(backend)),{passed:true,reasons:[]});});
test('exit zero, skipped/duplicate/incorrect result, or missing after-hook is not gate success',()=>{
  const changes=[{resultRows:[]},{resultRows:[...complete().resultRows,...complete().resultRows]},{resultRows:[{backend:'cpu-reference',status:'rest-complete',fullShot:true}]},{resultRows:[{backend:'actual-webgpu',status:'unsupported-boundary',fullShot:false}]},{resultRows:[{backend:'actual-webgpu',status:'rest-complete'}]},{sourceHashRows:[]},{sourceHashRows:[{sourceHashes:{a:'a'.repeat(64)}}]},{sourceHashRows:[{sourceHashCheckCompleted:true,sourceHashes:{}}]},{sourceHashRows:[{sourceHashCheckCompleted:true,sourceHashes:{a:'bad'}}]},{sourceHashRows:[...complete().sourceHashRows,...complete().sourceHashRows]}];
  for(const change of changes)assert.equal(completionEvidence({...complete(),...change}).passed,false,JSON.stringify(change));
});
test('abnormal exit, signal, spawn failure, and intentional interruption preserve failure',()=>{for(const change of[{code:1},{code:null,signal:'SIGKILL'},{signal:'SIGTERM'},{spawnError:{message:'failure'}},{intentionalInterrupt:true}])assert.equal(completionEvidence({...complete(),...change}).passed,false);});

test('typed records exclude duplicated JSON inside TAP assertion error bodies',()=>{const row={status:'unsupported-boundary',backend:'actual-webgpu',fullShot:false},json=JSON.stringify(row);assert.deepEqual(parseTestJsonLine('# '+json),row);for(const line of['    '+json,'error: '+json,json,'# not json'])assert.equal(parseTestJsonLine(line),null);});
