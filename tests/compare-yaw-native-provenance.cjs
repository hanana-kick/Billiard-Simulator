'use strict';
// Read-only old/new native artifact comparison. It never captures, changes a
// manifest, admits a candidate, or supplies native state to a recurrent solver.
const assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function read(file){const bytes=fs.readFileSync(file),manifestBytes=fs.readFileSync(file+'.json'),manifest=JSON.parse(manifestBytes);assert.equal(hash(bytes),manifest.sha256,'Frozen payload digest: '+file);assert.equal(bytes.length,manifest.bytes);return{bytes,payload:v8.deserialize(bytes),manifest,sha256:hash(bytes),manifestSha256:hash(manifestBytes)};}
function compare(oldPrefixPath,newPrefixPath,oldFullPath,newFullPath){
 const a=read(oldPrefixPath),b=read(newPrefixPath),c=read(oldFullPath),d=read(newFullPath);
 assert.deepEqual(b.payload,a.payload,'Every created/prefix native body, cache, event, cue and snapshot value is unchanged');
 assert.deepEqual(d.payload,c.payload,'Every full-horizon native body, topology, event, score, transition and raw checkpoint is unchanged');
 const nativeSnapshotByteChecks={record:0,prefix:0,full:0},sameBytes=(x,y)=>assert.ok(Buffer.from(x).equals(Buffer.from(y)),'Exact original native snapshot bytes');
 for(const k of['before','created','post']){sameBytes(a.payload.record[k].snapshot,b.payload.record[k].snapshot);nativeSnapshotByteChecks.record++;}
 a.payload.frames.forEach((f,i)=>{if(f.raw){sameBytes(f.raw.snapshot,b.payload.frames[i].raw.snapshot);nativeSnapshotByteChecks.prefix++;}});
 c.payload.checkpoints.forEach((f,i)=>{assert.equal(f.step,d.payload.checkpoints[i].step);sameBytes(f.raw.snapshot,d.payload.checkpoints[i].raw.snapshot);nativeSnapshotByteChecks.full++;});

 const oldPrefix=a.manifest.identity,newPrefix=b.manifest.identity,{sources:oldSources,...oldRest}=oldPrefix,{sources:newSources,...newRest}=newPrefix;
 assert.deepEqual(newRest,oldRest,'Only exporter/dependency source provenance may differ in prefix identity');
 const sourceChanges=[...new Set([...Object.keys(oldSources),...Object.keys(newSources)])].filter(k=>oldSources[k]!==newSources[k]);
 assert.deepEqual(sourceChanges.slice().sort(),['tests/three-ball-contact-seed.cjs','tests/three-ball-initial-pair-seeds.cjs','tests/three-ball-yaw-fixture.cjs'].sort(),'Exactly the exporter, its new dependency and source-list declaration changed');
 const cleanFull=x=>{const{prefixIdentity,prefixSha256,prefixManifestSha256,...rest}=x;return rest;};
 assert.deepEqual(cleanFull(d.manifest.identity),cleanFull(c.manifest.identity),'Full native capture source, fixed horizon/grid and transition rule unchanged');
 assert.deepEqual(d.manifest.identity.prefixIdentity,newPrefix);assert.deepEqual(c.manifest.identity.prefixIdentity,oldPrefix);
 assert.equal(d.manifest.identity.prefixSha256,b.sha256);assert.equal(c.manifest.identity.prefixSha256,a.sha256);
 assert.equal(d.manifest.identity.prefixManifestSha256,b.manifestSha256);assert.equal(c.manifest.identity.prefixManifestSha256,a.manifestSha256);
 return{scope:'read-only exact old/new native payload comparison, exporter provenance only',sourceChanges,nativeSnapshotBytesIdentical:true,nativeSnapshotByteChecks,prefixFrames:b.payload.frames.length,fullOuterSteps:d.payload.frames.length,checkpoints:d.payload.checkpoints.length,createdSnapshotSha256:b.payload.record.created.snapshotSha256,firstRestOuter:d.payload.firstRestOuter,score:d.payload.score,prefixBytesIdentical:a.bytes.equals(b.bytes),fullBytesIdentical:c.bytes.equals(d.bytes),oldPrefixSha256:a.sha256,newPrefixSha256:b.sha256,oldFullSha256:c.sha256,newFullSha256:d.sha256,oldPrefixManifestSha256:a.manifestSha256,newPrefixManifestSha256:b.manifestSha256,oldFullManifestSha256:c.manifestSha256,newFullManifestSha256:d.manifestSha256};
}
module.exports={compare};
if(require.main===module){assert.equal(process.argv.length,6,'Provide old prefix, new prefix, old full and new full paths');console.log(JSON.stringify(compare(...process.argv.slice(2)),null,2));}
