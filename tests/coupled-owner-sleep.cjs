'use strict';
// Isolated common-owner protocol tests. Mock arithmetic deliberately cannot
// establish native numerical parity; source roster parity is tested separately.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Hint=require('../src/experimental-coupled-contact-hints');
const copy=x=>structuredClone(x),h=index=>({index,generation:0}),eq=(a,b)=>a.index===b.index&&a.generation===b.generation,U=0xffffffff;
function fixture({backend='cpu-reference',sleeping=[true,true,true,true],entrySleeping=sleeping,newlySlept=[],omitRows=false,pass=undefined,forceSleepingSelection=false,omittedEdges=[],zeroHintEdges=[],graphPositions={}}={}){
 const gpuDevice={},calls={math:[],accept:[],seal:[],prepared:[]},token={},transaction={},seed={initialSnapshotSha256:'a'.repeat(64),balls:Array.from({length:4},(_,i)=>({body:h(16+i),collider:h(16+2*i),pairCollider:h(17+2*i)})),pairSeed:{floorCollider:h(0)},contactGraphSeed:{cueColliders:[]},cushionSeeds:Array.from({length:4},(_,i)=>({cushions:[{colliderHandle:h(40+i)}]})),solverContactRoster:{}};
 const edges=seed.balls.map(b=>({collider1:h(0),collider2:b.collider,body1:h(0),body2:b.body,active:true}));
 for(const [a,b]of[[0,1],[2,3]])edges.push({collider1:seed.balls[a].pairCollider,collider2:seed.balls[b].pairCollider,body1:seed.balls[a].body,body2:seed.balls[b].body,active:true});
 edges.push({collider1:h(40),collider2:seed.balls[0].collider,body1:h(40),body2:seed.balls[0].body,active:true});
 const pairs=edges.map((e,i)=>({hint:zeroHintEdges.includes(i)?32768:32769,solverColor:i<4?127:i<6?0:126,manifolds:[{solverFlags:1,activeContactCount:1,graphPos:graphPositions[i]??U}]}));
 const view={phase:'broad',after:{edges},initialSnapshotSha256:seed.initialSnapshotSha256};
 const prior={edges:copy(edges),pairs:copy(pairs)};
 const scene=sleeps=>{const awake=seed.balls.filter((_,i)=>!sleeps[i]).map(b=>b.body);return{manager:{awake_island:awake.length?0:null,islands:{v:[{bodies:copy(awake)}]}},bodies:seed.balls.map((b,i)=>({handle:copy(b.body),type:'Dynamic',activation:{sleeping:sleeps[i],timer:i},ids:{active_set_id:awake.findIndex(x=>eq(x,b.body)),island_id:i<2?0:1}})),colliders:[h(0),...seed.balls.flatMap(b=>[b.collider,b.pairCollider]),...seed.cushionSeeds.flatMap(x=>x.cushions.map(c=>c.colliderHandle))].map(handle=>({handle:copy(handle),changes:0}))};};
 const entry=scene(entrySleeping),context=scene(sleeping),states=seed.balls.map((b,i)=>({sleeping:entrySleeping[i],activation:copy(entry.bodies[i].activation),activationPhase:'old',ccdPhase:'old',dt:1,substeps:1,pgsIterations:1,stabilizationIterations:1,translation:[i,2,3],rotation:[0,0,0,1],linear:entrySleeping[i]?[0,-0,0]:[i+1,2,3],angular:entrySleeping[i]?[0,0,-0]:[4,5,6],invInertia:[1,0,0,0,2,0,0,0,3],force:[1,2,3],ccdBody:{force:[1,2,3],torque:[4,5,6]},topology:{active:1},warmImpulse:i+1,warmWorld:[4,5,6]}));
 let Owner;
 function phase(id,data){return{data,bindCoupledOwner(owner,t){assert.equal(t,token);assert.equal(owner,Owner);},coupledGeometry(t){assert.equal(t,token);return copy(this.data);},sealCoupledGeometry(t,p){assert.equal(t,token);assert.equal(p,pass);calls.seal.push(id);},acceptCoupledSleep(receipt,t,p){return accept(this,id,'sleep',receipt,t,p);},acceptCoupledSolve(receipt,t,p){return accept(this,id,'solve',receipt,t,p);}};}
 function accept(p,id,kind,receipt,t,pas){assert.equal(t,token);assert.equal(pas,pass);const out=api.readResult(receipt,Owner,p,backend,transaction,pas);calls.accept.push({id,kind,out:copy(out),receipt,phase:p});return copy(out);}
 const pairBindings=[];for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){const active=a===0&&b===1||a===2&&b===3;pairBindings.push({ballIndices:[a,b],phase:phase('pair'+a+b,active?{prepared:true,refreshed:false,state:{active:1,pairPresent:1,solverColor:0,warmImpulse:11,impulse:12,warmWorld:[13,14,15],contactId:2147483648}}:{prepared:false,pair:{active:0,pairPresent:0}})});}
 const cushion=seed.balls.map((_,i)=>phase('rail'+i,{prepared:true,refreshed:[false],state:{cushions:[{active:i===0?1:0,pairPresent:i===0?1:0,solverColor:i===0?126:255,warmImpulse:21,impulse:22,contactId:2147483648}]}}));
 const roster={claim(){},bindGraph(){},workingSnapshot(){return copy(prior);},prepare(input,t,p){assert.equal(t,token);assert.equal(p,pass);calls.prepared.push(copy(input));const awake=input.awakeBodies.map(x=>x.body);return{pairs:copy(pairs),contactOrder:edges.flatMap((e,i)=>!omittedEdges.includes(i)&&(forceSleepingSelection||awake.some(h=>eq(h,e.body1)||eq(h,e.body2)))?[{edge:i,manifold:0,color:pairs[i].solverColor}]:[])};}};
 const sandbox={structuredClone,LabContactGraphJournalExperimental:{viewReceipt(t,actualBackend){assert.equal(t,transaction);assert.equal(actualBackend,backend);return copy(view);}},LabSolverContactRosterExperimental:{createRoster(){return roster;}},LabCoupledContactHintsExperimental:Hint,LabCcdPassAuthorityExperimental:{assertPass(p,actualBackend){assert.equal(p,pass);assert.equal(actualBackend,backend);return{collisionDt:1,solveDt:.5};}},LabCoupledContactMathExperimental:{async createGpuMathStage(device,config){assert.equal(device,gpuDevice);return sandbox.LabCoupledContactMathExperimental.createReferenceMathStage(config);},createReferenceMathStage(config){const call={config:copy(config)};calls.math.push(call);return{async step(input){call.input=copy(input);return{bodies:input.bodies.map(b=>({translation:[b.translation[0]+10,...b.translation.slice(1)],linear:[101,102,103],angular:[104,105,106],force:[107,108,109]})),contacts:input.contacts.map((_,i)=>({warmImpulse:1000+i,impulse:2000+i}))};},dispose(){}};}}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/experimental-coupled-contact-owner.js'),'utf8'),sandbox);const api=sandbox.LabCoupledContactOwnerExperimental;
 Owner=api.createAuthority(seed,pairBindings,cushion,backend,backend==='webgpu'?gpuDevice:null);Owner.bind(token,{createProjection(){return{};}});Owner.begin(transaction);view.phase='narrow';
 const shared={transaction,pairBinding:{ballIndices:[0,1,2,3]},pairResult:{states:copy(states)},prepared:states.map(state=>({state:copy(state),metadata:{geometryRefreshed:false}})),entryCollisionContext:entry,graphNarrow:{solverGraphInvalidated:false},coupledComponents:true,pairPrepared:true};
 const observed={context,bodies:omitRows?[]:context.bodies.flatMap((b,i)=>!entrySleeping[i]||!sleeping[i]||newlySlept.includes(i)?[{handle:copy(b.handle),activation:copy(b.activation),activationPhase:b.activation.sleeping?'source-observed-sleeping':'source-observed-awake',force:[31+i,32,33],torque:[34,35,36]}]:[]),effects:{activeSetEpoch:1,sleptBodies:newlySlept.map(i=>seed.balls[i].body)}};
 const flats=states.map((s,i)=>({...copy(s),sleeping:sleeping[i],activation:copy(context.bodies[i].activation),activationPhase:sleeping[i]?'source-observed-sleeping':'source-observed-awake',ccdPhase:pass?'source-selected-pass':'source-prediction-inactive'}));
 const observe=()=>Owner.observe(shared,copy(states),{},observed,token,pass),solve=(input=flats)=>Owner.solvePrepared(shared,input,token,pass);
 return{api,owner:Owner,seed,shared,observed,states,flats,observe,solve,calls,pairBindings,cushion,token,transaction,pass};
}

