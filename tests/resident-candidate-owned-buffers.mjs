// HOST-only ordinary-browser admission regression. No GPU or physics execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {isOwnedUint32Array,packCandidates,unpackCandidates,initialResults,decodeResults,STATUS,REASON,UNSET} from '../src/resident-candidate/abi.mjs';
import {createResidentCompactTransaction} from '../src/resident-candidate/batch-protocol.mjs';
const settings={angle:1.25,elevation:8,speed:2,tipX:-0,tipY:.1};
const packed=()=>packCandidates([{id:17,settings}],{selectedIndex:0});
const terminal=()=>new Uint32Array([17,STATUS.UNSUPPORTED,UNSET,REASON.PHYSICS_SCOPE]);
const journal=input=>{const identity={sourceIdentity:'source',preStrikeIdentity:'prestrike',generationIdentity:'generation'};return createResidentCompactTransaction({input,banks:[{first:0,count:1}],identity,getIdentity:()=>identity});};

test('positive non-shared backing-store admission preserves normal ABI/journal behavior',()=>{
 const input=packed();assert.equal(isOwnedUint32Array(input),true);assert.deepEqual(unpackCandidates(input),[{id:17,settings,selectedIndex:0,ruleId:0}]);assert.equal(initialResults(input)[1],STATUS.PENDING);
 assert.equal(decodeResults(terminal(),[17])[0].pass,null);const j=journal(input);j.stage(j.bankReceipts[0],terminal());assert.equal(j.commit().results[0].id,17);
 for(const bad of[null,{},new ArrayBuffer(16),new Int32Array(4),new Float32Array(4)])assert.equal(isOwnedUint32Array(bad),false);
 const spoofedInt=new Int32Array(4);Object.setPrototypeOf(spoofedInt,Uint32Array.prototype);assert.equal(isOwnedUint32Array(spoofedInt),false,'intrinsic Uint32Array brand required');
 const foreignOrdinary=runInNewContext('new ArrayBuffer(64)'),foreignShared=runInNewContext('new SharedArrayBuffer(64)');assert.equal(isOwnedUint32Array(new Uint32Array(foreignOrdinary)),true,'local view with genuine cross-realm ordinary backing');assert.equal(isOwnedUint32Array(new Uint32Array(foreignShared)),false,'cross-realm shared backing still rejected');assert.equal(isOwnedUint32Array(runInNewContext('new Uint32Array(16)')),false,'existing same-realm view contract preserved');
});
test('actual shared-backed inputs/results reject even with spoofed buffer property or backing prototype',()=>{
 const sharedInput=new Uint32Array(new SharedArrayBuffer(64)),sharedResult=new Uint32Array(new SharedArrayBuffer(16));sharedInput.set(packed());sharedResult.set(terminal());
 for(const spoof of['none','buffer-property','backing-prototype']){
  if(spoof==='buffer-property'){Object.defineProperty(sharedInput,'buffer',{value:new ArrayBuffer(64),configurable:true});Object.defineProperty(sharedResult,'buffer',{value:new ArrayBuffer(16),configurable:true});}
  if(spoof==='backing-prototype'){delete sharedInput.buffer;delete sharedResult.buffer;Object.setPrototypeOf(sharedInput.buffer,ArrayBuffer.prototype);Object.setPrototypeOf(sharedResult.buffer,ArrayBuffer.prototype);}
  assert.equal(isOwnedUint32Array(sharedInput),false);assert.equal(isOwnedUint32Array(sharedResult),false);assert.throws(()=>unpackCandidates(sharedInput),TypeError);assert.throws(()=>initialResults(sharedInput),TypeError);assert.throws(()=>decodeResults(sharedResult,[17]),TypeError);assert.throws(()=>journal(sharedInput),TypeError);const j=journal(packed());assert.throws(()=>j.stage(j.bankReceipts[0],sharedResult),/owned compact ABI words/);assert.equal(j.phase,'invalid');
 }
});
test('modules imported without any SharedArrayBuffer global handle normal transport and reject saved shared storage',()=>{
 const abi=new URL('../src/resident-candidate/abi.mjs',import.meta.url).href,protocol=new URL('../src/resident-candidate/batch-protocol.mjs',import.meta.url).href;
 const code=`
 import assert from 'node:assert/strict';
 const SavedSharedArrayBuffer=globalThis.SharedArrayBuffer;
 const sharedInput=new Uint32Array(new SavedSharedArrayBuffer(64));
 const sharedResult=new Uint32Array(new SavedSharedArrayBuffer(16));
 delete globalThis.SharedArrayBuffer;
 assert.equal('SharedArrayBuffer' in globalThis,false);
 const {isOwnedUint32Array,packCandidates,unpackCandidates,initialResults,decodeResults,STATUS,REASON,UNSET}=await import(${JSON.stringify(abi)});
 const {createResidentCompactTransaction}=await import(${JSON.stringify(protocol)});
 const settings={angle:1.25,elevation:8,speed:2,tipX:-0,tipY:.1};
 const input=packCandidates([{id:17,settings}],{selectedIndex:0});
 const output=new Uint32Array([17,STATUS.UNSUPPORTED,UNSET,REASON.PHYSICS_SCOPE]);
 const identity={sourceIdentity:'source',preStrikeIdentity:'prestrike',generationIdentity:'generation'};
 const journal=words=>createResidentCompactTransaction({input:words,banks:[{first:0,count:1}],identity,getIdentity:()=>identity});
 assert.equal(isOwnedUint32Array(input),true);
 assert.deepEqual(unpackCandidates(input),[{id:17,settings,selectedIndex:0,ruleId:0}]);
 assert.equal(initialResults(input)[1],STATUS.PENDING);
 assert.equal(decodeResults(output,[17])[0].pass,null);
 const valid=journal(input);valid.stage(valid.bankReceipts[0],output);assert.equal(valid.commit().results[0].id,17);
 sharedInput.set(input);sharedResult.set(output);
 assert.equal(isOwnedUint32Array(sharedInput),false);assert.equal(isOwnedUint32Array(sharedResult),false);
 assert.throws(()=>unpackCandidates(sharedInput),TypeError);
 assert.throws(()=>initialResults(sharedInput),TypeError);
 assert.throws(()=>decodeResults(sharedResult,[17]),TypeError);
 assert.throws(()=>journal(sharedInput),TypeError);
 const invalid=journal(input);assert.throws(()=>invalid.stage(invalid.bankReceipts[0],sharedResult),/owned compact ABI words/);
 assert.equal(invalid.phase,'invalid');
 console.log('absent-global ABI and compact journal admission passed');
 `;
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr||result.error?.message);assert.match(result.stdout,/absent-global ABI and compact journal admission passed/);
});
