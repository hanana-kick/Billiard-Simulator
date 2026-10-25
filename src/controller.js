/* Owns live engine state. UI state never substitutes velocities or collision rules. */
(function(G){
'use strict';
const {V,add,sub,mul,dot,len,norm,clamp}=G.LabMath,D=G.LabDimensions;
const normalizeAngle=a=>((a+180)%360+360)%360-180;
class LabController{
 constructor(){
  this.state={settings:{angle:0,elevation:8,tipX:0,tipY:0,speed:2},selectedId:1,paused:true,rate:1,paths:false,allPaths:false,showCue:true,debug:false,vectors:false,mode:'cue',view:'3d',activePanel:'routes',fineAim:false,predict:true,horizon:8,forecast:null,forecastStatus:'물리엔진 준비 중',predictionBusy:false,obstruction:null,cuePull:0,gesture:'',notice:'',ready:false,engineError:null,previewCueVisible:false,canAim:false};
  this.state.gameMode='free';this.state.game=null;
  this.state.routeOptions={searchAlgorithm:'inverse-constraints',maxCushions:3,maxKisses:1,solveTimeMs:20000,inputStrategy:'hybrid',mode:'three',targetId:2,secondId:3,horizon:16,spin:true,objective:'shortest',order:'either',methods:['any'],allowKiss:true,elevationMode:'search',minElevation:0,maxElevation:85,fourBallThreeCushion:false,minSpeed:.5,maxSpeed:4.5,workers:0};this.state.routeStatus='idle';this.state.routeProgress=null;this.state.routeResult=null;this.state.routeError='';this.state.routeApplied=null;
  this.undoStack=[];this.redoStack=[];this.inputMetrics={events:0,presented:0,lastBoundary:null,lastHandlerMs:0,maxHandlerMs:0,lastDispatchMs:0,maxDispatchMs:0,lastInputToFrameMs:0,maxInputToFrameMs:0,lastInputToCanvasMs:0,maxInputToCanvasMs:0,samples:[]};this.inputSequence=0;this.measuredInputSequence=0;this.pendingInput=null;this.renderCadence=new G.RenderCadence();this.renderMetrics={frames:0,presentations:0,cap:60};this.raf=null;this.disposed=false;this.listeners=new Set();this.lastSnapshot={...this.state,objects:[],events:[],time:0,shots:0,undo:false,params:{...G.LabDefaults}};this.dirty=true;this.accumulator=0;this.requestKey=null;this.token=0;this.gestures=new Map();this.cameraDrags=0;
 }
 subscribe=(fn)=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)};
 snapshot=()=>this.lastSnapshot;
 notify(redraw=true){
  const s=this.state,l=this.lab,o=l?.get(s.selectedId);s.game=this.game?.snapshot()||null;s.canAim=!!l&&!this.game?.pending&&s.paused&&!l.cue&&!l.anyMotion()&&!this.windup&&performance.now()>=(this.cooldownUntil||0);s.previewCueVisible=!!l&&!this.game?.pending&&s.showCue&&s.paused&&!l.cue&&!l.anyMotion()&&performance.now()>=(this.cooldownUntil||0);s.obstruction=l&&!l.cue?l.cueObstruction(o,s.settings):null;
  this.lastSnapshot={...s,settings:{...s.settings},objects:l?l.objects.map(o=>({id:o.id,label:o.label,shape:o.shape,color:o.color,mass:o.mass,pos:{...o.body.translation()},radius:o.radius||o.half.y})):[],params:l?{...l.params}:{...G.LabDefaults},events:l?l.events.slice(-8):[],time:l?.time||0,shots:l?.shots||0,undo:this.undoStack.length>0,redo:this.redoStack.length>0,activeStroke:!!l?.cue,speed:o?len(o.body.linvel()):0,spin:o?len(o.body.angvel())*60/(2*Math.PI):0,height:o?(o.body.translation().y-(o.radius||o.half.y))*100:0,renderMode:this.renderer?.isFallback?'CPU 3D':this.renderer?.workerMode?'WebGL2 Worker':'WebGL2'};
  this.listeners.forEach(fn=>fn());if(redraw)this.dirty=true;
 }
 announce(message){this.state.notice=message;clearTimeout(this.noticeTimer);this.noticeTimer=setTimeout(()=>{this.state.notice='';this.notify()},2800);this.notify();}
 async mount(canvas,sideCanvas,handles){
  if(this.lab)return;
  this.canvas=canvas;this.sideCanvas=sideCanvas;this.handles=handles;
  try{
   await G.RAPIER.init();this.lab=new G.PhysicsLab(G.RAPIER);this.setupGame();this.repairRouteTargets();
   // Renderer selection is independent of physics. A failed WebGL context uses
   // a fresh canvas because a canvas cannot switch 2D/WebGL context types.
   try{try{this.renderer=await G.WorkerRenderer.create(canvas);}catch{this.renderer=new G.LabRenderer(canvas);}}catch(error){const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);this.canvas=canvas=fresh;this.renderer=new G.SoftwareRenderer(canvas);this.renderer.fallbackReason=String(error.message||error);}
   this.predictor=new G.PredictionService((result,meta)=>{if(!this.state.paused||!this.state.predict||this.windup)return;this.state.forecast=G.LabMath.forecastGeometry(result);this.state.predictionBusy=false;this.state.forecastStatus=`${result.seconds.toFixed(1)}초 · ${result.events.length}회 접촉${result.rested?' · 정지까지':''}`;this.forecastMeta=meta;this.notify()},error=>{this.state.predictionBusy=false;this.state.forecastStatus='예측 실패: '+error;this.notify()});
   this.optimizer=new G.OptimizerService(progress=>{this.state.routeProgress=progress;if(progress.partialResult)this.state.routeResult=progress.partialResult;this.notify(false)},result=>{this.state.routeStatus='done';this.state.routeResult=result;this.state.routeProgress=result;this.notify();this.queuePrediction()},error=>{this.state.routeStatus='error';this.state.routeError=error;this.notify();this.queuePrediction()});
   this.bindPointers();this.resizeViewport();this.resizeObserver=new ResizeObserver(()=>this.resizeViewport());this.resizeObserver.observe(canvas.parentElement);
   if(typeof matchMedia==='function'&&matchMedia('(max-width: 900px)').matches){this.renderer.setView('top');this.state.view='top';}
   if(this.renderer.workerMode)this.renderer.onInvalidate=()=>{this.dirty=true;};this.state.ready=true;this.notify();this.queuePrediction();this.last=0;this.scheduleFrame();
   G.cueLab=this;G.__LAB_READY__=true;
  }catch(error){this.state.engineError=String(error.message||error);this.notify();console.error(error)}
 }
 pause(value=true){if(!value)this.cancelSearch('실행으로 검색을 취소했습니다.',true);this.state.paused=value;this.accumulator=0;if(!value){clearTimeout(this.predictionTimer);this.predictor?.cancel();this.state.predictionBusy=false;}else this.queuePrediction();this.notify();}
 invalidate(){clearTimeout(this.predictionTimer);this.predictor?.cancel();this.requestKey=null;this.state.forecast=null;this.state.predictionBusy=false;}
 queuePrediction(force=false){
  const s=this.state,l=this.lab;if(!l||!this.predictor)return;
  if(s.routeStatus==='searching')return;
  if(!s.predict){s.forecastStatus='미리보기 꺼짐';return;}
  if(!s.paused||l.cue||this.windup||l.anyMotion()){s.forecastStatus=s.forecast?'타격 직전 예측':'공이 멈추면 다시 예측';return;}
  const o=l.get(s.selectedId);s.obstruction=l.cueObstruction(o,s.settings);
  if(!o||o.shape!=='sphere'||s.obstruction){this.invalidate();s.forecastStatus=s.obstruction?'큐 겹침을 해소하면 예측합니다':'타격할 공을 선택하세요';return;}
  const key=JSON.stringify([l.steps,l.revision,s.selectedId,s.settings,s.horizon,l.params]);if(!force&&this.requestKey===key)return;
  this.invalidate();this.requestKey=key;s.predictionBusy=true;s.forecastStatus='예상 궤적 계산 중';
  this.predictionTimer=setTimeout(()=>{if(!s.paused||this.windup||l.cue||!s.predict)return;this.predictor.request({snapshot:l.snapshot({trails:false}),selectedId:s.selectedId,settings:{...s.settings},horizon:s.horizon})},140);
 }
 adjustAngle(key,delta){if(key!=='angle'&&key!=='elevation')return;this.changeSettings({[key]:Math.round((this.state.settings[key]+delta)*100)/100});}
 changeSettings(patch,{interactive=false}={}){this.cancelSearch('타격 설정 변경으로 검색을 취소했습니다.');
  if(!this.lab||this.lab.cue||this.windup)return;
  const s=this.state.settings,limits={angle:[-180,180],elevation:[0,85],speed:[.25,5],tipX:[-.92,.92],tipY:[-.92,.92]};
  for(const [key,value]of Object.entries(patch))if(limits[key]&&Number.isFinite(value))s[key]=clamp(value,...limits[key]);
  const r=Math.hypot(s.tipX,s.tipY);if(r>.92){s.tipX*=.92/r;s.tipY*=.92/r;}
  this.redoStack=[];if(interactive){this.inputPending=true;this.dirty=true;}else{this.queuePrediction();this.notify();}
 }
 option(key,value){
  if(key==='mode'&&!['cue','place','orbit'].includes(value))return;if(key==='horizon'&&![4,8,16,30].includes(value))return;if(key==='rate'&&![.25,.5,1,2,4].includes(value))return;
  if(key==='activePanel'&&!['shot','routes','settings'].includes(value))return;
  this.state[key]=value;if(key==='mode')this.cancelGesture();if(key==='predict'||key==='horizon'){this.invalidate();this.queuePrediction();}this.notify();
 }
 select(id){if(id!==this.state.selectedId)this.cancelSearch('선택 물체가 바뀌었습니다.',true);if(!this.lab?.get(id)||this.windup)return;this.cancelGesture();this.state.selectedId=id;this.repairRouteTargets();this.queuePrediction();this.notify();}
 view(name){if(!this.renderer)return;this.cancelGesture();this.renderer.setView(name);this.state.view=name;this.notify();}
 fit(){this.view(this.state.view||'3d');}
 zoom(factor){if(!this.renderer)return;this.renderer.camera.zoom=clamp((this.renderer.camera.zoom||1)*factor,.6,2.5);this.dirty=true;this.updateHandles();}
 fire(){
  if(!this.lab||this.windup||this.lab.cue)return false;
  if(this.game?.pending){this.announce('타격 판정이 끝날 때까지 기다리세요.');return false;}
  if(this.lab.anyMotion()){this.announce('공이 움직이는 동안에는 큐가 대기합니다. 멈춘 뒤 타격하세요.');return false;}
  if(performance.now()<(this.cooldownUntil||0))return false;
  const s=this.state,key=JSON.stringify([this.lab.steps,this.lab.revision,s.selectedId,s.settings,s.horizon,this.lab.params]);
  if(!s.paused||s.predictionBusy||key!==this.requestKey)s.forecast=null;
  if(this.game&&!this.game.cueIds.includes(s.selectedId)){this.announce('흰 수구 또는 노란 수구를 선택하세요.');return false;}
  const before=this.captureHistory();const gameBefore=this.game?.snapshot();const result=this.lab.strike(s.selectedId,{...s.settings});if(!result.ok){this.announce(result.reason);return false;}
  this.commitHistory(before,'shot');
  if(this.game){this.gameUndo=gameBefore;this.game.begin(s.selectedId,{threeCushion:!!s.routeOptions.fourBallThreeCushion});}
  this.cooldownUntil=performance.now()+300;this.state.previewCueVisible=false;this.state.canAim=false;this.state.cuePull=0;this.pause(false);this.state.gesture='';this.notify();return true;
 }
 setGameMode(mode){if(!['free','four'].includes(mode)||mode===this.state.gameMode)return;this.state.gameMode=mode;this.reset();}
 setupGame(){
  this.game=null;this.gameUndo=null;this.state.routeOptions={...this.state.routeOptions,mode:'three',methods:['any'],order:'either',allowKiss:true,workers:0,elevationMode:'search',minElevation:0,maxElevation:85,fourBallThreeCushion:false,targetId:2,secondId:3};if(this.state.gameMode!=='four'){this.game=new G.ThreeBallGame([this.lab.objects[0].id,this.lab.objects[1].id],this.lab.objects.map(o=>o.id));this.lab.onEvent=e=>this.game?.contact(e);return;}
  const lab=this.lab;lab.objects[0].label='흰 수구';lab.objects[1].label='노란 수구';lab.objects[2].label='적구 1';
  const red=lab.addSphere(V(.64,D.radius+.00005,.30),'적구 2','#ed7770');
  this.game=new G.FourBallGame([lab.objects[0].id,lab.objects[1].id],[lab.objects[2].id,red.id],{threeCushion:!!this.state.routeOptions.fourBallThreeCushion});lab.onEvent=e=>this.game?.contact(e);
  this.state.routeOptions={...this.state.routeOptions,mode:'carom',targetId:lab.objects[2].id,secondId:red.id};
 }
 finishGameShot(){if(this.game?.pending&&!this.lab.cue&&this.lab.objects.every(o=>o.body.isSleeping())){const result=this.game.finish();this.state.selectedId=result.nextCue;this.repairRouteTargets();this.invalidate();this.queuePrediction(true);this.notify();}}
 reset(){this.cancelSearch('초기화되었습니다.',true);if(!this.lab)return;this.cooldownUntil=0;this.cancelGesture();this.windup=null;this.invalidate();this.lab.dispose();this.lab=new G.PhysicsLab(G.RAPIER);this.undoStack=[];this.redoStack=[];this.setupGame();Object.assign(this.state,{settings:{angle:0,elevation:8,tipX:0,tipY:0,speed:2},selectedId:1,paused:true,cuePull:0,gesture:''});this.accumulator=0;this.repairRouteTargets();this.queuePrediction();this.notify();}
 captureHistory(){if(!this.lab||this.lab.cue)return null;return{world:this.lab.snapshot(),selectedId:this.state.selectedId,settings:{...this.state.settings},paused:this.state.paused,gameMode:this.state.gameMode,game:this.game?.snapshot()||null};}
 commitHistory(before,kind='edit'){if(!before)return;this.undoStack.push({before,kind});if(this.undoStack.length>30)this.undoStack.shift();this.redoStack=[];}
 restoreHistory(saved){
  this.inputPending=false;this.invalidate();this.lab.restore(saved.world);this.lab.lastSnapshot=null;this.cooldownUntil=0;this.windup=null;this.accumulator=0;
  Object.assign(this.state,{selectedId:saved.selectedId,settings:{...saved.settings},paused:saved.paused,gameMode:saved.gameMode,cuePull:0,gesture:''});
  if(saved.game){this.game=saved.game.kind==='three'?new G.ThreeBallGame():new G.FourBallGame();this.game.restore(saved.game);}else this.game=null;
  this.lab.onEvent=e=>this.game?.contact(e);this.repairRouteTargets();this.queuePrediction();this.notify();
 }
 undo(){
  if(this.drag?.type==='ball'&&this.drag.changed){this.cancelGesture();return true;}
  this.cancelGesture();const entry=this.undoStack.pop();if(!entry)return false;
  this.cancelSearch('조작을 되돌렸습니다.',true);entry.after=this.captureHistory();this.redoStack.push(entry);this.restoreHistory({...entry.before,paused:true});return true;
 }
 redo(){
  this.cancelGesture();const entry=this.redoStack.pop();if(!entry)return false;
  this.cancelSearch('조작을 다시 적용했습니다.',true);
  if(entry.after){this.restoreHistory(entry.after);this.undoStack.push(entry);this.notify();return true;}
  // An in-flight physical cue cannot be snapshotted. Replay that authorized
  // shot from the exact pre-shot world rather than inventing an intermediate state.
  this.restoreHistory({...entry.before,paused:true});const remaining=this.redoStack.slice();const okay=this.fire();this.redoStack=remaining;if(!okay)this.redoStack.push(entry);this.notify();return okay;
 }
 step(){this.cancelSearch('물리 상태가 바뀌었습니다.',true);if(!this.lab||this.lab.cue)return;const before=this.captureHistory();this.pause(true);this.lab.step(16);this.commitHistory(before);this.invalidate();this.queuePrediction();this.notify();}
 move(id,p,{interactive=false}={}){if(this.game?.pending){this.announce('타격 판정이 끝난 뒤 배치하세요. 초기화 또는 되돌리기로 취소할 수 있습니다.');return false;}this.cancelSearch('공 배치가 바뀌었습니다.',true);if(this.lab.cue){this.announce('스트로크가 끝난 뒤 배치할 수 있습니다.');return false;}const before=interactive?null:this.captureHistory();this.state.paused=true;const okay=this.lab.move(id,p);if(okay){if(interactive){this.inputPending=true;this.dirty=true;}else{this.commitHistory(before);this.queuePrediction();this.notify()}}return okay;}
 setPosition(p){const o=this.lab?.get(this.state.selectedId);if(!o)return;const pos={...o.body.translation(),...p};if(!this.move(o.id,pos))this.announce('다른 물체와 겹치는 위치에는 놓을 수 없습니다.');}
 setHeight(cm){const o=this.lab?.get(this.state.selectedId);if(o&&Number.isFinite(cm))this.setPosition({y:(o.radius||o.half.y)+cm/100+.00005});}
 add(shape){this.cancelSearch('물체가 추가되었습니다.',true);if(this.state.gameMode==='four'||this.game?.pending)return this.announce('현재 게임에서는 공을 추가할 수 없습니다.');if(!this.lab||this.lab.cue)return;if(this.lab.objects.length>=12)return this.announce('최대 12개 물체까지 추가할 수 있습니다.');let pos;for(let z=-.4;z<.5&&!pos;z+=.16)for(let x=-1.1;x<1.1;x+=.16)if(this.lab.objects.every(o=>len(sub(o.body.translation(),V(x,.05,z)))>.13)){pos=V(x,shape==='sphere'?D.radius+.0001:.0451,z);break;}if(!pos)return;const before=this.captureHistory();this.pause(true);const o=shape==='sphere'?this.lab.addSphere(pos,'공 '+this.lab.nextId,'#7dd3fc'):this.lab.addBox(pos,'블록 '+this.lab.nextId);this.commitHistory(before);this.select(o.id);}
 remove(){if(this.state.gameMode==='four'||this.game?.pending||this.game?.objectIds?.includes(this.state.selectedId))return this.announce('게임의 기본 공은 삭제할 수 없습니다.');this.cancelSearch('물체가 삭제되었습니다.',true);if(!this.lab||this.lab.cue||this.lab.objects.length<2)return;const before=this.captureHistory();this.lab.removeObject(this.state.selectedId);this.commitHistory(before);this.select(this.lab.objects[0].id);}
 params(p){this.cancelSearch('물리 재질이 바뀌었습니다.',true);try{const before=this.captureHistory();this.lab.setParams(p);this.commitHistory(before);this.queuePrediction();this.notify()}catch(error){this.announce(error.message)}}
 clearTrails(){this.lab?.clearTrails();this.notify();}
 point(e){const r=this.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 cuePoints(){
  const o=this.lab?.get(this.state.selectedId);if(!o||o.shape!=='sphere'||this.lab.cue||!this.state.previewCueVisible)return null;
  const pose=this.lab.pose(o,this.state.settings,.012+this.state.cuePull),at=d=>sub(pose.tip,mul(pose.direction,d));
  // Project the physical cue shaft for direct rear-side aiming.
  return{pose,aim:at(1.04),grip:at(.39),rear:at(D.cueLength),front:at(.12)};
 }
 updateHandles(){this.renderer?.size();}
 resizeViewport(){
  const rect=this.canvas.getBoundingClientRect(),previous=this.viewportBounds;
  this.viewportBounds={width:rect.width,height:rect.height};
  // Folding, rotation and sidebar transitions change the pointer projection.
  // Cancel the live gesture, not the world, settings, camera or history.
  if(previous&&(previous.width!==rect.width||previous.height!==rect.height))this.interruptPointers();
  this.dirty=true;this.updateHandles();
 }
 interruptPointers(){this.gestures.clear();this.pinch=null;this.suppressTouch=false;this.cancelGesture();this.discardPendingInput();}
 beginInput(e){
  const now=performance.now();let timestamp=Number(e?.timeStamp);
  if(timestamp>now&&Number.isFinite(performance.timeOrigin))timestamp-=performance.timeOrigin;
  if(!Number.isFinite(timestamp)||timestamp<0||timestamp>now)timestamp=now;
  const input={id:++this.inputSequence,at:timestamp,handlerAt:now,kind:e?.type||'pointer',gateSkips:0};this.pendingInput=input;
  const m=this.inputMetrics;m.events++;m.lastDispatchMs=now-timestamp;m.maxDispatchMs=Math.max(m.maxDispatchMs,m.lastDispatchMs);return input;
 }
 finishInput(input){const m=this.inputMetrics;input.handlerEndedAt=performance.now();m.lastHandlerMs=input.handlerEndedAt-input.handlerAt;m.maxHandlerMs=Math.max(m.maxHandlerMs,m.lastHandlerMs);}
 discardPendingInput(){this.measuredInputSequence=this.inputSequence;this.pendingInput=null;}
 recordInputPresentation(input,boundary,trace={}){
  if(!input||input.id<=this.measuredInputSequence)return;
  this.measuredInputSequence=input.id;if(this.pendingInput?.id===input.id)this.pendingInput=null;
  const m=this.inputMetrics,canvasCompletedAt=trace.bitmapDrawCompletedAt??trace.renderCompletedAt??performance.now(),latency=Math.max(0,canvasCompletedAt-input.at);m.presented++;m.lastBoundary=boundary;m.lastInputToCanvasMs=latency;m.maxInputToCanvasMs=Math.max(m.maxInputToCanvasMs,latency);
  // Legacy aliases now end at the matching canvas rendering call, not a
  // worker request. Main-thread WebGL still excludes asynchronous GPU work;
  // no mode measures compositor/display scanout or physical device latency.
  m.lastInputToFrameMs=latency;m.maxInputToFrameMs=m.maxInputToCanvasMs;
  const sample={id:input.id,kind:input.kind,boundary,eventAt:input.at,handlerStartedAt:input.handlerAt,handlerEndedAt:input.handlerEndedAt??input.handlerAt,gateSkips:input.gateSkips,...trace,canvasCompletedAt};
  sample.dispatchMs=sample.handlerStartedAt-sample.eventAt;sample.handlerMs=sample.handlerEndedAt-sample.handlerStartedAt;sample.handlerToRenderMs=sample.renderStartedAt-sample.handlerEndedAt;sample.inputToCanvasMs=sample.canvasCompletedAt-sample.eventAt;
  m.samples.push(sample);if(m.samples.length>60)m.samples.shift();
 }
 hitCue(pt){const points=this.cuePoints();if(!points)return null;const a=this.renderer.project(points.front),b=this.renderer.project(points.rear),dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=clamp(((pt.x-a.x)*dx+(pt.y-a.y)*dy)/(den||1),0,1),distance=Math.hypot(pt.x-(a.x+t*dx),pt.y-(a.y+t*dy));if(distance>=15)return null;
  return 'aim';}
 beginCue(type,e){
  if(!this.lab||this.lab.cue||this.windup||this.lab.anyMotion()||this.pinch||this.suppressTouch)return;e.preventDefault();e.stopPropagation();this.pause(true);
  const pt=this.point(e),points=this.cuePoints();if(!points)return;const center=this.lab.get(this.state.selectedId).body.translation();
  const hit=this.renderer.planePoint(pt.x,pt.y,center.y),baseAngle=hit?Math.atan2(center.z-hit.z,center.x-hit.x)*180/Math.PI:this.state.settings.angle;
  this.drag={type:e.shiftKey?'elevation':'aim',pointer:e.pointerId,x:e.clientX,y:e.clientY,initialAngle:this.state.settings.angle,settingsBefore:{...this.state.settings},redoBefore:this.redoStack.slice(),angleOffset:normalizeAngle(this.state.settings.angle-baseAngle),elevation:this.state.settings.elevation,speed:this.state.settings.speed,moved:false};
  this.invalidate();this.state.gesture=this.drag.type==='elevation'?'큐 뒤쪽을 들어 올리는 중':'큐를 잡고 조준 중';
  e.currentTarget.setPointerCapture?.(e.pointerId);this.canvas.style.cursor='grabbing';this.notify();
 }
 pointerMove(e){
  if(e.pointerType==='touch'&&this.gestures.has(e.pointerId))this.gestures.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(this.pinch){
   e.preventDefault();const input=this.beginInput(e),points=[...this.gestures.values()];
   if(points.length>=2){const distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);this.renderer.camera.zoom=clamp(this.pinch.zoom*this.pinch.distance/Math.max(20,distance),.6,2.5);this.dirty=true;this.updateHandles();}this.finishInput(input);return;
  }
  if(this.suppressTouch&&e.pointerType==='touch')return;
  const d=this.drag;if(!d||e.pointerId!==d.pointer)return;e.preventDefault();const input=this.beginInput(e);const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>3)d.moved=true;
  if(d.type==='orbit'){this.renderer.camera.yaw-=dx*.006;this.renderer.camera.pitch=clamp(this.renderer.camera.pitch+dy*.006,.14,Math.PI/2-.001);d.x=e.clientX;d.y=e.clientY;this.state.view='';this.dirty=true;this.updateHandles();this.finishInput(input);return;}
  if(d.type==='fine-aim'){this.changeSettings({angle:normalizeAngle(d.initialAngle+dx*(this.state.fineAim?.01:.15))},{interactive:true});}
  else if(d.type==='forward-aim'){
   const pt=this.point(e),o=this.lab.get(this.state.selectedId),p=o.body.translation(),q=this.renderer.planePoint(pt.x,pt.y,p.y);
   if(q&&Math.hypot(q.x-p.x,q.z-p.z)>.04){const angle=Math.atan2(q.z-p.z,q.x-p.x)*180/Math.PI;this.changeSettings({angle:normalizeAngle((e.altKey||this.state.fineAim)?d.initialAngle+normalizeAngle(angle-d.anchorAngle)*.05:angle)},{interactive:true});}
  }
  else if(d.type==='aim'){
   const pt=this.point(e),o=this.lab.get(this.state.selectedId),c=o.body.translation(),q=this.renderer.planePoint(pt.x,pt.y,c.y);if(q&&Math.hypot(q.x-c.x,q.z-c.z)>.04)this.changeSettings({angle:normalizeAngle(d.initialAngle+normalizeAngle(Math.atan2(c.z-q.z,c.x-q.x)*180/Math.PI+d.angleOffset-d.initialAngle)*((e.altKey||this.state.fineAim)?.05:1))},{interactive:true});
  }else if(d.type==='elevation')this.changeSettings({elevation:clamp(d.elevation-dy*.36*((e.altKey||this.state.fineAim)?.05:1),0,85)},{interactive:true});
  else if(d.type==='ball'){
   if(!d.moved){this.finishInput(input);return;}const pt=this.point(e),q=this.renderer.planePoint(pt.x,pt.y,d.height);if(q&&this.move(d.id,add(q,d.offset),{interactive:true}))d.changed=true;
  }
  this.finishInput(input);
 }
 endGesture(e,canceled=false){
  const d=this.drag;if(!d||e&&e.pointerId!==undefined&&e.pointerId!==d.pointer)return;
  this.drag=null;this.canvas.style.cursor='default';this.state.gesture='';
  if(d.type==='table-tap'&&!d.moved&&!canceled){const input=this.beginInput(e);this.changeSettings({angle:d.angle},{interactive:true});this.finishInput(input);}
  if(canceled){this.discardPendingInput();if(d.settingsBefore){Object.assign(this.state.settings,d.settingsBefore);this.redoStack=d.redoBefore;this.inputPending=false;}else if(d.type==='forward-aim')this.state.settings.angle=d.initialAngle;}
  if(d.type==='ball'&&d.changed){if(canceled)this.restoreHistory(d.before);else this.commitHistory(d.before);}
  this.queuePrediction();
  this.notify();
 }
 cancelGesture(){this.endGesture(null,true);if(this.windup){this.windup=null;this.state.cuePull=0;this.state.gesture='';this.notify();}}
 beginAimPad(e){
  if(!this.state.canAim||this.state.routeStatus==='searching')return;e.preventDefault();this.pause(true);
  this.drag={type:'fine-aim',pointer:e.pointerId,x:e.clientX,y:e.clientY,initialAngle:this.state.settings.angle,settingsBefore:{...this.state.settings},redoBefore:this.redoStack.slice(),moved:false};
  this.state.gesture=this.state.fineAim?'미세 조준: 1px = 0.01°':'좌우로 밀어서 조준';e.currentTarget.setPointerCapture?.(e.pointerId);this.notify();
 }
 touchStart(e){
  if(e.pointerType!=='touch')return;
  this.gestures.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(this.gestures.size>=2){
   this.cancelGesture();this.suppressTouch=true;const p=[...this.gestures.values()];
   this.pinch={distance:Math.max(20,Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)),zoom:this.renderer.camera.zoom||1};
   this.state.gesture='두 손가락으로 확대·축소';e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture?.(e.pointerId);this.notify();
  }
 }
 touchEnd(e,canceled=false){
  this.gestures.delete(e.pointerId);
  if(this.pinch||this.suppressTouch){if(this.gestures.size<2)this.pinch=null;if(this.gestures.size===0){this.suppressTouch=false;this.state.gesture='';}this.endGesture(e,true);this.notify();return;}
  this.endGesture(e,canceled);
 }
 aimLine(){const o=this.lab?.get(this.state.selectedId);return o?.shape==='sphere'&&this.state.previewCueVisible?G.LabMath.aimGuide(o.body.translation(),this.state.settings.angle,o.radius):null;}
 hitAimLine(pt,pointerType){const line=this.aimLine();if(!line)return false;const a=this.renderer.project(line.start),b=this.renderer.project(line.end);if(a.visible===false||b.visible===false)return false;const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((pt.x-a.x)*dx+(pt.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(pt.x-a.x-t*dx,pt.y-a.y-t*dy)<=(pointerType==='touch'?22:12);}
 pointerDown(e){
  const c=this.canvas;
   if(e.button!==0&&e.button!==2)return;e.preventDefault();if(this.lab.cue||this.windup||this.pinch||this.suppressTouch)return;
   c.focus({preventScroll:true});const pt=this.point(e);c.setPointerCapture(e.pointerId);
   if(e.button===2){this.drag={type:'orbit',pointer:e.pointerId,x:e.clientX,y:e.clientY};c.style.cursor='grabbing';return;}
   const o=this.renderer.pick(this.lab.objects,pt.x,pt.y);
   if(o){
    if(this.game?.pending){this.announce('타격 판정이 끝난 뒤 공을 옮기세요. 되돌리기로 타격을 취소할 수 있습니다.');return;}
    const before=this.captureHistory();this.select(o.id);this.pause(true);this.invalidate();const pos=o.body.translation(),hit=this.renderer.planePoint(pt.x,pt.y,pos.y);
    this.drag={type:'ball',pointer:e.pointerId,id:o.id,height:pos.y,offset:hit?sub(pos,hit):V(),x:e.clientX,y:e.clientY,moved:false,changed:false,before};this.state.gesture='공을 옮기는 중 · Esc 취소';this.notify();return;
   }
   if(this.state.canAim&&this.state.routeStatus!=='searching'&&this.hitAimLine(pt,e.pointerType)){
    const p=this.lab.get(this.state.selectedId).body.translation(),q=this.renderer.planePoint(pt.x,pt.y,p.y);if(!q)return;
    this.drag={type:'forward-aim',pointer:e.pointerId,x:e.clientX,y:e.clientY,initialAngle:this.state.settings.angle,settingsBefore:{...this.state.settings},redoBefore:this.redoStack.slice(),anchorAngle:Math.atan2(q.z-p.z,q.x-p.x)*180/Math.PI,moved:false};
    this.invalidate();this.state.gesture='조준선을 드래그해 방향 조절';this.canvas.style.cursor='grabbing';this.notify(false);return;
   }
   const type=this.hitCue(pt);if(type){this.beginCue(type,e);return;}
   // Classify only at pointerdown. Crossing the rail cannot change the gesture.
   const cloth=this.renderer.planePoint(pt.x,pt.y,0),onCloth=cloth&&Math.abs(cloth.x)<=D.width/2&&Math.abs(cloth.z)<=D.depth/2;
   if(!onCloth){this.drag={type:'orbit',pointer:e.pointerId,x:e.clientX,y:e.clientY,moved:false};c.style.cursor='grabbing';this.state.gesture='바닥을 드래그해 시점 회전';this.notify(false);return;}
   const selected=this.lab.get(this.state.selectedId),q=selected&&this.renderer.planePoint(pt.x,pt.y,selected.body.translation().y);
   if(q&&this.state.canAim&&this.state.routeStatus!=='searching'){
    const p=selected.body.translation();if(Math.hypot(q.x-p.x,q.z-p.z)<=.04)return;
    const angle=Math.atan2(q.z-p.z,q.x-p.x)*180/Math.PI;
    this.drag={type:'table-tap',pointer:e.pointerId,x:e.clientX,y:e.clientY,angle:normalizeAngle(angle),moved:false};
   }
 }
 bindPointers(){
  const c=this.canvas;c.oncontextmenu=e=>e.preventDefault();
  this.touchStartListener=e=>this.touchStart(e);c.parentElement.addEventListener('pointerdown',this.touchStartListener,{capture:true,passive:false});
  c.addEventListener('pointerdown',e=>this.pointerDown(e));
  this.moveListener=e=>this.pointerMove(e);this.endListener=e=>this.touchEnd(e);this.cancelListener=e=>this.touchEnd(e,true);
  window.addEventListener('pointermove',this.moveListener,{passive:false});window.addEventListener('pointerup',this.endListener);window.addEventListener('pointercancel',this.cancelListener);
  c.addEventListener('wheel',e=>{e.preventDefault();this.renderer.camera.zoom=clamp((this.renderer.camera.zoom||1)*Math.exp(e.deltaY*.001),.6,2.5);this.dirty=true;this.updateHandles()},{passive:false});
  this.keyListener=e=>{if(e.key==='Escape'){this.cancelGesture();return;}if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||e.target.closest('dialog,[role=dialog],[role=menu],[role=slider],[role=combobox],[role=listbox],[role=tablist]'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?this.redo():this.undo();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();this.redo();return;}if(e.code==='Space'){e.preventDefault();this.fire()}else if(e.key.toLowerCase()==='p')this.pause(!this.state.paused)};
  window.addEventListener('keydown',this.keyListener);
  this.lostCaptureListener=e=>this.touchEnd(e,true);window.addEventListener('lostpointercapture',this.lostCaptureListener);
  this.blurListener=()=>this.interruptPointers();window.addEventListener('blur',this.blurListener);this.visibilityListener=()=>{if(document.hidden){this.blurListener();this.renderCadence.suspend();this.renderer?.setHidden?.(true);if(this.raf!==null)cancelAnimationFrame(this.raf);this.raf=null;}else{this.renderCadence.resume();this.renderer?.setHidden?.(false);this.last=0;this.accumulator=0;this.dirty=true;this.scheduleFrame();}};document.addEventListener('visibilitychange',this.visibilityListener);
 }
 sideDrag(e){
  if(this.lab?.cue||this.windup)return;e.preventDefault();this.pause(true);const r=e.currentTarget.getBoundingClientRect();
  // The contact remains the pivot; drag the projected rear of the cue.
  const pivot={x:r.width-38,y:r.height-25},x=e.clientX-r.left,y=e.clientY-r.top;
  this.changeSettings({elevation:clamp(Math.atan2(pivot.y-y,pivot.x-x)*180/Math.PI,0,85)});
 }
 renderSide(){
  const canvas=this.sideCanvas;if(!canvas)return;const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const dpi=Math.min(devicePixelRatio||1,2);canvas.width=r.width*dpi;canvas.height=r.height*dpi;const ctx=canvas.getContext('2d');ctx.setTransform(dpi,0,0,dpi,0,0);
  const w=r.width,h=r.height,e=this.state.settings.elevation*Math.PI/180,cx=w-38,cy=h-25,length=Math.min(w-60,h*1.1),bx=cx-Math.cos(e)*length,by=cy-Math.sin(e)*length;
  ctx.fillStyle='#0b1220';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#33504a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(14,cy+10);ctx.lineTo(w-14,cy+10);ctx.stroke();
  ctx.strokeStyle='#66758b';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(cx-length,cy);ctx.lineTo(cx,cy);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#93c5fd';ctx.beginPath();ctx.arc(cx,cy,28,Math.PI,Math.PI+e);ctx.stroke();
  ctx.strokeStyle='#c9ae81';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(cx-10*Math.cos(e),cy-10*Math.sin(e));ctx.stroke();
  ctx.fillStyle='#f5f4e8';ctx.beginPath();ctx.arc(cx,cy,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0f172a';ctx.beginPath();ctx.arc(bx,by,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#cbd5e1';ctx.lineWidth=1.5;ctx.stroke();
  ctx.font='10px system-ui';ctx.fillStyle='#94a3b8';ctx.fillText('큐 뒤쪽을 잡고 기울이기',12,16);ctx.fillStyle='#e2e8f0';ctx.fillText(this.state.settings.elevation.toFixed(2)+'°',12,h-11);
 }
 renderedFrames(){return this.renderer?.fallback?(this.renderer.metrics.frames||0)+(this.renderer.fallback.completedFrames||0):this.renderer?.workerMode?this.renderer.metrics.frames:(this.renderer?.completedFrames||0);}
 scheduleFrame(){if(this.disposed||this.raf!==null||document.hidden)return;this.raf=requestAnimationFrame(t=>{this.raf=null;this.frame(t);});}
 frame(t){
  if(!this.lab||this.disposed||document.hidden)return;const rafEnteredAt=performance.now(),elapsed=this.last?Math.min(.06,(t-this.last)/1000):0;this.last=t;
  if(!this.state.paused&&!this.drag){this.accumulator+=elapsed*this.state.rate;let n=0;while(this.accumulator>=this.lab.dt&&n<384){this.lab.step();this.accumulator-=this.lab.dt;n++;}if(n===384)this.accumulator=0;this.dirty=true;if(!this.lab.cue&&this.lab.objects.every(o=>o.body.isSleeping())){this.state.paused=true;this.queuePrediction(true);}}
  if(this.inputPending){this.inputPending=false;this.notify();}
  this.finishGameShot();
  const visible=!this.game?.pending&&this.state.showCue&&this.state.paused&&!this.lab.cue&&!this.lab.anyMotion()&&t>=(this.cooldownUntil||0);if(visible!==this.state.previewCueVisible)this.notify();
  if(t-(this.lastUI||0)>120&&(!this.state.paused||this.state.gesture||this.windup)){this.notify();this.lastUI=t;}
  this.renderMetrics.cap=this.renderer.isFallback?30:60;
  if(this.dirty||this.renderer.needsFrame){if(this.renderCadence.allow(t,this.renderMetrics.cap)){const before=this.renderedFrames(),input=this.pendingInput,renderStartedAt=performance.now(),presentation=this.renderer.render(this.lab,this.state,{update:this.dirty,input}),renderCompletedAt=performance.now();if(this.renderedFrames()>before){this.renderMetrics.presentations++;this.recordInputPresentation(this.renderer.tracksPresentation?presentation?.input:input,this.renderer.isFallback?'cpu-render':this.renderer.workerMode?'worker-bitmap-draw':'webgl-command-submit',{rafTimestamp:t,rafEnteredAt,renderStartedAt,renderCompletedAt,renderer:this.renderer.isFallback?{...(this.renderer.fallback||this.renderer).frameTiming}:null,...presentation?.trace});}this.renderSide();this.updateHandles();this.dirty=false;this.lastDraw=t;this.renderMetrics.frames++;}else if(this.pendingInput)this.pendingInput.gateSkips++;}
  this.scheduleFrame();
 }
 dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.raf=null;this.renderCadence.suspend();clearTimeout(this.predictionTimer);clearTimeout(this.noticeTimer);this.predictor?.dispose();this.optimizer?.dispose();this.renderer?.dispose?.();this.resizeObserver?.disconnect();this.lab?.dispose();window.removeEventListener('pointermove',this.moveListener);window.removeEventListener('pointerup',this.endListener);window.removeEventListener('pointercancel',this.cancelListener);window.removeEventListener('keydown',this.keyListener);this.canvas?.parentElement.removeEventListener('pointerdown',this.touchStartListener,true);window.removeEventListener('lostpointercapture',this.lostCaptureListener);window.removeEventListener('blur',this.blurListener);document.removeEventListener('visibilitychange',this.visibilityListener);this.lab=null;}

 worldStamp(){return this.lab?JSON.stringify([this.lab.steps,this.lab.revision,this.lab.time,this.state.selectedId,this.lab.params,this.lab.objects.map(o=>[o.id,o.body.translation(),o.body.rotation()])]):'';}
 cancelSearch(reason='검색을 취소했습니다.',invalidate=false){
  const running=this.state.routeStatus==='searching';
  if(running){this.optimizer?.cancel();this.state.routeStatus='canceled';this.state.routeError=reason;}
  if(invalidate&&this.state.routeResult){this.state.routeResult={...this.state.routeResult,continuable:false};this.state.routeStatus='stale';this.state.routeError=reason;this.state.routeApplied=null;}
 }
 repairRouteTargets(){
  if(!this.lab)return;const o=this.state.routeOptions;
  // Inspecting or moving a red ball must never replace the game's two red targets.
  const ids=this.state.gameMode==='four'&&this.game?this.game.redIds.filter(id=>this.lab.get(id)):this.game?.objectIds?this.game.objectIds.filter(id=>id!==this.state.selectedId&&this.lab.get(id)):this.lab.objects.filter(o=>o.shape==='sphere'&&o.id!==this.state.selectedId).map(o=>o.id);
  const targetId=ids.includes(o.targetId)?o.targetId:(ids[0]??0),secondId=ids.includes(o.secondId)&&o.secondId!==targetId?o.secondId:(ids.find(id=>id!==targetId)??0);
  this.state.routeOptions={...o,targetId,secondId};
 }
 routeOption(key,value){
  if(!Object.hasOwn(this.state.routeOptions,key))return;
  this.cancelSearch('검색 조건이 바뀌었습니다.',true);this.state.routeOptions={...this.state.routeOptions,[key]:value};if(key==='targetId')this.repairRouteTargets();this.notify();
 }
 startSearch(){
  if(!this.lab||this.lab.cue||this.windup||this.game?.pending||this.lab.anyMotion())return this.announce('모든 물체가 멈춘 뒤 경로를 검색하세요.');
  if(this.game&&!this.game.cueIds.includes(this.state.selectedId)){this.state.routeStatus='error';this.state.routeError='흰 수구 또는 노란 수구를 선택하세요.';this.notify();return;}
  const gameRules=this.state.gameMode==='four'&&this.game?{gameMode:'four',opponentId:this.game.cueIds.find(id=>id!==this.state.selectedId)}:{gameMode:'free',opponentId:null};
  const req={snapshot:this.lab.snapshot({trails:false}),selectedId:this.state.selectedId,settings:{...this.state.settings},options:{...this.state.routeOptions,...gameRules}};
  try{G.LabInversePlanner.validate(req)}catch(e){this.state.routeError=e.message;this.state.routeStatus='error';this.notify();return;}
  this.state.paused=true;this.invalidate();this.routeStamp=this.worldStamp();this.routeRequestStamp=JSON.stringify([this.state.routeOptions,this.state.settings]);this.state.routeStatus='searching';this.state.routeResult=null;this.state.routeError='';this.state.routeApplied=null;this.state.routeProgress={tested:0,evaluated:0,rejected:0,total:null,topologiesResolved:0,rootIterations:0,found:0};
  this.optimizer.request(req);this.notify();
 }
 resumeSearch(){
  if(!['done','canceled'].includes(this.state.routeStatus)||this.worldStamp()!==this.routeStamp||this.routeRequestStamp!==JSON.stringify([this.state.routeOptions,this.state.settings]))return this.announce('배치나 조건이 바뀌었습니다. 새로 계산하세요.');
  if(this.optimizer?.resume()){this.state.routeStatus='searching';this.state.routeError='';this.notify();}
 }
 stopSearch(){
  if(this.state.routeStatus==='searching'){
   this.optimizer?.cancel();this.state.routeStatus='done';
   this.state.routeResult=this.state.routeResult||{...this.state.routeProgress,results:[],options:{...this.state.routeOptions}};
   this.state.routeResult={...this.state.routeResult,partial:true};this.state.routeError='';
  }this.queuePrediction();this.notify();
 }
 applyRoute(id){
  if(!['done','searching'].includes(this.state.routeStatus)||this.worldStamp()!==this.routeStamp)return this.announce('배치나 물리 상태가 바뀌었습니다. 다시 검색하세요.');
  const result=this.state.routeResult?.results.find(r=>r.id===id);if(!result)return;if(this.state.routeStatus==='searching')this.stopSearch();
  this.state.predict=true;this.state.horizon=this.state.routeOptions.horizon;this.state.paused=true;this.changeSettings(result.settings);this.state.routeApplied=id;this.notify();this.announce('후보 '+id+'의 경로와 타격 설정을 적용했습니다. 타격은 직접 실행하세요.');
 }
 render(){this.notify();this.queuePrediction();this.dirty=true;this.scheduleFrame();}
 requestPrediction(){this.queuePrediction(true);this.notify();}
 setPause(p){this.pause(p)}
 advanceSeconds(s){this.pause(true);this.lab.step(Math.round(s/this.lab.dt));this.render();}
}
G.LabController=LabController;
})(globalThis);
