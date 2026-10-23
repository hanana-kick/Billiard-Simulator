/* Main thread keeps UI/hit testing. One worker frame in flight, latest state wins. */
(function(G){
'use strict';
class WorkerRenderer {
 static async create(canvas){
  if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')throw Error('OffscreenCanvas unavailable');
  const code=['math','renderer','render-worker'].map(n=>document.getElementById('source-'+n)?.textContent||'').join('\n');
  const url=URL.createObjectURL(new Blob(['globalThis.LabDimensions='+JSON.stringify(G.LabDimensions)+';\n',code],{type:'text/javascript'}));let worker;
  try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
  try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Render worker startup timeout')),5000);worker.onmessage=({data})=>{clearTimeout(timer);data.type==='ready'?resolve():reject(Error(data.error||'Render worker failed'));};worker.onerror=e=>{clearTimeout(timer);e.preventDefault();reject(Error(e.message));};worker.postMessage({type:'init'});});return new WorkerRenderer(canvas,worker);}catch(e){worker.terminate();throw e;}
 }
 constructor(canvas,worker){this.canvas=canvas;this.worker=worker;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx){worker.terminate();throw Error('Bitmap presentation unavailable');}this.camera={yaw:.12,pitch:.86,zoom:1,size:1.20,projection:'perspective',target:G.LabMath.V(-.12,-.035,0)};this.workerMode=true;this.sequence=0;this.inFlight=false;this.pending=null;this.metrics={frames:0,renderMs:0,serializeMs:0};
 worker.onmessage=({data})=>{if(this.disposed||this.hidden){data.bitmap?.close();clearTimeout(this.timer);this.inFlight=false;return;}if(data.type==='error'){this.fail(data.error);return;}if(data.type!=='frame')return;clearTimeout(this.timer);if(data.id!==this.sequence){data.bitmap?.close();return;}this.readyBitmap?.close();this.readyBitmap=data.bitmap;this.metrics.renderMs=data.renderMs;this.inFlight=false;};
 worker.onerror=e=>{e.preventDefault();this.fail(e.message);};
 }
 get needsFrame(){return !this.hidden&&(!!this.readyBitmap||!!this.pending&&!this.inFlight);}
 setHidden(value){this.hidden=value;if(value){this.readyBitmap?.close();this.readyBitmap=null;}else this.onInvalidate?.();}
 fail(reason){clearTimeout(this.timer);this.worker?.terminate();this.worker=null;this.readyBitmap?.close();this.readyBitmap=null;this.inFlight=false;this.workerMode=false;this.isFallback=true;this.fallbackReason=String(reason);this.fallback=new G.SoftwareRenderer(this.canvas);this.fallback.camera=this.camera;this.pending=this.lastFrame;this.onInvalidate?.();}
 render(lab,state,{update=true}={}){if(this.disposed||this.hidden)return;this.lastFrame=[lab,state];if(this.fallback){this.pending=null;this.fallback.camera=this.camera;this.fallback.render(lab,state);return;}
  if(this.readyBitmap){this.ctx.drawImage(this.readyBitmap,0,0,this.canvas.width,this.canvas.height);this.readyBitmap.close();this.readyBitmap=null;this.metrics.frames++;}
  if(update)this.pending=[lab,state];if(this.inFlight||!this.pending)return;[lab,state]=this.pending;this.pending=null;
  this.size();const started=performance.now(),serialize=o=>({id:o.id,kind:o.kind,label:o.label,shape:o.shape,color:o.color,radius:o.radius,half:o.half,vertices:o.vertices,indices:o.indices,position:{...o.body.translation()},rotation:{...o.body.rotation()},velocity:o.body.linvel?{...o.body.linvel()}:null,trail:state.paths?G.LabMath.visibleTrail(o,lab,state):[]});
  const selected=lab.get(state.selectedId),preview=selected&&selected.shape==='sphere'&&state.previewCueVisible?lab.pose(selected,state.settings,.012+(state.cuePull||0)):null;
  const message={type:'frame',id:++this.sequence,size:{width:this.width,height:this.height,dpr:Math.min(G.devicePixelRatio||1,2)},camera:this.camera,objects:lab.objects.map(serialize),preview,cue:lab.cue?{body:serialize({body:lab.cue.body}),head:serialize({body:lab.cue.head})}:null,debug:state.debug?lab.world.debugRender().vertices:null,state:{selectedId:state.selectedId,showCue:state.showCue,previewCueVisible:state.previewCueVisible,obstruction:state.obstruction,predict:state.predict,forecast:state.forecast,paths:state.paths,allPaths:true,debug:state.debug,vectors:state.vectors,settings:state.settings,cuePull:state.cuePull}};
  if(this.staticLab!==lab){message.statics=lab.statics.map(serialize);this.staticLab=lab;}
  this.metrics.serializeMs=performance.now()-started;this.inFlight=true;this.timer=setTimeout(()=>this.fail('Render worker stalled'),5000);try{this.worker.postMessage(message);}catch(e){this.fail(e.message);}
 }
 dispose(){this.disposed=true;this.readyBitmap?.close();this.readyBitmap=null;clearTimeout(this.timer);this.worker?.terminate();this.worker=null;this.pending=this.lastFrame=null;}
}
for(const key of ['size','project','ray','planePoint','pick','setView'])WorkerRenderer.prototype[key]=G.LabRenderer.prototype[key];
G.WorkerRenderer=WorkerRenderer;
})(globalThis);
