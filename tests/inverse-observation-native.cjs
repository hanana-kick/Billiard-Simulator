'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const R=require('../vendor/rapier.cjs');
for(const name of ['math','physics','route-rules','optimizer-core','inverse-events'])require('../src/'+name+'.js');
const fixture=__dirname+'/fixtures/inverse-observation-original.json';
async function characterize(){
 await R.init();const source=new PhysicsLab(R),rows=[];
 try {
  const p=source.get(1).body.translation(),q=source.get(2).body.translation();
  const angle=Math.atan2(q.z-p.z,q.x-p.x)*180/Math.PI;
  for(const [name,yaw,events] of [['target',angle,[{kind:'object',id:2}]],['wrong-rail',angle,[{kind:'cushion',rail:'z+'},{kind:'object',id:2}]],['miss',angle+15,[{kind:'object',id:2}]]]){
   const settings={angle:yaw,elevation:8,speed:2,tipX:0,tipY:0};
   const req={snapshot:source.snapshot({trails:false}),selectedId:1,settings,options:{mode:'target',targetId:2,secondId:3,budget:48,horizon:8,spin:false,objective:'shortest',elevationMode:'search',allowKiss:true}};
   const e=LabInverseEvents.begin(R,req,{id:name,events},settings,{purpose:'verify'}),trace=crypto.createHash('sha256');let patches=0,phaseChecks=0;
   const lab=e.trial.lab,patch=lab.angularPatchResistance;let projections=0;
   if(LabInverseEvents.observation)for(const rail of lab.statics.filter(o=>o.kind==='cushion')){const project=rail.collider.projectPoint;rail.collider.projectPoint=function(...args){projections++;return project.apply(this,args);};}
   lab.angularPatchResistance=function(h){patches++;assert.equal(e.observedSubsteps,patches,'inverse observation precedes each application patch');phaseChecks++;if(LabInverseEvents.observation)assert.ok(projections<=e.observedSubsteps*4,'native projection is at most once per demanded cushion');return patch.call(this,h);};
   while(!e.done){LabInverseEvents.advance(e,1);trace.update(JSON.stringify({n:e.observedSubsteps,prefix:e.eventPrefix,residuals:e.stageResiduals,events:e.events,firstImpact:e.firstImpact,mismatch:e.mismatch}));}
   if(LabInverseEvents.observation&&name!=='wrong-rail')assert.ok(projections<patches,'native object topology must not eagerly project four rails');
   rows.push({name,phaseChecks,trace:trace.digest('hex'),outcome:LabInverseEvents.finish(e)});
  }
 }finally{source.dispose();}
 return JSON.parse(JSON.stringify(rows));
}
if(process.argv.includes('--capture-original')){
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(require.resolve('../src/inverse-events.js'))).digest('hex'),'9dbd020884d8e5c47f171ab40b97734e0bc6bccdf7603bc0af3a24e7c1a64160','Only unchanged 2ed077e source may produce original expectations');
 characterize().then(rows=>fs.writeFileSync(fixture,JSON.stringify({sourceCommit:'2ed077e',phase:'after-native-world.step-before-time-events-angular-patch',rows},null,2)+'\n'));
}
else test('unchanged original CPU inverse outcomes and every-outer-step traces retain exact phase semantics',async()=>{
 const expected=JSON.parse(fs.readFileSync(fixture));assert.deepEqual(await characterize(),expected.rows);
});
