// SPDX-License-Identifier: Apache-2.0
// Strict shared-family projection for live three-ball broad/contact admission.
import {importLiveThreeBallInitialization} from './live-three-ball-initialization.mjs';
import {exportInitialSeeds} from './live-broad-graph.mjs';
export async function importLiveThreeBallBroad(decoder,input){
 const {seed,projection}=await importLiveThreeBallInitialization(decoder,input),row={...projection.created,
  hCount:0,outerStep:0,outerSubstep:0,boundary:projection.boundary,candidateInput:true,
  nativeFrameIndex:projection.sourceOrigin.createdClock.nativeFrameIndex,apiJournalLength:14,
  application:projection.application,sourceOrigin:projection.sourceOrigin};
 row.proxies=[];for(const node of row.state.broad_phase.tree.nodes)for(const child of [node.left,node.right])if((child.data&0x3fffffff)===1)row.proxies.push({index:child.children,min:structuredClone(child.mins),max:structuredClone(child.maxs)});
 const broad=await exportInitialSeeds({[projection.boundary]:row,strikeCreationJournal:projection.strikeCreationJournal},'three');
 return {seed,projection,broad};
}
