// SPDX-License-Identifier: Apache-2.0
// Authenticated fixed-prestrike template + arbitrary raw parameter rows. Every
// candidate pose, clearance query and created world-mass calculation executes
// on device. No host continuation, physical stepping or future-state import.
import {authenticateCreationTemplate,assertCreationTemplate} from './creation-template.mjs';
import {packCreatedWorldTemplate,generateWorldCloneWGSL,packWorldCloneTemplate} from './world-state.mjs';
import {buildRawPreparationPlan} from './raw-strike.mjs';
import {generateConvexPointWGSL} from './convex-point.mjs';
import {generateWorldCreationWGSL} from './world-creation.mjs';
import {packCandidates} from './abi.mjs';
import Query from '../experimental-cue-obstacle-contact.js';
import Point from '../experimental-convex-point.js';
const owned=new WeakMap(),U=0xffffffff,key=h=>h.index+':'+h.generation,need=(v,m)=>{if(!v)throw new RangeError('World initialization: '+m);};
export const WORLD_INITIALIZATION_CAPABILITY=Object.freeze({fixedAuthenticatedPrestrike:true,arbitraryFiveParameterRows:true,deviceRawPose:true,deviceSampledAndContinuousClearance:true,deviceCreatedWorldMass:true,hostForwardFallback:false,nativeAllocation:false,nativeWholeH:false,defaultBackend:false});
/** Static source roster only: exactly [...lab.statics,...lab.objects], primary
 * collider per object. Paired solver-only ball colliders are NOT clearance rows. */
export function originalClearanceRoster(seed){
 need(seed?.kind==='original-live-registered-four-ball-created-world','authenticated registered source required');const raw=seed.cueInitial.sourceCreation.created,statics=seed.sceneRegistry.statics,objects=seed.sceneRegistry.objects;
 need(statics.length===16&&objects.length===4,'original sixteen static/four object roster');const hulls=new Map();for(const row of seed.cueEmptyConvexHulls??[])hulls.set(key(row.collider),row.hull);for(const row of seed.cushionSeeds[0].cushions)hulls.set(key(row.colliderHandle),row.hull);
 const handles=[...statics.map(r=>r.collider.handle),...objects.map(r=>r.primaryCollider.handle)],seen=new Set();const obstacles=handles.map(handle=>{need(!seen.has(key(handle)),'unique original clearance collider');seen.add(key(handle));const c=raw.colliders.find(c=>key(c.handle)===key(handle));need(c,'complete original native collider');let shape;switch(c.shape.variant){case 'Ball':shape={type:'sphere',radius:c.shape.value.radius};break;case 'Cuboid':shape={type:'box',halfExtents:c.shape.value.half_extents.slice()};break;case 'ConvexPolyhedron':{const hull=hulls.get(key(handle));need(hull&&JSON.stringify(hull.points)===JSON.stringify(c.shape.value.points),'authenticated original native-index hull');shape={type:'convex',points:hull.points,nativeTopology:hull};break;}default:throw new RangeError('World initialization: unsupported source clearance shape '+c.shape.variant);}return Object.freeze({shape,position:c.pos.translation.slice(),rotation:c.pos.rotation.slice(),collider:Object.freeze({...handle})});});
 return Object.freeze({obstacles:Object.freeze(obstacles),center:Object.freeze(seed.balls[seed.selectedIndex].state.translation.slice()),selectedObstacleIndex:statics.length+seed.selectedIndex,selectedInputIndex:seed.selectedIndex});
}
/** Metadata participates in WGSL generation as well as uploads. Freeze the
 * complete owned data graph ONCE, without cloning authenticated receipt/hull
 * objects (their local brands are identity based). Nonempty typed arrays cannot
 * be frozen by JavaScript: retain a private byte snapshot of EVERY reachable
 * view, including compiler output slots and maps, and disallow custom properties.
 * Subsequent admission checks scan only these views, never the large graph. */
