// LIFECYCLE-ONLY TEST DOUBLES. No GPU command, shader, or physics parity claim.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createExclusiveShotRunner, budgetOf} from '../src/bounded-gpu-shot/lifecycle.mjs';
const deferred = () => {let resolve, reject;const promise = new Promise((a,b) => {resolve=a;reject=b;});return {promise,resolve,reject};};
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup({initialize, step, restAt=3, busy=()=>false, yieldControl, release} = {}) {
  let clock=0, flights=0, maxFlights=0, releases=0, initializations=0, yields=0;
  const loss=deferred(), worlds=[];
  const runner=createExclusiveShotRunner({deviceLost:loss.promise,now:()=>clock,
    renderingBusy:busy,yieldControl:yieldControl??(async()=>{yields++;clock++;await tick();}),
    async initialize(input,check) {
      initializations++;
      if(initialize)await initialize(input,check);
      check();
      const state={id:input.id,frame:0,outerStep:0,outerSubstep:0,time:0,
        balls:Array.from({length:4},()=>({state:{sleeping:false}})),cue:{present:true},
        contactEvents:[],game:{pending:true},shotComplete:false,scene:{manager:{awake_island:0}}};
      const world={snapshot:()=>structuredClone(state),async step(){flights++;maxFlights=Math.max(maxFlights,flights);
        try{if(step)await step(state,input);state.frame++;state.time+=1/61440;state.outerSubstep++;
          if(state.frame===restAt){state.shotComplete=true;state.cue.present=false;state.balls.forEach(b=>b.state.sleeping=true);
            state.scene.manager.awake_island=null;state.scoreResult={delta:0};state.game={pending:null};}
        }finally{flights--;}}};
      worlds.push(world);
      return {world,release:()=>{assert.equal(flights,0);releases++;release?.();}};
    }});
  return {runner,loss,worlds,advance:n=>clock+=n,stats:()=>({flights,maxFlights,releases,initializations,yields})};
}
const input = id=>({id,data:{speed:2},snapshot:new Uint8Array([1,2,3])});

test('lifecycle double: exact h budget suspends, retains owner, and resumes to original completion only',async()=>{
  const s=setup(),op=s.runner.start(input('A'),{budget:{maxSteps:1,maxWallMs:100}});
  const first=await op.result;assert.equal(first.status,'budget-suspended');assert.equal(first.progress.committedH,1);
  assert.equal(first.scoring.result,null);assert.equal(s.stats().releases,0);
  assert.equal((await op.resume({budget:{maxSteps:1,maxWallMs:100}})).status,'budget-suspended');
  const complete=await op.resume();assert.equal(complete.status,'complete');assert.equal(complete.progress.committedH,3);
  assert.equal(complete.scoring.result.delta,0);assert.deepEqual(await op.finished,complete);
  assert.equal(s.stats().initializations,1);assert.equal(s.stats().maxFlights,1);assert.equal(s.stats().releases,1);
  await s.runner.dispose();assert.equal(s.stats().releases,1);
});

test('lifecycle double: wall budget under rendering contention does not claim rest or submit an h',async()=>{
  const s=setup({busy:()=>true});const op=s.runner.start(input('A'),{budget:{maxSteps:3,maxWallMs:3}});
  const out=await op.result;assert.equal(out.status,'budget-suspended');assert.equal(out.reason,'maxWallMs');
  assert.equal(out.progress.committedH,0);assert.equal(s.stats().yields,3);
  await s.runner.dispose();assert.equal((await op.finished).status,'cancelled');assert.equal(s.stats().releases,0);assert.equal(s.stats().initializations,0);
});

