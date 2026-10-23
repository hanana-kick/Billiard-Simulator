'use strict';
const assert=require('node:assert/strict');
const {test,before}=require('node:test');
const R=require('../vendor/rapier.cjs');
require('../src/math.js');require('../src/physics.js');require('../src/renderer.js');require('../src/software-renderer.js');
const {V,sub,cross,dot}=LabMath,D=LabDimensions;
before(async()=>R.init());
const run=fn=>{const lab=new PhysicsLab(R);try{return fn(lab);}finally{lab.dispose();}};
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);

test('all eight mitred rails render the exact physical hull, including outward normals',()=>run(lab=>{
 const rails=lab.statics.filter(o=>o.shape==='convex');assert.equal(rails.length,8);
 const renderer=Object.create(LabRenderer.prototype);renderer.staticCache=new WeakMap();renderer.mesh=vertices=>({vertices});
 for(const o of rails){
  assert.deepEqual(o.vertices,Array.from(o.collider.vertices()));assert.deepEqual(o.indices,Array.from(o.collider.indices()));
  const mesh=renderer.convexMesh(o);assert.equal(renderer.convexMesh(o),mesh,'static geometry is cached');
  assert.equal(mesh.vertices.length,o.indices.length*6);
  const center=V();for(let i=0;i<o.vertices.length;i+=3){center.x+=o.vertices[i];center.y+=o.vertices[i+1];center.z+=o.vertices[i+2];}
  for(const k of ['x','y','z'])center[k]/=o.vertices.length/3;
  for(let i=0;i<o.indices.length;i+=3){
   const [a,b,c]=o.indices.slice(i,i+3).map(j=>V(...o.vertices.slice(j*3,j*3+3)));
   assert.ok(dot(cross(sub(b,a),sub(c,a)),sub(a,center))>0,'triangle points out of convex hull');
   for(let j=0;j<3;j++)assert.deepEqual(mesh.vertices.slice((i+j)*6,(i+j)*6+3),o.vertices.slice(o.indices[i+j]*3,o.indices[i+j]*3+3));
  }
 }
 assert.equal(SoftwareRenderer.prototype.convexMesh,LabRenderer.prototype.convexMesh,'CPU and GPU share geometry');
}));

test('cushion nose still matches original playable dimensions and 39.9 mm contact height',()=>run(lab=>{
 for(const o of lab.statics.filter(o=>o.kind==='cushion')){
  const side=o.label.includes('오른쪽')||o.label.includes('왼쪽'),axis=side?0:2,edge=side?D.width/2:D.depth/2;
  const nose=[];for(let i=0;i<o.vertices.length;i+=3)if(Math.abs(Math.abs(o.vertices[i+axis])-edge)<1e-6)nose.push(o.vertices.slice(i,i+3));
  assert.equal(nose.length,2);for(const p of nose)near(p[1],.0399);
  near(Math.abs(nose[0][side?2:0]),side?D.depth/2:D.width/2);
 }
}));

test('adjacent cushions and crown rails meet on their 45 degree seam without a corner hole',()=>run(lab=>{
 for(const kind of ['wood','cushion']){
  const right=lab.statics.find(o=>o.shape==='convex'&&o.kind===kind&&o.label.startsWith('오른쪽'));
  const front=lab.statics.find(o=>o.shape==='convex'&&o.kind===kind&&o.label.startsWith('앞쪽'));
  const seam=o=>{const p=[];for(let i=0;i<o.vertices.length;i+=3){const [x,y,z]=o.vertices.slice(i,i+3);if(x>0&&z>0&&Math.abs((x-D.width/2)-(z-D.depth/2))<1e-6)p.push([x,y,z]);}return p;};
  const a=seam(right),b=seam(front);assert.ok(a.length>=4);assert.equal(a.length,b.length);
  for(const p of a)assert.ok(b.some(q=>p.every((v,i)=>Math.abs(v-q[i])<1e-6)));
 }
}));

test('rail hulls survive fork/undo serialization without changing geometry',()=>run(lab=>{
 const fork=lab.fork();try{for(let i=0;i<lab.statics.length;i++){assert.deepEqual(fork.statics[i].vertices,lab.statics[i].vertices);assert.deepEqual(fork.statics[i].indices,lab.statics[i].indices);}}finally{fork.dispose();}
}));
