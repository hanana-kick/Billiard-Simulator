// Expected-only, memory-bounded oracle reading. No candidate seeds or physics.
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ROOT=path.resolve(import.meta.dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
export async function hashFile(file){const h=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))h.update(chunk);return h.digest('hex');}
export function comparisonContractHash(){const src=fs.readFileSync(path.join(ROOT,'tests/bounded-gpu-shot-webgpu.mjs'),'utf8');const a=src.indexOf('function near('),b=src.indexOf('\ntest(',a);assert.ok(a>=0&&b>a);return hash(src.slice(a,b));}
export async function loadExpectedShards(){
  const directory=process.env.BOUNDED_EXPECTED_SHARDS,expectedManifest=process.env.BOUNDED_EXPECTED_SHARDS_SHA256;
  assert.ok(directory&&expectedManifest,'Prepare expected-only shards and pin BOUNDED_EXPECTED_SHARDS_SHA256');
  const bytes=fs.readFileSync(path.join(directory,'manifest.json')),m=JSON.parse(bytes);
  assert.equal(hash(bytes),expectedManifest,'Pinned prepared-manifest hash');
  assert.equal(m.schema,'bounded-four-ball-expected-only-shards-v1');assert.equal(m.candidateInput,false);
  const originalFile=process.env.FOUR_BALL_FULL_REPLAY,originalManifest=JSON.parse(fs.readFileSync(originalFile+'.json'));
  const O=require('./four-ball-world-oracle.cjs');
  assert.deepEqual(originalManifest.identity,O.identity(process.env.FOUR_BALL_CREATION_V8??'/tmp/billiard-original-four-ball-created-canonical-v1.v8'));
  assert.deepEqual(m.originalIdentity,originalManifest.identity);assert.equal(m.originalSha256,originalManifest.sha256);
  assert.equal(await hashFile(originalFile),m.originalSha256,'Entire immutable original artifact, streamed without retaining its bytes');
  assert.equal(fs.statSync(originalFile).size,originalManifest.bytes);assert.equal(m.originalManifestSha256,hash(fs.readFileSync(originalFile+'.json')));
  assert.equal(m.preparerSha256,hash(fs.readFileSync(path.join(ROOT,'tests/prepare-bounded-gpu-shot-oracle.mjs'))));
  assert.equal(m.readerSha256,hash(fs.readFileSync(path.join(ROOT,'tests/bounded-gpu-shot-shards.mjs'))));
  assert.equal(m.comparisonContractSha256,comparisonContractHash(),'All original comparison functions remain unchanged');
  assert.equal(m.hCount,originalManifest.hCount);assert.equal(m.firstRestOuter,originalManifest.firstRestOuter);
  assert.deepEqual(m.score,originalManifest.score);assert.equal(m.checkpoints.length,originalManifest.checkpoints-1);
  assert.equal(m.frames.reduce((n,x)=>n+x.count,0),m.hCount);assert.equal(m.status,'native-rest-complete');
  const checkpointByOuter=new Map(m.checkpoints.map(x=>[x.outerStep,x]));let currentChunk=null,frames=null;
  function read(entry){assert.match(entry.file,/^(frames|checkpoint)-[0-9]+\.v8$/);const raw=fs.readFileSync(path.join(directory,entry.file));assert.equal(raw.length,entry.bytes);assert.equal(hash(raw),entry.sha256,'Expected shard '+entry.file);return v8.deserialize(raw);}
  return Object.freeze({hCount:m.hCount,checkpointCount:m.checkpoints.length,firstRestOuter:m.firstRestOuter,
    initialSnapshotSha256:m.initialSnapshotSha256,score:m.score,lastGame:m.lastGame,
    originalSha256:m.originalSha256,manifestSha256:expectedManifest,
    frame(index){assert.ok(Number.isSafeInteger(index)&&index>=0&&index<m.hCount);const chunk=m.frames.find(x=>index>=x.start&&index<x.start+x.count);assert.ok(chunk);if(chunk!==currentChunk){frames=read(chunk);assert.equal(frames.length,chunk.count);currentChunk=chunk;}return frames[index-chunk.start];},
    hasCheckpoint:outer=>checkpointByOuter.has(outer),
    checkpoint(outer){const entry=checkpointByOuter.get(outer);assert.ok(entry);return read(entry);}
  });
}
