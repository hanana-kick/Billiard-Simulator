import {pack,unpack} from './browser-initial-import-evidence.mjs';
const output=document.querySelector('#result'),button=document.querySelector('#run'),download=document.querySelector('#download');
const same=(a,b)=>{if(JSON.stringify(pack(a))!==JSON.stringify(pack(b)))throw Error('Complete exact source comparison failed');};
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const fingerprint=value=>hash(new TextEncoder().encode(JSON.stringify(pack(value))));
const load=url=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(Error('Script failed: '+url));document.head.append(s);});
const bytes=async url=>new Uint8Array(await(await fetch(url)).arrayBuffer());
let initialized;
async function initialize(){
 const manifest=await(await fetch('manifest.json')).json();
 if([typeof process,typeof Buffer,typeof require].some(x=>x!=='undefined'))throw Error('Unexpected Node globals');
 // Import the topology once, before loading the unchanged runtime scripts.
 const M=await import('../src/browser-initial-import/four-ball.mjs');
 const Live=await import('../src/browser-initial-import/live-capture.mjs');
 const B=await import('../tools/rapier-snapshot-decoder/browser.mjs');
 await load('engine.js');for(const url of manifest.originals)await load(url);await RAPIER.init();
 for(const url of manifest.scripts)await load(url);
 const Ref=await import('./original-initial-observer.mjs');
 const p=manifest.provenance,decoder=await B.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:await bytes('engine'),wasmBytes:await bytes('decoder.wasm'),provenance:p,expectedWasmSha256:p.wasmSha256});
 return {manifest,M,Live,Ref,decoder};
}
button.addEventListener('click',async()=>{
 button.disabled=true;download.hidden=true;if(download.href.startsWith('blob:'))URL.revokeObjectURL(download.href);output.textContent='Running live constructor-only checks…';
 const owned=[],runStarted=performance.now();
 try{
  const initializeStarted=performance.now();
  const {manifest,M,Live,Ref,decoder}=await(initialized??=initialize());
  const initializationMs=performance.now()-initializeStarted;
  const proto=RAPIER.World.prototype,methods=['step','createRigidBody','createCollider','createImpulseJoint','removeRigidBody','propagateModifiedBodyPositionsToColliders'];
  const descriptors=methods.map(k=>Object.getOwnPropertyDescriptor(proto,k));
  const restored=()=>methods.forEach((k,i)=>{const d=Object.getOwnPropertyDescriptor(proto,k),a=descriptors[i];if(d.value!==a.value||d.writable!==a.writable||d.enumerable!==a.enumerable||d.configurable!==a.configurable)throw Error('Observer leaked: '+k);});
  const reference=Ref.captureOriginalController();restored();
  const captureStarted=performance.now();
  const live=Live.captureLiveInitialFourBall({R:RAPIER});
  const liveConstructorCaptureMs=performance.now()-captureStarted;owned.push(live);restored();
  same(live.snapshot,reference.snapshot);same(live.capture,reference.capture);same(live.apiJournal,reference.apiJournal);
  const bodyMethods=['setLinvel','setAngvel','setTranslation','setRotation','wakeUp','sleep','applyImpulse','applyImpulseAtPoint','applyTorqueImpulse','resetForces','resetTorques','recomputeMassPropertiesFromColliders'];
  for(const body of [...live.controller.lab.objects.map(o=>o.body),...live.controller.lab.statics.map(o=>o.body),...['body','head','guide'].map(k=>live.controller.lab.cue[k])])for(const method of bodyMethods)if(Object.hasOwn(body,method))throw Error('Body observer shadow leaked');
  for(const joint of [live.controller.lab.cue.flex,live.controller.lab.cue.joint])for(const method of ['setContactsEnabled','setLimits'])if(Object.hasOwn(joint,method))throw Error('Joint observer shadow leaked');
  // Independent no-observer outcome: exactly the original source application
  // sequence, with no wrapper, fake methods, layout or seed replacement.
  const plain=new LabController();plain.lab=new PhysicsLab(RAPIER);
  try{plain.state.gameMode='four';plain.setupGame();if(plain.fire()!==true)throw Error('Unobserved default fire failed');same(live.snapshot,plain.lab.world.takeSnapshot());same(live.capture.application,Ref.applicationState(plain));}
  finally{clearTimeout(plain.noticeTimer);clearTimeout(plain.predictionTimer);plain.lab.dispose();}
  const before=await fingerprint({snapshot:live.snapshot,capture:live.capture});
  const importStarted=performance.now();
  const seed=await M.importInitialFourBall(decoder,{snapshot:live.snapshot,capture:live.capture});
  const decoderAndImportMs=performance.now()-importStarted;
  LabFourBallWorldExperimental.validate(seed);
  for(const s of seed.cushionSeeds)for(const c of s.cushions)LabCueConvexTopologyExperimental.assertNativeHull(c.hull);
  // Exercise the downloaded artifact's real sorted-key transport before any
  // runtime step. Its handle insertion order differs from the live registry.
  const transported=unpack(JSON.parse(JSON.stringify(pack({snapshot:live.snapshot,capture:live.capture}))));
  if(Object.keys(transported.capture.application.registry.objects[3].body).join(',')!=='generation,index')throw Error('Transport-order regression not exercised');
  const transportStarted=performance.now(),transportSeed=await M.importInitialFourBall(decoder,transported);
  const transportDecoderAndImportMs=performance.now()-transportStarted;
  same(transportSeed,seed);LabFourBallWorldExperimental.validate(transportSeed);
  const birth=transportSeed.cueBroadSeed.initialFourBallBirth,cloth=transportSeed.clothBirthSeed;
  for(const [a,b]of [[birth.body,cloth.body.handle],[birth.primary,cloth.ball.handle],[birth.pair,cloth.passive.handle],[birth.clothCollider,cloth.floor.handle]])if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Exact native first-birth binding identity differs after transport');
  const pending=[transportSeed],seen=new WeakSet();let canonicalHandleCount=0;
  while(pending.length){const x=pending.pop();if(!x||typeof x!=='object'||seen.has(x)||ArrayBuffer.isView(x))continue;seen.add(x);if(Object.hasOwn(x,'index')&&Object.hasOwn(x,'generation')){if(Object.keys(x).join(',')!==(Object.hasOwn(x,'bitsHex')?'index,generation,bitsHex':'index,generation'))throw Error('Noncanonical projected source handle');canonicalHandleCount++;}else pending.push(...Object.values(x));}
  if(canonicalHandleCount<=100)throw Error('Incomplete projected handle coverage');
  same(transported,{snapshot:live.snapshot,capture:live.capture});
  if(await fingerprint({snapshot:live.snapshot,capture:live.capture})!==before)throw Error('Importer mutated live inputs');
  same(live.snapshot,live.controller.lab.world.takeSnapshot());same(live.capture.application,Ref.applicationState(live.controller));
  const repeat=Live.captureLiveInitialFourBall({R:RAPIER});owned.push(repeat);restored();
  same(repeat.snapshot,live.snapshot);same(repeat.capture,live.capture);same(repeat.apiJournal,live.apiJournal);
  // Cancel and constructor failures must not poison subsequent captures.
  const abort=new AbortController();abort.abort();let cancelled=false;try{Live.captureLiveInitialFourBall({R:RAPIER,signal:abort.signal});}catch(e){cancelled=e.name==='AbortError';}if(!cancelled)throw Error('Pre-cancel accepted');restored();
  const failure=Error('Original constructor failure');let sameError=false;try{Live.captureLiveInitialFourBall({R:RAPIER,LabController:class{constructor(){throw failure;}}});}catch(e){sameError=e===failure;}if(!sameError)throw Error('Original failure not preserved');restored();
  const snapshotSha256=await hash(live.snapshot),seedSha256=await fingerprint(seed);
  const result={status:'PASS',scope:manifest.scope,userAgent:navigator.userAgent,snapshotSha256,seedSha256,
    timings:{initializationMs,liveConstructorCaptureMs,decoderAndImportMs,transportDecoderAndImportMs,totalChecksMs:performance.now()-runStarted,sampleScope:'This cloud-browser run only; timings are excluded from deterministic snapshot/seed fingerprints'},
    nativeStepsPerLiveInstance:live.capture.nativeSteps,apiJournalLength:live.capture.apiJournalLength,modeCreationMethods:live.capture.modeCreationJournal.map(e=>e.method),strikeCreationMethods:live.capture.strikeCreationJournal.map(e=>e.method),
    independentOriginalJournalEquality:true,unobservedSourceOutcomeUnchanged:true,repeatedCaptureEquality:true,
    sourceStateUnchangedByImport:true,ownedInputsUnchanged:true,prototypeAndInstanceObserversRestored:true,
    cancellationAndOriginalErrorRestored:true,existingWorldAdmission:true,sameHullAuthority:true,
    transportRoundtripSeedEquality:true,transportFirstBirthBindingIdentity:true,canonicalHandleCount,
    noArchivedSnapshotOrSeedInput:true,sourceInstances:4,totalConstructorNativeSteps:288,applicationPhysicsSteps:0,gpuWork:false,
    originalObserverSourceSha256:manifest.originalObserverSourceSha256,sources:manifest.sources};
  const artifact={schema:'live-original-four-ball-initial-capture-v1',observed:result,decoderProvenance:manifest.provenance,snapshot:live.snapshot,capture:live.capture,apiJournal:live.apiJournal};
  download.href=URL.createObjectURL(new Blob([JSON.stringify(pack(artifact))],{type:'application/json'}));download.hidden=false;
  output.textContent=JSON.stringify(result,null,2);
 }catch(error){output.textContent=JSON.stringify({status:'FAIL',error:error.stack??String(error)},null,2);}
 finally{for(const live of owned)live.dispose();button.disabled=false;}
});
