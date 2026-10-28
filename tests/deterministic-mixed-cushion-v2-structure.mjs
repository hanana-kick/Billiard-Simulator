import test from 'node:test';
import assert from 'node:assert/strict';
import {MIXED_HULL_ENTRY_WGSL} from '../src/direct-candidate/deterministic-mixed-cushion-entry.mjs';
import {MIXED_V2_HULL_ENTRY_WGSL} from '../src/direct-candidate/deterministic-mixed-cushion-v2-gpu.mjs';

test('MMQ2 finite entry accumulates loop verdicts without changing contact qualification',()=>{
 const start='var allStates:array<HullState,4>;',end='advanced[0]=0x4d434501u;';
 const original=MIXED_HULL_ENTRY_WGSL.split(start)[1].split(end)[0];
 assert.match(original,/if\(!allStates\[i\]\.valid\)\{entry\[6\]=6u;return;\}/,'v1 remains unchanged');
 const next=MIXED_V2_HULL_ENTRY_WGSL.split(start)[1].split(end)[0];
 assert.equal(next,'var allStatesValid=true;for(var i=0u;i<n;i++){allStates[i]=hs(i,hi);allStatesValid=allStatesValid & allStates[i].valid;}if(!allStatesValid){entry[6]=6u;return;}');
 assert.ok(MIXED_V2_HULL_ENTRY_WGSL.includes('competitorsClear=competitorsClear & ((k==selected)|(ledger[at+3u]==2u)|(ledger[at+4u]>hi));}if(!competitorsClear){entry[6]=10u;return;}'));
 const baseQualifier=MIXED_HULL_ENTRY_WGSL.split('bad=false;let whole=mb(body,lo,hi);')[1].split(start)[0];
 const newQualifier=MIXED_V2_HULL_ENTRY_WGSL.split('bad=false;let whole=mb(body,lo,hi);')[1].split(start)[0];
 assert.equal(newQualifier,baseQualifier,'finite real-normal approach, uncertainty and penetration checks exact');
 assert.equal(MIXED_V2_HULL_ENTRY_WGSL.slice(MIXED_V2_HULL_ENTRY_WGSL.indexOf(end)),MIXED_HULL_ENTRY_WGSL.slice(MIXED_HULL_ENTRY_WGSL.indexOf(end)),'accepted complete state and impulse packet writes exact');
});
