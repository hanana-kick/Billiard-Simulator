/** Opt-in CPU diagnostic boundary observer, never a GPU trace certificate.
 * All callback input is cloned; observer failure cannot affect physics output. */
export function createWorldTraceCapture(options={}) {
 if(options.selectedTraceCapture===undefined)return null;
 const callback=options.selectedTraceCapture,limit=options.selectedTraceMaxRecords??512;
 let recordCount=0,incomplete=false,reason=null;
 const fail=why=>{incomplete=true;reason=why;};
 if(typeof callback!=='function'||!Number.isInteger(limit)||limit<1||limit>4096)fail('invalid-trace-configuration');
 return {
  get active(){return !incomplete;},
  emit(record){
   if(incomplete)return;
   if(recordCount>=limit){fail('trace-record-limit');return;}
   try {
    const owned=structuredClone(record);recordCount++;
    const returned=callback(owned);
    if(returned&&typeof returned.then==='function'){
     // Async observers are unsupported; swallow later rejection, never physics.
     Promise.resolve(returned).catch(()=>{});fail('asynchronous-trace-callback');
    }
   }catch{fail('trace-callback-error');}
  },
  status(){return Object.freeze({kind:'cpu-reference-boundary-capture-v1',gpuProduced:false,recordCount,limit,incomplete,reason});}
 };
}
export function emitWorldTracePhase(capture,beforeState,current,context,cloth,extra={}) {
 if(!capture?.active||!beforeState)return;
 const after=current.state,startTick=beforeState[5],endTick=after[5];
 // Failed, nonadvancing attempts are not accepted motion. An admitted impact
 // may remain pending after departure rejection, but its advanced clock is real.
 if(endTick<startTick||endTick===startTick&&after[1]!==9)return;
 capture.emit({kind:current.kind??extra.kind??'world-prefix',startTick,endTick,
  beforeState,afterState:after,context,cloth,sourceDescriptors:current.sourceDescriptors,source:current,...extra});
}
