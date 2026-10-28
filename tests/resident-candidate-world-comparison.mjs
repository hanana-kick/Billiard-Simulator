// Test-only pure strict world comparator. No engine/oracle construction, Node
// imports, GPU execution, file access or expected-state upload authority.
// The assertion implementation is injected; existing Node gates bind the SAME
// node:assert/strict object. Browser callers supply equivalent ok/equal methods.
import {validateSeedEventHistory} from '../src/source-event-history.mjs';
import {decodeContactJournal} from '../src/resident-candidate/contact-journal.mjs';
import {decodeContactRoster} from '../src/resident-candidate/contact-roster.mjs';
import {decodeSceneActivation,SCENE_LAYOUT,unpackBvhState,decodeCueClothCache,COUPLED_BODY_OFFSETS as B,CUE_LAYOUT as Q,APPLICATION_LAYOUT as A,WORLD_APPLICATION_LAYOUT as WA} from './resident-candidate-world-comparison-decoders.mjs';
import {decodeRuleState,RULE_LAYOUT as R} from '../src/resident-candidate/physical-rules.mjs';

export const WHOLE_H_COMPARISON_COVERAGE=Object.freeze({
 exact:['canonical four ball pose/velocity/inertia/force/user torque','canonical live cue and packed cue joint bodies/impulses','26 source numerical caches including warmstart and recycle state','head-tip cloth cache','dense journal edges/adjacency/lifetimes','source solver roster masks/buckets/epochs','scene native allocator/connectivity/activation and modified body order','source BVH topology/bounds/pending order','binary64 application/cue clocks and h/outer counters plus retained debounce ring','unchanged optimizer query state at outer boundaries'],
 notRepresented:['full presentation event positions/history beyond retained debounce ring','source raw body/collider objects and unrelated immutable metadata','CCD internal scratch history beyond committed canonical/BVH state','non-numerical empty cue cache internal traversal scratch'],
 hardwarePerformance:false,rawCreation:false,
});

