import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import Module,{createRequire} from 'node:module';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {packCreatedWorldTemplate} from '../src/resident-candidate/world-state.mjs';
import {generateWorldGeometryWGSL,WORLD_GEOMETRY_LAYOUT as L} from '../src/resident-candidate/world-geometry.mjs';
import {packFloorNarrow} from '../src/resident-candidate/narrowphase.mjs';
import {packCanonicalBallBody} from '../src/resident-candidate/geometry-state.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from '../src/resident-candidate/contact-journal.mjs';
import {createNativeOwner,dispatchWordStages} from './resident-candidate-gpu-support.mjs';
const same=(a,b)=>a.index===b.index&&a.generation===b.generation;
/** Test-only observation of the unchanged owner immediately after original
 * narrowphase. It never runs in a resident evaluator or supplies a trajectory. */
async function sourceBoundary(seed){
 const req=createRequire(import.meta.url),file=req.resolve('../src/experimental-four-ball-world.js'),source=readFileSync(file,'utf8'),m=new Module(file),needle='shared.entryCollisionContext=copy(beforeCollision);';assert.equal(source.split(needle).length,2);
 m.filename=file;m.paths=Module._nodeModulePaths(process.cwd());let captured;const stop=new Error('test-only original geometry boundary');
 globalThis.__residentTestGeometry=x=>{captured=x;throw stop;};m._compile(source.replace(needle,needle+'globalThis.__residentTestGeometry({prepared:copy(shared.prepared),beforeCollision:copy(beforeCollision),next:copy(next),edges:copy(shared.graphNarrow.after.edges)});'),file);
 const owner=await m.exports.createReferenceStepper(seed);try{await assert.rejects(owner.step(),e=>e===stop);}finally{owner.dispose();delete globalThis.__residentTestGeometry;}assert.ok(captured);return captured;
}
let pending;const fixture=()=>pending??=(async()=>{const{seed}=await originalRegisteredFixture();const t=await packCreatedWorldTemplate(seed,{rule:{firstId:3,secondId:4,method:'none',allowKiss:true,maxOuterSteps:12000}}),source=await sourceBoundary(seed),state=t.state.slice(),o=t.segments;
 state[o.journal.offset+J.header.phase]=2;assert.deepEqual(source.edges,seed.globalEdges);source.next.balls.forEach((b,i)=>state.set(packCanonicalBallBody(b.state),o.bodies.offset+i*64));
 const entry=source.beforeCollision,awake=entry.manager.awake_island===null?[]:entry.manager.islands.v[entry.manager.awake_island].bodies;
 seed.contactGraphSeed.colliders.forEach((c,i)=>{const own=entry.bodies.find(b=>same(b.handle,c.body)),body=own??seed.bodyRegistry.find(b=>same(b.handle,c.body)),co=entry.colliders.find(b=>same(b.handle,c.handle));assert.ok(body&&co);if(!own)assert.equal(body.type,'Fixed');if(awake.some(h=>same(h,c.body)))state[15]|=1<<i;if(body.type==='Dynamic'&&!body.activation.sleeping)state[16]|=1<<i;if(co.changes>2)state[17]|=1<<i;});return{t,source,state,seed};})();
