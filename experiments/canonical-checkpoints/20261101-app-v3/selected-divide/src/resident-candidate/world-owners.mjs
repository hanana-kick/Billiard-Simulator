/* SPDX-License-Identifier: Apache-2.0
 * Experimental explicit-owner composition of the unchanged source-PC schedule.
 * This is not a candidate generator, approximate solver, or admission proof.
 */
import {compileWorldDeviceOwners} from './world-owner-routing.mjs';
import {makeCompactSourceOwner} from './world-compact-owners.mjs';
import {makeSharedGraphSourceOwner} from './world-shared-graph-owner.mjs';
import {createWorldQueryOwner} from './world-query-owner.mjs';
import {NUMERIC_PROFILE} from './numeric-profile.mjs';
export const SOURCE_OWNER_ORDER=Object.freeze(['control','shared-graph','point','contact','normal','cue','coupled','application','ccd-pre','ccd-post']);
// These source-name partitions are compiler transport, not alternate physics.
// Every member remains one original CALL. Names are deliberately explicit:
// adding/renaming a source stage must fail coverage, never infer a new route.
export const SOURCE_CONTROL_PARTITIONS=Object.freeze([
 ['bvh-collision',['collision-broad-commit']],
 ['bvh-post',['pass-seal','post-broad-begin','post-broad-gather','post-broad-scatter']],
 ['scene-entry',['scene-after-cue','pass-start']],
 ['scene-collision',['narrow-commit','roster-and-new-wake']],
 ['scene-energy',['scene-energy-gather','scene-energy-scatter','energy-begin']],
 ['application-ccd-begin',['begin-outer','begin-h','begin-ccd','entry-inactive-control','entry-inactive-done','active-ccd-pre-begin','newly-awake-inactive-control','post-inactive-control']],
 ['small-control',['collision-broad-begin','collision-broad-gather','collision-broad-scatter','ball-geometry-select','ball-geometry-advance','cloth-prepare','cloth-gather','cloth-scatter','cloth-publish','cue-geometry-gather','cue-geometry-input','cue-geometry-after-query','cue-geometry-advance','solver-prepare','cue-cloth-complete']]
].map(([name,sourceNames])=>Object.freeze({name:'control-'+name,sourceNames:Object.freeze(sourceNames)})));
export function compileWorldSourceOwners(template,source,pc,{numericProfile=source?.numericProfile??NUMERIC_PROFILE.PRESERVED_F32,controlVisitPolicy='static-chain',controlPartition='merged'}={}){
 if(source?.kind!=='resident-source-world-h-plan'||pc?.kind!=='resident-world-device-pc'||source.count!==pc.count||source.stateWords!==pc.stateWords||source.pipelines.length!==pc.pipelines.length)throw new TypeError('Matching original source and phase-PC plans required');
 if(!['static-chain','single-call'].includes(controlVisitPolicy))throw new RangeError('Explicit known control visit policy required');
 if(!['merged','source-closures-v1'].includes(controlPartition))throw new RangeError('Explicit known source control partition required');
 if(controlPartition!=='merged'&&controlVisitPolicy!=='single-call')throw new RangeError('Partitioned source control requires single-call policy');
 if(source.numericProfile!==numericProfile)throw new RangeError('Owner numeric profile must match original source plan');
 if(source.transport.cue!=='flat'||source.transport.coupled!=='micro'||source.transport.query!=='staged')throw new RangeError('Owner first gate requires flat cue, micro coupled and staged query source transports');
 const assigned=new Map(SOURCE_OWNER_ORDER.map(name=>[name,[]]));
 source.pipelines.forEach((p,i)=>{if(!assigned.has(p.owner))throw new RangeError('Explicit source owner declaration required for '+p.name);assigned.get(p.owner).push(i);});
 const descriptors=SOURCE_OWNER_ORDER.flatMap(name=>{
  if(name!=='control'||controlPartition==='merged')return[{name,family:name,pipelineIds:assigned.get(name)}];
  const ids=new Map(assigned.get(name).map(id=>[source.pipelines[id].name,id])),used=new Set();
  const groups=SOURCE_CONTROL_PARTITIONS.map(group=>({name:group.name,family:name,pipelineIds:group.sourceNames.map(stage=>{const id=ids.get(stage);if(id===undefined||used.has(id))throw new RangeError('Exact source control partition member required: '+stage);used.add(id);return id;})}));
  if(used.size!==ids.size)throw new RangeError('Every original source control phase needs an explicit partition');return groups;
 });
 const owners=descriptors.map(({name,family,pipelineIds},id)=>{
  if(!pipelineIds.length)throw new RangeError('Complete source owner family missing: '+name);
  if(family==='control')return{id,name,pipelineIds,heavy:false,visitPolicy:controlVisitPolicy};
  if(name==='shared-graph')return makeSharedGraphSourceOwner(template,source,{id,pipelineIds,requestTailBase:pc.totalStateWords,numericProfile});
  if(['point','contact','normal'].includes(name))return createWorldQueryOwner(pc,source,{family:name,id,name});
  if(name==='ccd-pre'||name==='ccd-post'){
   if(source.transport.ccd==='staged'){if(pipelineIds.length!==1)throw new RangeError('Exact staged CCD control phase required');return{id,name,pipelineIds,heavy:true};}
  }
  return makeCompactSourceOwner(source,{id,name,pipelineIds,entry:'rc_owner_'+name.replaceAll('-','_')});
 });
 const compiled=compileWorldDeviceOwners(pc,{owners,requestTailBase:pc.totalStateWords,requestWordsPerCandidate:24});
 return Object.freeze({...compiled,sourceOwnerOrder:Object.freeze(descriptors.map(x=>x.name)),sourceTransport:source.transport,controlVisitPolicy,controlPartition,
  sourceCapability:Object.freeze({rawRows:false,sourceCallsUnchanged:true,sourceCapsUnchanged:true,nativeWholeHQualified:false,fullRestQualified:false,hardwarePerformance:false,defaultBackend:false})});
}
