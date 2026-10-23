/* CPU 3D rasterizer fallback for webviews that do not provide WebGL.
 * Uses the same body transforms, geometry, camera and depth testing.
 * Physics remains the identical Rapier WebAssembly world.
 */
(function(G){
'use strict';
const {V,add,sub,mul,dot,cross,len,norm,rotate,qident,qfromY,matrix,clamp}=G.LabMath,D=G.LabDimensions;
const hex=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
class SoftwareRenderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw new Error('Canvas 렌더러를 시작할 수 없습니다.');this.camera={yaw:.12,pitch:.86,zoom:1,size:1.20,projection:"perspective",target:V(-.12,-.035,0)};this.staticCache=new WeakMap();this.isFallback=true;this.sphere=this.makeSphere(26,16);this.box=this.makeBox();this.cylinder=this.makeCylinder(1,1,24);this.bufferCanvas=document.createElement('canvas');this.bufferContext=this.bufferCanvas.getContext('2d',{alpha:false});this.light=norm(V(3,6,4));this.lastDraw=0;}
 mesh(vertices){return{vertices:new Float32Array(vertices),count:vertices.length/6};}
 command(mesh,pos,rot,scale,color,material=0,selected=0){return{mesh,pos,rot,model:matrix(pos,rot,scale),scale,color:typeof color==='string'?hex(color):color.map(x=>x*255),material,selected};}
 prepare(){
  this.size();const ratio=Math.min(1.5,1600/this.width);const w=Math.round(this.width*ratio),h=Math.round(this.height*ratio);
  if(this.pw!==w||this.ph!==h){this.pw=w;this.ph=h;this.bufferCanvas.width=w;this.bufferCanvas.height=h;this.image=this.bufferContext.createImageData(w,h);this.zbuffer=new Float32Array(w*h);}
  this.zbuffer.fill(Infinity);const p=this.image.data;for(let i=0;i<p.length;i+=4){p[i]=8;p[i+1]=13;p[i+2]=20;p[i+3]=255;}
 }
 vertex(x,y,z,nx,ny,nz,c){const m=c.model,world=V(m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]);const n=norm(rotate(c.rot,V(nx/c.scale.x,ny/c.scale.y,nz/c.scale.z))),p=this.project(world);return{x:p.x*this.pw/this.width,y:p.y*this.ph/this.height,z:p.depth,n,local:V(x,y,z),world};}
 trianglePixels(a,b,c,cmd){
  const W=this.pw,H=this.ph,area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(area)<.0001)return;
  const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(W-1,Math.ceil(Math.max(a.x,b.x,c.x))),minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(H-1,Math.ceil(Math.max(a.y,b.y,c.y)));
  if(maxX<minX||maxY<minY)return;
  const inv=1/area,ax=(b.y-c.y)*inv,ay=(c.x-b.x)*inv,bx=(c.y-a.y)*inv,by=(a.x-c.x)*inv;
  const data=this.image.data,depth=this.zbuffer,L=this.light,base=cmd.color,material=cmd.material;
  const flat=material!==2;const normal=norm(add(add(a.n,b.n),c.n));const flatLight=.48+.65*Math.max(0,dot(normal,L));
  for(let y=minY;y<=maxY;y++){
   let u=((b.x-(minX+.5))*(c.y-(y+.5))-(b.y-(y+.5))*(c.x-(minX+.5)))*inv;
   let v=((c.x-(minX+.5))*(a.y-(y+.5))-(c.y-(y+.5))*(a.x-(minX+.5)))*inv;
   for(let x=minX;x<=maxX;x++,u+=ax,v+=bx){const k=1-u-v;if(u<-.00001||v<-.00001||k<-.00001)continue;const perspective=this.camera.projection!=='orthographic';const denom=perspective?u/a.z+v/b.z+k/c.z:1;const z=perspective?1/denom:u*a.z+v*b.z+k*c.z,idx=y*W+x;if(z<=.03||z>=depth[idx])continue;const U=perspective?u/a.z/denom:u,VV=perspective?v/b.z/denom:v,K=perspective?k/c.z/denom:k;
    let r=base[0],g=base[1],bcol=base[2],illum=flatLight,spec=0;
    if(!flat){const n=norm(V(U*a.n.x+VV*b.n.x+K*c.n.x,U*a.n.y+VV*b.n.y+K*c.n.y,U*a.n.z+VV*b.n.z+K*c.n.z));illum=.48+.65*Math.max(0,dot(n,L));const half=norm(sub(L,this.forward));spec=Math.pow(Math.max(0,dot(n,half)),85)*110;const lx=U*a.local.x+VV*b.local.x+K*c.local.x,ly=U*a.local.y+VV*b.local.y+K*c.local.y,lz=U*a.local.z+VV*b.local.z+K*c.local.z;if(Math.max(Math.abs(lx),Math.abs(ly),Math.abs(lz))>.983){[r,g,bcol]=base[2]>180?[145,58,42]:[237,244,224];}}
    if(material===4){const alpha=cmd.alpha||.12;const j=idx*4;data[j]=data[j]*(1-alpha)+r*alpha;data[j+1]=data[j+1]*(1-alpha)+g*alpha;data[j+2]=data[j+2]*(1-alpha)+bcol*alpha;continue;}
    if(material===3){illum=.82;}
    depth[idx]=z;const j=idx*4;data[j]=Math.min(255,r*illum+spec);data[j+1]=Math.min(255,g*illum+spec);data[j+2]=Math.min(255,bcol*illum+spec);
   }
  }
 }
 drawCommand(c){const p=c.mesh.vertices;for(let i=0;i<p.length;i+=18){const a=this.vertex(...p.subarray(i,i+6),c),b=this.vertex(...p.subarray(i+6,i+12),c),d=this.vertex(...p.subarray(i+12,i+18),c);if(a.z<=.03||b.z<=.03||d.z<=.03)continue;const view=norm(sub(a.world,this.eye));if(dot(add(add(a.n,b.n),d.n),view)>.001)continue;this.trianglePixels(a,b,d,c);}}
 worldLine(points,color,strip=false,alpha=1){const ctx=this.ctx;ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=1.3;ctx.beginPath();for(let i=0;i<points.length;i+=3){const p=this.project(V(points[i],points[i+1],points[i+2]));if(i===0||(!strip&&(i/3)%2===0))ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();ctx.globalAlpha=1;}
 render(lab,state){
  this.prepare();const cmds=[];
  for(const o of lab.statics)cmds.push(this.command(o.shape==='convex'?this.convexMesh(o):o.shape==='cushion'?this.cushionMesh(o):this.box,o.body.translation(),o.body.rotation(),o.half||V(1,1,1),o.color,o.kind==='cloth'?1:o.kind==='floor'?3:0));
  for(const o of lab.objects)cmds.push(this.command(o.shape==='sphere'?this.sphere:this.box,o.body.translation(),o.body.rotation(),o.shape==='sphere'?V(o.radius,o.radius,o.radius):o.half,o.color,o.shape==='sphere'?2:0));
  for(let i=1;i<8;i++)for(const z of [-D.depth/2-.11,D.depth/2+.11])cmds.push(this.command(this.sphere,V(-D.width/2+D.width*i/8,.071,z),qident(),V(.006,.001,.006),'#e4d4a5'));
  for(let i=1;i<4;i++)for(const x of [-D.width/2-.11,D.width/2+.11])cmds.push(this.command(this.sphere,V(x,.071,-D.depth/2+D.depth*i/4),qident(),V(.006,.001,.006),'#e4d4a5'));
  const o=lab.get(state.selectedId);let preview;
  if(lab.cue&&state.showCue)cmds.push(...this.cueCommands(lab.cue.body.translation(),lab.cue.body.rotation(),'#bb9969',lab.cue.head.translation(),lab.cue.head.rotation()));
  else if(o&&o.shape==='sphere'&&state.previewCueVisible){preview=lab.pose(o,state.settings,.012+(state.cuePull||0));cmds.push(...this.cueCommands(preview.tip,preview.rotation,state.obstruction?'#b96353':'#c3a170'));cmds.push(this.command(this.sphere,preview.contact,qident(),V(.0024,.0024,.0024),'#a7f3d0'));}
  for(const c of cmds)this.drawCommand(c);
  // Finite planar shadows; depth-tested against the actual 3D geometry.
  for(const ball of lab.objects){const pos=ball.body.translation(),inTable=Math.abs(pos.x)<D.width/2&&Math.abs(pos.z)<D.depth/2,y=inTable?.001:-.779,r=ball.radius||.045,h=Math.max(0,pos.y-y-r);for(const mult of [1.6,1.25,1]){const center=V(pos.x-h*.23,y,pos.z-h*.16),points=[];for(let i=0;i<24;i++){const a=i/24*2*Math.PI,b=(i+1)/24*2*Math.PI;for(const p of [center,add(center,V(Math.cos(a)*r*mult,0,Math.sin(a)*r*mult)),add(center,V(Math.cos(b)*r*mult,0,Math.sin(b)*r*mult))])points.push(p.x,p.y,p.z,0,1,0);}const c=this.command(this.mesh(points),V(),qident(),V(1,1,1),'#061b1c',4);c.alpha=.13/(1+h*3);this.drawCommand(c);}}
  this.bufferContext.putImageData(this.image,0,0);const dpi=this.canvas.width/this.width;this.ctx.setTransform(dpi,0,0,dpi,0,0);this.ctx.drawImage(this.bufferCanvas,0,0,this.width,this.height);
  if(state.predict&&state.forecast)for(const track of state.forecast.tracks){this.worldLine(track.segments,track.color,false,.90);this.worldLine(track.endRing,track.color,true,.70);}
  if(state.paths)for(const body of lab.objects)this.worldLine(body.trail.flatMap(p=>[p.x,p.y,p.z]),body.color,true,.64);
  if(o){const p=o.body.translation(),r=(o.radius||.045)+.012,arr=[];for(let i=0;i<=64;i++){const t=i/64*Math.PI*2;arr.push(p.x+r*Math.cos(t),p.y-(o.radius||o.half.y)+.002,p.z+r*Math.sin(t));}this.worldLine(arr,'#a7f3d0',true,.85);}
  if(preview&&!state.forecast){const p=o.body.translation(),flat=norm(V(preview.direction.x,0,preview.direction.z)),arr=[];for(let i=1;i<10;i++){const a=add(p,mul(flat,.075*i)),b=add(p,mul(flat,.075*i+.038));arr.push(a.x,a.y,a.z,b.x,b.y,b.z);}this.worldLine(arr,'#bde5c1',false,.5);}
  if(state.debug){const d=lab.world.debugRender();this.worldLine(Array.from(d.vertices),'#8ccbe0',false,.65);}
  this.completedFrames=(this.completedFrames||0)+1;
  if(state.vectors)for(const body of lab.objects){const p=body.body.translation(),q=add(p,mul(body.body.linvel(),.14));this.worldLine([p.x,p.y,p.z,q.x,q.y,q.z],'#a7f3d0',false,1);}
 }
}
for(const m of ['triangle','makeSphere','makeBox','makeCylinder','cushionMesh','convexMesh','size','project','ray','planePoint','pick','setView','cueCommands'])SoftwareRenderer.prototype[m]=G.LabRenderer.prototype[m];
G.SoftwareRenderer=SoftwareRenderer;
})(globalThis);