function sealPlanData(root){
 const seen=new WeakSet(),views=[];
 const visit=(value,path)=>{
  if(value===null||typeof value!=='object'){need(typeof value!=='function','data-only initialization metadata: '+path);return;}
  if(seen.has(value))return;seen.add(value);
  if(ArrayBuffer.isView(value)){
   need(value.buffer instanceof ArrayBuffer,'non-shared initial view required: '+path);
   const buffer=value.buffer,offset=value.byteOffset,length=value.byteLength;
   views.push({value,buffer,offset,length,bytes:new Uint8Array(buffer,offset,length).slice(),path});
   // Indexed elements stay writable and are checked above every use. Prevent
   // own-property/prototype replacement from changing their interpretation.
   Object.preventExtensions(value);return;
  }
  const proto=Object.getPrototypeOf(value);
  need(proto===Object.prototype||proto===Array.prototype||proto===null,'plain initialization metadata required: '+path);
  for(const name of Reflect.ownKeys(value)){
   const descriptor=Object.getOwnPropertyDescriptor(value,name);
   need(Object.hasOwn(descriptor,'value'),'accessor initialization metadata forbidden: '+path+'.'+String(name));
   visit(descriptor.value,path+'.'+String(name));
  }
  Object.freeze(value);
 };
 visit(root,'plan');return views;
}
function assertPlanViews(views){
 for(const {value,buffer,offset,length,bytes,path}of views){
  let current;try{if(value.buffer===buffer&&value.byteOffset===offset&&value.byteLength===length)current=new Uint8Array(buffer,offset,length);}catch{/* Detached/resized data are not initial source data. */}
  need(current&&current.length===bytes.length,'initial data mutated: '+path);
  for(let i=0;i<bytes.length;i++)if(current[i]!==bytes[i])need(false,'initial data mutated: '+path);
 }
}
/** Authenticate once against BOTH unchanged original snapshots and its exact
 * 13-call no-step journal. Caller-supplied created states/receipts are not enough.
 * Returned CPU arrays are initial immutable uploads only, never future poses. */
export async function createWorldInitializationPlan({decoder,input,rule,ruleId=0,storageLoops=false}={}){
 need(typeof storageLoops==='boolean','explicit source loop transport');need(Number.isInteger(ruleId)&&ruleId>=0&&ruleId<U,'unsigned common rule identity');const {receipt,seed}=await authenticateCreationTemplate(decoder,input);assertCreationTemplate(receipt);
 const template=await packCreatedWorldTemplate(seed,{rule}),roster=originalClearanceRoster(seed);need(template.sourceIdentity===receipt.createdSnapshotSha256&&template.selectedIndex===seed.sourceOrigin.selectedIndex,'creation/template identity');for(const name of['rawPose','rawClearance','rawCreation'])need(Number.isInteger(template.segments[name]?.offset),'world '+name+' segment');need(template.segments.rawPose.words===128&&template.segments.rawClearance.words===16&&template.segments.rawCreation.words===16,'complete raw transport widths');
 const raw=buildRawPreparationPlan({query:Query,pointQuery:Point,pointStageGenerator:generateConvexPointWGSL,...roster,storageLoops}),clone=packWorldCloneTemplate(template);
 const plan=Object.freeze({kind:'resident-source-world-initialization',version:1,receipt,template,raw,roster,clone,capability:WORLD_INITIALIZATION_CAPABILITY,sourceIdentity:template.sourceIdentity,preStrikeIdentity:receipt.preStrikeSnapshotSha256,selectedIndex:template.selectedIndex,ruleId});
 owned.set(plan,{views:sealPlanData(plan)});return plan;
}
export function assertWorldInitializationPlan(plan){const proof=owned.get(plan);need(proof,'authentic local initialization plan required');assertCreationTemplate(plan.receipt);need(plan.sourceIdentity===plan.receipt.createdSnapshotSha256&&plan.preStrikeIdentity===plan.receipt.preStrikeSnapshotSha256,'immutable source identity');assertPlanViews(proof.views);return plan;}
/** Arbitrary solver probes or grids are transport only. No quantization,
 * normalization, clamping, rejection, or candidate proposal happens on CPU. */
