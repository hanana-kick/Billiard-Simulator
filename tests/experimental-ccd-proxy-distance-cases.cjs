'use strict';
const f=Math.fround,round=a=>a.map(f),cache=()=>({count:0,metric:0,indexA:[0,0,0],indexB:[0,0,0]});
const cube=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const tetra=[[0,0,0],[2,0,0],[0,2,0],[0,0,2]];
function item(id,pointsA,translation,extra={}) {return {id,pointsA:pointsA.map(round),pos12:{translation:round(translation),rotation:[0,0,0,1]},cache:cache(),useRadii:false,...extra};}
function cases() {
  const out=[item('single-separated',[[0,0,0]],[2,3,4]),item('single-overlap',[[0,0,0]],[0,0,0]),item('segment-overlap',[[-1,0,0],[1,0,0]],[0,0,0]),item('triangle-overlap',[[0,0,0],[2,0,0],[0,2,0]],[.5,.5,0]),item('tetra-interior',tetra,[.25,.25,.25]),item('duplicate-points',[[0,0,0],[0,0,0],[1,0,0],[1,0,0]],[.5,2,0])];
  for(const p of [[2,0,0],[0,0,0],[1,0,0],[2,2,2],[1.01,.31,-.15],[-2,-2,.7],[.7,.8,.9]]) out.push(item('cube-'+p,cube,p));
  for(const c of [
    {count:4,metric:1,indexA:[0,1,2],indexB:[0,0,0]},
    {count:255,metric:1,indexA:[0,1,2],indexB:[0,0,0]},
    {count:2,metric:2,indexA:[0,99,0],indexB:[0,0,0]},
    {count:2,metric:2,indexA:[0,1,0],indexB:[0,1,0]},
    {count:1,metric:0,indexA:[6,7,7],indexB:[0,4,5]},
    {count:2,metric:2,indexA:[0,1,7],indexB:[0,0,0]},
    {count:2,metric:1,indexA:[0,1,7],indexB:[0,0,0]},
    {count:2,metric:4,indexA:[0,1,7],indexB:[0,0,0]},
    {count:2,metric:f(.9999999),indexA:[0,1,7],indexB:[0,0,0]},
    {count:2,metric:f(4.0000005),indexA:[0,1,7],indexB:[0,0,0]},
    {count:3,metric:2,indexA:[0,1,2],indexB:[0,0,0]},
    {count:3,metric:2,indexA:[0,0,0],indexB:[0,0,0]},
    {count:0,metric:-2,indexA:[0xffffffff,7,9],indexB:[8,6,5]}
  ]) out.push(item('cache-'+out.length,cube,[2,.3,.7],{cache:c}));
  // Same tetrahedron in every source order exercises tie and reducer ordering.
  function permutations(a) {return a.length?a.flatMap((x,i)=>permutations(a.filter((_,j)=>j!==i)).map(t=>[x,...t])):[[]];}
  for(const order of permutations([0,1,2,3])) {
    out.push(item('tetra-order-'+order,order.map(i=>tetra[i]),[.25,.25,.25]));
    out.push(item('tetra-outside-'+order,order.map(i=>tetra[i]),[1,1,1]));
  }
  let seed=0x51f15e; const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<160;i++) {
    const n=4+(i%13),points=Array.from({length:n},()=>round([rand()*4-2,rand()*4-2,rand()*4-2]));
    const p=round([rand()*6-3,rand()*6-3,rand()*6-3]);
    out.push(item('random-cloud-'+i,points,p));
  }
  // The TOI caller supplies source hull points, not an analytic half-space.
  out.push(item('slanted-eight-point-hull',cube.map(([x,y,z])=>[f(x*.37+z*.13),f(y*.02+x*.007),f(z*.51-x*.11)]),[.401,.041,.103]));
  out.push(item('large-relative-support',cube.map(p=>p.map((x,i)=>f(x+[1048576,-1048576,524288][i]))),[1048579,-1048576,524288]));
  out.push(item('nonidentity-ball-rotation',cube,[1.2,.3,.5],{pos12:{translation:round([1.2,.3,.5]),rotation:round([0,Math.sin(.37),0,Math.cos(.37)])}}));
  out.push(...require('./fixtures/experimental-ccd-proxy-distance-active.json').cases);
  return out;
}
module.exports={cases,cube,tetra,item};
