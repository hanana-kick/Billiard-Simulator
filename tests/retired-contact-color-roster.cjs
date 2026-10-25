'use strict';
// Source-only integer bookkeeping component proof. The native h463 checkpoint is
// a prepared kernel input, NOT an admitted initial-world seed. This test does not
// bypass the production journal's separate active-cue-contact admission guard.
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const R=require('../src/experimental-solver-contact-roster'),D=require('./retired-contact-color-native-fixture.json'),copy=structuredClone,U=0xffffffff,BIT=1n<<127n;
// Expose closure-local bookkeeping only in a fresh test module. Production API,
// journal branding and source files remain unchanged; no runtime test hook exists.
const file=require.resolve('../src/experimental-solver-contact-roster'),source=fs.readFileSync(file,'utf8'),marker='const api=Object.freeze({SOURCE_REVISION:REV,';
assert.equal(source.split(marker).length,2);const instance=new Module(file,module);instance.filename=file;instance.paths=Module._nodeModulePaths(path.dirname(file));instance._compile(source.replace(marker,'const api=Object.freeze({updateState,cloneState,assertMasks,'+'SOURCE_REVISION:REV,'),file);const K=instance.exports;
const same=(a,b)=>a.index===b.index&&a.generation===b.generation;
function seed(){const b=D.before;return{kind:'source-single-manifold-solver-contact-roster',sourceRevision:D.sourceRevision,initialSnapshotSha256:D.initialSnapshotSha256,...Object.fromEntries(['bodies','edges','pairs','bodySolverColorMasks','buckets','solverGraphValid','solverGraphEpoch','solverGraphMultibodyEpoch','activeSetEpoch','multibodyTopologyEpoch','awakeBodies'].map(k=>[k,copy(b[k])]))};}
function removalView(s,{ordinary=false,removed=D.preWorld.removedColliders}={}){
 const edges=copy(s.edges),adjacency=copy(D.before.adjacency),lifetimes=edges.map((_,i)=>i+1),changes=[];
 for(const collider of removed){const node=adjacency.find(a=>same(a.collider,collider));for(const side of['outgoing','incoming'])while(node[side].length){const at=node[side][0],last=edges.length-1,edge=copy(edges[at]),lifetime=lifetimes[at],relocated=at===last?null:{edge:copy(edges[last]),lifetime:lifetimes[last]};for(const a of adjacency)for(const direction of['outgoing','incoming'])a[direction]=a[direction].filter(i=>i!==at).map(i=>i===last?at:i);const tail=edges.pop(),tailLife=lifetimes.pop();if(at<last){edges[at]=tail;lifetimes[at]=tailLife;}changes.push({kind:'remove',edgeId:at,lastEdgeId:last,lifetime,edge,relocated,...(ordinary?{}:{removalReason:'collider-node'})});}}
 return{phase:'narrow',status:'pending',initialSnapshotSha256:D.initialSnapshotSha256,fromSequence:s.sequence,toSequence:s.sequence+1,fromRevision:s.revision,toRevision:s.revision+1,before:{edges:copy(s.edges),liveColliders:copy(D.before.liveColliders)},after:{edges,liveColliders:copy(ordinary?D.before.liveColliders:D.before.liveColliders.filter(h=>!removed.some(x=>same(x,h))))},changes,removedColliders:copy(ordinary?[]:removed),solverGraphInvalidated:!ordinary};
}
function input(s,view){return{solverGraphInvalidated:false,pairs:view.after.edges.map((e,edgeId)=>{const at=s.edges.findIndex(x=>same(x.collider1,e.collider1)&&same(x.collider2,e.collider2)),p=s.pairs[at];return{edgeId,updated:false,hint:p.hint,manifolds:p.manifolds.map(({activeContactCount,solverFlags})=>({activeContactCount,solverFlags}))};}),awakeBodies:copy(D.after.awakeBodies),activeSetEpoch:D.after.activeSetEpoch};}
function run(){const s=K.validate(seed()),view=removalView(s);return{before:s,view,...K.updateState(s,view,input(s,view))};}
const projected=s=>Object.fromEntries(['edges','pairs','bodySolverColorMasks','buckets','solverGraphValid','solverGraphEpoch','solverGraphMultibodyEpoch','activeSetEpoch','multibodyTopologyEpoch','awakeBodies'].map(k=>[k,s[k]]));

