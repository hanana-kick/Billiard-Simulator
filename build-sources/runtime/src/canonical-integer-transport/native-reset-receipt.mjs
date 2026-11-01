/** Native-only retained-owner acknowledgement. Never a destruction receipt. */
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function snapshotNativeResetIdentity(value){
 const keys=['sourceRevision','artifactSHA256','nativeProgramSHA256','transformRevision','runtimeRevision','ownedBytes','retainedBuffers','retainedPipelines'];
 if(!value||Object.keys(value).sort().join()!==keys.sort().join())throw Error('Exact native reset identity required');
 for(const key of ['sourceRevision','artifactSHA256','nativeProgramSHA256','transformRevision','runtimeRevision'])if(!sha(value[key]))throw Error('Pinned native reset identity required');
 if(value.ownedBytes!==9048004||value.retainedBuffers!==234||value.retainedPipelines!==109)throw Error('Exact native retained resources required');
 return Object.freeze({...value});
}
export function validateNativeResetReceipt(receipt,{identity,generation,targetRunId,targetRunGeneration,resetSequence}){
 const owned=snapshotNativeResetIdentity(identity);
 for(const [key,value]of Object.entries(owned))if(receipt?.[key]!==value)throw Error('Native reset provenance/resource mismatch');
 if(receipt?.kind!=='native-selected-reset-receipt-v1'||receipt.generation!==generation||receipt.targetRunId!==targetRunId||receipt.targetRunGeneration!==targetRunGeneration||receipt.resetSequence!==resetSequence||receipt.runSettled!==true||receipt.gpuFenced!==true||receipt.prefixDrained!==true||receipt.mapsOpen!==0||receipt.mutableStateReset!==true||receipt.needsFullInputUpload!==true||receipt.disposed!==false||receipt.destroyed!==false)throw Error('Complete retained native reset acknowledgement required');
 return Object.freeze({...receipt});
}
