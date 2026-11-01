/** Owned typed views for the experimental ONE-invocation canonical transport.
 * ArrayBuffer identity and byte offsets are preserved across aliases. Packing
 * uploads data only; it never runs an instruction or computes a physics result.
 */
import{admitIntegerProgram}from'./kernel-common-guards.mjs';
export function snapshotIntegerViews(compilation,inputs){
 const layout=admitIntegerProgram(compilation),policy=compilation.sourceStoragePolicy;
 if(!inputs||Object.getPrototypeOf(inputs)!==Object.prototype||Object.keys(inputs).sort().join(',')!==policy.map(x=>x.name).sort().join(','))throw Error('Exact named source views required');
 const backings=new Map(),rows=[];let words=0,atomicWords=0;
 for(const p of policy){const desc=Object.getOwnPropertyDescriptor(inputs,p.name);if(!desc||!Object.hasOwn(desc,'value'))throw Error('Source view accessors forbidden');const view=desc.value;
  if(!(view instanceof Uint32Array||view instanceof Int32Array)||!(view.buffer instanceof ArrayBuffer)||view.byteOffset%4||view.byteLength%4)throw Error('Nonshared u32 word view required');
  const atomic=p.scalar==='atomic<u32>';if(backings.has(view.buffer)&&backings.get(view.buffer).atomic!==atomic)throw Error('Mixed atomic/non-atomic backing alias unsupported');
  if(!backings.has(view.buffer)){const length=view.buffer.byteLength/4;if(!Number.isSafeInteger(length)||length>2097152||words+atomicWords>2097152-length)throw Error('Bounded 8MiB source backing arena required');backings.set(view.buffer,{offset:atomic?atomicWords:words,atomic,data:new Uint32Array(view.buffer).slice()});if(atomic)atomicWords+=length;else words+=length;}
  rows.push({...p,offset:backings.get(view.buffer).offset+view.byteOffset/4,length:view.length});
 }
 const arena=new Uint32Array(words),atomicArena=new Uint32Array(atomicWords),views=new Uint32Array((Math.max(...policy.map(p=>p.binding))+1)*4);for(const {offset,data,atomic}of backings.values())(atomic?atomicArena:arena).set(data,offset);for(const r of rows)views.set([r.offset,r.length,r.access==='read_write'?1:0,r.scalar==='atomic<u32>'?1:0],r.binding*4);
 return{layout,arena,atomicArena,views,sourceViews:Object.freeze(rows.map(Object.freeze))};
}
