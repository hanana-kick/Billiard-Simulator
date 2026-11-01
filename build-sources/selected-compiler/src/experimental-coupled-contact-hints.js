/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2020 Sébastien Crozet. Modified 2026: source pair-hint transition port.
 * Rapier b716d375efc0201003f0cd9ef7168eee0b62c177:
 * geometry/narrow_phase/pair_update.rs:94-109,145-171,756-803;
 * geometry/narrow_phase/mod.rs:194-247,250-311;
 * geometry/narrow_phase/contacts.rs:158-179;
 * geometry/narrow_phase/pair_management.rs:635-646;
 * dynamics/solver/solver_contact_graph.rs:66-100.
 * See vendor/RAPIER-LICENSE.txt. Pure integer metadata shared by CPU/GPU owners.
 * No geometry, wake inference, graph coloring, sleep-count clearing, or solve.
 * The supported domain is rigid, non-composite, non-filtered zero/one-manifold
 * sphere/convex contacts. A full refresh here means native OUTCOME_FULL before
 * the FULL_CLEAN optimization, never a filter, soft-contact or composite path.
 */
(function(G){'use strict';
const SOURCE_REVISION='b716d375efc0201003f0cd9ef7168eee0b62c177';
const U=0xffffffff,DYN=0x8000,COUNT=DYN-1,GRAPH_SHIFT=22;
const OUTCOMES=Object.freeze({skipped:0,recycled:1,full:2,'recycled-requalified':3,'full-clean':4});
const requireThat=(ok,message)=>{if(!ok)throw RangeError(message);};
function uint(value,max,name){requireThat(Number.isInteger(value)&&value>=0&&value<=max,'Exact '+name+' required');return value;}
function booleans(value,name){requireThat(Array.isArray(value)&&value.length===2&&value.every(v=>typeof v==='boolean'),'Two explicit '+name+' flags required');return value;}
function readManifolds(rows,withPosition){
 requireThat(Array.isArray(rows)&&rows.length<=1,'Source zero/one solver manifold required');
 return rows.map(m=>{requireThat(m&&typeof m==='object','Source manifold metadata required');const out={solverFlags:uint(m.solverFlags,U,'solver flags'),activeContactCount:uint(m.activeContactCount,1,'zero/one active-contact count')};
  if(withPosition){out.graphPos=uint(m.graphPos,U,'GraphPos');requireThat(out.graphPos===U||Math.floor(out.graphPos/2**GRAPH_SHIFT)<=129,'Source rigid/generic GraphPos bucket required');}return out;});
}
function readPrevious(previous){
 // null is an ACTUAL newly appended edge, not an absent metadata shortcut.
 if(previous===null)return{hint:0,solverColor:255,manifolds:[]};
 requireThat(previous&&typeof previous==='object','Previous source metadata or explicit fresh-edge null required');
 const color=uint(previous.solverColor,255,'pair solver color');requireThat(color<=128||color===255,'Source solver color required');
 return{hint:uint(previous.hint,65535,'u16 pair hint'),solverColor:color,manifolds:readManifolds(previous.manifolds,true)};
}
function qualifiedCount(manifolds){return manifolds.reduce((n,m)=>n+((m.solverFlags&1)!==0&&m.activeContactCount!==0?1:0),0);}
function bucketDrift(previous,manifolds,selectable){
 if(!manifolds.length)return false;
 const m=manifolds[0],pos=previous.manifolds[0]?.graphPos??U;
 const qualifies=selectable&&(m.solverFlags&1)!==0&&m.activeContactCount!==0;
 if(!qualifies)return pos!==U;
 if(pos===U)return true;
 const bucket=Math.floor(pos/2**GRAPH_SHIFT);
 if(bucket===129)return false; // Native generic membership is topology-epoch owned.
 return bucket!==(previous.solverColor===255?128:previous.solverColor);
}
/**
 * updateHint(previous, observation)
 * previous: current roster pair {hint,solverColor,manifolds:[{solverFlags,
 *   activeContactCount,graphPos}]} before geometry or null for a real new edge.
 * observation (all flags explicit):
 *   entryAwake: [bool,bool] from native awake_body_mask / entry active set;
 *   entryDynamicAwake: [bool,bool] from is_dynamic && !activation.sleeping;
 *   colliderNeedsNarrowPhaseUpdate: OR of both needs_narrow_phase_update();
 *   visited: whether source process_pair was visited (an asleep dense-scan visit
 *     is allowed and still returns skipped); refreshed: actual full geometry;
 *   manifolds: full geometry's [{solverFlags,activeContactCount}], required only
 *     when refreshed, optional otherwise but must equal retained metadata.
 * These are all PRE deferred-contact-transition inputs, never scene.observe's
 * newly woken bodies. Recycling safety/drift comes from the actual geometry owner.
 *
 * The result's {hint,updated,solverGraphDirty,manifolds} is directly suitable for
 * a roster pair row with edgeId added. updated permits metadata replacement;
 * solverGraphDirty is the EXACT native dirty-list predicate. They differ for
 * FULL_CLEAN and nonselectable recycled repairs. The roster alone owns graphPos,
 * colors, later sleep count-clearing, and post-loop wake qualification.
 */
function updateHint(previous,observation){
 const p=readPrevious(previous),o=observation;
 const allowed=['entryAwake','entryDynamicAwake','colliderNeedsNarrowPhaseUpdate','visited','refreshed','manifolds'];
 requireThat(o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>allowed.includes(k)),'Explicit entry-phase observation fields required');
 const awake=booleans(o.entryAwake,'entry awake-mask'),dyn=booleans(o.entryDynamicAwake,'entry dynamic-awake');
 for(const k of['colliderNeedsNarrowPhaseUpdate','visited','refreshed'])requireThat(typeof o[k]==='boolean','Explicit '+k+' flag required');
 const eligible=o.colliderNeedsNarrowPhaseUpdate||awake.some(Boolean),oldManifolds=p.manifolds.map(({solverFlags,activeContactCount})=>({solverFlags,activeContactCount}));
 requireThat(!o.refreshed||o.visited&&eligible,'Unvisited/asleep pair cannot be geometry-refreshed');
 requireThat(!eligible||o.visited,'Entry-awake or modified source pair must be visited');
 let manifolds=o.manifolds===undefined?oldManifolds:readManifolds(o.manifolds,false);
 if(!o.refreshed)requireThat(manifolds.length===oldManifolds.length&&manifolds.every((m,i)=>m.solverFlags===oldManifolds[i].solverFlags&&m.activeContactCount===oldManifolds[i].activeContactCount),'Skipped/recycled source manifolds must be retained unchanged');
 let hint=p.hint,updated=false,solverGraphDirty=false,outcome='skipped';
 if(eligible){
  if(!o.refreshed){
   requireThat(previous!==null,'A fresh source pair has no recyclable cache');outcome='recycled';
   if((hint&COUNT)===0){hint=qualifiedCount(manifolds)|(dyn.some(Boolean)?DYN:0);updated=hint!==p.hint;
    if((hint&DYN)!==0&&(hint&COUNT)!==0){outcome='recycled-requalified';solverGraphDirty=true;updated=true;}}
  }else{
   requireThat(o.manifolds!==undefined,'Full source geometry must supply its manifold metadata');
   hint=qualifiedCount(manifolds)|(dyn.some(Boolean)?DYN:0);updated=true;
   solverGraphDirty=hint!==p.hint||bucketDrift(p,manifolds,(hint&DYN)!==0&&(hint&COUNT)!==0);
   outcome=solverGraphDirty?'full':'full-clean';
  }
 }
 return{hint,hintDyn:(hint&DYN)!==0,hintCount:hint&COUNT,updated,solverGraphDirty,outcome,outcomeCode:OUTCOMES[outcome],manifolds};
}
const api=Object.freeze({SOURCE_REVISION,OUTCOMES,updateHint});G.LabCoupledContactHintsExperimental=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
