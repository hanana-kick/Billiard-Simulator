// SPDX-License-Identifier: Apache-2.0
// Pure allocation arithmetic for explicit unaudited outer64 / audited impact192 profiles.
// No GPU, physics, source lowering, runtime admission or state uploads. Scaling
// metadata does not turn the fixed qualification roster into a production API.
import {INPUT_WORDS,RESULT_WORDS} from './abi.mjs';
import {MICROCODE_ISA as I} from './microcode-isa.mjs';
const U=0xffffffff,SHAPE='resident-microcode-resource-shape-v1';
const need=(ok,msg)=>{if(!ok)throw new RangeError('Microcode resources: '+msg);};
function uint(x,name,zero=false){need(Number.isSafeInteger(x)&&x>=(zero?0:1)&&x<=U,name+' bounded u32');return x;}
function add(a,b,name){const x=BigInt(a)+BigInt(b);need(x<=BigInt(Number.MAX_SAFE_INTEGER),name+' safe integer overflow');return Number(x);}
function mul(a,b,name){const x=BigInt(a)*BigInt(b);need(x<=BigInt(Number.MAX_SAFE_INTEGER),name+' safe integer overflow');return Number(x);}
const sum=xs=>xs.reduce((a,b)=>add(a,b,'byte sum'),0),words=x=>{uint(x,'buffer words');return mul(x,4,'buffer bytes');};
const exact=(x,keys,name)=>need(x&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|'),name+' exact fields');
const SHARED=['rawProgram','rawGeometry','worldTemplate','worldProgram','worldGeometry','microcode'];
const AUDITED_KIND='resident-raw-tip-impact-microcode-runtime-v1';
const DIMENSIONS=['worldWords','controlWords','requestWords','vmControlWords','vmLocalWords','vmStackWords','vmStrideWords','rawStateWords','rawScratchWords','numericScratchWords','scratchWords','inputWords','resultWords'];
function validateShape(s){
 const audited=s?.sourceRuntimeKind===AUDITED_KIND;exact(s,['kind','sourceRuntimeKind','sourceCount','sourceFrames','perCandidate','fixedCcdWords','sharedWords','workgroupSize','macroWorkgroupSize','storageBindings',...(audited?['auditWordsPerCandidate']:[])], 'shape');need(s.kind===SHAPE,'known resource shape');need(s.sourceCount===2&&(audited?s.sourceFrames===192:s.sourceRuntimeKind==='resident-raw-tip-outer-microcode-runtime-v1'&&s.sourceFrames===64),'named fixed two-row source profile only');if(audited)uint(s.auditWordsPerCandidate,'mandatory source audit words per candidate');
 exact(s.perCandidate,DIMENSIONS,'per-candidate dimensions');for(const[k,v]of Object.entries(s.perCandidate))uint(v,k);const p=s.perCandidate;
 need(p.controlWords===80&&p.requestWords===24&&p.vmControlWords===I.control.words&&p.vmStrideWords===p.vmControlWords+p.vmLocalWords+p.vmStackWords,'exact existing control/slab layout');need(p.scratchWords===Math.max(p.rawScratchWords,p.numericScratchWords),'raw/numeric scratch alias, not sum');need(p.inputWords===INPUT_WORDS&&p.resultWords===RESULT_WORDS,'existing input/result ABI');
 exact(s.sharedWords,SHARED,'shared allocations');for(const[k,v]of Object.entries(s.sharedWords))uint(v,k);uint(s.fixedCcdWords,'fixed CCD words');need(s.workgroupSize===64&&s.macroWorkgroupSize===1&&s.storageBindings===(audited?8:7),'exact core64/macros1 source binding profile');return s;
}
/** Reads only initial-runtime array lengths and allocation metadata. This is
 * shape consistency, NOT cryptographic provenance or physics validation. The
 * caller must retain/check the immutable runtime digest independently. */
export function deriveMicrocodeResourceShape(runtime){
 const p=runtime?.original,vm=runtime?.vm;need(p&&vm,'initial-only raw runtime required');const audited=runtime.kind===AUDITED_KIND;need(p.count===2&&(audited?p.frames===192:runtime.kind==='resident-raw-tip-outer-microcode-runtime-v1'&&p.frames===64),'named fixed two-row source profile');need(audited?Object.hasOwn(runtime,'audit')&&vm.eventAudit===true:!Object.hasOwn(runtime,'audit')&&!vm.eventAudit,'audit allocation must match the explicit source profile');
 const n=p.count,r=p.init?.resources,pc=p.pc;need(r&&pc,'original resources/PC');exact(r,['inputs','rawState','rawProgram','rawGeometry','rawScratch','worldState','worldTemplate','worldProgram','numericScratch'],'initializer resources');
 const length=(a,name)=>{need(a instanceof Uint32Array,name+' initial u32 array');return uint(a.length,name);};const each=(value,name)=>{uint(value,name);need(value%n===0,name+' exact per-candidate division');return value/n;};
 const uploads=p.init.initialUploads;need(Array.isArray(uploads)&&uploads.length===1&&uploads[0].resource==='worldState','one original fixed CCD upload');const fixedCcdWords=length(uploads[0].data,'fixed CCD');need(uploads[0].offsetWords===n*pc.stateWords&&r.worldState===n*pc.stateWords+fixedCcdWords&&pc.controlTailBase===r.worldState,'world + fixed CCD span');need(pc.requestTailBase===pc.controlTailBase+n*pc.controlWords&&pc.totalStateWords===pc.requestTailBase+n*pc.requestWordsPerCandidate,'source PC/request tails');
 need(pc.count===n&&pc.maxH===p.frames&&pc.programBase===r.worldProgram.length,'source PC profile/base');need(Array.isArray(vm.handlers)&&(audited?[3,4].includes(vm.handlers.length):vm.handlers.length===3)&&vm.handlers.every(h=>h.workgroupSize===1),'exact source macro WGS1 handlers');
 need(vm.stride===I.control.words+vm.localWords+vm.stackCapacity&&vm.totalWords===n*vm.stride,'VM storage slab');need(vm.code instanceof Uint32Array&&vm.code.length===vm.instructionCount*I.instructionWords,'complete immutable microcode');need(length(p.program,'world program')===length(r.worldProgram,'base world program')+length(pc.bytecode,'source PC code'),'world program appends PC bytecode');need(length(p.input,'inputs')===r.inputs,'raw input allocation');need(p.init.scratchAlias.rawScratch==='numericScratch','documented scratch alias');
 if(audited){const a=runtime.audit;need(a.kind==='resident-tip-impact-checkpoint-layout-v1'&&a.count===n&&a.stateWords===pc.stateWords&&a.sourceStateWords===pc.totalStateWords&&a.gpuAuditBinding===7&&a.sourceAuditBinding===5,'exact source audit binding/layout');need(a.auditStride===1028&&a.auditWords===n*a.auditStride&&a.snapshotBase===a.auditWords&&a.snapshotStride===pc.stateWords+16&&a.candidateSnapshotWords===n*a.snapshotStride&&a.points.length===2&&a.totalWords===a.auditWords+2*a.candidateSnapshotWords&&a.bytes===a.totalWords*4,'complete mandatory source audit snapshots');}
 return Object.freeze(validateShape({kind:SHAPE,sourceRuntimeKind:runtime.kind,sourceCount:n,sourceFrames:p.frames,...(audited?{auditWordsPerCandidate:runtime.audit.totalWords/n}:{}),perCandidate:Object.freeze({worldWords:pc.stateWords,controlWords:pc.controlWords,requestWords:pc.requestWordsPerCandidate,vmControlWords:I.control.words,vmLocalWords:vm.localWords,vmStackWords:vm.stackCapacity,vmStrideWords:vm.stride,rawStateWords:each(r.rawState,'raw state'),rawScratchWords:each(r.rawScratch,'raw scratch'),numericScratchWords:each(r.numericScratch,'numeric scratch'),scratchWords:each(p.init.scratchAlias.words,'scratch alias'),inputWords:each(r.inputs,'input'),resultWords:RESULT_WORDS}),fixedCcdWords,sharedWords:Object.freeze({rawProgram:length(r.rawProgram,'raw program'),rawGeometry:length(r.rawGeometry,'raw geometry'),worldTemplate:length(r.worldTemplate,'world clone template'),worldProgram:p.program.length,worldGeometry:length(p.sharedGeometry,'world geometry'),microcode:vm.code.length}),workgroupSize:vm.workgroupSize,macroWorkgroupSize:1,storageBindings:audited?8:7}));
}
const LIMIT_KEYS=['maxStorageBufferBindingSize','maxBufferSize','maxStorageBuffersPerShaderStage','maxBindingsPerBindGroup','maxBindGroups','maxComputeInvocationsPerWorkgroup','maxComputeWorkgroupSizeX','maxComputeWorkgroupsPerDimension'];
function validateLimits(l){exact(l,LIMIT_KEYS,'explicit device limits');for(const[k,v]of Object.entries(l))need(Number.isSafeInteger(v)&&v>0,k+' positive safe integer');return l;}
/** All buffer sizes are exact for the declared shape. Device/driver overhead,
 * pipeline compiler memory, host typed arrays and allocator padding are absent.
 * Compact output is a SEPARATE proposed allocation; this runtime currently only
 * maps full diagnostics and does not publish the defined four-word result ABI. */
export function calculateMicrocodeResources(shape,count,{limits,diagnosticCaptures=3}={}){
 validateShape(shape);validateLimits(limits);uint(count,'candidate count');need(count<=4096,'declared shape scaling capped at4096, not runtime admission');uint(diagnosticCaptures,'diagnostic captures');need(diagnosticCaptures<=64,'current retained-session capture cap');const p=shape.perCandidate;
 const dynamicWords={worldState:add(mul(count,sum([p.worldWords,p.controlWords,p.requestWords]),'world rows'),shape.fixedCcdWords,'world tail'),vmState:mul(count,p.vmStrideWords,'VM rows'),scratch:mul(count,p.scratchWords,'scratch rows'),rawState:mul(count,p.rawStateWords,'raw rows'),inputs:mul(count,p.inputWords,'input rows')};
 if(shape.auditWordsPerCandidate)dynamicWords.eventAudit=mul(count,shape.auditWordsPerCandidate,'mandatory source audit rows');
 const buffers=Object.fromEntries(Object.entries({...shape.sharedWords,...dynamicWords}).map(([name,n])=>[name,{words:uint(n,name+' words'),bytes:words(n),storage:true}]));const diagnosticWords=mul(sum([dynamicWords.worldState,dynamicWords.vmState,dynamicWords.eventAudit??0]),diagnosticCaptures,'diagnostic snapshots');uint(diagnosticWords,'diagnostic allocation words');buffers.diagnostics={words:diagnosticWords,bytes:words(diagnosticWords),storage:false};
 const resultWords=mul(count,p.resultWords,'compact rows'),resultBytes=words(resultWords),persistentSourceBytes=buffers.worldState.bytes,vmBytes=buffers.vmState.bytes,scratchBytes=buffers.scratch.bytes,inputBytes=buffers.inputs.bytes,initStateBytes=buffers.rawState.bytes,initReadonlyBytes=sum(['rawProgram','rawGeometry','worldTemplate'].map(k=>buffers[k].bytes)),residentReadonlyBytes=sum(['worldProgram','worldGeometry','microcode'].map(k=>buffers[k].bytes)),baseBytes=sum(Object.entries(buffers).filter(([k])=>k!=='diagnostics').map(([,b])=>b.bytes));
 const common=[];for(const[k,required]of Object.entries({maxStorageBuffersPerShaderStage:shape.storageBindings,maxBindingsPerBindGroup:shape.storageBindings,maxBindGroups:1,maxComputeInvocationsPerWorkgroup:shape.workgroupSize,maxComputeWorkgroupSizeX:shape.workgroupSize,maxComputeWorkgroupsPerDimension:count}))if(limits[k]<required)common.push({resource:k,required,limit:limits[k]});
 const fail=(entries)=>{const v=[...common];for(const[name,b]of entries){if(b.bytes>limits.maxBufferSize)v.push({resource:name,limitName:'maxBufferSize',required:b.bytes,limit:limits.maxBufferSize});if(b.storage&&b.bytes>limits.maxStorageBufferBindingSize)v.push({resource:name,limitName:'maxStorageBufferBindingSize',required:b.bytes,limit:limits.maxStorageBufferBindingSize});}return v;};
 const diagnosticViolations=fail(Object.entries(buffers)),compactViolations=fail([...Object.entries(buffers).filter(([name])=>name!=='diagnostics'),['compactResults',{bytes:resultBytes,storage:true}],['compactReadback',{bytes:resultBytes,storage:false}]]);
 return Object.freeze({kind:'resident-microcode-resource-estimate-v1',count,diagnosticCaptures,sourceQualification:{runtimeKind:shape.sourceRuntimeKind,sourceCount:shape.sourceCount,sourceFrames:shape.sourceFrames,exactSourceShape:count===shape.sourceCount,scaledRowsAdmitted:false,physicsQualified:false},bytes:{worlds:persistentSourceBytes,...(buffers.eventAudit?{mandatorySourceAudit:buffers.eventAudit.bytes}:{}),vm:vmBytes,scratch:scratchBytes,input:inputBytes,retainedInitialization:initStateBytes+initReadonlyBytes,initializationState:initStateBytes,initializationReadonly:initReadonlyBytes,residentReadonly:residentReadonlyBytes,totalReadonly:initReadonlyBytes+residentReadonlyBytes,currentBase:baseBytes,diagnostics:buffers.diagnostics.bytes,currentTestTotal:add(baseBytes,buffers.diagnostics.bytes,'current total'),proposedCompactResult:resultBytes,proposedCompactReadback:resultBytes,proposedCompactTotal:add(baseBytes,2*resultBytes,'compact total')},buffers,limits:{...limits},currentDiagnostics:{fits:diagnosticViolations.length===0,violations:diagnosticViolations},proposedCompact:{fits:compactViolations.length===0,violations:compactViolations,implemented:false},estimated:true,hardwareMeasured:false,limitFitOnly:true,memoryAvailabilityChecked:false,runtimeActivation:false});
}
/** Planning only. Banks keep every candidate's complete world/VM/scratch on
 * device; no bank state is spilled to CPU. This executor has no banked runtime
 * entry yet. Shared immutable allocations are counted separately for EACH bank,
 * matching today's independent-session allocation behavior (conservative).
 * Equal-shaped bank sharing is an unimplemented optimization, not assumed. */
export function planMicrocodeResourceBanks(shape,count,{limits,bankRows,diagnosticCaptures=3,output='compact-terminal'}={}){
 validateShape(shape);uint(count,'candidate count');need(count<=4096,'declared total rows');uint(bankRows,'bank rows');need(bankRows<=count,'bank rows cannot exceed total');need(['compact-terminal','current-diagnostics'].includes(output),'explicit output allocation mode');
 const banks=[];for(let first=0;first<count;first+=bankRows){const rows=Math.min(bankRows,count-first),resource=calculateMicrocodeResources(shape,rows,{limits,diagnosticCaptures}),fit=output==='compact-terminal'?resource.proposedCompact:resource.currentDiagnostics;banks.push({first,count:rows,fits:fit.fits,violations:fit.violations,totalBytes:output==='compact-terminal'?resource.bytes.proposedCompactTotal:resource.bytes.currentTestTotal});}
 return{kind:'resident-microcode-bank-resource-estimate-v1',count,bankRows,output,banks,fits:banks.every(x=>x.fits),totalBytes:sum(banks.map(x=>x.totalBytes)),allBanksResident:true,sharedImmutableCopies:banks.length,implemented:false,qualified:false,estimated:true,hardwareMeasured:false,limitFitOnly:true,memoryAvailabilityChecked:false};
}

const COMMON_READONLY=['rawProgram','rawGeometry','worldTemplate','worldGeometry'];
const BANK_READONLY=['worldProgram','microcode'];
const freezeTree=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTree(child);Object.freeze(value);}return value;};
/** Snapshot the GRANTED GPUDevice limits, never adapter capabilities/defaults.
 * A pure plan may use declared limits; only the allocation owner queries a
 * device. This is not a memory-availability query (WebGPU exposes none). */
