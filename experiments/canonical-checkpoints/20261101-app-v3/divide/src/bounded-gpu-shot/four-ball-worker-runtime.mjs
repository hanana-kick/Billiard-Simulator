// SPDX-License-Identifier: Apache-2.0
// Source-derived dependency postorder from the supported live capture page,
// excluding the importer's sole topology authority. Cycles are broken only at
// lazy runtime lookups: cloth birth -> contact journal (journal()) and cloth
// island -> pair contact (sourceWakeSelection()). Their reverse edges are safe
// and cue broad phase -> owned BVH bridge inside prepare();
// scheduler -> stage runtime is likewise lazy via runtime(). Every
// initialization-time global must already be defined;
// source and browser-like module-worker gates reject closure or order drift.
export const WORKER_RUNTIME_MODULES = Object.freeze([
  "../experimental-arithmetic-graph.js",
  "../experimental-plan-batch-scheduler.js",
  "../experimental-stage-runtime.js",
  "../experimental-cue-joint.js",
  "../experimental-cue-joint-stepper.js",
  "../experimental-cue-joint-compliance.js",
  "../experimental-double-single.js",
  "../experimental-cue-lateral-compensated.js",
  "../experimental-cue-joint-tip-contact.js",
  "../experimental-ccd-inactive.js",
  "../experimental-live-registered-origin.js",
  "../experimental-live-three-ball-origin.js",
  "../experimental-cue-bvh-insertion.js",
  "../experimental-cue-empty-convex-cache.js",
  "../experimental-cue-empty-pair-cache.js",
  "../experimental-cue-cloth-joint-stepper.js",
  "../experimental-cue-cloth-cache.js",
  "../experimental-cue-epa-core.js",
  "../experimental-cue-obstacle-contact.js",
  "../experimental-cue-rigid-exclusion.js",
  "../experimental-cue-broad-phase.js",
  "../experimental-ccd-pass-authority.js",
  "../experimental-ccd-bvh-state.js",
  "../experimental-ccd-bvh-world-bridge.js",
  "../experimental-world-stepper.js",
  "../experimental-free-body.js",
  "../experimental-sleep-activation.js",
  "../experimental-awake-activation.js",
  "../experimental-cue-stroke-stage.js",
  "../experimental-angular-patch.js",
  "../experimental-world-lifecycle.js",
  "../experimental-four-ball-cloth-birth.js",
  "../experimental-contact-graph-journal.js",
  "../experimental-cue-initialization.js",
  "../experimental-cue-created-variant.js",
  "../experimental-cue-created-stroke-stage.js",
  "../experimental-scene-activation.js",
  "../game-rules.js",
  "../experimental-coupled-contact-hints.js",
  "../experimental-coupled-contact-math.js",
  "../experimental-solver-contact-roster.js",
  "../experimental-coupled-contact-owner.js",
  "../experimental-sphere-pair-world.js",
  "../experimental-cloth-island-world.js",
  "../experimental-pair-contact-stage.js",
  "../experimental-convex-point.js",
  "../experimental-cushion-roster-world.js",
  "../experimental-cushion-contact-stage.js",
  "../experimental-ccd-sweep-math.js",
  "../experimental-ccd-proxy-distance-kernel.js",
  "../experimental-ccd-proxy-distance-cpu.js",
  "../experimental-ccd-proxy-distance-reducers.js",
  "../experimental-ccd-proxy-distance.js",
  "../experimental-ccd-sweep-toi.js",
  "../experimental-ccd-order-certificate.js",
  "../experimental-ccd-fixed-sphere.js",
  "../experimental-ccd-substep.js",
  "../experimental-three-ball-ccd-world.js",
  "../experimental-four-ball-world.js"
]);
let loaded;
export function loadWorkerRuntime() {
  return loaded ??= (async () => {
    // Establish the SAME private WeakSet hull authority used by the GPU world.
    await import('../browser-initial-import/four-ball.mjs');
    for (const source of WORKER_RUNTIME_MODULES) await import(source);
    return import('./four-ball.mjs');
  })();
}
