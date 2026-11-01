// SPDX-License-Identifier: Apache-2.0
// Browser source admission for an actual unchanged-engine fork of the supplied
// controller. Both snapshots are owned and byte verified. No CPU continuation,
// restored seed substitution, fixture relabeling or future oracle input.
import '../experimental-live-registered-origin.js';
import * as D from '../../tools/rapier-snapshot-decoder/browser.mjs';
import * as World from './live-world.mjs';
import {captureAcceptedEventHistory} from '../source-event-history.mjs';
import * as importedOrigin from '../experimental-live-registered-origin.js';
import * as importedVariant from '../experimental-cue-created-variant.js';
import {canonicalizeCaptureHandles,validateBindings} from './configured-four-ball.mjs';
import {requireThat,equal,equalData,plain,journalDigest,verifyDecoded,copy,assertOwnedInputData} from './exact-data.mjs';
const Origin=importedOrigin.default??globalThis.LabLiveRegisteredOriginExperimental;
const Variant=importedVariant.default??globalThis.LabCueCreatedVariantExperimental;
const F=D.field,key=h=>h.index+':'+h.generation,same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
const exactKeys=(v,keys)=>equalData(Object.keys(v).sort(),keys.slice().sort(),'Unexpected live source capture fields');
const CAPTURE_KEYS=['boundary','candidateInput','apiJournalLength','application','strikeCreationJournal','nativeRestoreUsed','preStrikeApplication','readiness'];
const APPLICATION_KEYS=['controller','cue','dt','events','game','nextId','params','registry','revision','shots','steps','strokeSubsteps','time'];
const PARAMS=Object.freeze({gravity:9.81,clothFriction:.2,ballFriction:.04,ballRestitution:.93,cushionFriction:.15,cushionRestitution:.82,clothRestitution:.2,tipFriction:.7,tipNormalStiffness:1000000,tipTangentialStiffness:400000,tipNormalDamping:110,tipTangentialDamping:10,cueLateralStiffness:1200,cueLateralDamping:1,rollingLength:.00045,spinLength:.00035});

