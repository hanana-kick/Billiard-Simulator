/** Pure, fail-closed resource admission for the experimental live graph.
 * No GPU calls, width authorization, physics validation or allocation side effects.
 */
const U32=0xffffffff,owned=new WeakSet();
const integer=(v,name,min=0,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw RangeError(name+' must be a bounded safe integer');return v;};
const product=(a,b,name)=>integer(a*b,name,0,U32);
const bytes=(v,name)=>{integer(v,name,4);if(v%4)throw RangeError(name+' must be word aligned');integer(v/4,name+' words',1,U32);return v;};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function storage(code){
 if(typeof code!=='string')throw TypeError('Exact shader source required');
 if(/var\s*<\s*workgroup\b|(?:workgroupBarrier|storageBarrier|textureBarrier)\s*\(/.test(code))throw Error('Unaccounted workgroup storage/barrier is unsupported');
 const found=[...code.matchAll(/@group\(0\)\s*@binding\((\d+)\)\s*var<storage,\s*(read|read_write)>/g)].map(m=>({binding:Number(m[1]),access:m[2]}));
 if(!found.length||(code.match(/@binding\(/g)??[]).length!==found.length||[...code.matchAll(/@group\(([^)]+)\)/g)].some(m=>m[1]!=='0')||(code.match(/var\s*<\s*storage\b/g)??[]).length!==found.length||new Set(found.map(x=>x.binding)).size!==found.length)throw Error('Unclassified storage source');
 return found;
}
function workgroup(code){const matches=[...code.matchAll(/@workgroup_size\(([^)]+)\)/g)];if(matches.length!==1||!['1','16','32'].includes(matches[0][1].trim()))throw Error('Audited one-dimensional workgroup required');return Number(matches[0][1]);}
function rawResources(raw,count){
 if(!raw||!['staged','chunked-16'].includes(raw.strikeBackend)||!Array.isArray(raw.allocations))throw Error('Explicit source-owned raw resource facts required');
 integer(raw.effectiveMaximumSteps,'raw step count',0,4096);bytes(raw.sceneBytes,'raw scene bytes');if(raw.sceneBytes<64||raw.sceneBytes>4160||(raw.sceneBytes-64)%32)throw Error('Exact raw scene shape');
 const n=count,roles={};if(raw.effectiveMaximumSteps){roles.scene=[raw.sceneBytes,136];roles.strikeInput=[64*n,136];roles.strikeResult=[512*n,132];roles.strikeScratch=[128*n,128];if(raw.strikeBackend==='chunked-16')roles.chunkControl=[4,136];}else roles.strikeResult=[512*n,132];
 Object.assign(roles,{handoffInput:[64*n,136],rosterTemplate:[768,136],admitted:[4*n,136],budget:[16,136],prepared:[768*n,132],status:[64*n,132]});
 if(raw.allocations.length!==Object.keys(roles).length)throw Error('Exact raw allocation role set required');const seen=new Set();
 return raw.allocations.map(a=>{if(!a||!Object.hasOwn(roles,a.role)||seen.has(a.role))throw Error('Unknown/duplicate raw allocation role');seen.add(a.role);const [size,usage]=roles[a.role];if(a.bytes!==size||a.usage!==usage)throw Error('Raw allocation shape/usage mismatch: '+a.role);bytes(size,'raw '+a.role);return {role:'raw:'+a.role,bytes:size,usage};});
}
/** rawAllocations is an exact original-factory fact object: {strikeBackend,
 * effectiveMaximumSteps,sceneBytes,allocations:[{role,bytes,usage}]}. Its caller
 * must resolve roles by exact consuming source/bindings, never allocation order.
 */
