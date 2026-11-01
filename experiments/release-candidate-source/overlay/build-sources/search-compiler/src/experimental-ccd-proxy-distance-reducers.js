/* SPDX-License-Identifier: Apache-2.0
 * Parry 0.31.1 source simplex reducers, scalar arithmetic-graph lowering.
 * Original: Sébastien Crozet and Dimforge contributors; modified 2026.
 * Apache-2.0: vendor/RAPIER-LICENSE.txt. Shared ordered region predicates come
 * from experimental-ccd-proxy-distance-kernel.js; this is not another GJK.
 */
(function(G){'use strict';
const node=typeof module!=='undefined'&&module.exports;
const Source=node?require('./experimental-ccd-proxy-distance-kernel'):G.LabCcdProxyDistanceKernelExperimental;
const Graph=node?require('./experimental-arithmetic-graph'):G.LabArithmeticGraphExperimental;
const INPUTS=16;
function plan(n) {
  const nodes=[],op=(kind,...args)=>{nodes.push({kind,args});return INPUTS+nodes.length-1;},c=x=>op('const',Math.fround(x));
  const z=c(0),one=c(1),add=(a,b)=>op('add',a,b),sub=(a,b)=>op('sub',a,b),mul=(a,b)=>op('mul',a,b),div=(a,b)=>op('div',a,b),neg=a=>op('negate',a),choose=(a,b,d)=>op('choose',a,b,d),le=a=>op('le',a,z),lt=a=>op('lt',a,z),gt=a=>op('gt',a,z);
  const vs=(a,b)=>a.map((x,i)=>sub(x,b[i])),dot=(a,b)=>add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2])),cross=(a,b)=>[sub(mul(a[1],b[2]),mul(b[1],a[2])),sub(mul(a[2],b[0]),mul(b[2],a[0])),sub(mul(a[0],b[1]),mul(b[0],a[1]))],triple=(a,b,d)=>dot(cross(a,b),d);
  const vertex={a:[0,1,2],b:[3,4,5],c:[6,7,8],d:[9,10,11]},index={a:0,b:1,c:2,d:3},oldWeights=[12,13,14,15],w={};
  const edge=(a,b)=>{const ab=vs(b,a);return[dot(b,ab),neg(dot(a,ab)),dot(ab,ab)];};
  const tri=(a,b,d)=>{const ab=vs(b,a),ac=vs(d,a),bxc=cross(b,d),cxa=cross(d,a),axb=cross(a,b),normal=cross(ab,ac);return[dot(bxc,normal),dot(cxa,normal),dot(axb,normal),dot(normal,normal)];};
  const tet=(a,b,d,e)=>{const divisor=triple(vs(b,a),vs(d,a),vs(e,a)),sign=choose(lt(divisor),c(-1),one);return[mul(sign,triple(b,d,e)),mul(sign,triple(a,e,d)),mul(sign,triple(a,b,e)),mul(sign,triple(a,d,b)),mul(sign,divisor)];};
  const and=a=>a.reduce(mul,one);
  function condition(text){return and(text.split(' && ').map(term=>{const m=/^w_(\w+)\[(\d)\] (<=|<|>) 0\.0$/.exec(term);if(!m)throw Error('Unknown source region expression '+term);return({'<=':le,'<':lt,'>':gt}[m[3]])(w[m[1]][+m[2]]);}));}
  function state(indices,coeffs,valid=one) {
    const slots=[0,1,2,3].map(c),weights=oldWeights.slice();
    indices.forEach((i,j)=>{slots[j]=c(i);weights[j]=choose(valid,coeffs[j],oldWeights[i]);});
    return [c(indices.length),valid,...slots,...weights];
  }
  let result,found=z;
  function branch(predicate,next) {const take=mul(predicate,sub(one,found));found=op('max',found,predicate);result=result.map((x,i)=>choose(take,next[i],x));}
  if(n===2) {
    const a=vertex.a,b=vertex.b,ab=vs(b,a),divisor=dot(ab,ab),u=dot(b,ab),v=neg(dot(a,ab)),valid=gt(divisor),denom=div(one,choose(valid,divisor,one));
    result=state([0,1],[mul(denom,u),mul(denom,v)],valid);
    branch(le(v),state([0],[one]));branch(le(u),state([1],[one]));
  } else {
    const edges=n===3?['ab','bc','ca']:['ab','ac','ad','bc','cd','db'];for(const name of edges)w[name]=edge(vertex[name[0]],vertex[name[1]]);
    const faces=n===3?['abc']:['acb','abd','adc','bcd'];for(const name of faces)w[name]=tri(vertex[name[0]],vertex[name[1]],vertex[name[2]]);
    if(n===4)w.abcd=tet(vertex.a,vertex.b,vertex.c,vertex.d);
    const final=n===3?w.abc:w.abcd,valid=gt(final[n]),safe=choose(valid,final[n],one);
    result=state(Array.from({length:n},(_,i)=>i),final.slice(0,n).map(x=>div(x,safe)),valid);
    const regions=n===3?Source.REGIONS3:Source.REGIONS4;
    for(const [name,p] of regions.vertices)branch(condition(p),state([index[name]],[one]));
    for(const [name,a,b,p] of regions.edges) {
      const valid=gt(w[name][2]),safe=choose(valid,w[name][2],one);
      branch(and([condition(p),gt(w[name][0]),gt(w[name][1])]),state([index[a],index[b]],[div(w[name][0],safe),div(w[name][1],safe)],valid));
    }
    if(n===4)for(const [name,names,i] of regions.faces) {
      const valid=gt(w[name][3]),safe=choose(valid,w[name][3],one);
      branch(and([lt(w.abcd[i]),gt(w[name][0]),gt(w[name][1]),gt(w[name][2])]),state(names.map(x=>index[x]),w[name].slice(0,3).map(x=>div(x,safe)),valid));
    }
  }
  return Graph.validatePlan({inputFloats:INPUTS,nodes,outputs:result});
}
const PLANS=Object.freeze([plan(2),plan(3),plan(4)]);
const STARTS=[],LENGTHS=[],program=[];PLANS.forEach(p=>{STARTS.push(program.length/4);LENGTHS.push(p.nodes.length);program.push(...Graph.encode(p));});
const PROGRAM=Uint32Array.from(program),OUTPUTS=Uint32Array.from(PLANS.flatMap(p=>p.outputs)),SCRATCH_FLOATS=INPUTS+Math.max(...LENGTHS);
function reduce(simplex) {
  if(simplex.count===1)return {...simplex,v:simplex.v.map((v,i)=>i? v:{...v,a:1}),solved:true};
  const input=new Float32Array(INPUTS);simplex.v.forEach((v,i)=>{input.set([v.w.x,v.w.y,v.w.z],3*i);input[12+i]=v.a;});
  const out=Graph.execute(input,PLANS[simplex.count-2]);return {count:out[0],solved:!!out[1],v:Array.from({length:4},(_,i)=>({...simplex.v[out[2+i]],a:out[6+i]}))};
}
function wgsl() {return `
@group(0) @binding(3) var<storage,read> reducerProgram: array<vec4<u32>>;
@group(0) @binding(4) var<storage,read> reducerOutputs: array<u32>;
@group(0) @binding(5) var<storage,read_write> reducerScratch: array<f32>;
fn solve(s: ptr<function, Simplex>) {
  if ((*s).count == 1u) { (*s).solved=true; (*s).v[0]=weighted((*s).v[0],1.0); return; }
  let which=(*s).count-2u;
  let starts=array<u32,3>(${STARTS.map(x=>x+'u').join(',')});
  let lengths=array<u32,3>(${LENGTHS.map(x=>x+'u').join(',')});
  for(var i=0u;i<4u;i++) {
    reducerScratch[3u*i]=(*s).v[i].w.x;reducerScratch[3u*i+1u]=(*s).v[i].w.y;reducerScratch[3u*i+2u]=(*s).v[i].w.z;reducerScratch[12u+i]=(*s).v[i].a;
  }
  for(var i=0u;i<lengths[which];i++) {
    let ins=reducerProgram[starts[which]+i];var value=0.0;
    if(ins.x==0u) {value=bitcast<f32>(ins.y);} else {
      let a=reducerScratch[ins.y];let b=reducerScratch[ins.z];
      switch ins.x {
        case 1u: {value=a+b;} case 2u: {value=a-b;} case 3u: {value=a*b;} case 4u: {value=a/b;}
        case 6u: {value=max(a,b);} case 10u: {value=select(reducerScratch[ins.w],b,a!=0.0);}
        case 11u: {value=select(0.0,1.0,a<b);} case 12u: {value=select(0.0,1.0,a<=b);} case 13u: {value=select(0.0,1.0,a>b);}
        case 15u: {value=bitcast<f32>(bitcast<u32>(a)^0x80000000u);} default: {value=0.0;}
      }
    }
    reducerScratch[16u+i]=value;
  }
  let old=(*s).v;let offset=which*10u;
  (*s).count=u32(reducerScratch[reducerOutputs[offset]]);(*s).solved=reducerScratch[reducerOutputs[offset+1u]]!=0.0;
  for(var i=0u;i<4u;i++) {let index=u32(reducerScratch[reducerOutputs[offset+2u+i]]);let weight=reducerScratch[reducerOutputs[offset+6u+i]];(*s).v[i]=weighted(old[index],weight);}
}
`;}
const api=Object.freeze({PLANS,PROGRAM,OUTPUTS,SCRATCH_FLOATS,reduce,wgsl});G.LabCcdProxyDistanceReducersExperimental=api;if(node)module.exports=api;
})(globalThis);
