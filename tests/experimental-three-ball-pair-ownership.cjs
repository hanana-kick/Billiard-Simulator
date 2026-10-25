'use strict';
// Controlled original-engine component validation. No cue whitelist expansion,
// product-entry seed substitution, recurrent native reseed or full-world claim.
const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const F=require('./three-ball-pair-ownership-fixture.cjs'),L=require('../src/experimental-world-lifecycle'),Owner=require('./three-ball-pair-owner-internals.cjs');
const {Phase,Journal,Sleep,CCD,Angular,same}=F,copy=x=>structuredClone(x),key=h=>h.index+':'+h.generation;
const specs=[{id:'controlled-02-head-on',pairIndices:[0,2],steps:96},{id:'controlled-12-oblique',pairIndices:[1,2],oblique:true,steps:128},{id:'controlled-02-to12-natural-switch',pairIndices:[0,2],switch:true,steps:220}].filter(s=>!process.env.PAIR_OWNERSHIP_FIXTURE||s.id===process.env.PAIR_OWNERSHIP_FIXTURE);
let replays,scalarPassed=false;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
before(async()=>{
 await F.R.init();
 const sources=Object.fromEntries(['./three-ball-pair-ownership-fixture.cjs','../src/physics','../src/math','../vendor/rapier.cjs','../tools/rapier-snapshot-decoder'].map(p=>{const f=require.resolve(p);return[f.split('/').slice(-2).join('/'),hash(fs.readFileSync(f))];}));
 const identity={schema:'controlled-original-all-pair-ownership-v1',specs,sources},file=process.env.PAIR_OWNERSHIP_REPLAY;
 if(file&&fs.existsSync(file)){const bytes=fs.readFileSync(file),meta=JSON.parse(fs.readFileSync(file+'.json','utf8'));assert.deepEqual(meta.identity,identity,'exact original capture source identity');assert.equal(hash(bytes),meta.sha256);replays=v8.deserialize(bytes);}
 else{replays=specs.map(F.capture);if(file){const bytes=v8.serialize(replays);fs.writeFileSync(file,bytes);fs.writeFileSync(file+'.json',JSON.stringify({identity,sha256:hash(bytes),bytes:bytes.length},null,2));}}
 for(const r of replays){const active=r.frames.flatMap((f,i)=>Object.entries(f.allPairs).filter(([,p])=>p.active).map(([key])=>({frame:i+1,key}))),retained=r.frames.map(f=>Object.values(f.allPairs).filter(p=>p.pairPresent).length);assert.ok(retained.every(n=>n<=1),r.spec.id+' must prove bounded single-retained native domain');const expected=r.spec.switch?['02','12']:[r.spec.pairIndices.join('')];for(const k of expected){assert.ok(active.some(x=>x.key===k),r.spec.id+' actual '+k+' contact birth');assert.ok(r.frames.some(f=>(f.allPairs[k].impulse??0)>0),'actual positive native impulse');const born=r.frames.findIndex(f=>f.allPairs[k].pairPresent);assert.ok(born>=0&&r.frames.slice(born+1).some(f=>!f.allPairs[k].pairPresent),'actual native '+k+' broad deletion');}if(r.spec.switch)assert.ok(active.find(x=>x.key==='02').frame<active.find(x=>x.key==='12').frame);}
});
function compare(a,b,path,max){if(typeof b==='number'){const error=Math.abs(a-b);max.value=Math.max(max.value,error);assert.ok(Number.isFinite(a)&&error<=2e-6*Math.max(1,Math.abs(b)),path+': '+a+' versus '+b+' ('+error+')');}else if(Array.isArray(b)){assert.ok(Array.isArray(a),path);assert.equal(a.length,b.length,path);b.forEach((x,i)=>compare(a[i],x,path+'['+i+']',max));}else if(b&&typeof b==='object'){for(const[k,v]of Object.entries(b))compare(a[k],v,path+'.'+k,max);}else assert.equal(a,b,path);}
const omit=new Set(['solverBodyIds','graphPos','tangentVelocity','friction','restitution','recycleRotation']);
const floorOmit=new Set([...omit,'pairPresent','pointPresent','active','recycleValid','recycleRelativeRotation','recycleRotation1','recycleRotation2','solverColor']);
const poses=(r,states)=>states.map((s,i)=>({body:r.graphSeed.bodies[i].body,translation:s.translation}));
function ccdInput(r,s,i,next){return{kind:'dynamic-body-ccd-check',bodyType:'dynamic',ccdEnabled:true,maxCcdSubsteps:4,sleeping:false,softFrame:false,softCcdPrediction:0,linear:s.linear,angular:s.angular,translation:s.translation,rotation:s.rotation,force:s.force,torque:r.ccd[i].torque,invMass:s.invMass,invInertia:s.invInertia,localCom:[0,0,0],dt:s.dt,maxExtent:r.ccd[i].maxExtent,ccdThickness:r.ccd[i].thickness,...(next?{nextTranslation:next.translation,nextRotation:next.rotation}:{})};}
async function run(device,t){for(const r of replays){
 const token={},journal=device?await Journal.createGpuStage(device,r.graphSeed):Journal.createReferenceStage(r.graphSeed),pairBindings=[],floor=[],posts=[];
 const ccd=device?await CCD.createGpuChecker(device):{pre:CCD.preReference,post:CCD.postReference,dispose(){}},sleep=device?await Sleep.createGpuUpdater(device):null;
 for(const b of r.pairSeeds){const flats=b.ballIndices.map(i=>r.flats[i]),phase=device?await Phase.createGpuStage(device,b.seed,flats):Phase.createReferenceStage(b.seed,flats);pairBindings.push({...b,phase});}
 for(let i=0;i<3;i++){floor.push(device?await L.createGpuPreparedContactStage(device,r.flats[i]):L.createReferencePreparedContactStage(r.flats[i]));posts.push(device?await Angular.createGpuPostWorldStage(device,r.application[i]):Angular.createReferencePostWorldStage(r.application[i]));}
 journal.claim(token);for(const b of pairBindings){b.phase.claim(token);b.phase.bindGraph(journal.createProjection(token),token);}floor.forEach(p=>p.claim(token));
 const seed={pairSeed:r.pairSeeds[0].seed,balls:r.graphSeed.bodies.map((b,i)=>({body:b.body,collider:b.primary,pairCollider:b.pair,state:r.flats[i]})),contactGraphSeed:{...r.graphSeed,cueColliders:[]},cushionSeeds:r.graphSeed.bodies.map(b=>({ballCollider:b.primary,cushions:[]})),bodyColliders:r.graphSeed.bodies.map(b=>({body:b.body,colliders:[b.primary,b.pair]}))},stages={journal,pairBindings,floor,cushion:[0,1,2].map(()=>({snapshot:()=>({cushions:[]})}))};
 let states=copy(r.flats),edges=copy(r.graphSeed.edges),max={value:0},forcedAbort=false,solveCounts={};
 try{for(let frame=0;frame<r.frames.length;frame++){
  const before={journal:journal.snapshot(),pairs:pairBindings.map(b=>b.phase.snapshot()),states:copy(states)},floorPrepared=[false,false,false];let committed=false;
  try{
   const entry=copy(states);for(let i=0;i<3;i++)assert.equal((await ccd.pre(ccdInput(r,entry[i],i))).admitted,true);
   const next={balls:seed.balls.map((b,i)=>({...b,state:copy(states[i])})),globalEdges:copy(edges)},shared=await Owner.prepareSharedContacts(seed,stages,next,entry,token,floorPrepared),working=shared.prepared.map(p=>p.state),selected=shared.pairBinding;
   const energy=working.map((s,i)=>({bodyType:'dynamic',operation:'update-energy',activation:s.activation,body:{translation:s.translation,rotation:s.rotation,linear:s.linear,angular:s.angular},maxExtent:r.ccd[i].maxExtent,lengthUnit:s.lengthUnit,dt:s.dt})),observed=sleep?(await sleep.updateBatch(energy)).results:energy.map(Sleep.updateReference);
   working.forEach((s,i)=>{assert.equal(observed[i].diagnostics.eligible,false,'no component sleep substitution');s.activation=observed[i].activation;s.activationPhase='source-observed-awake';s.ccdPhase='source-prediction-inactive';});
   const out=copy(working),integrations=[0,0,0];if(selected){const solved=await selected.phase.solvePrepared(selected.ballIndices.map(i=>working[i]),token);selected.ballIndices.forEach((i,local)=>{out[i]=solved.states[local];integrations[i]++;});solveCounts[selected.key]=(solveCounts[selected.key]??0)+1;}
   for(let i=0;i<3;i++)if(shared.pairLocalByBall[i]<0){out[i]=(await floor[i].solvePrepared({activation:working[i].activation,activationPhase:working[i].activationPhase,ccdPhase:working[i].ccdPhase},token)).state;integrations[i]++;}
   assert.deepEqual(integrations,[1,1,1],'one numerical integration per original body');
   for(let i=0;i<3;i++){assert.equal((await ccd.post(ccdInput(r,entry[i],i,out[i]))).admitted,true);out[i].angular=(await posts[i].step(out[i])).angular;}
   const after=await journal.postSolve(poses(r,out),token);for(let i=0;i<3;i++){out[i].topology.ballMin=copy(after.proxies[i].min);out[i].topology.ballMax=copy(after.proxies[i].max);}
   pairBindings.forEach(b=>b.phase.synchronizeGraph(journal.receiptsSince(b.phase.graphSequence(),token),token));
   journal.assertPrepared(token);pairBindings.forEach(b=>b.phase.assertPrepared(token));floor.forEach((p,i)=>{if(floorPrepared[i])p.assertPrepared(token);});
   if(!forcedAbort&&selected){forcedAbort=true;throw Object.assign(Error('forced post-sync pre-commit rollback sentinel'),{forced:true});}
   pairBindings.forEach(b=>b.phase.commit(token));floor.forEach((p,i)=>{if(floorPrepared[i])p.commit(token);});journal.commit(token);committed=true;states=out;edges=after.edges;
   const want=r.frames[frame];assert.deepEqual(after.edges,want.globalEdges,'exact native dense graph');assert.deepEqual(after.adjacency,want.adjacency,'exact native outgoing/incoming chains');assert.deepEqual(shared.graphNarrow.contactEvents,want.contactEvents,'exact native start/end source events');assert.equal(after.sequence,frame+1);
   for(let i=0;i<3;i++){for(const[k,v]of Object.entries(want.bodies[i]))compare(states[i][k],v,'frame'+frame+'.body'+i+'.'+k,max);compare(states[i].force,want.forces[i],'force',max);compare(states[i].activation,want.activations[i],'activation',max);for(const[k,v]of Object.entries(want.floors[i]))if(!floorOmit.has(k))compare(states[i][k],v,'floor'+i+'.'+k,max);assert.deepEqual(after.proxies[i],want.boxes[i]);}
   for(const b of pairBindings){const own=b.phase.snapshot();assert.deepEqual(own.edges,after.edges);const adjacent=b.ballIndices.map(i=>{const a=after.adjacency.find(a=>same(a.collider,seed.balls[i].pairCollider));return[...a.outgoing,...a.incoming];});assert.deepEqual(own.adjacency,adjacent);for(const[k,v]of Object.entries(want.allPairs[b.key]))if(!omit.has(k))compare(own.pair[k],v,'pair'+b.key+'.'+k,max);}
  }catch(e){if(!e.forced)throw e;frame--;}
  finally{if(!committed){floor.forEach(p=>p.abort(token));pairBindings.forEach(b=>b.phase.abort(token));journal.abort(token);assert.deepEqual({journal:journal.snapshot(),pairs:pairBindings.map(b=>b.phase.snapshot()),states:copy(states)},before,'all graph/cache/floor committed state unchanged after rollback');}}
 }
 assert.ok(forcedAbort);t.diagnostic(JSON.stringify({fixture:r.spec.id,backend:device?'actual-webgpu':'cpu-reference',frames:r.frames.length,solveAttempts:solveCounts,maxAbsoluteError:max.value,oneIntegrationPerBody:true,forcedPostSyncRollback:true,scope:'controlled original three-ball pair/floor/journal component, not product-entry cue or complete scene activation'}));
 }finally{floor.forEach(p=>{p.abort(token);p.release(token);p.dispose();});pairBindings.forEach(b=>{b.phase.abort(token);b.phase.release(token);b.phase.dispose();});journal.abort(token);journal.release(token);journal.dispose();posts.forEach(p=>p.dispose());ccd.dispose();sleep?.dispose();}
}}
test('controlled original 02/12 pair ownership and natural switch match native CPU',{timeout:300000},async t=>{await run(null,t);scalarPassed=true;});
test('controlled original all-pair ownership executes actual WGSL',{timeout:300000,skip:!process.env.GPU_NATIVE_MODULE&&process.env.REQUIRE_WEBGPU!=='1'},async t=>{assert.equal(scalarPassed,true,'CPU/native prerequisite');const{create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();try{await run(device,t);}finally{device.destroy();}});

test('original native graph commands prove old02 deletion/new12 birth and reject retained overlap',{timeout:90000},async()=>{
 // Explicit graph-component pose commands, NOT an integrated native trajectory
 // and NOT evidence that production accepts mutable per-frame world inputs.
 const c=F.setup({pairIndices:[0,2]}),graphSeed=F.journalSeed(c),j=Journal.createReferenceStage(graphSeed),token={},initial=copy(c.flats),base=poses({graphSeed},initial),pairIds=graphSeed.bodies.map(b=>key(b.pair));j.claim(token);
 const ownPair=e=>pairIds.includes(key(e.collider1))&&pairIds.includes(key(e.collider2));
 const cmd=(points)=>base.map((p,i)=>({body:p.body,translation:[Math.fround(points[i][0]),p.translation[1],Math.fround(points[i][1])]}));
 function nativeCommand(p){for(let i=0;i<3;i++){c.lab.objects[i].body.setTranslation({x:p[i].translation[0],y:p[i].translation[1],z:p[i].translation[2]},true);c.lab.objects[i].body.setLinvel({x:0,y:0,z:0},true);c.lab.objects[i].body.setAngvel({x:0,y:0,z:0},true);}c.lab.world.step(c.lab.queue);c.lab.queue.drainCollisionEvents(()=>{});const n=F.inspect(c.lab);return{edges:n.globalEdges,adjacency:F.journalSeed({...c,n}).adjacency};}
 async function command(p){const out=await j.prepare(p,token);j.narrowTransitions([],token);await j.postSolve(p,token);j.assertPrepared(token);j.commit(token);const n=nativeCommand(p);assert.deepEqual(j.snapshot().edges.map(({active,...e})=>e),n.edges.map(({active,...e})=>e));assert.deepEqual(j.snapshot().adjacency,n.adjacency);return out.broadPhaseEvents;}
 try{
  const near02=cmd([[-.0325,0],[-.75,.35],[.0325,0]]),born=await command(near02);assert.deepEqual(born.filter(ownPair).map(e=>e.kind),['AddPair']);assert.deepEqual(born.filter(ownPair).map(e=>[e.collider1,e.collider2]),[[graphSeed.bodies[0].pair,graphSeed.bodies[2].pair]]);
  const near12=cmd([[-.75,.35],[.0325,0],[-.0325,0]]),switched=await command(near12);assert.deepEqual(switched.filter(ownPair).map(e=>e.kind),['AddPair','DeletePair']);assert.deepEqual(switched.filter(ownPair).map(e=>[e.collider1,e.collider2]),[[graphSeed.bodies[1].pair,graphSeed.bodies[2].pair],[graphSeed.bodies[0].pair,graphSeed.bodies[2].pair]]);
  const overlap=cmd([[-.065,0],[.065,0],[0,0]]),native=nativeCommand(overlap),retained=native.edges.filter(ownPair);assert.equal(retained.length,2,'real native source keeps two ball-pair edges');assert.ok(retained.filter(e=>e.active).length<=1,'retained overlap is stricter than active-contact overlap');
  const before=j.snapshot(),broad=await j.prepare(overlap,token);assert.equal(broad.graph.edges.filter(ownPair).length,2);j.abort(token);assert.deepEqual(j.snapshot(),before,'aborted unsupported graph preserves all committed identities/lifetimes');
 }finally{j.abort(token);j.release(token);j.dispose();c.lab.dispose();}
});
