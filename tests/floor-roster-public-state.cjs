'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/experimental-four-ball-world'),'utf8'),start=source.indexOf('function publicSnapshot('),end=source.indexOf('\nfunction controller(',start);
const snapshot=vm.compileFunction(source.slice(start,end)+';return publicSnapshot;',['copy','same'])(structuredClone,(a,b)=>a.index===b.index&&a.generation===b.generation);
const h=index=>({index,generation:0});
test('public floor colors come from committed graph identity rather than numerical scratch',()=>{
 const seed={pairSeed:{floorCollider:h(0)},balls:[{collider:h(16)},{collider:h(18)}]},state={balls:[{state:{solverColor:127,impulse:2}},{state:{solverColor:127,impulse:0}}]},roster={edges:[{collider1:h(0),collider2:h(16)}],pairs:[{solverColor:255}]},stages={cue:{snapshot:()=>({})},bvh:{snapshot:()=>({})},coupled:{roster:{snapshot:()=>structuredClone(roster)}}};
 const out=snapshot(seed,state,stages);assert.equal(out.balls[0].state.solverColor,255);assert.equal('solverColor'in out.balls[1].state,false);assert.equal(out.balls[0].state.impulse,2);assert.equal(state.balls[0].state.solverColor,127);assert.deepEqual(out.solverContactRoster,roster);
 out.balls[0].state.impulse=9;assert.equal(state.balls[0].state.impulse,2);
});
