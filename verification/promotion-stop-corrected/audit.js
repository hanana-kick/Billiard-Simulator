'use strict';
// Bounded plain-data capture. This is NOT an adversarial-object sandbox: input
// is trusted app/CDP data. No accessor or toJSON hook is evaluated. Object key
// enumeration and native CDP delivery have unavoidable engine allocations.
function createCaptureStore(options = {}) {
 const limits = {maxValueBytes:4*1024*1024,maxSourceBytes:8*1024*1024,maxNodes:1048576,maxDepth:32,maxArray:262144,maxKeys:256,maxEvents:30000,maxEventBytes:128*1024,maxBytes:32*1024*1024,maxPayloads:128,...options};
 let failure=null,bytes=0,count=0,payloadBytes=0; const payloads=new Map(),payloadIds=new Map(),encoder=new TextEncoder();
 const fail=reason=>{if(!failure)failure=String(reason).slice(0,200);return null;};
 function json(value,maxBytes=limits.maxValueBytes){
  let nodes=0,used=0;const ancestors=new Set();
  function charge(n){used+=n;if(used>maxBytes)throw Error('capture byte limit');}
  function string(s){if(s.length>maxBytes)throw Error('capture string limit');const q=JSON.stringify(s);charge(encoder.encode(q).length);return s;}
  function visit(x,depth){if(depth>limits.maxDepth||++nodes>limits.maxNodes)throw Error('capture complexity limit');if(x===undefined)return null;if(x===null){charge(4);return null;}if(typeof x==='string')return string(x);if(typeof x==='number'){if(!Number.isFinite(x))throw Error('nonfinite capture');charge(String(x).length);return x;}if(typeof x==='boolean'){charge(x?4:5);return x;}if(typeof x!=='object')throw Error('unsupported capture');if(ancestors.has(x))throw Error('cyclic capture');ancestors.add(x);charge(2);let y;
   if(Array.isArray(x)||x instanceof Uint8Array){if(x.length>limits.maxArray)throw Error('capture array limit');y=[];for(let i=0;i<x.length;i++){if(i)charge(1);const d=Object.getOwnPropertyDescriptor(x,String(i));if(!d||!Object.hasOwn(d,'value'))throw Error('capture array accessor/hole');y.push(visit(d.value,depth+1));}}
   else{if(![Object.prototype,null].includes(Object.getPrototypeOf(x)))throw Error('nonplain capture');y=Object.create(null);let n=0;for(const key in x){if(!Object.hasOwn(x,key))throw Error('inherited capture key');if(++n>limits.maxKeys)throw Error('capture key limit');const d=Object.getOwnPropertyDescriptor(x,key);if(!Object.hasOwn(d,'value'))throw Error('capture accessor');if(d.value===undefined)continue;if(Object.keys(y).length)charge(1);string(key);charge(1);y[key]=visit(d.value,depth+1);}}
   ancestors.delete(x);return y;
  }
  return JSON.stringify(visit(value,0));
 }
 // Synchronous SHA-256, needed before a native dispatch returns. Digests are
 // recomputed with Node crypto on receipt before payloads become evidence.
 function sha256(text){const data=encoder.encode(text),bitLength=data.length*8,size=Math.ceil((data.length+9)/64)*64,b=new Uint8Array(size);b.set(data);b[data.length]=128;const v=new DataView(b.buffer);v.setUint32(size-8,Math.floor(bitLength/4294967296));v.setUint32(size-4,bitLength>>>0);const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];const ro=(x,n)=>(x>>>n)|(x<<(32-n)),w=new Uint32Array(64);for(let p=0;p<size;p+=64){for(let i=0;i<16;i++)w[i]=v.getUint32(p+i*4);for(let i=16;i<64;i++){const a=w[i-15],c=w[i-2];w[i]=(w[i-16]+(ro(a,7)^ro(a,18)^(a>>>3))+w[i-7]+(ro(c,17)^ro(c,19)^(c>>>10)))>>>0;}let[a,c,d,e,f,g,j,l]=h;for(let i=0;i<64;i++){const t=(l+(ro(f,6)^ro(f,11)^ro(f,25))+((f&g)^(~f&j))+k[i]+w[i])>>>0,u=((ro(a,2)^ro(a,13)^ro(a,22))+((a&c)^(a&d)^(c&d)))>>>0;l=j;j=g;g=f;f=(e+t)>>>0;e=d;d=c;c=a;a=(t+u)>>>0;}[a,c,d,e,f,g,j,l].forEach((x,i)=>h[i]=(h[i]+x)>>>0);}return [...h].map(x=>x.toString(16).padStart(8,'0')).join('');}
 // Automatic packing uses a uniform 4096-byte minimum for existing candidate
 // values. Smaller values stay exact inline data, reserving dictionary entries
 // without a new format, hidden cache, eviction, or relaxed admission limit.
 // Explicit payload() calls retain their existing immutable identity semantics.
 // All existing byte, event and dictionary-entry caps remain hard limits.
 function checkReferences(x){if(!x||typeof x!=='object')return;if(Object.hasOwn(x,'$missing'))throw Error('Missing capture payload');if(Object.hasOwn(x,'$payload')){if(Object.keys(x).length!==1||typeof x.$payload!=='string'||!/[a-f0-9]{64}/.test(x.$payload)||x.$payload.length!==64||!payloads.has(x.$payload))throw Error('Missing or invalid payload reference');return;}for(const v of Object.values(x))checkReferences(v);}
 // The reverse index shares each retained immutable text with payloads, and is
 // bounded by the same 128 entries. Repeated content needs no repeated SHA-256.
 function intern(text){if(failure)return {$missing:true};try{let id=payloadIds.get(text);if(!id){id=sha256(text);const n=encoder.encode(text).length;if(payloads.size>=limits.maxPayloads||payloadBytes+n>limits.maxBytes)throw Error('capture payload limit');payloadBytes+=n;payloads.set(id,text);payloadIds.set(text,id);}return {$payload:id};}catch(e){fail(e.message);return {$missing:true};}}
 function payload(value){if(failure)return {$missing:true};try{const text=json(value);checkReferences(JSON.parse(text));return intern(text);}catch(e){fail(e.message);return {$missing:true};}}
 function pack(value){const text=json(value),cloned=JSON.parse(text);checkReferences(cloned);function walk(x){if(!x||typeof x!=='object'||Object.hasOwn(x,'$payload'))return x;if(Array.isArray(x))return x.map(walk);const out=Object.create(null);for(const[k,v]of Object.entries(x)){if(k==='occurrences'&&x.type==='audit-observation-repeats'){out[k]=walk(v);continue;}if(v&&typeof v==='object'&&Object.hasOwn(v,'$payload')){out[k]=v;continue;}const evidence=['request','source','snapshot','results','firstRows'].includes(k)&&v!==null;const candidate=evidence||Array.isArray(v),serialized=candidate?JSON.stringify(v):null,n=candidate?encoder.encode(serialized).length:0;out[k]=(candidate&&n>=4096)?intern(serialized):walk(v);}return out;}return walk(cloned);}
 function capture(value){if(failure)return null;try{if(count>=limits.maxEvents)throw Error('capture event count limit');const packed=pack(value);if(failure)throw Error(failure);const text=json(packed,limits.maxEventBytes),n=encoder.encode(text).length;if(bytes+n>limits.maxBytes)throw Error('capture event byte limit');bytes+=n;count++;return JSON.parse(text);}catch(e){return fail(e.message);}}
 function snapshot(value){try{return JSON.parse(json(value));}catch(e){fail(e.message);throw e;}}
 function importPayload(id,text){if(failure)return false;try{if(typeof text!=='string'||text.length>limits.maxValueBytes||encoder.encode(text).length>limits.maxValueBytes||sha256(text)!==id)throw Error('invalid imported payload');const value=JSON.parse(text);json(value);checkReferences(value);if(payloads.has(id))return false;if(payloads.size>=limits.maxPayloads||payloadBytes+encoder.encode(text).length>limits.maxBytes)throw Error('import payload limit');payloads.set(id,text);payloadIds.set(text,id);payloadBytes+=encoder.encode(text).length;return true;}catch(e){fail(e.message);return false;}}


 // Only exact repetitions of declared observational summaries are eligible.
 // Evaluator/forecast lifecycle, dispatch, handler, result, verified identity,
 // outcome, error and unknown-shape events always remain individual records.
 function observationKind(e){
  if(!e||typeof e!=='object'||!Number.isFinite(e.at)||typeof e.scope!=='string'||e.scope.length>2048)return null;
  const keys=Object.keys(e),allowed=xs=>keys.every(k=>xs.includes(k)),base=['at','scope','type','__promotionAudit'];
  if(Object.hasOwn(e,'__promotionAudit')&&e.__promotionAudit!==true)return null;
  if(e.type==='service-report-entry'||e.type==='service-report-return'){
   const state=['serviceId','searchId','requestObjectId','background','suspended','version','goal','requestGoal','target','wave','latest','completed','pending','busy','liveWorkers','activeEvaluations','pause','retryOverhead','retention'];
   if(!allowed([...base,...state,...(e.type==='service-report-entry'?['final']:[])])||!state.every(k=>Object.hasOwn(e,k))||!Number.isSafeInteger(e.serviceId)||e.serviceId<1||!Number.isSafeInteger(e.version)||typeof e.background!=='boolean'||typeof e.latest!=='boolean'||e.type==='service-report-entry'&&e.final!==false)return null;
   return 'service-report';
  }
  if(!['worker-post','worker-receive'].includes(e.type)||!allowed([...base,'workerId','error','messageType','requestId','candidateId','identities','termination','cost'])||e.error!==null||!Array.isArray(e.identities)||e.identities.length!==0||!Number.isSafeInteger(e.requestId))return null;
  if(e.type==='worker-receive'&&(typeof e.workerId!=='string'||e.workerId.length>2048))return null;
  if(e.type==='worker-post'&&Object.hasOwn(e,'workerId'))return null;
  if(e.messageType===undefined)return Number.isSafeInteger(e.candidateId)&&e.cost===null&&!Object.hasOwn(e,'termination')?'nested-progress':null;
  if(e.messageType!=='progress'||Object.hasOwn(e,'candidateId')||e.termination!=='running'||!e.cost||typeof e.cost!=='object'||Array.isArray(e.cost)||Object.keys(e.cost).some(k=>!['tested','physicsSteps','workAttemptTotal'].includes(k)))return null;
  if(!['tested','physicsSteps'].every(k=>Number.isFinite(e.cost[k])&&e.cost[k]>=0))return null;
  const w=e.cost.workAttemptTotal;if(w!==undefined&&(!w||typeof w!=='object'||Array.isArray(w)||Object.keys(w).sort().join(',')!=='physicsSteps,reportedLowerBound,tested'||w.reportedLowerBound!==true||!['tested','physicsSteps'].every(k=>Number.isFinite(w[k])&&w[k]>=0)))return null;
  return 'coordinator-progress';
 }
 function observationEncoder(transport){
  const policy=Object.freeze({maxOccurrences:65536,maxExpandedBytes:limits.maxBytes,maxBatch:32,maxStreams:128,maxTemplateBytes:limits.maxValueBytes}),streams=new Map();let observed=0,repeated=0,repeatRows=0,templateBytes=0,expandedBytes=0,pending=[];
  const charge=n=>{expandedBytes+=n;if(expandedBytes>policy.maxExpandedBytes)throw Error('audit expanded byte limit');};
  const save=e=>{const v=capture(e);if(v){if(e.type!=='audit-observation-repeats'){const {auditIndex,...original}=v;charge(encoder.encode(JSON.stringify(original)).length);}transport(v);}return v;};
  const flush=()=>{if(failure)return false;if(!pending.length)return true;const occurrences=pending;pending=[];if(!save({type:'audit-observation-repeats',occurrences}))return false;repeatRows++;return true;};
  const remove=key=>{const old=streams.get(key);if(old){templateBytes-=old.bytes;streams.delete(key);}};
  function observe(e){
   if(failure)return false;
   try{
    if(observed>=policy.maxOccurrences)throw Error('audit expanded occurrence limit');
    // Validate before reading classification or reserved metadata fields.
    const plain=JSON.parse(json(e));if(Object.hasOwn(plain,'auditIndex')||plain.type==='audit-observation-repeats')throw Error('reserved audit compression metadata');
    if(!Number.isFinite(plain.at))throw Error('invalid audit timestamp');
    const index=observed++,kind=observationKind(plain),key=kind?JSON.stringify([plain.scope,plain.type,plain.workerId??null,plain.serviceId??null]):null;
    if(!kind)return !!save({...plain,auditIndex:index});
    const {at,...body}=plain,text=JSON.stringify(body),n=encoder.encode(text).length,old=streams.get(key);
    if(old&&old.text===text){if(at<old.lastAt)throw Error('audit observation time reversed');charge(old.repeatBytes+6+String(at).length);old.lastAt=at;pending.push([index,old.index,at]);repeated++;return pending.length<policy.maxBatch||flush();}
    remove(key);
    while(streams.size>=policy.maxStreams||templateBytes+n>policy.maxTemplateBytes){if(!streams.size)throw Error('audit observation template limit');remove(streams.keys().next().value);}
    const saved=save({...plain,auditIndex:index});if(!saved)return false;
    const {auditIndex:_,at:savedAt,...packedBody}=saved,repeatBytes=encoder.encode(JSON.stringify(packedBody)).length;
    streams.set(key,{index,text,bytes:n,repeatBytes,lastAt:at});templateBytes+=n;return true;
   }catch(e){fail(e.message);return false;}
  }
  return {observe,flush,policy,status:()=>({schema:'exact-observation-repeats-v1',observedOccurrences:observed,expandedBytes,maxExpandedBytes:policy.maxExpandedBytes,repeatedOccurrences:repeated,repeatRows,pendingOccurrences:pending.length,templateStreams:streams.size,templateBytes,maxOccurrences:policy.maxOccurrences})};
 }

 return {observationKind,observationEncoder,importPayload,limits,payloads,json,sha256,payload,pack,capture,snapshot,fail,status:()=>({complete:failure===null,failure,events:count,eventBytes:bytes,payloads:payloads.size,payloadBytes})};
}

