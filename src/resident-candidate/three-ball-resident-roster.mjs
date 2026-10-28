// SPDX-License-Identifier: Apache-2.0
// Source-owned HOST layout constraints only. NOT a world template, a physical
// seed, a scene slot allocator, a source CALL plan or an execution admission.
import {assertThreeBallHostAdmission} from './three-ball-host-admission.mjs';
const owned=new WeakSet(),copy=structuredClone,key=h=>h.index+':'+h.generation;
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const need=(ok,message)=>{if(!ok)throw Object.assign(new RangeError('Three-ball resident roster: '+message),{code:'three-ball-resident-roster-contract'});};

/** Future canonical body64 order is declared explicitly: THREE source-ordered
 * balls, shaft, head. The fixed guide never gets a dynamic-body slot. These
 * zero-based slot numbers are not actual arena handles or resident addresses.
 * No fourth ball slot is reserved; larger generic storage capacities may be
 * used later only with these separate, source-owned live counts. */
export function describeThreeBallResidentRoster(admission){
 assertThreeBallHostAdmission(admission);const {native:n,selection:s,counts:c}=admission;
 need(c.balls===3&&c.dynamicBodies===5&&c.createdBodies===22&&c.createdColliders===25&&c.unusedBallSlots===0,'exact source live counts');
 const dynamic=n.bindings.map((b,i)=>{need(b.objectIndex===i,'source object order');return{role:'ball',objectId:b.id,canonicalIndex:i,body:copy(b.body),nativeBodyRow:b.nativeBodyRow,colliders:[copy(b.primaryCollider),copy(b.pairCollider)]};});
 for(const role of ['shaft','head']){const b=n.cue[role];dynamic.push({role,objectId:null,canonicalIndex:dynamic.length,body:copy(b.body),nativeBodyRow:b.nativeBodyRow,colliders:copy(b.colliders)});}
 need(new Set(dynamic.map(b=>key(b.body))).size===5&&dynamic.every(b=>key(n.bodyOrder[b.nativeBodyRow])===key(b.body)),'exact unique source dynamic identities');
 need(dynamic.every(b=>key(b.body)!==key(n.cue.guide.body))&&n.cue.guide.colliders.length===0,'fixed guide excluded from dynamic slots');
 const colliderSlots=new Map(n.colliderOrder.map((h,i)=>[key(h),i])),moving=[];
 for(const b of dynamic)for(const [attachmentIndex,h]of b.colliders.entries()){
  const sourceColliderSlot=colliderSlots.get(key(h));need(sourceColliderSlot!==undefined,'exact source collider generation');
  moving.push({collider:copy(h),sourceColliderSlot,canonicalBodyIndex:b.canonicalIndex,attachmentIndex});
 }
 need(moving.length===9&&new Set(moving.map(b=>key(b.collider))).size===9,'six ball and three cue colliders; no fake attachment');
 const others=dynamic.slice(0,3).filter(b=>b.canonicalIndex!==s.selectedIndex);
 need(s.selectedIndex>=0&&s.selectedIndex<3&&dynamic[s.selectedIndex].objectId===s.selectedId&&others.length===2&&others.every(b=>s.targetIds.includes(b.objectId)),'selected source index and two actual other balls');
 const result=freeze({kind:'resident-genuine-three-ball-roster-description-v1',version:1,sourceIdentity:admission.source.createdSnapshotSha256,
  counts:{balls:3,dynamicBodies:5,fixedBodies:17,createdBodies:22,createdColliders:25,retainedColliders:22,ballColliders:6,cueColliders:3,otherBalls:2},
  selectedIndex:s.selectedIndex,selectedId:s.selectedId,otherBallIndices:others.map(b=>b.canonicalIndex),dynamicBindings:dynamic,
  fixedGuide:{body:copy(n.cue.guide.body),nativeBodyRow:n.cue.guide.nativeBodyRow,canonicalIndex:null},
  sourceBodyOrder:copy(n.bodyOrder),sourceColliderOrder:copy(n.colliderOrder),movingColliderBindings:moving,
  // Pair combinations are a cardinality check, never a native solver order.
  unorderedBallPairCount:3,
  capability:{hostOnly:true,addressesAllocated:false,sceneSlotsAllocated:false,numericStatePacked:false,sourcePlanGenerated:false,residentExecution:false,rawCandidates:false,searchEvaluator:false}});
 owned.add(result);return result;
}
export function assertThreeBallResidentRoster(value){need(owned.has(value),'locally verified immutable roster description required');return value;}
