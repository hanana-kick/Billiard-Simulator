'use strict';
// Exactly three retained original pre-world snapshots. No recurrence or new shot.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),v8=require('node:v8'),{spawnSync}=require('node:child_process');
const D=require('../tools/rapier-snapshot-decoder'),root=path.resolve(__dirname,'..'),f=Math.fround;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),hash=p=>sha(fs.readFileSync(p));
const need=k=>{assert.ok(process.env[k],`Explicit ${k} required`);return path.resolve(process.env[k]);};
const FIXED=[['first-pre',1,'625e12b86a3db6067113689f3c36a67496ef155d9cd9df88726a178f52acd609'],['peak-shaft',54,'52dd8bf643b8dc6c48b1b8d920942869089cf5eb63f77ef93aa6ce5ba400c168'],['peak-head',152,'0ec1bee82cb3ecd25ead0fa3d67d85335caeebb89d77b805f9f3d8047f80863a']];
function plain(n){if(n.kind==='float')return D.floatValue(n);if(n.kind==='integer')return Number(n.value);if(n.fields)return Object.fromEntries(n.fields.map(([k,v])=>[k,plain(v)]));if(n.items)return n.items.map(plain);if(n.kind==='some'||n.kind==='newtype_struct'||n.kind==='newtype_variant')return plain(n.value);if(n.kind==='unit_variant')return n.variant;return n.value??null;}
function role(handle){return({16:'ball1',17:'ball2',18:'ball3',19:'shaft',20:'head'})[handle.index]??'unknown';}
function bodySummary(entry){const handle=plain(entry.handle),b=plain(entry.body);return{role:role(handle),handle,ccdActive:b.ccd.ccd_active,ccdEnabled:b.ccd.ccd_enabled,ccdThickness:b.ccd.ccd_thickness,maxExtent:b.mprops.max_extent,
  current:b.pos.position,next:b.pos.next_position,linear:b.vels.linvel,angular:b.vels.angvel,ccdLinear:b.ccd_vels.linvel,ccdAngular:b.ccd_vels.angvel,
  localCom:b.mprops.local_mprops.local_com,invMass:b.mprops.effective_inv_mass,invInertia:b.mprops.effective_world_inv_inertia,force:b.forces.force,torque:b.forces.torque};}
function queryInput(b,dt){const m=b.invInertia;return{linear:b.linear,angular:b.angular,translation:b.current.translation,rotation:b.current.rotation,nextTranslation:b.next.translation,nextRotation:b.next.rotation,
  force:b.force,torque:b.torque,invMass:b.invMass,invInertia:[m.m11,m.m12,m.m13,m.m12,m.m22,m.m23,m.m13,m.m23,m.m33],localCom:b.localCom,maxExtent:b.maxExtent,ccdThickness:b.ccdThickness,dt};}
