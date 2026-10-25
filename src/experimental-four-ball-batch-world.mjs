// SPDX-License-Identifier: Apache-2.0
// Opt-in independent source worlds sharing exact-plan GPU arithmetic dispatches.
// This is not whole-world device residency or a production backend selection.
import './experimental-four-ball-world.js';
import './experimental-stage-runtime.js';
import './experimental-plan-batch-scheduler.js';
import * as importedTopology from './experimental-cue-convex-topology.js';
import {createGpuResourceScope} from './bounded-gpu-shot/resources.mjs';
const World = globalThis.LabFourBallWorldExperimental;
const Runtime = globalThis.LabStageRuntimeExperimental;
const Topology = importedTopology.default ?? globalThis.LabCueConvexTopologyExperimental;
const leases = new WeakMap();
const copy = value => structuredClone(value);
const freezeReceipt = value => {if(value&&typeof value==='object'){Object.values(value).forEach(freezeReceipt);Object.freeze(value);}return value;};
const publicState = state => {if(state===null)return null;const out=copy(state);if(out.inverseObservation)freezeReceipt(out.inverseObservation);return out;};
const reason = error => String(error?.message ?? error);
// Native convex exports carry a module-private, deep-frozen capability. Validate
// it first, copy every mutable field, and preserve only those authenticated hull
// references. Cloning/re-exporting JSON would discard or recreate its authority.
function ownValidatedSeed(input) {
  const verified=World.validate(input);
  for(const row of verified.cueEmptyConvexHulls??[]) Topology.assertNativeHull(row.hull);
  for(const seed of verified.cushionSeeds??[]) for(const row of seed.cushions) Topology.assertNativeHull(row.hull);
  const owned=copy(verified);
  if(verified.cueEmptyConvexHulls) owned.cueEmptyConvexHulls=verified.cueEmptyConvexHulls.map((r,i)=>({...owned.cueEmptyConvexHulls[i],hull:r.hull}));
  if(verified.cushionSeeds) owned.cushionSeeds=verified.cushionSeeds.map((c,i)=>({...owned.cushionSeeds[i],cushions:c.cushions.map((r,j)=>({...owned.cushionSeeds[i].cushions[j],hull:r.hull}))}));
  return owned;
}
const terminal = status => ['complete', 'unsupported', 'failed', 'cancelled', 'stopped', 'limit-reached'].includes(status);
export const CAPABILITY = Object.freeze({backend:'webgpu', minShots:2, maxShots:4,
  maxStepsPerShot:65536, maxTotalSteps:262144, independentWorldCommits:true, crossWorldAtomicCommit:false, wholeWorldResident:false,
  commonArithmeticPlanBatching:true, cpuShotFallback:false, productionDefault:false});

