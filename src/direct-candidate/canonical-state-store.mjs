/** Experimental next-shot authority, NOT a mid-shot continuation checkpoint.
 * Rapier/render poses are presentation-only after this owner is adopted. */
import {validateCanonicalScene,validateCanonicalRequest,validateCanonicalCandidate,
  canonicalResultIdentity,cloneCanonicalWords,encodeCanonicalScene,createCanonicalRequest,CanonicalContractError,
  CANONICAL_MODEL} from './canonical-engine-contract.mjs';
import {prepareRawWorldBinding} from './deterministic-raw-world.mjs';
import {PREPARED_WORLD_VERSION} from './deterministic-prepared-world.mjs';
import {canonicalPositionWithin} from './deterministic-state-domain.mjs';
const Q=2**24, NONE=0xffffffff;
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'
  ?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
const fail=(code,message)=>new CanonicalContractError(code,message);
function nextScene(scene,words) {
  const p=scene.physical,s=new Int32Array(words.buffer,words.byteOffset,words.length);
  const presentation=new Map(scene.presentation.map(x=>[x.id,x]));
  const source={params:p.parameters,...p.sourceSettings,
    objects:p.bodies.map((body,i)=>({...body,pos:{x:s[88+48*i]/Q,y:s[89+48*i]/Q,z:s[90+48*i]/Q},
      v:{x:0,y:0,z:0},w:{x:0,y:0,z:0},rot:presentation.get(body.id)?.rotation??{x:0,y:0,z:0,w:1},
      label:presentation.get(body.id)?.label??'',color:presentation.get(body.id)?.color??''})),
    statics:p.statics.map(({rotation,...item},i)=>({...item,rot:rotation,color:scene.staticPresentation?.[i]?.color, label:scene.staticPresentation?.[i]?.label}))};
  const admission=encodeCanonicalScene(source,{objectIds:scene.slotToId,staticCount:p.statics.length});
  if(!admission.admitted)throw fail('STATE_SCENE_REJECTED','Exact final state cannot form an admitted complete scene');
  return admission.scene;
}
/** An admitted bootstrap scene is not proof of raw-start support/clearance.
 * begin() applies the real raw binding gate; there is no activation height snap. */
