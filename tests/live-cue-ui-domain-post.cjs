'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{FIXED}=require('./live-cue-ui-domain-post-capture.cjs'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
test('new observer is explicitly limited to three retained hashes and original joint context',()=>{
 const host=fs.readFileSync(path.join(__dirname,'live-cue-ui-domain-source-probe-main.rs'),'utf8');assert.deepEqual(FIXED.map(x=>x[1]),[1,54,152]);
 for(const [,h,sha]of FIXED)assert.ok(host.includes(`("${sha}", ${h})`));
 for(const check of ['world.impulse_joints.len()!=2','world.bodies.len()!=22','world.colliders.len()!=25','j.data.locked_axes.bits()==57','j.data.locked_axes.bits()==62','post!=unobserved','bincode::serialize(&world)?!=bytes'])assert.ok(host.includes(check),check);
 assert.match(fs.readFileSync(path.join(__dirname,'active-ccd-source-probe/main.rs'),'utf8'),/Post-withdrawal no-joint source capture only/,'Previous narrower host remains unchanged');
});
test('post report preserves three-step scope and independent activation/TOI/clamp fields',{skip:!process.env.LIVE_CUE_UI_POST_REPORT},()=>{
 const file=path.resolve(process.env.LIVE_CUE_UI_POST_REPORT),dir=path.dirname(file),r=JSON.parse(fs.readFileSync(file));
 assert.deepEqual(r.checkedOriginalH,[1,54,152]);assert.equal(r.checkedWorldStepCount,3);assert.equal(r.originalLiveStepCount,174);assert.equal(r.remainingWorldStepsUnmeasured,171);
 for(const k of ['originalInputChanged','originalShotRecaptured','nativeRecurrence','allLivePostStepsCovered','universalUIExclusion','paritySuccess'])assert.equal(r[k],false,k);
 for(const s of r.steps){assert.equal(s.sourceObservedAndUnobservedBytesEqual,true);assert.ok(s.postSourcePredicatesChecked>=5);assert.equal(typeof s.positivePreTOI,'boolean');assert.equal(typeof s.postSolveCueActive,'boolean');assert.equal(typeof s.changedPoseClamps,'number');
   assert.equal(hash(path.join(dir,s.nativePost.file)),s.nativePost.sha256);assert.equal(hash(path.join(dir,s.observed.file)),s.observed.sha256);
   for(const stage of s.solved){assert.equal(stage.bodies.length,5);assert.equal(stage.bodies.filter(b=>['shaft','head'].includes(b.role)).length,2);for(const b of stage.bodies)assert.equal(b.ccdActive,b.sourcePost.active);}
 }
});
