/** Geometry-only immutable convex triangle hull, Q24. No TOI/response/scoring. */
import {multiplyWide} from './deterministic-axial.mjs';
import {divideWide,CONTACT_DIVISION_WGSL} from './deterministic-contact.mjs';
const Q=16777216,NONE=0xffffffff,VERSION=0x43470101,STRIDE=64,MAX_FEATURES=96;
export const CUSHION_GEOMETRY=Object.freeze({version:VERSION,queryWords:16,outputWords:32,featureWords:64,maxFeatures:MAX_FEATURES,maxCandidates:4096,positionQuantum:1/Q});
const cmp=(a,b)=>a[1]===b[1]?Math.sign(a[0]-b[0]):Math.sign(a[1]-b[1]);
const add64=(a,b)=>{const l=(a[0]+b[0])>>>0;return [l,(a[1]+b[1]+(l<a[0]?1:0))>>>0];};
const isqrt=n=>{if(n<0n)throw RangeError('sqrt');let l=0n,h=n+1n;while(l+1n<h){const m=(l+h)/2n;if(m*m<=n)l=m;else h=m;}return l;};
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0n);
function unit(v){const sum=dot(v,v);if(sum===0n)throw RangeError('Degenerate feature');const lo=[],hi=[];for(const x of v){const target=x*x*BigInt(Q)**2n;let l=0n,h=BigInt(Q)+1n;while(l+1n<h){const m=(l+h)/2n;if(m*m*sum<=target)l=m;else h=m;}const u=l*l*sum===target?l:l+1n;lo.push(Number(x<0n?-u:l));hi.push(Number(x<0n?-l:u));}return [lo,hi];}
const lex=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
/** Once-only static preprocessing of actual collider vertices/indices. */
export function packCushionHull({id,materialId=0,vertices,indices}){
 if(!Number.isInteger(id)||id<0||id>NONE||!Number.isInteger(materialId)||materialId<0||materialId>NONE||!vertices||vertices.length%3||vertices.length<12||vertices.length>48||!indices||indices.length%3||indices.length<12||indices.length>96)throw RangeError('Hull asset domain');
 const old=Array.from({length:vertices.length/3},(_,i)=>Array.from(vertices.slice(i*3,i*3+3),x=>{if(!Number.isFinite(x)||Math.abs(x)>4)throw RangeError('Asset range');return Math.floor(x*Q+.5);}));
 const vs=old.map(x=>x.slice()).sort(lex);if(vs.some((x,i)=>i&&lex(x,vs[i-1])===0))throw RangeError('Duplicate encoded vertex');
 const remap=old.map(x=>vs.findIndex(y=>lex(x,y)===0)),faces=[];
 for(let k=0;k<indices.length;k+=3){let t=Array.from(indices.slice(k,k+3),x=>{if(!Number.isInteger(x)||x<0||x>=old.length)throw RangeError('Index');return remap[x];});const at=t.indexOf(Math.min(...t));t=[t[at],t[(at+1)%3],t[(at+2)%3]];faces.push(t);}faces.sort(lex);
 const bv=vs.map(v=>v.map(BigInt)),edges=new Map();
 for(let f=0;f<faces.length;f++){
  const t=faces[f];if(f&&lex(t,faces[f-1])===0)throw RangeError('Duplicate face');const n=cross(sub(bv[t[1]],bv[t[0]]),sub(bv[t[2]],bv[t[0]]));if(dot(n,n)===0n)throw RangeError('Degenerate face');
  if(bv.some(v=>dot(n,sub(v,bv[t[0]]))>0n))throw RangeError('Not outward convex encoded hull');
  for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');const e=edges.get(key)||{ids:[Math.min(a,b),Math.max(a,b)],directions:[]};e.directions.push(a<b?1:-1);edges.set(key,e);}
 }
 if(faces.reduce((v,t)=>v+dot(bv[t[0]],cross(bv[t[1]],bv[t[2]])),0n)<=0n)throw RangeError('Zero hull volume');
 if([...edges.values()].some(e=>e.directions.length!==2||e.directions[0]+e.directions[1]!==0))throw RangeError('Hull not closed');
 const es=[...edges.values()].map(e=>e.ids).sort(lex),count=vs.length+es.length+faces.length;if(count>MAX_FEATURES)throw RangeError('Feature cap');
 const words=new Uint32Array(16+STRIDE*count),s=new Int32Array(words.buffer);words.set([VERSION,id,materialId,count,vs.length,es.length,faces.length,STRIDE]);
 s.set([0,1,2].flatMap(k=>[Math.min(...vs.map(v=>v[k])),Math.max(...vs.map(v=>v[k]))]),8);
 let f=0;const begin=(kind,a)=>{const b=16+STRIDE*f;words[b]=kind;words[b+1]=f++;s.set(a,b+2);return b;};
 for(const a of vs)begin(3,a);
 for(const [a,b] of es){const at=begin(2,vs[a]),d=sub(bv[b],bv[a]),[lo,hi]=unit(d),sq=dot(d,d),length=isqrt(sq);s.set(lo,at+5);s.set(hi,at+8);s[at+11]=Number(length);s[at+12]=Number(length*length===sq?length:length+1n);words[at+13]=a;words[at+14]=b;}
 for(const t of faces){const at=begin(1,vs[t[0]]),n=cross(sub(bv[t[1]],bv[t[0]]),sub(bv[t[2]],bv[t[0]])),[lo,hi]=unit(n);s.set(lo,at+5);s.set(hi,at+8);for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],k=at+16+12*j,[l,h]=unit(cross(n,sub(bv[b],bv[a])));s.set(vs[a],k);s.set(l,k+3);s.set(h,k+6);words[k+9]=a;}}
 return words;
}
export function validateCushionHull(words){
 if(!(words instanceof Uint32Array)||words.length<16||words[0]!==VERSION||words[3]>MAX_FEATURES||words.length!==16+STRIDE*words[3]||words[4]<4||words[4]>16||words[5]>48||words[6]>32||words[4]+words[5]+words[6]!==words[3])throw RangeError('Packed hull');
 const s=new Int32Array(words.buffer,words.byteOffset,words.length),vertices=[],indices=[];for(let i=0;i<words[4];i++)vertices.push(...Array.from(s.slice(18+64*i,21+64*i),x=>x/Q));for(let i=words[4]+words[5];i<words[3];i++)for(let j=0;j<3;j++)indices.push(words[16+64*i+16+12*j+9]);
 const canonical=packCushionHull({id:words[1],materialId:words[2],vertices,indices});if(canonical.length!==words.length||canonical.some((x,i)=>x!==words[i]))throw RangeError('Noncanonical packed hull');
}
export function packCushionQueries(cases){
 if(!Array.isArray(cases)||!cases.length||cases.length>4096)throw RangeError('1..4096 queries');const rows=new Uint32Array(cases.length*16),s=new Int32Array(rows.buffer),ids=new Set();for(let i=0;i<cases.length;i++){const c=cases[i],b=i*16,budget=c.maxFeatures??MAX_FEATURES;if(!Number.isInteger(c.id)||c.id<0||c.id>NONE||ids.has(c.id)||!Array.isArray(c.center)||c.center.length!==3||!c.center.every(x=>Number.isFinite(x)&&Math.abs(x)<=4)||!Number.isFinite(c.radius)||c.radius<4096/Q||c.radius>Q/Q||!Number.isInteger(budget)||budget<1||budget>MAX_FEATURES)throw RangeError('Query domain');ids.add(c.id);rows.set([c.id,budget],b);s.set([...c.center,c.radius].map(x=>Math.floor(x*Q+.5)),b+2);}return rows;
}
function validateQueries(rows){if(!(rows instanceof Uint32Array)||!rows.length||rows.length%16||rows.length/16>4096)throw RangeError('Query rows');}
function product(a,b){const [lo,hi]=multiplyWide(Math.abs(a),Math.abs(b)),q=hi*256+(lo>>>24),r=(lo&0xffffff)!==0;if(q>0x7ffffffe)throw RangeError('Arithmetic range');return (a<0)!==(b<0)?[-q-(r?1:0),-q]:[q,q+(r?1:0)];}
const plus=(a,b)=>[a[0]+b[0],a[1]+b[1]],minus=(a,b)=>[a[0]-b[1],a[1]-b[0]];
function times(a,b){const ps=[product(a[0],b[0]),product(a[0],b[1]),product(a[1],b[0]),product(a[1],b[1])];return [Math.min(...ps.map(x=>x[0])),Math.max(...ps.map(x=>x[1]))];}
const point=x=>[x,x],vdot=(a,b)=>a.reduce((v,x,i)=>plus(v,times(x,b[i])),[0,0]);
function norm(v){let low=[0,0],high=[0,0];for(const [l,h] of v){const a=l<=0&&h>=0?0:Math.min(Math.abs(l),Math.abs(h)),b=Math.max(Math.abs(l),Math.abs(h));low=add64(low,multiplyWide(a,a));high=add64(high,multiplyWide(b,b));}const root=x=>{let l=0,h=0x7fffffff;while(l<h){const m=Math.floor((l+h+1)/2);if(cmp(multiplyWide(m,m),x)<=0)l=m;else h=m-1;}return l;};const l=root(low),h=root(high);return [l,h+(cmp(multiplyWide(h,h),high)!==0?1:0)];}
function ratio(a,d,ceil){if(Math.abs(a)>=d)return a<0?-Q:Q;const p=multiplyWide(Math.abs(a),Q),r=divideWide(p[0],p[1],d);if(!r.valid)throw RangeError('Division');return a<0?-(r.quotient+(!ceil&&r.remainder?1:0)):r.quotient+(ceil&&r.remainder?1:0);}
function normalized(v,d){return v.map(([l,h])=>[ratio(l,l<0?d[0]:d[1],false),ratio(h,h<0?d[1]:d[0],true)]);}
export const cushionIntervalMath=Object.freeze({multiply:times,dot:vdot,norm});
/** CPU mirror of the GPU program; not called by GPU execution. */
function runKnownCushionQueriesCPU(rows,scene){
 validateQueries(rows);const s=new Int32Array(scene.buffer,scene.byteOffset,scene.length),r=new Int32Array(rows.buffer,rows.byteOffset,rows.length),out=new Uint32Array(rows.length*2),o=new Int32Array(out.buffer);
 for(let b=0;b<rows.length;b+=16){const z=b*2,p=Array.from(r.slice(b+2,b+5),point),radius=r[b+5];out.set([rows[b],4,1,scene[1],NONE,0,scene[2],NONE],z);
  if(rows[b+1]<1||rows[b+1]>MAX_FEATURES||radius<4096||radius>Q||p.some(x=>Math.abs(x[0])>4*Q)||rows.slice(b+6,b+16).some(x=>x!==0))continue;
  if(rows[b+1]<scene[3]){out[z+1]=5;out[z+2]=4;continue;}
  let outside=false,strictInside=true;const candidates=[];
  try{for(let f=0;f<scene[3];f++){const a=16+64*f,kind=scene[a],origin=Array.from(s.slice(a+2,a+5),point),delta=p.map((x,i)=>minus(x,origin[i])),n=[0,1,2].map(i=>[s[a+5+i],s[a+8+i]]);let q=origin,valid=1;
    if(delta.some(x=>Math.max(Math.abs(x[0]),Math.abs(x[1]))>8*Q))throw RangeError('Local range');
    if(kind===1){const d=vdot(delta,n);outside ||= d[0]>0;strictInside &&= d[1]<0;q=p.map((x,i)=>minus(x,times(d,n[i])));for(let j=0;j<3;j++){const at=a+16+12*j,v=q.map((x,k)=>minus(x,point(s[at+k]))),sn=[0,1,2].map(k=>[s[at+3+k],s[at+6+k]]),side=vdot(v,sn);if(side[1]<0)valid=0;else if(side[0]<=0&&valid)valid=2;}}
    else if(kind===2){const t=vdot(delta,n);if(t[1]<0||t[0]>s[a+12])valid=0;else if(t[0]<=0||t[1]>=s[a+11])valid=2;q=origin.map((x,i)=>plus(x,times(t,n[i])));}
    if(valid){const distance=norm(p.map((x,i)=>minus(x,q[i])));candidates.push({f,kind,q,distance,valid});}
   }
   out[z+7]=scene[3];if(!outside){out[z+2]=strictInside?2:3;continue;}
   let best=null,lower=0x7fffffff;for(const c of candidates){lower=Math.min(lower,c.distance[0]);if(c.valid===1&&(!best||c.distance[1]<best.distance[1]))best=c;}
   if(!best){out[z+1]=6;out[z+2]=3;continue;}
   const upper=best.distance[1],unique=candidates.every(c=>c===best||c.distance[0]>upper);out[z+1]=unique?1:6;out[z+2]=unique?0:3;out[z+4]=best.f;out[z+5]=best.kind;o.set([lower,upper,lower-radius,upper-radius],z+8);
   for(let j=0;j<3;j++)o.set(best.q[j],z+12+2*j);
   if(best.distance[0]>0){const n=normalized(p.map((x,i)=>minus(x,best.q[i])),best.distance);for(let j=0;j<3;j++)o.set(n[j],z+18+2*j);}else{out[z+1]=6;out[z+2]=3;}
   out[z+24]=out[z+1]===1?1:0;out[z+25]=NONE;
  }catch{out[z+1]=4;out[z+2]=5;}
 }return out;
}
export function createCushionPointCPU(scene){
 if(!(scene instanceof Uint32Array))throw TypeError('Scene words');const snapshot=scene.slice();validateCushionHull(snapshot);return rows=>runKnownCushionQueriesCPU(rows,snapshot);
}
export function runCushionQueriesCPU(rows,scene){return createCushionPointCPU(scene)(rows);}
export const CUSHION_POINT_WGSL=`
${CONTACT_DIVISION_WGSL}
var<private> pointRows:array<u32,16>;
var<private> pointResult:array<u32,32>;
var<private> bad:bool;
fn sv(i:u32)->i32{return bitcast<i32>(scene[i]);}
fn pv(i:u32)->i32{return bitcast<i32>(pointRows[i]);}
fn compare(a:vec2<u32>,b:vec2<u32>)->i32{if(a.y<b.y){return -1;}if(a.y>b.y){return 1;}if(a.x<b.x){return -1;}if(a.x>b.x){return 1;}return 0;}
fn add64(a:vec2<u32>,b:vec2<u32>)->vec2<u32>{let lo=a.x+b.x;return vec2<u32>(lo,a.y+b.y+select(0u,1u,lo<a.x));}
fn prod(a:i32,b:i32)->vec2<i32>{let p=wide(u32(abs(a)),u32(abs(b)));if(p.y>=8388608u){bad=true;return vec2<i32>(0);}let v=(p.y<<8u)|(p.x>>24u);if(v>2147483646u){bad=true;return vec2<i32>(0);}let q=i32(v);let r=select(0,1,(p.x&16777215u)!=0u);if((a<0)!=(b<0)){return vec2<i32>(-q-r,-q);}return vec2<i32>(q,q+r);}
fn mul(a:vec2<i32>,b:vec2<i32>)->vec2<i32>{let p=prod(a.x,b.x);let q=prod(a.x,b.y);let r=prod(a.y,b.x);let s=prod(a.y,b.y);return vec2<i32>(min(min(p.x,q.x),min(r.x,s.x)),max(max(p.y,q.y),max(r.y,s.y)));}
fn minus(a:vec2<i32>,b:vec2<i32>)->vec2<i32>{return vec2<i32>(a.x-b.y,a.y-b.x);}
fn vdot(a:array<vec2<i32>,3>,b:array<vec2<i32>,3>)->vec2<i32>{var d=vec2<i32>(0);for(var j=0u;j<3u;j++){d+=mul(a[j],b[j]);}return d;}
fn root(v:vec2<u32>)->u32{var l=0u;var h=2147483647u;loop{if(l>=h){break;}let m=l+(h-l+1u)/2u;if(compare(wide(m,m),v)<=0){l=m;}else{h=m-1u;}}return l;}
fn norm(v:array<vec2<i32>,3>)->vec2<i32>{var l=vec2<u32>(0u);var h=vec2<u32>(0u);for(var j=0u;j<3u;j++){let x=v[j];let a=select(u32(min(abs(x.x),abs(x.y))),0u,x.x<=0&&x.y>=0);let b=u32(max(abs(x.x),abs(x.y)));l=add64(l,wide(a,a));h=add64(h,wide(b,b));}let lo=root(l);let hi=root(h);return vec2<i32>(i32(lo),i32(hi)+select(0,1,compare(wide(hi,hi),h)!=0));}
fn ratio(a:i32,d:i32,ceil:bool)->i32{if(abs(a)>=d){return select(16777216,-16777216,a<0);}let p=wide(u32(abs(a)),16777216u);let r=divideWide(p.x,p.y,u32(d));if(r.z==0u){bad=true;return 0;}if(a<0){return -i32(r.x)-select(0,1,!ceil&&r.y!=0u);}return i32(r.x)+select(0,1,ceil&&r.y!=0u);}
fn queryPackedPoint(){
 let b=0u;let z=0u;for(var j=0u;j<32u;j++){pointResult[z+j]=0u;}pointResult[z]=pointRows[b];pointResult[z+1u]=4u;pointResult[z+2u]=1u;pointResult[z+3u]=scene[1];pointResult[z+4u]=0xffffffffu;pointResult[z+6u]=scene[2];pointResult[z+7u]=0xffffffffu;
 var p:array<vec2<i32>,3>;var invalid=pointRows[b+1u]<1u||pointRows[b+1u]>96u||pv(b+5u)<4096||pv(b+5u)>16777216;for(var j=0u;j<3u;j++){let x=pv(b+2u+j);if(x< -67108864||x>67108864){invalid=true;}p[j]=vec2<i32>(x);}for(var j=6u;j<16u;j++){if(pointRows[b+j]!=0u){invalid=true;}}if(invalid){return;}
 if(pointRows[b+1u]<scene[3]){pointResult[z+1u]=5u;pointResult[z+2u]=4u;return;}
 var outside=false;var strictInside=true;var distances:array<vec2<i32>,96>;var flags:array<u32,96>;var best=0xffffffffu;var bestKind=0u;var bestQ:array<vec2<i32>,3>;var bestD=vec2<i32>(2147483647);var lower=2147483647;bad=false;
 for(var f=0u;f<scene[3];f++){
  let a=16u+64u*f;let kind=scene[a];var origin:array<vec2<i32>,3>;var delta:array<vec2<i32>,3>;var n:array<vec2<i32>,3>;for(var j=0u;j<3u;j++){origin[j]=vec2<i32>(sv(a+2u+j));delta[j]=minus(p[j],origin[j]);n[j]=vec2<i32>(sv(a+5u+j),sv(a+8u+j));if(max(abs(delta[j].x),abs(delta[j].y))>134217728){bad=true;}}
  var q=origin;var valid=1u;
  if(kind==1u){let d=vdot(delta,n);outside=outside||d.x>0;strictInside=strictInside&&d.y<0;for(var j=0u;j<3u;j++){q[j]=minus(p[j],mul(d,n[j]));}for(var j=0u;j<3u;j++){let at=a+16u+12u*j;var v:array<vec2<i32>,3>;var sn:array<vec2<i32>,3>;for(var k=0u;k<3u;k++){v[k]=minus(q[k],vec2<i32>(sv(at+k)));sn[k]=vec2<i32>(sv(at+3u+k),sv(at+6u+k));}let side=vdot(v,sn);if(side.y<0){valid=0u;}else if(side.x<=0&&valid!=0u){valid=2u;}}}
  else if(kind==2u){let t=vdot(delta,n);if(t.y<0||t.x>sv(a+12u)){valid=0u;}else if(t.x<=0||t.y>=sv(a+11u)){valid=2u;}for(var j=0u;j<3u;j++){q[j]=origin[j]+mul(t,n[j]);}}
  flags[f]=valid;if(valid!=0u){var d:array<vec2<i32>,3>;for(var j=0u;j<3u;j++){d[j]=minus(p[j],q[j]);}let distance=norm(d);distances[f]=distance;lower=min(lower,distance.x);if(valid==1u&&(best==0xffffffffu||distance.y<bestD.y)){best=f;bestKind=kind;bestQ=q;bestD=distance;}}
 }
 pointResult[z+7u]=scene[3];if(bad){pointResult[z+2u]=5u;return;}if(!outside){pointResult[z+2u]=select(3u,2u,strictInside);return;}if(best==0xffffffffu){pointResult[z+1u]=6u;pointResult[z+2u]=3u;return;}
 var unique=true;for(var f=0u;f<scene[3];f++){if(flags[f]!=0u&&f!=best&&distances[f].x<=bestD.y){unique=false;}}
 pointResult[z+1u]=select(6u,1u,unique);pointResult[z+2u]=select(3u,0u,unique);pointResult[z+4u]=best;pointResult[z+5u]=bestKind;pointResult[z+8u]=bitcast<u32>(lower);pointResult[z+9u]=bitcast<u32>(bestD.y);pointResult[z+10u]=bitcast<u32>(lower-pv(b+5u));pointResult[z+11u]=bitcast<u32>(bestD.y-pv(b+5u));
 for(var j=0u;j<3u;j++){pointResult[z+12u+j*2u]=bitcast<u32>(bestQ[j].x);pointResult[z+13u+j*2u]=bitcast<u32>(bestQ[j].y);}
 if(bestD.x>0){for(var j=0u;j<3u;j++){let v=minus(p[j],bestQ[j]);let lo=ratio(v.x,select(bestD.y,bestD.x,v.x<0),false);let hi=ratio(v.y,select(bestD.x,bestD.y,v.y<0),true);pointResult[z+18u+j*2u]=bitcast<u32>(lo);pointResult[z+19u+j*2u]=bitcast<u32>(hi);}}else{pointResult[z+1u]=6u;pointResult[z+2u]=3u;}
 pointResult[z+24u]=select(0u,1u,pointResult[z+1u]==1u);pointResult[z+25u]=0xffffffffu;if(bad){pointResult[z+1u]=4u;pointResult[z+2u]=5u;}
}
fn queryPoint(id:u32,center:vec3<i32>,radius:i32){
 for(var j=0u;j<16u;j++){pointRows[j]=0u;}pointRows[0]=id;pointRows[1]=96u;for(var j=0u;j<3u;j++){pointRows[2u+j]=bitcast<u32>(center[j]);}pointRows[5]=bitcast<u32>(radius);queryPackedPoint();
}
`;
export const CUSHION_GEOMETRY_WGSL=`
@group(0) @binding(0) var<storage,read> rows:array<u32>;
@group(0) @binding(1) var<storage,read> scene:array<u32>;
@group(0) @binding(2) var<storage,read_write> output:array<u32>;
${CUSHION_POINT_WGSL}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*16u;if(b>=arrayLength(&rows)){return;}for(var j=0u;j<16u;j++){pointRows[j]=rows[b+j];}queryPackedPoint();for(var j=0u;j<32u;j++){output[gid.x*32u+j]=pointResult[j];}
}
`;
/** Resident geometry buffers; one final diagnostic readback, no CPU query calls. */
export async function createCushionGeometryGPU(device,scene){
 if(!(scene instanceof Uint32Array))throw TypeError('Scene words');scene=scene.slice();validateCushionHull(scene);device.pushErrorScope('validation');let pipeline,shared;const start=performance.now();try{const module=device.createShaderModule({code:CUSHION_GEOMETRY_WGSL}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});shared=device.createBuffer({size:scene.byteLength,usage:128|8});device.queue.writeBuffer(shared,0,scene);}finally{const error=await device.popErrorScope();if(error)throw Error(error.message);}
 let disposed=false;return {compileMs:performance.now()-start,shaderBytes:new TextEncoder().encode(CUSHION_GEOMETRY_WGSL).length,dispose(){shared.destroy();disposed=true;},async run(rows){if(disposed)throw Error('Disposed');validateQueries(rows);const buffers=[];const alloc=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};device.pushErrorScope('validation');try{const input=alloc(rows.byteLength,128|8),output=alloc(rows.byteLength*2,128|4),read=alloc(rows.byteLength*2,1|8);device.queue.writeBuffer(input,0,rows);const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[input,shared,output].map((buffer,binding)=>({binding,resource:{buffer}}))}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(rows.length/16/32));pass.end();encoder.copyBufferToBuffer(output,0,read,0,rows.byteLength*2);const begin=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();await read.mapAsync(1);const result=new Uint32Array(read.getMappedRange()).slice();read.unmap();return {result,metrics:{candidates:rows.length/16,sharedBytes:scene.byteLength,candidateInputBytes:rows.byteLength,outputBytes:rows.byteLength*2,readbackBytes:rows.byteLength*2,submitToDoneMs:performance.now()-begin,physicalAcceptance:false}};}finally{buffers.forEach(b=>b.destroy());const error=await device.popErrorScope();if(error)throw Error(error.message);}}};
}