test('already sleeping components require no math and keep exact cache, pose, inertia, forces and zero bits',async()=>{
 const x=fixture({omitRows:true});x.observe();const out=copy(await x.solve());assert.equal(x.calls.math.length,0);assert.equal(x.calls.accept.length,6);assert.ok(x.calls.accept.every(a=>a.kind==='sleep'));
 for(let i=0;i<4;i++){for(const k of['translation','rotation','linear','angular','invInertia','force','ccdBody','warmImpulse','warmWorld'])assert.deepEqual(out.states[i][k],x.states[i][k]);assert.equal(out.states[i].activationPhase,'source-observed-sleeping');}
 for(const a of x.calls.accept){assert.equal(a.out.metadata.kind,'source-observed-component-sleep');if(a.id.startsWith('pair'))assert.deepEqual(a.out.pair,a.phase.data.state);else assert.deepEqual(a.out.cushions,a.phase.data.state.cushions);}
 assert.deepEqual(x.calls.prepared[0].sleptBodies,[]);
});
test('new whole-component sleep zeros only source-observed body velocities and adopts actual forces',async()=>{
 const x=fixture({entrySleeping:[false,false,false,false],newlySlept:[0,1,2,3]});x.observe();const out=copy(await x.solve());assert.equal(x.calls.math.length,0);
 for(let i=0;i<4;i++){assert.deepEqual(out.states[i].linear,[0,0,0]);assert.deepEqual(out.states[i].angular,[0,0,0]);assert.deepEqual(out.states[i].translation,x.states[i].translation);assert.deepEqual(out.states[i].invInertia,x.states[i].invInertia);assert.deepEqual(out.states[i].force,[31+i,32,33]);assert.deepEqual(out.states[i].ccdBody,{force:[31+i,32,33],torque:[34,35,36]});}
 assert.deepEqual(x.calls.prepared[0].sleptBodies,x.seed.balls.map(b=>b.body));
});
test('mixed disjoint components compact only awake bodies while retaining full result and native contact order',async()=>{
 const x=fixture({sleeping:[true,true,false,false]});x.observe();const out=copy(await x.solve());assert.equal(out.states.length,4);assert.equal(x.calls.math.length,1);const call=x.calls.math[0];assert.equal(call.config.bodyCount,2);assert.deepEqual(call.input.bodies.map(b=>b.translation[0]),[2,3]);assert.deepEqual(call.config.contacts,[{kind:'cloth',body1:null,body2:0},{kind:'cloth',body1:null,body2:1},{kind:'dynamic-sphere',body1:0,body2:1}]);
 assert.deepEqual(out.sourceContactOrder.map(x=>x.edge),[2,3,5]);assert.deepEqual(out.states[0].linear,x.states[0].linear);assert.deepEqual(out.states[1].linear,x.states[1].linear);assert.deepEqual(out.states[2].linear,[101,102,103]);assert.equal(out.states[2].warmImpulse,1000);assert.equal(out.states[3].warmImpulse,1001);assert.equal(x.calls.accept.find(a=>a.id==='pair01').kind,'sleep');assert.equal(x.calls.accept.find(a=>a.id==='pair23').kind,'solve');assert.deepEqual(x.calls.seal,['rail2','rail3']);
});
test('active contacts cannot cross sleeping/awake components or remain selected after sleep',async()=>{
 for(const options of[{sleeping:[true,false,false,false]},{forceSleepingSelection:true}]){const x=fixture(options);x.observe();await assert.rejects(x.solve(),/crosses awake\/sleeping|remains in solver selection/);assert.equal(x.calls.math.length,0);assert.equal(x.calls.accept.length,0);}
});
test('source sleeping markers cannot authorize a caller numerical replacement or forged activation',async()=>{
 for(const mutate of[f=>{f[0].linear[0]=1;},f=>{f[0].force=[0,0,0];},f=>{f[0].activation.timer=99;},f=>{f[0].sleeping=false;},f=>{f[0].activationPhase='source-observed-awake';},f=>{f[0].ccdPhase='source-selected-pass';}]){const x=fixture();x.observe();const f=copy(x.flats);mutate(f);await assert.rejects(x.solve(f),/Numerical replacement|Exact source-observed/);assert.equal(x.calls.accept.length,0);}
});
test('observation snapshots cannot be altered after observe to launder state or force injection',async()=>{
 const x=fixture({entrySleeping:[false,false,false,false],newlySlept:[0,1,2,3]});x.observe();x.shared.pairResult.states[0].translation[0]=999;x.observed.bodies[0].force[0]=999;x.observed.context.bodies[0].activation.timer=999;
 const out=copy(await x.solve());assert.equal(out.states[0].translation[0],0);assert.equal(out.states[0].force[0],31);assert.equal(out.states[0].activation.timer,0);
 const y=fixture();y.observe();y.shared.pairResult.states[0].linear[0]=999;y.flats[0].linear[0]=999;await assert.rejects(y.solve(),/Numerical replacement/);
});
test('sleep needs actual native crossing evidence or an unchanged source-sleeping entry',async()=>{
 for(const options of[{entrySleeping:[false,false,false,false]},{entrySleeping:[false,false,false,false],newlySlept:[0,1,2,3],omitRows:true},{sleeping:[false,false,false,false],omitRows:true}]){const x=fixture(options);x.observe();await assert.rejects(x.solve(),/Unchanged source sleeping|actual force observation|actual observation/);assert.equal(x.calls.math.length,0);}
 const x=fixture();x.states[0].linear[0]=2;x.shared.pairResult.states[0].linear[0]=2;x.flats[0].linear[0]=2;x.observe();await assert.rejects(x.solve(),/zero-velocity entry state/);
});
test('source modified sleeping geometry is rejected rather than silently cache-sealed',async()=>{
 const x=fixture();x.shared.entryCollisionContext.colliders.find(c=>eq(c.handle,x.seed.balls[0].pairCollider)).changes=4;x.observe();await assert.rejects(x.solve(),/Modified sleeping contact/);assert.equal(x.calls.accept.length,0);
});
test('sleep receipts remain private to owner, member, transaction and observed pass',async()=>{
 const pass={},x=fixture({pass});x.observe();const out=copy(await x.solve());assert.ok(out.states.every(s=>s.dt===.5&&s.ccdMode==='source-selected-pass'));const a=x.calls.accept[0];
 assert.throws(()=>x.api.readResult({},x.owner,a.phase,'cpu-reference',x.transaction,pass),/receipt required/);
 assert.throws(()=>x.api.readResult(a.receipt,x.owner,a.phase,'cpu-reference',{},pass),/receipt required/);
 assert.throws(()=>x.api.readResult(a.receipt,x.owner,a.phase,'cpu-reference',x.transaction,{}),/receipt required/);
 assert.throws(()=>x.api.readResult(a.receipt,x.owner,{},'cpu-reference',x.transaction,pass),/not a member/);
 await assert.rejects(x.solve(),/Observed shared source solve/);x.owner.abort();assert.throws(()=>x.api.readResult(a.receipt,x.owner,a.phase,'cpu-reference',x.transaction,pass),/receipt required/);
});