test('lifecycle double: input and budgets are owned before awaiting, snapshots cannot mutate owner',async()=>{
  const entered=deferred(),gate=deferred();let seen;
  const s=setup({initialize:async data=>{entered.resolve();await gate.promise;seen=data;}});
  const data=input('A'),budget={maxSteps:1,maxWallMs:100},op=s.runner.start(data,{budget});
  data.data.speed=999;data.snapshot.fill(9);budget.maxSteps=4;
  await entered.promise;gate.resolve();const out=await op.result;
  assert.equal(seen.data.speed,2);assert.deepEqual(seen.snapshot,new Uint8Array([1,2,3]));
  assert.ok(Object.isFrozen(seen.data));assert.equal(out.progress.committedH,1);
  assert.throws(()=>out.state.frame=100);assert.equal(op.snapshot().state.frame,1);await s.runner.dispose();
});

test('lifecycle double: already-aborted signal starts no initialization or device work',async()=>{
  const s=setup(),abort=new AbortController();abort.abort();
  const op=s.runner.start(input('A'),{signal:abort.signal});assert.equal((await op.result).status,'cancelled');
  assert.equal(s.stats().initializations,0);await s.runner.dispose();
});

test('lifecycle double: abort during an atomic h drains and reports the last committed h',async()=>{
  const entered=deferred(),gate=deferred(),abort=new AbortController();
  const s=setup({step:async()=>{entered.resolve();await gate.promise;}});
  const op=s.runner.start(input('A'),{signal:abort.signal});await entered.promise;abort.abort();
  assert.equal(s.stats().releases,0);gate.resolve();const out=await op.result;
  assert.equal(out.status,'cancelled');assert.equal(out.progress.committedH,1);assert.equal(s.stats().releases,1);
  assert.equal(s.stats().maxFlights,1);await s.runner.dispose();
});

test('lifecycle double: stale owner cannot overwrite new operation; no overlapping old/new h',async()=>{
  const entered=deferred(),gate=deferred();
  const s=setup({step:async(state,data)=>{if(data.id==='old'){entered.resolve();await gate.promise;}}});
  const old=s.runner.start(input('old'));await entered.promise;
  const fresh=s.runner.start(input('new'),{budget:{maxSteps:1,maxWallMs:100}});
  assert.equal(s.runner.snapshot().operationId,fresh.id);assert.equal(s.stats().initializations,1);
  gate.resolve();const prior=await old.result,out=await fresh.result;
  assert.equal(prior.status,'cancelled');assert.equal(prior.state.id,'old');assert.equal(prior.progress.committedH,1);
  assert.equal(out.status,'budget-suspended');assert.equal(out.state.id,'new');
  assert.equal(s.runner.snapshot().operationId,fresh.id);assert.equal(s.runner.snapshot().state.id,'new');
  assert.equal(s.stats().maxFlights,1);assert.equal(s.stats().releases,1);
  await old.cancel();assert.equal(s.runner.snapshot().state.id,'new');await s.runner.dispose();
});

test('lifecycle double: superseding a suspended operation releases it before new initialization',async()=>{
  const s=setup(),old=s.runner.start(input('old'),{budget:{maxSteps:1}});await old.result;
  const fresh=s.runner.start(input('new'),{budget:{maxSteps:1}});await fresh.result;
  assert.equal((await old.finished).reason,'superseded');assert.equal(s.stats().releases,1);
  assert.throws(()=>old.resume(),/idle budget-suspended/);await s.runner.dispose();
});

test('lifecycle double: duplicate resume cannot enqueue concurrent physics slices',async()=>{
  const s=setup(),op=s.runner.start(input('A'),{budget:{maxSteps:1}});await op.result;
  const next=op.resume({budget:{maxSteps:1}});assert.throws(()=>op.resume(),/idle budget-suspended/);
  await next;assert.equal(s.stats().maxFlights,1);await s.runner.dispose();
});

