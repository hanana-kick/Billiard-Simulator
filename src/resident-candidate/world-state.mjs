/* SPDX-License-Identifier: Apache-2.0
 * Initial-only common bank layout for the source registered four-ball owner.
 * This is not a fallback forward solver, evaluator, or raw-creation admission.
 * Every absolute address embedded in a bank has an explicit relocation entry.
 */
import * as importedWorld from '../experimental-four-ball-world.js';
const World=importedWorld.default??globalThis.LabFourBallWorldExperimental;
import '../math.js';import '../physics.js';import '../route-rules.js';
import '../experimental-ccd-bvh-world-bridge.js';
import {packCreatedGeometry} from './geometry-state.mjs';
import {createNarrowPrograms} from './narrowphase.mjs';
import {CONVEX_POINT_LAYOUT} from './convex-point.mjs';
import {encodeSceneInitialization} from './scene-initialization.mjs';
import {encodeSceneWorld,createSceneWorldPrograms} from './scene-world.mjs';
import {createCueProgramBundle,packCueInitialState} from './cue-orchestration.mjs';
import {CUE_LAYOUT} from './cue.mjs';
import {writeCueBridgeInitialState,createCueCcdPrograms} from './cue-bridge.mjs';
import {encodeContactJournal,CONTACT_JOURNAL_LAYOUT} from './contact-journal.mjs';
import {encodeContactRoster} from './contact-roster.mjs';
import {packBvhState,BVH_SCRATCH_WORDS} from './bvh.mjs';
import {completeJournalBodyColliderOrder,encodeWorldBroad,createWorldBroadPrograms} from './world-broad.mjs';
import {packRegisteredCcdSeed,createCcdPrograms,CCD_LAYOUT,packWorldCcdBody} from './ccd.mjs';
import {encodeApplicationState,createApplicationPrograms,APPLICATION_LAYOUT} from './application.mjs';
import {createRuleState,seedEventHistory,binary64Words,RULE_LAYOUT} from './physical-rules.mjs';
import {createHistoryInitialization,validateSeedEventHistory} from '../source-event-history.mjs';
import {createCoupledProgramBundle,coupledStateLayout} from './coupled-solver.mjs';
import {packWorldSolverState} from './world-solver.mjs';
import {packWorldCueGeometry} from './world-cue-geometry.mjs';
import {packCreatedCueClothCache,createCueClothCachePrograms} from './cue-cloth-cache.mjs';
import {encodeWorldApplication} from './world-application.mjs';
const U=0xffffffff,same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
const align=n=>Math.ceil(n/64)*64;
export const WORLD_STATE_CAPABILITY=Object.freeze({initialCreatedTemplate:true,rawCreationAdmitted:false,completeH:false,hostForwardFallback:false,defaultBackend:false});
export const WORLD_HEADER=Object.freeze({magic:0,version:1,status:2,reason:3,candidateId:4,hSequence:5,phase:6,first:7,selected:8,sourceRevision:9,dt:10,stageStatus:11});

/** Common INITIAL data only. `rule` is an explicit caller query, not an
 * invented shot-priority catalog or replacement inverse planner. */
