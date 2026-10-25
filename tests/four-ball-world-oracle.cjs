'use strict';
// Independent original controller, created once and advanced continuously.
// Expected-only trace. No restore, candidate state, or altered physics method.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),crypto=require('node:crypto');
const F=require('./four-ball-created-fixture.cjs'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const SCHEMA='original-controller-four-ball-continuous-created-to-rest-v1',MAX_OUTER=16000,GRID=128;
const vec=x=>[x.x,x.y,x.z],quat=x=>[x.x,x.y,x.z,x.w];
function sample(b){const m=b.effectiveWorldInvInertia(),invInertia=[m.m11,m.m12,m.m13,m.m21,m.m22,m.m23,m.m31,m.m32,m.m33];return{translation:vec(b.translation()),rotation:quat(b.rotation()),linear:vec(b.linvel()),angular:vec(b.angvel()),invInertia,sleeping:b.isSleeping()};}
function topology(lab){const pairs=new Map();lab.world.forEachCollider(co=>lab.world.contactPairsWith(co,other=>{const ids=[F.parts(co.handle),F.parts(other.handle)].sort((a,b)=>a.index-b.index),key=ids.map(h=>h.index+':'+h.generation).join('/');if(pairs.has(key))return;const manifolds=[];lab.world.contactPair(co,other,m=>manifolds.push({points:m.numContacts(),solverContacts:m.numSolverContacts()}));pairs.set(key,{colliders:ids,manifolds});}));return[...pairs].sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v);}
function identity(initialPath){return{schema:SCHEMA,maxOuter:MAX_OUTER,grid:GRID,initialArtifactSha256:hash(fs.readFileSync(initialPath)),initialManifestSha256:hash(fs.readFileSync(initialPath+'.json')),captureFunctionSha256:hash(capture.toString()),sources:Object.fromEntries([__filename,require.resolve('./four-ball-created-fixture.cjs'),require.resolve('../src/controller'),require.resolve('../src/physics'),require.resolve('../src/game-rules'),require.resolve('../src/math'),require.resolve('../vendor/rapier.cjs')].map(file=>[path.relative(path.resolve(__dirname,'..'),file),hash(fs.readFileSync(file))]))};}
function capture(record){
 const c=new LabController();c.lab=new PhysicsLab(F.R);const lab=c.lab,frames=[],events=[],pending=new Map();let outer=0,substep=0,subdivisions=64,hCount=0,lastPresent=true,lastSignature,previousSnapshot,follow=-1,score=null;
 const keep=(step,bytes,reason)=>{if(step<0)return;if(!pending.has(step))pending.set(step,{step,snapshot:bytes,reasons:[]});const p=pending.get(step);assert.equal(hash(p.snapshot),hash(bytes));if(!p.reasons.includes(reason))p.reasons.push(reason);};
 try{
  c.state.gameMode='four';c.setupGame();assert.equal(c.fire(),true);assert.equal(hash(lab.world.takeSnapshot()),record.boundaries.strikeCreated.snapshotSha256,'Original setupGame+fire independently reproduces exact sole candidate seed');
  previousSnapshot=lab.world.takeSnapshot();keep(0,previousSnapshot,'strikeCreated');const originalEvent=lab.onEvent;
  lab.onEvent=e=>{Reflect.apply(originalEvent,lab,[e]);events.push(structuredClone(e));};
  lastSignature=JSON.stringify({cuePresent:true,sleeping:lab.objects.map(o=>o.body.isSleeping()),topology:topology(lab)});
  const originalPatch=lab.angularPatchResistance;
  lab.angularPatchResistance=function(h){Reflect.apply(originalPatch,this,[h]);hCount++;const present=!!lab.cue,separation=lastPresent&&!present;lastPresent=present;substep++;const outerBoundary=substep===subdivisions;if(outerBoundary){outer++;substep=0;subdivisions=present?64:1;}
   const frame={hCount,h,time:lab.time,outerStep:outer,outerSubstep:substep,cuePresent:present,separation,balls:lab.objects.map(o=>({id:o.id,...sample(o.body)})),cue:present?{shaft:sample(lab.cue.body),head:sample(lab.cue.head)}:null,events:structuredClone(lab.events),game:c.game.snapshot()};
   if(hCount===1)assert.deepEqual(lab.world.takeSnapshot(),record.boundaries['firstH.postApplication'].snapshot,'Independent continuous first h equals frozen original, no restored pending journals');frames.push(frame);
  };
  for(let step=1;step<=MAX_OUTER;step++){
   lab.step();assert.equal(outer,step);assert.equal(substep,0);const bytes=lab.world.takeSnapshot(),signature=JSON.stringify({cuePresent:!!lab.cue,sleeping:lab.objects.map(o=>o.body.isSleeping()),topology:topology(lab)});
   if(step<=2||step%GRID===0)keep(step,bytes,'fixed-grid');if(step===follow)keep(step,bytes,'after-transition');if(signature!==lastSignature){keep(step-1,previousSnapshot,'before-transition');keep(step,bytes,'at-transition');follow=step+1;}
   if(!lab.cue&&lab.objects.every(o=>o.body.isSleeping())){c.finishGameShot();score={cueId:record.boundaries.strikeCreated.application.controller.selectedId,delta:c.game.scores[1],nextCue:c.game.activeCue};frames.at(-1).game=c.game.snapshot();keep(step,bytes,'native-full-rest');break;}
   previousSnapshot=bytes;lastSignature=signature;
  }
  const registry=record.boundaries.strikeCreated.application.registry;
  const checkpoints=[...pending.values()].sort((a,b)=>a.step-b.step).map(p=>{const row=F.decodeBoundary({boundary:'expected-only-continuous-outer-'+p.step,candidateInput:false,snapshot:p.snapshot,application:{registry}});return{step:p.step,reasons:p.reasons,row};});
  return{schema:SCHEMA,initialSnapshotSha256:record.boundaries.strikeCreated.snapshotSha256,frames,events,checkpoints,score,firstRestOuter:score?outer:null,status:score?'native-rest-complete':'horizon-incomplete',hCount,outerSteps:outer};
 }finally{lab.dispose();clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);}
}
async function captureArtifact(file,initialPath){assert.ok(path.isAbsolute(file)&&path.isAbsolute(initialPath));assert.ok(!fs.existsSync(file)&&!fs.existsSync(file+'.json'),'Never overwrite frozen oracle');const id=identity(initialPath),{record}=F.loadArtifact(initialPath);await F.R.init();const payload=capture(record);assert.deepEqual(identity(initialPath),id);const bytes=v8.serialize(payload),manifest={identity:id,sha256:hash(bytes),bytes:bytes.length,status:payload.status,firstRestOuter:payload.firstRestOuter,score:payload.score,hCount:payload.hCount,checkpoints:payload.checkpoints.length,candidateStateUsed:false,nativeRestoreUsed:false};fs.writeFileSync(file,bytes,{flag:'wx'});fs.writeFileSync(file+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;}
function loadArtifact(file,initialPath){assert.ok(path.isAbsolute(file)&&path.isAbsolute(initialPath));const bytes=fs.readFileSync(file),m=JSON.parse(fs.readFileSync(file+'.json','utf8'));assert.deepEqual(m.identity,identity(initialPath));assert.equal(hash(bytes),m.sha256);assert.equal(bytes.length,m.bytes);const r=v8.deserialize(bytes);assert.equal(r.schema,SCHEMA);assert.equal(r.frames.length,r.hCount);assert.equal(r.firstRestOuter,m.firstRestOuter);assert.deepEqual(r.score,m.score);return r;}
module.exports={SCHEMA,MAX_OUTER,GRID,identity,captureArtifact,loadArtifact};
if(require.main===module)captureArtifact(process.argv[2],process.env.FOUR_BALL_CREATION_V8).then(m=>console.log(JSON.stringify(m,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
