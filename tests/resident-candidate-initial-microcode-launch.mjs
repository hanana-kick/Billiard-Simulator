import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialMicrocodeLaunch,assertInitialMicrocodeLaunch,initialMicrocodeLaunchDescriptors,INITIAL_MICROCODE_LAUNCH_CAPABILITY} from '../src/resident-candidate/initial-microcode-launch.mjs';
const limits={maxStorageBufferBindingSize:134217728,maxBufferSize:268435456,maxStorageBuffersPerShaderStage:8,maxBindingsPerBindGroup:1000,maxBindGroups:4,maxComputeInvocationsPerWorkgroup:256,maxComputeWorkgroupSizeX:256,maxComputeWorkgroupsPerDimension:65535};
test('unowned runtime/profile and unsupported geometry reject; capability never implies numerical release',()=>{
 assert.throws(()=>createInitialMicrocodeLaunch({}, {macroWorkgroupSize:1,limits}),/locally constructed/);
 for(const macroWorkgroupSize of[undefined,0,2,16,32,64])assert.throws(()=>createInitialMicrocodeLaunch({}, {macroWorkgroupSize,limits}),/WGS1 or WGS8/);
 assert.throws(()=>assertInitialMicrocodeLaunch({}, {runtime:{},limits}),/locally constructed/);assert.throws(()=>initialMicrocodeLaunchDescriptors({}, {runtime:{},limits}),/locally constructed/);
 for(const key of ['nativeCompiled','numericallyQualified','fullRestQualified','native1024Qualified','compactProducerQualified','defaultBackend'])assert.equal(INITIAL_MICROCODE_LAUNCH_CAPABILITY[key],false);
});
test('launch options do not invoke accessors or admit qualification switches',()=>{
 let touched=false;const options={limits};Object.defineProperty(options,'macroWorkgroupSize',{enumerable:true,get(){touched=true;return 1;}});assert.throws(()=>createInitialMicrocodeLaunch({},options));assert.equal(touched,false);
 for(const extra of[{qualified:true},{eventAudit:false},{count:6},{instructionBudget:1},{dispatchChunks:1},{expected:{}},{future:{}}])assert.throws(()=>createInitialMicrocodeLaunch({}, {macroWorkgroupSize:1,limits,...extra}));
 assert.throws(()=>createInitialMicrocodeLaunch({}, {macroWorkgroupSize:1,limits:{...limits,maxStorageBufferBindingSize:NaN}}),/positive safe limit/);
});
