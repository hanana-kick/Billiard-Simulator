/** Presentation and score projection only. No dynamics, interpolation, contact
 * synthesis, native world writes, or authoritative state reconstruction. */
import {validateCanonicalScene,CanonicalContractError} from './canonical-engine-contract.mjs';
import {canonicalApplicationRules} from './canonical-application-adapter.mjs';
const Q=2**24,own=x=>structuredClone(x);
const fail=(code,message)=>new CanonicalContractError(code,message);
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
/** A bounded/reference sample is deliberately not accepted, even if it happens
 * to contain a field called state. All coordinates remain exact Q24 JS numbers. */
export function canonicalSamplePoses(scene,sample) {
  scene=validateCanonicalScene(scene);
  if(!scene.admitted)throw fail('CONTROLLER_SCENE_REJECTED','Already admitted canonical scene required');
  if(!['exact-boundary','exact-source'].includes(sample?.status)||sample.interpolation!==false)
    return Object.freeze({presented:false,status:sample?.status??'unavailable'});
  const words=sample.state;
  if(!(words instanceof Uint32Array)||words.length!==40||Object.prototype.toString.call(words.buffer)==='[object SharedArrayBuffer]'||
    !Number.isInteger(sample.tick)||sample.tick<0||sample.tick>0x7fffffff||
    JSON.stringify(sample.slotToId)!==JSON.stringify(scene.slotToId)||
    scene.slotToId.some((id,i)=>words[10*i]!==id)||words.subarray(scene.slotToId.length*10).some(Boolean))
    throw fail('CONTROLLER_SAMPLE_REJECTED','Exact full stable-ID roster and source clock required');
  const signed=new Int32Array(words.buffer,words.byteOffset,words.length);
  const vector=i=>({x:signed[i]/Q,y:signed[i+1]/Q,z:signed[i+2]/Q});
  return {presented:true,status:sample.status,tick:sample.tick,interpolation:false,
    poses:scene.physical.bodies.map((body,i)=>({id:body.id,position:vector(10*i+1),velocity:vector(10*i+4),
      // Source q is surface spin R*omega, not quaternion orientation.
      angularVelocity:Object.fromEntries(Object.entries(vector(10*i+7)).map(([k,v])=>[k,v/(Math.round(body.radius*Q)/Q)]))}))};
}
/** Project the already-final canonical gameplay verdict onto the existing game
 * snapshot. This never fabricates contact events or calls legacy game.finish().
 * Caller must retain source/game identity and atomically install only AFTER
 * successful canonical state commit. */
export function prepareCanonicalGameProjection({scene,game,selectedId,result}) {
  scene=validateCanonicalScene(scene);canonicalApplicationRules(game,selectedId,scene.slotToId);
  if(result?.purpose!=='manual'||result.physicsResultComplete!==true||typeof result.assertCurrent!=='function'||typeof result.readOutcome!=='function'||typeof result.readSourceContext!=='function')
    throw fail('CONTROLLER_GAME_INCOMPLETE','Complete guarded manual gameplay result required');
  result.assertCurrent();const context=result.readSourceContext();
  if(result.identity?.sceneId!==scene.sceneId||context.selectedId!==selectedId||stable(context.game)!==stable(game))
    throw fail('CONTROLLER_GAME_SOURCE_MISMATCH','Same guarded scene, selected cue and complete original game snapshot required');
  const outcome=result.readOutcome(),packet=outcome.packet;
  if(outcome.scoringEligible!==true||!(packet instanceof Uint32Array)||packet.length!==4||
      packet[0]!==result.identity?.candidateId||![1,2].includes(packet[1])||packet[3]===0x80000000)
    throw fail('CONTROLLER_GAME_INCOMPLETE','Final gameplay score is unavailable');
  const delta=packet[3]|0,three=game.kind==='three';
  if(![0,1,...(three?[]:[-1])].includes(delta)||(packet[1]===1)!==(delta===1))
    throw fail('CONTROLLER_GAME_INVALID','Canonical final score/status mismatch');
  if(!game.scores||game.cueIds.some(id=>!Number.isSafeInteger(game.scores[id]))||!Number.isSafeInteger(game.scores[selectedId]+delta))
    throw fail('CONTROLLER_GAME_INVALID','Exact complete game scores required');
  const next=own(game);next.scores[selectedId]+=delta;next.activeCue=delta===1?selectedId:game.cueIds.find(id=>id!==selectedId);next.pending=null;
  next.lastResult=delta===1?(three?'득점 +1 · 차례 유지':'득점 +1 · 두 적구 접촉'):delta===-1?'파울 −1 · 상대 수구 접촉 또는 장외':'득점 없음 · 차례 교대';
  result.assertCurrent();return {snapshot:next,result:{cueId:selectedId,delta,nextCue:next.activeCue}};
}

/** Existing renderers consume this read-only PhysicsLab-shaped view. It has no
 * physics engine and deliberately offers no strike/step/snapshot/restore API.
 * pose is the application's geometric cue-pose function, not a physics query. */
export function createCanonicalRenderView({scene,pose,isBusy=()=>false}={}) {
  scene=validateCanonicalScene(scene);
  if(!scene.admitted||typeof pose!=='function'||typeof isBusy!=='function')throw TypeError('Admitted scene and geometric presentation functions required');
  const positions=new Map(),velocities=new Map(),spins=new Map(),presentation=new Map(scene.presentation.map(p=>[p.id,p]));
  const zero=()=>({x:0,y:0,z:0}),identity={x:0,y:0,z:0,w:1};
  const objects=scene.physical.bodies.map(source=>{const p=presentation.get(source.id),id=source.id;
    positions.set(id,own(source.pos));velocities.set(id,own(source.v));spins.set(id,own(source.w));
    return Object.freeze({...own(source),label:p?.label??'',color:p?.color||'#f6f3df',trail:Object.freeze([]),
      body:Object.freeze({translation:()=>own(positions.get(id)),rotation:()=>own(p?.rotation??identity),
        linvel:()=>own(velocities.get(id)),angvel:()=>own(spins.get(id)),isSleeping:()=>!isBusy()})});});
  const colors={cloth:'#17483c',cushion:'#215647',wood:'#63432b',floor:'#111827'};
  const statics=scene.physical.statics.map(s=>Object.freeze({...own(s),color:colors[s.kind],
    body:Object.freeze({translation:()=>own(s.pos),rotation:()=>own(s.rotation),linvel:zero,angvel:zero,isSleeping:()=>true})}));
  const view={objects:Object.freeze(objects),statics:Object.freeze(statics),params:Object.freeze(own(scene.physical.parameters)),
    dt:scene.physical.sourceSettings.dt,strokeSubsteps:scene.physical.sourceSettings.strokeSubsteps,
    time:0,steps:0,shots:0,revision:0,cue:null,events:Object.freeze([]),
    get:id=>objects.find(o=>o.id===id),anyMotion:isBusy,pose,
    // Cue clearance is evaluated by the canonical raw producer; this is only
    // an unqualified visual preview, never an admission/clearance proof.
    cueObstruction:()=>null,world:Object.freeze({debugRender:()=>({vertices:new Float32Array(),colors:new Float32Array()})}),
    clearTrails(){},dispose(){},presentationOnly:true,orientation:'fixed-reference-not-integrated'};
  return Object.freeze({view,
    present(sample){const projected=canonicalSamplePoses(scene,sample);if(!projected.presented)return projected;
      for(const p of projected.poses){positions.set(p.id,p.position);velocities.set(p.id,p.velocity);spins.set(p.id,p.angularVelocity);}view.time=sample.tick/2**20;view.revision++;return projected;},
  });
}
