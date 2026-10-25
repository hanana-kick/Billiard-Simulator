'use strict';
// Light source traversal/provenance tests, no physics, decoder or GPU.
const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../../src/experimental-cue-bvh-insertion');
const node=(lo,hi,children,data)=>({mins:[lo,0,0],maxs:[hi,1,1],children,data});
const tree=()=>({nodes:[{left:node(0,2,1,2),right:node(4,5,2,1)},{left:node(0,1,0,1),right:node(1,2,1,1)}],parents:[0,0],leaf_node_indices:{n:3,v:[2,3,1]},free_wide_nodes:[],optimization:{rebuild_frame_index:0,rebuild_start_index:0}});
const leaves=()=>[{leaf:0,box:{min:[0,0,0],max:[1,1,1]}},{leaf:1,box:{min:[1,0,0],max:[2,1,1]}},{leaf:2,box:{min:[1.5,0,0],max:[2.5,1,1]}}];
test('source changed-leaf BVTT discovers a unique new overlap without mutating initial tree or numeric leaves',()=>{const t=tree(),p=leaves(),before=structuredClone({t,p}),out=B.changedLeafCandidates(t,p,[2]);assert.deepEqual(out.candidates,[[2,1]]);assert.equal(out.diagnostics.fullBvhStateParity,false);assert.deepEqual({t,p},before);});
test('traversal respects source changed flags, subtree order and complete leaf identity',()=>{assert.deepEqual(B.changedLeafCandidates(tree(),leaves(),[0]).candidates,[[0,1]]);assert.deepEqual(B.changedLeafCandidates(tree(),leaves(),[1,2]).candidates,[[0,1],[2,1]]);for(const mutate of[(t,p,u)=>u.splice(0),(t,p,u)=>u.push(2),(t,p)=>p.pop(),(t,p)=>p[2].leaf=9,(t,p)=>p[2].box.max[0]=Infinity,(t,p)=>p[2].box.min[0]=9]){const t=tree(),p=leaves(),u=[2];mutate(t,p,u);assert.throws(()=>B.changedLeafCandidates(t,p,u));}});