export function snapshotMicrocodeDeviceLimits(device){
 need(device?.limits,'actual device limits required');
 return Object.freeze(validateLimits(Object.fromEntries(LIMIT_KEYS.map(key=>[key,device.limits[key]]))));
}

/** Bounded live allocation contract, NOT a scalable source compiler. The
 * current source shape is still a two-row profile. All world/VM/scratch/raw
 * rows remain resident; no initializer retirement or CPU spill is assumed.
 * Truly common source/geometry/template data is one allocation. Count-bound
 * world program and microcode are reserved separately per bank; their source
 * must be regenerated/admitted before any physical producer can use them.
 * No diagnostics or audit buffers are hidden in this compact-only plan. */
export function planResidentMicrocodeAllocation(shape,count,{limits,bankRows=512,bindingPolicy='compatibility-128mib',maxLiveBytes=512*1024*1024}={}){
 validateShape(shape);validateLimits(limits);uint(count,'candidate count');need(count<=4096,'bounded total candidate count');
 uint(bankRows,'bank rows');need(bankRows<=4096,'bounded bank row capacity');
 need(bindingPolicy==='compatibility-128mib'||bindingPolicy==='queried-device','known explicit binding policy');
 if(bindingPolicy==='compatibility-128mib')need(bankRows<=512,'compatibility banks are at most512 rows; no implicit larger binding');
 uint(maxLiveBytes,'explicit peak-live byte budget');
 const bindingLimit=Math.min(limits.maxStorageBufferBindingSize,bindingPolicy==='compatibility-128mib'?128*1024*1024:limits.maxStorageBufferBindingSize);
 const effective={...limits,maxStorageBufferBindingSize:bindingLimit},p=shape.perCandidate,allocations=[],banks=[];
 const allocation=(key,wordCount,role,bank=null,usage=128|8)=>{const row={key,words:wordCount,bytes:words(wordCount),role,bank,usage,storage:!!(usage&128)};allocations.push(row);return row;};
 const common=Object.fromEntries(COMMON_READONLY.map(key=>[key,allocation('common/'+key,shape.sharedWords[key],'common-readonly')]));
 for(let first=0;first<count;first+=bankRows){
  const bank=banks.length,n=Math.min(bankRows,count-first),estimate=calculateMicrocodeResources(shape,n,{limits:effective,diagnosticCaptures:1});
  const resources={};for(const key of BANK_READONLY)resources[key]=allocation('bank/'+bank+'/'+key,shape.sharedWords[key],'bank-readonly',bank);
  for(const key of['worldState','vmState','scratch','rawState','inputs',...(shape.auditWordsPerCandidate?['eventAudit']:[])])resources[key]=allocation('bank/'+bank+'/'+key,estimate.buffers[key].words,key==='rawState'?'retained-initialization':key==='inputs'?'raw-input':key==='eventAudit'?'mandatory-source-audit':'resident-mutable',bank,key==='inputs'||key==='worldState'?128|8:128);
  // Actual source layout: contiguous world rows, ONE fixed CCD tail, then
  // candidate PC controls and request tails. It is not an interleaved row.
  const fixedCcdBase=mul(n,p.worldWords,'fixed CCD base'),controlBase=add(fixedCcdBase,shape.fixedCcdWords,'control base'),requestBase=add(controlBase,mul(n,p.controlWords,'PC controls'),'request base');
  banks.push({index:bank,first,count:n,resources,worldLayout:{worldStrideWords:p.worldWords,fixedCcdBaseWords:fixedCcdBase,fixedCcdWords:shape.fixedCcdWords,controlBaseWords:controlBase,controlStrideWords:p.controlWords,requestBaseWords:requestBase,requestStrideWords:p.requestWords},aliases:{rawScratch:'scratch',numericScratch:'scratch'},violations:estimate.proposedCompact.violations});
 }
 const compactResults=allocation('compactResults',mul(count,RESULT_WORDS,'compact words'),'compact-output',null,128|4|8),compactReadback=allocation('compactReadback',compactResults.words,'compact-readback',null,1|8);
 const peakLiveBytes=sum(allocations.map(a=>a.bytes)),violations=banks.flatMap(b=>b.violations.map(v=>({...v,bank:b.index})));
 // Recheck the FINAL descriptor list, including the one GLOBAL compact range
 // (bank-local estimates alone cannot prove a global output binding fits).
 for(const a of allocations)for(const[limitName,limit]of [['maxBufferSize',limits.maxBufferSize],...(a.storage?[['maxStorageBufferBindingSize',bindingLimit]]:[])])if(a.bytes>limit){const resource=a.key.split('/').at(-1);if(!violations.some(v=>v.resource===resource&&v.limitName===limitName&&v.bank===a.bank))violations.push({resource,bank:a.bank,limitName,required:a.bytes,limit});}
 if(shape.auditWordsPerCandidate)violations.push({resource:'eventAudit',policy:'compact-only owner cannot omit mandatory audited-source snapshots',required:mul(count,shape.auditWordsPerCandidate*4,'audit bytes')});
 if(peakLiveBytes>maxLiveBytes)violations.push({resource:'peakLiveBytes',required:peakLiveBytes,limit:maxLiveBytes});
 const byteRole=role=>sum(allocations.filter(a=>a.role===role).map(a=>a.bytes));
 return freezeTree({kind:'resident-microcode-live-allocation-plan-v1',count,bankRows,bindingPolicy,bindingLimitBytes:bindingLimit,limits:{...limits},common,banks,compactResults,compactReadback,allocations,fits:violations.length===0,violations,
  bytes:{commonReadonly:byteRole('common-readonly'),bankReadonly:byteRole('bank-readonly'),residentMutable:byteRole('resident-mutable'),retainedInitialization:byteRole('retained-initialization'),rawInput:byteRole('raw-input'),compactOutput:compactResults.bytes,compactReadback:compactReadback.bytes,diagnostics:0,...(shape.auditWordsPerCandidate?{mandatorySourceAudit:byteRole('mandatory-source-audit')}:{}),peakLive:peakLiveBytes,budget:maxLiveBytes},
  allBanksResident:true,rawAndNumericScratchAliased:true,initializationRetained:true,limitsSource:'caller-declared',memoryAvailabilityChecked:false,sourceRowsAdmitted:false,physicalProducerAvailable:false,numericallyQualified:false,hardwareMeasured:false,
  excludedMemory:['host arrays','pipeline/compiler memory','driver/device overhead','allocator padding'],sourceProfile:{kind:shape.sourceRuntimeKind,count:shape.sourceCount,frames:shape.sourceFrames}});
}