const DEFAULT_DEPENDENCIES=Object.freeze({decodeContactJournal,decodeContactRoster,decodeSceneActivation,SCENE_LAYOUT,unpackBvhState,decodeCueClothCache,B,Q,A,WA,decodeRuleState,R});
export function createWorldComparison(assert,dependencies=DEFAULT_DEPENDENCIES){
 const {decodeContactJournal,decodeContactRoster,decodeSceneActivation,SCENE_LAYOUT,unpackBvhState,decodeCueClothCache,B,Q,A,WA,decodeRuleState,R}=dependencies;

 if(typeof assert?.ok!=='function'||typeof assert?.equal!=='function')throw new TypeError('Strict assertion ok/equal implementation required');
 const clone=structuredClone,U=0xffffffff;
const fbits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
const real=x=>new Float32Array(Uint32Array.of(x).buffer)[0];
const fvec=a=>a.map(fbits);
const nwords=x=>{const d=new DataView(new ArrayBuffer(8));d.setFloat64(0,x,true);return[d.getUint32(0,true),d.getUint32(4,true)];};
const pick=(x,keys)=>Object.fromEntries(keys.map(k=>[k,x[k]]));
const same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
/** Bounded first-mismatch diagnostics, never stringify a whole candidate bank. */
function firstWorldMismatch(actual,expected,path='$'){
 if(Object.is(actual,expected))return null;
 if(typeof actual!==typeof expected||actual===null||expected===null||typeof expected!=='object')return{path,actual,expected};
 if(Array.isArray(actual)!==Array.isArray(expected))return{path,actualType:typeof actual,expectedType:typeof expected};
 if(Array.isArray(expected)){if(actual.length!==expected.length)return{path:path+'.length',actual:actual.length,expected:expected.length};for(let i=0;i<expected.length;i++){const d=firstWorldMismatch(actual[i],expected[i],path+'['+i+']');if(d)return d;}return null;}
 const keys=Object.keys(expected);for(const k of keys){if(!Object.hasOwn(actual,k))return{path:path+'.'+k,actual:'<missing>',expected:expected[k]};const d=firstWorldMismatch(actual[k],expected[k],path+'.'+k);if(d)return d;}for(const k of Object.keys(actual))if(!Object.hasOwn(expected,k))return{path:path+'.'+k,actual:actual[k],expected:'<absent>'};return null;
}
function assertWorldEquivalent(actual,expected,label='whole-h'){
 const d=firstWorldMismatch(actual,expected);assert.equal(d,null,label+' first mismatch: '+JSON.stringify(d,(_,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):Object.is(v,-0)?'-0':v));
}
const BODY_VECTORS={linear:3,angular:3,translation:3,rotation:4,invMass:3,invInertia:9,principalInertia:3,invPrincipalInertia:3,principalFrame:4,userForce:3,userTorque:3,force:3};
const BODY_SCALARS=['gravityScale','linearDamping','angularDamping','gyroscopic','allowFastRotation','radius'];
function sourceBall(b){const x={};for(const[k]of Object.entries(BODY_VECTORS))x[k]=fvec(b.state[k]);for(const k of BODY_SCALARS)x[k]=fbits(Number(b.state[k]));return x;}
function bankBall(a,p){const x={};for(const[k,n]of Object.entries(BODY_VECTORS))x[k]=Array.from(a.slice(p+B[k],p+B[k]+n));for(const k of BODY_SCALARS)x[k]=a[p+B[k]];return x;}
const CUE_VECTORS={linear:[0,3],angular:[3,3],translation:[6,3],rotation:[9,4],localCom:[13,3],invMass:[16,3],invInertia:[19,6],principalFrame:[25,4],invPrincipalInertia:[29,3],userForce:[32,3],userTorque:[35,3]};
function sourceCueBody(body){return Object.fromEntries(Object.entries(CUE_VECTORS).map(([k])=>[k,fvec(body[k]??body.pose?.[k])]));}
function bankCueBody(a,p){return Object.fromEntries(Object.entries(CUE_VECTORS).map(([k,[at,n]])=>[k,Array.from(a.slice(p+at,p+at+n))]));}
const FLOOR_V={normal:[55,3],anchor1:[58,3],anchor2:[61,3],dp1:[64,3],dp2:[67,3],warmWorld:[72,3],tangentImpulse:[75,2],localP1:[78,3],localP2:[81,3],localN2:[84,3],recycleTranslation:[87,3],recycleRotation:[90,4],tangentVelocity:[105,3],warmTangent:[115,2],localN1:[133,3]};
const FLOOR_S={impulse:70,warmImpulse:71,contactDistance:77,maxExtent:94,maxDrift:95,friction:96,restitution:97};
const PAIR_V={normal:[148,3],anchor1:[151,3],anchor2:[154,3],dp1:[157,3],dp2:[160,3],warmWorld:[163,3],warmTangent:[168,2],localP1:[170,3],localP2:[173,3],localN1:[176,3],localN2:[179,3],recycleTranslation:[183,3],recycleRelativeRotation:[186,4],recycleRotation1:[190,4],recycleRotation2:[194,4],tangentImpulse:[217,2]};
const PAIR_S={warmImpulse:166,impulse:167,contactDistance:182,maxExtent:198,maxDrift:199};
const CONVEX_V={normal:[272,3],anchor1:[275,3],anchor2:[278,3],dp1:[281,3],dp2:[284,3],warmWorld:[287,3],localP1:[294,3],localP2:[297,3],localN1:[300,3],localN2:[303,3],recycleTranslation:[307,3],recycleRotation:[310,4],warmTangent:[372,2],tangentImpulse:[374,2]};
const CONVEX_S={warmImpulse:290,impulse:291,friction:292,restitution:293,contactDistance:306,maxExtent:314,maxDrift:315};
function sourceCache(c,kind){const v=kind===0?FLOOR_V:kind===1?PAIR_V:CONVEX_V,s=kind===0?FLOOR_S:kind===1?PAIR_S:CONVEX_S,x={};for(const k of Object.keys(v)){assert.ok(Array.isArray(c[k]),'source cache kind '+kind+' missing '+k);x[k]=fvec(c[k]);}for(const k of Object.keys(s))x[k]=fbits(c[k]);const t=kind===0?c.topology:c;for(const k of ['pairPresent','pointPresent','active','recycleValid'])x[k]=!!t[k];if(kind===0)x.manifoldPresent=!!t.manifoldPresent;x.contactId=c.contactId;if(kind!==0){x.feature1=c.feature1;x.feature2=c.feature2;}return x;}
function bankCache(a,p,kind){const v=kind===0?FLOOR_V:kind===1?PAIR_V:CONVEX_V,s=kind===0?FLOOR_S:kind===1?PAIR_S:CONVEX_S,x={};for(const[k,[at,n]]of Object.entries(v))x[k]=Array.from(a.slice(p+at,p+at+n));for(const[k,at]of Object.entries(s))x[k]=a[p+at];if(kind===0){Object.assign(x,{pairPresent:!!a[p+128],manifoldPresent:!!a[p+129],pointPresent:!!a[p+130],active:!!a[p+131],recycleValid:!!a[p+132],contactId:a[p+136]});}else if(kind===1){for(const[k,at]of Object.entries({pairPresent:203,pointPresent:201,active:202,recycleValid:200}))x[k]=real(a[p+at])!==0;Object.assign(x,{contactId:a[p+322],feature1:a[p+320],feature2:a[p+321]});}else{Object.assign(x,{pairPresent:!!a[p+390],pointPresent:real(a[p+317])!==0,active:real(a[p+318])!==0,recycleValid:real(a[p+316])!==0,contactId:a[p+386],feature1:a[p+384],feature2:a[p+385]});}return x;}
function cacheSources(seed,snapshot,catalog){const result=[];for(let i=0;i<26;i++){const row=catalog.slice(i*16,i*16+16),kind=row[0],j=row[6];if(kind===0)result.push(snapshot.balls[j].state);else if(kind===1){const found=snapshot.pairs?.find(p=>p.ballIndices[0]===row[5]&&p.ballIndices[1]===j)??seed.pairSeeds.find(p=>p.ballIndices[0]===row[5]&&p.ballIndices[1]===j);result.push(found.pair??found.seed.pair);}else{const k=seed.cushionSeeds[j].cushions.findIndex(c=>c.colliderHandle.index===row[1]&&c.colliderHandle.generation===row[2]);assert.ok(k>=0);result.push(snapshot.cushions?.[j]?.[k]??{...seed.cushionSeeds[j].cushions[k].cache,friction:seed.cushionSeeds[j].cushions[k].friction,restitution:seed.cushionSeeds[j].cushions[k].restitution});}}return result;}
function sceneProjection(s){return{phase:s.phase,manager:s.manager,bodies:s.bodies.map(b=>pick(b,['handle','type','enabled','changes','ids','activation','maxExtent'])),modifiedBodies:s.modifiedBodies,consumedModifiedBodies:s.consumedModifiedBodies};}
function rosterProjection(s){const x=clone(s);delete x.backend;return x;}
const JOURNAL_KEYS=['edges','adjacency','lifetimes','liveColliders','sequence','revision','nextLifetime','cuePresent'];
const RULE_KEYS=['steps','firstHit','success','invalid','goalLatched','fourBallFoul','cueObstructed','ambiguous','rails'];
function scoringProjection(scoring){const t=scoring.accumulator,x={status:scoring.status};for(const k of RULE_KEYS)x[k]=k==='steps'||k==='rails'?t[k]:!!t[k];if(t.hitTime!==undefined){x.hitTime=nwords(t.hitTime);x.hitRails=t.hitRails;}if(t.rule){x.before=t.rule.before;x.after=t.rule.after;}return x;}
function bankHistory(r){const count=r[R.ringCount],head=r[R.ringHead];assert.ok(count<=8&&head<8,'bounded debounce history');return{count,head,rows:Array.from({length:count},(_,i)=>{const slot=(head-count+i+8)%8,p=R.ring+slot*4;return{pairId:r[p+3]?r[p]:null,time:[r[p+1],r[p+2]]};})};}
function sourceHistory(seed,snapshot){const profile=validateSeedEventHistory(seed);let initialCount=seed.initialContactEvents.length,n=snapshot.contactEvents.length,events=snapshot.contactEvents;assert.ok(n>=initialCount);
 if(profile){const added=n-initialCount;assert.ok(Number.isSafeInteger(snapshot.eventHistoryEmissionCount)&&snapshot.eventHistoryEmissionCount===added,'exact mirrored post-t0 accepted-event count');assert.ok(Array.isArray(snapshot.eventHistory)&&snapshot.eventHistory.length<=120,'native bounded full application history');const expected=[...profile.created,...snapshot.contactEvents.slice(initialCount)].slice(-120);assertWorldEquivalent(snapshot.eventHistory,expected,'full source event FIFO, not contact-only debounce');initialCount=profile.created.length;n=initialCount+added;events=snapshot.eventHistory;}
 const rows=events.slice(-8).map(event=>{let pairId=null;if(event.key!==undefined){const handles=String(event.key).split(':').map(value=>{const [index,generation]=nwords(Number(value));return{index,generation};});assert.equal(handles.length,2);const slots=handles.map(handle=>seed.contactGraphSeed.colliders.findIndex(c=>same(c.handle,handle)));assert.ok(slots.every(i=>i>=0),'actual historical collider generation');pairId=Math.min(...slots)*27+Math.max(...slots);}return{pairId,time:nwords(event.time)};});return{count:Math.min(n,8),head:(Math.min(initialCount,8)+n-initialCount)%8,rows};}
/** Project only represented semantics, never numeric scratch/program/control.
 * `groups` exists for initial-layout/mutation unit tests; the actual h gate uses
 * ALL groups (the default). Missing expected source state is an error. */
function projectWorldComparison({words,base=0,template,seed,expected,scoring,groups=null}){
 assert.ok(words instanceof Uint32Array&&base>=0&&base+template.state.length<=words.length);const seg=name=>{const s=template.segments[name];assert.ok(s,'Missing owner '+name);return words.subarray(base+s.offset,base+s.offset+s.words);};
 const actual={},wanted={},include=k=>groups===null||groups.includes(k),a=seg('bodies'),catalog=template.sharedGeometry.subarray(template.geometryOffsets.catalog,template.geometryOffsets.catalog+26*16);
 if(include('balls')){actual.balls=expected.balls.map((_,i)=>bankBall(a,i*64));wanted.balls=expected.balls.map(sourceBall);}
 if(include('cue')){const q=seg('cue'),source=expected.cue;actual.cue={};wanted.cue={};for(const name of ['present','active','contacted','frame','outerSubstep','contactEpisodes']){actual.cue[name]=['present','active','contacted'].includes(name)?!!q[Q.header[name]]:q[Q.header[name]];wanted.cue[name]=source[name];}for(const name of ['time','elapsed']){actual.cue[name]=Array.from(q.slice(Q.header[name],Q.header[name]+2));wanted.cue[name]=nwords(source[name]);}for(const name of ['firstContact','lastContact']){const valid=!!q[Q.header[name+'Valid']];actual.cue[name]=valid?Array.from(q.slice(Q.header[name],Q.header[name]+2)):null;wanted.cue[name]=source[name]===null?null:nwords(source[name]);}actual.cue.tangent=Array.from(q.slice(Q.header.tangent,Q.header.tangent+6));wanted.cue.tangent=source.tangent.flatMap(nwords);
  for(const [role,index]of[['shaft',0],['head',1]]){actual.cue[role]=bankCueBody(q,Q.joint+index*48);wanted.cue[role]=sourceCueBody(source.cue[role]);if(expected.frame>0&&source.present){const c=source.cue[role];actual.cue[role].canonical={linear:Array.from(a.slice((4+index)*64,(4+index)*64+3)),angular:Array.from(a.slice((4+index)*64+3,(4+index)*64+6)),translation:Array.from(a.slice((4+index)*64+6,(4+index)*64+9)),rotation:Array.from(a.slice((4+index)*64+9,(4+index)*64+13))};wanted.cue[role].canonical=Object.fromEntries(['linear','angular','translation','rotation'].map(k=>[k,fvec(c[k]??c.pose?.[k])]));}}
  // Original JointStepper.adopt: flex angular[3..5], flex linear[0], guide
  // angular[3..5], guide linear[1..2], then guide limit[0].
  const flex=source.cue.joints.find(j=>j.kind==='flex'),guide=source.cue.joints.find(j=>j.kind==='guide');actual.cue.jointImpulses=Array.from(q.slice(Q.jointImpulses,Q.jointImpulses+10));wanted.cue.jointImpulses=fvec([...flex.impulses.slice(3,6),flex.impulses[0],...guide.impulses.slice(3,6),guide.impulses[1],guide.impulses[2],guide.limitImpulses[0]]);
 }
 if(include('caches')){const cache=seg('caches'),sources=cacheSources(seed,expected,catalog);actual.caches=sources.map((_,i)=>bankCache(cache,catalog[i*16+7],catalog[i*16]));wanted.caches=sources.map((s,i)=>sourceCache(s,catalog[i*16]));actual.cueCloth=decodeCueClothCache(seg('cueCloth'));wanted.cueCloth=expected.cueCloth;}
 if(include('journal')){actual.journal=pick(decodeContactJournal(seg('journal')).state,JOURNAL_KEYS);wanted.journal=pick(expected.contactGraph??seed.contactGraphSeed,JOURNAL_KEYS);}
 if(include('roster')){actual.roster=rosterProjection(decodeContactRoster(seg('roster'),{initialSnapshotSha256:seed.initialSnapshotSha256}).snapshot);wanted.roster=rosterProjection(expected.solverContactRoster);}
 if(include('scene')){actual.scene=sceneProjection(decodeSceneActivation(seg('scene'),template.sceneTemplate));wanted.scene=sceneProjection(expected.scene);}
 if(include('bvh')){actual.bvh=unpackBvhState(seg('bvh'));wanted.bvh=expected.ownedBvh;}
 if(include('clock')){const app=seg('application'),wa=seg('worldApplication'),h=WA.header;actual.clock={frame:words[base+5],time:Array.from(app.slice(A.header.time,A.header.time+2)),outerStep:wa[h.outer],outerSubstep:wa[h.substep]===wa[h.subdivisions]?0:wa[h.substep]};wanted.clock={frame:expected.frame,time:nwords(expected.time),outerStep:expected.outerStep,outerSubstep:expected.outerSubstep};}
 if(include('rules')){assert.ok(scoring,'Independent original optimizer scoring required');const d=decodeRuleState(seg('rules')),want=scoringProjection(scoring);wanted.rules=want;actual.rules=pick(d,Object.keys(want));if('hitTime'in want)actual.rules.hitTime=nwords(d.hitTime);actual.rules.history=bankHistory(seg('rules'));wanted.rules.history=sourceHistory(seed,expected);const g=scoring.game.pending;assert.ok(g,'Independent original pending gameplay counters required');actual.game=d.game;wanted.game={redMask:(g.reds.includes(scoring.game.firstId)?1:0)|(g.reds.includes(scoring.game.secondId)?2:0),cushions:g.cushions,goalCushions:g.goalCushions,finished:scoring.game.finished};}
 return{actual,expected:wanted,coverage:WHOLE_H_COMPARISON_COVERAGE};
}
function assertWholeHCommitted({words,base=0,template,frame}){const p=n=>base+template.segments[n].offset;assert.ok([1,2,3,5].includes(words[base+2]),'Whole-h status must be running/pass/miss/incomplete, got '+words[base+2]+' reason '+words[base+3]);assert.equal(words[base+5],frame,'Committed h sequence');assert.equal(words[p('scene')+SCENE_LAYOUT.header.phase],3,'Post application scene phase');assert.equal(words[p('journal')+1],0,'Committed journal');assert.equal(words[p('broad')+1],0,'Committed broad');assert.equal(words[p('cueCloth')],0,'Cloth status');assert.equal(words[p('cueCloth')+1],0,'Cloth recurrence idle');}
function compareWorldBank(args){assertWholeHCommitted({...args,frame:args.expected.frame});const p=projectWorldComparison(args);assertWorldEquivalent(p.actual,p.expected,'source frame '+args.expected.frame+' bank '+(args.base??0));return p.coverage;}

 return Object.freeze({firstWorldMismatch,assertWorldEquivalent,projectWorldComparison,assertWholeHCommitted,compareWorldBank});
}
