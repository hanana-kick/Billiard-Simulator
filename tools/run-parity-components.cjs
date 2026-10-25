'use strict';
// Component-level validation only. Passing is not full-shot GPU certification.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function run(env=process.env,launch=spawnSync){
 for(const key of ['GPU_NATIVE_MODULE','RAPIER_SNAPSHOT_DECODER','CUE_JOINT_ORACLE','CUE_JOINT_PROVENANCE','RAPIER_CCD_PROBE','THREE_BALL_CREATION_V8','THREE_BALL_SWITCH_REPLAY','THREE_BALL_SPLIT_REPLAY']){
  const file=env[key];if(!file||!path.isAbsolute(file)||!fs.statSync(file,{throwIfNoEntry:false})?.isFile()){
   console.error(`${key} must identify an existing absolute file. Component verification cannot silently skip native or actual WebGPU execution.`);return 2;
  }
 }
 for(const key of ['THREE_BALL_SWITCH_REPLAY','THREE_BALL_SPLIT_REPLAY']){if(!fs.statSync(env[key]+'.json',{throwIfNoEntry:false})?.isFile()){console.error(key+' requires its source-identity and payload-digest .json sidecar.');return 2;}}
 const tests=['tests/rapier-snapshot-decoder.cjs','tests/parity/authoritative-trace.cjs','tests/parity/observable-contract.cjs','tests/experimental-arithmetic-graph.cjs','tests/experimental-free-body.cjs','tests/experimental-cue-obstacle-contact.cjs','tests/experimental-cue-obstacle-manifold.cjs','tests/experimental-sleep-activation.cjs','tests/experimental-world-stepper.cjs','tests/experimental-world-lifecycle.cjs','tests/experimental-cue-joint.cjs','tests/experimental-cue-joint-stepper.cjs','tests/experimental-angular-patch.cjs','tests/experimental-sphere-pair-world.cjs','tests/parity/corpus-format.cjs','tests/experimental-double-single.cjs','tests/experimental-cue-joint-compliance.cjs','tests/experimental-cue-joint-continuation.cjs','tests/experimental-cue-joint-tip-contact.cjs','tests/experimental-cloth-world.cjs','tests/experimental-cloth-precision.cjs','tests/experimental-cloth-island-world.cjs','tests/experimental-ccd-inactive.cjs','tests/experimental-cloth-island-ccd-world.cjs','tests/experimental-cloth-island-patch-world.cjs','tests/experimental-convex-point.cjs','tests/experimental-cushion-world.cjs','tests/experimental-cushion-orientations.cjs','tests/experimental-cushion-roster-world.cjs','tests/experimental-cushion-pair-insertion.cjs','tests/experimental-awake-activation.cjs','tests/experimental-cue-stroke-continuation.cjs','tests/experimental-contact-graph-journal-freshness.cjs','tests/experimental-contact-graph-journal.cjs','tests/experimental-cue-broad-phase-guards.cjs','tests/experimental-cue-broad-phase.cjs','tests/experimental-cue-contact-graph-journal.cjs','tests/experimental-cue-created-stroke-stage.cjs','tests/experimental-cue-initialization.cjs','tests/experimental-cue-lateral-compensated.cjs','tests/experimental-cue-rigid-exclusion.cjs','tests/experimental-cushion-contact-stage.cjs','tests/experimental-four-cushion-contact-stage.cjs','tests/experimental-four-cushion-mapping.cjs','tests/experimental-pair-contact-stage.cjs','tests/experimental-scene-split.cjs'];
 console.log('Running independent native and actual WebGPU component gates serially. This does not enable GPU gameplay or certify a whole shot.');
 const result=launch(process.execPath,['--test','--test-concurrency=1',...tests],{cwd:root,env:{...env,REQUIRE_WEBGPU:'1'},stdio:'inherit'});
 if(result.error){console.error(result.error.message);return 1;}return Number.isInteger(result.status)?result.status:1;
}
if(require.main===module)process.exitCode=run();
module.exports={run};
