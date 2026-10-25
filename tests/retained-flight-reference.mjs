import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import v8 from 'node:v8';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

const Checkpoint=require('./retained-flight-native-checkpoints.cjs');
let seed,record,decoder;const expectedRows=new Map();
before(async()=>{
 const file=process.env.INVERSE_WORLD_EVIDENCE??'/tmp/retained-flight-rest.v8';
 if(!process.env.INVERSE_WORLD_EVIDENCE)execFileSync(process.execPath,[path.join(root,'tests/retained-flight-native.cjs'),file],{timeout:30000,env:{...process.env,INVERSE_OBSERVATION_SPEED:'4.5'}});
 record=v8.deserialize(fs.readFileSync(file));assert.equal(record.schema,'original-native-retained-flight-v1');assert.equal(record.fullRest,true);assert.equal(record.bodyAngularBoundary,'after-original-angularPatchResistance');
 if(record.sourceHashes)for(const [p,hash]of Object.entries(record.sourceHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),hash,'original source provenance '+p);
 const D=await import('../tools/rapier-snapshot-decoder/browser.mjs'),p=JSON.parse(fs.readFileSync(path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(p.wasmPath)),provenance:p,expectedWasmSha256:p.wasmSha256});
 const I=await import('../src/browser-initial-import/live-registered-four-ball.mjs');seed=await I.importLiveRegisteredFourBall(decoder,record.raw);
 const {plain}=await import('../src/browser-initial-import/exact-data.mjs');
 for(const snapshot of record.snapshots){assert.equal(snapshot.candidateInput,false);const decoded=await decoder.decodeSnapshot(snapshot.snapshot),state=plain(decoded.state),F=D.field;
  const occupied=name=>F(F(F(decoded.state,name),name),'items').items.flatMap((entry,index)=>entry.variant==='Occupied'?[{handle:{index,generation:Number(F(entry,'generation').value)},...plain(F(entry,'value'))}]:[]),bodies=occupied('bodies'),colliders=occupied('colliders'),proxies=[];
  for(const node of state.broad_phase.tree.nodes)for(const side of ['left','right']){const child=node[side];if((child.data&0x3fffffff)===1)proxies.push({index:child.children,min:child.mins,max:child.maxs});}
  expectedRows.set(snapshot.h,{candidateInput:false,hCount:snapshot.h,snapshotSha256:decoded.inputSha256,boundary:snapshot.boundary,sourceRevision:decoded.sourceRevision,engineSha256:decoded.engineSha256,state,bodies,colliders,proxies,contactPairs:D.findStructs(F(decoded.state,'narrow_phase'),'ContactPair').map(plain),queues:{modifiedBodies:state.bodies.modified_bodies[0],modifiedColliders:state.colliders.modified_colliders[0]},application:snapshot.application});
 }
 assert.equal(typeof globalThis.RAPIER,'undefined');assert.equal(typeof globalThis.PhysicsLab,'undefined','candidate process cannot run native continuation');
});
let maxima={};
function close(a,b,label){if(typeof b==='number'){const field=label.startsWith('residuals')?'residual':label.includes('.projection.')?'projection':label.includes('.position.')?'position':'other';maxima[field]=Math.max(maxima[field]??0,Math.abs(a-b));assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-6,`${label}: ${a} != ${b}`);}else if(b===null||typeof b!=='object')assert.equal(a,b,label);else{assert.deepEqual(Object.keys(a),Object.keys(b),label);for(const k of Object.keys(b))close(a[k],b[k],label+'.'+k);}}

