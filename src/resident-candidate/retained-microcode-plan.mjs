/* SPDX-License-Identifier: Apache-2.0
 * Separate initial-only retained-work profile. Constructs its own genuine
 * runtime; an existing/deserialized runtime cannot acquire a larger budget.
 */
import {createInitialMicrocodeRuntime,assertInitialMicrocodeRuntime} from './initial-microcode-runtime.mjs';
import {createInitialMicrocodeBatchPlan,assertInitialMicrocodeBatchPlan,initialMicrocodeBatchInput} from './initial-microcode-batch-plan.mjs';
import {macroLaunchDataSha256} from './macro-launch-data.mjs';
const runtimes=new WeakMap(),plans=new WeakMap(),U=0xffffffff;
const need=(ok,message)=>{if(!ok)throw new RangeError('Retained microcode: '+message);};
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
export const RETAINED_MICROCODE_RUNTIME_KIND='resident-owned-retained-initial-microcode-runtime-v1';
export const RETAINED_MICROCODE_BATCH_KIND='resident-owned-retained-initial-microcode-batch-v1';
function caps(options){
 need(options&&Object.getPrototypeOf(options)===Object.prototype,'explicit plain construction options');const d=Object.getOwnPropertyDescriptors(options),keys=['experimental','maxHSteps','chunkCycles','maxTotalCycles'];
 need(Reflect.ownKeys(d).length===keys.length&&keys.every(k=>Object.hasOwn(d[k]??{},'value')),'exact source horizon/chunk/total options; no overrides');const o=Object.fromEntries(keys.map(k=>[k,d[k].value]));
 need(o.experimental===true,'explicit experimental opt-in');need(Number.isInteger(o.maxHSteps)&&o.maxHSteps>=1&&o.maxHSteps<=U,'unchanged explicit source h ceiling');need(Number.isInteger(o.chunkCycles)&&o.chunkCycles>=1&&o.chunkCycles<=65536,'bounded chunk 1..65536');need(Number.isInteger(o.maxTotalCycles)&&o.maxTotalCycles>=o.chunkCycles&&o.maxTotalCycles<=U,'explicit total >= chunk and <= checked u32 yield ceiling');
 // Existing u64 step and u32 yield overflow checks remain authoritative. This
 // is an arithmetic representability proof, not a practical time allowance.
 const maxVmCommittedSteps=o.maxTotalCycles*(65536+4);need(Number.isSafeInteger(maxVmCommittedSteps)&&BigInt(maxVmCommittedSteps)<(1n<<64n),'source counter representability');return Object.freeze({...o,maxVmCommittedSteps});
}
export function createRetainedInitialMicrocodeRuntime(initializationPlan,rows,options){
 const c=caps(options),runtime=createInitialMicrocodeRuntime(initializationPlan,rows,{experimental:true,maxHSteps:c.maxHSteps,dispatchChunks:c.chunkCycles});
 const metadata=freeze({kind:RETAINED_MICROCODE_RUNTIME_KIND,maxHSteps:c.maxHSteps,chunkCycles:c.chunkCycles,maxTotalCycles:c.maxTotalCycles,counterBounds:{maxVmCommittedSteps:c.maxVmCommittedSteps,maxVmYields:c.maxTotalCycles,sourceOverflowChecksUnchanged:true,representabilityOnly:true},initialGeneration:runtime.original.identity.generationIdentity,sourceSha256:runtime.identity.sourceSha256,bytecodeSha256:runtime.identity.bytecodeSha256,numericallyQualified:false,practicalWorkAllowanceMeasured:false});
 const owned=Object.freeze({...metadata,runtime,profileSha256:macroLaunchDataSha256(metadata)});runtimes.set(owned,runtime);return owned;
}
export function assertRetainedInitialMicrocodeRuntime(value){const runtime=runtimes.get(value);need(runtime,'fresh locally constructed retained profile required; no old runtime wrapping');assertInitialMicrocodeRuntime(runtime);return value;}
export function createRetainedInitialMicrocodeBatchPlan(values,options){
 need(Array.isArray(values)&&values.length>0&&values.every((v,i)=>Object.hasOwn(values,i))&&new Set(values).size===values.length,'complete distinct retained banks');for(const v of values)assertRetainedInitialMicrocodeRuntime(v);
 const retained=Object.freeze(values.slice()),base=createInitialMicrocodeBatchPlan(retained.map(v=>v.runtime),options),bankCaps=freeze(retained.map((v,index)=>({index,chunkCycles:v.chunkCycles,maxTotalCycles:v.maxTotalCycles,counterBounds:v.counterBounds,profileSha256:v.profileSha256}))),generationIdentity=macroLaunchDataSha256({kind:RETAINED_MICROCODE_BATCH_KIND,initialBatchGeneration:base.identity.generationIdentity,requestedH:base.requestedH,orderedIds:base.orderedIds,bankCaps}),identity=Object.freeze({...base.identity,generationIdentity});
 const metadata=freeze({kind:RETAINED_MICROCODE_BATCH_KIND,identity,initialBatchPlanSha256:base.planSha256,bankCaps,count:base.count,orderedIds:base.orderedIds,requestedH:base.requestedH,initializationDispatches:base.initializationDispatches,totalBytes:base.totalBytes,compactBytes:base.compactBytes,finalMaps:1,simultaneousBanks:true,sourceHorizonUnchanged:true,automaticExtension:false,numericallyQualified:false});
 const plan=Object.freeze({...base,...metadata,base,retained,planSha256:macroLaunchDataSha256(metadata)});plans.set(plan,{base,retained});return plan;
}
export function assertRetainedInitialMicrocodeBatchPlan(plan,options){const p=plans.get(plan);need(p,'owned retained batch plan required');for(const v of p.retained)assertRetainedInitialMicrocodeRuntime(v);assertInitialMicrocodeBatchPlan(p.base,options);return plan;}
export function retainedInitialMicrocodeBatchInput(plan){assertRetainedInitialMicrocodeBatchPlan(plan);return initialMicrocodeBatchInput(plan.base);}
