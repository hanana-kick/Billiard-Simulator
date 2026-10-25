'use strict';
// Actual source-owned initial h only. Original CREATED snapshot is the sole
// seed; frozen AFTER snapshots are assertion-only, never candidate seed input.
// No native physics step/restore, after-state injection or GPU replay.
const{test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const source=process.env.CUE_INPUT_REPLAY??path.resolve(__dirname,'../../billiard-generalized-cue-input-evidence/yaw23-side-follow-prefix.v8'),enabled=!!process.env.RAPIER_SNAPSHOT_DECODER&&fs.existsSync(source);
let replay,seed,Inputs,Compare;
before(()=>{if(!enabled)return;Inputs=require('./cue-source-input-fixture.cjs');replay=Inputs.loadArtifact(source);assert.equal(replay.spec.id,'yaw23-side-follow','Fixed original initial-convex case');seed=require('./cue-source-input-hull-seed.cjs').exportSeed(replay.record,replay.spec);Compare=require('./cue-empty-convex-cache-assertions.cjs');});
function instrument({failFinal=false}={}){
 const file=require.resolve('../src/experimental-three-ball-world'),source=fs.readFileSync(file,'utf8'),baseRequire=Module.createRequire(file),m=new Module(file,module),calls=[];let fail=failFinal;
 m.filename=file;m.paths=module.paths;m.require=id=>{const actual=baseRequire(id);
  if(id==='./experimental-cue-empty-convex-cache')return{...actual,createReferenceStage(input){const stage=actual.createReferenceStage(input),step=stage.step.bind(stage);stage.step=value=>{const out=step(value);calls.push({collider:structuredClone(input.hull.handle),input:structuredClone(value),out:structuredClone(out)});return out;};return stage;}};
  if(id==='./experimental-scene-activation')return{...actual,createReferenceStage(...args){const stage=actual.createReferenceStage(...args);return Object.freeze({...stage,assertPrepared(token){stage.assertPrepared(token);if(fail){fail=false;throw Error('Injected first-h convex final-preflight failure');}}});}};
  return actual;
 };m._compile(source,file);return{World:m.exports,calls};
}
function assertOriginalFirstH(out,calls){
 assert.equal(out.frame,1);const expected=Compare.inspect(replay.record.post,Inputs.F.decode(replay.record,'post'));
 assert.deepEqual(expected.map(p=>[p.collider1.index,p.collider2.index]),[[6,22],[5,22]],'Native dense/BVTT order, not a sorted or rebuilt hull roster');
 assert.equal(Compare.compare(out,expected),0,'Every original numeric cache field and normal is exact at first h');
 assert.deepEqual(calls.map(c=>c.collider.index),[6,5]);
 for(const [i,c]of calls.entries()){
  assert.equal(c.input.previous,null,'Initial creation never borrows a later cache');assert.equal(c.out.recycled,false);
  assert.deepEqual(c.input.cylinder.translation,replay.record.created.bodies.shaft.pos.position.translation);
  assert.deepEqual(c.input.cylinder.rotation,replay.record.created.bodies.shaft.pos.position.rotation);
  assert.deepEqual(c.input.convex.translation,[0,0,0]);assert.deepEqual(c.out.worldNormal,expected[i].manifolds[0].data.normal);
  assert.equal(c.out.hullIdentity.split(':')[0],replay.record.created.snapshotSha256,'Original CREATED hull identity');
 }
}
test('actual first N3 h owns both original initial-convex births exactly and in BVTT order',{skip:!enabled,timeout:30000},async()=>{
 const{World,calls}=instrument(),own=await World.createReferenceStepper(seed);try{assert.equal(own.snapshot().emptyCueConvexPairs,undefined);assertOriginalFirstH(await own.step(),calls);const first=calls.map(c=>structuredClone(c.out));await own.step();assert.equal(calls.length,4);for(let i=0;i<2;i++)assert.deepEqual(calls[i+2].input.previous,first[i],'Second h uses only its own committed cache');}finally{own.dispose();}
});
test('initial-convex cache birth is discarded with failed first-h transaction and rebuilt exactly on retry',{skip:!enabled,timeout:30000},async()=>{
 const{World,calls}=instrument({failFinal:true}),own=await World.createReferenceStepper(seed);try{const before=own.snapshot();await assert.rejects(()=>own.step(),/first-h convex final-preflight failure/);assert.deepEqual(own.snapshot(),before);assert.equal(own.snapshot().emptyCueConvexPairs,undefined);assert.equal(calls.length,2,'Both real source numeric births ran before the late failure');const rejected=structuredClone(calls);const out=await own.step();assert.equal(calls.length,4);assert.deepEqual(calls.slice(2),rejected,'Retry recomputes from original own pose and absent cache');assertOriginalFirstH(out,calls.slice(2));}finally{own.dispose();}
});


test('optional hull ownership preserves legacy admission but rejects incomplete enabled rosters',{skip:!enabled,timeout:30000},async()=>{
 const World=require('../src/experimental-three-ball-world'),{cueEmptyConvexHulls,...legacy}=seed;
 for(const rows of[cueEmptyConvexHulls.slice(1),cueEmptyConvexHulls.map((row,i)=>i?row:{...row,hull:structuredClone(row.hull)})])assert.throws(()=>World.validate({...seed,cueEmptyConvexHulls:rows}));
 const own=await World.createReferenceStepper(legacy);try{const out=await own.step();assert.equal(out.frame,1);assert.equal(out.emptyCueConvexPairs,undefined,'Legacy seed does not claim the optional complete cache capability');assert.equal(out.globalEdges.filter(e=>[5,6].includes(e.collider1.index)&&e.collider2.index===22).length,2,'Legacy source graph ownership is unchanged');}finally{own.dispose();}
});
