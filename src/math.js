/* Small, renderer-independent vector helpers. SI units throughout. */
(function(G){
'use strict';
const V=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z), sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,s)=>V(a.x*s,a.y*s,a.z*s), dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const len=a=>Math.hypot(a.x,a.y,a.z), norm=a=>mul(a,1/(len(a)||1));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const qident=()=>({x:0,y:0,z:0,w:1});
function rotate(q,v){const t=mul(cross(q,v),2);return add(v,add(mul(t,q.w),cross(q,t)));}
function qfromY(v){v=norm(v);if(v.y<-.999999)return{x:1,y:0,z:0,w:0};const s=Math.sqrt((1+v.y)*2);return{x:v.z/s,y:0,z:-v.x/s,w:s/2};}
function matrix(pos=V(),q=qident(),s=V(1,1,1)){
 const x=q.x,y=q.y,z=q.z,w=q.w,x2=x+x,y2=y+y,z2=z+z;
 return new Float32Array([(1-y*y2-z*z2)*s.x,(x*y2+w*z2)*s.x,(x*z2-w*y2)*s.x,0,
 (x*y2-w*z2)*s.y,(1-x*x2-z*z2)*s.y,(y*z2+w*x2)*s.y,0,
 (x*z2+w*y2)*s.z,(y*z2-w*x2)*s.z,(1-x*x2-y*y2)*s.z,0,pos.x,pos.y,pos.z,1]);
}
function multiply(a,b){const o=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o;}
function lookAt(eye,target,up=V(0,1,0)){const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x.x,y.x,z.x,0,x.y,y.y,z.y,0,x.z,y.z,z.z,0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
function forecastGeometry(result){
 for(const track of result.tracks){
  const p=track.points,segments=[];let phase=0,total=0;
  for(let i=1;i<p.length;i++){
   const a=p[i-1],delta=sub(p[i],a),distance=len(delta);if(distance<1e-10)continue;
   let travel=0;
   while(travel<distance-1e-10){const draw=phase<.032,remaining=(draw?.032:.054)-phase,step=Math.min(remaining,distance-travel);
    if(draw&&step>1e-10){const s=add(a,mul(delta,travel/distance)),e=add(a,mul(delta,(travel+step)/distance));segments.push(s.x,s.y,s.z,e.x,e.y,e.z);}
    travel+=step;phase+=step;if(phase>=.054-1e-10)phase=0;
   }total+=distance;
  }
  track.segments=segments;track.distance=total;track.endRing=[];
  if(total>.003){const end=p[p.length-1],r=track.radius||.035;for(let i=0;i<=40;i++){const t=i/40*Math.PI*2;track.endRing.push(end.x+r*Math.cos(t),end.y,end.z+r*Math.sin(t));}}
 }
 return result;
}
const trailViews=new WeakMap();
function visibleTrail(object,lab,state){
 const points=object.trail||[];if(state.allPaths)return points;
 const last=points[points.length-1],cached=trailViews.get(object);
 if(cached&&cached.points===points&&cached.last===last&&cached.length===points.length&&cached.shot===lab.shots)return cached.result;
 const result=points.filter(p=>(p.shot??lab.shots)===lab.shots);trailViews.set(object,{points,last,length:points.length,shot:lab.shots,result});return result;
}
function aimGuide(position,angle,radius=.03075){const a=angle*Math.PI/180,d=V(Math.cos(a),0,Math.sin(a));return{start:add(position,mul(d,radius+.015)),end:add(position,mul(d,.9))};}
G.LabMath={aimGuide,visibleTrail,forecastGeometry,V,add,sub,mul,dot,cross,len,norm,clamp,rotate,qident,qfromY,matrix,multiply,lookAt,ortho,perspective};
})(globalThis);