export async function packCreatedWorldTemplate(initial,{rule}={}){
 validateSeedEventHistory(initial);const seed=World.validate(initial);if(seed.kind!=='original-live-registered-four-ball-created-world')throw new RangeError('Authenticated registered four-ball source required');
 if(!rule||!Number.isInteger(rule.maxOuterSteps)||rule.maxOuterSteps<1)throw new RangeError('Explicit rule/horizon required');
 const geometry=packCreatedGeometry(seed),scene=encodeSceneInitialization(seed.cueInitial.sourceCreation,{bodyRegistry:seed.bodyRegistry});
 const roles=seed.cueBroadSeed.roles,slot=h=>{const i=scene.template.bodies.findIndex(b=>same(b.handle,h));if(i<0)throw new RangeError('Original scene generation missing');return i;};
 const bundles={narrow:createNarrowPrograms(),cue:createCueProgramBundle(),cueCcd:createCueCcdPrograms(),scene:createSceneWorldPrograms(),broad:createWorldBroadPrograms(),coupled:createCoupledProgramBundle(),application:createApplicationPrograms()};
 const ccdSeed=packRegisteredCcdSeed(seed);bundles.ccd=createCcdPrograms({pointCounts:ccdSeed.pointCounts});
 const cueGeometry=packWorldCueGeometry(seed,{geometryBase:geometry.catalog.length+geometry.geometry.length});bundles.cueGeometry={...cueGeometry.programs,program:cueGeometry.programs.words};
 const cueCloth=packCreatedCueClothCache(seed);bundles.cueCloth=createCueClothCachePrograms();
 const cue=writeCueBridgeInitialState(packCueInitialState(seed.cueInitial,bundles.cue,{sceneSlots:[slot(roles.head),slot(roles.shaft),slot(roles.guide),slot(seed.balls[seed.selectedIndex].body)]}),seed.cueInitial);
 const order=completeJournalBodyColliderOrder(seed.cueBroadSeed),journal=encodeContactJournal(seed.contactGraphSeed,{bodyColliderOrder:order});
 const roster=encodeContactRoster(seed.solverContactRoster),coupled=coupledStateLayout(4,27);
 const bridge=await globalThis.LabCcdBvhWorldBridgeExperimental.createReferenceStage(seed.cueBroadSeed);let bvh;
 try{bvh=packBvhState(bridge.snapshot(),{generations:Array.from({length:27},(_,i)=>seed.cueBroadSeed.colliders.find(c=>c.handle.index===i)?.handle.generation??null),removableLeaves:seed.contactGraphSeed.cueColliders.map(h=>h.index),freshOrder:seed.cueBroadSeed.modifiedColliders.map(h=>h.index),firstUpdate:true,initialLeaves:24,minimumLeaves:24,maximumLeaves:27});}finally{bridge.dispose();}
 const segments={},parts=[];let words=0;
 const add=(name,data)=>{words=align(words);const source=typeof data==='number'?new Uint32Array(data):new Uint32Array(data);segments[name]=Object.freeze({offset:words,words:source.length});parts.push([words,source]);words+=source.length;return segments[name].offset;};
 const header=add('header',64),bodies=add('bodies',6*64);add('cue',cue);add('scene',scene.sceneWords);add('initialization',scene.words);add('journal',journal);add('roster',roster);add('sceneAdapter',128*8);add('bvh',bvh);const bvhScratch=add('bvhScratch',BVH_SCRATCH_WORDS);add('caches',geometry.caches);add('geometryFacts',128*6);add('manifoldViews',128*8);add('geometryRefreshed',128);add('ccd',CCD_LAYOUT.words);add('coupled',coupled.stateWords);add('rules',128);add('application',APPLICATION_LAYOUT.words);add('applicationRegisters',bundles.application.registerWords);add('applicationControl',bundles.application.controlWords);add('applicationOutput',bundles.application.outputWords);add('others',3);add('projectionOutput',CONVEX_POINT_LAYOUT.outputWords);add('rawPose',128);
 const bindings=[...seed.balls.map((b,i)=>({body:b.body,bodyBase:bodies+i*64,sceneSlot:slot(b.body)})),{body:roles.shaft,bodyBase:bodies+4*64,sceneSlot:slot(roles.shaft)},{body:roles.head,bodyBase:bodies+5*64,sceneSlot:slot(roles.head)},{body:roles.guide,bodyBase:U,sceneSlot:slot(roles.guide)}];
 add('broad',encodeWorldBroad(seed.cueBroadSeed,{bindings}));
 add('worldSolver',packWorldSolverState(seed,bindings));add('cuePreSolve',128);add('cueClothView',8);
 add('rawCreation',16);add('rawClearance',16);add('cueGeometry',cueGeometry.stateWords);add('cueCloth',cueCloth.state);add('worldApplication',encodeWorldApplication());add('worldH',32);
 add('sceneWorld',encodeSceneWorld(scene.template,{bodyBindings:bindings.slice(0,6).map((b,i)=>({handle:b.body,canonicalIndex:i})),gravity:seed.balls[0].state.gravity,lengthUnit:seed.balls[0].state.lengthUnit,initialEdges:seed.globalEdges}));
 words=align(words);const state=new Uint32Array(words);for(const[at,a]of parts)state.set(a,at);state.set(geometry.bodyWords,bodies);
 state.set([0x52435753,1,0,0,U,0,0,1,seed.selectedIndex,0,bits(seed.balls[0].state.dt),0],header);state[segments.bvh.offset+20]=bvhScratch;
 const relocations=[segments.bvh.offset+20];
 bindings.forEach((b,i)=>{if(b.bodyBase!==U)relocations.push(segments.broad.offset+464+i*6+2);});
 const objectRows=seed.sceneRegistry.objects.map((o,i)=>({id:o.id,body:o.body,bodyBase:bodies+i*64,sceneSlot:slot(o.body),primaryCollider:o.primaryCollider.handle,pairCollider:o.pairCollider.handle,mass:o.mass,radius:o.radius,isSphere:true}));
 const cueColliders={shaft:seed.cueBroadSeed.colliders.find(c=>same(c.parent.handle,roles.shaft)).handle,neck:seed.cueBroadSeed.colliders.find(c=>same(c.parent.handle,roles.head)&&c.shape.variant==='Cylinder').handle,tip:seed.cueBroadSeed.colliders.find(c=>same(c.parent.handle,roles.head)&&c.shape.variant==='Ball').handle};
 const metadata=seed.contactGraphSeed.colliders.map(c=>{const object=seed.sceneRegistry.objects.find(o=>same(o.primaryCollider.handle,c.handle)||same(o.pairCollider.handle,c.handle));if(object)return{handle:c.handle,kind:'ball',id:object.id};const fixed=seed.sceneRegistry.statics.find(s=>same(s.collider.handle,c.handle));if(fixed){const rail=globalThis.LabRouteRules.railId(fixed);return{handle:c.handle,kind:['cloth','floor','cushion'].includes(fixed.kind)?fixed.kind:'unknown',rail:rail?['x+','x-','z+','z-'].indexOf(rail)+1:0};}return{handle:c.handle,kind:same(c.handle,cueColliders.tip)?'tip':'shaft'};});
 const a=seed.cueInitial.application,p=seed.sourceOrigin.params,D=globalThis.LabDimensions;
 const app=encodeApplicationState({objects:objectRows,colliders:metadata,selectedId:a.selectedId,cueColliders,time:a.initialTime,start:a.initialTime,dt:a.dt,cueStarted:a.started,gravity:p.gravity,rollingLength:p.rollingLength,spinLength:p.spinLength,width:D.width,depth:D.depth,cuePresent:true,strokeSubsteps:a.subdivisions});
 state.set(app,segments.application.offset);objectRows.forEach((_,i)=>relocations.push(segments.application.offset+64+i*16+3));
 const [cueId,opponentId]=[a.selectedId,seed.game.cueIds.find(id=>id!==a.selectedId)];if(!seed.game.redIds.includes(rule.firstId)||!seed.game.redIds.includes(rule.secondId)||rule.firstId===rule.secondId)throw new RangeError('Rule requires the actual distinct red identities');
 const ruleState=createRuleState({...rule,cueId,opponentId,threeCushion:seed.game.threeCushion});
 // Legacy artifacts retain their contact-only initialization unchanged. New
 // source-full profiles carry EVERY original emit, including accepted stroke.
 // Pair handles preserve their exact source Number bits and generations.
 const historyInitialization=createHistoryInitialization(seed,metadata);
 const history=(seed.initialContactEvents??[]).slice(-8).map(e=>{let pairId=null;if(e.key!==undefined){const parts=String(e.key).split(':').map(Number);if(parts.length!==2||parts.some(x=>!Number.isFinite(x)))throw new RangeError('Unrecognized source contact key');const indices=parts.map(value=>{const b=new ArrayBuffer(8),d=new DataView(b);d.setFloat64(0,value,true);const h={index:d.getUint32(0,true),generation:d.getUint32(4,true)};const i=metadata.findIndex(c=>same(c.handle,h));if(i<0)throw new RangeError('Historical collider generation unavailable');return i;});pairId=Math.min(...indices)*27+Math.max(...indices);}return{pairId,time:binary64Words(e.time)};});
 if(historyInitialization){const h=historyInitialization.created;ruleState[RULE_LAYOUT.ringCount]=h.count;ruleState[RULE_LAYOUT.ringHead]=h.head;ruleState.set(h.words,RULE_LAYOUT.ring);}else seedEventHistory(ruleState,history);state.set(ruleState,segments.rules.offset);
 const others=seed.balls.flatMap((_,i)=>i===seed.selectedIndex?[]:[bodies+i*64]);state.set(others,segments.others.offset);others.forEach((_,i)=>relocations.push(segments.others.offset+i));
 seed.balls.forEach((b,i)=>state.set(packWorldCcdBody(b.state),segments.ccd.offset+CCD_LAYOUT.body+i*CCD_LAYOUT.bodyWords));
 const programParts=[],programOffsets={};let programWords=0;for(const[name,b]of Object.entries(bundles)){programOffsets[name]=programWords;programParts.push(b.program);programWords+=b.program.length;}const program=new Uint32Array(programWords);let at=0;for(const p of programParts){program.set(p,at);at+=p.length;}
 const catalogOffset=0,hullOffset=geometry.catalog.length,sharedGeometry=new Uint32Array(hullOffset+geometry.geometry.length+cueGeometry.geometryWords.length);sharedGeometry.set(geometry.catalog);sharedGeometry.set(geometry.geometry,hullOffset);sharedGeometry.set(cueGeometry.geometryWords,hullOffset+geometry.geometry.length);
 const minCcdDt=seed.cueInitial.sourceCreation.created.integration.min_ccd_dt;if(!Number.isFinite(minCcdDt)||minCcdDt<=0||Math.fround(minCcdDt)!==minCcdDt)throw new RangeError('Original native minimum CCD dt required');
 return Object.freeze({kind:'resident-created-world-layout',...(historyInitialization?{historyInitialization}:{}),minimumCcdDtWord:bits(minCcdDt),sourceIdentity:seed.initialSnapshotSha256,capability:WORLD_STATE_CAPABILITY,state,segments:Object.freeze(segments),relocations:Uint32Array.from(relocations),program,programOffsets:Object.freeze(programOffsets),bundles,sharedGeometry,geometryOffsets:Object.freeze({catalog:catalogOffset,hulls:hullOffset}),fixedCcd:ccdSeed.words,coupledLayout:coupled,sceneTemplate:scene.template,bindings,selectedIndex:seed.selectedIndex,numericScratchWords:Math.max(CONVEX_POINT_LAYOUT.scratchWords,...Object.values(bundles).map(b=>b.scratchWords??b.numericScratchWords??0)),unfinishedOwners:Object.freeze(['raw-allocation-admission','canonical-cue-population','live-cue-cache','whole-h-stage-composition'])});
}

