'use strict';
// Prepare a self-running, read-only browser verification page from already
// admitted artifacts. No decoder subprocess, physics step, browser launch,
// external upload, or changes to original captures. Serve OUT on localhost.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {fixtures,hash,ORIGINAL_BINARY_SHA256}=require('./rapier-snapshot-browser-fixtures.cjs');
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'.browser-decoder-evidence','cloud-page');
const provenancePath=process.env.RAPIER_WASM_PROVENANCE;
const referencePath=process.env.RAPIER_BROWSER_REFERENCE_LOG;
assert.ok(provenancePath&&referencePath,'Explicit WASM provenance and previous native differential log required');
const p=JSON.parse(fs.readFileSync(provenancePath,'utf8'));
for(const [file,sha]of Object.entries(p.build.sources))assert.equal(hash(fs.readFileSync(path.join(ROOT,file))),sha,'Built candidate source unchanged: '+file);
const reference=fs.readFileSync(referencePath),records=reference.toString('utf8').split('\n').filter(l=>l.includes('"typedStateSha256"')).map(l=>JSON.parse(l.slice(l.indexOf('{'))));
assert.equal(records.length,8);const rows=fixtures();assert.equal(rows.length,8);
const wasm=fs.readFileSync(p.wasmPath),engine=fs.readFileSync(path.join(ROOT,'vendor/rapier.cjs'));
assert.equal(hash(wasm),p.wasmSha256);assert.equal(hash(engine),p.engineSha256);
fs.mkdirSync(OUT,{recursive:true});
for(const file of ['browser.mjs','codec.js'])fs.copyFileSync(path.join(ROOT,'tools/rapier-snapshot-decoder',file),path.join(OUT,file));
fs.writeFileSync(path.join(OUT,'decoder.wasm'),wasm);fs.writeFileSync(path.join(OUT,'engine'),engine);
const manifest={scope:'Read-only snapshot import; NOT browser gameplay or GPU world parity',originalBinarySha256:ORIGINAL_BINARY_SHA256,referenceLogSha256:hash(reference),provenance:p,rows:rows.map((row,i)=>{
 const r=records.find(r=>r.label===row.label);assert.ok(r&&r.nativeCandidateStdoutByteIdentical&&r.wasmTypedIdentical&&r.typedReencodeByteIdentical);assert.equal(r.snapshotSha256,row.snapshotSha256);assert.equal(r.sourceSha256,row.source.sha256);assert.equal(r.bytes,row.bytes.length);
 fs.writeFileSync(path.join(OUT,'snapshot-'+i),row.bytes);return {...r,url:'snapshot-'+i};
})};
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest));
fs.copyFileSync(path.join(ROOT,'tests/rapier-snapshot-browser-page.mjs'),path.join(OUT,'test.mjs'));
fs.writeFileSync(path.join(OUT,'index.html'),'<!doctype html><meta charset="utf-8"><title>Read-only Rapier snapshot import verification</title><h1>Read-only snapshot import verification</h1><p>Eight archived native boundaries. No physics stepping, gameplay or GPU parity claim.</p><button id="run">Run eight snapshot checks</button><pre id="result" role="status">Ready. Test artifacts are local only.</pre><script type="module" src="test.mjs"></script>');
console.log(JSON.stringify({directory:OUT,manifestSha256:hash(JSON.stringify(manifest)),referenceLogSha256:manifest.referenceLogSha256,wasmSha256:p.wasmSha256,snapshots:rows.length}));
