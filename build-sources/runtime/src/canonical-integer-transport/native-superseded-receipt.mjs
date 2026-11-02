import {snapshotNativeResetIdentity} from './native-reset-receipt.mjs';
/** This is retained settlement, never proof of destruction or a presentable result. */
export function validateNativeSupersededReceipt(value,{identity,generation,targetRunId,settlementSequence,resetSequence,observedRunGeneration=null}){
 const owned=snapshotNativeResetIdentity(identity);
 for(const [key,v]of Object.entries(owned))if(value?.[key]!==v)throw Error('Superseded native provenance/resource mismatch');
 if(value?.kind!=='native-selected-superseded-settlement-v1'||value.generation!==generation||value.targetRunId!==targetRunId||value.invocationId!==targetRunId||value.settlementSequence!==settlementSequence||typeof value.workerCancellationVerified!=='boolean'||value.runSettled!==true||value.gpuFenced!==true||value.prefixDrained!==true||value.mapsOpen!==0||value.needsFullInputUpload!==true||value.disposed!==false||value.destroyed!==false)throw Error('Exact superseded native settlement required');
 if(!['not-started','completed','cancelled-reset'].includes(value.disposition))throw Error('Unknown native settlement disposition');
 const reset=value.disposition==='cancelled-reset';
 if(value.resetPerformed!==reset||value.resetSequence!==resetSequence+(reset?1:0)||reset&&value.mutableStateReset!==true||!reset&&value.mutableStateReset===true)throw Error('Native settlement reset accounting mismatch');
 if(value.disposition==='not-started'){if(value.targetRunGeneration!==null||observedRunGeneration!==null)throw Error('No-start cannot claim a native generation');}
 else if(!Number.isSafeInteger(value.targetRunGeneration)||value.targetRunGeneration<1||observedRunGeneration!==null&&value.targetRunGeneration!==observedRunGeneration)throw Error('Native settlement invocation generation mismatch');
 return Object.freeze({...value});
}