/** Measured device limits are supplied by the caller. This is an allocation
 * estimate from exact serialized byte lengths, not VRAM measurement/timing. */
export function planResidentBanks(template,count,{maxStorageBufferBindingSize,maxBufferSize,maxCandidates=4096}={}){
 if(!Number.isInteger(count)||count<1||count>maxCandidates||!Number.isSafeInteger(maxStorageBufferBindingSize)||!Number.isSafeInteger(maxBufferSize))throw new RangeError('Explicit batch and actual device limits required');
 const stateBytes=template.state.byteLength,scratchBytes=template.numericScratchWords*4,perBinding=Math.min(maxStorageBufferBindingSize,maxBufferSize),fixedTailBytes=template.fixedCcd.byteLength,tileCandidates=Math.min(count,Math.floor((perBinding-fixedTailBytes)/stateBytes),Math.floor(perBinding/scratchBytes));if(tileCandidates<1)throw new RangeError('One exact candidate exceeds device binding capacity');
 const tiles=Array.from({length:Math.ceil(count/tileCandidates)},(_,i)=>({first:i*tileCandidates,count:Math.min(tileCandidates,count-i*tileCandidates)}));
 return Object.freeze({candidates:count,stateBytesPerCandidate:stateBytes,scratchBytesPerCandidate:scratchBytes,tileCandidates,tiles,persistentAndTransientBankBytes:stateBytes*count,fixedTailBytesPerTile:fixedTailBytes,reusedTileScratchBytes:scratchBytes*tileCandidates,sharedBytes:template.program.byteLength+template.sharedGeometry.byteLength+fixedTailBytes*tiles.length,estimated:true,hardwareMeasured:false});
}

