// SPDX-License-Identifier: Apache-2.0
// Explicit bounded browser imports for already-supported source origins.
// This is not arbitrary live-game admission. No seed metadata is relabeled,
// no cache is discarded, and neither native nor candidate physics is stepped.
import '../experimental-live-registered-origin.js';
import * as D from '../../tools/rapier-snapshot-decoder/browser.mjs';
import * as Goal from './goal-world.mjs';
import * as Settled from './settled-world.mjs';
import * as importedVariant from '../experimental-cue-created-variant.js';
import {requireThat,equal,equalData,plain,hash,journalDigest,verifyDecoded,copy,assertOwnedInputData} from './exact-data.mjs';
const Variant=importedVariant.default??globalThis.LabCueCreatedVariantExperimental;
const F=D.field,f=Math.fround,U=0xffffffff,same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation,key=h=>h.index+':'+h.generation;
const SUPPORTED_SETTINGS=Object.freeze({angle:0,elevation:8,tipX:0,tipY:0,speed:2});
const CAPTURE_KEYS=['apiJournalLength','application','boundary','candidateInput','nativeSteps','strikeCreationJournal'];
const INPUT_KEYS=['capture','decoded','snapshot'];
const APPLICATION_KEYS=['controller','cue','dt','events','game','nextId','params','registry','revision','shots','steps','strokeSubsteps','time'];
const PARAMS=Object.freeze({gravity:9.81,clothFriction:.2,ballFriction:.04,ballRestitution:.93,cushionFriction:.15,cushionRestitution:.82,clothRestitution:.2,tipFriction:.7,tipNormalStiffness:1000000,tipTangentialStiffness:400000,tipNormalDamping:110,tipTangentialDamping:10,cueLateralStiffness:1200,cueLateralDamping:1,rollingLength:.00045,spinLength:.00035});
function handle(h){requireThat(h&&Object.keys(h).sort().join(',')==='generation,index'&&[h.index,h.generation].every(x=>Number.isInteger(x)&&x>=0&&x<=U&&!Object.is(x,-0)),'Exact generation-bearing source handle required');return{index:h.index,generation:h.generation};}
export function canonicalizeCaptureHandles(c){
  // Only mutate the already-owned capture. Transport may reorder object keys,
  // but the unchanged runtime's strict identity checks expect native handle
  // representation {index,generation}. Validate before rebuilding, never drop
  // extra fields, coerce values, infer IDs or reorder unrelated source data.
  const a=c.application;
  for(const o of a.registry.objects)for(const k of ['body','collider','pairCollider'])o[k]=handle(o[k]);
  for(const o of a.registry.statics)for(const k of ['body','collider'])o[k]=handle(o[k]);
  if(a.cue)for(const k of ['shaft','head','guide','shaftCollider','tipCollider','neckCollider','flex','prismatic'])a.cue[k]=handle(a.cue[k]);
  if(c.readiness)for(const body of c.readiness.bodies)body.body=handle(body.body);
  const pending=[...c.strikeCreationJournal],seen=new WeakSet();
  while(pending.length){
    const value=pending.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);
    // Source API references in targets, results and nested descriptor args all
    // name their native identity with the explicit `handle` field.
    for(const k of Object.keys(value))if(k==='handle')value[k]=handle(value[k]);else pending.push(value[k]);
  }
}
const exactKeys=(value,keys)=>equalData(Object.keys(value).sort(),keys.slice().sort(),'Unexpected source capture fields');
function validateCapture(c) {
  equalData(Object.keys(c).sort(),CAPTURE_KEYS,'Only the initial boundary and contemporaneous application/journals are accepted');
  requireThat(['goalStrikeCreated','secondStrikeCreated'].includes(c.boundary),'Only registered placed-first-cue or settled-second-cue origins are supported');equal(c.candidateInput,true);requireThat(Number.isSafeInteger(c.nativeSteps)&&c.nativeSteps>72,'Actual post-constructor native step count required');
  const goal=c.boundary==='goalStrikeCreated',selectedId=goal?1:2;
  requireThat(Number.isSafeInteger(c.apiJournalLength)&&c.apiJournalLength>=13,'Actual source journal sequence required');
  const a=c.application;equalData(Object.keys(a).sort(),APPLICATION_KEYS);
  exactKeys(a.registry,['staticCount','objects','statics']);equal(a.registry.staticCount,16);
  exactKeys(a.controller,['gameMode','selectedId','paused','settings','undoCount','redoCount']);
  exactKeys(a.cue,['shaft','head','guide','shaftCollider','tipCollider','neckCollider','flex','prismatic','selectedId','pose','started','contacted','contacts','obstructions','stats']);
  exactKeys(a.cue.pose,['direction','side','up','contact','tip','rotation','shaftCenter','surface']);
  for(const [k,v]of Object.entries(a.cue.pose)){exactKeys(v,k==='rotation'?['x','y','z','w']:['x','y','z']);requireThat(Object.values(v).every(Number.isFinite),'Finite source application pose required');}
  exactKeys(a.game,['threeCushion','cueIds','redIds','scores','activeCue','pending','lastResult']);
  exactKeys(a.game.pending,['cueId','reds','foul','threeCushion','cushions','goalCushions']);
  for(const e of c.strikeCreationJournal)exactKeys(e,['order','phase','target','method','args','nativeStepsBefore','result','nativeStepsAfter']);
  equal(c.strikeCreationJournal.at(-1)?.order+1,c.apiJournalLength,'Creation journal must end at the captured initial boundary');
  requireThat(Number.isFinite(a.time)&&a.time>0&&Number.isSafeInteger(a.steps)&&a.steps>0,'Actual settled application time and steps required');equal(a.shots,goal?1:2,'Only placed first shot or settled second shot currently supported');if(goal)equal(c.nativeSteps,72+a.steps,'Placed origin must have original constructor plus application settling, not an earlier shot');equal(a.dt,1/960);equal(a.strokeSubsteps,64);
  equalData(a.params,PARAMS,'Only original default material/cue parameters are currently admitted');
  equal(a.controller.gameMode,'four');exactKeys(a.controller.settings,Object.keys(SUPPORTED_SETTINGS));if(goal)Variant.validateSettings(a.controller.settings);else equalData(a.controller.settings,SUPPORTED_SETTINGS,'Settled second-cue import currently requires default controls');
  equal(a.registry.objects.length,4);equal(a.registry.statics.length,16);
  const objects=a.registry.objects,statics=a.registry.statics;
  const ids=objects.map(o=>o.id);requireThat(new Set(ids).size===4&&ids.every(Number.isSafeInteger),'Distinct explicit application object IDs required');
  equalData(ids,[1,2,3,4],'Only the registered original four-ball IDs are supported');equal(a.controller.selectedId,selectedId);equal(a.cue.selectedId,selectedId);
  const bodies=[...objects,...statics].map(o=>o.body),colliders=[...objects.flatMap(o=>[o.collider,o.pairCollider]),...statics.map(o=>o.collider)];
  [...bodies,...colliders,a.cue.shaft,a.cue.head,a.cue.guide,a.cue.shaftCollider,a.cue.tipCollider,a.cue.neckCollider,a.cue.flex,a.cue.prismatic].forEach(handle);
  equal(new Set(bodies.map(key)).size,20);equal(new Set(colliders.map(key)).size,24);
  objects.forEach((o,i)=>{exactKeys(o,['index','id','label','kind','shape','radius','mass','body','collider','pairCollider']);equal(o.index,i);equal(o.mass,.210);equal(o.radius,.03075);equal(o.kind,'ball');equal(o.shape,'sphere');});
  statics.forEach((o,i)=>{exactKeys(o,['index','label','kind','body','collider']);equal(o.index,i);});equal(statics.filter(o=>o.kind==='cloth').length,1);equal(statics.filter(o=>o.kind==='cushion').length,4);
  const axis=['x','y','z'].map(k=>a.cue.pose.direction[k]);requireThat(axis.every(Number.isFinite)&&Math.abs(axis.reduce((sum,x)=>sum+x*x,0)-1)<1e-10,'Finite source unit cue axis required');
  equal(a.cue.started,a.time);equal(a.cue.contacted,false);equalData(a.cue.contacts,[]);equalData(a.cue.obstructions,[]);
  equalData(a.cue.stats,{firstContact:null,lastContact:null,peakNormalForce:0,maxCompression:0,normalImpulse:0,contactEpisodes:0});
  requireThat(Array.isArray(a.events)&&a.events.length>0,'Actual source event history required');equal(a.events.at(-1).kind,'stroke');equal(a.events.at(-1).time,a.time);
  equalData(a.game.cueIds,ids.slice(0,2));equalData(a.game.redIds,ids.slice(2));equal(a.game.activeCue,selectedId);
  equal(a.game.pending.cueId,selectedId);equalData(a.game.pending.reds,[]);equal(a.game.pending.foul,false);equal(a.game.pending.cushions,0);equal(a.game.pending.goalCushions,null);
  equal(a.game.pending.threeCushion,a.game.threeCushion);requireThat(typeof a.game.threeCushion==='boolean');
  equalData(Object.keys(a.game.scores).sort(),ids.slice(0,2).map(String).sort());Object.values(a.game.scores).forEach(x=>requireThat(Number.isSafeInteger(x),'Finite original game scores required'));
}
export function validateBindings(row,{allowAwake=false}={}) {
  const a=row.application,byBody=new Map(row.bodies.map(b=>[key(b.handle),b])),byCollider=new Map(row.colliders.map(c=>[key(c.handle),c]));
  equalData(row.state.gravity,[0,f(-a.params.gravity),0],'Native gravity must match the supported original application parameters');
  for(const o of [...a.registry.objects,...a.registry.statics]) {
    const b=byBody.get(key(o.body));requireThat(b,'Registry body must exist with its exact native generation');
    const attached=o.kind==='ball'?[o.collider,o.pairCollider]:[o.collider];
    equalData(b.colliders,attached,'Source registry must retain all native attachments in their original order');
    for(const h of attached)requireThat(same(byCollider.get(key(h))?.parent?.handle,o.body),'Registry collider parent mismatch');
    equal(b.body_type,o.kind==='ball'?'Dynamic':'Fixed');equal(b.enabled,true);
    if(o.kind==='ball'){
      if(!allowAwake)equal(b.activation.sleeping,true,'Awake/moving initial origins require an observed readiness importer');equal(b.ccd.ccd_enabled,true);
      const primary=byCollider.get(key(o.collider)),pair=byCollider.get(key(o.pairCollider));
      for(const c of [primary,pair]){equal(c.shape.variant,'Ball');equal(c.shape.value.radius,f(o.radius));equal(c.flags.enabled,'Enabled');equal(c.coll_type,'Solid');equal(c.contact_skin,0);equalData(c.parent.pos_wrt_parent,{translation:[0,0,0],rotation:[0,0,0,1],padding:0});}
      equalData(primary.flags.collision_groups,{memberships:1,filter:6,test_mode:'And'});equalData(pair.flags.collision_groups,{memberships:8,filter:8,test_mode:'And'});
      equal(primary.mprops.variant,'Mass');equal(primary.mprops.value,f(o.mass));equal(pair.mprops.variant,'Mass');equal(pair.mprops.value,0);
    }
  }
  for(const h of [a.cue.shaft,a.cue.head]){const b=byBody.get(key(h));requireThat(b,'Actual native cue body required');equalData(b.vels.linvel,['x','y','z'].map(k=>f(a.cue.pose.direction[k]*a.controller.settings.speed)),'Application cue axis must agree with the original native velocity');equalData(b.vels.angvel,[0,0,0]);}
  const floor=a.registry.statics.find(o=>o.kind==='cloth');
  for(const o of a.registry.objects)requireThat(row.contactPairs.some(p=>same(p.collider1,floor.collider)&&same(p.collider2,o.collider)),'Every settled original floor cache must be preserved');
  // Goal projection separately accounts for every retained cloth/cushion/pair
  // graph edge. Settled projection explicitly rejects any non-floor origin.
  if(row.boundary==='secondStrikeCreated')equal(row.contactPairs.length,4,'Settled second-cue import supports only the four retained cloth caches');
  for(const p of row.contactPairs){equal(p.contacts.variant,'Rigid');requireThat(p.contacts.value.manifolds.length<=1,'Multiple native manifolds require a different importer');for(const m of p.contacts.value.manifolds)requireThat(m.points.length<=1&&m.data.solver_contacts.length<=1,'Multiple native points or solver contacts require a different importer');}

}

