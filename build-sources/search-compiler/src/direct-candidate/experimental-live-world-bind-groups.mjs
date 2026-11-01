/** Invocation-local reuse only. Never owns or extends a GPU buffer's lifetime. */
export function createLiveWorldRunBindGroups(device){
 let closed=false,records=new Map(),bufferIds=new WeakMap(),nextBufferId=0,created=0,reused=0;
 const open=()=>{if(closed)throw Error('Run bind-group cache is closed');};
 return Object.freeze({
  get(pipeline,entries){
   open();if(!pipeline||typeof pipeline.getBindGroupLayout!=='function'||!Array.isArray(entries))throw TypeError('Exact pipeline and buffer bindings required');
   const bindings=new Set(),key=[];
   for(const entry of entries){
    const {binding,resource}=entry??{};
    if(!entry||Object.keys(entry).some(k=>!['binding','resource'].includes(k))||!Number.isSafeInteger(binding)||binding<0||bindings.has(binding)||!resource||Object.keys(resource).some(k=>!['buffer','offset','size'].includes(k)))throw TypeError('Unique exact buffer binding required');
    const {buffer,offset,size}=resource;
    if(!buffer||!['object','function'].includes(typeof buffer)||offset!==undefined&&(!Number.isSafeInteger(offset)||offset<0)||size!==undefined&&(!Number.isSafeInteger(size)||size<=0))throw TypeError('Exact buffer identity and nonnegative integral view required');
    bindings.add(binding);if(!bufferIds.has(buffer))bufferIds.set(buffer,nextBufferId++);
    key.push([binding,bufferIds.get(buffer),offset??null,size??null]);
   }
   let record=records.get(pipeline);
   if(!record){record={layout:pipeline.getBindGroupLayout(0),groups:new Map()};records.set(pipeline,record);}
   const identity=JSON.stringify(key),prior=record.groups.get(identity);
   if(prior){reused++;return prior;}
   const group=device.createBindGroup({layout:record.layout,entries});
   record.groups.set(identity,group);created++;return group;
  },
  stats(){return Object.freeze({created,reused});},
  dispose(){if(closed)return;closed=true;records.clear();records=null;bufferIds=null;},
 });
}