export function packWorldInitializationRows(plan,rows,{ruleId=plan?.ruleId,maxCandidates=4096}={}){assertWorldInitializationPlan(plan);need(ruleId===plan.ruleId,'common rule identity cannot change within a wave');return packCandidates(rows,{selectedIndex:plan.selectedIndex,ruleId,maxCandidates});}
function transferShader(plan){const t=plan.template,o=Object.fromEntries(Object.entries(t.segments).map(([k,v])=>[k,v.offset])),r=plan.raw.layout,obstacles=plan.raw.geometry.obstacleCount;return `
@group(0) @binding(0) var<storage,read> rc_inputs:array<u32>;
@group(0) @binding(1) var<storage,read> rc_prepared:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(3) var<storage,read> rc_template:array<u32>;
${generateWorldCloneWGSL(t)}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){let row=gid.x;if(row>=arrayLength(&rc_inputs)/16u){return;}let bank=row*${t.state.length}u;let source=row*${r.stateWords}u;rc_world_clone(bank,rc_inputs[row*16u]);let raw=bank+${o.rawPose}u;let clearance=bank+${o.rawClearance}u;let creation=bank+${o.rawCreation}u;
 for(var i=0u;i<128u;i++){rc_state[raw+i]=rc_prepared[source+${r.raw}u+i];}for(var i=0u;i<16u;i++){rc_state[clearance+i]=rc_prepared[source+${r.clearance}u+i];}
 if(rc_inputs[row*16u+12u]!=${plan.selectedIndex}u||rc_inputs[row*16u+13u]!=${plan.ruleId}u){rc_state[bank+2u]=4u;rc_state[bank+3u]=10u;return;}
 let rawStatus=rc_state[raw];if(rawStatus==8u){rc_state[bank+2u]=8u;rc_state[bank+3u]=rc_state[raw+1u];if(rc_state[raw+1u]!=1u&&rc_state[raw+1u]!=2u){rc_state[bank+2u]=4u;rc_state[bank+3u]=11u;}return;}if(rawStatus!=1u){rc_state[bank+2u]=4u;rc_state[bank+3u]=6u;return;}
 let clearanceStatus=rc_state[clearance];if(clearanceStatus==2u){rc_state[bank+2u]=8u;rc_state[bank+3u]=3u;return;}if(clearanceStatus==3u){rc_state[bank+2u]=4u;rc_state[bank+3u]=rc_state[clearance+12u];if(rc_state[bank+3u]<4u||rc_state[bank+3u]>6u){rc_state[bank+3u]=6u;}return;}if(clearanceStatus!=1u){rc_state[bank+2u]=5u;rc_state[bank+3u]=11u;return;}
 // A partial/failed query transcript cannot authorize created-state binding.
 if(rc_state[clearance+1u]!=${obstacles*3}u||rc_state[clearance+2u]!=0u||rc_state[clearance+3u]!=${plan.roster.selectedObstacleIndex}u||rc_state[clearance+8u]!=0u||rc_state[clearance+9u]!=0xffffffffu||rc_state[clearance+10u]!=${(obstacles*3-1)*3}u||rc_state[clearance+11u]!=${obstacles*3-1}u||rc_state[clearance+12u]!=0u){rc_state[bank+2u]=4u;rc_state[bank+3u]=11u;return;}
 if(rc_state[bank]!=0x52435753u||rc_state[bank+1u]!=1u||rc_state[bank+5u]!=0u||rc_state[bank+7u]!=1u||rc_state[creation]!=0u||rc_state[creation+4u]!=0u){rc_state[bank+2u]=4u;rc_state[bank+3u]=11u;return;}rc_state[creation+5u]=1u;
}
`;}
function creationShader(plan,stage){const t=plan.template,o=t.segments,q=o.cue.offset,c=o.rawCreation.offset;const begin=stage==='begin',finish=stage==='finish';return `
@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(1) var<storage,read> rc_program:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
${generateWorldCreationWGSL(t,stage)}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){let row=gid.x;if(row>=RC_INIT_COUNT){return;}let bank=row*${t.state.length}u;let c=bank+${c}u;let q=bank+${q}u;if(rc_state[bank+2u]!=0u){return;}if(rc_state[c+5u]!=${begin?1:2}u){rc_state[bank+2u]=4u;rc_state[bank+3u]=11u;return;}rc_world_creation_stage(bank,bank+${o.rawClearance.offset}u,row*${t.numericScratchWords}u);if(rc_state[c]!=0u){rc_state[bank+2u]=4u;rc_state[bank+3u]=5u;return;}${begin?'rc_state[c+5u]=2u;':''}
 ${finish?`if(rc_state[c+4u]!=1u||rc_state[c+1u]!=3u||rc_state[q+2u]!=1u||rc_state[q+4u]!=1u||rc_state[q+5u]!=0u||rc_state[q+6u]!=0u||rc_state[q+7u]!=0u||rc_state[q+13u]!=0u||rc_state[q+47u]!=0u){rc_state[bank+2u]=4u;rc_state[bank+3u]=11u;return;}rc_state[c+5u]=3u;rc_state[bank+2u]=1u;rc_state[bank+3u]=0u;`:''}
}
`;}
/** Ordered fixed dispatch descriptors, no GPU execution. Bind each named
 * resource to the matching read/write slot. The raw pool is reusable after
 * transfer; only copied raw128/clearance16 and the world bank persist over h. */