// The public pure projector owns copies before its first await. It consumes
// real decoder output plus native bytes and explicit source application state,
// never an already-computed seed or a post-shot native state.
export async function projectConfiguredFourBall(input) {
  assertOwnedInputData(input);
  equalData(Object.keys(input).sort(),INPUT_KEYS,'Only snapshot, decoded tree and initial application capture are accepted');
  requireThat(input.snapshot instanceof Uint8Array&&input.snapshot.length>0&&input.snapshot.length<=D.MAX_BYTES,'Bounded native snapshot required');
  const owned=copy(input);assertOwnedInputData(owned);
  const {snapshot,decoded:d,capture:c}=owned;
  validateCapture(c);canonicalizeCaptureHandles(c);await verifyDecoded(d,snapshot);
  for(const n of D.walk(d.state))if(n.kind==='float')requireThat(Number.isFinite(D.floatValue(n)),'Finite native initial state required');
  const state=plain(d.state),arena=name=>F(F(F(d.state,name),name),'items').items.flatMap((entry,index)=>entry.variant==='Occupied'?[{handle:{index,generation:Number(F(entry,'generation').value)},...plain(F(entry,'value'))}]:[]);
  const proxies=[];for(const n of state.broad_phase.tree.nodes)for(const child of[n.left,n.right])if((child.data&0x3fffffff)===1)proxies.push({index:child.children,min:copy(child.mins),max:copy(child.maxs)});
  const row={hCount:0,outerStep:0,outerSubstep:0,boundary:c.boundary,candidateInput:c.candidateInput,nativeSteps:c.nativeSteps,apiJournalLength:c.apiJournalLength,application:c.application,snapshot,sourceRevision:d.sourceRevision,engineSha256:d.engineSha256,snapshotSha256:d.inputSha256,snapshotBytes:d.byteLength,verification:copy(d.verification),typedState:d.state,state,bodies:arena('bodies'),colliders:arena('colliders'),proxies,contactPairs:D.findStructs(F(d.state,'narrow_phase'),'ContactPair').map(plain),strikeCreationJournalSha256:await journalDigest(c.strikeCreationJournal)};
  validateBindings(row);
  const exporter=c.boundary==='goalStrikeCreated'?Goal:Settled;
  return exporter.exportInitialSeed({[c.boundary]:row,strikeCreationJournal:c.strikeCreationJournal});
}

// Convenience composition only. Decoder creation and build-pinned WASM/engine
// provenance stay with the application; this never loads or steps an engine.
export async function importConfiguredFourBall(decoder,input) {
  assertOwnedInputData(input);
  equalData(Object.keys(input).sort(),['capture','snapshot']);
  requireThat(typeof decoder?.decodeSnapshot==='function','An initialized read-only snapshot decoder is required');
  requireThat(input.snapshot instanceof Uint8Array&&input.snapshot.length>0&&input.snapshot.length<=D.MAX_BYTES,'Bounded native snapshot required');
  const owned=copy(input);assertOwnedInputData(owned);validateCapture(owned.capture);
  const decoded=await decoder.decodeSnapshot(owned.snapshot);
  return projectConfiguredFourBall({...owned,decoded});
}
