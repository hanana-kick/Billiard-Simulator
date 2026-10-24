'use strict';
// Cloud/controller fixtures. These do not claim physical display latency,
// Samsung hardware results, or a substitute for the real-app browser suite.
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const R=require('../vendor/rapier.cjs');globalThis.RAPIER=R;
for(const file of ['math','physics','render-cadence','renderer','game-rules','controller'])require('../src/'+file+'.js');
before(()=>R.init());

function timingHarness(){
 let now=100;const messages=[],draws=[];
 const context=vm.createContext({performance:{now:()=>now,timeOrigin:1700000000000},setTimeout:()=>1,clearTimeout(){},document:{hidden:false}});
 for(const file of ['math','physics','render-cadence','renderer','render-service','controller'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/'+file+'.js'),'utf8'),context);
 const canvas={width:400,height:300,getContext:()=>({drawImage(){draws.push(now)}}),getBoundingClientRect:()=>({width:400,height:300})};
 const body={translation:()=>({x:0,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:0})};
 const lab={statics:[],objects:[{id:1,body,shape:'sphere',radius:.03,color:'#ffffff',trail:[]}],get(){return this.objects[0]},pose(){return null},anyMotion:()=>false};
 const worker={postMessage:m=>messages.push(m),terminate(){}};
 const c=new context.LabController();c.lab=lab;c.renderer=new context.WorkerRenderer(canvas,worker);c.state.previewCueVisible=true;c.state.predict=false;
 c.notify=()=>{c.dirty=true};c.finishGameShot=c.renderSide=c.updateHandles=c.scheduleFrame=()=>{};
 return {c,context,messages,draws,time:n=>now=n,frame(n){now=n;c.frame(n)},complete(id){worker.onmessage({data:{type:'frame',id,bitmap:{close(){}},renderMs:3}})}};
}

test('worker input timing ends at its matching canvas draw, not submit or completion',()=>{
 const h=timingHarness(),c=h.c;
 const first=c.beginInput({timeStamp:95});h.time(102);c.finishInput(first);h.frame(104);
 assert.equal(c.inputMetrics.lastDispatchMs,5);assert.equal(c.inputMetrics.lastHandlerMs,2);
 assert.equal(c.inputMetrics.presented,0);assert.equal(c.renderMetrics.presentations,0);assert.equal(h.messages.length,1);
 h.time(110);const second=c.beginInput({timeStamp:107});c.dirty=true;h.frame(125);
 assert.equal(h.messages.length,1);assert.equal(c.inputMetrics.presented,0);
 h.time(140);h.complete(1);assert.equal(h.draws.length,0);assert.equal(c.inputMetrics.presented,0);
 h.frame(145);assert.deepEqual(h.draws,[145]);assert.equal(c.inputMetrics.lastInputToCanvasMs,50);assert.equal(c.inputMetrics.presented,1);assert.equal(c.pendingInput.id,second.id);assert.equal(h.messages.length,2);
 h.time(170);h.complete(2);h.frame(180);
 assert.equal(c.inputMetrics.lastInputToCanvasMs,73);assert.equal(c.inputMetrics.maxInputToCanvasMs,73);assert.equal(c.inputMetrics.lastInputToFrameMs,73);assert.equal(c.inputMetrics.presented,2);assert.equal(c.inputMetrics.samples[0].id,first.id);assert.equal(c.inputMetrics.samples[1].id,second.id);assert.equal(c.inputMetrics.samples[0].workerSequence,1);assert.equal(c.inputMetrics.samples[1].workerSequence,2);assert.equal(c.inputMetrics.samples[1].canvasCompletedAt,180);assert.equal(c.inputMetrics.samples[1].inputToCanvasMs,c.inputMetrics.lastInputToCanvasMs);assert.equal(c.inputMetrics.lastBoundary,'worker-bitmap-draw');assert.equal(c.pendingInput,null);
 h.frame(200);assert.equal(c.inputMetrics.presented,2);assert.equal(c.renderMetrics.presentations,2);
});

test('hidden or canceled samples cannot be attributed to a later visible frame',()=>{
 const h=timingHarness(),c=h.c;c.beginInput({timeStamp:98});h.frame(100);c.discardPendingInput();h.complete(1);h.frame(140);
 assert.equal(c.inputMetrics.presented,0);
 h.time(150);c.beginInput({timeStamp:148});c.dirty=true;h.frame(160);c.discardPendingInput();c.renderer.setHidden(true);h.complete(2);h.frame(200);
 assert.equal(c.inputMetrics.presented,0);assert.equal(h.draws.length,1);
 c.renderer.setHidden(false);c.dirty=true;h.frame(220);h.complete(3);h.frame(240);assert.equal(c.inputMetrics.presented,0);
});

test('event clocks normalize epoch timestamps and reject future/invalid values',()=>{
 const h=timingHarness(),c=h.c;
 assert.equal(c.beginInput({timeStamp:1700000000097}).at,97);
 assert.equal(c.beginInput({timeStamp:150}).at,100);
 assert.equal(c.beginInput({timeStamp:NaN}).at,100);
 assert.equal(c.beginInput({}).at,100);
});

for(const fallback of [false,true])test(`direct ${fallback?'CPU':'WebGL'} timing is measured only on a completed capped draw`,()=>{
 const h=timingHarness(),c=h.c;c.renderer={isFallback:fallback,completedFrames:0,render(){this.completedFrames++}};
 c.beginInput({timeStamp:90});h.frame(100);assert.equal(c.inputMetrics.lastInputToCanvasMs,10);
 h.time(101);c.beginInput({timeStamp:101});c.dirty=true;h.frame(102);assert.equal(c.inputMetrics.presented,1);
 h.frame(140);assert.equal(c.inputMetrics.presented,2);assert.equal(c.inputMetrics.lastInputToCanvasMs,39);assert.equal(c.inputMetrics.samples.at(-1).gateSkips,1);assert.equal(c.renderMetrics.cap,fallback?30:60);assert.equal(c.inputMetrics.lastBoundary,fallback?'cpu-render':'webgl-command-submit');
});

function realController(){
 const rect={left:0,top:0,width:390,height:620};
 const c=new LabController();c.lab=new PhysicsLab(R);c.state.predict=false;c.canvas={width:1,height:1,style:{},getBoundingClientRect:()=>({...rect})};
 c.renderer=Object.create(LabRenderer.prototype);c.renderer.canvas=c.canvas;c.renderer.camera={yaw:.12,pitch:.86,zoom:1.23,projection:'perspective',target:LabMath.V(-.12,-.035,0)};
 c.notify();c.resizeViewport();return{c,rect,close(){c.lab.dispose();clearTimeout(c.predictionTimer);clearTimeout(c.noticeTimer)}};
}

function beginBall(c){const p={...c.lab.get(1).body.translation()};c.drag={type:'ball',pointer:1,id:1,height:p.y,before:c.captureHistory(),changed:false,moved:false};return p;}

test('fold/aspect projection changes preserve committed world, settings, camera and redo',()=>{
 const h=realController(),c=h.c;try{
 c.setPosition({x:-.6,z:-.4});c.undo();c.changeSettings({angle:17.23,elevation:13.25});c.setPosition({x:-.65,z:-.4});c.undo();
 c.state.activePanel='settings';const lab=c.lab,settings={...c.state.settings},camera=structuredClone(c.renderer.camera),positions=c.lab.objects.map(o=>({...o.body.translation()})),redo=c.redoStack.slice();
 for(const [width,height]of [[344,882],[882,344],[768,960],[960,768],[320,568],[1440,900],[390,620]]){
  Object.assign(h.rect,{width,height});c.resizeViewport();assert.equal(c.lab,lab);assert.deepEqual(c.lab.objects.map(o=>({...o.body.translation()})),positions);assert.deepEqual(c.state.settings,settings);assert.deepEqual(c.renderer.camera,camera);assert.deepEqual(c.redoStack,redo);assert.equal(c.state.activePanel,'settings');assert.equal(c.lab.shots,0);assert.equal(c.renderer.aspect,width/height);
  const p=positions[0],q=c.renderer.project(p),roundtrip=c.renderer.planePoint(q.x,q.y,p.y);assert(Math.hypot(roundtrip.x-p.x,roundtrip.z-p.z)<1e-7);
 }
 }finally{h.close();}
});

test('resize cancels the active ball drag once without undo entry or stray touch state',()=>{
 const h=realController(),c=h.c;try{
 c.setPosition({x:-.7,z:-.4});c.undo();const redo=c.redoStack.slice();let restores=0;const restore=c.restoreHistory.bind(c);c.restoreHistory=saved=>{restores++;restore(saved)};
 const original=beginBall(c);c.move(1,{...original,x:-.6,z:-.4},{interactive:true});c.drag.changed=true;c.gestures.set(1,{x:10,y:10});c.pinch={distance:40,zoom:1};c.suppressTouch=true;
 const oldWorld=c.lab;Object.assign(h.rect,{width:800,height:360});c.resizeViewport();
 assert.equal(c.lab,oldWorld);assert.deepEqual({...c.lab.get(1).body.translation()},original);assert.equal(c.undoStack.length,0);assert.equal(c.drag,null);assert.equal(c.gestures.size,0);assert.equal(c.pinch,null);assert.equal(c.suppressTouch,false);assert.equal(c.state.gesture,'');assert.equal(c.lab.shots,0);
 c.touchEnd({pointerId:1});for(let i=0;i<20;i++){h.rect.width=800-i*10;c.resizeViewport();}assert.deepEqual({...c.lab.get(1).body.translation()},original);assert.equal(c.undoStack.length,0);assert.deepEqual(c.redoStack,redo);assert.equal(restores,1);
 }finally{h.close();}
});

for(const type of ['forward-aim','aim','fine-aim','elevation'])test(`${type} cancellation preserves original settings and redo`,()=>{
 const h=realController(),c=h.c;try{
 const settings={...c.state.settings},redo=[{kind:'sentinel'}];c.redoStack=redo.slice();c.drag={type,pointer:1,initialAngle:settings.angle,settingsBefore:settings,redoBefore:c.redoStack.slice()};
 c.changeSettings({angle:27.43,elevation:45},{interactive:true});assert.equal(c.redoStack.length,0);c.endGesture({pointerId:1},true);
 assert.deepEqual(c.state.settings,settings);assert.deepEqual(c.redoStack,redo);assert.equal(c.drag,null);assert.equal(c.inputPending,false);assert.equal(c.lab.shots,0);
 }finally{h.close();}
});

test('per-input traces have a bounded history and do not merge independent event stages',()=>{const h=timingHarness(),c=h.c;for(let id=1;id<=75;id++){h.time(id*100);const input=c.beginInput({timeStamp:id*100-5,type:'pointermove'});h.time(id*100+2);c.finishInput(input);h.time(id*100+22);c.recordInputPresentation(input,'cpu-render',{renderStartedAt:id*100+12,renderCompletedAt:id*100+22,renderer:{totalMs:10}});}assert.equal(c.inputMetrics.samples.length,60);const s=c.inputMetrics.samples.at(-1);assert.equal(s.id,75);assert.equal(s.dispatchMs,5);assert.equal(s.handlerMs,2);assert.equal(s.handlerToRenderMs,10);assert.equal(s.inputToCanvasMs,27);assert.equal(s.renderer.totalMs,10);assert.equal(s.inputToCanvasMs,c.inputMetrics.lastInputToCanvasMs);});