test('actual original native withdrawal preserves head raw-slot mask while rebuilding graph8 to graph4',()=>{
 assert.equal(D.before.candidateInput,false);assert.equal(D.preWorld.candidateInput,false);assert.equal(D.after.candidateInput,false);
 assert.deepEqual(D.preWorld.removedColliders.map(h=>h.index),[25,26,24]);assert.deepEqual(D.before.bodySolverColorMasks,D.preWorld.bodySolverColorMasks);assert.deepEqual(D.before.bodySolverColorMasks,D.after.bodySolverColorMasks);
 assert.equal(D.before.edges.length,8);assert.equal(D.after.edges.length,4);assert.deepEqual(D.before.buckets[127],[{edge:7,manifold:0}]);assert.equal(D.after.buckets.flat().length,0);assert.equal(D.after.solverGraphValid,true);assert.equal(D.after.bodySolverColorMasks.length,22);assert.equal(D.after.bodies.some(b=>b.handle.index===21),false);
 const out=run();assert.equal(out.rebuilt,true);assert.deepEqual(projected(out.s),projected(D.after));assert.equal(out.s.bodySolverColorMasks[21],BIT.toString());assert.deepEqual(out.before, K.validate(seed()),'Preparing withdrawal never mutates source state');
 assert.throws(()=>R.seedFromSourceSnapshot(D.before),/created boundary/,'A native future component checkpoint is not production initial admission');
});

test('ordinary pair deletion releases the identical active reservation rather than retiring it',()=>{
 const s=K.validate(seed()),view=removalView(s,{ordinary:true}),out=K.updateState(s,view,input(s,view));assert.equal(out.s.bodySolverColorMasks[21],'0');assert.equal(out.s.buckets.flat().length,0);K.assertMasks(out.s);
});


test('generic fixed collider withdrawal reserves surviving owners and prevents premature color reuse',()=>{
 // Protocol variant, not a claim that the original shot removes its cloth.
 const s=K.validate(seed()),view=removalView(s,{removed:[copy(s.edges[0].collider1)]}),retired=K.updateState(s,view,input(s,view)).s;
 assert.deepEqual(retired.bodySolverColorMasks,s.bodySolverColorMasks);assert.equal(retired.edges.length,3);
 const edge={collider1:{index:1,generation:0},collider2:{index:18,generation:0},body1:{index:1,generation:0},body2:{index:17,generation:0},active:false},at=retired.edges.length;
 const next={phase:'narrow',status:'pending',initialSnapshotSha256:D.initialSnapshotSha256,fromSequence:retired.sequence,toSequence:retired.sequence+1,fromRevision:retired.revision,toRevision:retired.revision+1,before:{edges:copy(retired.edges)},after:{edges:[...copy(retired.edges),{...copy(edge),active:true}]},changes:[{kind:'append',edgeId:at,edge:copy(edge)},{kind:'active',edgeId:at,edge:copy(edge),active:true}],removedColliders:[],solverGraphInvalidated:false};
 const pairs=retired.pairs.map((p,edgeId)=>({edgeId,updated:false,hint:p.hint,manifolds:p.manifolds.map(({activeContactCount,solverFlags})=>({activeContactCount,solverFlags}))}));pairs.push({edgeId:at,updated:true,hint:32769,manifolds:[{activeContactCount:1,solverFlags:1}]});
 const out=K.updateState(retired,next,{solverGraphInvalidated:false,pairs,activeSetEpoch:retired.activeSetEpoch+1,awakeBodies:[{body:edge.body2,activeSetId:0},{body:{index:16,generation:0},activeSetId:1}]}).s;
 assert.equal(out.pairs[at].solverColor,126);assert.equal(out.bodySolverColorMasks[17],(BIT|(1n<<126n)).toString());K.assertMasks(out);
});

test('collider retirement needs marker, exact withdrawn generation, and source invalidation',()=>{
 for(const mutate of[
  v=>delete v.changes[0].removalReason,
  v=>v.removedColliders.forEach(h=>h.generation++),
  v=>v.removedColliders=[{index:23,generation:0}],
  v=>v.solverGraphInvalidated=false,
  v=>v.after.liveColliders.push(copy(v.removedColliders[0])),
  v=>v.before.liveColliders=v.before.liveColliders.filter(h=>h.index!==25),
  v=>v.initialSnapshotSha256='a'.repeat(64),
  v=>v.changes[0].removalReason='unverified-removal'
 ]){const s=K.validate(seed()),view=removalView(s);mutate(view);assert.throws(()=>K.updateState(s,view,input(s,view)),/source|withdrawal|removal/);assert.deepEqual(s,K.validate(seed()),'Failed retirement leaves exact state and masks unchanged');}
});

