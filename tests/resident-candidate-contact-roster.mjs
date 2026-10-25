// Host-only exact integer tests. No GPU/device/browser is created here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {SOURCE_REVISION,NONE,CONTACT_ROSTER_LAYOUT as L,encodeContactRoster,decodeContactRoster,generateContactRosterWGSL} from '../src/resident-candidate/contact-roster.mjs';
import {createNativeOwner,dispatchWords} from './resident-candidate-gpu-support.mjs';

// Independent old source oracle: expose its private pure update in this VM only.
// Production source is not edited and no source-generated future state is input
// to the new device algorithm. Both receive the same geometry/activation facts.
const sourceURL=new URL('../src/experimental-solver-contact-roster.js',import.meta.url);
const source=readFileSync(sourceURL,'utf8').replace('const api=Object.freeze({SOURCE_REVISION:REV,','const api=Object.freeze({updateState,retired:s=>copy(retiredColors.get(s)??[]),SOURCE_REVISION:REV,');
const box={module:{exports:{}},require:createRequire(sourceURL),structuredClone};
vm.runInNewContext(source,box,{filename:sourceURL.pathname});
const oracle=box.module.exports;
const h=(index,generation=0)=>({index,generation});
const edge=(a,b,active=false)=>({collider1:h(100+a,11),collider2:h(100+b,12),body1:h(a,3),body2:h(b,3),active});
const clone=x=>structuredClone(x);
function seed(){return{kind:'source-single-manifold-solver-contact-roster',sourceRevision:SOURCE_REVISION,initialSnapshotSha256:null,
 bodies:[{handle:h(0,3),type:'Fixed'},... [3,7,9].map(index=>({handle:h(index,3),type:'Dynamic'}))],edges:[],pairs:[],bodySolverColorMasks:Array(10).fill('0'),buckets:Array.from({length:130},()=>[]),solverGraphValid:true,activeSetEpoch:1,solverGraphEpoch:1,multibodyTopologyEpoch:0,solverGraphMultibodyEpoch:0,awakeBodies:[3,7,9].map((index,activeSetId)=>({body:h(index,3),activeSetId})),backend:'webgpu'};}