/** Immutable template plus the complete relocation table. Candidate state is
 * cloned on device; this does not admit raw creation or execute a physical h. */
export function packWorldCloneTemplate(template){
 if(template?.kind!=='resident-created-world-layout'||!(template.state instanceof Uint32Array)||!(template.relocations instanceof Uint32Array))throw new TypeError('Original created-world layout required');
 const out=new Uint32Array(template.state.length+template.relocations.length);out.set(template.state);out.set(template.relocations,template.state.length);
 for(const at of template.relocations)if(at>=template.state.length||template.state[at]>=template.state.length)throw new RangeError('Every initial absolute pointer must stay inside its candidate bank');
 if(new Set(template.relocations).size!==template.relocations.length)throw new RangeError('Duplicate relocation would cross candidate ownership');
 return out;
}
export function generateWorldCloneWGSL(template){
 packWorldCloneTemplate(template);const n=template.state.length,relocations=template.relocations.length;
 return `
// rc_template is immutable common INITIAL state, never future trajectory data.
fn rc_world_clone(bank:u32,candidateId:u32){
 for(var i=0u;i<${n}u;i++){rc_state[bank+i]=rc_template[i];}
 for(var i=0u;i<${relocations}u;i++){let at=rc_template[${n}u+i];rc_state[bank+at]=rc_template[at]+bank;}
 rc_state[bank+4u]=candidateId;
}
`;
}
