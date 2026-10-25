'use strict';
// SPDX-License-Identifier: Apache-2.0
// The single shared bincode encoder, usable as CommonJS or a browser script.
// No Node APIs. Exact typed serde nodes, never a guessed Rapier byte layout.
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else Object.defineProperty(root,'RapierSnapshotCodec',{value:api,configurable:true});
})(globalThis,function(){
const MAX_BYTES=32*1024*1024,utf8=new TextEncoder();
function hexBytes(hex){const out=new Uint8Array(hex.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(hex.slice(i*2,i*2+2),16);return out;}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function integerBytes(width,value){if(!/^[iu](8|16|32|64|128)$/.test(width)||typeof value!=='string'||!/^[-]?\d+$/.test(value))fail('invalid-integer','Explicit integer width and decimal string required');if(value.length>40)fail('integer-range','Integer decimal string exceeds 128-bit bounds');const bits=Number(width.slice(1)),signed=width[0]==='i',n=BigInt(value),min=signed?-(1n<<BigInt(bits-1)):0n,max=signed?(1n<<BigInt(bits-1))-1n:(1n<<BigInt(bits))-1n;if(n<min||n>max)fail('integer-range',width+' overflow');let v=BigInt.asUintN(bits,n);const b=new Uint8Array(bits/8);for(let i=0;i<b.length;i++){b[i]=Number(v&255n);v>>=8n;}return b;}
function floatBytes(node){const n=node.width==='f32'?4:node.width==='f64'?8:0;if(!n||typeof node.bits!=='string'||!new RegExp('^[0-9a-fA-F]{'+n*2+'}$').test(node.bits))fail('invalid-float','Exact float bit string required');return hexBytes(node.bits);}
function encodeLosslessTree(tree){const chunks=[];let total=0,nodes=0;const push=b=>{total+=b.length;if(total>MAX_BYTES)fail('snapshot-size','Encoded snapshot exceeds 32MiB');chunks.push(b);},u64=n=>push(integerBytes('u64',String(n))),tag=n=>{if(!Number.isInteger(n)||n<0||n>0xffffffff)fail('invalid-enum','Explicit u32 enum index required');push(integerBytes('u32',String(n)));},list=x=>{if(!Array.isArray(x))fail('invalid-sequence','Explicit ordered sequence required');return x;};
 function visit(n,depth=0){if(!n||typeof n!=='object'||depth>512||++nodes>2000000)fail('invalid-tree','Invalid or excessive typed tree');const child=x=>visit(x,depth+1),items=()=>list(n.items).forEach(child),fields=()=>list(n.fields).forEach(f=>{if(!Array.isArray(f)||f.length!==2||typeof f[0]!=='string')fail('invalid-field','Ordered [name,value] fields required');child(f[1]);});switch(n.kind){
 case'integer':push(integerBytes(n.width,n.value));break;case'float':push(floatBytes(n).reverse());break;
 case'bool':if(typeof n.value!=='boolean')fail('invalid-bool','Boolean required');push(Uint8Array.of(+n.value));break;
 case'char':{if(typeof n.value!=='string'||[...n.value].length!==1||/^[\ud800-\udfff]$/.test(n.value))fail('invalid-char','One Unicode scalar required');push(utf8.encode(n.value));break;}
 case'string':{if(typeof n.value!=='string')fail('invalid-string','String required');if(n.value.length>MAX_BYTES)fail('snapshot-size','String exceeds 32MiB');const b=utf8.encode(n.value);u64(b.length);push(b);break;}
 case'bytes':{if(typeof n.hex!=='string'||!/^([0-9a-fA-F]{2})*$/.test(n.hex))fail('invalid-bytes','Hex bytes required');if(n.hex.length>MAX_BYTES*2)fail('snapshot-size','Bytes exceed 32MiB');const b=hexBytes(n.hex);u64(b.length);push(b);break;}
 case'none':push(Uint8Array.of(0));break;case'some':push(Uint8Array.of(1));child(n.value);break;
 case'unit':case'unit_struct':break;case'newtype_struct':child(n.value);break;
 case'seq':u64(list(n.items).length);items();break;case'tuple':case'tuple_struct':items();break;
 case'map':u64(list(n.entries).length);for(const p of n.entries){if(!Array.isArray(p)||p.length!==2)fail('invalid-map','Ordered map entries required');child(p[0]);child(p[1]);}break;
 case'struct':fields();break;case'unit_variant':tag(n.index);break;case'newtype_variant':tag(n.index);child(n.value);break;case'tuple_variant':tag(n.index);items();break;case'struct_variant':tag(n.index);fields();break;
 default:fail('unknown-node-kind','Unknown source serde kind '+n.kind);}}
 visit(tree);const bytes=new Uint8Array(total);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return bytes;
}
function* walk(node){if(!node||typeof node!=='object')return;yield node;if(['some','newtype_struct','newtype_variant'].includes(node.kind))yield*walk(node.value);if(Array.isArray(node.items))for(const x of node.items)yield*walk(x);if(Array.isArray(node.fields))for(const [,x]of node.fields)yield*walk(x);if(Array.isArray(node.entries))for(const [k,v]of node.entries){yield*walk(k);yield*walk(v);}}
function field(node,name){while(node&&['some','newtype_struct','newtype_variant'].includes(node.kind))node=node.value;const found=node?.fields?.find(x=>x[0]===name);if(!found)fail('missing-native-field',(node?.name??node?.kind??'null')+'.'+name);return found[1];}
function findStructs(tree,name){return[...walk(tree)].filter(n=>['struct','struct_variant','unit_struct'].includes(n.kind)&&n.name===name);}
function floatValue(node){if(node?.kind!=='float')fail('not-float','Typed float node required');const b=floatBytes(node);const view=new DataView(b.buffer,b.byteOffset,b.byteLength);return b.length===4?view.getFloat32(0):view.getFloat64(0);}
return Object.freeze({MAX_BYTES,fail,encodeLosslessTree,walk,field,findStructs,floatValue});
});
