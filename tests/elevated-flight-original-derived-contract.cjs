'use strict';
// SPDX-License-Identifier: Apache-2.0
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('./elevated-flight-original-fixture.cjs'),F=require('./four-ball-created-fixture.cjs');
test('source Kelvin-Voigt initial damping and stiffness do not imply lift from offset alone',()=>{
 const evalAt=tipY=>{const e=20*Math.PI/180,a=Math.sqrt(1-tipY*tipY),ny=-(tipY*Math.cos(e)+a*Math.sin(e)),ty=Math.sqrt(1-ny*ny),vn=2*a,vt=2*Math.abs(tipY);return{dampingY:110*vn*ny-10*vt*ty,stiffnessY:1e6*vn*ny-4e5*vt*ty,coulombY:ny-.7*ty};};
 const half=evalAt(-.5),low=evalAt(-.65);assert.ok(half.dampingY>0&&low.dampingY>0);assert.ok(half.stiffnessY<0&&low.stiffnessY>0);assert.ok(half.coulombY<0&&low.coulombY<0);
});
for(const spec of[{offset:-.5,suffix:'05',h:5023,outer:4519,withdrawal:459,maxY:.030682740733027458},{offset:-.65,suffix:'065',h:3185,outer:2744,withdrawal:426,maxY:.030683845281600952}])test('legal tipY='+spec.offset+' is a native-rest negative control, not flight',{skip:!process.env.ELEVATED_FLIGHT_DERIVED_DIR},()=>{
 const file=process.env.ELEVATED_FLIGHT_DERIVED_DIR+'/speed2-tipminus'+spec.suffix+'.json',p=JSON.parse(fs.readFileSync(file));assert.deepEqual(p.identity,C.identity());assert.equal(p.observerSha256,F.hash(fs.readFileSync(require.resolve('./elevated-flight-original-derived-probe.cjs'))));
 assert.deepEqual(p.settings,{angle:0,elevation:20,tipX:0,tipY:spec.offset,speed:2});assert.equal(p.control.fireAccepted,true);assert.equal(p.control.clearance.clear,true);assert.equal(p.postStrikeBallAssignments,0);assert.equal(p.status,'native-rest-complete');assert.equal(p.hCount,spec.h);assert.equal(p.firstRestOuter,spec.outer);assert.equal(p.cueWithdrawal,spec.withdrawal);assert.equal(p.maxHeight.ball.translation[1],spec.maxY);assert.deepEqual(p.score,{cueId:1,delta:0,nextCue:2});
 assert.ok(p.transitions.length>0);assert.ok(p.transitions.every(t=>t.floor.pair&&t.floor.points===1&&t.floor.active));assert.ok(p.transitions.every(t=>t.cue.every(c=>c.points===0&&c.solverContacts===0&&!c.positive)));
});
