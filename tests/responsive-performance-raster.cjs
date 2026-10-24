'use strict';
// Compare pixel and depth bytes to the pre-optimization software renderer.
// No browser or device performance claims are made by these Node fixtures.
const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const R=require('../vendor/rapier.cjs');globalThis.RAPIER=R;
for(const n of ['math','physics','renderer'])require('../src/'+n+'.js');
before(()=>R.init());
function context2d(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){},setTransform(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};}
const document={createElement:()=>({width:1,height:1,getContext:()=>context2d()})};
function renderer(source,w=320,h=200){const ctx=vm.createContext({LabMath,LabDimensions,LabRenderer,document,performance});vm.runInContext(source,ctx);const rect={width:w,height:h};const canvas={width:1,height:1,getContext:()=>context2d(),getBoundingClientRect:()=>({...rect})};return {r:new ctx.SoftwareRenderer(canvas),rect};}
const actual=fs.readFileSync(path.join(__dirname,'../src/software-renderer.js'),'utf8');
// Restore only the old mesh and drawCommand algorithms inside the same renderer,
// retaining common staging/timing code. The fixed reference is not a second app.
const originalMesh=' mesh(vertices){return{vertices:new Float32Array(vertices),count:vertices.length/6};}\n';
const originalDraw=" drawCommand(c){const p=c.mesh.vertices;for(let i=0;i<p.length;i+=18){const a=this.vertex(...p.subarray(i,i+6),c),b=this.vertex(...p.subarray(i+6,i+12),c),d=this.vertex(...p.subarray(i+12,i+18),c);if(a.z<=.03||b.z<=.03||d.z<=.03)continue;const view=norm(sub(a.world,this.eye));if(dot(add(add(a.n,b.n),d.n),view)>.001)continue;this.trianglePixels(a,b,d,c);}}\n";
const reference=actual.replace(/ mesh\(vertices\)\{[\s\S]*?\n command\(/,originalMesh+' command(').replace(/ drawCommand\(c\)\{[\s\S]*?\n worldLine\(/,originalDraw+' worldLine(');
function bytes(view){return Buffer.from(view.buffer,view.byteOffset,view.byteLength)}
function state(){return {selectedId:1,showCue:true,previewCueVisible:true,settings:{angle:17.23,elevation:8,tipX:0,tipY:0,speed:2},predict:false,paths:false,vectors:false,debug:false};}

test('indexed CPU meshes preserve the exact Float32 position/normal sequence including seams',()=>{
 const {r}=renderer(actual);const mesh=r.mesh([0,-0,0,0,1,0, 0,-0,0,0,1,0, 0,0,0,0,-1,0]);assert.equal(mesh.unique.length,12);assert.equal(mesh.indices.length,3);assert.equal(mesh.indices[0],mesh.indices[1]);assert.notEqual(mesh.indices[0],mesh.indices[2]);
 for(let i=0;i<mesh.count;i++)assert.deepEqual(bytes(mesh.vertices.subarray(i*6,i*6+6)),bytes(mesh.unique.subarray(mesh.indices[i]*6,mesh.indices[i]*6+6)));
});

test('unchanged-resolution CPU raster gives byte-identical color and depth across aim/orbit/resize/motion',()=>{
 const lab=new PhysicsLab(R),a=renderer(actual),b=renderer(reference),s=state();try{
 const cases=[['top',320,200,0,8],['top',390,260,-28.9954,8],['3d',320,200,35,45],['side',320,200,-92,12],['top',1068,424,-28.995406,8]];
 for(const [view,w,h,angle,elevation]of cases){for(const pair of [a,b]){Object.assign(pair.rect,{width:w,height:h});pair.r.setView(view)}Object.assign(s.settings,{angle,elevation});
  a.r.render(lab,s);b.r.render(lab,s);assert.deepEqual(bytes(a.r.image.data),bytes(b.r.image.data),view+' color');assert.deepEqual(bytes(a.r.zbuffer),bytes(b.r.zbuffer),view+' depth');assert.equal(a.r.pw,b.r.pw);assert.equal(a.r.ph,b.r.ph);
  assert(a.r.frameTiming.projectedVertices<a.r.frameTiming.sourceVertices/3,'more than 3× fewer transforms without fewer triangles');
 }
 for(const pair of [a,b]){pair.r.camera.yaw=-.42;pair.r.camera.pitch=1.2706963268;}
 a.r.render(lab,s);b.r.render(lab,s);assert.deepEqual(bytes(a.r.image.data),bytes(b.r.image.data),'actual cloud orbit color');assert.deepEqual(bytes(a.r.zbuffer),bytes(b.r.zbuffer),'actual cloud orbit depth');assert.equal(a.r.pw,1600);assert.equal(a.r.ph,635);
 lab.move(1,{x:-.7,y:.16,z:-.3});lab.step(24);s.previewCueVisible=false;
 a.r.render(lab,s);b.r.render(lab,s);assert.deepEqual(bytes(a.r.image.data),bytes(b.r.image.data),'orbited moving scene color');assert.deepEqual(bytes(a.r.zbuffer),bytes(b.r.zbuffer),'orbited moving scene depth');
 console.log(JSON.stringify({fixture:true,unchangedPixelDimensions:[a.r.pw,a.r.ph],sourceVertices:a.r.frameTiming.sourceVertices,projectedVertices:a.r.frameTiming.projectedVertices,note:'Exact color/depth comparison; not hardware performance'}));
 }finally{lab.dispose()}
});
