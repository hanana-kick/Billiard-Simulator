/* Isolated experimental numerical observation policy. An opted-in root probe
 * ends at the first outer tick containing an irreversible topology mismatch.
 * Its contact cell describes only that actually observed window, not a future
 * first-object collision. This changes numerical continuation, not gameplay.
 * Original evaluate/verify/finalization paths and the original API stay intact.
 */
(function(G){
'use strict';
const base=G.LabInverseEvents,probePurposes=new Set(['residual','jacobian','trial']);
function enabled(e){return e.prefixMismatchWindow===true&&e.eventPrefixOnly===true&&probePurposes.has(e.purpose)&&!e.finalizationOwner&&!e.req?.finalization;}
function begin(R,req,topology,settings,options={}){
 if(options.prefixMismatchWindow!==undefined&&typeof options.prefixMismatchWindow!=='boolean')throw Error('Boolean probe-window option required');
 const e=base.begin(R,req,topology,settings,options);e.prefixMismatchWindow=options.prefixMismatchWindow===true;return e;
}
function advance(e,stepBatch=240){
 if(!enabled(e))return base.advance(e,stepBatch);
 if(e.done)return true;
 if(!Number.isInteger(stepBatch)||stepBatch<1)throw Error('Positive step batch required');
 for(let i=0;i<stepBatch&&!e.done;i++){
  base.advance(e,1);
  if(!e.done&&e.mismatch){e.prefixOnly=true;e.done=true;}
 }
 return e.done;
}
function finish(e){
 const out=base.finish(e);
 // A different cell scope must never be silently mixed with full-run probe
 // cache entries. A future shared cache must include observationPolicy.
 if(enabled(e)&&e.prefixOnly)return e.result={...out,freshReplay:false,freshWorld:true,observationPolicy:'first-mismatch-outer-step-v1',contactCellScope:'observed-probe-window'};
 return out;
}
G.LabInverseEventsWindow={...base,begin,advance,finish};
})(globalThis);
