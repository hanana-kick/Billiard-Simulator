/* WebGL2 renderer. Displays body transforms only; it does not calculate motion. */
(function(G){
'use strict';
const {V,add,sub,mul,dot,cross,len,norm,rotate,qident,qfromY,matrix,multiply,lookAt,ortho,perspective,clamp}=G.LabMath;
const D=G.LabDimensions;
const hex=s=>[parseInt(s.slice(1,3),16)/255,parseInt(s.slice(3,5),16)/255,parseInt(s.slice(5,7),16)/255];
class LabRenderer{
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});
  if(!this.gl)throw new Error('WebGL 2를 지원하는 브라우저가 필요합니다. 하드웨어 가속 설정을 확인하세요.');
  this.camera={yaw:.12,pitch:.86,zoom:1,size:1.20,projection:"perspective",target:V(-.12,-.035,0)};this.staticCache=new WeakMap();
  this.init();
 }
 program(v,f){const gl=this.gl;function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;
 }
 init(){
  const gl=this.gl;
  this.main=this.program(`#version 300 es
   precision highp float;
   layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;
   uniform mat4 uModel,uVP,uLight;uniform vec3 uScale;
   out vec3 vNormal,vWorld,vLocal;out vec4 vShadow;
   void main(){vec4 p=uModel*vec4(aPosition,1.);vWorld=p.xyz;vLocal=aPosition;vNormal=normalize(mat3(uModel)*(aNormal/(uScale*uScale)));vShadow=uLight*p;gl_Position=uVP*p;}`,`#version 300 es
   precision highp float;
   in vec3 vNormal,vWorld,vLocal;in vec4 vShadow;
   uniform vec3 uColor,uEye;uniform float uMaterial,uSelected;uniform sampler2D uShadow;
   out vec4 frag;
   float shadow(){vec3 p=vShadow.xyz/vShadow.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return 1.;float vis=0.;float bias=max(.00012,.00045*(1.-dot(normalize(vNormal),normalize(vec3(3.,6.,4.)))));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float d=texture(uShadow,p.xy+vec2(float(x),float(y))/1024.).r;vis+=p.z-bias>d?.32:1.;}return vis/9.;}
   void main(){vec3 color=uColor;vec3 n=normalize(vNormal),l=normalize(vec3(3.,6.,4.));
    if(uMaterial>0.5&&uMaterial<1.5){float grain=sin(vWorld.x*1800.)*sin(vWorld.z*1700.);color*=1.+grain*.025;}
    if(uMaterial>1.5&&uMaterial<2.5){float m=max(abs(vLocal.x),max(abs(vLocal.y),abs(vLocal.z)));if(m>.983){color=mix(vec3(.93,.96,.88),vec3(.66,.23,.18),step(.70,uColor.b));}}
    if(uMaterial>4.5&&uMaterial<5.5){float grain=sin((vWorld.x+vWorld.z)*160.+sin(vWorld.y*200.)*.6);color*=1.+grain*.035;}\n    if(uMaterial>2.5&&uMaterial<3.5){vec2 grid=abs(fract(vWorld.xz*.5+.5)-.5);float line=1.-smoothstep(.003,.008,min(grid.x,grid.y));color=mix(color,color*1.16,line);}
    float d=max(dot(n,l),0.);float sh=shadow();vec3 v=normalize(uEye-vWorld),h=normalize(l+v);float glossy=uMaterial>1.5&&uMaterial<2.5?90.:40.;float spec=pow(max(dot(n,h),0.),glossy)*(uMaterial>1.5&&uMaterial<2.5?.45:.10)*sh;
    vec3 lit=color*(.48+.65*d*sh)+vec3(spec);lit+=uSelected*.035;frag=vec4(pow(max(lit,vec3(0.)),vec3(.88)),1.);
   }`);
  this.depth=this.program(`#version 300 es
   layout(location=0) in vec3 aPosition;uniform mat4 uModel,uVP;void main(){gl_Position=uVP*uModel*vec4(aPosition,1.);}`,`#version 300 es
   precision highp float;void main(){}`);
  this.line=this.program(`#version 300 es
   layout(location=0) in vec3 aPosition;uniform mat4 uVP;void main(){gl_Position=uVP*vec4(aPosition,1.);}`,`#version 300 es
   precision highp float;uniform vec4 uColor;out vec4 frag;void main(){frag=uColor;}`);
  this.locations=new Map();for(const p of [this.main,this.depth,this.line]){const out={};for(const n of ['uModel','uVP','uLight','uScale','uColor','uEye','uMaterial','uSelected','uShadow'])out[n]=gl.getUniformLocation(p,n);this.locations.set(p,out);}
  this.sphere=this.makeSphere(28,18);this.box=this.makeBox();this.cylinder=this.makeCylinder(1,1,32);this.coneCue=this.makeCylinder(D.cueRadius/.011,D.cueRadius/.011,28);
  this.lineVAO=gl.createVertexArray();this.lineBuffer=gl.createBuffer();gl.bindVertexArray(this.lineVAO);gl.bindBuffer(gl.ARRAY_BUFFER,this.lineBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  this.shadow=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.shadow);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,1024,1024,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  this.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.shadow,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('그림자 버퍼 초기화 실패');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  this.light=multiply(ortho(-3.5,3.5,-3.5,3.5,.1,15),lookAt(V(3,6,4),V()));gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
 }
 mesh(vertices){const gl=this.gl,vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);return{vao,buffer,count:vertices.length/6};}
 triangle(out,a,b,c,n=null){n=n||norm(cross(sub(b,a),sub(c,a)));for(const p of [a,b,c])out.push(p.x,p.y,p.z,n.x,n.y,n.z);}
 makeBox(){const v=[],p=[V(-1,-1,-1),V(1,-1,-1),V(1,1,-1),V(-1,1,-1),V(-1,-1,1),V(1,-1,1),V(1,1,1),V(-1,1,1)];for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){this.triangle(v,p[f[0]],p[f[1]],p[f[2]]);this.triangle(v,p[f[0]],p[f[2]],p[f[3]]);}return this.mesh(v);}
 makeSphere(slices,stacks){const out=[],p=(i,j)=>V(Math.sin(Math.PI*j/stacks)*Math.cos(2*Math.PI*i/slices),Math.cos(Math.PI*j/stacks),Math.sin(Math.PI*j/stacks)*Math.sin(2*Math.PI*i/slices));for(let i=0;i<slices;i++)for(let j=0;j<stacks;j++){const a=p(i,j),b=p(i+1,j),c=p(i+1,j+1),d=p(i,j+1);for(const q of [a,c,b,a,d,c])out.push(q.x,q.y,q.z,q.x,q.y,q.z);}return this.mesh(out);}
 makeCylinder(rTop=1,rBottom=1,steps=24){const out=[];for(let i=0;i<steps;i++){const a=i/steps*2*Math.PI,b=(i+1)/steps*2*Math.PI,p=V(rBottom*Math.cos(a),-.5,rBottom*Math.sin(a)),q=V(rBottom*Math.cos(b),-.5,rBottom*Math.sin(b)),r=V(rTop*Math.cos(b),.5,rTop*Math.sin(b)),s=V(rTop*Math.cos(a),.5,rTop*Math.sin(a));this.triangle(out,p,s,r);this.triangle(out,p,r,q);this.triangle(out,V(0,.5,0),r,s,V(0,1,0));this.triangle(out,V(0,-.5,0),p,q,V(0,-1,0));}return this.mesh(out);}
 convexMesh(o){
  if(this.staticCache.has(o))return this.staticCache.get(o);
  const out=[],vertices=o.vertices,indices=o.indices;
  for(let i=0;i<indices.length;i+=3){const p=indices.slice(i,i+3).map(index=>V(...vertices.slice(index*3,index*3+3)));this.triangle(out,...p);}
  const mesh=this.mesh(out);this.staticCache.set(o,mesh);return mesh;
 }
 cushionMesh(o){if(this.staticCache.has(o))return this.staticCache.get(o);const p=[];for(let i=0;i<8;i++)p.push(V(...o.vertices.slice(i*3,i*3+3)));const out=[];for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){this.triangle(out,p[f[0]],p[f[1]],p[f[2]]);this.triangle(out,p[f[0]],p[f[2]],p[f[3]]);}const mesh=this.mesh(out);this.staticCache.set(o,mesh);return mesh;}
 size(){
  const r=this.viewportSize||this.canvas.getBoundingClientRect(),dpr=Math.min(this.viewportSize?.dpr||globalThis.devicePixelRatio||1,2);if(r.width<1||r.height<1)return;
  const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  this.width=r.width;this.height=r.height;this.aspect=r.width/r.height;
  const c=this.camera,sp=Math.sin(c.pitch),cp=Math.cos(c.pitch);this.tanHalf=Math.tan(38*Math.PI/360);
  this.distance=c.projection==='orthographic'?6:Math.max(3.9,2.00/(this.tanHalf*this.aspect))*(c.zoom||1);
  this.eye=add(c.target,V(Math.sin(c.yaw)*cp*this.distance,sp*this.distance,Math.cos(c.yaw)*cp*this.distance));
  this.forward=norm(sub(c.target,this.eye));this.right=norm(cross(this.forward,V(0,1,0)));this.up=cross(this.right,this.forward);
  this.halfH=c.projection==='orthographic'?Math.max(1.0,1.91/this.aspect)*(c.zoom||1):this.distance*this.tanHalf;this.halfW=this.halfH*this.aspect;
  const projection=c.projection==='orthographic'?ortho(-this.halfW,this.halfW,-this.halfH,this.halfH,.03,40):perspective(38*Math.PI/180,this.aspect,.03,40);
  this.vp=multiply(projection,lookAt(this.eye,c.target));
 }
 project(pos){
  const rel=sub(pos,this.eye),depth=dot(rel,this.forward),pers=this.camera.projection!=='orthographic';
  const hh=pers?Math.max(.001,depth)*this.tanHalf:this.halfH,hw=hh*this.aspect;
  return{x:(dot(rel,this.right)/hw*.5+.5)*this.width,y:(.5-dot(rel,this.up)/hh*.5)*this.height,depth,visible:depth>.03};
 }
 ray(x,y){
  const nx=x/this.width*2-1,ny=1-y/this.height*2;
  if(this.camera.projection!=='orthographic')return{origin:{...this.eye},direction:norm(add(this.forward,add(mul(this.right,nx*this.tanHalf*this.aspect),mul(this.up,ny*this.tanHalf))))};
  const local=add(mul(this.right,nx*this.halfW),mul(this.up,ny*this.halfH));return{origin:add(this.eye,local),direction:this.forward};
 }
 planePoint(x,y,height){const ray=this.ray(x,y);if(Math.abs(ray.direction.y)<1e-6)return null;const t=(height-ray.origin.y)/ray.direction.y;if(t<0)return null;return add(ray.origin,mul(ray.direction,t));}
 pick(objects,x,y){let found=null,best=1e9;for(const o of objects){const pos=o.body.translation(),p=this.project(pos),e=this.project(add(pos,mul(this.right,o.radius||.05)));if(!p.visible)continue;const radius=Math.abs(e.x-p.x),d=Math.hypot(p.x-x,p.y-y);if(d<Math.max(radius+7,14)&&d<best){found=o;best=d;}}return found;}
 command(mesh,pos,rot,scale,color,material=0,selected=0){return{mesh,model:matrix(pos,rot,scale),scale,color:typeof color==='string'?hex(color):color,material,selected};}
 cueCommands(tip,rot,color,headTip=tip,headRot=rot){
  const out=[],dir=rotate(rot,V(0,1,0)),at=d=>sub(tip,mul(dir,d)),headDir=rotate(headRot,V(0,1,0)),headAt=d=>sub(headTip,mul(headDir,d)),rear=D.cueLength-D.flexibleLength;
  out.push(this.command(this.cylinder,at(D.tipRadius+D.flexibleLength+rear/2),rot,V(D.cueRadius,rear,D.cueRadius),color));
  out.push(this.command(this.cylinder,at(D.tipRadius+D.cueLength*.86),rot,V(D.cueRadius*1.015,D.cueLength*.28,D.cueRadius*1.015),'#344a49'));
  out.push(this.command(this.cylinder,headAt(D.tipRadius+D.flexibleLength/2),headRot,V(.0058,D.flexibleLength,.0058),color));
  out.push(this.command(this.cylinder,headAt(D.tipRadius+.012),headRot,V(.0059,.022,.0059),'#e5e3d9'));
  out.push(this.command(this.sphere,headTip,qident(),V(D.tipRadius,D.tipRadius,D.tipRadius),'#5f9faf'));return out;
 }
 drawCommands(cmds,program,vp){const gl=this.gl,u=this.locations.get(program);gl.useProgram(program);gl.uniformMatrix4fv(u.uVP,false,vp);if(program===this.main){gl.uniformMatrix4fv(u.uLight,false,this.light);gl.uniform3f(u.uEye,this.eye.x,this.eye.y,this.eye.z);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.shadow);gl.uniform1i(u.uShadow,0);}
  for(const c of cmds){gl.uniformMatrix4fv(u.uModel,false,c.model);if(program===this.main){gl.uniform3f(u.uScale,c.scale.x,c.scale.y,c.scale.z);gl.uniform3fv(u.uColor,c.color);gl.uniform1f(u.uMaterial,c.material);gl.uniform1f(u.uSelected,c.selected);}gl.bindVertexArray(c.mesh.vao);gl.drawArrays(gl.TRIANGLES,0,c.mesh.count);}
 }
 lines(points,color,strip=false,alpha=1){if(points.length<6)return;const gl=this.gl,u=this.locations.get(this.line);gl.useProgram(this.line);gl.uniformMatrix4fv(u.uVP,false,this.vp);const c=typeof color==='string'?hex(color):color;gl.uniform4f(u.uColor,c[0],c[1],c[2],alpha);gl.bindVertexArray(this.lineVAO);gl.bindBuffer(gl.ARRAY_BUFFER,this.lineBuffer);gl.bufferData(gl.ARRAY_BUFFER,points instanceof Float32Array?points:new Float32Array(points),gl.DYNAMIC_DRAW);gl.drawArrays(strip?gl.LINE_STRIP:gl.LINES,0,points.length/3);}
 render(lab,state){
  this.size();const gl=this.gl,cmds=[];
  for(const o of lab.statics){const material=o.kind==='cloth'?1:o.kind==='floor'?3:o.kind==='wood'?5:0;cmds.push(this.command(o.shape==='convex'?this.convexMesh(o):o.shape==='cushion'?this.cushionMesh(o):this.box,o.body.translation(),o.body.rotation(),o.half||V(1,1,1),o.color,material));}
  for(const o of lab.objects){cmds.push(this.command(o.shape==='sphere'?this.sphere:this.box,o.body.translation(),o.body.rotation(),o.shape==='sphere'?V(o.radius,o.radius,o.radius):o.half,o.color,o.shape==='sphere'?2:0,o.id===state.selectedId?1:0));}
  // Small inlays are visual decorations, not additional collision surfaces.
  for(let i=1;i<8;i++)for(const z of [-D.depth/2-.11,D.depth/2+.11])cmds.push(this.command(this.sphere,V(-D.width/2+D.width*i/8,.071,z),qident(),V(.006,.001,.006),'#e4d4a5'));
  for(let i=1;i<4;i++)for(const x of [-D.width/2-.11,D.width/2+.11])cmds.push(this.command(this.sphere,V(x,.071,-D.depth/2+D.depth*i/4),qident(),V(.006,.001,.006),'#e4d4a5'));
  const selected=lab.get(state.selectedId);let preview=null;
  if(lab.cue&&state.showCue){cmds.push(...this.cueCommands(lab.cue.body.translation(),lab.cue.body.rotation(),'#bb9969',lab.cue.head.translation(),lab.cue.head.rotation()));}
  else if(selected&&selected.shape==='sphere'&&state.previewCueVisible){preview=lab.pose(selected,state.settings,.012+(state.cuePull||0));cmds.push(...this.cueCommands(preview.tip,preview.rotation,state.obstruction?'#b96353':'#c3a170'));cmds.push(this.command(this.sphere,preview.contact,qident(),V(.0024,.0024,.0024),'#c9f69d'));}
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,1024,1024);gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2,3);this.drawCommands(cmds,this.depth,this.light);gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(.032,.049,.077,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);this.drawCommands(cmds,this.main,this.vp);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  if(state.predict&&state.forecast)for(const track of state.forecast.tracks){this.lines(track.segments,track.color,false,.90);this.lines(track.endRing,track.color,true,.70);}
  if(state.paths)for(const o of lab.objects)this.lines(G.LabMath.visibleTrail(o,lab,state).flatMap(p=>[p.x,p.y,p.z]),o.color,true,.72);
  if(selected){const c=selected.body.translation(),r=(selected.radius||.045)+.012,points=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;points.push(c.x+r*Math.cos(a),c.y-(selected.radius||selected.half.y)+.002,c.z+r*Math.sin(a));}this.lines(points,'#a7f3d0',true,.95);}
  if(preview){const guide=G.LabMath.aimGuide(selected.body.translation(),state.settings.angle,selected.radius),a=guide.start,b=guide.end;this.lines([a.x,a.y,a.z,b.x,b.y,b.z],'#e7f9d3',true,.95);}
  if(state.debug){const data=lab.world.debugRender();this.lines(data.vertices,'#8ccbe0',false,.8);}
  if(state.vectors)for(const o of lab.objects){const p=o.body.translation(),end=add(p,mul(o.body.linvel(),.14));this.lines([p.x,p.y,p.z,end.x,end.y,end.z],'#a7f3d0',false,1);}
  gl.depthMask(true);gl.disable(gl.BLEND);this.completedFrames=(this.completedFrames||0)+1;
 }
 setView(name){const c=this.camera;c.zoom=1;c.target=V(-.12,-.035,0);if(name==='top'){c.projection='orthographic';c.yaw=0;c.pitch=Math.PI/2-.0001;}else if(name==='side'){c.projection='perspective';c.yaw=0;c.pitch=.28;}else{c.projection='perspective';c.yaw=.12;c.pitch=.86;}this.size();}
}
G.LabRenderer=LabRenderer;
})(globalThis);
