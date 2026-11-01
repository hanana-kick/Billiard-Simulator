/* SPDX-License-Identifier: Apache-2.0
 * Generic experimental arithmetic runtime, 2026.
 * Generic scalar f32 graph transport only; no contact, island, or physics solver.
 * Rapier-derived callers retain their own notices and vendor/RAPIER-LICENSE.txt.
 */
(function(G){'use strict';
const f=Math.fround,EPS=f(1e-20),MAX_INPUTS=65536,MAX_NODES=1000000;
// Opcode order is the wire format. Each instruction writes one rounded f32.
// inv deliberately retains the former graph's STRICT epsilon contract. Callers
// needing Rapier's inclusive or Parry's exact-zero inverse must spell that out.
const OPERATIONS=Object.freeze([
 {name:'const',arity:1,cpu:x=>x,wgsl:'result=bitcast<f32>(ins.y);'},
 {name:'add',arity:2,cpu:(a,b)=>a+b,wgsl:'result=a+b;'},
 {name:'sub',arity:2,cpu:(a,b)=>a-b,wgsl:'result=a-b;'},
 {name:'mul',arity:2,cpu:(a,b)=>a*b,wgsl:'result=a*b;'},
 {name:'div',arity:2,cpu:(a,b)=>a/b,wgsl:'result=a/b;'},
 {name:'min',arity:2,cpu:(a,b)=>Math.min(a,b),wgsl:'result=min(a,b);'},
 {name:'max',arity:2,cpu:(a,b)=>Math.max(a,b),wgsl:'result=max(a,b);'},
 {name:'sqrt',arity:1,cpu:a=>Math.sqrt(a),wgsl:'result=sqrt(a);'},
 {name:'inv',arity:1,cpu:a=>a>-EPS&&a<EPS?0:1/a,wgsl:'if(!(a > -1e-20 && a < 1e-20)){result=1.0/a;}'},
 {name:'cap',arity:2,cpu:(a,b)=>a>b?b/a:1,wgsl:'result=1.0;if(a>b){result=b/a;}'},
 {name:'choose',arity:3,cpu:(a,b,c)=>a!==0?b:c,wgsl:'result=select(scratch[ins.w*count+id.x],b,a!=0.0);'},
 {name:'lt',arity:2,cpu:(a,b)=>a<b?1:0,wgsl:'result=select(0.0,1.0,a<b);'},
 {name:'le',arity:2,cpu:(a,b)=>a<=b?1:0,wgsl:'result=select(0.0,1.0,a<=b);'},
 {name:'gt',arity:2,cpu:(a,b)=>a>b?1:0,wgsl:'result=select(0.0,1.0,a>b);'},
 // Appended wire opcode: source copysign(1,a), including negative zero.
 {name:'signbitSign',arity:1,cpu:a=>Object.is(a,-0)||a<0?-1:1,wgsl:'result=select(1.0,-1.0,(bitcast<u32>(a)&0x80000000u)!=0u);'},
 // Bitwise source unary negation; do not change general mul semantics.
 {name:'negate',arity:1,cpu:a=>-a,wgsl:'result=bitcast<f32>(bitcast<u32>(a)^0x80000000u);'},
].map(Object.freeze));
const OPS=Object.freeze(OPERATIONS.map(x=>x.name)),lookup=new Map(OPERATIONS.map((x,i)=>[x.name,{...x,opcode:i}]));
function validatePlan(plan){
 if(!plan||!Number.isInteger(plan.inputFloats)||plan.inputFloats<1||plan.inputFloats>MAX_INPUTS||!Array.isArray(plan.nodes)||plan.nodes.length>MAX_NODES||!Array.isArray(plan.outputs)||!plan.outputs.length||plan.outputs.length>MAX_NODES)throw RangeError('Invalid bounded arithmetic graph');
 for(let i=0;i<plan.nodes.length;i++){const node=plan.nodes[i],operation=lookup.get(node?.kind);if(!operation||!Array.isArray(node.args)||node.args.length!==operation.arity)throw TypeError('Invalid opcode or arity at node '+i);if(node.kind==='const'){if(typeof node.args[0]!=='number'||!Number.isFinite(f(node.args[0])))throw RangeError('Invalid f32 constant at node '+i);}else for(const index of node.args)if(!Number.isSafeInteger(index)||index<0||index>=plan.inputFloats+i)throw RangeError('Forward or invalid dependency at node '+i);}
 for(const index of plan.outputs)if(!Number.isSafeInteger(index)||index<0||index>=plan.inputFloats+plan.nodes.length)throw RangeError('Invalid output index');return plan;
}
function execute(packed,plan){validatePlan(plan);if(!(packed instanceof Float32Array)||packed.length!==plan.inputFloats||packed.some(x=>!Number.isFinite(x)))throw TypeError('Exact finite Float32Array graph input required');const values=new Float32Array(plan.inputFloats+plan.nodes.length);values.set(packed);
 for(let i=0;i<plan.nodes.length;i++){const node=plan.nodes[i],operation=lookup.get(node.kind),args=node.kind==='const'?node.args:node.args.map(index=>values[index]);const value=f(operation.cpu(...args));if(!Number.isFinite(value))throw RangeError('Non-finite arithmetic intermediate at node '+i);values[plan.inputFloats+i]=value;}
 const result=Float32Array.from(plan.outputs,index=>values[index]);if(result.some(x=>!Number.isFinite(x)))throw RangeError('Arithmetic graph output overflowed f32');return result;
}
function encode(plan){validatePlan(plan);const words=new Uint32Array(plan.nodes.length*4),bits=new Uint32Array(1),value=new Float32Array(bits.buffer);plan.nodes.forEach((node,i)=>{words[i*4]=lookup.get(node.kind).opcode;if(node.kind==='const'){value[0]=node.args[0];words[i*4+1]=bits[0];}else node.args.forEach((index,j)=>words[i*4+j+1]=index);});return words;}
const api=Object.freeze({OPS,OPERATIONS,MAX_INPUTS,MAX_NODES,validatePlan,execute,encode});G.LabArithmeticGraphExperimental=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