// Verification-only transport/physical-lifecycle observations. No timer wrappers.
function installPromotionAudit(scope='page',workerRealm=false,createStore=createCaptureStore){
 const G=globalThis,epoch=()=>performance.timeOrigin+performance.now(),native={Worker:G.Worker,Blob:G.Blob,create:G.URL.createObjectURL.bind(G.URL),post:workerRealm?G.postMessage.bind(G):null};
 const events=[],children=new Map(),urls=new Map(),sources=[],deferred=[],store=createStore({maxEvents:65536}),sentPayloads=new Set(),sourceHashes=new Map(),pendingSources=new Set(),sourceTasks=new Set();let serial=0,ready=!workerRealm,currentMessage=null,overflowSent=false,staleBytes=0,sourceTextBytes=0,firstOverflow=null;
 // Workers retain no event list: admit up to the existing page-wide expanded
 // ceiling, without buffering or changing a single native application message.
 // Page compact rows share that finite ceiling; generic store defaults stay 30000.
 // The 32 MiB ORIGINAL packed-event byte cap remains independent.
 // Downstream host admission is independent. Limits count the entire realm lifetime, including forwarded data.
 const capturePolicy=Object.freeze({workerMaxOriginalOccurrences:65536,pageMaxCompactRows:65536,maxPackedOriginalBytes:32*1024*1024,maxOverflowBytes:512*1024,workerTransport:'immediate-original'});
 const overflow=(reason,origin=null)=>{const prior=store.status();store.fail(reason);if(!firstOverflow){const s=store.status();firstOverflow=Object.freeze(origin&&prior.complete?origin:{scope,failureScope:scope,reason:s.failure,events:s.events,eventBytes:s.eventBytes,payloads:s.payloads,payloadBytes:s.payloadBytes,maxEvents:store.limits.maxEvents,maxBytes:store.limits.maxBytes,maxEventBytes:store.limits.maxEventBytes,maxPayloads:store.limits.maxPayloads,unit:workerRealm?'original-occurrences':'compact-rows'});}if(workerRealm&&ready&&!overflowSent){overflowSent=true;native.post({__promotionOverflow:true,scope,reason:store.status().failure,origin:firstOverflow});}};
 // Forward the first origin unchanged, never substitute a coordinator's own
 // smaller counters. Validate before reading metadata (no accessors/toJSON).
 const forwardOverflow=(value,childId)=>{if(firstOverflow)return;try{const x=JSON.parse(store.json(value,capturePolicy.maxOverflowBytes)),o=x.origin,keys=['scope','failureScope','reason','events','eventBytes','payloads','payloadBytes','maxEvents','maxBytes','maxEventBytes','maxPayloads','unit'];
  if(Object.keys(x).sort().join(',')!=='__promotionOverflow,origin,reason,scope'||x.__promotionOverflow!==true||x.scope!==childId||!o||Object.keys(o).sort().join(',')!==keys.sort().join(',')||typeof o.scope!=='string'||o.scope.length>store.limits.maxEventBytes||!(o.scope.startsWith(childId)&&/^(\.w[1-9][0-9]*)*$/.test(o.scope.slice(childId.length)))||!['pending',o.scope].includes(o.failureScope)||typeof o.reason!=='string'||o.reason.length<1||o.reason.length>200||x.reason!==o.reason||o.unit!=='original-occurrences')throw Error('invalid forwarded capture overflow');
  for(const [name,max]of[['maxEvents',65536],['maxBytes',33554432],['maxEventBytes',131072],['maxPayloads',128]])if(!Number.isSafeInteger(o[name])||o[name]<0||o[name]>max)throw Error('invalid forwarded capture overflow');
  for(const [name,limit]of[['events','maxEvents'],['eventBytes','maxBytes'],['payloads','maxPayloads'],['payloadBytes','maxBytes']])if(!Number.isSafeInteger(o[name])||o[name]<0||o[name]>o[limit])throw Error('invalid forwarded capture overflow');
  overflow(o.reason,o);
 }catch(e){overflow(e.message);}};
 const transport=e=>{if(workerRealm){if(!ready){if(deferred.length>=128){overflow('deferred audit limit');return;}deferred.push(e);return;}for(const[id,text]of store.payloads)if(!sentPayloads.has(id)){native.post({__promotionPayload:true,id,text});sentPayloads.add(id);}native.post({__promotionAudit:true,...e});}else events.push(e);};
 const observation=workerRealm?null:store.observationEncoder(transport);
 const send=e=>{if(!store.status().complete){overflow(store.status().failure);return;}if(e.type==='worker-source-pending')pendingSources.add(e.sourceId);if(e.type==='worker-source')pendingSources.delete(e.sourceId);if(observation){if(!observation.observe(e))overflow(store.status().failure);}else{const value=store.capture(e);if(value)transport(value);else overflow(store.status().failure);}};
 const limited=(x,limit=2048)=>{if(x.length>limit){overflow('audit list limit');return [];}return x;};
 const list=(x,kind='values')=>{if(x.size>2048){overflow('audit collection limit');return [];}return [...x[kind]()];};
 const remember=(w,data)=>{if(!['result','progress'].includes(data?.type)||!Number.isFinite(data.requestId))return;if(!w.received.has(data.requestId)&&w.received.size>=16){overflow('stale epoch history limit');return;}try{const text=store.json(data),n=new TextEncoder().encode(text).length,previous=w.received.get(data.requestId)?.bytes||0;if(staleBytes-previous+n>store.limits.maxBytes){overflow('stale callback byte limit');return;}staleBytes=staleBytes-previous+n;w.received.set(data.requestId,{at:epoch(),type:data.type,requestId:data.requestId,text,bytes:n});}catch(e){overflow(e.message);}};
 const emit=(type,data={})=>send({at:epoch(),scope,type,...data});
 const brief=m=>({error:m?.error??null,messageType:m?.type,requestId:m?.requestId,candidateId:m?.candidateId,wave:m?.job?.wave,background:m?.background});
 const rows=m=>m?.value?.results||m?.value?.partialResult?.results||m?.result?.results||[];
 const summarize=m=>({...brief(m),...(m?.outcome?{outcome:{purpose:m.outcome.purpose,verified:m.outcome.verified,goalVerified:m.outcome.goalVerified,completePhysicalReplay:m.outcome.completePhysicalReplay,steps:m.outcome.steps}}:{}),...(m?.type==='error'?{error:m.value??m.error??m.message}:{}),identities:limited(rows(m)).map(r=>G.LabRouteRules?.successIdentity(r)||JSON.stringify(r)),termination:m?.value?.terminationReason,cost:m?.value?{tested:m.value.tested,physicsSteps:m.value.physicsSteps,workAttemptTotal:m.value.workAttemptTotal}:null});
 // Source observation covers every bounded string Blob, independently of solver hooks.
 // Ordinary workers retain exact bytes and lifecycle capture, without private init messages.
 G.Blob=class extends native.Blob{constructor(parts=[],options){const text=parts.length<=256&&parts.every(p=>typeof p==='string')&&parts.reduce((n,p)=>n+p.length,0)<=store.limits.maxSourceBytes?parts.join(''):null,instrumented=text!==null&&/LabForecast|OptimizerService|LabInverseEvents/.test(text)&&!text.includes('__promotionAudit');super(instrumented?[...parts,'\n;(',installPromotionAudit.toString(),')("pending",true,',createStore.toString(),');\n']:parts,options);this.__promotionOriginal=text;this.__promotionInstrumented=instrumented;}};
 G.URL.createObjectURL=function(blob){const url=native.create(blob);if(typeof blob.__promotionOriginal==='string'){if(!store.status().complete)return url;if(workerRealm&&!ready){overflow('Source created before unique audit identity');return url;}const sourceId=scope+'.source'+(++serial);if(urls.size>=128){overflow('worker URL count limit');return url;}else urls.set(url,{observed:true,instrumented:blob.__promotionInstrumented===true,sourceId});const source=blob.__promotionOriginal,bytes=new TextEncoder().encode(source).length;if(bytes>store.limits.maxSourceBytes)overflow('worker source byte limit');else{emit('worker-source-pending',{sourceId,sourceBytes:bytes});if(!sourceHashes.has(source)){if(sourceTextBytes+bytes>store.limits.maxBytes){overflow('unique source hashing byte limit');return url;}sourceTextBytes+=bytes;const task=Promise.resolve().then(()=>{if(!G.crypto?.subtle)throw Error('Native source SHA-256 unavailable');return G.crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));}).then(buffer=>[...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join(''));sourceHashes.set(source,task);}const task=sourceHashes.get(source).then(sourceSHA=>emit('worker-source',{sourceId,sourceSHA,sourceBytes:bytes,sourceHashAlgorithm:'SHA-256',sourceRetention:'hash-only; exact embedded modules checked separately'}),e=>overflow('Source hash failed: '+e.message));sourceTasks.add(task);task.finally(()=>sourceTasks.delete(task));}}return url;};
 G.Worker=class extends native.Worker{constructor(url,options){super(url,options);const id=scope+'.w'+(++serial),entry=urls.get(String(url)),source=entry?.observed,sourceId=entry?.sourceId;this.__promotionId=id;if(!source)overflow('Unobserved worker source');if(workerRealm&&!ready)overflow('Worker created before audit identity');if(children.size>=128)overflow('worker count limit');else children.set(id,{worker:this,alive:true,sourceId,received:new Map()});emit('worker-created',{workerId:id,parent:scope,observed:!!source,instrumented:entry?.instrumented===true,sourceId});this.addEventListener('message',event=>{const overflowDescriptor=Object.getOwnPropertyDescriptor(event.data??{},'__promotionOverflow');if(overflowDescriptor&&(!Object.hasOwn(overflowDescriptor,'value')||overflowDescriptor.value)){forwardOverflow(event.data,id);event.stopImmediatePropagation();return;}if(event.data?.__promotionPayload){store.importPayload(event.data.id,event.data.text);if(!store.status().complete){overflow(store.status().failure);event.stopImmediatePropagation();return;}if(workerRealm&&ready&&!sentPayloads.has(event.data.id)){native.post(event.data);sentPayloads.add(event.data.id);}event.stopImmediatePropagation();return;}if(event.data?.__promotionAudit){send(event.data);event.stopImmediatePropagation();return;}const data=event.data;if(children.has(id))remember(children.get(id),data);emit('worker-receive',{workerId:id,...summarize(data)});});this.addEventListener('error',e=>emit('worker-error',{workerId:id,message:e.message}));if(entry?.instrumented)super.postMessage({__promotionInit:true,scope:id});}postMessage(data,...args){const id=this.__promotionId;emit('worker-dispatch',{workerId:id,...brief(data),...(data?.req?{request:data.req}:{}),...(data?.job?{jobId:data.job.id,jobKind:data.job.kind,jobPurpose:data.job.purpose,branchId:data.job.branchId,solverId:data.job.solverId}:{}),options:data?.options});return super.postMessage(data,...args);}terminate(){const id=this.__promotionId;if(children.has(id))children.get(id).alive=false;emit('worker-terminate',{workerId:id});return super.terminate();}};
 if(workerRealm){
  G.postMessage=function(data,...args){emit('worker-post',summarize(data));return native.post(data,...args);};
  const handler=G.onmessage;G.onmessage=function(event){if(event.data?.__promotionInit){scope=event.data.scope;ready=true;if(firstOverflow&&firstOverflow.scope==='pending')firstOverflow=Object.freeze({...firstOverflow,scope});for(const e of deferred.splice(0))transport({...e,scope});if(!store.status().complete)overflow(store.status().failure);emit('worker-identity-ready');return;}currentMessage=brief(event.data);emit('handler-entry',currentMessage);try{return Reflect.apply(handler,this,[event]);}finally{emit('handler-return',{...currentMessage,note:'Handler return is not async/search completion'});}};
  let jobCounter=0;const liveJobs=new Map();
  for(const[name,api]of[['evaluation',G.LabInverseEvents],['forecast',G.LabForecast]])if(api){const records=new WeakMap();
   for(const method of ['begin','advance','finish','dispose']){const original=api[method];if(typeof original!=='function')continue;
    api[method]=function(...args){const at=epoch();if(method==='begin'){const job=Reflect.apply(original,this,args),rec={id:++jobCounter,kind:name,request:currentMessage,start:at,calls:0,totalMs:0,steps:0,lastFlush:at,disposed:false};if(job&&typeof job==='object'){records.set(job,rec);if(liveJobs.size>=2048)overflow('live physical job count limit');else liveJobs.set(rec.id,rec);if(name==='forecast'&&job.lab?.dispose){const dispose=job.lab.dispose;job.lab.dispose=function(...x){if(!rec.disposed){rec.disposed=true;liveJobs.delete(rec.id);emit('forecast-dispose',{...rec});}return Reflect.apply(dispose,this,x);};}}emit(name+'-begin',{...rec});return job;}
     const rec=records.get(args[0]);try{return Reflect.apply(original,this,args);}finally{if(rec){if(method==='advance'){rec.calls++;rec.totalMs+=epoch()-at;rec.steps=args[0]?.trial?.steps??args[0]?.steps??null;if(rec.calls===1||epoch()-rec.lastFlush>=100){emit(name+'-advance',{...rec,callStart:at,callEnd:epoch(),elapsedNotCPU:true});rec.lastFlush=epoch();}}
      if(method==='finish'||method==='dispose'){rec.disposed=true;liveJobs.delete(rec.id);emit(name+'-'+method,{...rec,end:epoch()});}}}
    };
   }
  }
  const identities=new WeakMap();let objectSerial=0;const objectId=x=>{if(!x||typeof x!=='object')return null;if(!identities.has(x))identities.set(x,++objectSerial);return identities.get(x);};
  const serviceState=s=>({serviceId:objectId(s),searchId:objectId(s.search),requestObjectId:objectId(s.latest||s.search?.req),background:s.background,suspended:s.suspended??null,version:s.version,goal:s.foregroundSearchGoal??null,requestGoal:(s.latest||s.search?.req)?.options?.searchGoal??null,target:s.firstVerifiedTarget??null,wave:s.search?.wave??null,latest:!!s.latest,completed:s.outcomes?list(s.outcomes,'keys'):null,pending:(s.jobs?limited(s.jobs):undefined)?.map(j=>({id:j.id,wave:j.wave,kind:j.kind,purpose:j.purpose,branchId:j.branchId,solverId:j.solverId})),busy:s.busy?list(s.busy).map(t=>({id:t.job?.id,steps:t.steps??null})):null,liveWorkers:(s.workers?limited(s.workers):undefined)?.map(w=>w.__promotionId),activeEvaluations:list(liveJobs).filter(j=>j.kind==='evaluation'&&!j.disposed).map(j=>({id:j.id,request:j.request,steps:j.steps,calls:j.calls})),pause:s.firstVerifiedPause??null,retryOverhead:s.retryOverhead??null,retention:s.retention??null});
  if(G.OptimizerService)for(const method of ['request','promoteToForeground','resume','cancel','completeWave','stopWorkers','report']){const original=G.OptimizerService.prototype[method];if(typeof original!=='function')continue;G.OptimizerService.prototype[method]=function(...args){const before=serviceState(this),requestBefore=method==='promoteToForeground'?store.payload(this.latest||this.search?.req).$payload:null;emit('service-'+method+'-entry',{...before,...(method==='promoteToForeground'?{request:this.latest||this.search?.req}:{}),final:method==='report'?args[0]:undefined});try{return Reflect.apply(original,this,args);}finally{emit('service-'+method+'-return',{...serviceState(this),requestUnchanged:method==='promoteToForeground'?!!requestBefore&&store.payload(this.latest||this.search?.req).$payload===requestBefore:undefined});}};}
  emit('audit-installed');
 }else{
  // Optional bulk transfer changes only CDP round trips, never capture/codec
  // admission. Budget the complete UTF-8 response, including failure provenance.
  const readChunk=(offset,limit=256,maxBytes=262144)=>{
   if(!observation.flush())overflow(store.status().failure);
   const reject=reason=>{overflow(reason);throw Error(reason);};
   if(!Number.isSafeInteger(offset)||offset<0||offset>events.length||!Number.isSafeInteger(limit)||limit<1||limit>256||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>262144)return reject('Invalid audit chunk cursor or limit');
   // No await: total, producer counters and payload IDs are one snapshot. Using
   // next=total conservatively budgets cursor digits before selecting any row.
   const total=events.length,result={events:[],next:total,total,status:{...store.status(),pendingSources:pendingSources.size,observation:observation.status(),capturePolicy,firstOverflow},payloads:[...store.payloads.keys()]},utf8=new TextEncoder(),size=value=>utf8.encode(JSON.stringify(value)).length;
   let bytes=size(result);if(bytes>maxBytes)return reject('audit chunk envelope byte limit');
   for(let i=offset;i<total&&result.events.length<limit;i++){const n=size(events[i])+(result.events.length?1:0);if(bytes+n>maxBytes)break;result.events.push(events[i]);bytes+=n;}
   if(offset<total&&!result.events.length)return reject('audit chunk event byte limit');
   result.next=offset+result.events.length;if(size(result)>maxBytes)return reject('audit chunk response byte limit');return result;
  };
  G.__promotionAudit={events,children,sources,emit,epoch,store,readChunk,captureValue:value=>store.snapshot(value),async flushSources(){await Promise.all([...sourceTasks]);if(!observation.flush())overflow(store.status().failure);return {pendingSources:pendingSources.size,...store.status(),observation:observation.status(),capturePolicy,firstOverflow};},read(offset,limit=32){if(!observation.flush())overflow(store.status().failure);if(!Number.isInteger(offset)||offset<0||offset>events.length||limit>32)throw Error('Invalid audit cursor');return {events:events.slice(offset,offset+limit),next:Math.min(events.length,offset+limit),total:events.length,status:{...store.status(),pendingSources:pendingSources.size,observation:observation.status(),capturePolicy,firstOverflow},payloads:[...store.payloads.keys()]};},payloadPart(id,offset){const text=store.payloads.get(id);if(typeof text!=='string'||!Number.isInteger(offset)||offset<0||offset>text.length)throw Error('Missing payload');return {text:text.slice(offset,offset+8192),length:text.length};},attach(){const c=G.cueLab,n=c.nextShot,original=n.reconcile;n.reconcile=function(job,...args){const before={job,optimizer:job?.optimizer,worker:job?.optimizer?.worker,request:job?.optimizer?.latest,inputStamp:job?.inputStamp,expectedStamp:job?.expectedStamp,settings:JSON.stringify(c.state.settings),options:JSON.stringify(c.state.routeOptions)};emit('reconcile-entry',{generation:job?.generation,workerId:before.worker?.__promotionId,promoted:job?.promoted,inputStamp:before.inputStamp,expectedStamp:before.expectedStamp,snapshotMatches:job?.predicted?G.NextShotState.snapshotEqual(c.lab.snapshot({trails:false}),job.predicted.snapshot):null,gameMatches:job?.predicted?JSON.stringify(c.game.snapshot())===JSON.stringify(job.predicted.game):null,inputMatches:job?.predicted?this.inputStamp()===job.expectedStamp:null});const result=Reflect.apply(original,this,[job,...args]);emit('reconcile-return',{result,promoted:job?.promoted,sameCoordinator:c.optimizer===before.optimizer,sameWorker:c.optimizer?.worker===before.worker,workerId:c.optimizer?.worker?.__promotionId,requestUnchanged:before.request===job?.optimizer?.latest||!job?.optimizer?.latest,settingsUnchanged:JSON.stringify(c.state.settings)===before.settings,optionsUnchanged:JSON.stringify(c.state.routeOptions)===before.options,matched:c.state.nextShotPreparation?.matched,routeStamp:c.routeStamp,routeRequestStamp:c.routeRequestStamp});return result;};},stale(workerId){const w=children.get(workerId),c=G.cueLab,service=[c.optimizer,c.nextShot?.job?.optimizer].find(o=>o?.worker===w?.worker),currentVersion=service?.version,disposed=service?.disposed===true||w?.alive===false,old=w?[...w.received.values()].filter(x=>disposed||Number.isFinite(currentVersion)&&x.requestId!==currentVersion).sort((a,b)=>b.at-a.at)[0]:null;if(!old||!w.worker.onmessage)return {covered:false,reason:'No provably stale epoch on receiving service',currentVersion,disposed};emit('controlled-stale-start',{workerId,requestId:old.requestId,callbackRef:store.payload(JSON.parse(old.text))});Reflect.apply(w.worker.onmessage,w.worker,[{data:JSON.parse(old.text)}]);emit('controlled-stale-end',{workerId});return {covered:true,requestId:old.requestId,currentVersion,disposed};}};
 }
}

