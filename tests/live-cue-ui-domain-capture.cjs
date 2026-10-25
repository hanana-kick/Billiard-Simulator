'use strict';
// Original PhysicsLab recurrence only. Every wrapper forwards original calls unchanged.
// This observes PRE-solve activation, not a positive TOI or a post-solve pose clamp.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),v8=require('node:v8');
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const input=require('./live-cue-ui-domain-input.json'),D=require('../tools/rapier-snapshot-decoder');
const root=path.resolve(__dirname,'..'),F=D.field,f=Math.fround;
const required=k=>{assert.ok(process.env[k],`Explicit ${k} required`);return path.resolve(process.env[k]);};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),fileHash=p=>hash(fs.readFileSync(p));
const arr=v=>[v.x,v.y,v.z],quat=q=>[q.x,q.y,q.z,q.w];
const numeric=n=>n.kind==='float'?D.floatValue(n):n.kind==='integer'?Number(n.value):n.value;
const scalar=(n,k)=>numeric(F(n,k)),vec=(n,k)=>[...D.walk(F(n,k))].filter(x=>x.kind==='float').map(D.floatValue);
const same=(a,b)=>assert.deepEqual(a,b);
function handle(h){const b=Buffer.alloc(8);b.writeDoubleLE(h);return{index:b.readUInt32LE(),generation:b.readUInt32LE(4)};}
function rb(d,h){const id=handle(h),e=F(F(F(d.state,'bodies'),'bodies'),'items').items[id.index];assert.equal(e.variant,'Occupied');assert.equal(scalar(e,'generation'),id.generation);return F(e,'value');}
function nativeBody(d,h){const b=rb(d,h),m=F(b,'mprops'),l=F(m,'local_mprops'),c=F(b,'ccd'),forces=F(b,'forces'),vel=F(b,'vels');return{
  handle:handle(h),maxExtent:scalar(m,'max_extent'),ccdThickness:scalar(c,'ccd_thickness'),ccdEnabled:scalar(c,'ccd_enabled'),
  localCom:vec(l,'local_com'),localInvMass:scalar(l,'inv_mass'),invPrincipalInertia:vec(l,'inv_principal_inertia'),
  invMass:vec(m,'effective_inv_mass'),invInertia:['m11','m12','m13','m22','m23','m33'].map(k=>scalar(F(m,'effective_world_inv_inertia'),k)),
  force:vec(forces,'force'),torque:vec(forces,'torque'),gravityScale:scalar(forces,'gravity_scale'),
  linear:vec(vel,'linvel'),angular:vec(vel,'angvel'),ccdActive:scalar(c,'ccd_active'),
  translation:vec(F(F(b,'pos'),'position'),'translation'),rotation:vec(F(F(b,'pos'),'position'),'rotation')};}
function publicBody(b){const m=b.effectiveWorldInvInertia();const invInertia=[m.m11,m.m12,m.m13,m.m21,m.m22,m.m23,m.m31,m.m32,m.m33];return{
  handle:handle(b.handle),linear:arr(b.linvel()),angular:arr(b.angvel()),translation:arr(b.translation()),rotation:quat(b.rotation()),
  invMass:arr(b.effectiveInvMass()),invInertia,localCom:arr(b.localCom()),userForce:arr(b.userForce()),userTorque:arr(b.userTorque()),gravityScale:b.gravityScale()};}
