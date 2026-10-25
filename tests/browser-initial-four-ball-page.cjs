'use strict';
// Preparation only, from unchanged archived native bytes and current Node
// exporter. No native capture/init/step; no browser launch or external upload.
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'.browser-import-evidence','page'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
 const {pack}=await import('./browser-initial-import-evidence.mjs'),p=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE,'utf8'));
 for(const [file,sha]of Object.entries(p.build.sources))assert.equal(hash(fs.readFileSync(path.join(ROOT,file))),sha,'Unchanged admitted WASM build source: '+file);
 const bytes=fs.readFileSync(process.env.FOUR_BALL_CREATION_V8??'/tmp/billiard-original-four-ball-created-canonical-v1.v8');assert.equal(hash(bytes),'b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187');
 const record=v8.deserialize(bytes),row=record.boundaries.strikeCreated,E=require('./four-ball-world-seed.cjs');
 const expected=E.exportInitialSeed({strikeCreated:row,modeCreationJournal:record.modeCreationJournal,strikeCreationJournal:record.strikeCreationJournal});require('../src/experimental-four-ball-world').validate(expected);
 const capture={...Object.fromEntries(['boundary','candidateInput','nativeSteps','apiJournalLength','application'].map(k=>[k,row[k]])),modeCreationJournal:record.modeCreationJournal,strikeCreationJournal:record.strikeCreationJournal};
 const seen=new Set(),scripts=[];function visit(name){if(seen.has(name))return;seen.add(name);const file='src/'+name+'.js',source=fs.readFileSync(path.join(ROOT,file),'utf8');for(const m of source.matchAll(/(?:require\('\.\/|load\(')([\w-]+)(?:\.js)?'/g))visit(m[1]);scripts.push(file);}
 visit('experimental-four-ball-world');
 const files=[...scripts,'tests/browser-initial-import-evidence.mjs','tests/browser-initial-four-ball-page.mjs',...fs.readdirSync(path.join(ROOT,'src/browser-initial-import')).map(n=>'src/browser-initial-import/'+n),'tools/rapier-snapshot-decoder/browser.mjs','tools/rapier-snapshot-decoder/codec.js'];
 for(const file of files){fs.mkdirSync(path.dirname(path.join(OUT,file)),{recursive:true});fs.copyFileSync(path.join(ROOT,file),path.join(OUT,file));}
 const wasm=fs.readFileSync(p.wasmPath),engine=fs.readFileSync(path.join(ROOT,'vendor/rapier.cjs'));assert.equal(hash(wasm),p.wasmSha256);assert.equal(hash(engine),p.engineSha256);
 for(const[name,value]of Object.entries({'decoder.wasm':wasm,engine,snapshot:row.snapshot,'capture.json':JSON.stringify(pack(capture))}))fs.writeFileSync(path.join(OUT,name),value);
 const manifest={scope:'Initial snapshot import and existing runtime admission only. No physics stepping, product gameplay or GPU parity claim.',provenance:p,archivedSourceSha256:hash(bytes),snapshotSha256:row.snapshotSha256,expectedSeedSha256:hash(JSON.stringify(pack(expected))),sources:Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync(path.join(ROOT,file)))])),scripts:scripts.filter(x=>x!=='src/experimental-cue-convex-topology.js')};
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest));
 fs.writeFileSync(path.join(OUT,'index.html'),'<!doctype html><meta charset="utf-8"><title>Initial four-ball browser import</title><h1>Initial-only four-ball import</h1><p>Native snapshot → browser WASM decoder → pure projector → unchanged runtime admission. No physics stepping.</p><button id="run">Run initial import checks</button><pre id="result" role="status">Ready.</pre><script type="module" src="tests/browser-initial-four-ball-page.mjs"></script>');
 console.log(JSON.stringify({directory:OUT,expectedSeedSha256:manifest.expectedSeedSha256,scripts:manifest.scripts.length,snapshotSha256:manifest.snapshotSha256}));
})().catch(e=>{console.error(e);process.exitCode=1;});