test('private residue cannot be forged by seed fields, copied snapshots, or unrelated extra mask bits',()=>{
 const out=run(),snapshot=copy(out.s);for(const forged of[snapshot,{...snapshot,retiredColors:[{body:21,color:127}]},{...snapshot,retiredBodySolverColorMasks:D.after.bodySolverColorMasks}])assert.throws(()=>R.validate(forged),/masks differ/);
 assert.throws(()=>K.assertMasks(copy(out.s)),/masks differ/,'Copies do not carry private source provenance');
 for(const index of[0,16,17,20,21]){const bad=K.cloneState(out.s);bad.bodySolverColorMasks[index]=(BigInt(bad.bodySolverColorMasks[index])|1n).toString();assert.throws(()=>K.assertMasks(bad),/masks differ/);}
 const generation=K.cloneState(out.s);generation.bodies.find(b=>b.handle.index===21).handle.generation++;assert.throws(()=>K.assertMasks(generation),/generation mismatch/);
 const origin=K.cloneState(out.s);origin.initialSnapshotSha256='b'.repeat(64);assert.throws(()=>K.assertMasks(origin),/provenance/);
 const rewind=K.cloneState(out.s);rewind.sequence=0;assert.throws(()=>K.assertMasks(rewind),/provenance/);
});

test('private provenance survives internal clones, later steps and exact outer rollback',()=>{
 const out=run(),before=K.cloneState(out.s),view={...copy(out.view),fromSequence:out.s.sequence,toSequence:out.s.sequence+1,fromRevision:out.s.revision,toRevision:out.s.revision,before:copy(out.view.after),changes:[],removedColliders:[],solverGraphInvalidated:false};
 const next=K.updateState(out.s,view,input(out.s,view)).s;K.assertMasks(next);assert.equal(next.sequence,2);assert.equal(next.bodySolverColorMasks[21],BIT.toString());
 // This is the same private clone operation used by beginOuter/abort. Snapshot
 // clones intentionally cannot act as a substitute for this rollback state.
 K.assertMasks(before);assert.deepEqual(before,out.s);assert.equal(before.sequence,1);assert.throws(()=>K.assertMasks(copy(before)),/masks differ/);
});

test('a bound public owner rejects counterfeit removal receipts and ignores caller-added retirement fields',async()=>{
 const J=require('../src/experimental-contact-graph-journal'),F=require('./contact-graph-bounded-fixture.cjs'),graph=F.seed(4),owner={},base=seed();
 base.initialSnapshotSha256=null;base.bodies=[...new Map(graph.colliders.map(c=>[c.body.index,{handle:copy(c.body),type:c.type}])).values()];base.edges=[];base.pairs=[];base.bodySolverColorMasks=Array(84).fill('0');base.buckets=Array.from({length:130},()=>[]);base.awakeBodies=[];
 const journal=J.createReferenceStage(graph),roster=R.createRoster(base);journal.claim(owner);roster.claim(owner);roster.bindGraph(journal.createProjection(owner),owner);const before=roster.snapshot();
 try{const p=await journal.prepare(F.poses(graph),owner);journal.narrowTransitions([],owner);const forged=Object.assign(copy(p.receipt),{removedColliders:copy(D.preWorld.removedColliders),removalReason:'collider-node'}),args={transaction:forged,pairs:[],solverGraphInvalidated:false,awakeBodies:[],activeSetEpoch:base.activeSetEpoch};
  assert.throws(()=>roster.prepare(args,owner),/pending graph transaction/);assert.deepEqual(roster.snapshot(),before);
  const out=roster.prepare({...args,transaction:p.receipt,removedColliders:copy(D.preWorld.removedColliders),retiredBodySolverColorMasks:D.after.bodySolverColorMasks},owner);assert.ok(out.bodySolverColorMasks.every(x=>x==='0'),'Only journal-derived private retirement can reserve masks');assert.deepEqual(roster.snapshot(),before);
 }finally{roster.abort(owner);journal.abort(owner);roster.release(owner);journal.release(owner);roster.dispose();journal.dispose();}
});

test('frozen component projections match the full independently captured native artifact',{skip:!process.env.RETIRED_CONTACT_COLOR_ORACLE},()=>assert.deepEqual(require('./retired-contact-color-extract.cjs').extract(process.env.RETIRED_CONTACT_COLOR_ORACLE),D));
