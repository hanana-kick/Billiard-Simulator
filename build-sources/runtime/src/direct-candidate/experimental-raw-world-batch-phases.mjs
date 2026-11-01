/** Candidate-local ownership for the frozen 0850a4d full raw-world variant.
 * This is deliberately separate from the old 29-source prepared batch.
 * Sizes are complete candidate-local WORD counts, never per-body row sizes.
 */
import {RAW_WORLD_BATCH_SOURCES} from './experimental-raw-world-batch-sources.mjs';
import {liftCandidatePhase} from './deterministic-recurring-batch-phases.mjs';
const W=[
 [],[],[],[64,128],[],[],[256,256,256,512],[256,256,256,512],[256,256,256,512],
 [256,256,256,160],[256,160,8,128],[128,null,256],[256,256,256,160,256,256,256],[256,384],[256,256,384],
 [256,256,160,256],[256,256,256],[256,512],[256,256,256,512,160,256,256,640],[256,{stride:640,base:512,length:128},512],
 [256,256,512,512,256],[256,256,160,256,256,512,512,256],[256,256,160,'tail'],['tail',null,272],[256,256,272,160,1056],[],
 [256,272,8,2],['tail',null,2,1056,'tail'],['tail','tail'],[192,null,160,256,256],[256],
 ['tail',1056,16,'pairSamples'],['tail',null,1056,16,128,64,160,'pairSamples'],[128,160,128,160],[256,256,272,1056,160,128,160,128],
 [256,256,160,256],[256,160,256,256,256,256,640,256],[256,256,512],[256,256,512],[256,272,null,16],
 [256],[256,8],[256,256,256,256],[256,160,256],[256,256,256],[256,4,512,32],[256,4,512,32],[512,512],
 [512,{stride:640,base:256,length:256},256],[256,512,512],[256,8,null],
 [256,{stride:640,base:0,length:256},256,160,'descriptors'],['descriptors',null,2,1056],['descriptors',1056,null,'mixedSamples'],
 ['descriptors',null,1056,null,'mixedSamples',128,64,160],[256,256,1056,160,128,160,128],[256,128,128,128,128],[256,256],[256],[256,8,2],
 ['descriptors',1056,160,256],[256,256,160,256],[256,160,2],[256,256],[256,256,272,1056,160,128,160,128],[256,128,128,128,128]
];
const M=[
 [256,160,2,32],[32,null,96],[96,160,96],[256,256,160,96,96,256,256,640],
 [{stride:640,base:0,length:256},256,256,512],[{stride:640,base:0,length:256},256,256,512],[{stride:640,base:0,length:256},256,256,512],
 [{stride:640,base:256,length:128},{stride:640,base:384,length:64},512],
 [256,256,640,256,256,256,512,160],[256,256,256,160],[256,256,640,256,256,256]
];
function optionsGate({bodyCount=4,journalCapacity=128}={}){
 if(![3,4].includes(bodyCount)||!Number.isInteger(journalCapacity)||journalCapacity<1||journalCapacity>1024)throw RangeError('Bounded 3/4 body and journal capacity');
 return {bodyCount,journalCapacity};
}
export function rawWorldBatchPhaseSpec(family,index,options={}){
 const {bodyCount:B,journalCapacity:J}=optionsGate(options),source=RAW_WORLD_BATCH_SOURCES.find(x=>x.family===family&&x.index===index);
 if(!source)throw RangeError('Unknown frozen raw-world phase');
 const entryPoint=options.entryPoint??'main';
 if(family==='journal'?!['initialize','snapshot','finish'].includes(entryPoint):entryPoint!=='main')throw RangeError('Unreviewed entrypoint');
 const table=family==='world'?W[index]:family==='micro'?M[index]:family==='journal'?[192,entryPoint==='initialize'?192:256,32+8*J,8*J]:family==='prefix'?[192,16,8,32+8*J]:[32+8*J,16,6,52,8*J];
 const dimensions={tail:32*B,pairSamples:1280*B,descriptors:80*B,mixedSamples:1408*B};
 const ownership=table.map(x=>typeof x==='string'?dimensions[x]:typeof x==='object'&&x!==null?{...x}:x);
 // These are the ONLY additional subviews used by the frozen graph.
 if(options.combinedInput){
  if(family!=='world'||![6,7,8,17].includes(index))throw RangeError('Unreviewed combinedRows view');
  ownership[0]={stride:640,base:index===17?256:0,length:256};
 }
 return {...source,entryPoint,ownership};
}
/** Adapter limited to the three exact no-argument entrypoints in the pinned
 * journal. Remove only their attributes; add one dispatch wrapper. The physics
 * and journal bodies remain byte-for-byte unchanged before index lifting. */
function journalEntryAdapter(source,entryPoint){
 const names=[...source.matchAll(/@compute @workgroup_size\(1\) fn (initialize|snapshot|finish)\(\)/g)].map(m=>m[1]);
 if(names.join(',')!=='initialize,snapshot,finish'||(source.match(/@compute/g)??[]).length!==3)throw Error('Journal entrypoint source drift');
 return source.replace(/@compute @workgroup_size\(1\) fn (initialize|snapshot|finish)\(\)/g,'fn $1()')+`\n@compute @workgroup_size(1) fn main(){${entryPoint}();}\n`;
}
export function liftRawWorldBatchPhase(spec){
 const code=spec.family==='journal'?journalEntryAdapter(spec.source,spec.entryPoint):spec.source;
 return liftCandidatePhase(code,spec.ownership);
}
export function rawWorldBatchPhaseSpecs(options={}){
 const specs=[];
 for(const s of RAW_WORLD_BATCH_SOURCES){
  for(const entryPoint of s.family==='journal'?['initialize','snapshot','finish']:['main'])specs.push(rawWorldBatchPhaseSpec(s.family,s.index,{...options,entryPoint}));
 }
 for(const index of [6,7,8,17])specs.push(rawWorldBatchPhaseSpec('world',index,{...options,combinedInput:true}));
 return specs;
}
