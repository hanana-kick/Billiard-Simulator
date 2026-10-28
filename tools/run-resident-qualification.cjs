'use strict';
// Maintained HOST list, never filename discovery. Components are not release proof.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const HOST_TESTS=Object.freeze([
 'tests/resident-candidate-abi.mjs',
 'tests/resident-candidate-owned-buffers.mjs',
 'tests/resident-candidate-space-counts.mjs',
 'tests/resident-candidate-source-event-history.mjs',
 'tests/resident-candidate-inverse-terminal-observation.mjs',
 'tests/resident-candidate-inverse-reducer.mjs',
 'tests/resident-candidate-source-sha256.mjs',
 'tests/resident-candidate-inverse-portable-hash.mjs',
 'tests/resident-candidate-microcode-coupled-macro.mjs',
 'tests/resident-candidate-microcode-number-macro.mjs',
 'tests/resident-candidate-number-program-handoff-tests.mjs',
 'tests/resident-candidate-number-macro-created-host-tests.mjs',
 'tests/resident-candidate-launch-view-ownership.mjs',
 'tests/resident-candidate-microcode-vm.mjs',
 'tests/resident-candidate-microcode-external.mjs',
 'tests/resident-candidate-microcode-control-cache.mjs',
 'tests/resident-candidate-microcode-source-intrinsics.mjs',
 'tests/resident-candidate-microcode-operand-loads.mjs',
 'tests/resident-candidate-microcode-ret-pause.mjs',
 'tests/resident-candidate-word-predicates.mjs',
 'tests/resident-candidate-microcode-resources.mjs',
 'tests/resident-candidate-live-allocation.mjs',
 'tests/resident-candidate-batch-protocol.mjs',
 'tests/resident-candidate-invocation-identity-tests.mjs',
 'tests/resident-candidate-host-continuation-store-tests.mjs',
 'tests/resident-candidate-worker-host.mjs',
 'tests/resident-candidate-worker-client.mjs',
 'tests/resident-candidate-worker-backend.mjs',
 'tests/resident-candidate-microcode-numeric-continuation.mjs',
 'tests/resident-candidate-microcode-numeric-vm.mjs',
 'tests/resident-candidate-inline-graph-compile-tests.mjs',
 'tests/resident-candidate-phased-graph-compile-tests.mjs',
 'tests/resident-candidate-inline-graph-pilot-tests.mjs',
 'tests/resident-candidate-microcode-variant-contract-tests.mjs',
 'tests/resident-candidate-native-session-tests.mjs',
 'tests/resident-candidate-scale-validation-evidence.mjs',
 'tests/resident-candidate-raw-cast-loop-host-tests.mjs',
 'tests/resident-candidate-post-impact-profile-tests.mjs',
 'tests/resident-candidate-coupled-created-h192-evidence.test.mjs',
 'tests/resident-source-qualification-runners.cjs',
 'tests/resident-three-ball-game.mjs',
 'tests/resident-three-ball-search-semantics.mjs',
 'tests/source-query-finalization-policy.mjs',
 'tests/source-finalization-request.mjs',
 'tests/source-gameplay-finalization-owner.mjs',
 'tests/source-gameplay-inverse-admission.mjs',
 'tests/source-finalization-plumbing.mjs',
 'tests/source-finalization-native-receipt.mjs',
 'tests/source-gameplay-full-rest.mjs',
 'tests/resident-qualification-runners.cjs',
]);
const HOST_OMISSIONS=Object.freeze([
 'One opt-in GPU case in microcode-vm, four optional private-artifact resource/allocation cases and two Number-program capture/created-world cases are disabled, not passed.',
 'Curated8/9 evidence consistency, raw-cast admission, bounded post-impact counters and six-binding comparison unit tests are included; these do not rerun their numerical evidence.',
 'Costly genuine-three components through second physical seal, retained-owner source construction/fake-device lifecycle, package/VM-realm source checks and frozen artifact comparators require explicit test:resident:source inputs; no long recurrence or private captures in this default list.',
 'Worker host/client/backend mocks, phased numeric helper/VM scalar differentials and compile-role/pilot admission negatives are included; no actual module Worker, browser, native shader compilation, dispatch or physical trajectory is exercised by these additions.',
 'Original CPU prefix/positive-full-rest/late-foul gates are included; these do not qualify raw GPU trajectories or a three-ball GPU owner.',
 'Generated inverse-reducer scalar differentials, portable SHA/codec identities, exact macro source/protocol guards and launch-view ownership are included; no native observation producer/reducer, whole-world Number macro or browser-worker execution is implied.',
 'No raw GPU h192, full-rest/late-foul, genuine3-ball GPU owner, 1024 allocation/trajectory, hardware timing, browser/UI, or release qualification.',
]);
const file=(p,label)=>{if(!fs.statSync(p,{throwIfNoEntry:false})?.isFile())throw Error(label+' missing: '+p);};
function cleanHostEnvironment(env){
 const out={...env};for(const k of Object.keys(out))if(/^(?:RUN_|GPU_|WEBGPU_|DAWN_|VK_|RAPIER_|RESIDENT_|MICROCODE_|THREE_BALL_|DYLD_)/.test(k)||['NODE_OPTIONS','NODE_PATH','LD_PRELOAD','LD_LIBRARY_PATH','REQUIRE_WEBGPU','INVERSE_EVENTS_PHYSICS'].includes(k))delete out[k];
 return{...out,REQUIRE_WEBGPU:'0',INVERSE_EVENTS_PHYSICS:'0'};
}
function hostPlan({root=ROOT,env=process.env}={}){
 if(typeof require('node:module').registerHooks!=='function')throw Error('HOST import guard requires Node22.15+ or Node24+');
 root=path.resolve(root);const guard=path.join(root,'tools/run-resident-host-guard.mjs');
 for(const f of [...HOST_TESTS,'vendor/rapier.cjs','tools/run-resident-host-guard.mjs'])file(path.join(root,f),'Required maintained HOST input');
 const environment=cleanHostEnvironment(env);environment.RESIDENT_HOST_GUARD_ROOT=root;
 environment.NODE_OPTIONS='--import='+pathToFileURL(guard).href;
 return{kind:'resident-host-maintained-list-v1',root,executable:process.execPath,args:['--test','--test-concurrency=1',...HOST_TESTS],environment,tests:[...HOST_TESTS],omissions:[...HOST_OMISSIONS],gpuExecution:false,releaseQualified:false};
}
function runHost({root=ROOT,env=process.env,launch=spawnSync,log=console.log,planOnly=false}={}){
 let plan,temp;
 try{
  plan=hostPlan({root,env});log(JSON.stringify({kind:plan.kind,mode:planOnly?'plan':'host-only',tests:plan.tests,omissions:plan.omissions,gpuExecution:false,releaseQualified:false}));
  if(planOnly)return 0;
  const parent=env.TMPDIR||os.tmpdir();if(!fs.statSync(parent,{throwIfNoEntry:false})?.isDirectory())throw Error('Explicit temporary root is not a directory: '+parent);
  temp=fs.mkdtempSync(path.join(parent,'resident-host-qualified-'));const environment={...plan.environment,TMPDIR:temp,TEMP:temp,TMP:temp,RESIDENT_HOST_GUARD_TEMP:temp};
  const result=launch(plan.executable,plan.args,{cwd:plan.root,env:environment,stdio:'inherit',shell:false});
  if(result.error||result.signal){log(JSON.stringify({status:'failed',error:result.error?.message??null,signal:result.signal??null,releaseQualified:false}));return 1;}
  const status=Number.isInteger(result.status)?result.status:1;
  log(JSON.stringify({status:status===0?'host-contracts-passed':'host-contracts-failed',testProcessExit:status,skippedNativeCasesAreNotPasses:true,gpuExecution:false,releaseQualified:false}));return status;
 }catch(error){log(JSON.stringify({status:'blocked',error:error.message,gpuExecution:false,releaseQualified:false}));return 2;}
 finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module){const args=process.argv.slice(2);if(args.length>1||args.length===1&&args[0]!=='--plan'){console.error('Usage: npm run test:resident:host -- [--plan]');process.exitCode=2;}else process.exitCode=runHost({planOnly:args[0]==='--plan'});}
module.exports={HOST_TESTS,HOST_OMISSIONS,cleanHostEnvironment,hostPlan,runHost};
