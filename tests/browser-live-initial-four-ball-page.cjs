'use strict';
// Build a standalone LOCAL harness. No native init/step, fixtures or seed inputs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'.browser-live-capture-evidence','page');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const source=fs.readFileSync(path.join(ROOT,'tests/four-ball-created-fixture.cjs'),'utf8');
function section(from,to){const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
// Exact original observer/registry helpers. Only the continuation after the
// strikeCreated checkpoint is removed; no archived source data are loaded.
const prefix=section('function captureOriginalController(',"    if (journal) observeApi(lab.queue, 'drainCollisionEvents');");
const cleanup=section('  } finally {\n    while (restores.length)', 'function decodeBoundary(');
const reference=`import {pack} from './browser-initial-import-evidence.mjs';
const copy=x=>structuredClone(x), R=globalThis.RAPIER;
const assert={ok(v,m){if(!v)throw Error(m||'Reference assertion');},equal(a,b,m){if(!Object.is(a,b))throw Error(m||'Reference equal');},deepEqual(a,b,m){if(JSON.stringify(pack(a))!==JSON.stringify(pack(b)))throw Error(m||'Reference deep equality');}};
const hash=()=>{throw Error('Unexpected original callback in initial-only journal');};
const SETTINGS=Object.freeze({angle:0,elevation:8,tipX:0,tipY:0,speed:2});
${section('function parts(', 'function plain(')}
${section('function observeMethod(', 'function sourceIdentity(')}
${section('function objectRegistry(', 'function captureOriginalController(')}
${prefix}
    const row=boundaries.strikeCreated;
    const capture={...Object.fromEntries(['boundary','candidateInput','nativeSteps','apiJournalLength','application'].map(k=>[k,row[k]])),
      modeCreationJournal:apiJournal.filter(e=>e.phase==='modeCreation'),
      strikeCreationJournal:apiJournal.filter(e=>e.phase==='strikeCreation'&&e.method!=='propagateModifiedBodyPositionsToColliders')};
    return {snapshot:row.snapshot.slice(),capture,apiJournal};
${cleanup}
export {captureOriginalController,applicationState};
`;
const p=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE,'utf8'));
for(const[file,sha]of Object.entries(p.build.sources))assert.equal(hash(fs.readFileSync(path.join(ROOT,file))),sha,'Pinned decoder source '+file);
const engine=fs.readFileSync(path.join(ROOT,'vendor/rapier.cjs')),wasm=fs.readFileSync(p.wasmPath);
assert.equal(hash(engine),p.engineSha256);assert.equal(hash(wasm),p.wasmSha256);
const seen=new Set(),scripts=[];function visit(name){if(seen.has(name))return;seen.add(name);const file='src/'+name+'.js',s=fs.readFileSync(path.join(ROOT,file),'utf8');for(const m of s.matchAll(/(?:require\('\.\/|load\(')([\w-]+)(?:\.js)?'/g)){if(name==='experimental-cue-broad-phase'&&m[1]==='experimental-ccd-bvh-world-bridge')continue;visit(m[1]);}scripts.push(file);}visit('experimental-four-ball-world');
const originals=['src/math.js','src/render-cadence.js','src/physics.js','src/game-rules.js','src/controller.js'];
const files=[...new Set([...originals,...scripts,'tests/browser-initial-import-evidence.mjs','tests/browser-live-initial-four-ball-page.mjs',...fs.readdirSync(path.join(ROOT,'src/browser-initial-import')).map(n=>'src/browser-initial-import/'+n),'tools/rapier-snapshot-decoder/browser.mjs','tools/rapier-snapshot-decoder/codec.js'])];
for(const file of files){fs.mkdirSync(path.dirname(path.join(OUT,file)),{recursive:true});fs.copyFileSync(path.join(ROOT,file),path.join(OUT,file));}
fs.writeFileSync(path.join(OUT,'tests/original-initial-observer.mjs'),reference);
fs.writeFileSync(path.join(OUT,'engine.js'),`globalThis.RAPIER=(()=>{const exports={};const module={exports};\n${engine.toString().replace(/\/\/# sourceMappingURL=.*$/mg,'')}\nreturn module.exports;})();`);
fs.writeFileSync(path.join(OUT,'engine'),engine);fs.writeFileSync(path.join(OUT,'decoder.wasm'),wasm);
const manifest={scope:'Live original constructor72 → original controller four-ball setup → original default fire → synchronous initial snapshot → WASM decoder → same-authority World.validate. No first h, GPU stepping or product switch.',provenance:p,sources:Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync(path.join(ROOT,file)))])),originalObserverSourceSha256:hash(source),generatedReferenceSha256:hash(reference),originals,scripts:scripts.filter(x=>x!=='src/experimental-cue-convex-topology.js')};
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest));
fs.writeFileSync(path.join(OUT,'index.html'),'<!doctype html><meta charset="utf-8"><title>Live original four-ball capture</title><h1>Live original four-ball initial capture</h1><p>Constructor settling only. Ends after default fire, before first h. No GPU work.</p><button id="run">Run live source checks</button><a id="download" hidden download="live-initial-four-ball.json">Download live capture evidence</a><pre id="result" role="status">Ready.</pre><script type="module" src="tests/browser-live-initial-four-ball-page.mjs"></script>');
console.log(JSON.stringify({directory:OUT,sources:files.length,originalObserverSourceSha256:manifest.originalObserverSourceSha256}));