function instrument(){const file=require.resolve('../src/experimental-four-ball-world'),source=fs.readFileSync(file,'utf8'),base=Module.createRequire(file),m=new Module(file);m.filename=file;m.paths=modulePaths();let armed=null;
 function modulePaths(){return Module._nodeModulePaths(root);}
 function wrap(stage){const out={...stage};for(const method of ['assertPrepared','assertOuterPrepared'])if(typeof stage[method]==='function')out[method]=function(...args){const result=Reflect.apply(stage[method],stage,args);if(armed){const error=armed;armed=null;throw error;}return result;};return Object.freeze(out);}
 m.require=id=>{const actual=base(id);if(id!=='./experimental-scene-activation')return actual;const result={...actual};for(const name of ['createReferenceStage','createGpuStage'])if(typeof actual[name]==='function')result[name]=(...args)=>{const value=actual[name](...args);return value?.then?value.then(wrap):wrap(value);};return result;};m._compile(source,file);return{World:m.exports,arm(){assert.equal(armed,null);return armed=Error('injected retained-flight preflight');}};
}
async function run(device,t){
 const probe=instrument(),create=()=>device?probe.World.createGpuStepper(device,seed):probe.World.createReferenceStepper(seed),world=await create(),sibling=await create();let siblingBefore,rollbacks=0;const checkpointStats={internalPasses:0,checkpoints:[],maxAbsolute:0};const limit=Math.min(Number(process.env.RETAINED_FLIGHT_MAX_H??record.frames.length-1),record.frames.length-1);
 try{await sibling.step();siblingBefore=sibling.snapshot();
 for(let h=1;h<=limit;h++){
  if([311,312,374,4815].includes(h)){const before=world.snapshot(),error=probe.arm();await assert.rejects(world.step(),e=>e===error);assert.deepEqual(world.snapshot(),before,'all failed transaction state rolls back h'+h);assert.deepEqual(sibling.snapshot(),siblingBefore,'sibling state not mutated');rollbacks++;}
  let out;try{out=await world.step();}catch(e){e.message='h'+h+': '+e.message;throw e;}
  assert.equal(out.time,record.frames[h].postApplicationTime,'native application clock');assert.equal(out.lastStep.h,record.frames[h].applicationH,'native application phase dt');checkpointStats.internalPasses+=out.lastStep.ccd?.sourceInternalPasses.length??1;assert.equal(out.contactGraph.sequence,checkpointStats.internalPasses);
  for(let i=0;i<4;i++){const expected=i===0?record.frames[h].cue:record.frames[h].objects[i-1];close(out.balls[i].state.translation,[expected.position.x,expected.position.y,expected.position.z],'position h'+h+' ball'+i);if(record.frames[h].bodies){const body=record.frames[h].bodies[i];for(const field of ['linear','angular'])close(out.balls[i].state[field],['x','y','z'].map(k=>body[field][k]),field+' h'+h+' ball'+i);for(const field of ['rotation','invInertia'])close(out.balls[i].state[field],body[field],field+' h'+h+' ball'+i);assert.equal(out.balls[i].state.sleeping,body.sleeping,'native activation h'+h);}}
  if(expectedRows.has(h)){const row=expectedRows.get(h),frame={...row.application,hCount:h,balls:record.frames[h].bodies.map(b=>({...b,translation:['x','y','z'].map(k=>b.position[k]),linear:['x','y','z'].map(k=>b.linear[k]),angular:['x','y','z'].map(k=>b.angular[k])}))};Checkpoint.checkpoint(out,row,frame,seed,checkpointStats.internalPasses,checkpointStats);}
  if(h===311){assert.equal(out.balls[0].state.topology.pairPresent,true);assert.equal(out.balls[0].state.topology.active,false);assert.equal(out.balls[0].state.topology.pointPresent,false);const pair=out.pairs.find(p=>p.key==='02').pair;assert.equal(!!pair.pairPresent,true);assert.equal(!!pair.pointPresent,false);assert.equal(!!pair.active,false);assert.equal(pair.impulse,0);}
  if(h===312)assert.equal(!!out.pairs.find(p=>p.key==='02').pair.pairPresent,false,'native fat-edge deletion follows empty retained h311');
  if(h%256===0)console.error(JSON.stringify({backend:device?'webgpu':'cpu-reference',h,maxima,rollbacks,memory:process.memoryUsage()}));
 }
 if(limit===record.frames.length-1){assert.equal(world.snapshot().shotComplete,true);assert.ok(world.snapshot().balls.every(b=>b.state.sleeping));}
 assert.deepEqual(sibling.snapshot(),siblingBefore);const result={schema:'retained-flight-original-parity-v1',backend:device?'webgpu':'cpu-reference',h:limit,fullRest:limit===record.frames.length-1,maxima,rollbacks,siblingIsolation:true,checkpointStats,checkpointSourceHashes:Checkpoint.sourceHashes,tolerance:1e-6,settings:record.settings,sourceHashes:record.sourceHashes,runtimeSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'src/experimental-four-ball-world.js'))).digest('hex')};if(process.env.RETAINED_FLIGHT_RESULT){fs.writeFileSync(process.env.RETAINED_FLIGHT_RESULT,JSON.stringify(result,null,2)+'\n');fs.writeFileSync(process.env.RETAINED_FLIGHT_RESULT+'.final.v8',v8.serialize(world.snapshot()));}t.diagnostic(JSON.stringify(result));
 }finally{world.dispose();sibling.dispose();}
}
test('retained flight reference matches original through rest and rolls back',{skip:process.env.RETAINED_FLIGHT_GPU_ONLY==='1',timeout:1200000},async t=>run(null,t));
test('retained flight real GPU matches original through rest and rolls back',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:1800000},async t=>{const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice(),release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'retained-flight-original');try{await run(device,t);}finally{release();}});