export async function createGpuBatchStepper(device, seeds, options = {}) {
  if (!device?.createBuffer || !device?.queue) throw new TypeError('Actual GPUDevice required');
  if (!Array.isArray(seeds) || seeds.length < 2 || seeds.length > 4) throw new RangeError('Two to four independent source seeds required');
  if (!options || Object.keys(options).some(k => !['ids', 'scheduler', 'maxStepsPerShot', 'observeInverse'].includes(k))) throw new TypeError('Unknown batch-world option');
  const observeInverse=options.observeInverse;
  if(observeInverse!==undefined&&typeof observeInverse!=='boolean')throw new TypeError('Boolean observeInverse required');
  const worldOptions=Object.freeze(observeInverse===undefined?{}:{observeInverse});
  const maxStepsPerShot=options.maxStepsPerShot??CAPABILITY.maxStepsPerShot;
  if(!Number.isSafeInteger(maxStepsPerShot)||maxStepsPerShot<1||maxStepsPerShot>CAPABILITY.maxStepsPerShot) throw new RangeError('Bounded per-shot step limit required');
  const ids = options.ids ?? seeds.map((_, i) => 'shot-' + i);
  if (!Array.isArray(ids) || ids.length !== seeds.length || new Set(ids).size !== ids.length || ids.some(x => typeof x !== 'string' || !x.length || x.length > 128)) throw new TypeError('Distinct bounded world IDs required');
  if (leases.has(device)) throw new Error('GPUDevice already owns an experimental batch world');
  // Own the inputs before asynchronous construction, including source identities.
  const prepared=seeds.map(seed=>{try{return{seed:ownValidatedSeed(seed),error:null};}catch(error){return{seed:null,error:reason(error)};}});
  const ownedIds=ids.slice(), bounds=copy(options.scheduler??{});
  const lease = {}; leases.set(device, lease);
  const resources = createGpuResourceScope(device);
  let scheduler = null, busy = false, disposed = false, activeStep = null, closing = null;
  const slots=prepared.map(({seed,error},index)=>({id:ownedIds[index],seed,world:null,state:null,status:error?'unsupported':'ready',reason:error,cancelRequested:false,committedSteps:0}));
  const disposeWorld = slot => { if (slot.world) { slot.world.dispose(); slot.world = null; } };
  const view = () => ({backend:'webgpu', capability:CAPABILITY,
    slots:slots.map(({id,status,state,reason:why,committedSteps}) => ({id,status,committedSteps,state:publicState(state), ...(why ? {reason:why} : {})})),
    scheduler:scheduler?.snapshot() ?? null, resources:resources.snapshot(), disposed});
  const allTerminal = () => slots.every(slot => terminal(slot.status));
  try {
    scheduler = Runtime.createPlanBatchScope(resources.device, bounds);
    await Promise.all(slots.map(async slot => {
      if(slot.status==='unsupported')return;
      try {
        const scopedDevice = scheduler.createDevice(slot.id);
        slot.world = await World.createGpuStepper(scopedDevice, slot.seed, worldOptions);
        slot.state = slot.world.snapshot();
      } catch (error) {
        slot.status='failed';slot.reason=reason(error);
        try {await scheduler.cancelOwner(slot.id,reason(error));} catch(cleanup){slot.reason+='; drain: '+reason(cleanup);}
        try {disposeWorld(slot);} catch(cleanup){slot.reason+='; cleanup: '+reason(cleanup);}
      }
      finally {slot.seed=null;}
    }));
  } catch (error) {
    for (const slot of slots) try {disposeWorld(slot);} catch (cleanup) {error.cleanupError ??= cleanup;}
    try {if(scheduler){await scheduler.cancel(error);scheduler.dispose();}} catch (cleanup) {error.cleanupError ??= cleanup;}
    try {resources.dispose();} catch (cleanup) {error.cleanupError ??= cleanup;}
    if (leases.get(device)===lease) leases.delete(device);
    throw error;
  }
  const cancelSlots = why => {
    const jobs=[];
    for (const slot of slots) if (!terminal(slot.status)) {
      slot.cancelRequested=true;slot.reason=why;
      jobs.push(scheduler.cancelOwner(slot.id,why));
    }
    return Promise.all(jobs);
  };
  const cancel = async (why='Batch cancelled') => {
    if(disposed)return view();
    const draining=cancelSlots(reason(why));
    await Promise.allSettled([draining,activeStep]);
    for(const slot of slots) if(slot.cancelRequested && !terminal(slot.status)) {
      slot.status='cancelled';disposeWorld(slot);
    }
    return view();
  };
  const api = {
    capability:CAPABILITY,
    snapshot:view,
    stats:()=>({scheduler:scheduler.snapshot(),resources:resources.snapshot(),busy,disposed}),
    step(stepOptions={}) {
      if(!stepOptions || Object.keys(stepOptions).some(k=>k!=='signal')) return Promise.reject(new TypeError('Only signal is accepted; external per-step state is prohibited'));
      const {signal}=stepOptions;
      if(disposed)return Promise.reject(new Error('Batch world disposed'));
      if(busy)return Promise.reject(new Error('Batch world step already pending'));
      if(signal && (typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function')) return Promise.reject(new TypeError('AbortSignal required'));
      if(allTerminal())return Promise.resolve(view());
      if(signal?.aborted)return cancel('Batch step cancelled before dispatch');
      busy=true;
      const onAbort=()=>{cancelSlots('Batch step cancelled').catch(()=>{});};
      try {signal?.addEventListener('abort',onAbort,{once:true});} catch(error){busy=false;return Promise.reject(error);}
      const run = async () => {
        let roundOpen=false;const remaining=new Set();
        try {
          for(const slot of slots) if(!terminal(slot.status)) {
            if(slot.cancelRequested){slot.status='cancelled';disposeWorld(slot);}
            else if(slot.committedSteps>=maxStepsPerShot){slot.status='limit-reached';slot.reason='Per-shot committed step limit reached before physical rest';disposeWorld(slot);}
          }
          const participants=slots.filter(slot=>!terminal(slot.status));
          if(!participants.length)return view();
          try {scheduler.beginRound(participants.map(slot=>slot.id));roundOpen=true;}
          catch(error) {
            // A device loss can be observed while idle, before any per-world
            // step begins. Preserve every committed snapshot and terminalize
            // the admitted owners instead of leaving ready states behind.
            await Promise.allSettled(participants.map(async slot=>{
              slot.status=slot.cancelRequested?'cancelled':'failed';slot.reason=reason(error);
              try{await scheduler.cancelOwner(slot.id,reason(error));}catch(cleanup){slot.reason+='; drain: '+reason(cleanup);}
              try{disposeWorld(slot);}catch(cleanup){slot.reason+='; cleanup: '+reason(cleanup);}
            }));
            return view();
          }
          participants.forEach(slot=>remaining.add(slot.id));
          // These promises overlap independent owners. Actual parallel arithmetic
          // is established ONLY by scheduler multi-owner dispatch receipts.
          const outcomes=await Promise.allSettled(participants.map(async slot => {
            try {
              slot.state=await slot.world.step();slot.committedSteps++;
              if(slot.cancelRequested){slot.status='cancelled';disposeWorld(slot);}
              else if(slot.state.shotComplete){slot.status='complete';disposeWorld(slot);}
            } catch(error) {
              // Original world.step owns rollback of its uncommitted h. Other
              // worlds may already have committed and are not rolled back here.
              let snapshotFailure=null;
              try {slot.state=slot.world?.snapshot() ?? slot.state;} catch(snapshotError){snapshotFailure=snapshotError;}
              slot.status=slot.cancelRequested?'cancelled':'failed';slot.reason=reason(error)+(snapshotFailure?'; snapshot: '+reason(snapshotFailure):'');
              try{await scheduler.cancelOwner(slot.id,reason(error));}catch(cleanup){slot.reason+='; drain: '+reason(cleanup);}
              try{disposeWorld(slot);}catch(cleanup){slot.reason+='; cleanup: '+reason(cleanup);}
            } finally {scheduler.endRoundOwner(slot.id);remaining.delete(slot.id);}
          }));
          const rejected=outcomes.find(result=>result.status==='rejected');
          if(rejected)throw rejected.reason;
          await scheduler.finishRound();roundOpen=false;
          return view();
        } finally {
          try {if(roundOpen){for(const id of remaining)scheduler.endRoundOwner(id);await scheduler.finishRound();}}
          finally {try{signal?.removeEventListener('abort',onAbort);}finally{busy=false;activeStep=null;}}
        }
      };
      activeStep=run();return activeStep;
    },
    stopOwner(id, why='Physical scoring stopped') {
      if(disposed||busy)throw new Error('Owner stop requires a live committed idle boundary');
      const slot=slots.find(slot=>slot.id===id);if(!slot)throw new TypeError('Unknown batch owner');
      if(terminal(slot.status))return view();
      disposeWorld(slot);slot.status='stopped';slot.reason=reason(why);return view();
    },
    cancel,
    dispose() {
      if(closing)return closing;
      closing=(async()=>{
        let failure=null;
        try{await cancel('Batch disposed');}catch(error){failure??=error;}
        for(const slot of slots)try{disposeWorld(slot);}catch(error){failure??=error;}
        try{await scheduler.cancel('Batch disposed');scheduler.dispose();}catch(error){failure??=error;}
        try{resources.dispose();}catch(error){failure??=error;}
        if(failure)throw failure;
        disposed=true;if(leases.get(device)===lease)leases.delete(device);
      })();
      closing.catch(()=>{closing=null;}); // Keep the device lease until cleanup succeeds.
      return closing;
    }
  };
  return Object.freeze(api);
}