test('lifecycle double: device loss during h reports device-lost, releases after drain, never falls back',async()=>{
  const entered=deferred(),gate=deferred(),s=setup({step:async()=>{entered.resolve();await gate.promise;}});
  const op=s.runner.start(input('A'));await entered.promise;s.loss.resolve({reason:'unknown',message:'test device loss'});
  await tick();assert.equal(s.stats().releases,0);gate.resolve();const out=await op.result;
  assert.equal(out.status,'device-lost');assert.equal(out.progress.committedH,1);assert.equal(s.stats().releases,1);
  const later=s.runner.start(input('B'));assert.equal((await later.result).status,'device-lost');
  assert.equal(s.stats().initializations,1);await s.runner.dispose();
});

test('lifecycle double: unsupported phase and unexpected errors stay distinct and keep committed state',async()=>{
  for(const [error,status]of [[new RangeError('Unsupported contact'),'unsupported'],[new Error('broken invariant'),'failed']]){
    const s=setup({step:async state=>{if(state.frame===1)throw error;}}),op=s.runner.start(input('A'));
    const out=await op.result;assert.equal(out.status,status);assert.equal(out.progress.committedH,1);
    assert.equal(out.scoring.result,null);assert.equal(s.stats().releases,1);await s.runner.dispose();
  }
});

test('lifecycle double: forged completion without all physical-rest fields is failed, not complete',async()=>{
  const s=setup({restAt:99,step:async state=>{state.shotComplete=true;}}),op=s.runner.start(input('A'));
  const out=await op.result;assert.equal(out.status,'failed');assert.match(out.error.message,/physical-rest/);
  assert.equal(out.scoring.result,null);await s.runner.dispose();
});

test('lifecycle double: signal abort while suspended settles finished and releases once',async()=>{
  const s=setup(),signal=new AbortController(),op=s.runner.start(input('A'),{signal:signal.signal,budget:{maxSteps:1}});
  await op.result;signal.abort();assert.equal((await op.finished).status,'cancelled');
  await s.runner.dispose();assert.equal(s.stats().releases,1);
});

test('configuration limits are exact, bounded and do not rewrite physics time',()=>{
  for(const b of [{maxSteps:0},{maxSteps:4097},{maxSteps:1.5},{maxWallMs:0},{maxWallMs:Infinity},{dt:1}])assert.throws(()=>budgetOf(b));
  assert.equal(budgetOf({maxSteps:1}).maxWallMs,1000);
});

test('public production service rejects a device-shaped test double, with no injected backend',async()=>{
  const {createBoundedFourBallShotService}=await import('../src/bounded-gpu-shot/four-ball.mjs');
  assert.throws(()=>createBoundedFourBallShotService({device:{createBuffer(){}},decoder:{decodeSnapshot(){}}}),/actual.*GPUDevice/);
  assert.throws(()=>createBoundedFourBallShotService({world:{}}),/accepts device/);
});

test('lifecycle doubles: null/undefined rejections cannot strand result, finished or owned resources',async()=>{
  for(const rejected of [null,undefined])for(const source of ['yield-before','yield-after','busy-before','busy-after','initialize']){
    let yields=0,busyCalls=0;
    const s=setup({
      initialize:source==='initialize'?async()=>{throw rejected;}:undefined,
      yieldControl:async()=>{yields++;if(source==='yield-before'||source==='yield-after'&&yields===2)throw rejected;await tick();},
      busy:()=>{busyCalls++;if(source==='busy-before'||source==='busy-after'&&busyCalls===2)throw rejected;return false;}
    });
    const op=s.runner.start(input(source)),out=await op.result;
    assert.equal(out.status,'failed',source);assert.equal((await op.finished).status,'failed',source);
    assert.equal(op.snapshot().phase,'finished');
    assert.equal(s.stats().releases,source.endsWith('-after')?1:0,source);
    await s.runner.dispose();
  }
});

test('lifecycle double: user scheduling RangeError is failed rather than physics-unsupported',async()=>{
  const s=setup({busy:()=>{throw new RangeError('render hook failure');}}),op=s.runner.start(input('A'));
  assert.equal((await op.result).status,'failed');await s.runner.dispose();
});

