import {context,options} from 'CPU_CONTEXT';
import {prepareCanonicalWorldContinuation,runCanonicalRawWorldContinuationCPU} from 'CPU_CONTINUATION';
import {preparedWorldWords} from 'CPU_WORDS';
export function createCPU(fixture){
 const c=context(fixture),binding=prepareCanonicalWorldContinuation(c.request,c.raw.shotClock,options);
 return (n,diagnostic=true)=>{const words=diagnostic?new Uint32Array(n*2916):null,compact=new Uint32Array(n*4);for(let i=0;i<n;i++){
  const out=runCanonicalRawWorldContinuationCPU(binding,c.batch([c.candidates[i]])),s=out.continuation;
  if(!s)throw Error('CPU continuation missing');
  if(diagnostic){const row=Uint32Array.from([...preparedWorldWords(s),...s.journalWords,...s.journalAuxWords,...s.ruleState,...s.compactResult,...out.rawHandoffStatus]);
  if(row.length!==2916)throw Error('CPU word stride changed');words.set(row,i*2916);}compact.set(s.compactResult,i*4);
 }return {words,compact};};
}
