import {pack,unpack} from './browser-initial-import-evidence.mjs';
const result=document.querySelector('#result'),button=document.querySelector('#run');
button.addEventListener('click',async()=>{
 button.disabled=true;result.textContent='Running read-only initial import…';
 try{
  if([typeof Buffer,typeof process,typeof require,typeof RAPIER].some(x=>x!=='undefined'))throw Error('Unexpected Node or native engine globals');
  const manifest=await(await fetch('manifest.json')).json(),p=manifest.provenance,bytes=async url=>new Uint8Array(await(await fetch(url)).arrayBuffer());
  const M=await import('../src/browser-initial-import/four-ball.mjs'),B=await import('../tools/rapier-snapshot-decoder/browser.mjs');
  const wasm=await bytes('decoder.wasm');if(WebAssembly.Module.imports(await WebAssembly.compile(wasm)).length)throw Error('Unexpected WASM host imports');
  const decoder=await B.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:await bytes('engine'),wasmBytes:wasm,provenance:p,expectedWasmSha256:p.wasmSha256});
  const capture=unpack(await(await fetch('capture.json')).json()),snapshot=await bytes('snapshot'),snapshotBefore=snapshot.slice();
  const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(pack(value))))),x=>x.toString(16).padStart(2,'0')).join('');
  const captureBefore=await hash(capture),seed=await M.importInitialFourBall(decoder,{snapshot,capture}),actualSeedSha256=await hash(seed);
  if(actualSeedSha256!==manifest.expectedSeedSha256)throw Error('Complete source exporter comparison failed: '+actualSeedSha256);
  if(await hash(capture)!==captureBefore||snapshot.some((x,i)=>x!==snapshotBefore[i]))throw Error('Input mutated');
  for(const url of manifest.scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(Error('Runtime dependency failed: '+url));document.head.append(s);});
  globalThis.LabFourBallWorldExperimental.validate(seed);
  const Hull=globalThis.LabCueConvexTopologyExperimental;for(const s of seed.cushionSeeds)for(const c of s.cushions)Hull.assertNativeHull(c.hull);
  const variants=[c=>c.boundary='firstH.postApplication',c=>c.nativeSteps++,c=>c.application.controller.settings.angle=15,c=>c.application.registry.objects[0].body.generation++,c=>c.strikeCreationJournal.pop()];
  for(const mutate of variants){const bad=structuredClone(capture);mutate(bad);let rejected=false;try{await M.importInitialFourBall(decoder,{snapshot,capture:bad});}catch{rejected=true;}if(!rejected)throw Error('Unsupported capture accepted');}
  const owned={snapshot:snapshot.slice(),capture:structuredClone(capture)},pending=M.importInitialFourBall(decoder,owned);owned.snapshot.fill(0);owned.capture.application.controller.settings.angle=15;const stable=await pending;if(await hash(stable)!==actualSeedSha256)throw Error('Async mutation escaped ownership');
  if(typeof RAPIER!=='undefined'||typeof PhysicsLab!=='undefined')throw Error('Native gameplay engine was loaded');
  result.textContent=JSON.stringify({status:'PASS',scope:manifest.scope,userAgent:navigator.userAgent,snapshotSha256:manifest.snapshotSha256,expectedSeedSha256:manifest.expectedSeedSha256,actualSeedSha256,completeSeedEquality:true,existingWorldAdmission:true,sameHullAuthority:true,noNodeGlobals:true,noNativeEngine:true,noWasmHostImports:true,inputUnchanged:true,asyncMutationIsolated:true,unsupportedCapturesRejected:variants.length,physicsSteps:0,gpuWork:false},null,2);
 }catch(error){result.textContent=JSON.stringify({status:'FAIL',error:error.stack??String(error)},null,2);}finally{button.disabled=false;}
});
