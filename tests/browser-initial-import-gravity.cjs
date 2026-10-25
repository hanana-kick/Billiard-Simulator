'use strict';
// Shared numeric-source binding check. No native decode, init, restore or step.
const {test}=require('node:test'),assert=require('node:assert/strict');
test('native gravity is checked before any default gravity may be projected',async()=>{
 const {validateBindings}=await import('../src/browser-initial-import/configured-four-ball.mjs');
 for(const gravity of [[0,0,0],[0,Math.fround(-9.8),0],[1,Math.fround(-9.81),0]]){
  const row={application:{params:{gravity:9.81}},bodies:[],colliders:[],state:{gravity}};
  assert.throws(()=>validateBindings(row),/Native gravity must match/);
 }
});