// Restricted test interpreter for this module's integer-only WGSL. It executes
// the ACTUAL emitted function bodies, not a second handwritten roster port.
// It is not shader compilation/validation and is never exported to production.
function interpretWGSL(){
 const wgsl=generateContactRosterWGSL();
 const names=[...wgsl.matchAll(/fn (rc_\w+)\(/g)].map(m=>m[1]);
 let js=wgsl.replace(/\bfn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?/g,(_,name,args)=>'function '+name+'('+args.replace(/:(?:u32|bool)/g,'')+')')
  .replace(/:(?:u32|bool)/g,'').replace(/\bvar\b/g,'let').replace(/\b(\d+)u\b/g,'$1').replace(/\bloop\s*\{/g,'while(true){');
 js=js.replace(/(\b\w+|\(b-32\))\/(32|4194304|4)(?!\d)/g,'Math.floor($1/$2)');
 return array=>new Function('rc_state','min','max',js+';return {'+names.join(',')+'};')(array,Math.min,Math.max);
}
const instantiate=interpretWGSL();
function harness(input=seed()){
 let current=oracle.validate(input),lifetimes=[],nextLifetime=1;
 const packed=new Uint32Array(L.words+14);packed.fill(0x12345678);packed.set(encodeContactRoster(current),7);
 const initialPacked=packed.slice(),commands=[],kernel=instantiate(packed),base=7;
 const k=new Proxy(kernel,{get(target,name){const fn=target[name];return(...args)=>{commands.push({name,args:args.slice()});return fn(...args);};}});
 const snapshot=()=>decodeContactRoster(packed.subarray(base,base+L.words));
 function step(changes=[],{rows,awake=current.awakeBodies,slept=[],epoch=current.activeSetEpoch,mbEpoch=current.multibodyTopologyEpoch,invalidated=false,removed=[]}={}){
  const before=clone(current.edges),after=clone(before),journal=[];
  for(const c of changes){
   if(c.kind==='append'){const row={kind:'append',edgeId:after.length,lifetime:nextLifetime++,edge:clone(c.edge)};after.push(clone(c.edge));lifetimes.push(row.lifetime);journal.push(row);}
   else if(c.kind==='active'){journal.push({kind:'active',edgeId:c.edgeId,edge:clone(after[c.edgeId]),active:c.active});after[c.edgeId].active=c.active;}
   else if(c.kind==='remove'){const at=c.edgeId,last=after.length-1,e=clone(after[at]),lifetime=lifetimes[at];journal.push({kind:'remove',edgeId:at,lastEdgeId:last,lifetime,edge:e,...(c.withdraw?{removalReason:'collider-node',withdraw:c.withdraw}:{})});const tail=after.pop(),life=lifetimes.pop();if(at<after.length){after[at]=tail;lifetimes[at]=life;}}
  }
  const view={phase:'narrow',status:'pending',fromSequence:current.sequence,fromRevision:current.revision,toSequence:current.sequence+1,toRevision:current.revision+(journal.length||removed.length?1:0),before:{edges:before,liveColliders:removed},after:{edges:after,liveColliders:[]},changes:journal,removedColliders:removed,solverGraphInvalidated:removed.length>0};
  rows??=after.map((e,edgeId)=>({edgeId,updated:true,solverGraphDirty:true,hint:e.active?0x8001:0,manifolds:[{activeContactCount:+e.active,solverFlags:1}]}));
  const input={pairs:rows,solverGraphInvalidated:invalidated,awakeBodies:awake,sleptBodies:slept,activeSetEpoch:epoch,multibodyTopologyEpoch:mbEpoch};
  const expected=oracle.updateState(current,view,input);
  k.rc_roster_begin(base,view.toSequence,view.toRevision,invalidated||removed.length>0);
  for(const c of journal){if(c.kind==='append'){const e=c.edge;assert.equal(k.rc_roster_append(base,e.collider1.index,e.collider1.generation,e.collider2.index,e.collider2.generation,e.body1.index,e.body1.generation,e.body2.index,e.body2.generation),c.edgeId);}else if(c.kind==='active')k.rc_roster_active(base,c.edgeId,c.active);else k.rc_roster_remove(base,c.edgeId,c.lifetime>>>0,Math.floor(c.lifetime/4294967296),c.withdraw?.index??NONE,c.withdraw?.generation??0);}
  k.rc_roster_finish_transitions(base);
  for(const r of rows){const m=r.manifolds[0];k.rc_roster_metadata(base,r.edgeId,r.updated,r.solverGraphDirty??r.updated,r.hint,r.manifolds.length,m?.solverFlags??0,m?.activeContactCount??0);}
  k.rc_roster_begin_awake(base,epoch,mbEpoch);for(const b of slept)k.rc_roster_sleep(base,b.index,b.generation);for(const b of awake)k.rc_roster_awake(base,b.body.index,b.body.generation,b.activeSetId);k.rc_roster_finish(base);
  const actual=snapshot();assert.equal(actual.status,0,'Device integer draft must succeed');assert.equal(actual.rebuilt,expected.rebuilt);assert.deepEqual(clone(actual.snapshot),clone(expected.s));assert.deepEqual(actual.lifetimes,lifetimes);assert.equal(actual.nextLifetime,nextLifetime);
  assert.ok(packed.subarray(0,base).every(x=>x===0x12345678));assert.ok(packed.subarray(base+L.words).every(x=>x===0x12345678));current=expected.s;return actual;
 }
 return{step,snapshot,k,packed,base,initialPacked,commands,get current(){return current;}};
}

test('initial integer snapshot roundtrip; absolute base; immutable no-op commit',()=>{
 const input=seed(),packed=encodeContactRoster(input),decoded=decodeContactRoster(packed);
 assert.deepEqual(decoded.snapshot,{...input,sequence:0,revision:0});assert.equal(decoded.status,0);harness().step();
});
test('source sorted starts, dynamic ascending colors, compact bucket order',()=>{
 const t=harness(),out=t.step([{kind:'append',edge:edge(3,9)},{kind:'append',edge:edge(3,7)},{kind:'append',edge:edge(7,9)},... [0,1,2].map(edgeId=>({kind:'active',edgeId,active:true}))]);
 assert.deepEqual(out.snapshot.pairs.map(p=>p.solverColor),[1,0,2]);assert.deepEqual(out.snapshot.buckets.slice(0,3),[[{edge:1,manifold:0}],[{edge:0,manifold:0}],[{edge:2,manifold:0}]]);
 t.step([{kind:'active',edgeId:0,active:false}]);const reused=t.step([{kind:'active',edgeId:0,active:true},{kind:'active',edgeId:1,active:false}]);assert.equal(reused.snapshot.pairs[0].solverColor,0,'Later stop releases its bit before earlier start colors');
});
test('fixed contacts allocate descending u128 bits and dense removal repairs references',()=>{
 const t=harness();t.step([{kind:'append',edge:edge(0,3)},{kind:'append',edge:edge(0,7)},{kind:'append',edge:edge(3,7)},...[0,1,2].map(edgeId=>({kind:'active',edgeId,active:true}))]);
 assert.deepEqual(t.snapshot().snapshot.pairs.map(p=>p.solverColor),[127,127,0]);
 const out=t.step([{kind:'remove',edgeId:0}]);assert.equal(out.lifetimes[0],3);assert.equal(out.snapshot.buckets[0][0].edge,0);assert.equal(BigInt(out.snapshot.bodySolverColorMasks[3]),1n);
});
test('sleep clears count hints, wake epoch rebuild does not manufacture geometry counts',()=>{
 const t=harness();t.step([{kind:'append',edge:edge(3,7)},{kind:'active',edgeId:0,active:true}]);
 const sleeping=t.step([],{slept:[h(3,3)],awake:[{body:h(7,3),activeSetId:0},{body:h(9,3),activeSetId:1}],epoch:2});assert.equal(sleeping.snapshot.pairs[0].hint,0x8000);assert.equal(sleeping.snapshot.buckets[0].length,0);
 const rows=t.current.pairs.map((p,edgeId)=>({edgeId,updated:false,solverGraphDirty:false,hint:p.hint,manifolds:p.manifolds.map(({activeContactCount,solverFlags})=>({activeContactCount,solverFlags}))}));
 const waking=t.step([],{rows,awake:seed().awakeBodies,epoch:3});assert.equal(waking.snapshot.pairs[0].hint,0x8000);assert.equal(waking.snapshot.buckets[0].length,0);
});
test('collider withdrawal retains source retired color reservations',()=>{
 const t=harness();t.step([{kind:'append',edge:edge(0,3)},{kind:'active',edgeId:0,active:true}]);const withdrawn=h(103,12);
 const out=t.step([{kind:'remove',edgeId:0,withdraw:withdrawn}],{removed:[withdrawn]});assert.equal(out.retiredReservations.length,1);assert.equal(out.retiredReservations[0].solverColor,127);assert.equal(BigInt(out.snapshot.bodySolverColorMasks[3]),1n<<127n);
 const next=t.step([{kind:'append',edge:{...edge(0,3),collider2:h(104,99)}},{kind:'active',edgeId:0,active:true}]);assert.equal(next.snapshot.pairs[0].solverColor,126);
});
test('generation mismatch, metadata replacement, epoch mismatch and capacity fail closed',()=>{
 const t=harness();t.k.rc_roster_begin(t.base,1,1,false);assert.equal(t.k.rc_roster_append(t.base,1,0,2,0,3,99,7,3),NONE);assert.equal(t.snapshot().status,1);
 const z=harness();z.k.rc_roster_begin(z.base,1,1,false);for(let i=0;i<128;i++)assert.equal(z.k.rc_roster_append(z.base,1000+i,0,2000+i,0,3,3,7,3),i);assert.equal(z.k.rc_roster_append(z.base,9999,0,9998,0,3,3,7,3),NONE);assert.equal(z.snapshot().status,2);
 const bad=seed();bad.bodySolverColorMasks[0]=0;assert.throws(()=>encodeContactRoster(bad),/never Number/);
});

test('actual WGSL ordered roster mutation is bit-exact to independent source oracle',
 {skip:process.env.REQUIRE_WEBGPU!=='1'},async()=>{
  const cases=[];
  const colors=harness();colors.step([{kind:'append',edge:edge(3,9)},{kind:'append',edge:edge(3,7)},{kind:'append',edge:edge(7,9)},...[0,1,2].map(edgeId=>({kind:'active',edgeId,active:true}))]);
  colors.step([{kind:'active',edgeId:0,active:false}]);colors.step([{kind:'active',edgeId:0,active:true},{kind:'active',edgeId:1,active:false}]);colors.step([{kind:'remove',edgeId:0}]);cases.push(colors);
  const sleep=harness();sleep.step([{kind:'append',edge:edge(3,7)},{kind:'active',edgeId:0,active:true}]);sleep.step([],{slept:[h(3,3)],awake:[{body:h(7,3),activeSetId:0},{body:h(9,3),activeSetId:1}],epoch:2});
  const rows=sleep.current.pairs.map((p,edgeId)=>({edgeId,updated:false,solverGraphDirty:false,hint:p.hint,manifolds:p.manifolds.map(({activeContactCount,solverFlags})=>({activeContactCount,solverFlags}))}));sleep.step([],{rows,awake:seed().awakeBodies,epoch:3});cases.push(sleep);
  const retired=harness();retired.step([{kind:'append',edge:edge(0,3)},{kind:'active',edgeId:0,active:true}]);const withdrawn=h(103,12);retired.step([{kind:'remove',edgeId:0,withdraw:withdrawn}],{removed:[withdrawn]});retired.step([{kind:'append',edge:{...edge(0,3),collider2:h(104,99)}},{kind:'active',edgeId:0,active:true}]);cases.push(retired);
  const capacity=harness();capacity.k.rc_roster_begin(capacity.base,1,1,false);for(let i=0;i<129;i++)capacity.k.rc_roster_append(capacity.base,1000+i,0,2000+i,0,3,3,7,3);assert.equal(capacity.snapshot().status,2);cases.push(capacity);
  const stride=L.words+14,initial=new Uint32Array(stride*cases.length);cases.forEach((c,i)=>initial.set(c.initialPacked,i*stride));
  // Keep each production function present only once in the call graph. Hundreds
  // of literal calls force some drivers to inline huge duplicate bodies.
  const signatures=[
   ['rc_roster_begin',3,[3]],['rc_roster_append',8,[]],['rc_roster_remove',5,[]],
   ['rc_roster_active',2,[2]],['rc_roster_finish_transitions',0,[]],
   ['rc_roster_metadata',7,[2,3]],['rc_roster_begin_awake',2,[]],
   ['rc_roster_sleep',2,[]],['rc_roster_awake',3,[]],['rc_roster_finish',0,[]]
  ];
  const commandStride=10,table=[];
  const ranges=cases.map(c=>{const start=table.length/commandStride;for(const command of c.commands){
   const opcode=signatures.findIndex(([name])=>name===command.name);assert.notEqual(opcode,-1);
   assert.equal(command.args.length-1,signatures[opcode][1]);
   const row=Array(commandStride).fill(0);row[0]=opcode;command.args.slice(1).forEach((v,i)=>row[i+1]=typeof v==='boolean'?+v:v);table.push(...row);
  }return[start,c.commands.length];});
  const commands=new Uint32Array(cases.length*2+table.length);commands.set(ranges.flat());commands.set(table,cases.length*2);
  const switches=signatures.map(([name,count,bools],opcode)=>{
   const args=Array.from({length:count},(_,i)=>`rc_commands[p+${i+1}u]`+(bools.includes(i+1)?'!=0u':''));
   return `case ${opcode}u:{${name}(base${args.length?','+args.join(','):''});}`;
  }).join('\n');
  const code='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n@group(0) @binding(1) var<storage,read> rc_commands:array<u32>;\n'+generateContactRosterWGSL()+`\n@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=${cases.length}u){return;}let base:u32=gid.x*${stride}u+7u;let start=rc_commands[gid.x*2u];let count=rc_commands[gid.x*2u+1u];for(var i=0u;i<count;i++){let p=${cases.length*2}u+(start+i)*${commandStride}u;switch(rc_commands[p]){${switches}default:{rc_fail(base,1u);return;}}}}`;
  const owner=await createNativeOwner('resident-contact-roster');
  // Trace the exact last native stage even when the driver exits without a JS
  // exception; preserve WebGPU receiver identity for all proxied methods.
  const stage=name=>console.error('[roster native] '+name),originalShaders=new WeakMap();
  const traced={...owner,device:new Proxy(owner.device,{get(target,key){
   if(key==='createShaderModule')return descriptor=>{stage('shader module creation');const shader=target.createShaderModule(descriptor);const proxy=new Proxy(shader,{get(s,k){if(k==='getCompilationInfo')return async()=>{stage('WGSL compilation info');const info=await s.getCompilationInfo();stage('WGSL compilation returned');return info;};const v=s[k];return typeof v==='function'?v.bind(s):v;}});originalShaders.set(proxy,shader);return proxy;};
   if(key==='createComputePipelineAsync')return async descriptor=>{stage('compute pipeline creation');try{const pipeline=await target.createComputePipelineAsync({...descriptor,compute:{...descriptor.compute,module:originalShaders.get(descriptor.compute.module)??descriptor.compute.module}});stage('compute pipeline returned');return pipeline;}catch(error){throw new Error('Roster native compute pipeline creation failed',{cause:error});}};
   if(key==='queue')return new Proxy(target.queue,{get(q,k){const v=q[k];if(k==='submit')return commands=>{stage('queue submit / dispatch / readback');return q.submit(commands);};return typeof v==='function'?v.bind(q):v;}});
   const value=target[key];return typeof value==='function'?value.bind(target):value;
  }})};
  try{const [output]=await dispatchWords(traced,{code,buffers:[{input:initial,readback:true},{input:commands}],workgroups:cases.length,label:'resident-source-roster-differential'});
   stage('readback and validation returned');
   cases.forEach((c,i)=>assert.deepEqual(output.slice(i*stride,(i+1)*stride),c.packed,'Native exact packed case '+i));
   console.log('Roster native adapter:',JSON.stringify(owner.adapterInfo));
  }finally{await owner.release();}
 });
