'use strict';
async function pixelChecks(page, {baseline, candidate, fixtures}) {
 return page.evaluate(async({baseline,candidate,fixtures})=>{
  await RAPIER.init();(0,eval)(baseline);const B=LabRenderer;(0,eval)(candidate);const C=LabRenderer;
  const records=[];const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
  for(const fixture of fixtures){
   const snapshot=structuredClone(fixture.request.snapshot);snapshot.world=Uint8Array.from(atob(snapshot.worldBase64),c=>c.charCodeAt(0));
   const lab=PhysicsLab.fromSnapshot(RAPIER,snapshot);const canvases=[document.createElement('canvas'),document.createElement('canvas')];canvases.forEach(c=>{c.width=640;c.height=480;document.body.append(c);});const rs=[new B(canvases[0]),new C(canvases[1])];
   for(const r of rs){r.viewportSize={width:640,height:480,dpr:1};r.__depthCalls=0;const orig=r.drawCommands;r.drawCommands=function(cmds,p,...args){if(p===this.depth)this.__depthCalls++;return orig.call(this,cmds,p,...args);};}
   const state={selectedId:fixture.request.selectedId,settings:{...fixture.request.settings},showCue:false,previewCueVisible:false,predict:false,paths:false,vectors:false,debug:false};
   async function capture(name, mutate, expectation){if(mutate)await mutate();const before=rs.map(r=>r.__depthCalls);for(const r of rs)r.render(lab,state);const pix=rs.map(r=>{const gl=r.gl,a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;});let mismatches=0,maxDifference=0;for(let i=0;i<Math.max(pix[0].length,pix[1].length);i++){if(pix[0][i]!==pix[1][i])mismatches++;maxDifference=Math.max(maxDifference,Math.abs((pix[0][i]||0)-(pix[1][i]||0)));}const colorCounts=pix.map(p=>{const colors=new Set();for(let i=0;i<p.length&&colors.size<32;i+=4)colors.add(p[i]+','+p[i+1]+','+p[i+2]+','+p[i+3]);return colors.size;});const calls=rs.map((r,i)=>r.__depthCalls-before[i]);records.push({fixture:fixture.name,name,expectation,depthCalls:calls,hashes:await Promise.all(pix.map(hash)),bytes:pix.map(p=>p.length),colorCounts,mismatches,maxDifference,pass:mismatches===0&&colorCounts.every(n=>n>=4)&&calls[0]===1&&(expectation==='hit'?calls[1]===0:calls[1]===1)});}
   await capture('initial',null,'miss');await capture('repeat',null,'hit');
   await capture('camera-yaw',()=>rs.forEach(r=>r.camera.yaw+=.24),'hit');await capture('camera-pitch-zoom',()=>rs.forEach(r=>{r.camera.pitch-=.12;r.camera.zoom=1.12;}),'hit');
   const ball=lab.objects.find(o=>o.id===state.selectedId)||lab.objects[0],original=ball.body.translation();
   await capture('ball-translation',()=>ball.body.setTranslation({...original,x:original.x+.08},true),'miss');
   await capture('ball-rotation',()=>ball.body.setRotation({x:0,y:Math.sin(.15),z:0,w:Math.cos(.15)},true),'miss');
   await capture('preview-cue-on',()=>state.previewCueVisible=true,'miss');await capture('cue-angle',()=>state.settings.angle+=7,'miss');
   await capture('cue-pull',()=>state.cuePull=.02,'miss');await capture('preview-cue-off',()=>state.previewCueVisible=false,'miss');
   await capture('static-body-transform',()=>{const o=lab.statics.find(o=>o.kind==='wood')||lab.statics[0];const p=o.body.translation();o.body.setTranslation({...p,y:p.y+.01},true);},'miss');
   await capture('material-color',()=>ball.color='#ff88aa','hit');
   await capture('light-matrix',()=>rs.forEach(r=>r.light[12]+=.015),'miss');
   await capture('resize',()=>rs.forEach(r=>r.viewportSize={width:720,height:520,dpr:1}),'miss');
   await capture('init-resource-rebuild',()=>rs.forEach(r=>r.init()),'miss');
   await capture('camera-after-init',()=>rs.forEach(r=>r.camera.yaw+=.12),'hit');
   const exts=rs.map(r=>r.gl.getExtension('WEBGL_lose_context'));
   if(exts.every(Boolean)){
    const events=[];for(let i=0;i<2;i++){const canvas=canvases[i];events.push(new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('context restoration timeout')),10000);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();setTimeout(()=>exts[i].restoreContext(),50);},{once:true});canvas.addEventListener('webglcontextrestored',()=>{clearTimeout(timeout);resolve();},{once:true});}));exts[i].loseContext();}
    await Promise.all(events);await capture('test-managed-context-restore-init',()=>rs.forEach(r=>{r.staticCache=new WeakMap();r.init();}),'miss');await capture('camera-after-context-restore',()=>rs.forEach(r=>r.camera.yaw+=.11),'hit');
   }else records.push({fixture:fixture.name,name:'test-managed-context-restore-init',supported:false,pass:null});
   await capture('restore-and-actual-cue',()=>{lab.restore(snapshot);state.settings={...fixture.request.settings};state.showCue=true;const shot=lab.strike(state.selectedId,state.settings);if(!shot.ok)throw Error('Pixel actual-cue strike refused');},'miss');
   await capture('actual-cue-motion',()=>lab.step(),'miss');
   await capture('actual-cue-hidden',()=>state.showCue=false,'miss');
   lab.dispose();canvases.forEach(c=>c.remove());
  }
  return{records,pass:records.every(r=>r.pass!==false),contextNote:'Test explicitly permits restore and reinitializes both classes; existing product recovery is not asserted.',presentationNote:'Exact framebuffer RGBA, not screenshot or actual display presentation.'};
 },{baseline,candidate,fixtures});
}
module.exports={pixelChecks};