export function planLiveWorldResources({plan,shared,commands,definitions,count,rawAllocations,diagnostic=false}={}){
 integer(count,'candidate count',1,U32);if(typeof diagnostic!=='boolean')throw TypeError('Explicit diagnostic boolean');
 if(!plan||!Array.isArray(plan.allocations)||!plan.allocations.length||!Array.isArray(plan.commands)||!Array.isArray(plan.definitions)||!Array.isArray(shared)||shared.length!==plan.allocations.length||shared.some(x=>typeof x!=='boolean')||!Array.isArray(commands)||commands.length!==plan.commands.length||!Array.isArray(definitions)||!definitions.length)throw Error('Complete original and lowered graph required');
 integer(plan.readback,'readback allocation',0,plan.allocations.length-1);if(shared[plan.readback])throw Error('Readback cannot be shared');
 const external=new Set(),allocations=plan.allocations.map((a,i)=>{bytes(a.size,'world allocation '+i);if(a.external!==null&&!['prepared','status'].includes(a.external))throw Error('Unknown external allocation role');if(a.external){if(external.has(a.external)||shared[i]||a.size!==(a.external==='prepared'?768:64))throw Error('Exact private raw external role required');external.add(a.external);}const words=product(a.size/4,shared[i]?1:count,'world arena words');return {role:'world:'+i,bytes:words*4,usage:140,external:a.external};});
 if(external.size!==2)throw Error('Both raw external roles required');
 const views=[],bindingOffsets=[],dispatches=[],indexProducts=[],viewKeys=new Set(),dispatchKeys=new Set(),indexKeys=new Set();
 const recordIndex=x=>{const key=JSON.stringify(x);if(!indexKeys.has(key)){indexKeys.add(key);indexProducts.push(x);}};
 const recordDispatch=x=>{const key=JSON.stringify(x);if(!dispatchKeys.has(key)){dispatchKeys.add(key);dispatches.push(x);}};let maxBindings=0,maxStorage=0,maxWorkgroupX=32,maxDispatch=count;
 const range=(offset,size,allocationSize)=>{integer(offset,'binding offset');bytes(size,'binding size');if(offset%4||!Number.isSafeInteger(offset+size)||offset+size>allocationSize)throw Error('Binding view escapes allocation');};
 const addView=(role,offset,size,allocationSize)=>{range(offset,size,allocationSize);const key=JSON.stringify([role,offset,size]);if(!viewKeys.has(key)){viewKeys.add(key);views.push({role,offset,size});bindingOffsets.push(offset);}};
 const shape=definitions.map(d=>{const bindings=storage(d.code),x=workgroup(d.code);
  if(d.layout!=='auto'){if(!d.layout||!Array.isArray(d.layout.bindGroupLayouts)||d.layout.bindGroupLayouts.length!==1)throw Error('One explicit layout group required');const entries=d.layout.bindGroupLayouts[0].entries;if(!Array.isArray(entries)||entries.length!==bindings.length||entries.some((e,i)=>e.binding!==i||e.visibility!==4||!e.buffer||e.buffer.hasDynamicOffset||e.buffer.minBindingSize||e.buffer.type!==(bindings.find(b=>b.binding===i)?.access==='read'?'read-only-storage':'storage')))throw Error('Exact storage-only explicit layout required');}
  maxWorkgroupX=Math.max(maxWorkgroupX,x);return {bindings,x};});
 const sourceAccess=plan.definitions.map(d=>storage(d.source));
 // Prove every original local view and sharing classification before widened bindings.
 for(const c of plan.commands){
  if(c.kind==='dispatch'){
   integer(c.definition,'source definition',0,plan.definitions.length-1);
   if(c.indirect){const a=c.indirect;integer(a.buffer,'indirect allocation',0,allocations.length-1);if(plan.allocations[a.buffer].size!==32||shared[a.buffer]||![8,20].includes(a.offset)||![1,3,4].includes(a.bound))throw Error('Exact candidate-local indirect config required');recordIndex({kind:'indirect-config-last-word',allocation:a.buffer,value:product(count,8,'indirect config words')-1});}
   const d=plan.definitions[c.definition],access=sourceAccess[c.definition];if(!Array.isArray(c.entries)||!Array.isArray(d.ownership)||access.length!==c.entries.length||d.ownership.length!==c.entries.length)throw Error('Source ownership arity mismatch');
   c.entries.forEach((e,j)=>{integer(e.buffer,'source allocation',0,allocations.length-1);const a=plan.allocations[e.buffer],o=d.ownership[j];if(e.binding!==access[j].binding||e.binding!==j||!o||o.stride!==a.size/4||o.base!==e.offset/4||o.length!==e.size/4)throw Error('Exact source ownership mismatch');range(e.offset,e.size,a.size);if(access[j].access==='read_write'&&shared[e.buffer])throw Error('Mutable source allocation marked shared');const last=shared[e.buffer]?o.base+o.length-1:product(count-1,o.stride,'candidate stride product')+o.base+o.length-1;integer(last,'last local word address',0,U32);recordIndex({kind:'local-view',allocation:e.buffer,lastWord:last});});
  }else if(c.kind==='copy'){for(const id of [c.source,c.target])integer(id,'copy allocation',0,allocations.length-1);if(shared[c.target])throw Error('Copy target marked shared');range(c.sourceOffset,c.size,plan.allocations[c.source].size);range(c.targetOffset,c.size,plan.allocations[c.target].size);
  }else if(c.kind==='clear'){integer(c.buffer,'clear allocation',0,allocations.length-1);if(shared[c.buffer])throw Error('Clear target marked shared');range(c.offset,c.size,plan.allocations[c.buffer].size);
  }else throw Error('Unknown source command');
 }
 // Actual widened bind groups and dispatches, including the extra sticky fault binding.
 for(const c of commands){
  if(c.kind==='clear'){integer(c.buffer,'lowered clear',0,allocations.length-1);if(shared[c.buffer]||c.offset!==0||c.size!==plan.allocations[c.buffer].size)throw Error('Only complete private lowered clears');continue;}
  if(c.kind!=='dispatch')throw Error('Unknown lowered command');integer(c.definition,'lowered definition',0,definitions.length-1);integer(c.x,'dispatch x',1,U32);
  const d=definitions[c.definition],s=shape[c.definition],entries=c.entries;if(!Array.isArray(entries))throw Error('Lowered entries required');const map=new Map();
  for(const e of entries){integer(e.buffer,'lowered allocation',0,allocations.length-1);integer(e.binding,'binding index',0,U32);if(map.has(e.binding))throw Error('Duplicate binding');map.set(e.binding,true);const a=allocations[e.buffer];if(!shared[e.buffer]&&(e.offset!==0||e.size!==a.bytes))throw Error('Complete candidate-local arena binding required');addView(a.role,e.offset,e.size,a.bytes);}
  if(d.faultBinding!==null){integer(d.faultBinding,'fault binding',0,U32);if(map.has(d.faultBinding))throw Error('Fault binding alias');map.set(d.faultBinding,true);addView('fault',0,count*4,count*4);}
  if(map.size!==s.bindings.length||s.bindings.some(b=>!map.has(b.binding))||[...map.keys()].some(b=>b>=map.size))throw Error('Exact contiguous lowered binding shape required');
  maxBindings=Math.max(maxBindings,map.size);maxStorage=Math.max(maxStorage,map.size);maxDispatch=Math.max(maxDispatch,c.x);product(c.x,s.x,'global x invocation count');recordDispatch({x:c.x,y:count,z:1,workgroupSize:[s.x,1,1]});
 }
 const raw=rawResources(rawAllocations,count);
 for(const a of raw)addView(a.role,0,a.bytes,a.bytes);
 maxBindings=Math.max(maxBindings,7);maxStorage=Math.max(maxStorage,7);
 const rawGroups=Math.ceil(count/32),padded=product(rawGroups,32,'padded raw invocation count'),preGuardRawRowBase=product(padded-1,16,'raw preguard row base'),stride=plan.allocations[plan.readback].size/4;
 if(stride<4)throw Error('Complete result stride required');const gateIntermediate=product(count,stride,'final gate intermediate');
 recordDispatch({x:rawGroups,y:1,z:1,workgroupSize:[32,1,1]});recordDispatch({x:count,y:1,z:1,workgroupSize:[1,1,1]});
 indexProducts.push({kind:'raw-pre-guard-row-base',value:preGuardRawRowBase},{kind:'final-gate-intermediate',value:gateIntermediate});
 for(const [role,words]of [['strikeInput',16],['strikeResult',128],['strikeScratch',32],['prepared',192],['status',16]])indexProducts.push({kind:'raw-active-last-word',role,value:product(count,words,'raw '+role+' words')-1});

 const readBytes=bytes(diagnostic?gateIntermediate*4:count*16,'readback bytes'),worldOwned=allocations.filter(a=>!a.external),extra=[{role:'fault',bytes:count*4,usage:136},{role:'ids',bytes:count*4,usage:136},{role:'map-readback',bytes:readBytes,usage:9}],all=[...worldOwned,...raw,...extra];
 addView('final-result',0,allocations[plan.readback].bytes,allocations[plan.readback].bytes);addView('ids',0,count*4,count*4);addView('fault',0,count*4,count*4);
 const totalOwnedBytes=integer(all.reduce((s,a)=>s+a.bytes,0),'total owned bytes',1),totalWorldOwnedBytes=worldOwned.reduce((s,a)=>s+a.bytes,0)+extra.reduce((s,a)=>s+a.bytes,0);
 const result=freeze({kind:'live-world-resource-plan-v1',count,diagnostic,allocations:all,views,dispatches,indexProducts,raw:{groups:rawGroups,paddedInvocations:padded,preGuardRowBase:preGuardRawRowBase},finalStride:stride,totalOwnedBytes,totalWorldOwnedBytes,bindingOffsets:[...new Set(bindingOffsets)],requiredLimits:{maxBufferSize:Math.max(...all.map(a=>a.bytes)),maxStorageBufferBindingSize:Math.max(...views.map(v=>v.size)),maxBindGroups:1,maxBindingsPerBindGroup:Math.max(3,maxBindings),maxStorageBuffersPerShaderStage:Math.max(3,maxStorage),maxComputeWorkgroupsPerDimension:Math.max(maxDispatch,rawGroups),maxComputeWorkgroupSizeX:maxWorkgroupX,maxComputeWorkgroupSizeY:1,maxComputeWorkgroupSizeZ:1,maxComputeInvocationsPerWorkgroup:maxWorkgroupX},gpuExecutionQualified:false});owned.add(result);return result;
}
export function validateLiveWorldResources(resourcePlan,limits,{maximumOwnedBytes}={}){
 if(!owned.has(resourcePlan))throw TypeError('Owned immutable resource plan required');integer(maximumOwnedBytes,'mandatory total owned byte budget',1);if(resourcePlan.totalOwnedBytes>maximumOwnedBytes)throw RangeError('Total owned byte budget exceeded');
 if(!limits||typeof limits!=='object')throw TypeError('Actual device limits required');
 for(const [name,required]of Object.entries(resourcePlan.requiredLimits)){integer(limits[name],'device '+name,1);if(limits[name]<required)throw RangeError('Device limit insufficient: '+name);}
 const alignment=integer(limits.minStorageBufferOffsetAlignment,'device minStorageBufferOffsetAlignment',1);if(resourcePlan.bindingOffsets.some(offset=>offset%alignment))throw RangeError('Storage binding offset alignment unsupported');
 return resourcePlan;
}
