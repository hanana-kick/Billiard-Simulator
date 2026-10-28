import {test} from 'node:test';
import assert from 'node:assert/strict';
import Query from '../src/experimental-cue-obstacle-contact.js';
import {generateRawCastQueryWGSL} from '../src/resident-candidate/raw-strike.mjs';
import {assertAuthenticCastLoopDomain,castLoopSource} from './resident-candidate-raw-cast-loop-host.mjs';
test('cast-only replacement is one exact authenticated source fragment, never all storageLoops',()=>{
 const source=generateRawCastQueryWGSL(Query,'contact-gjk'),prefix='// original wrapper prefix\n',suffix='\n// original wrapper suffix';
 assert.equal(castLoopSource(prefix+source+suffix),prefix+generateRawCastQueryWGSL(Query,'contact-gjk',{storageLoop:true})+suffix);
 assert.throws(()=>castLoopSource('unrelated'));assert.throws(()=>castLoopSource(source+source));
});
test('HOST proof domain rejects wrong source cap and span before any writes',()=>{
 const layout={stateWords:64,scratchWords:13632,clearance:0,metadata:32},state=new Uint32Array(64),scratch=new Uint32Array(13632);state[3]=9;state[47]=256;
 assert.equal(assertAuthenticCastLoopDomain(state,scratch,layout),true);
 for(const cap of[0,1,255,257,0xffffffff]){state[47]=cap;const before=state.slice();assert.throws(()=>assertAuthenticCastLoopDomain(state,scratch,layout),/cap required/);assert.deepEqual(state,before);}
 state[47]=256;assert.throws(()=>assertAuthenticCastLoopDomain(state.subarray(1),scratch,layout));assert.throws(()=>assertAuthenticCastLoopDomain(state,scratch.subarray(1),layout));
 // Wrapper is inert for a completed/failed clearance or selected-ball tip.
 state[0]=3;state[47]=0;assert.equal(assertAuthenticCastLoopDomain(state,scratch,layout),false);
 state[0]=0;state[1]=29;state[3]=9;assert.equal(assertAuthenticCastLoopDomain(state,scratch,layout),false);
});
