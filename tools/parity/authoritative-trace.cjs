'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const R=require('../../vendor/rapier.cjs');
for(const name of ['math','physics','game-rules'])require('../../src/'+name+'.js');
const ENGINE_SHA256='fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4';
const CASES=Object.freeze([
 {id:'three-default',mode:'three',settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0}},
 {id:'three-side-spin',mode:'three',settings:{angle:25,elevation:8,speed:2,tipX:.35,tipY:0}},
 {id:'three-elevated',mode:'three',settings:{angle:15,elevation:45,speed:2,tipX:0,tipY:.15}},
 {id:'four-default',mode:'four',settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0}},
 {id:'corner-blocked',mode:'three',cuePosition:{x:-1.37,y:.03080,z:-.66},settings:{angle:45,elevation:0,speed:2,tipX:0,tipY:0}},
 {id:'corner-elevated',mode:'three',cuePosition:{x:-1.37,y:.03080,z:-.66},settings:{angle:45,elevation:30,speed:2,tipX:0,tipY:0}}
].map(x=>Object.freeze(x)));
const v=x=>[x.x,x.y,x.z],q=x=>[x.x,x.y,x.z,x.w];
function frame(lab){return{step:lab.steps,bodies:lab.objects.map(o=>({id:o.id,position:v(o.body.translation()),rotation:q(o.body.rotation()),linearVelocity:v(o.body.linvel()),angularVelocity:v(o.body.angvel()),sleeping:o.body.isSleeping()}))};}
async function runCase(spec,{maxSteps=15360,sampleEvery=1}={}){
 if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>57600||!Number.isInteger(sampleEvery)||sampleEvery<1)throw RangeError('Explicit bounded trace required');
 if(!['three','four'].includes(spec.mode))throw RangeError('Unknown mode');
 if(crypto.createHash('sha256').update(fs.readFileSync(require.resolve('../../vendor/rapier.cjs'))).digest('hex')!==ENGINE_SHA256)throw Error('Authoritative engine mismatch');
 await R.init();if(R.version()!=='0.21.0')throw Error('Authoritative version mismatch');
 const lab=new PhysicsLab(R);let game;try{
  if(spec.mode==='four'){const red=lab.addSphere(LabMath.V(.64,LabDimensions.radius+.00005,.30),'적구 2','#ed7770');game=new FourBallGame([1,2],[3,red.id],{threeCushion:!!spec.threeCushion});}else game=new ThreeBallGame();
  if(spec.cuePosition&&!lab.move(1,spec.cuePosition))throw Error('Invalid fixture placement');
  const initialSnapshot=lab.snapshot({trails:false}),events=[],frames=[frame(lab)];
  lab.onEvent=e=>{game.contact(e);events.push({kind:e.kind,step:lab.steps,substepTime:e.time,a:e.a?{id:e.a.id,kind:e.a.kind}:null,b:e.b?{id:e.b.id,kind:e.b.kind}:null});};
  const result=lab.strike(1,{...spec.settings});if(result.ok)game.begin(1);
  while(result.ok&&lab.steps<maxSteps&&(lab.cue||lab.objects.some(o=>!o.body.isSleeping()))){lab.step();if(lab.steps%sampleEvery===0)frames.push(frame(lab));}
  if(frames.at(-1).step!==lab.steps)frames.push(frame(lab));
  const rested=!lab.cue&&lab.objects.every(o=>o.body.isSleeping());
  return{id:spec.id,engineSha256:ENGINE_SHA256,dt:Math.fround(lab.dt),applicationDt:lab.dt,elapsedSeconds:lab.time,cuePresent:!!lab.cue,steps:lab.steps,rested,strikeAccepted:result.ok,frames,events,score:result.ok&&rested?game.finish():null,initialSnapshot,settings:{...spec.settings},scope:'unchanged-PhysicsLab-observables; not hidden solver state'};
 }finally{lab.dispose();}
}
module.exports={ENGINE_SHA256,CASES,runCase,frame};
