'use strict';
// RUNNER CONTRACT MOCKS ONLY. Injected spawn never evaluates a shader/trajectory.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto'),{pathToFileURL}=require('node:url'),{spawnSync}=require('node:child_process');
const H=require('../tools/run-resident-qualification.cjs'),N=require('../tools/run-resident-native-qualification.cjs');
const ROOT=path.resolve(__dirname,'..'),sha=x=>createHash('sha256').update(x).digest('hex');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'resident-runner-contract-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const put=(rel,data='HOST RUNNER MOCK; not native source')=>{const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);return p;};return{root,put};}
function hostFixture(t){const f=fixture(t);for(const rel of[...H.HOST_TESTS,'vendor/rapier.cjs','tools/run-resident-host-guard.mjs'])f.put(rel);return f;}
function nativeFixture(t){const f=fixture(t);for(const rel of[N.COORDINATOR,'src/resident-candidate/microcode-vm.mjs','tests/resident-candidate-microcode-world-runtime.mjs','vendor/rapier.cjs'])f.put(rel);const capture=f.put('initial.capture','initial mock'),wasm=f.put('decoder.wasm','mock WASM NOT executed'),provenance=f.put('decoder.json',JSON.stringify({wasmPath:wasm,wasmSha256:sha(fs.readFileSync(wasm))})),module=f.put('binding.js','mock module NEVER imported'),dir=path.join(f.root,'artifacts');return{...f,dir,env:{RESIDENT_ORIGINAL_CAPTURE:capture,RAPIER_WASM_PROVENANCE:provenance,GPU_NATIVE_MODULE:module}};}
function prepare(f){fs.mkdirSync(f.dir,{recursive:true});const put=(name,value)=>fs.writeFileSync(path.join(f.dir,name),typeof value==='string'?value:JSON.stringify(value));put('runtime.v8','INITIAL ONLY MOCK');const m={kind:'resident-tip-impact-isolated-gate-v1',count:2,frames:192,rows:[219,522],work:[512,4096],runtimeSha256:sha('INITIAL ONLY MOCK'),macroProfile:'source-coupled-macro-v1',cueNumberProfile:'original-js-number-v1',initialHistoryProfile:'source-full-application-history-v1',originalGeneration:'generation-mock',expectedFilesRuntimeAuthority:false,physicalQueryHorizonUnchanged:true,fullRest:false,native1024:false,hardwarePerformance:false,sourceHashes:{[N.COORDINATOR]:sha(fs.readFileSync(path.join(f.root,N.COORDINATOR)))}};put('manifest.json',m);put('expected.v8','EXPECTED MOCK');put('expected-manifest.json',{kind:'resident-tip-impact-expected-manifest-v1',runtimeSha256:m.runtimeSha256,expectedSha256:sha('EXPECTED MOCK'),originalGeneration:m.originalGeneration});const args=['--dir='+f.dir,'--manifest-sha256='+sha(fs.readFileSync(path.join(f.dir,'manifest.json'))),'--runtime-sha256='+m.runtimeSha256];return{m,args,put};}
function actual(p){p.put('actual.v8','ACTUAL MOCK');p.put('actual-manifest.json',{runtimeSha256:p.m.runtimeSha256,actualSha256:sha('ACTUAL MOCK')});}
const silent=()=>{};
test('release CI explicitly includes HOST and typecheck without launching native qualification',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
 const workflow=fs.readFileSync(path.join(ROOT,'.github/workflows/pages.yml'),'utf8');
 assert.equal(pkg.scripts['test:resident:host'],'node tools/run-resident-qualification.cjs');
 assert.equal(pkg.scripts['test:resident:native'],'node tools/run-resident-native-qualification.cjs');
 assert.match(workflow,/run: npm run typecheck\s/);
 assert.match(workflow,/run: npm run test:resident:host\s/);
 assert.doesNotMatch(workflow,/run:.*(?:test:resident:native|tip-impact-isolated|REQUIRE_WEBGPU)/);
 const buildCommand='run: node build.cjs --canonical-controller-assets';
 assert.ok(workflow.includes(buildCommand),'release must package the opt-in GPU engine');
 assert.ok(workflow.indexOf('run: npm run typecheck')<workflow.indexOf(buildCommand));
 assert.ok(workflow.indexOf('run: npm run test:resident:host')<workflow.indexOf('uses: actions\/upload-pages-artifact'));
});
test('HOST list is explicit, ordered, private-artifact independent and never a directory glob',t=>{
 const f=hostFixture(t),p=H.hostPlan({root:f.root,env:{REQUIRE_WEBGPU:'1',RUN_RESIDENT_TIP_IMPACT_GPU:'1',RESIDENT_MICROCODE_RESOURCE_RUNTIME:'/tmp/private.v8',RESIDENT_BATCH_SOURCE_RUNTIME:'/tmp/private-batch.v8',GPU_NATIVE_MODULE:'/tmp/webgpu/index.js',NODE_OPTIONS:'--require evil',NODE_PATH:'/tmp/evil',INVERSE_EVENTS_PHYSICS:'1',PATH:'/safe'}});
 assert.deepEqual(p.args,['--test','--test-concurrency=1',...H.HOST_TESTS]);assert.equal(new Set(H.HOST_TESTS).size,H.HOST_TESTS.length);assert.ok(H.HOST_TESTS.every(x=>!/[?*]/.test(x)));
 for(const name of ['tests/resident-candidate-live-allocation.mjs','tests/resident-candidate-batch-protocol.mjs','tests/resident-candidate-owned-buffers.mjs'])assert.ok(H.HOST_TESTS.includes(name));
 assert.ok(H.HOST_TESTS.includes('tests/source-gameplay-full-rest.mjs'));assert.ok(H.HOST_TESTS.includes('tests/source-finalization-native-receipt.mjs'));
 for(const name of['tests/resident-candidate-inverse-reducer.mjs','tests/resident-candidate-source-sha256.mjs','tests/resident-candidate-inverse-portable-hash.mjs','tests/resident-candidate-microcode-coupled-macro.mjs','tests/resident-candidate-microcode-number-macro.mjs','tests/resident-candidate-number-program-handoff-tests.mjs','tests/resident-candidate-number-macro-created-host-tests.mjs','tests/resident-candidate-launch-view-ownership.mjs'])assert.ok(H.HOST_TESTS.includes(name),'maintained source-only release regression '+name);
 for(const name of ['worker-host.mjs','worker-client.mjs','worker-backend.mjs','microcode-numeric-continuation.mjs','microcode-numeric-vm.mjs','inline-graph-compile-tests.mjs','phased-graph-compile-tests.mjs','inline-graph-pilot-tests.mjs'])assert.ok(H.HOST_TESTS.includes('tests/resident-candidate-'+name),'new deterministic HOST contract '+name);
 assert.ok(H.HOST_TESTS.includes('tests/resident-candidate-microcode-ret-pause.mjs'),'committed HOST RET pause/error/resume semantics remain continuously checked');
 for(const name of ['retained-microcode.mjs','worker-browser.cjs','post-impact-native-projection-tests.mjs'])assert.ok(!H.HOST_TESTS.includes('tests/resident-candidate-'+name));
 for(const name of['GPU_NATIVE_MODULE','RESIDENT_MICROCODE_RESOURCE_RUNTIME','RESIDENT_BATCH_SOURCE_RUNTIME','RUN_RESIDENT_TIP_IMPACT_GPU','NODE_PATH'])assert.equal(p.environment[name],undefined);
 assert.equal(p.environment.REQUIRE_WEBGPU,'0');assert.equal(p.environment.INVERSE_EVENTS_PHYSICS,'0');assert.ok(p.environment.NODE_OPTIONS.startsWith('--import=file:'));assert.equal(p.environment.PATH,'/safe');
 fs.unlinkSync(path.join(f.root,H.HOST_TESTS[0]));assert.throws(()=>H.hostPlan({root:f.root,env:{}}),/missing/);
});
test('HOST plan launches nothing; execution is serial with fresh disposable temp and exact exit/signal propagation',t=>{
 const f=hostFixture(t);let calls=0,childTemp;
 assert.equal(H.runHost({root:f.root,env:{TMPDIR:os.tmpdir()},planOnly:true,launch:()=>assert.fail('plan launch'),log:silent}),0);
 assert.equal(H.runHost({root:f.root,env:{TMPDIR:os.tmpdir()},launch:(exe,args,opts)=>{calls++;childTemp=opts.env.TMPDIR;assert.equal(exe,process.execPath);assert.equal(opts.shell,false);assert.ok(fs.existsSync(childTemp));assert.equal(opts.env.RESIDENT_HOST_GUARD_TEMP,childTemp);assert.equal(args[1],'--test-concurrency=1');return{status:7};},log:silent}),7);
 assert.equal(calls,1);assert.equal(fs.existsSync(childTemp),false);
 assert.equal(H.runHost({root:f.root,env:{TMPDIR:os.tmpdir()},launch:()=>({signal:'SIGKILL',status:null}),log:silent}),1);
});
test('HOST guard rejects CJS/ESM GPU bindings, private temp artifacts and native child runners; ordinary CPU source imports remain allowed',t=>{
 const f=fixture(t),guard=pathToFileURL(path.join(ROOT,'tools/run-resident-host-guard.mjs')).href;
 const env={...process.env,NODE_OPTIONS:'--import='+guard,RESIDENT_HOST_GUARD_ROOT:ROOT,RESIDENT_HOST_GUARD_TEMP:process.env.RESIDENT_HOST_GUARD_TEMP||f.root,REQUIRE_WEBGPU:'1'};
 const run=code=>spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:ROOT,env,encoding:'utf8',shell:false});
 for(const code of["await import('webgpu')", "import{createRequire}from'node:module';createRequire(import.meta.url)('webgpu')", `await import(${JSON.stringify(pathToFileURL(path.join(ROOT,'tests/resident-candidate-gpu-support.mjs')).href)})`, "import fs from'node:fs';fs.readFileSync('/tmp/resident-private-unavailable.v8')", `import{spawnSync}from'node:child_process';spawnSync(process.execPath,[${JSON.stringify(path.join(ROOT,N.COORDINATOR))},'gpu','/nonexistent']);`]){const r=run(code);assert.notEqual(r.status,0);assert.match(r.stderr,/RESIDENT_HOST_ONLY/);}
 const r=run(`import ${JSON.stringify(pathToFileURL(path.join(ROOT,'src/game-rules.js')).href)};if(typeof ThreeBallGame!=='function')throw Error('CPU source missing');`);assert.equal(r.status,0,r.stderr);
});
test('native entry has no default phase/work, no direct long GPU mode, no auto detection or silent missing dependencies',t=>{
 const f=nativeFixture(t);for(const args of[[],['gpu'],['all'],['prepare','--dir='+f.dir],['prepare','--dir='+f.dir,'--work=1,2','--plan'],['gpu-pilot','--dir='+f.dir,'--plan']])assert.throws(()=>N.nativePlan(args,{root:f.root,env:f.env}));
 const args=['prepare','--dir='+f.dir,'--work=512,4096','--plan'];const p=N.nativePlan(args,{root:f.root,env:f.env});assert.deepEqual(p.args,[N.COORDINATOR,'prepare',f.dir,'--work=512,4096','--coupled-macro','--cue-original-number']);assert.equal(p.environment.REQUIRE_WEBGPU,'0');assert.equal(p.scope.fullRest,false);
 assert.equal(N.runNative(args,{root:f.root,env:f.env,launch:()=>assert.fail('native plan cannot execute'),log:silent}),0);
 for(const key of ['RESIDENT_ORIGINAL_CAPTURE','RAPIER_WASM_PROVENANCE'])assert.throws(()=>N.nativePlan(args,{root:f.root,env:{...f.env,[key]:undefined}}),/existing absolute file/);
 fs.writeFileSync(JSON.parse(fs.readFileSync(f.env.RAPIER_WASM_PROVENANCE)).wasmPath,'changed');assert.throws(()=>N.nativePlan(args,{root:f.root,env:f.env}),/WASM provenance/);
});
test('GPU pilot validation reads only initial authority; explicit module/hash/slot/wait required and inherited jobs scrubbed',t=>{
 const f=nativeFixture(t),p=prepare(f);fs.unlinkSync(path.join(f.dir,'expected.v8'));fs.unlinkSync(path.join(f.dir,'expected-manifest.json'));
 const args=['gpu-pilot',...p.args,'--wait-ms=1000','--exclusive-slot=coordinator-serialized','--plan'],plan=N.nativePlan(args,{root:f.root,env:{...f.env,RUN_OTHER_GPU:'1',NODE_OPTIONS:'evil'}});
 assert.equal(plan.environment.REQUIRE_WEBGPU,'1');assert.equal(plan.environment.RUN_RESIDENT_TIP_IMPACT_GPU,'1');assert.equal(plan.environment.RUN_OTHER_GPU,undefined);assert.equal(plan.environment.NODE_OPTIONS,undefined);assert.equal(plan.args.at(-1),'--wait-ms=1000');
 assert.throws(()=>N.nativePlan(args,{root:f.root,env:{...f.env,GPU_NATIVE_MODULE:undefined}}),/GPU_NATIVE_MODULE/);
 assert.throws(()=>N.nativePlan(args.map(x=>x.startsWith('--runtime-sha256=')?'--runtime-sha256='+'0'.repeat(64):x),{root:f.root,env:f.env}),/runtime SHA256/);
 fs.writeFileSync(path.join(f.root,N.COORDINATOR),'changed');assert.throws(()=>N.nativePlan(args,{root:f.root,env:f.env}),/Frozen source mismatch/);
});
test('native phase wrapper preserves pilot incomplete/failure and never calls comparator automatically',t=>{
 const f=nativeFixture(t),p=prepare(f),args=['gpu-pilot',...p.args,'--wait-ms=1000','--exclusive-slot=test-slot','--confirm-native'];let calls=0;
 for(const status of[2,1])assert.equal(N.runNative(args,{root:f.root,env:f.env,launch:(_exe,child,opts)=>{calls++;assert.equal(child[1],'gpu-pilot');assert.equal(opts.shell,false);return{status};},log:silent}),status);
 assert.equal(calls,2);assert.equal(N.runNative(args,{root:f.root,env:f.env,launch:()=>({status:0}),log:silent}),2,'transport success without actual payload is blocked');
 assert.equal(N.runNative(args,{root:f.root,env:f.env,launch:()=>{actual(p);return{status:0};},log:silent}),0);
 assert.equal(fs.existsSync(path.join(f.dir,'assertion.json')),false);assert.throws(()=>N.nativePlan(args,{root:f.root,env:f.env}),/Cannot reopen/);
});
test('independent assert requires exact actual/expected receipts; component exit cannot grant wider qualification',t=>{
 const f=nativeFixture(t),p=prepare(f),args=['assert',...p.args];assert.throws(()=>N.nativePlan(args,{root:f.root,env:f.env}),/Actual GPU manifest/);actual(p);
 const plan=N.nativePlan(args,{root:f.root,env:f.env});assert.equal(plan.environment.REQUIRE_WEBGPU,'0');assert.equal(plan.environment.GPU_NATIVE_MODULE,undefined);
 assert.equal(N.runNative(args,{root:f.root,env:f.env,launch:()=>({status:0}),log:silent}),2,'missing comparator receipt is not a pass');
 const receipt={kind:'resident-tip-impact-isolated-assertion-v1',status:'pass',count:2,frames:192,checkpoints:[128,192],runtimeSha256:p.m.runtimeSha256,actualSha256:sha('ACTUAL MOCK'),expectedSha256:sha('EXPECTED MOCK'),macroProfile:p.m.macroProfile,cueNumberProfile:p.m.cueNumberProfile,physics:{all11SourceGroups:true,nativePhysicsLabOuter:true,fullAcceptedEmissionTapeQualified:true},rawToStrike:true,fullRest:false,queryTerminal:false,native1024:false,hardwarePerformance:false};
 assert.equal(N.runNative(args,{root:f.root,env:f.env,launch:()=>{p.put('assertion.json',{...receipt,native1024:true});return{status:0};},log:silent}),2);
 fs.unlinkSync(path.join(f.dir,'assertion.json'));assert.equal(N.runNative(args,{root:f.root,env:f.env,launch:()=>{p.put('assertion.json',receipt);return{status:0};},log:silent}),0);
 assert.throws(()=>N.nativePlan(args,{root:f.root,env:f.env}),/already exists/);
});
