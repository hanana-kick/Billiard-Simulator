import test from 'node:test';
import assert from 'node:assert/strict';
import Query from '../src/experimental-cue-obstacle-contact.js';
import {generateRawCastQueryWGSL,generateRawContactQueryWGSL} from '../src/resident-candidate/raw-strike.mjs';
import {generateEmptyConvexQueryWGSL,EMPTY_CUE_CACHE_LAYOUT} from '../src/resident-candidate/cue-empty-caches.mjs';
const UNSUPPORTED=0x40400000;
// TEST ONLY execution of emitted integer loop/phase controls. Numerical source
// steps are replaced by deterministic counters, never by substitute geometry.
function controls(code,name,stepName){
 const at=code.lastIndexOf('fn '+name+'(');assert.ok(at>=0);const source=code.slice(at)
  .replace(/fn (\w+)\(([^)]*)\)/g,(_,fn,args)=>`function ${fn}(${args.replace(/:u32/g,'')})`)
  .replace(/\bvar\b/g,'let').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/arrayLength\(&(rc_\w+)\)/g,'$1.length');
 const names=Array.from(new Set([...source.matchAll(/\b(rc_(?:cast|contact|empty_query)_\w+)\s*=/g)].map(x=>x[1])));
 return new Function('rc_state','rc_scratch',stepName,`let ${names.join(',')};${source};return ${name};`);
}
for(const[kind,stage,cap]of[['cast','cast',100],['cast','contact-gjk',256],['contact','gjk',256]]){
 test(`opt-in ${kind}/${stage} rejects a non-source ${cap}-step bound even after early completion`,()=>{
  const source=kind==='cast'?generateRawCastQueryWGSL(Query,stage,{storageLoop:true}):generateRawContactQueryWGSL(Query,stage,{storageLoop:true});
  const name=kind==='cast'?'rc_raw_cast_stage':'rc_raw_contact_stage',step=kind==='contact'?'rc_contact_contact_gjk':stage==='cast'?'rc_cast_cast_step':'rc_cast_cast_contact_step',factory=controls(source,name,step);
  for(const bound of[0,1,cap-1,cap,cap+1])for(const terminalAt of[0,3,Infinity]){
   const state=new Uint32Array(80),scratch=new Uint32Array(32),meta=48;state[meta+15]=bound;if(stage==='contact-gjk')state[meta+3]=1;
   if(terminalAt===0){if(stage==='cast')state[meta]=0x40000000;else scratch[0]=0x3f800000;}
   let calls=0;const run=factory(state,scratch,()=>{calls++;if(calls===terminalAt){if(stage==='cast')state[meta]=0x40000000;else scratch[0]=0x3f800000;}});
   run(0,0,32,0,meta,0);
   if(bound!==cap)assert.equal(state[meta],UNSUPPORTED,`${bound}/${terminalAt}: truncated or excessive bound cannot be a miss`);
   else{assert.notEqual(state[meta],UNSUPPORTED);assert.equal(calls,Math.min(cap,terminalAt));}
   assert.ok(calls<=cap,'never exceeds unchanged original source iteration cap');
  }
 });
}
test('baseline raw cast/contact wrappers still call exactly one source iteration per dispatch',()=>{
 for(const stage of['cast','contact-gjk']){const code=generateRawCastQueryWGSL(Query,stage),body=code.slice(code.lastIndexOf('fn rc_raw_cast_stage'));assert.doesNotMatch(body,/let bound|i<bound|bound!=/);}
 const code=generateRawContactQueryWGSL(Query,'gjk'),body=code.slice(code.lastIndexOf('fn rc_raw_contact_stage'));assert.doesNotMatch(body,/let bound|i<bound|bound!=/);
});
test('opt-in original empty-convex loop owns a disjoint source-cap control word and rejects truncation',()=>{
 const code=generateEmptyConvexQueryWGSL('gjk',{storageLoop:true}),factory=controls(code,'rc_empty_convex_query_stage','rc_empty_query_gjk_step');
 assert.equal(EMPTY_CUE_CACHE_LAYOUT.queryLoopScratchWords,117);
 for(const bound of[0,1,255,256,257])for(const terminalAt of[0,3,Infinity]){
  const state=new Uint32Array(64),scratch=new Uint32Array(117);state[2]=2;state[11]=1;scratch[116]=bound;if(terminalAt===0)scratch[0]=0x40800000;
  let calls=0;const run=factory(state,scratch,()=>{calls++;if(calls===terminalAt)scratch[0]=0x40800000;});run(0,0,0,48);
  if(bound!==256)assert.equal(state[2],4,'non-source bound stays unsupported');else{assert.equal(state[2],2);assert.equal(scratch[116],0);assert.equal(calls,Math.min(256,terminalAt));}
 }
 const state=new Uint32Array(64);state[2]=2;state[11]=1;factory(state,new Uint32Array(116),()=>assert.fail('undersized control must not execute'))(0,0,0,48);assert.equal(state[2],4);
});
test('raw contact and empty-normal chunks consume exactly256 unchanged source calls without loop back-edges',()=>{
 for(const chunk of[2,4,8])for(const kind of['contact','normal']){
  const code=kind==='contact'?generateRawContactQueryWGSL(Query,'gjk',{queryChunk:chunk}):generateEmptyConvexQueryWGSL('gjk',{queryChunk:chunk}),name=kind==='contact'?'rc_raw_contact_stage':'rc_empty_convex_query_stage',step=kind==='contact'?'rc_contact_contact_gjk':'rc_empty_query_gjk_step',wrapper=code.slice(code.lastIndexOf('fn '+name)),factory=controls(code,name,step);
  assert.doesNotMatch(wrapper,/\bfor\b|\bwhile\b|\bloop\b/);assert.equal([...wrapper.matchAll(new RegExp(step+'\\(\\)','g'))].length,chunk);
  const state=new Uint32Array(80),scratch=new Uint32Array(118),meta=48;let calls=0;
  if(kind==='contact')state[meta+15]=256;else{state[2]=2;state[11]=1;scratch[116]=256;}
  const run=factory(state,scratch,()=>calls++),args=kind==='contact'?[0,0,32,0,meta,0]:[0,0,0,48];
  for(let i=0;i<256/chunk;i++)run(...args);assert.equal(calls,256);run(...args);assert.equal(calls,256,'completed transport is idempotent');
  if(kind==='contact'){assert.equal(state[meta+14],256);state[meta+14]=1;run(...args);assert.equal(state[meta],UNSUPPORTED);}
  else{assert.equal(scratch[117],256);scratch[117]=1;run(...args);assert.equal(state[2],4);}
  assert.equal(calls,256,'malformed cursor may not execute source work');
 }
});

