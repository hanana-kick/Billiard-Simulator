// ASSERTION ONLY. Exact initial-only comparator extracted without arithmetic or
// tolerance changes from resident-candidate-world-initialization.mjs. Unlike the
// whole-h comparator this explicitly admits the genuine pre-first-step phase.
import assert from 'node:assert/strict';import{createRequire}from'node:module';
import{createHash}from'node:crypto';import{originalRegisteredFixture}from'./resident-candidate-original-fixture.mjs';
import{numberWords}from'../src/resident-candidate/source-number.mjs';import{RAW_POSE_LAYOUT}from'../src/resident-candidate/raw-strike.mjs';import{RULE_LAYOUT as RL}from'../src/resident-candidate/physical-rules.mjs';import{STATUS,REASON}from'../src/resident-candidate/abi.mjs';
const require=createRequire(import.meta.url),H=require('./cue-obstacle-fixtures.cjs'),R=H.R,bits=a=>new Uint32Array(Float32Array.from(a).buffer);for(const n of['math','physics','game-rules'])require('../src/'+n+'.js');
function nativeHandle(h){const b=new ArrayBuffer(8),v=new DataView(b);v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);}
function restore(raw){const a=raw.capture.preStrikeApplication,bind=o=>({...o,bodyHandle:nativeHandle(o.body),colliderHandle:nativeHandle(o.collider),pairColliderHandle:o.pairCollider?nativeHandle(o.pairCollider):undefined,pos:{x:0,y:0,z:0},trail:[]});const lab=globalThis.PhysicsLab.fromSnapshot(R,{...a,world:raw.preStrikeSnapshot,objects:a.registry.objects.map(bind),statics:a.registry.statics.map(bind)});lab.world.step=()=>{throw Error('Creation test must not step physics');};return lab;}
function nativeInitialHistory(events,colliders){
 const tail=events.slice(-8),words=new Uint32Array(32);
 for(const[i,event]of tail.entries()){
  let pair=0,keyed=0;if(event.key!==undefined){const handles=String(event.key).split(':').map(x=>numberWords(Number(x)));assert.equal(handles.length,2);const slots=handles.map(([index,generation])=>colliders.findIndex(c=>c.handle.index===index&&c.handle.generation===generation));assert.ok(slots.every(x=>x>=0));pair=Math.min(...slots)*27+Math.max(...slots);keyed=1;}
  words.set([pair,...numberWords(event.time),keyed],i*4);
 }
 return{count:tail.length,head:tail.length%8,words};
}
export function assertRawFiveInitializedBank(words,plan,row,wanted,index){
 const t=plan.template,base=index*t.state.length,o=t.segments,q=base+o.cue.offset,c=base+o.rawCreation.offset,r=base+o.rawPose.offset,cl=base+o.rawClearance.offset;
 const label=`candidate ${row.id}`;
 assert.equal(words[base+4],row.id,label+' original ID');
 assert.equal(words[base+2],wanted.status,label+' exact terminal initialization status; unsupported cannot be a miss');
 assert.equal(words[base+3],wanted.reason,label+' exact rejection reason');
 assert.equal(words[base+5],0,label+' no h has run');
 const history=base+o.rules.offset;assert.equal(words[history+RL.ringCount],wanted.history.count,label+' actual native full history count');assert.equal(words[history+RL.ringHead],wanted.history.head,label+' canonical t0 head');assert.deepEqual(words.slice(history+RL.ring,history+RL.ring+32),wanted.history.words,label+' exact native full history keyed/nonkey FIFO and binary64 timestamps');
 if(wanted.pose){
  assert.equal(words[r],1,label+' raw pose ready');assert.equal(words[cl],wanted.kind==='clear'?1:2,label+' complete source clearance');
  assert.equal(words[cl+10],177,label+' all original sampled queries');assert.equal(words[cl+11],59,label+' all original part/obstacle pairs');
  assert.equal(Boolean(words[cl+8]),wanted.clearance.swept,label+' continuous original sweep predicate');
  const pose={...wanted.pose,linear:Object.fromEntries(['x','y','z'].map(k=>[k,wanted.pose.direction[k]*row.settings.speed]))};
  for(const key of['direction','side','up','surface','contact','tip','rotation','linear','shaftCenter']){
   const components=key==='rotation'?H.quat(pose[key]):H.arr(pose[key]);
   for(let axis=0;axis<components.length;axis++)assert.deepEqual(words.slice(r+RAW_POSE_LAYOUT[key]+2*axis,r+RAW_POSE_LAYOUT[key]+2*axis+2),numberWords(components[axis]),label+' original binary64 '+key+' '+axis);
  }
 }else{assert.equal(words[r],STATUS.REJECTED,label+' original input rejection');assert.equal(words[r+1],wanted.reason);}
 if(!wanted.bodies){assert.equal(words[c+4],0,label+' rejected candidate has no admitted creation');return;}
 assert.equal(words[c+4],1,label+' numerical creation complete');assert.equal(words[c+5],3,label+' creation transport complete');
 for(const k of[5,6,7,13,47])assert.equal(words[q+k],0,label+' original first user changes still pending '+k);
 for(let role=0;role<3;role++){
  const expected=wanted.bodies[role],joint=q+64+role*48,pose=joint+(role<2?6:0),input=q+374+role*40;
  const same=(offset,a,field)=>assert.deepEqual(words.slice(offset,offset+a.length),bits(a),label+' '+role+' '+field);
  same(pose,expected.translation,'created translation');same(pose+3,expected.rotation,'created rotation');
  same(input,expected.translation,'pending Init translation');same(input+3,expected.rotation,'pending Init rotation');
  if(role<2){
   const canonical=base+o.bodies.offset+(4+role)*64;
   same(joint,expected.linear,'created linear');same(joint+3,expected.angular,'created angular');same(joint+13,expected.localCom,'local COM');
   same(q+248+role*3,expected.worldCom,'created world COM');same(joint+16,expected.invMass,'created inverse mass');same(joint+19,expected.ii,'created world inverse inertia');
   same(canonical,expected.linear,'canonical linear');same(canonical+3,expected.angular,'canonical angular');same(canonical+6,expected.translation,'canonical translation');same(canonical+9,expected.rotation,'canonical rotation');
   same(canonical+13,expected.invMass,'canonical inverse mass');same(canonical+56,expected.localCom,'canonical local COM');same(canonical+59,expected.worldCom,'canonical world COM');
   const m=expected.ii;same(canonical+16,[m[0],m[1],m[2],m[1],m[3],m[4],m[2],m[4],m[5]],'canonical world inverse inertia');
  }
 }
}
export async function captureRawFiveOriginalT0(rows){
 await R.init();const source=await originalRegisteredFixture();const expected=[];
 for(const row of rows){const lab=restore(source.raw);try{const selected=lab.get(source.raw.capture.preStrikeApplication.controller.selectedId),valid=row.id===219;assert.ok(valid||row.id===522);const pose=valid?lab.pose(selected,row.settings):null,clearance=valid?lab.cueClearance(selected,row.settings):null,result=lab.strike(selected.id,row.settings,{saveSnapshot:false});assert.equal(result.ok,valid);if(clearance)assert.equal(clearance.clear,true);const bodies=result.ok?['shaft','head','guide'].map(role=>{const body=role==='shaft'?lab.cue.body:lab.cue[role];return{translation:H.arr(body.translation()),rotation:H.quat(body.rotation()),linear:H.arr(body.linvel()),angular:H.arr(body.angvel()),localCom:H.arr(body.localCom()),worldCom:H.arr(body.worldCom()),invMass:H.arr(body.effectiveInvMass()),ii:Array.from(body.effectiveWorldInvInertia().elements).slice(0,6)};}):null;expected.push({kind:valid?'clear':'invalid',status:valid?STATUS.RUNNING:STATUS.REJECTED,reason:valid?REASON.NONE:REASON.SOURCE_INPUT_RANGE,pose,clearance,bodies,history:nativeInitialHistory(lab.events,source.seed.contactGraphSeed.colliders),createdSnapshotSha256:valid?createHash('sha256').update(lab.world.takeSnapshot()).digest('hex'):null});}finally{lab.dispose();}}
 return{kind:'resident-raw-five-native-t0-assertions-only-v1',rows:structuredClone(rows),preStrikeIdentity:source.seed.sourceOrigin.preStrikeSnapshotSha256,expected,nativeSteps:0,gpuRuntimeAuthority:false};
}