test('whole geometry driver keeps source cache order and separates numeric/projection continuations',async()=>{
 const{t}=await fixture();assert.equal(L.rows,26);assert.equal(L.gjkDispatches,256);for(const stage of L.stages){const code=generateWorldGeometryWGSL(t,stage);assert.doesNotMatch(code,/undefined|NaN|@compute|mapAsync/);assert.match(code,/fn rc_world_geometry_stage/);}assert.equal(L.capability.wholeH,false);assert.match(generateWorldGeometryWGSL(t,'control'),/0xffffffffu/);
});
test('opt-in geometry loop changes only query transport and owns its exact device source cap',async()=>{
 const{t}=await fixture(),options={queryTransport:'resident-loop'},out=t.segments.projectionOutput.offset;
 for(const stage of L.stages)assert.equal(generateWorldGeometryWGSL(t,stage),generateWorldGeometryWGSL(t,stage,{queryTransport:'staged'}));
 const init=generateWorldGeometryWGSL(t,'init',options),gjk=generateWorldGeometryWGSL(t,'gjk',options);
 assert.ok(init.includes(`rc_state[bank+${out+15}u]=256u;`));assert.match(gjk,/let steps=rc_state\[output\+15u\]/);assert.match(gjk,/steps!=256u/);
 for(const stage of L.stages.filter(s=>s!=='init'&&s!=='gjk'))assert.equal(generateWorldGeometryWGSL(t,stage,options),generateWorldGeometryWGSL(t,stage));
 assert.throws(()=>generateWorldGeometryWGSL(t,'gjk',{queryTransport:'shortened'}),/transport/);
});
test('optional whole geometry chunks retain every source owner and exact256 transport completion',async()=>{
 const{t}=await fixture(),options={queryTransport:'chunked',queryChunk:8};
 for(const stage of L.stages.filter(s=>!['init','gjk','epa','finish'].includes(s)))assert.equal(generateWorldGeometryWGSL(t,stage,options),generateWorldGeometryWGSL(t,stage));
 const gjk=generateWorldGeometryWGSL(t,'gjk',options);assert.equal([...gjk.matchAll(/rc_point_gjk_step\(\);/g)].length,8);
 assert.match(generateWorldGeometryWGSL(t,'epa',options),/output\+14u\]!=256u/);assert.match(generateWorldGeometryWGSL(t,'finish',options),/output\+14u\]!=0u/);
});
test('actual native complete 26-owner geometry sweep matches untouched source first-h boundary',async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('assigned serial native GPU slot required');
 const queryTransport=process.env.RESIDENT_QUERY_TRANSPORT??'staged',loop=queryTransport==='resident-loop',queryChunk=Number(process.env.RESIDENT_QUERY_CHUNK??8),chunked=queryTransport==='chunked',gjkRepeats=loop?1:chunked?256/queryChunk:256;
 const{t:layout,source,state}=await fixture(),o=layout.segments,initial=new Uint32Array(state.length+16).fill(0x12345678);initial.set(state);
 const prefix=`@group(0) @binding(0) var<storage,read> rc_program:array<u32>;@group(0) @binding(1) var<storage,read> rc_geometry:array<u32>;@group(0) @binding(2) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;
 // These are exact frozen source entry masks in this PHASE fixture only.
 fn rc_world_scene_geometry_visited(b:u32,c1:u32,c2:u32)->bool{return ((rc_state[b+15u]|rc_state[b+17u])&((1u<<c1)|(1u<<c2)))!=0u;}
 fn rc_world_scene_geometry_dynamic_awake(b:u32,c:u32)->bool{return (rc_state[b+16u]&(1u<<c))!=0u;}
 `;
 const stages=L.stages.map(stage=>({repeat:stage==='gjk'?gjkRepeats:1,code:prefix+generateWorldGeometryWGSL(layout,stage,{queryTransport,queryChunk})+`\n@compute @workgroup_size(1) fn main(){${stage==='select'?'if(rc_state[25u]==0u&&rc_state[31u]==0u){rc_world_geometry_begin(0u);}':''}rc_world_geometry_stage(0u,0u);${stage==='advance'?'if(rc_state[25u]==26u){rc_state[40u]=u32(rc_world_geometry_complete(0u));}':''}}`}));
 if(loop||chunked)for(const stage of stages)stage.code=linkResidentWGSL([stage.code]).code;
 const owner=await createNativeOwner('resident-complete-geometry-sweep');try{const[,,actual]=await dispatchWordStages(owner,{stages,cycles:26,bindingTypes:['read-only-storage','read-only-storage','storage','storage'],buffers:[{input:layout.program},{input:layout.sharedGeometry},{input:initial,readback:true},{words:layout.numericScratchWords}],label:'source-26-cache-geometry-sweep'});
 assert.equal(actual[24],0,'whole geometry status');assert.equal(actual[25],26);assert.equal(actual[40],1,'all actual journal edges supported');
 for(let i=0;i<4;i++){const row=i*16,cache=o.caches.offset+layout.sharedGeometry[row+7],want=packFloorNarrow(source.prepared[i].state);for(let k=0;k<137;k++){if(k===119)continue;assert.equal(actual[cache+k],want[k],`floor${i} word${k}`);}assert.equal(actual[o.geometryRefreshed.offset+i],+!!source.prepared[i].metadata?.geometryRefreshed);}
 for(let i=state.length;i<actual.length;i++)assert.equal(actual[i],0x12345678,'bank guard');
 t.diagnostic(JSON.stringify({phase:'complete-geometry-not-whole-h',cacheOwners:26,journalEdges:4,sourceBoundary:'original first h after narrowphase',intermediateReadbacks:0,dispatches:26*(L.stages.length+gjkRepeats-1),queryTransport}));
 }finally{owner.release();}
});