export function createCanonicalStateStore({scene,selectedWorldProfile}={}) {
  scene=validateCanonicalScene(scene);
  if(!scene.admitted||!['mmq1-ball-ball','mmq2-cushion'].includes(selectedWorldProfile))
    throw TypeError('Admitted scene and explicit supported selected-world profile required');
  let current=scene,finalState=null,provenance=null,clock=null,generation=0,disposed=false;
  const snapshots=new WeakMap();
  const open=()=>{if(disposed)throw fail('STATE_STORE_DISPOSED','State owner is disposed');};
  const invalidate=()=>{generation++;};
  const snapshot=()=>{open();const handle=Object.freeze({kind:'canonical-state-snapshot-v1',modelId:CANONICAL_MODEL.id,selectedWorldProfile});
    snapshots.set(handle,{scene:current,words:finalState?.slice()??null,provenance,clock});return handle;};
  return Object.freeze({
    capabilities:Object.freeze({experimental:true,productionEnabled:false,selectedWorldProfile,
      authoritativeNextShotState:true,midShotCheckpoint:false,mutatesLab:false,scoreAndTurnCommitImplemented:false}),
    // Monotonic owner revision also detects same-scene restore/cancel ABA.
    readRevision(){open();return generation;},
    readScene(){open();return current;},
    readClock(){open();return clock;},
    readFinalState(){open();return finalState?.slice()??null;},
    readProvenance(){open();return provenance===null?null:structuredClone(provenance);},
    snapshot,
    restore(handle){open();const saved=snapshots.get(handle);if(!saved)throw fail('STATE_SNAPSHOT_OWNER','Only this owner\'s exact snapshots may be restored');
      invalidate();current=saved.scene;finalState=saved.words?.slice()??null;provenance=saved.provenance;clock=saved.clock;},
    /** Explicit authoring, not a physics REST receipt. Q24 is the editor resolution.
     * The unchanged raw-start gate conservatively refuses unresolved clearance;
     * passing it is admission only, not a dynamic collision proof. */
    placeBall({id,position,expectedRevision}={}) {
      open();const revision=generation,source=current;
      const guard=()=>{open();if(generation!==revision||expectedRevision!==revision)throw fail('STALE_STATE_EDIT','Placement requires the current owner revision');};
      guard();
      if(!position||Object.keys(position).sort().join(',')!=='x,z')throw fail('STATE_EDIT_POSITION','Only explicit x/z placement is supported');
      const x=position.x,z=position.z;
      if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>4||Math.abs(z)>4)throw fail('STATE_EDIT_POSITION','Finite in-domain x/z required');
      const body=source.physical.bodies.find(b=>b.id===id);
      if(!body)throw fail('STATE_EDIT_ID','Unknown stable ball ID');
      if(source.physical.bodies.some(b=>Object.values(b.v).some(Boolean)||Object.values(b.w).some(Boolean)))throw fail('STATE_EDIT_MOTION','Only a resting scene may be authored');
      guard();if(x===body.pos.x&&z===body.pos.z)return false;
      const pos={x:Math.round(x*Q)/Q,y:body.pos.y,z:Math.round(z*Q)/Q};
      guard();if(pos.x===body.pos.x&&pos.z===body.pos.z)return false;
      const p=source.physical,presentation=new Map(source.presentation.map(b=>[b.id,b]));
      const snapshot={params:p.parameters,...p.sourceSettings,
        objects:p.bodies.map(b=>({...b,pos:b.id===id?pos:b.pos,rot:presentation.get(b.id)?.rotation??{x:0,y:0,z:0,w:1},label:presentation.get(b.id)?.label??'',color:presentation.get(b.id)?.color??''})),
        statics:p.statics.map(({rotation,...item},i)=>({...item,rot:rotation,color:source.staticPresentation?.[i]?.color, label:source.staticPresentation?.[i]?.label}))};
      const admission=encodeCanonicalScene(snapshot,{objectIds:source.slotToId,staticCount:p.statics.length});
      if(!admission.admitted)throw fail('STATE_EDIT_REJECTED','Complete authored scene is not admitted');
      const others=source.slotToId.filter(value=>value!==id);
      const request=createCanonicalRequest({scene:admission.scene,epoch:0,requestId:0,selectedId:id,purpose:'manual',executionProfile:'canonical-local-v1',
        budget:{maximumTicks:2**24,maximumEvents:1024,maximumWorkItems:1000000},
        rules:{game:source.slotToId.length,firstId:others[0],secondId:others[1],opponentId:others[2]??null,threeCushion:false,search:false,method:'carom',minCushions:0,allowKiss:true,kissFacts:false,conditionOnly:false}});
      // Transient admission clock is unrelated to and cannot reset owner time.
      prepareRawWorldBinding(request,{absoluteTick:0,sceneKey:0,requestKey:0});
      guard();current=admission.scene;finalState=null;provenance=null;invalidate();return true;
    },
    cancel(){open();invalidate();},
    dispose(){if(!disposed){invalidate();disposed=true;}},
    begin({request,candidate,raw}={}) {
      open();invalidate();const token=generation;
      request=validateCanonicalRequest(request);candidate=validateCanonicalCandidate(request,candidate);
      if(request.sceneId!==current.sceneId||request.purpose!=='manual'||!candidate.admitted)
        throw fail('STATE_REQUEST_MISMATCH','Only an admitted manual candidate from the current complete scene may commit');
      if(clock!==null&&raw?.absoluteTick!==clock)throw fail('STATE_CLOCK_MISMATCH','Next shot must retain the owned absolute clock');
      const binding=prepareRawWorldBinding(request,raw);
      const identity=selectedWorldProfile==='mmq2-cushion'
        ?{...canonicalResultIdentity(candidate),selectedWorldProfile}:canonicalResultIdentity(candidate);
      const guard=()=>{open();if(token!==generation)throw fail('STALE_STATE_COMMIT','Commit was consumed, cancelled, superseded or undone');};
      return Object.freeze({
        assertCurrent:guard,
        commit(receipt) {
          guard();
          if(receipt?.kind!=='canonical-session-selected-result-v1'||receipt.selectedWorldProfile!==selectedWorldProfile||
             stable(receipt.identity)!==stable(identity)||receipt.physicsResultComplete!==true||
             typeof receipt.assertCurrent!=='function'||typeof receipt.readFinalState!=='function')
            throw fail('STATE_RECEIPT_MISMATCH','Guarded complete selected-session result and exact model/profile/request/candidate identity required');
          receipt.assertCurrent();guard();
          const words=cloneCanonicalWords(receipt.readFinalState());
          receipt.assertCurrent();guard();
          if(words.length!==256||words[0]!==candidate.candidateId||words[1]!==9||words[2]!==0||
             words[3]!==request.slotToId.length||words[6]!==NONE||words[7]!==0||words[9]!==PREPARED_WORLD_VERSION||
             words[41]!==binding.sceneKey||words[42]!==binding.requestKey||words[43]!==1||words[44]!==request.cueSlot||
             words[5]<binding.absoluteTick||words[5]>binding.shotClock.deadlineTick)
            throw fail('STATE_FINAL_REJECTED','Exact raw-source REST header, whole roster and bounded clock required');
          const signed=new Int32Array(words.buffer,words.byteOffset,words.length);
          const cloth=current.physical.statics.find(x=>x.kind==='cloth');
          const top=Math.round((cloth.pos.y+cloth.half.y)*Q),radius=Math.round(CANONICAL_MODEL.radius*Q),mass=Math.round(CANONICAL_MODEL.mass*Q);
          for(let i=0;i<4;i++) {
            const a=64+48*i;
            if(i>=request.slotToId.length){if(words.slice(a,a+48).some(Boolean))throw fail('STATE_FINAL_REJECTED','Unused roster rows cannot hide objects');continue;}
            if(words[a]!==request.slotToId[i]||words[a+22]!==radius||words[a+23]!==mass||words[a+40]!==0||
               words.slice(a+27,a+33).some(Boolean)||!canonicalPositionWithin(signed.slice(a+24,a+27))||signed[a+25]!==top+radius)
              throw fail('STATE_FINAL_REJECTED','Every stable ID requires exact material, supported in-domain position and zero v/q at REST');
          }
          const derived=nextScene(current,words);
          // Reading a receipt may invoke application code. Recheck immediately
          // before atomic replacement; cancelled/ABA results cannot be applied.
          receipt.assertCurrent();guard();
          current=derived;finalState=words;clock=words[5];provenance=Object.freeze({identity:structuredClone(identity),
            selectedWorldProfile,rawSceneKey:binding.sceneKey,rawRequestKey:binding.requestKey,absoluteTick:words[5]});
          invalidate();return snapshot();
        },
      });
    },
  });
}
