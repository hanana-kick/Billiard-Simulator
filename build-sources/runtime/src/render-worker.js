/* Rendering only: no simulation or gameplay decisions run here. */
let renderer,statics=[];
const body=s=>({translation:()=>s.position,rotation:()=>s.rotation,linvel:()=>s.velocity||{x:0,y:0,z:0}});
const object=s=>({...s,body:body(s)});
onmessage=({data:m})=>{try{
 if(m.type==='init'){renderer=new LabRenderer(new OffscreenCanvas(1,1));postMessage({type:'ready'});return;}
 if(m.type!=='frame'||!renderer)return;
 const start=performance.now();renderer.viewportSize=m.size;renderer.camera=m.camera;
 if(m.statics)statics=m.statics.map(object);
 const objects=m.objects.map(object),lab={statics,objects,get:id=>objects.find(o=>o.id===id),pose:()=>m.preview,cue:m.cue?{body:body(m.cue.body),head:body(m.cue.head)}:null,world:{debugRender:()=>({vertices:m.debug||[]})}};
 renderer.render(lab,m.state);const bitmap=renderer.canvas.transferToImageBitmap();postMessage({type:'frame',id:m.id,bitmap,renderMs:performance.now()-start},[bitmap]);
 }catch(error){postMessage({type:'error',error:String(error.message||error)});}
};