test('chunk transports reject truncated EPA/normal completion rather than accepting a shortened query',()=>{
 for(const chunk of[2,4,8])for(const kind of['contact','normal']){
  const contact=kind==='contact',code=contact?generateRawContactQueryWGSL(Query,'epa',{queryChunk:chunk}):generateEmptyConvexQueryWGSL('finish',{queryChunk:chunk}),name=contact?'rc_raw_contact_stage':'rc_empty_convex_query_stage',step=contact?'rc_contact_contact_epa':'rc_empty_query_finish',factory=controls(code,name,step);
  for(const cap of[0,255,256,257])for(const cursor of[0,256-chunk,256,257]){
   const state=new Uint32Array(80),scratch=new Uint32Array(118),meta=48;let calls=0;
   if(contact){state[meta+15]=cap;state[meta+14]=cursor;}else{state[2]=2;state[11]=1;scratch[116]=cap;scratch[117]=cursor;}
   factory(state,scratch,()=>calls++)(...(contact?[0,0,32,0,meta,0]:[0,0,0,48]));
   const valid=cap===256&&cursor===256;assert.equal(calls,+valid);
   if(valid){assert.equal(contact?state[meta+14]:scratch[117],0);assert.equal(contact?state[meta+15]:scratch[116],0);}
   else assert.equal(contact?state[meta]:state[2],contact?UNSUPPORTED:4,'transport truncation is unsupported, never source miss');
  }
 }
});