/** Layout compatibility only, never shader/numerical admission. Reusing the
 * fixed two-row source at another bank count is forbidden even if byte lengths
 * and device limits fit. Audited source cannot enter a compact-only owner. */
export function assertResidentMicrocodeBankSource(runtime,bank){
 const shape=deriveMicrocodeResourceShape(runtime);need(bank&&Number.isInteger(bank.count)&&bank.count===shape.sourceCount,'count-specialized source must match exact bank row count');need(!shape.auditWordsPerCandidate,'mandatory audited source is unavailable to compact-only owner');return Object.freeze({sourceCount:shape.sourceCount,bankCount:bank.count,layoutCompatible:true,physicalProducerAvailable:false,numericallyQualified:false});
}

/** Common readonly sharing requires actual word equality, never equal lengths,
 * names or a copied identity string. Bank-specialized programs/microcode are
 * intentionally excluded and remain separate. This checks input data only;
 * it does not admit shaders, candidate counts, or physical publication. */
export function assertResidentMicrocodeReadonlySharing(runtimes){
 need(Array.isArray(runtimes)&&runtimes.length>0&&runtimes.length<=4096,'bounded bank source list');runtimes.forEach(deriveMicrocodeResourceShape);
 const readonly=p=>({rawProgram:p.original.init.resources.rawProgram,rawGeometry:p.original.init.resources.rawGeometry,worldTemplate:p.original.init.resources.worldTemplate,worldGeometry:p.original.sharedGeometry}),first=readonly(runtimes[0]);
 for(const runtime of runtimes.slice(1)){const other=readonly(runtime);for(const key of COMMON_READONLY)need(first[key].length===other[key].length&&first[key].every((word,index)=>word===other[key][index]),'common readonly bytes differ: '+key);}
 return Object.freeze({bankCount:runtimes.length,byteIdentical:true,commonBytes:sum(Object.values(first).map(words=>words.byteLength)),physicalProducerAvailable:false,numericallyQualified:false});
}
