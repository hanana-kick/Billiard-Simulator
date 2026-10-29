/** Original prepared-world final readback ABI. Copies only; never derives or
 * fabricates physical state from compact outcomes. Numerical/identity admission
 * remains with the source GPU program and canonical session consumer. */
export function decodePreparedWorldReadback(readWords,{journalBytes,journalAuxBytes,rawStatusBytes=0,ruleBytes=0}={}){
 if(!(readWords instanceof Uint32Array)||Object.prototype.toString.call(readWords.buffer)==='[object SharedArrayBuffer]')throw TypeError('Owned complete prepared world readback required');
 if(![journalBytes,journalAuxBytes,rawStatusBytes,ruleBytes].every(x=>Number.isSafeInteger(x)&&x>=0&&x%4===0)||![0,64].includes(rawStatusBytes)||![0,208].includes(ruleBytes)||readWords.byteLength!==3072+journalBytes+journalAuxBytes+rawStatusBytes+ruleBytes)throw RangeError('Exact prepared world final readback layout required');
 const words=readWords.slice(0,768),journalWords=readWords.slice(768,768+journalBytes/4),journalAuxWords=readWords.slice(768+journalBytes/4,768+(journalBytes+journalAuxBytes)/4),rawHandoffStatus=rawStatusBytes?readWords.slice(768+(journalBytes+journalAuxBytes)/4,768+(journalBytes+journalAuxBytes)/4+16):null,ruleWords=ruleBytes?readWords.slice(-52):null,state=words.slice(0,256);
 return {words,journalWords,journalAuxWords,rawHandoffStatus,ruleState:ruleWords?.slice(0,48)??null,compactResult:ruleWords?.slice(48)??null,state,dense:words.slice(256,512),firstPairEntry:words.slice(512,640),firstPairResponse:words.slice(640,768),nominalRest:state[1]===9};
}
