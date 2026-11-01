/** Preparation order only. Returned original indices preserve every program slot,
 * command handle, shader byte, entrypoint and layout. Compile large modules before
 * smaller resident pipelines accumulate; this is not a native-memory guarantee. */
export function heavyFirstPipelineIndices(definitions){
 if(!Array.isArray(definitions)||definitions.some(d=>typeof d?.code!=='string'))throw TypeError('Exact pipeline source definitions required');
 const encoder=new TextEncoder(),sizes=definitions.map(d=>encoder.encode(d.code).byteLength);
 return definitions.map((_,index)=>index).sort((a,b)=>sizes[b]-sizes[a]||a-b);
}