test('CPU and WebGPU owners use the same source sleep selection and authenticated receipt paths',async()=>{
 for(const sleeping of[[true,true,true,true],[true,true,false,false],[false,false,false,false]]){
  const cpu=fixture({sleeping}),gpu=fixture({sleeping,backend:'webgpu'});cpu.observe();gpu.observe();const a=copy(await cpu.solve()),b=copy(await gpu.solve());assert.equal(b.backend,'webgpu');delete a.backend;delete b.backend;assert.deepEqual(a,b);
  assert.deepEqual(cpu.calls.math,gpu.calls.math);assert.deepEqual(cpu.calls.accept.map(({id,kind,out})=>({id,kind,out})),gpu.calls.accept.map(({id,kind,out})=>({id,kind,out})));
 }
});

test('source count-cleared retained contacts preserve caches during deferred whole-island wake',async()=>{
 const x=fixture({sleeping:[false,false,false,false],entrySleeping:[true,true,false,false],omittedEdges:[4],zeroHintEdges:[4]});x.observe();const out=copy(await x.solve()),p=x.calls.accept.find(a=>a.id==='pair01');
 assert.equal(x.calls.math.length,1);assert.equal(x.calls.math[0].config.bodyCount,4);assert.equal(p.kind,'solve');assert.equal(p.out.metadata.kind,'source-retained-wake-contact-unselected');assert.deepEqual(p.out.pair,p.phase.data.state);assert.deepEqual(p.out.states,out.states.slice(0,2));assert.deepEqual(p.out.states[0].linear,[101,102,103]);assert.ok(!out.sourceContactOrder.some(row=>row.edge===4));
});
test('an omitted awake contact needs actual entry-sleep, count-clear and absent GraphPos proof',async()=>{
 const base={sleeping:[false,false,false,false],entrySleeping:[true,true,false,false],omittedEdges:[4],zeroHintEdges:[4]};
 for(const options of[{...base,entrySleeping:[false,false,false,false]},{...base,zeroHintEdges:[]},{...base,graphPositions:{4:0}}]){const x=fixture(options);x.observe();await assert.rejects(x.solve(),/Active prepared pair omitted/);assert.equal(x.calls.accept.length,0);}
 const x=fixture(base);x.pairBindings[0].phase.data.refreshed=true;assert.throws(()=>x.observe(),/Unvisited\/asleep pair cannot be geometry-refreshed/);assert.equal(x.calls.accept.length,0);
});