test('lifecycle doubles: exact suspension microtask cancellation barrier drains once before replacement',async()=>{
  for(const trigger of ['cancel','abort','supersede','device-loss','dispose','combined']){
    const abort=new AbortController();let op,fresh,requested,checks=0;
    const s=setup({yieldControl:async()=>{},step:async state=>{
      if(state.id!=='old')return;
      // Deterministic microtask ordering: trigger exactly after the status was
      // changed by finish(suspended), before result/pending finalization.
      const check=()=>{
        assert.ok(++checks<100,'Boundary probe must not hang');
        if(op.snapshot().status!=='budget-suspended'){queueMicrotask(check);return;}
        assert.equal(s.stats().releases,0);
        if(trigger==='cancel')requested=op.cancel();
        if(trigger==='abort'){abort.abort();requested=op.finished;}
        if(trigger==='supersede'||trigger==='combined'){
          fresh=s.runner.start(input('new'),{budget:{maxSteps:1,maxWallMs:100}});
          requested=op.finished;
        }
        if(trigger==='device-loss'||trigger==='combined'){s.loss.resolve({message:'boundary loss'});requested=op.finished;}
        if(trigger==='dispose')requested=s.runner.dispose();
        if(trigger==='combined'){abort.abort();op.cancel();}
      };queueMicrotask(check);
    }});
    op=s.runner.start(input('old'),{signal:abort.signal,budget:{maxSteps:1,maxWallMs:100}});
    await op.result;await requested;
    const ended=await op.finished;
    assert.ok(['cancelled','device-lost'].includes(ended.status),trigger);
    assert.equal(ended.progress.committedH,1);assert.equal(s.stats().releases,1,trigger);
    if(fresh){const result=await fresh.result;
      assert.equal(result.status,trigger==='combined'?'device-lost':'budget-suspended');
      assert.equal(s.runner.snapshot().operationId,fresh.id);
      if(trigger==='supersede')assert.equal(result.state.id,'new');
    }
    if(trigger==='cancel'||trigger==='abort'){
      const next=s.runner.start(input('new'),{budget:{maxSteps:1}});assert.equal((await next.result).status,'budget-suspended');
      assert.equal(s.stats().initializations,2);
    }
    await s.runner.dispose();assert.equal(s.stats().maxFlights,1);
  }
});

test('lifecycle doubles: shared-memory capture rejects before replacing an existing owner',async()=>{
  const s=setup(),old=s.runner.start(input('old'),{budget:{maxSteps:1}});await old.result;
  const shared=new SharedArrayBuffer(4);
  for(const data of [
    {...input('bad'),snapshot:new Uint8Array(shared)},
    {...input('bad'),data:{nested:{shared}}},
    {...input('bad'),data:{nested:new Map([['bytes',new DataView(shared)]])}},
    {...input('bad'),data:{nested:new Set([shared])}}
  ])assert.throws(()=>s.runner.start(data),/SharedArrayBuffer/);
  new Uint8Array(shared).fill(9);
  assert.equal(s.runner.snapshot().operationId,old.id);assert.equal(old.snapshot().status,'budget-suspended');
  assert.equal((await old.resume()).status,'complete');assert.equal(s.stats().initializations,1);await s.runner.dispose();
});


test('lifecycle doubles: cloned shared WebAssembly.Memory and unknown host data cannot hide storage',async()=>{
  const s=setup(),old=s.runner.start(input('old'),{budget:{maxSteps:1}});await old.result;
  const memory=new WebAssembly.Memory({initial:1,maximum:1,shared:true});
  for(const hidden of [memory,new Date(),/unexpected/])
    assert.throws(()=>s.runner.start({...input('bad'),data:{hidden}}),/plain data/);
  assert.equal(s.runner.snapshot().operationId,old.id);assert.equal(old.snapshot().status,'budget-suspended');
  await old.cancel();await s.runner.dispose();
});
