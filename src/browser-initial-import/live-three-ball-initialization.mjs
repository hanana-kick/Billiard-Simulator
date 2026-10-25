// SPDX-License-Identifier: Apache-2.0
// The first, pre-collision portion of a live three-ball substep only.
// Source snapshots, native caches and rule family remain distinct and intact.
import {importLiveRegisteredThreeBall} from './live-registered-three-ball.mjs';
import {exportRegisteredCueInitialization} from './live-initialization.mjs';
import * as importedInit from '../experimental-cue-initialization.js';
const Init=importedInit.default??globalThis.LabCueInitializationExperimental;
const copy=x=>structuredClone(x);
export const CAPABILITY=Object.freeze({kind:'live-three-ball-cue-initialization',initialSnapshotOnly:true,
  preCollisionOnly:true,firstSubstepComplete:false,wholeShot:false,cpuFallback:false,
  preservesSourceSelectedIndex:true,preservesInitialNativeManagers:true});
export async function importLiveThreeBallInitialization(decoder,input){
 const projection=await importLiveRegisteredThreeBall(decoder,input),row={...projection.created,
  hCount:0,outerStep:0,outerSubstep:0,boundary:projection.boundary,candidateInput:true,
  nativeFrameIndex:projection.sourceOrigin.createdClock.nativeFrameIndex,apiJournalLength:14,
  application:projection.application,sourceOrigin:projection.sourceOrigin};
 const seed=await exportRegisteredCueInitialization({[projection.boundary]:row,strikeCreationJournal:projection.strikeCreationJournal},'three');
 return {seed,projection};
}
export async function createReferenceInitializationOwner(decoder,input){return createOwner(decoder,input,null);}
export async function createGpuInitializationOwner(device,decoder,input){
 if(typeof globalThis.GPUDevice!=='function'||!(device instanceof globalThis.GPUDevice))throw TypeError('Actual same-realm WebGPU device required; no CPU fallback');
 return createOwner(decoder,input,device);
}
async function createOwner(decoder,input,device){
 const {seed,projection}=await importLiveThreeBallInitialization(decoder,input);
 const gpu=device?await Init.createGpuInitializer(device):null;
 let busy=false,disposed=false,prepared=null,committed=null;
 const backend=device?'webgpu':'cpu-reference';
 const available=()=>{if(disposed||busy)throw Error('Initialization owner unavailable');};
 const cancelled=signal=>{if(signal?.aborted)throw signal.reason??new DOMException('Initialization cancelled','AbortError');};
 const snapshot=()=>copy({capability:CAPABILITY,backend,sourceOrigin:projection.sourceOrigin,
  application:projection.application,initialNative:projection.created.state,
  phase:committed?'live-three-ball-user-changes-complete-pre-collision':'liveRegisteredThreeBallStrikeCreated',
  initialization:committed});
 return Object.freeze({capability:CAPABILITY,backend,snapshot,
  async prepare({signal}={}){
   available();if(committed||prepared)throw RangeError('One initial pre-collision transaction only');cancelled(signal);busy=true;
   try{
    const numeric=gpu?await gpu.initializeBatch(seed.numericInputs):seed.numericInputs.map(Init.initializeReference);cancelled(signal);
    const result=Init.initializeLiveRegisteredThreeBallUserChanges(seed.userChanges,Object.fromEntries(numeric.map((v,i)=>[seed.numericInputs[i].role,v])));
    cancelled(signal);prepared={numeric,result};return copy(prepared);
   }catch(error){prepared=null;throw error;}finally{busy=false;}
  },
  commit(){available();if(!prepared||committed)throw Error('Prepared initialization required');committed=prepared;prepared=null;return snapshot();},
  abort(){available();prepared=null;},
  step(){throw Object.assign(new RangeError('Live three-ball collision/broad-phase and first-substep owner are not implemented'),{code:'three-ball-live-first-substep-unavailable'});},
  dispose(){available();prepared=null;disposed=true;gpu?.dispose();}
 });
}
