'use strict';
// Original CPU receipt producer only. No experimental world/query/reducer loads.
const fs=require('node:fs'),v8=require('node:v8'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),path=require('node:path');
const sourceHashes=Object.fromEntries(['vendor/rapier.cjs','src/physics.js','src/controller.js','src/route-rules.js'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',p))).digest('hex')]));
const R=require('../vendor/rapier.cjs');globalThis.RAPIER=R;
for(const n of ['math','render-cadence','physics','game-rules','route-rules','controller'])require('../src/'+n);
const pos=p=>({x:p.x,y:p.y,z:p.z});
function receipt(lab,selectedId,sequence,time,stepDt,initial=false){
 const cue=lab.get(selectedId),p=pos(cue.body.translation());
 const impact=(a,b)=>{let hit=false;if(!initial)lab.world.contactPair(a,b,m=>{for(let i=0;i<m.numContacts();i++)if(m.contactImpulse(i)>0)hit=true;});return hit;};
 return {phase:initial?'initial-before-world-step':'after-world-step-before-application',sequence,time,stepDt,cue:{radius:cue.radius,position:p},objects:lab.objects.filter(o=>o.id!==selectedId).map(o=>({id:o.id,radius:o.radius,position:pos(o.body.translation()),impact:impact(cue.pairCollider||cue.collider,o.pairCollider||o.collider)})),rails:lab.statics.filter(o=>o.kind==='cushion').map(o=>{const q=o.collider.projectPoint(p,true);return{rail:LabRouteRules.railId(o),impact:impact(cue.collider,o.collider),projection:{point:pos(q.point),isInside:q.isInside}};})};
}
(async()=>{
 await R.init();const {captureLiveRegisteredFourBall}=await import('../src/browser-initial-import/live-capture.mjs');const c=new LabController();c.lab=new PhysicsLab(R);c.state.gameMode='four';c.setupGame();
 try{
  for(const [id,x,z]of [[1,.9,0],[2,-.4,.4],[3,1.25,0],[4,-.6,-.3]])assert.equal(c.move(id,{x,y:c.lab.get(id).radius+.00005,z}),true);
  for(let n=0;n<2500&&!c.lab.objects.every(o=>o.body.isSleeping());n++)c.lab.step();assert.ok(c.lab.objects.every(o=>o.body.isSleeping()));
  c.state.settings={angle:0,elevation:8,speed:Number(process.env.INVERSE_OBSERVATION_SPEED??2),tipX:0,tipY:0};
  const captured=captureLiveRegisteredFourBall({controller:c}),raw={snapshot:captured.snapshot,preStrikeSnapshot:captured.preStrikeSnapshot,capture:captured.capture};captured.dispose();
  assert.equal(c.fire(),true);assert.deepEqual(c.lab.world.takeSnapshot(),raw.snapshot,'original continuous fire equals independent capture fork');
  const frames=[receipt(c.lab,1,0,c.lab.time,0,true)],original=c.lab.world.step;let count=0,episodes=0,active=false,postCue=0;
  c.lab.world.step=function(...args){const dt=this.integrationParameters.dt,time=c.lab.time+dt,result=original.apply(this,args),frame=receipt(c.lab,1,++count,time,dt);frames.push(frame);const target=frame.objects.find(o=>o.id===3),gap=Math.hypot(...['x','y','z'].map(k=>frame.cue.position[k]-target.position[k]))-frame.cue.radius-target.radius;if(gap>.00005)active=false;if(target.impact&&!active){episodes++;active=true;}return result;};
  while(count<1600&&(episodes<2||postCue<8)){c.lab.step();if(!c.lab.cue)postCue++;}
  c.lab.world.step=original;
  assert.ok(episodes>=2,'actual sphere return observed');assert.ok(postCue>=8,'post-cue path reached');
  const record={schema:'original-native-inverse-world-observation-v1',sourceHashes,raw,frames,episodes,postCue,settings:c.state.settings,sourceStart:frames[0].time};fs.writeFileSync(process.argv[2],v8.serialize(record));console.log(JSON.stringify({frames:frames.length,episodes,postCue,firstImpacts:frames.filter(f=>f.objects.some(o=>o.impact)).slice(0,3).map(f=>f.sequence)}));
 }finally{clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
})().catch(e=>{console.error(e);process.exitCode=1;});
