import {rawWorldBatchPrefixLimit} from './experimental-raw-world-batch-revision.mjs';
/** Frozen 0850a4d host phase order, represented as a pure allocation/command plan.
 * No shader execution, readbacks, or host candidate physics. No lifetime aliasing.
 */
export const RAW_WORLD_BATCH_ALLOCATION_LIMIT_BYTES=256*1024*1024;
export function buildRawWorldBatchSchedule({bodyCount:B=4,maxWorldSteps:P=64,journalCapacity:J=128,tailBytes=0,pipelineRevision='0850a4d'}={}){
 const prefixLimit=rawWorldBatchPrefixLimit(pipelineRevision);
 if(![3,4].includes(B)||!Number.isInteger(P)||P<1||P>prefixLimit||!Number.isInteger(J)||J<1||J>1024||!Number.isInteger(tailBytes)||tailBytes<0)throw RangeError('Frozen bounded world schedule');
 const allocations=[],commands=[],add=(name,bytes,shared=false)=>{allocations.push({name,bytes,shared});return name;},resource=name=>name;
  add("sceneBuffer",512,true);
  add("ctx",640,false);
  add("rctx",640,false);
  add("config",32,false);
  add("cloth",64,true);
  add("tailAsset",tailBytes,true);
  add("source",1024,false);
  add("contacts",256,false);
  add("response",512,false);
  add("initialRows",1024,false);
  add("initialState",1024,false);
  add("initialDense",1024,false);
  add("initialSmooth",1024,false);
  add("initialScratch",1024,false);
  add("initialCells",2048,false);
  add("landingRows",512,false);
  add("landingRoots",1024,false);
  add("landingResult",1536,false);
  add("landState",1024,false);
  add("landDense",1024,false);
  add("landRows",1024,false);
  add("landSmooth",1024,false);
  add("landScratch",1024,false);
  add("landCells",2048,false);
  add("tailRows",B*128,false);
  add("tailBounds",B*128,false);
  add("tail",1088,false);
  add("refConfig",8,false);
  add("refined",4224,false);
  add("pairEntry",512,false);
  add("pairAdvanced",640,false);
  add("pairState",640,false);
  add("pairSamples",B*10*512,false);
  add("pairMaterial",64,true);
  add("pairActive",64,false);
  add("combinedRows",2560,false);
  add("rolling",2048,false);
  add("mixedState",1024,false);
  add("mixedDense",1024,false);
  add("mixedDescriptors",B*320,false);
  add("mixedQuery",4224,false);
  add("mixedQueryConfig",8,false);
  add("mixedSamples",B*11*512,false);
  add("mixedEntry",512,false);
  add("mixedContacts",256,false);
  add("mixedAdvanced",640,false);
  add("mixedResponse",512,false);
  add("mixedPairState",640,false);
  add("clearAdvanced",640,false);
  add("clearDense",1024,false);
  add("microConfig",8,false);
  add("iterations",P*256,true);
  add("probeRows",1024,false);
  add("proposed",1024,false);
  add("probeScratch",1024,false);
  add("probeCells",2048,false);
  add("bridgeProbeRows",1024,false);
  add("bridgeProbes",2048,false);
  add("actualSmooth",1024,false);
  add("actualScratch",1024,false);
  add("actualCells",2048,false);
  add("bridges",2048,false);
  add("path",1024,false);
  add("qtRows",1024,false);
  add("qtProbes",2048,false);
  add("qtScratch",128,false);
  add("qtFixedRows",1024,false);
  add("qtFixed",2048,false);
  add("qtFixedScratch",128,false);
  add("qtSearchConfig",16,false);
  add("qtFixedConfig",16,false);
  const input="input",sceneBuffer=resource("sceneBuffer"),ctx=resource("ctx"),rctx=resource("rctx"),config=resource("config"),cloth=resource("cloth"),tailAsset=resource("tailAsset"),source=resource("source"),contacts=resource("contacts"),response=resource("response"),initialRows=resource("initialRows"),initialState=resource("initialState"),initialDense=resource("initialDense"),initialSmooth=resource("initialSmooth"),initialScratch=resource("initialScratch"),initialCells=resource("initialCells"),landingRows=resource("landingRows"),landingRoots=resource("landingRoots"),landingResult=resource("landingResult"),landState=resource("landState"),landDense=resource("landDense"),landRows=resource("landRows"),landSmooth=resource("landSmooth"),landScratch=resource("landScratch"),landCells=resource("landCells"),tailRows=resource("tailRows"),tailBounds=resource("tailBounds"),tail=resource("tail"),refConfig=resource("refConfig"),refined=resource("refined"),pairEntry=resource("pairEntry"),pairAdvanced=resource("pairAdvanced"),pairState=resource("pairState"),pairSamples=resource("pairSamples"),pairMaterial=resource("pairMaterial"),pairActive=resource("pairActive"),combinedRows=resource("combinedRows"),rolling=resource("rolling"),mixedState=resource("mixedState"),mixedDense=resource("mixedDense"),mixedDescriptors=resource("mixedDescriptors"),mixedQuery=resource("mixedQuery"),mixedQueryConfig=resource("mixedQueryConfig"),mixedSamples=resource("mixedSamples"),mixedEntry=resource("mixedEntry"),mixedContacts=resource("mixedContacts"),mixedAdvanced=resource("mixedAdvanced"),mixedResponse=resource("mixedResponse"),mixedPairState=resource("mixedPairState"),clearAdvanced=resource("clearAdvanced"),clearDense=resource("clearDense"),microConfig=resource("microConfig"),iterations=resource("iterations"),probeRows=resource("probeRows"),proposed=resource("proposed"),probeScratch=resource("probeScratch"),probeCells=resource("probeCells"),bridgeProbeRows=resource("bridgeProbeRows"),bridgeProbes=resource("bridgeProbes"),actualSmooth=resource("actualSmooth"),actualScratch=resource("actualScratch"),actualCells=resource("actualCells"),bridges=resource("bridges"),path=resource("path"),qtRows=resource("qtRows"),qtProbes=resource("qtProbes"),qtScratch=resource("qtScratch"),qtFixedRows=resource("qtFixedRows"),qtFixed=resource("qtFixed"),qtFixedScratch=resource("qtFixedScratch"),qtSearchConfig=resource("qtSearchConfig"),qtFixedConfig=resource("qtFixedConfig");
  for(const name of ['state0','state1','dense0','dense1'])add(name,1024);
  const states=['state0','state1'],dense=['dense0','dense1'],rows=[0,0,B],maxPrefixes=P;
  const dispatch=(index,list,x=1)=>commands.push({kind:'dispatch',family:'world',index,list,x});
  const view=(offset,size)=>({buffer:combinedRows,offset,size});
  let clears=0;
  const encoder={clearBuffer(buffer){commands.push({kind:'clear',buffer});}};
  add('journal',(32+8*J)*4);add('aux',8*J*4);add('rawIdentity',32);add('ruleConfig',64);add('ruleIdentity',24);add('ruleOutput',208);add('compact',16);add('readback',16);
  const journalBank={encodeCapture(_encoder,state,{final=false}={}){commands.push({kind:'dispatch',family:'journal',index:0,entryPoint:final?'finish':'snapshot',list:[input,state,'journal','aux'],x:1});}};
  const ruleBank={encode(){commands.push({kind:'dispatch',family:'rules',index:0,list:['journal','ruleConfig','ruleIdentity','ruleOutput','aux'],x:1});}};
  const microtailBanks=new Map();
  const microtailEngine={createBank({stateBuffer:old,denseBuffer:od,contextBuffer:context,clothBuffer:sc,configBuffer:cfg}){
   const prefix=`micro${microtailBanks.size}:`,r=name=>prefix+name;
   for(const [name,bytes] of Object.entries({ctx:640,input:128,micro:384,fraction:384,state:1024,dense:1024,rows:2560,smooth:1024,scratch:1024,cells:2048,rolling:2048,zero:1024,path:1024}))add(r(name),bytes);
   const view=(name,offset,size)=>({buffer:r(name),offset,size});
   const bank={stateBuffer:r('state'),denseBuffer:r('dense'),encode(){
    for(const a of allocations.filter(x=>x.name.startsWith(prefix)))encoder.clearBuffer(a.name);
    commands.push({kind:'dispatch',family:'contextReset',index:0,list:[context,r('ctx')],x:1});
    const lists=[[old,r('ctx'),cfg,r('input')],[r('input'),sc,r('micro')],[r('micro'),r('ctx'),r('fraction')],[old,od,r('ctx'),r('micro'),r('fraction'),r('state'),r('dense'),r('rows')],[view('rows',0,1024),r('smooth'),r('scratch'),r('cells')],[view('rows',0,1024),r('smooth'),r('scratch'),r('cells')],[view('rows',0,1024),r('smooth'),r('scratch'),r('cells')],[view('rows',1024,512),view('rows',1536,256),r('rolling')],[r('state'),r('dense'),r('rows'),old,od,r('smooth'),r('rolling'),r('ctx')],[r('state'),r('dense'),r('zero'),r('ctx')],[r('state'),r('dense'),r('rows'),old,od,r('path')]];
    for(let index=0;index<lists.length;index++)commands.push({kind:'dispatch',family:'micro',index,list:lists[index],x:index===7?4:1});
   }};return bank;
  }};
  commands.push({kind:'dispatch',family:'journal',index:0,entryPoint:'initialize',list:[input,input,'journal','aux'],x:1});
  commands.push({kind:'dispatch',family:'prefix',index:0,list:[input,'rawStatus','rawIdentity','journal'],x:1});
dispatch(29,[input,sceneBuffer,ctx,initialState,initialDense]);dispatch(43,[initialState,rctx,initialDense]);dispatch(30,[initialState]);dispatch(22,[initialState,initialDense,rctx,tailRows]);dispatch(23,[tailRows,tailAsset,tail]);dispatch(26,[initialState,tail,config,refConfig]);dispatch(28,[tailRows,tailBounds],rows[2]);dispatch(27,[tailRows,tailAsset,refConfig,refined,tailBounds]);dispatch(39,[initialState,tail,pairMaterial,pairActive]);dispatch(31,[tailRows,refined,pairActive,pairSamples],rows[2]*10);dispatch(32,[tailRows,tailAsset,refined,pairActive,pairEntry,contacts,pairAdvanced,pairSamples]);dispatch(3,[contacts,response]);dispatch(33,[pairEntry,pairAdvanced,response,pairState]);dispatch(34,[initialState,initialDense,tail,refined,pairState,pairEntry,rctx,response]);journalBank.encodeCapture(encoder,initialState);dispatch(43,[initialState,ctx,initialDense]);dispatch(41,[initialState,config]);dispatch(10,[initialState,ctx,config,landingRows]);dispatch(11,[landingRows,cloth,landingRoots]);dispatch(35,[initialState,landingRoots,ctx,initialRows]);for(let attempt=0;attempt<16;attempt++)for(let i=6;i<=8;i++)dispatch(i,[initialRows,initialSmooth,initialScratch,initialCells]);dispatch(36,[initialState,ctx,landingRoots,initialSmooth,landState,landDense,combinedRows,initialDense]);for(let i=6;i<=8;i++)dispatch(i,[view(0,1024),landSmooth,landScratch,landCells]);dispatch(19,[landState,view(2048,512),rolling],4);dispatch(37,[landState,landDense,rolling]);dispatch(9,[landState,landDense,landSmooth,ctx]);dispatch(13,[landingRoots,landingResult]);dispatch(14,[landState,landDense,landingResult]);journalBank.encodeCapture(encoder,landState);dispatch(38,[landState,landDense,rolling]);dispatch(43,[landState,rctx,landDense]);
let previous=landState,oldDense=landDense;for(let iteration=0;iteration<maxPrefixes;iteration++){const next=states[iteration%2],nextDense=dense[iteration%2];dispatch(43,[previous,rctx,oldDense]);dispatch(50,[previous,config,{buffer:iterations,offset:iteration*256,size:4}]);dispatch(62,[previous,rctx,microConfig]);let microtailBank=microtailBanks.get(previous);if(!microtailBank){microtailBank=microtailEngine.createBank({stateBuffer:previous,denseBuffer:oldDense,contextBuffer:rctx,clothBuffer:cloth,configBuffer:microConfig});microtailBanks.set(previous,microtailBank);}microtailBank.encode(encoder);journalBank.encodeCapture(encoder,microtailBank.stateBuffer);dispatch(63,[previous,microtailBank.stateBuffer]);previous=microtailBank.stateBuffer;oldDense=microtailBank.denseBuffer;const beforeMixed=previous;
for(const b of [initialSmooth,initialScratch,initialCells,landSmooth,landScratch,landCells,rolling]){encoder.clearBuffer(b);clears++;}
dispatch(10,[previous,rctx,config,landingRows]);dispatch(11,[landingRows,cloth,landingRoots]);dispatch(35,[previous,landingRoots,rctx,initialRows]);for(let attempt=0;attempt<16;attempt++)for(let i=6;i<=8;i++)dispatch(i,[initialRows,initialSmooth,initialScratch,initialCells]);dispatch(36,[previous,rctx,landingRoots,initialSmooth,mixedState,mixedDense,combinedRows,oldDense]);for(let i=6;i<=8;i++)dispatch(i,[view(0,1024),landSmooth,landScratch,landCells]);dispatch(19,[mixedState,view(2048,512),rolling],4);dispatch(37,[mixedState,mixedDense,rolling]);dispatch(9,[mixedState,mixedDense,landSmooth,rctx]);dispatch(13,[landingRoots,landingResult]);dispatch(14,[mixedState,mixedDense,landingResult]);journalBank.encodeCapture(encoder,mixedState);dispatch(38,[mixedState,mixedDense,rolling]);dispatch(57,[beforeMixed,mixedState]);previous=mixedState;oldDense=mixedDense;
for(const b of [proposed,probeScratch,probeCells,bridgeProbes,actualSmooth,actualScratch,actualCells,bridges,rolling,qtProbes,qtScratch,qtFixed,qtFixedScratch]){encoder.clearBuffer(b);clears++;}dispatch(15,[previous,oldDense,rctx,probeRows]);for(let attempt=0;attempt<16;attempt++)for(let i=6;i<=8;i++)dispatch(i,[probeRows,proposed,probeScratch,probeCells]);dispatch(16,[probeRows,proposed,bridgeProbeRows]);dispatch(17,[bridgeProbeRows,bridgeProbes]);dispatch(44,[probeRows,proposed,qtRows]);dispatch(45,[qtRows,qtSearchConfig,qtProbes,qtScratch],4);for(let trial=0;trial<16;trial++)dispatch(46,[qtRows,qtSearchConfig,qtProbes,qtScratch],4);dispatch(47,[bridgeProbes,qtProbes]);dispatch(18,[previous,oldDense,proposed,bridgeProbes,rctx,next,nextDense,combinedRows]);for(let i=6;i<=8;i++)dispatch(i,[view(0,1024),actualSmooth,actualScratch,actualCells]);dispatch(48,[bridgeProbes,view(1024,1024),qtFixedRows]);dispatch(17,[view(1024,1024),bridges]);dispatch(45,[qtFixedRows,qtFixedConfig,qtFixed,qtFixedScratch],4);dispatch(46,[qtFixedRows,qtFixedConfig,qtFixed,qtFixedScratch],4);dispatch(49,[next,bridges,qtFixed]);dispatch(19,[next,view(2048,512),rolling],4);dispatch(20,[next,nextDense,bridges,rolling,actualSmooth]);dispatch(9,[next,nextDense,actualSmooth,rctx]);dispatch(51,[next,view(0,1024),actualSmooth,rctx,mixedDescriptors],rows[2]);dispatch(59,[next,config,mixedQueryConfig]);dispatch(52,[mixedDescriptors,tailAsset,mixedQueryConfig,mixedQuery]);dispatch(53,[mixedDescriptors,mixedQuery,pairMaterial,mixedSamples],rows[2]*11);dispatch(54,[mixedDescriptors,tailAsset,mixedQuery,pairMaterial,mixedSamples,mixedEntry,mixedContacts,mixedAdvanced]);dispatch(3,[mixedContacts,mixedResponse]);dispatch(33,[mixedEntry,mixedAdvanced,mixedResponse,mixedPairState]);dispatch(55,[next,nextDense,mixedQuery,mixedPairState,mixedEntry,rctx,mixedResponse]);dispatch(60,[mixedDescriptors,mixedQuery,clearAdvanced,clearDense]);dispatch(61,[next,nextDense,clearAdvanced,clearDense]);dispatch(56,[next,mixedEntry,mixedResponse,pairEntry,response]);journalBank.encodeCapture(encoder,next);dispatch(21,[previous,oldDense,rctx,next,nextDense,bridges,rolling,path]);dispatch(42,[previous,oldDense,next,nextDense]);dispatch(43,[next,rctx,nextDense]);dispatch(22,[next,nextDense,rctx,tailRows]);dispatch(23,[tailRows,tailAsset,tail]);dispatch(26,[next,tail,config,refConfig]);dispatch(28,[tailRows,tailBounds],rows[2]);dispatch(27,[tailRows,tailAsset,refConfig,refined,tailBounds]);dispatch(39,[next,tail,pairMaterial,pairActive]);dispatch(31,[tailRows,refined,pairActive,pairSamples],rows[2]*10);dispatch(32,[tailRows,tailAsset,refined,pairActive,mixedEntry,mixedContacts,mixedAdvanced,pairSamples]);dispatch(3,[mixedContacts,mixedResponse]);dispatch(33,[mixedEntry,mixedAdvanced,mixedResponse,mixedPairState]);dispatch(64,[next,nextDense,tail,refined,mixedPairState,mixedEntry,rctx,mixedResponse]);dispatch(65,[next,mixedEntry,mixedResponse,pairEntry,response]);journalBank.encodeCapture(encoder,next);dispatch(24,[next,nextDense,tail,rctx,refined]);dispatch(58,[next]);previous=next;oldDense=nextDense;}dispatch(43,[previous,rctx,oldDense]);dispatch(40,[previous]);journalBank.encodeCapture(encoder,previous,{final:true});ruleBank?.encode(encoder);
 commands.push({kind:'dispatch',family:'compact',index:0,list:['ruleOutput','compact'],x:'candidateGroups32'});
 commands.push({kind:'readback',source:'compact',target:'readback',bytesPerCandidate:16});
 return {allocations,commands,microBanks:microtailBanks.size,dispatches:commands.filter(x=>x.kind==='dispatch').length};
}
/** Exact owned-buffer preflight, excluding implementation-dependent compiler and
 * driver memory. This is not a hardware VRAM or resident-process RSS estimate. */