function run(binary,args,input){const p=spawnSync(binary,args,{input,maxBuffer:32*1024*1024,timeout:120000});if(p.error)throw p.error;assert.equal(p.status,0,String(p.stderr));return{raw:p.stdout,value:JSON.parse(p.stdout)};}
function floatEqual(a,b){return Object.is(a,f(b));}
function capture(outDir){
 assert.ok(path.isAbsolute(outDir)&&!fs.existsSync(outDir),'New absolute output directory required');
 const reportFile=need('LIVE_CUE_UI_REPORT'),buildFile=need('LIVE_CUE_UI_SOURCE_BUILD'),ccdProbe=need('RAPIER_CCD_PROBE');
 assert.equal(hash(reportFile),'b822d8c083fbf2abe17a6141e059cefac328ee4074d0875aa6d848e6cb201839');
 const prior=JSON.parse(fs.readFileSync(reportFile)),build=JSON.parse(fs.readFileSync(buildFile)),dir=path.dirname(reportFile),source=build.binary;
 assert.equal(build.compiled,true);assert.equal(hash(source),build.binarySha256);assert.equal(hash(build.oldBinary),build.oldBinarySha256);assert.equal(hash(ccdProbe),prior.identities.probeSha256);
 assert.equal(hash(path.join(root,'tests/live-cue-ui-domain-source-probe-main.rs')),build.hostExtensionSha256);
 const originalBytes=fs.readFileSync(path.join(dir,prior.trace.file));assert.equal(sha(originalBytes),prior.trace.sha256);const original=v8.deserialize(originalBytes);
 fs.mkdirSync(outDir);const summaries=[];
 for(const[name,h,digest]of FIXED){
   const saved=prior.snapshots[name];assert.equal(saved.metadata.h,h);assert.equal(saved.metadata.phase,'post-compliance-pre-world');assert.equal(saved.sha256,digest);
   const bytes=fs.readFileSync(path.join(dir,saved.file));assert.equal(sha(bytes),digest);
   const nativeFile=path.join(outDir,`h${h}.native.bin`),traceFile=path.join(outDir,`h${h}.observed.json`),observation=run(source,[nativeFile],bytes),o=observation.value;
   // Persist successful source observations before later validation, without rerunning.
   fs.writeFileSync(traceFile,observation.raw,{flag:'wx'});
   assert.equal(o.schema,'original-live-cue-three-boundary-source-v1');assert.equal(o.originalH,h);assert.equal(o.inputSha256,digest);assert.equal(o.nativePostSha256,hash(nativeFile));assert.equal(o.inputAndOutputSerdeRoundtrip,true);assert.equal(o.instrumentedAndUnobservedPostBytesEqual,true);
   const stages=o.records.filter(r=>r.kind==='Stage').map(r=>({phase:r.phase,dt:plain(r.parameters).dt,remainingTime:plain(r.remainingTime),remainingSubsteps:r.remainingSubsteps,bodies:r.dynamicBodies.map(bodySummary)}));
   const typed=o.records.filter(r=>r.kind==='TypedRecord').map(r=>({kind:r.record.variant,...plain(r.record)}));
   const splits=typed.filter(r=>r.kind==='Split'),solved=stages.filter(s=>s.phase==='post-solve-pre-clamp');assert.ok(solved.length>0);
   const predicateInputs=solved.flatMap(s=>s.bodies.map(b=>queryInput(b,s.dt))),oracle=run(ccdProbe,[],JSON.stringify(predicateInputs)).value;assert.equal(oracle.sourceRevision,D.SOURCE_REVISION);assert.equal(oracle.items.length,predicateInputs.length);
   let index=0;for(const s of solved)for(const b of s.bodies){const result=oracle.items[index++].post;assert.equal(result.active,b.ccdActive,`${h}/${b.role} source post activation`);for(const[k,v]of[['ccdLinear',b.ccdLinear],['ccdAngular',b.ccdAngular]])for(let j=0;j<3;j++)assert.ok(floatEqual(v[j],result[k][j]),`${h}/${b.role}/${k}[${j}]`);b.sourcePost={...result,pointSpeed:f(result.pointSpeed)};}
   const clampRecords=typed.filter(r=>r.kind==='Body'&&['before-clamp','after-clamp'].includes(r.phase)),clamps=[];
   for(let i=0;i<clampRecords.length;i+=2){const b=clampRecords[i],a=clampRecords[i+1];assert.equal(b.phase,'before-clamp');assert.equal(a.phase,'after-clamp');assert.deepEqual(a.handle,b.handle);assert.equal(a.fraction,b.fraction);assert.deepEqual(a.body.vels,b.body.vels);assert.deepEqual(a.body.pos.position,b.body.pos.position);clamps.push({handle:b.handle,role:role(b.handle),fraction:b.fraction,changedNextPose:!require('node:util').isDeepStrictEqual(a.body.pos.next_position,b.body.pos.next_position)});}
   const advanced=stages.findLast(s=>s.phase==='after-all-passes');assert.ok(advanced);const nextPre=original.frames.find(frame=>frame.h===h+1),cuePoseChecks=[];
   if(nextPre)for(const b of advanced.bodies.filter(b=>['shaft','head'].includes(b.role))){const expected=nextPre[b.role];cuePoseChecks.push({role:b.role,source:'next-original-pre-world-cue-pose-unchanged-by-app-impulses',translationEqual:b.current.translation.every((v,i)=>Object.is(v,expected.translation[i])),rotationEqual:b.current.rotation.every((v,i)=>Object.is(v,expected.rotation[i]))});}
   const summary={h,inputSnapshotSha256:digest,passes:o.passes,sourceObservedAndUnobservedBytesEqual:true,postSourcePredicatesChecked:predicateInputs.length,
     splits,positivePreTOI:splits.some(s=>typeof s.first_impact==='number'&&s.first_impact>0),positivePreTOISeconds:splits.map(s=>s.first_impact).filter(x=>typeof x==='number'&&x>0),
     solved:solved.map(s=>({dt:s.dt,bodies:s.bodies})),postSolveCueActive:solved.some(s=>s.bodies.some(b=>['shaft','head'].includes(b.role)&&b.ccdActive)),postSolveAnyBodyActive:solved.some(s=>s.bodies.some(b=>b.ccdActive)),
     queryCount:typed.filter(r=>r.kind==='Query').length,acceptedSweepCandidates:typed.filter(r=>r.kind==='Candidate'&&r.reason==='accepted'),clamps,changedPoseClamps:clamps.filter(c=>c.changedNextPose).length,
     nativePost:{file:path.basename(nativeFile),sha256:hash(nativeFile),bytes:fs.statSync(nativeFile).size},observed:{file:path.basename(traceFile),sha256:hash(traceFile),bytes:observation.raw.length},
     originalFullPostAvailable:h===1,originalFullPostByteEqual:h===1?Buffer.from(fs.readFileSync(path.join(dir,prior.snapshots['first-post'].file))).equals(fs.readFileSync(nativeFile)):null,cuePoseChecks};
   fs.writeFileSync(path.join(outDir,`h${h}.summary.json`),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});summaries.push(summary);
   process.stderr.write(JSON.stringify({h,postSolveCueActive:summary.postSolveCueActive,postSolveAnyBodyActive:summary.postSolveAnyBodyActive,positivePreTOI:summary.positivePreTOI,queryCount:summary.queryCount,clamps:summary.changedPoseClamps,traceBytes:observation.raw.length})+'\n');
 }
 assert.equal(hash(source),build.binarySha256);assert.equal(hash(build.oldBinary),build.oldBinarySha256);assert.equal(hash(ccdProbe),prior.identities.probeSha256);
 const report={schema:'live-cue-ui-three-retained-boundaries-post-report-v1',originalReportSha256:hash(reportFile),sourceBuildSha256:hash(buildFile),sourceBinarySha256:build.binarySha256,oldSourceBinaryUnchanged:true,
   steps:summaries,checkedOriginalH:[1,54,152],checkedWorldStepCount:3,originalLiveStepCount:174,remainingWorldStepsUnmeasured:171,
   originalInputChanged:false,originalShotRecaptured:false,nativeRecurrence:false,allLivePostStepsCovered:false,universalUIExclusion:false,paritySuccess:false,
   scope:'Only three exact retained original pre-world snapshots, each independently stepped with original two joints. Native source post-solve activation, pre-TOI, sweep queries and clamps are separate findings.'};
 fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({outDir,reportSha256:hash(path.join(outDir,'report.json')),checkedOriginalH:report.checkedOriginalH,remainingWorldStepsUnmeasured:171},null,2));return report;
}
module.exports={capture,FIXED,plain};
if(require.main===module)try{capture(process.argv[2]);}catch(error){console.error(error.stack);process.exitCode=1;}
