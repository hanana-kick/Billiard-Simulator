'use strict';
// Explicit independent phases only. Never auto-run GPU, auto-continue a pilot,
// or treat an h192/count2 boundary as full-rest/1024/release qualification.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),COORDINATOR='tests/resident-candidate-tip-impact-isolated.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(ok,message)=>{if(!ok)throw Error(message);};
const file=(p,label)=>{need(typeof p==='string'&&path.isAbsolute(p)&&fs.statSync(p,{throwIfNoEntry:false})?.isFile(),label+' must be an existing absolute file');return p;};
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const SHA=/^[a-f0-9]{64}$/;
function parse(argv){
 const [phase,...args]=argv;need(['prepare','gpu-pilot','assert'].includes(phase),'Explicit phase prepare | gpu-pilot | assert required (no default execution)');
 const o={phase};for(const a of args){need(/^--[a-z][a-z0-9-]*(?:=.+)?$/.test(a),'Known named arguments required');const at=a.indexOf('='),key=a.slice(2,at<0?undefined:at),value=at<0?true:a.slice(at+1);need(!Object.hasOwn(o,key),'Duplicate option '+key);o[key]=value;}
 const common=['phase','dir','plan'],allowed={prepare:[...common,'work','confirm-prepare'],'gpu-pilot':[...common,'manifest-sha256','runtime-sha256','wait-ms','exclusive-slot','confirm-native'],assert:[...common,'manifest-sha256','runtime-sha256']};
 need(Object.keys(o).every(k=>allowed[phase].includes(k)),'Unknown option for '+phase);
 need(typeof o.dir==='string'&&path.isAbsolute(o.dir),'Explicit absolute --dir required');o.dir=path.resolve(o.dir);
 for(const k of ['plan','confirm-prepare','confirm-native'])if(Object.hasOwn(o,k))need(o[k]===true,'Boolean --'+k+' flag required');
 if(phase==='prepare'){
  need(typeof o.work==='string'&&/^\d+(?:,\d+)+$/.test(o.work),'Explicit --work=512,remaining,... required');o.work=o.work.split(',').map(Number);
  need(o.work.length<=64&&o.work[0]===512&&o.work.every(n=>Number.isSafeInteger(n)&&n>0&&n<=65536)&&o.work.reduce((a,b)=>a+b,0)<=65536,'Original fixed work caps and first512 pilot block required');
  need(o.plan||o['confirm-prepare']===true,'Preparation performs original CPU oracle work; explicit --confirm-prepare required');
 }else{
  for(const k of ['manifest-sha256','runtime-sha256'])need(SHA.test(o[k]),'Explicit --'+k+' required');
  if(phase==='gpu-pilot'){
   need(typeof o['wait-ms']==='string'&&/^\d+$/.test(o['wait-ms'])&&Number.isSafeInteger(+o['wait-ms'])&&+o['wait-ms']>=1&&+o['wait-ms']<=3600000,'Explicit bounded operational --wait-ms required');
   need(typeof o['exclusive-slot']==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(o['exclusive-slot']),'Coordinator exclusive numerical slot acknowledgment required (not an automatic lock)');
   need(o.plan||o['confirm-native']===true,'Actual GPU execution requires explicit --confirm-native');
  }
 }
 return Object.freeze(o);
}
function scrub(env){const out={...env};for(const k of Object.keys(out))if(/^(?:RUN_|MICROCODE_|RESIDENT_HOST_)/.test(k)||['NODE_OPTIONS','NODE_PATH','LD_PRELOAD','REQUIRE_WEBGPU'].includes(k))delete out[k];return out;}
function checkedPrepared(root,o,{expected=false}={}){
 const manifestPath=file(path.join(o.dir,'manifest.json'),'Prepared manifest'),runtime=file(path.join(o.dir,'runtime.v8'),'Initial-only runtime');
 need(sha(fs.readFileSync(manifestPath))===o['manifest-sha256'],'Exact supplied manifest SHA256 mismatch');
 const m=json(manifestPath);need(m.kind==='resident-tip-impact-isolated-gate-v1'&&m.count===2&&m.frames===192&&JSON.stringify(m.rows)==='[219,522]','Only declared raw tip-impact count2/h192 gate is supported');
 need(m.macroProfile==='source-coupled-macro-v1'&&m.cueNumberProfile==='original-js-number-v1'&&m.initialHistoryProfile==='source-full-application-history-v1','Exact current source macro/Number/full-history profiles required');
 need(m.runtimeSha256===o['runtime-sha256']&&sha(fs.readFileSync(runtime))===m.runtimeSha256,'Exact initial-only runtime SHA256 mismatch');
 need(m.expectedFilesRuntimeAuthority===false&&m.physicalQueryHorizonUnchanged===true&&m.fullRest===false&&m.native1024===false&&m.hardwarePerformance===false,'No expanded qualification scope');
 need(Array.isArray(m.work)&&m.work.length>=2&&m.work.length<=64&&m.work[0]===512&&m.work.every(n=>Number.isSafeInteger(n)&&n>0&&n<=65536)&&m.work.reduce((a,b)=>a+b,0)<=65536,'Original bounded fixed work manifest required');
 need(m.sourceHashes&&Object.keys(m.sourceHashes).length>0,'Prepared source hashes required');
 for(const [rel,digest]of Object.entries(m.sourceHashes)){
  need(!path.isAbsolute(rel)&&!rel.split(/[\\/]/).includes('..')&&SHA.test(digest),'Safe pinned source path/hash');
  const p=file(path.resolve(root,rel),'Pinned source');need(sha(fs.readFileSync(p))===digest,'Frozen source mismatch: '+rel);
 }
 if(expected){const em=json(file(path.join(o.dir,'expected-manifest.json'),'Independent expected manifest')),p=file(path.join(o.dir,'expected.v8'),'Independent expected payload');need(em.kind==='resident-tip-impact-expected-manifest-v1'&&em.runtimeSha256===m.runtimeSha256&&em.originalGeneration===m.originalGeneration&&SHA.test(em.expectedSha256)&&sha(fs.readFileSync(p))===em.expectedSha256,'Independent source-bound expected payload mismatch');}
 return m;
}
function nativePlan(argv,{root=ROOT,env=process.env}={}){
 const o=parse(argv);root=path.resolve(root);file(path.join(root,COORDINATOR),'Source-owned coordinator');
 for(const rel of ['src/resident-candidate/microcode-vm.mjs','tests/resident-candidate-microcode-world-runtime.mjs','vendor/rapier.cjs'])file(path.join(root,rel),'Required source module');
 const environment=scrub(env),args=[COORDINATOR],identities={};let manifest;
 if(o.phase==='prepare'){
  need(!fs.existsSync(o.dir)||fs.statSync(o.dir).isDirectory()&&fs.readdirSync(o.dir).length===0,'Preparation requires a fresh empty artifact directory');
  const capture=file(env.RESIDENT_ORIGINAL_CAPTURE,'RESIDENT_ORIGINAL_CAPTURE'),provenanceFile=file(env.RAPIER_WASM_PROVENANCE,'RAPIER_WASM_PROVENANCE'),p=json(provenanceFile),wasm=file(p.wasmPath,'Decoder provenance wasmPath');
  need(SHA.test(p.wasmSha256)&&sha(fs.readFileSync(wasm))===p.wasmSha256,'Decoder WASM provenance SHA256 mismatch');
  Object.assign(identities,{initialCaptureSha256:sha(fs.readFileSync(capture)),decoderProvenanceSha256:sha(fs.readFileSync(provenanceFile)),decoderWasmSha256:p.wasmSha256});
  environment.REQUIRE_WEBGPU='0';delete environment.GPU_NATIVE_MODULE;
  args.push('prepare',o.dir,'--work='+o.work.join(','),'--coupled-macro','--cue-original-number');
 }else{
  manifest=checkedPrepared(root,o,{expected:o.phase==='assert'});Object.assign(identities,{manifestSha256:o['manifest-sha256'],runtimeSha256:manifest.runtimeSha256});
  if(o.phase==='gpu-pilot'){
   for(const name of ['actual.v8','actual-manifest.json','assertion.json','pilot-cost.json','pilot-decision.json','pilot-incomplete.json'])need(!fs.existsSync(path.join(o.dir,name)),'Cannot reopen prior execution/pilot: '+name);
   const module=file(env.GPU_NATIVE_MODULE,'GPU_NATIVE_MODULE');identities.nativeModuleSha256=sha(fs.readFileSync(module));
   environment.GPU_NATIVE_MODULE=module;environment.REQUIRE_WEBGPU='1';environment.RUN_RESIDENT_TIP_IMPACT_GPU='1';args.push('gpu-pilot',o.dir,'--wait-ms='+o['wait-ms']);
  }else{
   const am=json(file(path.join(o.dir,'actual-manifest.json'),'Actual GPU manifest')),actual=file(path.join(o.dir,'actual.v8'),'Actual GPU payload');
   need(am.runtimeSha256===manifest.runtimeSha256&&SHA.test(am.actualSha256)&&sha(fs.readFileSync(actual))===am.actualSha256,'Actual GPU source-bound payload mismatch');
   need(!fs.existsSync(path.join(o.dir,'assertion.json')),'Independent assertion receipt already exists; never overwrite or pretend to rerun');
   identities.actualSha256=am.actualSha256;environment.REQUIRE_WEBGPU='0';delete environment.GPU_NATIVE_MODULE;args.push('assert',o.dir);
  }
 }
 return{kind:'resident-explicit-native-boundary-v1',options:o,root,executable:process.execPath,args,environment,identities,scope:{count:2,h:192,rawToStrikePending:true,fullRest:false,queryTerminal:false,native1024:false,hardwarePerformance:false,releaseQualified:false},manifest};
}
function runNative(argv,{root=ROOT,env=process.env,launch=spawnSync,log=console.log}={}){
 try{
  const p=nativePlan(argv,{root,env}),o=p.options;log(JSON.stringify({kind:p.kind,phase:o.phase,planOnly:!!o.plan,args:p.args,identities:p.identities,scope:p.scope,exclusiveSlotAcknowledgment:o['exclusive-slot']??null,automaticGpuLock:false}));
  if(o.plan)return 0;
  const r=launch(p.executable,p.args,{cwd:p.root,env:p.environment,stdio:'inherit',shell:false});
  if(r.error||r.signal){log(JSON.stringify({status:'failed',error:r.error?.message??null,signal:r.signal??null,releaseQualified:false}));return 1;}
  if(r.status!==0){log(JSON.stringify({status:r.status===2?'incomplete':'failed',childExit:r.status??null,releaseQualified:false}));return Number.isInteger(r.status)?r.status:1;}
  if(o.phase==='prepare'){
   const manifestPath=file(path.join(o.dir,'manifest.json'),'Prepared manifest'),m=json(manifestPath);
   checkedPrepared(p.root,{...o,'manifest-sha256':sha(fs.readFileSync(manifestPath)),'runtime-sha256':m.runtimeSha256},{expected:true});
  }else if(o.phase==='gpu-pilot'){
   const am=json(file(path.join(o.dir,'actual-manifest.json'),'Actual GPU manifest')),actual=file(path.join(o.dir,'actual.v8'),'Actual GPU payload');
   need(am.runtimeSha256===p.identities.runtimeSha256&&SHA.test(am.actualSha256)&&sha(fs.readFileSync(actual))===am.actualSha256,'Transport exit without exact source-bound actual payload');
  }
  if(o.phase==='assert'){
   const evidence=json(file(path.join(o.dir,'assertion.json'),'Independent comparator receipt'));
   need(evidence.kind==='resident-tip-impact-isolated-assertion-v1'&&evidence.status==='pass'&&evidence.count===2&&evidence.frames===192&&evidence.runtimeSha256===p.identities.runtimeSha256&&evidence.actualSha256===p.identities.actualSha256&&evidence.expectedSha256===json(path.join(o.dir,'expected-manifest.json')).expectedSha256&&JSON.stringify(evidence.checkpoints)==='[128,192]'&&evidence.macroProfile===p.manifest.macroProfile&&evidence.cueNumberProfile===p.manifest.cueNumberProfile,'Independent comparator receipt identity mismatch');
   need(evidence.physics?.all11SourceGroups===true&&evidence.physics.nativePhysicsLabOuter===true&&evidence.physics.fullAcceptedEmissionTapeQualified===true&&evidence.rawToStrike===true&&evidence.fullRest===false&&evidence.queryTerminal===false&&evidence.native1024===false&&evidence.hardwarePerformance===false,'Comparator receipt must retain all original gates and exact bounded scope');
   log(JSON.stringify({status:'boundary-comparator-passed',qualifiedBoundary:'count2-h192-raw-tip-impact-only',releaseQualified:false}));
  }else log(JSON.stringify({status:o.phase==='prepare'?'prepared-not-executed':'gpu-transport-finished-comparator-pending',releaseQualified:false}));
  return 0;
 }catch(error){log(JSON.stringify({status:'blocked',error:error.message,releaseQualified:false}));return 2;}
}
if(require.main===module)process.exitCode=runNative(process.argv.slice(2));
module.exports={COORDINATOR,parse,checkedPrepared,nativePlan,runNative};
