'use strict';
// Deterministic scheduling fixtures, NOT a measurement of GPU frame rate or
// real browser presentation. Browser/worker integration is checked separately.
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../src/render-cadence.js');
function sweep(refresh,fps,start=0,end=10000,cadence=new RenderCadence()){
 const times=[];for(let i=0;start+i*1000/refresh<end-1e-7;i++){const t=start+i*1000/refresh;if(cadence.allow(t,fps))times.push(t);}
 return times;
}
for(const refresh of [144,240])for(const fps of [30,60])test(`${refresh} Hz callbacks obey ${fps} FPS cap for ten seconds`,()=>{
 const frames=sweep(refresh,fps);assert.ok(frames.length>0);assert.ok(frames.length<=fps*10,`${frames.length} frames exceed ${fps*10}`);
 // Allow the usual one-frame boundary tolerance in an arbitrary sliding window.
 for(let i=0;i<frames.length;i++){let j=i;while(j<frames.length&&frames[j]<frames[i]+1000-1e-7)j++;assert.ok(j-i<=fps+1,`${j-i} frames in one second`);}
 console.log(JSON.stringify({fixture:true,refreshHz:refresh,limitFps:fps,seconds:10,acceptedFrames:frames.length}));
});
test('duplicate identical callback timestamps never render twice',()=>{
 const c=new RenderCadence();let accepted=0;for(let i=0;i<200;i++)accepted+=Number(c.allow(0,60));assert.equal(accepted,1);
 for(const t of [1000/60,1000,2000]){let count=0;for(let i=0;i<100;i++)count+=Number(c.allow(t,60));assert.ok(count<=1);}
});
test('hidden suspension renders nothing and resume does not accumulate a burst',()=>{
 const c=new RenderCadence();c.allow(0,60);c.suspend();assert.equal(sweep(240,60,1000,11000,c).length,0);
 c.resume();let sameTime=0;for(let i=0;i<100;i++)sameTime+=Number(c.allow(11000,60));assert.ok(sameTime<=1);
 const next=sweep(240,60,11000+1000/240,12000,c);assert.ok(next.length+sameTime<=61);
});
test('suspend/resume at same timestamp cannot reset the cap',()=>{
 const c=new RenderCadence();assert.equal(c.allow(10,60),true);for(let i=0;i<100;i++){c.suspend();c.resume();assert.equal(c.allow(10,60),false);}
});
test('changing between CPU 30 FPS and WebGL/worker 60 FPS preserves bounded cadence',()=>{
 const c=new RenderCadence();const first=sweep(240,60,0,5000,c),second=sweep(240,30,5000,10000,c),third=sweep(240,60,10000,15000,c);
 assert.ok(first.length<=300);assert.ok(second.length<=151);assert.ok(third.length<=301);
 assert.ok(first.length&&second.length&&third.length);
 console.log(JSON.stringify({fixture:true,segmentsSeconds:5,limits:[60,30,60],acceptedFrames:[first.length,second.length,third.length]}));
});
