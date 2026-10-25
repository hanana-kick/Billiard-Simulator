// Pure sequential preparer: unchanged strict original oracle loader, never GPU
// work, engine init/step/restore, or candidate initialization. Expected-only data.
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import assert from 'node:assert/strict';
import {hash,loadExpectedOracle,forbidNativeContinuation} from './bounded-gpu-shot-source.mjs';
import {hashFile,comparisonContractHash} from './bounded-gpu-shot-shards.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),directory=process.env.BOUNDED_EXPECTED_SHARDS;
assert.ok(directory&&path.isAbsolute(directory),'Set a fresh absolute workspace BOUNDED_EXPECTED_SHARDS directory');
assert.equal(fs.existsSync(directory),false,'Never overwrite a frozen expected shard directory');
const restore=forbidNativeContinuation();
try{
  const oracle=loadExpectedOracle(),originalFile=process.env.FOUR_BALL_FULL_REPLAY,
    originalBytes=fs.readFileSync(originalFile+'.json'),originalManifest=JSON.parse(originalBytes);
  assert.equal(oracle.status,'native-rest-complete');
  fs.mkdirSync(directory,{recursive:true});
  function write(file,value){const bytes=v8.serialize(value);fs.writeFileSync(path.join(directory,file),bytes,{flag:'wx'});
    assert.deepEqual(v8.deserialize(fs.readFileSync(path.join(directory,file))),value,'Exact expected shard roundtrip');
    return {file,sha256:hash(bytes),bytes:bytes.length};}
  const frames=[];for(let start=0;start<oracle.frames.length;start+=64){const rows=oracle.frames.slice(start,start+64);frames.push({...write('frames-'+start+'.v8',rows),start,count:rows.length});}
  const checkpoints=oracle.checkpoints.filter(x=>x.step>0).map(({step,row})=>{
    // These are exactly the original row roots read by the unchanged checkpoint
    // assertions and graphView. No values, contacts, bodies or order are derived.
    // Omit only unused snapshot bytes/typed trees and unused global state roots.
    const projected={state:{islands:row.state.islands,narrow_phase:{contact_graph:row.state.narrow_phase.contact_graph}},
      queues:row.queues,bodies:row.bodies,colliders:row.colliders,contactPairs:row.contactPairs,proxies:row.proxies};
    for(const key of ['queues','bodies','colliders','contactPairs','proxies'])assert.equal(projected[key],row[key]);
    assert.equal(projected.state.islands,row.state.islands);assert.equal(projected.state.narrow_phase.contact_graph,row.state.narrow_phase.contact_graph);
    return {...write('checkpoint-'+step+'.v8',projected),outerStep:step};
  });
  assert.equal(await hashFile(originalFile),originalManifest.sha256,'Original immutable bytes unchanged during preparation');
  const manifest={schema:'bounded-four-ball-expected-only-shards-v1',candidateInput:false,
    originalIdentity:originalManifest.identity,originalSha256:originalManifest.sha256,originalManifestSha256:hash(originalBytes),
    preparerSha256:hash(fs.readFileSync(import.meta.filename)),readerSha256:hash(fs.readFileSync(path.join(ROOT,'tests/bounded-gpu-shot-shards.mjs'))),
    comparisonContractSha256:comparisonContractHash(),initialSnapshotSha256:oracle.initialSnapshotSha256,
    status:oracle.status,hCount:oracle.hCount,firstRestOuter:oracle.firstRestOuter,score:oracle.score,lastGame:oracle.frames.at(-1).game,frames,checkpoints};
  const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(directory,'manifest.json'),bytes,{flag:'wx'});
  console.log(JSON.stringify({scope:'pure-expected-only-shard-preparation',manifestSha256:hash(bytes),directory,
    originalSha256:manifest.originalSha256,h:manifest.hCount,checkpoints:checkpoints.length,
    totalShardBytes:[...frames,...checkpoints].reduce((n,x)=>n+x.bytes,0),memory:process.memoryUsage(),processMaxRSSKiB:process.resourceUsage().maxRSS}));
}finally{restore();}