function applicationShape(a,created){
 exactKeys(a,APPLICATION_KEYS);exactKeys(a.registry,['staticCount','objects','statics']);equal(a.registry.staticCount,16);
 exactKeys(a.controller,['gameMode','selectedId','paused','settings','undoCount','redoCount']);
 equal(a.controller.gameMode,'four');exactKeys(a.controller.settings,['angle','elevation','tipX','tipY','speed']);Variant.validateSettings(a.controller.settings);
 equalData(a.params,PARAMS,'Live import currently requires unchanged default material, gravity and cue parameters');
 equal(a.dt,1/960);equal(a.strokeSubsteps,64);
 for(const k of ['steps','shots','revision','nextId'])requireThat(Number.isSafeInteger(a[k])&&a[k]>=0,'Original application integer required: '+k);
 requireThat(Number.isFinite(a.time)&&a.time>=0,'Original application time required');
 equal(a.registry.objects.length,4);equal(a.registry.statics.length,16);
 const objects=a.registry.objects,statics=a.registry.statics,ids=objects.map(o=>o.id);
 requireThat(new Set(ids).size===4&&ids.every(Number.isSafeInteger),'Distinct registered original object IDs required');
 objects.forEach((o,i)=>{exactKeys(o,['index','id','label','kind','shape','radius','mass','body','collider','pairCollider']);equal(o.index,i);equal(o.mass,.210);equal(o.radius,.03075);equal(o.kind,'ball');equal(o.shape,'sphere');});
 statics.forEach((o,i)=>{exactKeys(o,['index','label','kind','body','collider']);equal(o.index,i);});equal(statics.filter(o=>o.kind==='cloth').length,1);equal(statics.filter(o=>o.kind==='cushion').length,4);
 const bodies=[...objects,...statics].map(o=>o.body),colliders=[...objects.flatMap(o=>[o.collider,o.pairCollider]),...statics.map(o=>o.collider)];
 equal(new Set(bodies.map(key)).size,20);equal(new Set(colliders.map(key)).size,24);
 exactKeys(a.game,['threeCushion','cueIds','redIds','scores','activeCue','pending','lastResult']);
 equalData(a.game.cueIds,ids.slice(0,2));equalData(a.game.redIds,ids.slice(2));requireThat(a.game.cueIds.includes(a.controller.selectedId),'Actual original cue ball must be selected');
 exactKeys(a.game.scores,ids.slice(0,2).map(String));for(const score of Object.values(a.game.scores))requireThat(Number.isSafeInteger(score));
 requireThat(Array.isArray(a.events),'Actual source event history required');
 if(!created){equal(a.cue,null,'Source has an active cue');equal(a.game.pending,null,'Source game still awaits a shot result');return;}
 exactKeys(a.cue,['shaft','head','guide','shaftCollider','tipCollider','neckCollider','flex','prismatic','selectedId','pose','started','contacted','contacts','obstructions','stats']);
 exactKeys(a.cue.pose,['direction','side','up','contact','tip','rotation','shaftCenter','surface']);
 for(const [k,v]of Object.entries(a.cue.pose)){exactKeys(v,k==='rotation'?['x','y','z','w']:['x','y','z']);requireThat(Object.values(v).every(Number.isFinite),'Finite source cue pose required');}
 equal(a.cue.selectedId,a.controller.selectedId);equal(a.cue.started,a.time);equal(a.cue.contacted,false);equalData(a.cue.contacts,[]);equalData(a.cue.obstructions,[]);
 equalData(a.cue.stats,{firstContact:null,lastContact:null,peakNormalForce:0,maxCompression:0,normalImpulse:0,contactEpisodes:0});
 exactKeys(a.game.pending,['cueId','reds','foul','threeCushion','cushions','goalCushions']);equal(a.game.pending.cueId,a.controller.selectedId);equalData(a.game.pending.reds,[]);equal(a.game.pending.foul,false);equal(a.game.pending.cushions,0);equal(a.game.pending.goalCushions,null);requireThat(typeof a.game.pending.threeCushion==='boolean','Actual source per-shot rules required');
 equal(a.events.at(-1)?.kind,'stroke');equal(a.events.at(-1)?.time,a.time);
}
function validateCapture(c){
 exactKeys(c,CAPTURE_KEYS);equal(c.boundary,Origin.BOUNDARY);equal(c.candidateInput,true);equal(c.nativeRestoreUsed,true);
 requireThat(Number.isSafeInteger(c.apiJournalLength)&&c.apiJournalLength>=13,'Actual candidate creation sequence required');
 applicationShape(c.preStrikeApplication,false);applicationShape(c.application,true);
 requireThat(Array.isArray(c.strikeCreationJournal)&&c.strikeCreationJournal.length===13,'Exactly the original cue creation calls required');
 for(const e of c.strikeCreationJournal)exactKeys(e,['order','phase','target','method','args','captureNativeStepsBefore','result','captureNativeStepsAfter']);
 equal(c.strikeCreationJournal.at(-1).order+1,c.apiJournalLength,'Creation journal ends at the exact initial capture');
 const a=c.application,b=c.preStrikeApplication;
 equalData(a.registry,b.registry,'Candidate may not replace source layout or handle generations');equalData(a.params,b.params);equalData(a.controller.settings,b.controller.settings);equal(a.controller.selectedId,b.controller.selectedId);
 for(const k of ['time','steps','dt','strokeSubsteps','nextId'])equal(a[k],b[k],'Cue construction cannot advance the source application: '+k);
 equal(a.shots,b.shots+1);equal(a.revision,b.revision+1);
 captureAcceptedEventHistory(b,a); // Exact original application list transition, not contact-only filtering.
}
function normalize(decoded,snapshot){
 for(const n of D.walk(decoded.state))if(n.kind==='float')requireThat(Number.isFinite(D.floatValue(n)),'Finite original native state required');
 const state=plain(decoded.state),arena=name=>F(F(F(decoded.state,name),name),'items').items.flatMap((entry,index)=>entry.variant==='Occupied'?[{handle:{index,generation:Number(F(entry,'generation').value)},...plain(F(entry,'value'))}]:[]);
 const proxies=[];for(const n of state.broad_phase.tree.nodes)for(const c of[n.left,n.right])if((c.data&0x3fffffff)===1)proxies.push({index:c.children,min:copy(c.mins),max:copy(c.maxs)});
 return {snapshot,sourceRevision:decoded.sourceRevision,engineSha256:decoded.engineSha256,snapshotSha256:decoded.inputSha256,snapshotBytes:decoded.byteLength,verification:copy(decoded.verification),typedState:decoded.state,state,bodies:arena('bodies'),colliders:arena('colliders'),proxies,contactPairs:D.findStructs(F(decoded.state,'narrow_phase'),'ContactPair').map(plain)};
}
function bindBeforeAfter(before,row,c){
 equal(before.bodies.length,20,'A registered source before cue construction has exactly four balls and sixteen static bodies');equal(before.colliders.length,24);
 equal(row.bodies.length,23);equal(row.colliders.length,27);
 equal(before.state.broad_phase.frame_index,row.state.broad_phase.frame_index,'Original cue construction must not advance any native frame');
 for(const b of before.bodies){const after=row.bodies.find(x=>same(x.handle,b.handle));requireThat(after,'Original body generation disappeared');equalData(after,b,'No original body state may change during cue-only fork capture');}
 for(const co of before.colliders){const after=row.colliders.find(x=>same(x.handle,co.handle));requireThat(after,'Original collider generation disappeared');equalData(after,co,'No original collider state may change during cue-only fork capture');}
 // Original fire creates only three bodies, three colliders and two joints. It
 // must not alter any retained broad/narrow cache or solver metadata.
 equalData(row.state.broad_phase,before.state.broad_phase,'No source BVH may be rebuilt during capture');equalData(row.state.narrow_phase,before.state.narrow_phase,'No retained contact/solver state may change during capture');
 const bodies=c.preStrikeApplication.registry.objects.map(o=>{const b=before.bodies.find(b=>same(b.handle,o.body));requireThat(b);return{body:copy(o.body),sleeping:b.activation.sleeping,linear:copy(b.vels.linvel),angular:copy(b.vels.angvel)};});
 equalData(c.readiness.bodies,bodies,'Actual source readiness must match native snapshot');
 requireThat(!bodies.some(b=>!b.sleeping&&(Math.hypot(...b.linear)>.002||Math.hypot(...b.angular)>.05)),'Original anyMotion rejects this source');
 return bodies;
}
export async function projectLiveRegisteredFourBall(input){
 assertOwnedInputData(input);exactKeys(input,['snapshot','preStrikeSnapshot','decoded','preStrikeDecoded','capture']);
 const owned=copy(input);assertOwnedInputData(owned);const {snapshot,preStrikeSnapshot,decoded,preStrikeDecoded,capture:c}=owned;
 for(const bytes of[snapshot,preStrikeSnapshot])requireThat(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=D.MAX_BYTES,'Bounded owned native snapshot bytes required');
 validateCapture(c);canonicalizeCaptureHandles(c);canonicalizeCaptureHandles({application:c.preStrikeApplication,strikeCreationJournal:[]});
 // Both immutable inputs were copied before the first asynchronous hash.
 await verifyDecoded(decoded,snapshot);await verifyDecoded(preStrikeDecoded,preStrikeSnapshot);
 const row=normalize(decoded,snapshot),before=normalize(preStrikeDecoded,preStrikeSnapshot),a=c.application,b=c.preStrikeApplication;
 bindBeforeAfter(before,row,c);
 const clock=(application,native)=>({...Object.fromEntries(['time','steps','shots','revision'].map(k=>[k,application[k]])),nativeFrameIndex:native.state.broad_phase.frame_index});
 const selectedIndex=a.registry.objects.findIndex(o=>o.id===a.controller.selectedId);
 const sourceOrigin=Origin.validateSourceOrigin({schema:Origin.SCHEMA,boundary:Origin.BOUNDARY,nativeRestoreUsed:true,preStrikeSnapshotSha256:before.snapshotSha256,createdSnapshotSha256:row.snapshotSha256,preStrikeClock:clock(b,before),createdClock:clock(a,row),selectedId:a.controller.selectedId,selectedIndex,selectedBody:copy(a.registry.objects[selectedIndex].body),settings:copy(a.controller.settings),params:copy(a.params),gameBefore:copy(b.game),readiness:copy(c.readiness)});
 Object.assign(row,{hCount:0,outerStep:0,outerSubstep:0,boundary:Origin.BOUNDARY,candidateInput:true,nativeFrameIndex:sourceOrigin.createdClock.nativeFrameIndex,apiJournalLength:c.apiJournalLength,application:a,sourceOrigin,...captureAcceptedEventHistory(b,a),strikeCreationJournalSha256:await journalDigest(c.strikeCreationJournal)});
 validateBindings(row,{allowAwake:true});Origin.validateApplication(a,sourceOrigin);Origin.validateStrikeJournal(c.strikeCreationJournal,sourceOrigin,{apiJournalLength:c.apiJournalLength,cue:a.cue});
 return World.exportInitialSeed({[Origin.BOUNDARY]:row,strikeCreationJournal:c.strikeCreationJournal});
}
export async function importLiveRegisteredFourBall(decoder,input){
 assertOwnedInputData(input);exactKeys(input,['snapshot','preStrikeSnapshot','capture']);requireThat(typeof decoder?.decodeSnapshot==='function','Initialized read-only source decoder required');
 const owned=copy(input);assertOwnedInputData(owned);validateCapture(owned.capture);
 for(const bytes of[owned.snapshot,owned.preStrikeSnapshot])requireThat(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=D.MAX_BYTES,'Bounded owned native snapshot bytes required');
 const preStrikeDecoded=await decoder.decodeSnapshot(owned.preStrikeSnapshot),decoded=await decoder.decodeSnapshot(owned.snapshot);
 return projectLiveRegisteredFourBall({...owned,decoded,preStrikeDecoded});
}
