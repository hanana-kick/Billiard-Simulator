// Portable baseline fingerprints were generated directly from frozen7512e3a,
// then compared with the additive retained generators before being recorded.
// No git object or developer worktree is a test-time dependency. String fields
// are UTF-8 SHA256; word arrays hash their exact little-endian Uint32 bytes;
// layout hashes JSON.stringify in the original property order.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {spawnSync} from 'node:child_process';import{createHash}from'node:crypto';import{pathToFileURL}from'node:url';
const hash=x=>createHash('sha256').update(typeof x==='string'?x:ArrayBuffer.isView(x)?Buffer.from(x.buffer,x.byteOffset,x.byteLength):JSON.stringify(x)).digest('hex');
const GOLDEN={
  "initial": "125133cd5e4e6ff4e3c5a604d9f06cd646a33f50ed495aab2cffd4c237ef5aff",
  "program": "8f3f25666f6f6e506c5d68c71d18dce2686ebd726a52ecaa6b68d0cf50d7b432",
  "geometry": "5fd24b20bfa4190bcb088c045f9c3122e3690190039b1d13ccf77df3ae001707",
  "layout": "f9cd8d382c8808d0810b2b8c6c293b6a7d2273bde237b15c343c5762cfee99d4",
  "floor": "2ecf8a2d1380f0b88ac11a84a47ac2812194c40ee37f2f75c7d71ff6352bdaa4",
  "pre": "c6c6d3710c4484c406520221a130086b4e74b23172c668fbfea42c67f151baf8",
  "roster": "671759bcf18cd3658779f83fd64211b36ee5d73fbefc35de8285560a63985aae",
  "prefix": "c8d2aba27762e557a7e3ed04d811b9f5f2181d09b6a62e1a04efc25cbaf06bce",
  "numericalKernels": "3338ae88e8049ceaffa50231c17523bab62838b7dd4cb8e4b1addc21e2df5ced",
  "application": "dde78def5407246a0b3b9b17b94d4ead73fa101f70e882aa7d3c57f52247d3f3",
  "numerical": "e923d6c63498f221078e30d0631888693bb111913dbc33fa2213689c29ad65c8"
};
async function fingerprint(dir,raw){const load=s=>import(pathToFileURL(dir+'/'+s)),D=await load('tools/rapier-snapshot-decoder/browser.mjs'),provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.resolve(dir,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json'))),decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(dir+'/vendor/rapier.cjs')),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256}),admit=await load('src/resident-candidate/three-ball-host-admission.mjs'),owner=(await load('src/resident-candidate/three-ball-created-owner.mjs')),template=await owner.packThreeBallCreatedOwnerTemplate(await admit.createThreeBallCreatedOwnerSeed(await admit.admitThreeBallHost(decoder,raw))),module=async n=>load('src/resident-candidate/'+n+'.mjs'),C=await module('three-ball-second-collision'),N=await module('three-ball-second-numerical'),P=await module('three-ball-second-physical'),A=await module('three-ball-second-application'),c=C.createThreeBallSecondCollisionPlan(template),n=N.createThreeBallSecondNumericalPlan(c),p=P.createThreeBallSecondPhysicalPlan(n),a=A.createThreeBallSecondApplicationPlan(p),d=a.layout,o=c.first.programOffsets;
const values={initial:hash(a.initialWords),program:hash(a.program),geometry:hash(a.geometry),layout:hash(a.layout),floor:hash((await module('three-ball-current-floor')).generateThreeBallCurrentFloorWGSL(c.floor,{stateBase:d.currentFloor,programBase:o.floor,scratchBase:0})),pre:hash((await module('three-ball-current-pre-ccd')).generateThreeBallCurrentPreCcdWGSL(c.pre,{stateBase:d.currentPre,programBase:o.preCcd,scratchBase:0})),roster:hash((await module('three-ball-current-roster')).generateThreeBallCurrentRosterWGSL(c.roster,{stateBase:d.currentRoster,floorBase:d.currentFloor,emptyBase:d.currentEmpty})),prefix:hash((await module('three-ball-second-prefix')).generateThreeBallSecondPrefixWGSL(c.prefix)),numericalKernels:hash((await module('three-ball-current-numerical-kernels')).generateThreeBallCurrentNumericalWGSL()),application:hash(A.generateThreeBallSecondApplicationWGSL(a)),numerical:hash(N.buildThreeBallSecondNumericalSource(n).source)};return values;}

test('all old h2 emitted source, initial words, programs, geometry and layout remain byte-identical',async()=>{const root=path.resolve(import.meta.dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-retained-byte-gate-'));try{const file=path.join(tmp,'original.v8'),child=spawnSync(process.execPath,['tests/resident-three-ball-two-h-native-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);const data=v8.deserialize(fs.readFileSync(file));assert.deepEqual(await fingerprint(root,data.raw),GOLDEN);}finally{fs.rmSync(tmp,{recursive:true});}});