export function rawWorldBatchAllocationEnvelope(plan,count,{rawSceneBytes,strikeBackend='staged',maxBufferSize=Infinity,maxStorageBufferBindingSize=Infinity}={}){
 if(!Number.isInteger(count)||count<1||count>1024||!Number.isInteger(rawSceneBytes)||rawSceneBytes<64||!['staged','chunked-16'].includes(strikeBackend))throw RangeError('Bounded raw tile envelope');
 const allocations=plan.allocations.map(a=>({...a,totalBytes:a.bytes*(a.shared?1:count)}));
 for(const [name,bytes,shared]of [['rawScene',rawSceneBytes,true],['rawTemplate',768,true],['rawBudget',16,true],['rawInput',64,false],['handoffInput',64,false],['rawResult',512,false],['rawScratch',128,false],['rawAdmitted',4,false],['rawWorld',768,false],['rawStatus',64,false],...(strikeBackend==='chunked-16'?[['rawControl',4,true]]:[])])allocations.push({name,bytes,shared,totalBytes:bytes*(shared?1:count)});
 let allocatedBytes=0;
 for(const a of allocations){
  if(!Number.isSafeInteger(a.totalBytes)||a.totalBytes<0||a.totalBytes>maxBufferSize||(a.name!=='readback'&&a.totalBytes>maxStorageBufferBindingSize))throw RangeError('Raw world batch exceeds device buffer limit');
  allocatedBytes+=a.totalBytes;
 }
 if(allocatedBytes>RAW_WORLD_BATCH_ALLOCATION_LIMIT_BYTES)throw RangeError('Raw world batch exceeds 256 MiB owned allocation limit');
 return {candidateCount:count,allocatedBytes,allocations,readbackBytes:16*count,submissions:1,intermediateReadbacks:0,hostPhysicsBetweenPhases:0};
}