function sourcePointSpeed(s,E){const norm=a=>f(Math.sqrt(f(f(f(a[0]*a[0])+f(a[1]*a[1]))+f(a[2]*a[2]))));return f(norm(s.linear)+f(norm(s.angular)*E));}
function sourceHashes(vendor){return Object.fromEntries(['src/physics.js','src/math.js','src/controller.js','src/App.tsx','src/optimizer-core.js','tests/live-cue-ui-domain-input.json','tests/live-cue-ui-domain-capture.cjs','tools/rapier-snapshot-decoder/index.cjs','tools/rapier-snapshot-exporter/src/bin/rapier-ccd-probe.rs'].map(p=>[p,fileHash(path.join(root,p))]).concat([['externalPinnedVendor',fileHash(vendor)]]));}
async function capture(output){
  assert.ok(path.isAbsolute(output),'Absolute create-new output directory required');assert.ok(!fs.existsSync(output),'Do not overwrite or silently resume');
  const vendor=required('LIVE_CUE_UI_VENDOR'),decoder=required('RAPIER_SNAPSHOT_DECODER'),probe=required('RAPIER_CCD_PROBE');
  assert.equal(fileHash(vendor),D.ENGINE_SHA256);const identities={sources:sourceHashes(vendor),vendor,decoder,probe,decoderSha256:fileHash(decoder),probeSha256:fileHash(probe),sourceRevision:D.SOURCE_REVISION,engineVersion:D.ENGINE_VERSION,node:process.version,v8:process.versions.v8};
  const R=require(vendor);require('../src/math');require('../src/physics');await R.init();assert.equal(R.version(),D.ENGINE_VERSION);
  fs.mkdirSync(output);const lab=new PhysicsLab(R),frames=[],saved={},setters=[];let h=0,outer=0,bootstrap=null,peak={},firstActive=null;
  const decode=bytes=>D.decodeSnapshot(bytes,{binary:decoder,engineVersion:D.ENGINE_VERSION,vendorPath:vendor});
  const save=(name,bytes,metadata)=>{saved[name]={bytes:Buffer.from(bytes),metadata};};
  const wrapBody=b=>{for(const k of ['setLinvel','setAngvel','setTranslation','setRotation','setCcdEnabled','setGravityScale','setAdditionalMass','setAdditionalMassProperties']){
    if(typeof b[k]!=='function')continue;const fn=b[k].bind(b);b[k]=(...args)=>{setters.push({h,body:handle(b.handle),method:k,args:structuredClone(args)});return fn(...args);};}return b;};
  try{
    same(lab.params,LabDefaults);assert.equal(lab.dt,input.dt);assert.equal(lab.strokeSubsteps,64);assert.equal(lab.world.integrationParameters.maxCcdSubsteps,4);
    for(const o of lab.objects)wrapBody(o.body);const create=lab.world.createRigidBody.bind(lab.world);lab.world.createRigidBody=(...args)=>wrapBody(create(...args));
    const clearance=lab.cueClearance(lab.get(input.selectedId),input.settings);assert.equal(clearance.clear,true,'Fixed input must pass original clearance; no alternative input');
    const accepted=lab.strike(input.selectedId,{...input.settings});assert.equal(accepted.ok,true,JSON.stringify(accepted));
    const cue=lab.cue,handles={shaft:cue.body.handle,head:cue.head.handle};
    save('created',lab.world.takeSnapshot(),{h:0,phase:'after-original-strike'});
    const originalStep=lab.world.step.bind(lab.world);
    lab.world.step=(...args)=>{
      h++;const live=lab.cue,frame=live?{h,outer,time:lab.time,dt:lab.world.integrationParameters.dt,contacted:live.contacted,touchingIds:[...live.contacts.keys()],shaft:publicBody(live.body),head:publicBody(live.head)}:null;
      if(frame){
        assert.equal(frame.dt,f(input.dt/64));for(const role of ['shaft','head']){same(frame[role].userForce,[0,0,0]);same(frame[role].userTorque,[0,0,0]);assert.equal(frame[role].gravityScale,0);}
        if(h===1)save('first-pre',lab.world.takeSnapshot(),{h,phase:'post-compliance-pre-world',frame:structuredClone(frame)});
        if(bootstrap)for(const role of ['shaft','head']){
          const body=frame[role],m=bootstrap[role],pointSpeed=sourcePointSpeed(body,m.maxExtent),motion=f(pointSpeed*frame.dt),threshold=f(.5*m.ccdThickness),active=motion>threshold;
          body.pre={pointSpeed,motion,threshold,active};
          if(!peak[role]||pointSpeed>peak[role].pointSpeed){peak[role]={h,time:frame.time,pointSpeed,motion,threshold,active};save('peak-'+role,lab.world.takeSnapshot(),{h,role,phase:'post-compliance-pre-world',frame:structuredClone(frame)});}
          if(active&&!firstActive){firstActive={h,role,time:frame.time,pointSpeed,motion,threshold};save('first-active-pre',lab.world.takeSnapshot(),{...firstActive,phase:'post-compliance-pre-world',frame:structuredClone(frame)});}
        }
        frames.push(frame);
      }
      const result=originalStep(...args);
      if(h===1){const bytes=lab.world.takeSnapshot(),d=decode(bytes);bootstrap=Object.fromEntries(Object.entries(handles).map(([role,id])=>[role,nativeBody(d,id)]));
        for(const role of ['shaft','head']){const b=bootstrap[role];assert.ok(b.maxExtent>0);same(b.force,[0,0,0]);same(b.torque,[0,0,0]);assert.equal(b.gravityScale,0);assert.equal(b.ccdEnabled,true);}
        save('first-post',bytes,{h,phase:'post-original-world',native:bootstrap});
      }
      return result;
    };
    const maxOuter=Math.ceil(.22/lab.dt)+2;while(lab.cue&&outer<maxOuter){outer++;lab.step();}assert.equal(lab.cue,null,'Original removal horizon must complete');
    // Seal the completed original observation before any offline validation can
    // fail. A failed decoder/probe is not permission to rerun or retune the shot.
    const raw=v8.serialize({input,identities,frames,saved,bootstrap,peak,firstActive,setters,h,outer,lastStroke:lab.lastStroke});
    fs.writeFileSync(path.join(output,'original-capture.v8'),raw,{flag:'wx'});
    fs.writeFileSync(path.join(output,'original-capture.sha256'),hash(raw)+'\n',{flag:'wx'});
    assert.equal(setters.length,2,'Only original initial shaft/head velocities may be assigned');assert.ok(setters.every(s=>s.h===0&&s.method==='setLinvel'));
    // First creation boundary has maxExtent=0 before deferred initialization. Its
    // zero angular velocity makes the pre predicate independent of that value.
    for(const role of ['shaft','head'])same(frames[0][role].angular,[0,0,0]);
    const oracleInputs=frames.flatMap(frame=>['shaft','head'].map(role=>{const b=frame[role],m=bootstrap[role];return{
      linear:b.linear,angular:b.angular,translation:b.translation,rotation:b.rotation,force:[0,0,0],torque:[0,0,0],
      invMass:b.invMass,invInertia:b.invInertia,localCom:b.localCom,maxExtent:m.maxExtent,ccdThickness:m.ccdThickness,dt:frame.dt,
      nextTranslation:b.translation,nextRotation:b.rotation};}));
    const oracleRun=spawnSync(probe,[],{input:JSON.stringify(oracleInputs),encoding:'utf8',maxBuffer:64*1024*1024,timeout:120000});assert.equal(oracleRun.status,0,oracleRun.stderr);
    const oracle=JSON.parse(oracleRun.stdout);assert.equal(oracle.sourceRevision,D.SOURCE_REVISION);assert.equal(oracle.items.length,oracleInputs.length);
    let activeChecks=0;for(let i=0;i<frames.length;i++)for(const [j,role]of ['shaft','head'].entries()){
      const frame=frames[i],native=oracle.items[2*i+j].pre,m=bootstrap[role],pointSpeed=f(native.pointSpeed),motion=f(pointSpeed*frame.dt),threshold=f(.5*m.ccdThickness);
      assert.equal(pointSpeed,sourcePointSpeed(frame[role],m.maxExtent),'Source f32 point-speed must match direct pinned Rust');assert.equal(native.active,motion>threshold);
      if(frame[role].pre){assert.equal(native.active,frame[role].pre.active);assert.equal(pointSpeed,frame[role].pre.pointSpeed);}frame[role].sourcePre={...native,pointSpeed,motion,threshold};activeChecks+=+native.active;
    }
    assert.equal(activeChecks>0,firstActive!==null);
    const nativeChecks={};for(const name of ['created','first-pre','peak-shaft','peak-head',...(firstActive?['first-active-pre']:[])]){
      const entry=saved[name],d=decode(entry.bytes);nativeChecks[name]={snapshotSha256:hash(entry.bytes),h:entry.metadata.h,roles:{}};
      for(const role of ['shaft','head']){const actual=nativeBody(d,handles[role]);nativeChecks[name].roles[role]=actual;
        same(actual.force,[0,0,0]);same(actual.torque,[0,0,0]);const observed=entry.metadata.frame?.[role];if(observed){same(actual.linear,observed.linear);same(actual.angular,observed.angular);}
        if(entry.metadata.h>1){assert.equal(actual.maxExtent,bootstrap[role].maxExtent);assert.equal(actual.ccdThickness,bootstrap[role].ccdThickness);same(actual.localCom,bootstrap[role].localCom);}
      }
    }
    same(sourceHashes(vendor),identities.sources);assert.equal(fileHash(decoder),identities.decoderSha256);assert.equal(fileHash(probe),identities.probeSha256);
    const snapshots={};for(const [name,entry]of Object.entries(saved)){const file=name+'.bin';fs.writeFileSync(path.join(output,file),entry.bytes,{flag:'wx'});snapshots[name]={file,bytes:entry.bytes.length,sha256:hash(entry.bytes),metadata:entry.metadata};}
    const bytes=v8.serialize({input,identities,frames,bootstrap,nativeChecks,setters});fs.writeFileSync(path.join(output,'trace.v8'),bytes,{flag:'wx'});
    const report={schema:'live-cue-ui-domain-fixed-original-report-v1',input,identities,clearance,accepted,sourceOnly:true,originalFilesUnchanged:true,frameCount:frames.length,worldStepsIncludingOuterCompletion:h,outerSteps:outer,
      observedTime:{firstPre:frames[0].time,lastPre:frames.at(-1).time,sourceCueRemovedAt:lab.lastStroke.ended},lastStroke:lab.lastStroke,
      bootstrap,peak,firstActive,activePreChecks:activeChecks,totalPreChecks:oracleInputs.length,nativeSourcePreComparisonsExact:true,
      positiveTOIMeasured:false,positiveClampMeasured:false,postSolveActivationCoverage:false,universalUIExclusion:false,
      scope:'Only this original UI-reachable fixed input through cue withdrawal; pre predicates only. No CPU/GPU candidate or parity claim.',
      invariantBasis:'Cue shapes, masses and local poses remain unchanged. maxExtent/thickness come from first native world snapshot, are rechecked at retained extrema, and are constant by source. User force/torque and gravityScale are zero at every pre-step; native force/torque verified at retained boundaries. The direct pinned Rust pre method is called for every measured shaft/head state.',
      snapshots,trace:{file:'trace.v8',bytes:bytes.length,sha256:hash(bytes)},nativeChecks};
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({output,frameCount:report.frameCount,peak,firstActive,activePreChecks:activeChecks,observedTime:report.observedTime,reportSha256:fileHash(path.join(output,'report.json'))},null,2));return report;
  }finally{lab.dispose();}
}
module.exports={capture,sourcePointSpeed,input};
if(require.main===module)capture(process.argv[2]).catch(e=>{console.error(e.stack);process.exitCode=1;});