// Host-only decoder. The capture side never expands or changes native delivery.
// Returned events are the exact original packed observations, in original order.
function createAuditEventDecoder(){
 const maxOccurrences=65536,maxExpandedBytes=32*1024*1024,maxRows=maxOccurrences,maxBatch=32,validator=createCaptureStore(),slots=[],templates=new Map(),lastTimes=new Map(),lastIndices=new Map();let rows=0,observed=0,expandedBytes=0,next=0,mode=null,lastOriginal=-1,lastRepeat=-1,failure=null;
 const check=(ok,msg)=>{if(!ok)throw Error(msg);};
 const charge=e=>{expandedBytes+=new TextEncoder().encode(JSON.stringify(e)).length;check(expandedBytes<=maxExpandedBytes,'audit expanded byte limit');};
 function push(row){
  if(failure)throw Error(failure);
  try{
   row=JSON.parse(validator.json(row,validator.limits.maxEventBytes));check(++rows<=maxRows,'audit compact row limit');check(row&&typeof row==='object'&&!Array.isArray(row),'invalid compact audit row');
   const repeat=row.type==='audit-observation-repeats',indexed=Object.hasOwn(row,'auditIndex'),current=repeat||indexed?'indexed':'legacy';
   check(!mode||mode===current,'mixed audit compression schemas');mode=current;
   if(mode==='legacy'){check(observed<maxOccurrences,'audit expanded occurrence limit');charge(row);observed++;next++;return [row];}
   if(repeat){
    check(Object.keys(row).sort().join(',')==='occurrences,type','unknown repeat row field');
    check(Array.isArray(row.occurrences)&&row.occurrences.length>=1&&row.occurrences.length<=maxBatch,'audit repeat batch limit');
    let priorIndex=lastRepeat;
    for(const triple of row.occurrences){check(Array.isArray(triple)&&triple.length===3,'invalid audit repeat occurrence');const [index,templateIndex,at]=triple,t=templates.get(templateIndex);
     check(t&&validator.observationKind(t),'unknown or ineligible audit repeat template');
     check(Number.isSafeInteger(index)&&index>priorIndex&&index>lastIndices.get(templateIndex)&&index<maxOccurrences&&index>=next&&!Object.hasOwn(slots,index),'duplicate or out-of-order audit occurrence');
     check(Number.isFinite(at)&&at>=lastTimes.get(templateIndex),'invalid audit repeat timestamp');check(++observed<=maxOccurrences,'audit expanded occurrence limit');const event={...t,at};charge(event);slots[index]=event;priorIndex=index;lastIndices.set(templateIndex,index);lastTimes.set(templateIndex,at);lastRepeat=index;
    }
   }else{
    const {auditIndex:index,...event}=row;check(Number.isSafeInteger(index)&&index>=0&&index<maxOccurrences&&index>lastOriginal&&index>=next&&!Object.hasOwn(slots,index),'duplicate or out-of-order original audit occurrence');
    check(Number.isFinite(event.at),'invalid audit timestamp');check(++observed<=maxOccurrences,'audit expanded occurrence limit');charge(event);lastOriginal=index;slots[index]=event;
    if(validator.observationKind(event)){templates.set(index,event);lastTimes.set(index,event.at);lastIndices.set(index,index);}
   }
   const out=[];while(Object.hasOwn(slots,next)){out.push(slots[next]);delete slots[next++];}return out;
  }catch(e){failure=e.message;throw e;}
 }
 function finish(){if(failure)throw Error(failure);if(next!==observed){failure='missing expanded audit occurrence';throw Error(failure);}}
 return {push,finish,status:()=>({observed,expandedBytes,maxExpandedBytes,delivered:next,pending:observed-next,complete:failure===null,failure,maxOccurrences,compactRows:rows})};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createCaptureStore,installPromotionAudit,createAuditEventDecoder};else installPromotionAudit();

