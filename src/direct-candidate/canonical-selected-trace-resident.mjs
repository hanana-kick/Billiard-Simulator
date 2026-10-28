/** Selected-only resident source snapshots. COPY commands run in the SAME
 * encoder before the producer overwrites these buffers. No numeric shader is
 * edited, no map/readback occurs during capture, no per-candidate allocation.
 * This is a staging writer, not a complete trace or an admission authority.
 */
export const SELECTED_RESIDENT_SNAPSHOT_WORDS=256+256+320;
export function createSelectedTraceResidentWriter(device,{candidateCount,maximumRecords=512}={}){
 if(candidateCount!==1||!Number.isInteger(maximumRecords)||maximumRecords<1||maximumRecords>512)throw RangeError('Exactly one selected shot and 1..512 records required');
 const stride=SELECTED_RESIDENT_SNAPSHOT_WORDS*4,buffer=device.createBuffer({label:'selected-source-snapshots-only',size:maximumRecords*stride,usage:4|8});let count=0,overflow=false,disposed=false;
 function range(b,offset,size){if(!b||!Number.isInteger(offset)||offset<0||offset%4||b.size<offset+size||(b.usage&4)!==4)throw RangeError('Original COPY_SRC source buffer/range required');}
 return Object.freeze({buffer,append(encoder,{beforeStateBuffer,afterStateBuffer,descriptorBuffer,descriptorWords,beforeOffset=0,afterOffset=0,descriptorOffset=0}){
  if(disposed)throw Error('Disposed selected trace writer');if(![240,320].includes(descriptorWords))throw RangeError('Complete three/four body 80-word descriptors required');
  range(beforeStateBuffer,beforeOffset,1024);range(afterStateBuffer,afterOffset,1024);range(descriptorBuffer,descriptorOffset,descriptorWords*4);
  if(count===maximumRecords){overflow=true;return false;}const at=count++*stride;
  encoder.copyBufferToBuffer(beforeStateBuffer,beforeOffset,buffer,at,1024);encoder.copyBufferToBuffer(afterStateBuffer,afterOffset,buffer,at+1024,1024);encoder.copyBufferToBuffer(descriptorBuffer,descriptorOffset,buffer,at+2048,descriptorWords*4);return true;
 },status(){return Object.freeze({count,overflow,allocatedBytes:maximumRecords*stride,candidateCount:1});},dispose(){if(!disposed){disposed=true;buffer.destroy();}}});
}
