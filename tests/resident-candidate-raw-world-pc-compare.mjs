// TEST ONLY Node diagnostic sink for the shared strict raw comparator.
// Never imported by the lean GPU/browser runtime. Public API is unchanged.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {compareWorldBank,projectWorldComparison,firstWorldMismatch} from './resident-candidate-whole-h-fixture.mjs';
import {createRawWorldPcComparison} from './resident-candidate-raw-world-comparison.mjs';
export const {compareRawWorldPcResult}=createRawWorldPcComparison({assert,worldComparison:{compareWorldBank,projectWorldComparison,firstWorldMismatch},onMismatch({path,words,diagnostic}){
 writeFileSync(path,new Uint8Array(words.buffer,words.byteOffset,words.byteLength));writeFileSync(path+'.json',JSON.stringify(diagnostic,null,2));
}});