export function buildWorldInitializationCommands(plan,count){assertWorldInitializationPlan(plan);need(Number.isInteger(count)&&count>=1&&count<=4096,'bounded explicit candidate count');const stages={},commands=[],push=(stage,repeat=1)=>commands.push(Object.freeze({stage,repeat}));
 for(const [name,code]of Object.entries(plan.raw.stages))stages[name]=Object.freeze({code,entryPoint:'main',workgroups:count,bindingTypes:plan.raw.bindingTypes,resources:Object.freeze(['inputs','rawState','rawProgram','rawGeometry','rawScratch'])});for(const command of plan.raw.initialSchedule)push(command.stage,command.repeat);for(let pair=0;pair<plan.raw.pairCount;pair++)for(const command of plan.raw.pairSchedule)push(command.stage,command.repeat);
 stages['world-transfer']=Object.freeze({code:transferShader(plan),entryPoint:'main',workgroups:Math.ceil(count/32),bindingTypes:Object.freeze(['read-only-storage','read-only-storage','storage','read-only-storage']),resources:Object.freeze(['inputs','rawState','worldState','worldTemplate'])});push('world-transfer');
 for(const stage of['begin','gather','evaluate','scatter','finish'])stages['creation-'+stage]=Object.freeze({code:`const RC_INIT_COUNT:u32=${count}u;\n`+creationShader(plan,stage),entryPoint:'main',workgroups:Math.ceil(count/32),bindingTypes:Object.freeze(['storage','read-only-storage','storage']),resources:Object.freeze(['worldState','worldProgram','numericScratch'])});push('creation-begin');for(let role=0;role<3;role++){push('creation-gather');push('creation-evaluate');push('creation-scatter');}push('creation-finish');
 return Object.freeze({stages:Object.freeze(stages),commands:Object.freeze(commands),dispatches:commands.reduce((n,c)=>n+c.repeat,0),resources:Object.freeze({inputs:count*16,rawState:count*plan.raw.layout.stateWords,rawProgram:plan.raw.program.words,rawGeometry:plan.raw.geometry.words,rawScratch:count*plan.raw.layout.scratchWords,worldState:count*plan.template.state.length+plan.template.fixedCcd.length,worldTemplate:plan.clone,worldProgram:plan.template.program,numericScratch:count*plan.template.numericScratchWords}),count,initialUploads:Object.freeze([Object.freeze({resource:'worldState',offsetWords:count*plan.template.state.length,data:plan.template.fixedCcd})]),scratchAlias:Object.freeze({rawScratch:'numericScratch',words:count*Math.max(plan.raw.layout.scratchWords,plan.template.numericScratchWords),lifetime:'raw preparation ends before created numeric mass begins'}),numericalGpuExecuted:false,hostReadbacksBeforeH:0,fullPhysics:false});
}
/** Byte counts from actual serialized source plans, not measured VRAM/timing. */
export function planWorldInitializationBanks(plan,count,{maxStorageBufferBindingSize,maxBufferSize,perCandidateTailWords=0,programTailWords=0}={}){
 assertWorldInitializationPlan(plan);need(Number.isInteger(count)&&count>=1&&count<=4096&&Number.isSafeInteger(maxStorageBufferBindingSize)&&maxStorageBufferBindingSize>0&&Number.isSafeInteger(maxBufferSize)&&maxBufferSize>0,'actual device limits and bounded count');
 need(Number.isSafeInteger(perCandidateTailWords)&&perCandidateTailWords>=0&&perCandidateTailWords<=0xffffffff&&Number.isSafeInteger(programTailWords)&&programTailWords>=0&&programTailWords<=0xffffffff,'bounded explicit transport tails');
 const limit=Math.min(maxStorageBufferBindingSize,maxBufferSize,128*1024*1024),t=plan.template,r=plan.raw,tail=t.fixedCcd.byteLength,control=perCandidateTailWords*4,program=t.program.byteLength+programTailWords*4;
 const spans={world:t.state.byteLength,raw:r.layout.stateWords*4,rawScratch:r.layout.scratchWords*4,numericScratch:t.numericScratchWords*4,input:64};
 const shared=[plan.clone.byteLength,program,t.sharedGeometry.byteLength,r.program.words.byteLength,r.geometry.words.byteLength];need(shared.every(n=>n<=limit),'shared source program/geometry exceeds binding limit');
 let tile=Math.min(count,Math.floor((limit-tail)/(spans.world+control)));for(const n of Object.values(spans))tile=Math.min(tile,Math.floor(limit/n));need(tile>=1,'one exact initialization candidate exceeds binding limit');
 return Object.freeze({count,tileCandidates:tile,tiles:Object.freeze(Array.from({length:Math.ceil(count/tile)},(_,i)=>{const first=i*tile,n=Math.min(tile,count-first);return Object.freeze({first,count:n,stateBytes:n*(spans.world+control)+tail});})),bytesPerCandidate:Object.freeze(spans),fixedCcdTailBytes:tail,perCandidateTailWords,perCandidateTailBytes:control,programTailWords,worldProgramBytes:program,bindingLimitBytes:limit,rawScratchReusedAfterInitialization:true,estimated:true,hardwareMeasured:false});
}
