/* SPDX-License-Identifier: Apache-2.0
 * Read-only regeneration against an independently frozen initial-only artifact.
 * No GPU, forward simulation, runtime buffer restore or artifact writes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {deserialize} from 'node:v8';
import {createHash as nodeHash} from 'node:crypto';
import {createHash} from '../src/resident-candidate/source-sha256.mjs';
import {composeWorldMicrocodeSource} from '../src/resident-candidate/world-microcode-source.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {generateMicrocodeVmWGSL,generateMicrocodeExternalWGSL} from '../src/resident-candidate/microcode-vm.mjs';
import {macroLaunchDataSha256,createMacroLaunchProfile} from '../src/resident-candidate/macro-launch-profile.mjs';
const directory=process.env.RESIDENT_SHA_IDENTITY_ARTIFACTS;
const hashes=Object.freeze({
 'source.wgsl':'c2aded677c03f8db550530c39df80a5591057f892a2f44aa4f6fe99d956baa20',
 'source-receipt.json':'49de718120fea364dc9bffd099eb7876339018dd00ff4664635684fdea81ec33',
 'compiled.v8':'8c1075bc06dfcb28cb45c27f89ebac98d892fddba806526d8f1c287252d15cf5',
 'runtime.v8':'780872cc0105e20375dcbd2f84a2e1962176133feefb23fdaa0a0778b312b4de',
});
const sha=x=>nodeHash('sha256').update(x).digest('hex');
test('frozen fresh-six source/code/descriptors/core/handlers/four launch profiles are exactly unchanged',{skip:directory?false:'set RESIDENT_SHA_IDENTITY_ARTIFACTS to the independently frozen initial-only fixture'},()=>{
 const bytes=Object.fromEntries(Object.keys(hashes).map(name=>[name,readFileSync(resolve(directory,name))]));
 for(const[name,data]of Object.entries(bytes)){assert.equal(sha(data),hashes[name],name+' independent input identity');assert.equal(createHash('sha256').update(data).digest('hex'),hashes[name],name+' portable hash');}
 const source=bytes['source.wgsl'].toString('utf8'),receipt=JSON.parse(bytes['source-receipt.json']),old=deserialize(bytes['compiled.v8']),runtime=deserialize(bytes['runtime.v8']);
 const composed=composeWorldMicrocodeSource(runtime.original.pc);assert.equal(composed.code,source);assert.equal(composed.entry,receipt.entry);
 const scalar=compileMicrocodeWGSL(source,{entry:receipt.entry,storageBindings:receipt.storageBindings,intrinsics:'none',externalFunctions:receipt.externalFunctions,allocationMetadata:true});
 const compiled=allocateMicrocodeLocals(scalar,{mode:'call-frames-v1'});assert.deepEqual(compiled,old,'every compiler field, bytecode word, approval and allocation record');
 const vm=runtime.vm,configuration={count:6,localWords:vm.localWords,stackCapacity:vm.stackCapacity,instructionCount:vm.instructionCount,entryPc:vm.entryPc,instructionBudget:vm.instructionBudget,initialSlots:vm.entrySlots,workgroupSize:64,intrinsics:'none',controlMode:'invocation-cache-v1',vmStateDisjoint:true,intrinsicFunctions:[],externalFunctions:vm.externalFunctions};
 assert.equal(generateMicrocodeVmWGSL(configuration),vm.shader,'complete original core source');
 for(const handler of vm.handlers)assert.equal(generateMicrocodeExternalWGSL({...configuration,workgroupSize:1,macroId:handler.id}),handler.code,'complete original macro '+handler.id);
 assert.equal(macroLaunchDataSha256(runtime),'5a114404df0eb616c8b112b553f484d837171bdfbef9f9b7c138686b30aaf958');
 for(const macroWorkgroupSize of[1,8,32,64]){const expected=deserialize(readFileSync(resolve(directory,`launch-wgs${macroWorkgroupSize}.v8`)));assert.deepEqual(createMacroLaunchProfile(runtime,{macroWorkgroupSize,limits:expected.planningLimits}),expected,'complete launch profile '+macroWorkgroupSize);}
 // Assert no test or deserializer has mutated any input file or detached input.
 for(const[name,data]of Object.entries(bytes)){assert.equal(sha(data),hashes[name]);assert.equal(sha(readFileSync(resolve(directory,name))),hashes[name]);}
});
