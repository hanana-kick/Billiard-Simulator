// Opt-in same-world observation producer. This extends INITIAL storage only;
// no captured frames, expected states, scorer verdicts or host physics inputs.
import * as importedWorld from '../experimental-four-ball-world.js';
const World=importedWorld.default??globalThis.LabFourBallWorldExperimental;
import {createInverseObservationLayout,assertInverseObservationLayout,OBSERVATION_RAILS} from './inverse-observation-layout.mjs';
import {generateInverseObservationWGSL} from './inverse-observation-reducer.mjs';
import {generateConvexPointWGSL,CONVEX_POINT_LAYOUT as P,packSharedConvexHull} from './convex-point.mjs';
import {APPLICATION_LAYOUT as A} from './application.mjs';
import {WORLD_APPLICATION_LAYOUT as W} from './world-application.mjs';
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {WORLD_CCD_LAYOUT as C} from './world-ccd.mjs';
import {numberWords,generateSourceNumberWGSL} from './source-number.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
const need=(v,m)=>{if(!v)throw new RangeError('Inverse world observation: '+m);},align=n=>Math.ceil(n/64)*64;
const same=(a,b)=>a.index===b.index&&a.generation===b.generation;
const labels={'오른쪽 쿠션':'x+','왼쪽 쿠션':'x-','앞쪽 쿠션':'z+','뒤쪽 쿠션':'z-'};
const admitted=new WeakSet();
export const INVERSE_WORLD_OBSERVATION_PROFILE='source-four-ball-inverse-producer-v2';
export const INVERSE_WORLD_OBSERVATION_CAPABILITY=Object.freeze({sameWorldProducer:true,sourceQueryOnly:true,initialOnlyLayout:true,originalPhysicalViewsUnchanged:true,observerBufferDisjointRequired:true,simultaneousEmissionAudit:false,gpuNumericallyQualified:false,nativeWorldHookQualified:false,scorerJoinImplemented:false,finalGameplayQualified:false,defaultEnabled:false});
/** Requires the original registered seed's hull ownership brands, not a label
 * or caller-supplied source hash. Old layouts and bytecode remain untouched. */
export function createInverseWorldObservationPlan({seed,template,topology,eventCapacity=256}={}){
 seed=World.validate(seed);need(seed.kind==='original-live-registered-four-ball-created-world','authenticated registered source');
 need(template?.kind==='resident-created-world-layout'&&template.sourceIdentity===seed.initialSnapshotSha256,'matching original initial template');
 need(!template.inverseObservation,'fresh unextended template');
 const selected=seed.selectedIndex,balls=seed.balls,rails=seed.sceneRegistry.statics.filter(s=>s.kind==='cushion');
 need(balls.length===4&&rails.length===4&&selected===template.selectedIndex,'fixed original four-sphere/four-cushion roster');
 const layout=createInverseObservationLayout({topology,objectIds:balls.filter((_,i)=>i!==selected).map(b=>b.id),rails:rails.map(r=>labels[r.label]),eventCapacity});
 const catalog=template.sharedGeometry.subarray(template.geometryOffsets.catalog,template.geometryOffsets.hulls),rows=[];
 need(catalog.length===26*16,'original complete26-row geometry roster');
 const find=(kind,a,b,unordered=false)=>{const matches=[];for(let i=0;i<26;i++){const c=catalog.subarray(i*16,i*16+16);if(c[0]===kind&&((c[1]===a.index&&c[2]===a.generation&&c[3]===b.index&&c[4]===b.generation)||(unordered&&c[1]===b.index&&c[2]===b.generation&&c[3]===a.index&&c[4]===a.generation)))matches.push({row:i,words:Array.from(c)});}need(matches.length===1,'unique generation-bearing cache owner');return matches[0];};
 for(let i=0;i<4;i++)if(i!==selected)rows.push({...find(1,balls[selected].pairCollider,balls[i].pairCollider,true),kind:0,key:balls[i].id,ball:i});
 for(const r of rails){const source=seed.cushionSeeds[selected].cushions.find(c=>same(c.colliderHandle,r.collider.handle));need(source?.identityPose===true,'original identity-pose convex cushion');const row=find(2,r.collider.handle,balls[selected].collider),hull=template.geometryOffsets.hulls+row.words[9],packed=packSharedConvexHull(source.hull);need(packed.length===P.hullWords&&hull+packed.length<=template.sharedGeometry.length&&packed.every((v,j)=>v===template.sharedGeometry[hull+j]),'exact authenticated convex hull words');rows.push({...row,kind:1,key:OBSERVATION_RAILS.indexOf(labels[r.label]),hull});}
 for(const r of rows){need(r.words[7]+r.words[8]<=template.segments.caches.words&&r.words[15]===0,'bounded canonical cache');}
 const segments={};let words=0;const add=(name,n)=>{words=align(words);segments[name]=Object.freeze({offset:words,words:n});words+=n;};
 add('inverseControl',16);add('inverseFrame',layout.frameWords);add('inverseObservation',layout.stateWords);add('inverseProjection',24);add('inverseQuery',P.outputWords);words=align(words);
 need(Number.isSafeInteger(words)&&words<=0x3fffffff,'bounded binding0 address space');
 // Observer data owns source binding5 / physical binding7. Original state,
 // program, geometry and scratch views are NEVER extended by this profile.
 need(template.numericScratchWords>=P.scratchWords,'existing point scratch capacity');
 const bodyRows=balls.map((b,i)=>{const at=template.segments.application.offset+A.objectOffset+i*A.objectStride,original=Array.from(template.state.slice(at,at+A.objectStride));need(original[0]===b.id&&original[1]===b.body.index&&original[2]===b.body.generation&&original[3]===template.segments.bodies.offset+i*64,'original object/canonical bank mapping');need(numberWords(b.radius).every((v,j)=>v===original[A.object.radius+j]),'original Number radius, not rounded body radius');return Object.freeze({at,body:original[3],words:Object.freeze(original)});});
 const colliderChecks=[];for(const r of rows)for(const at of [1,3]){const index=r.words[at],generation=r.words[at+1];if(colliderChecks.some(x=>x.index===index&&x.generation===generation))continue;const j=template.segments.journal.offset;let slot=-1;for(let k=0;k<template.state[j+J.header.colliders];k++){const b=j+J.colliderOffset+k*J.colliderStride;if(template.state[b]===index&&template.state[b+1]===generation){need(slot===-1,'unique original journal collider');slot=k;}}need(slot>=0,'live original observer collider');colliderChecks.push(Object.freeze({index,generation,at:j+J.colliderOffset+slot*J.colliderStride}));}
 const plan=Object.freeze({kind:INVERSE_WORLD_OBSERVATION_PROFILE,sourceIdentity:template.sourceIdentity,sourceStateWords:template.state.length,sourceProgramWords:template.program.length,selected,layout,rows:Object.freeze(rows.map(r=>Object.freeze({...r,words:Object.freeze(r.words)}))),bodyRows:Object.freeze(bodyRows),colliderChecks:Object.freeze(colliderChecks),segments:Object.freeze(segments),stateWords:template.state.length,observerWords:words,scratchWords:template.numericScratchWords,sourceOffsets:Object.freeze(Object.fromEntries(Object.entries(template.segments).map(([k,v])=>[k,v.offset]))),capability:INVERSE_WORLD_OBSERVATION_CAPABILITY});
 admitted.add(plan);const extended=Object.freeze({...template,inverseObservation:plan});return Object.freeze({plan,template:extended});
}
export function assertInverseWorldObservationPlan(p){need(admitted.has(p),'same-realm authenticated initial admission');assertInverseObservationLayout(p.layout);return p;}
/** Mandatory allocation-side check for any future runtime integration. WGSL
 * cannot discover that the host bound the same GPUBuffer under two names.
 * This check grants no source/candidate or GPU-execution qualification. */
export function assertInverseObserverResources({observer,worldState,worldProgram,worldGeometry,scratch,inputs,code,vmState}={}){
 const resource=x=>ArrayBuffer.isView(x)?x.buffer:x,rows={observer,worldState,worldProgram,worldGeometry,scratch,inputs,code,vmState};
 for(const [name,value]of Object.entries(rows))need(value&&typeof resource(value)==='object','explicit allocated resource '+name);
 for(const [name,value]of Object.entries(rows))if(name!=='observer')need(resource(observer)!==resource(value),'observer buffer must be disjoint from '+name);return true;
}
/** Explicit source schedule extension. Both cuts are inside the same candidate
 * invocation; initial after accepted canonical creation, recurrent after LAST
 * pass seal and before application-post-begin. No extra binding or host frame.
 * Failure poisons this opt-in candidate as unsupported, never an ordinary miss.
 * Existing plans, loops, source caps and selected macro profiles are unchanged.
 */
export function attachInverseObservationToWorldH(input,world){
 const p=assertInverseWorldObservationPlan(input);need(world?.kind==='resident-source-world-h-plan'&&!world.inverseObservation,'unextended source world h');need(world.stateWords===p.stateWords&&world.scratchWords===p.scratchWords,'unchanged physical bank shape');need(world.bindingTypes.length===5&&!world.audit,'observation-only eighth binding: simultaneous emission audit requires separate logical-view proof');
 const library=generateInverseWorldObservationWGSL(p,{entry:'library',count:world.count});let found=0;
 const pipelines=world.pipelines.map(row=>{if(!['begin-outer','application-post-begin'].includes(row.name))return row;found++;const original=row.devicePc.body;
  const call=row.name==='begin-outer'?`if(rc_event_audit[(bank/${p.stateWords}u)*${p.observerWords}u+${p.segments.inverseControl.offset}u]==0u){if(!rc_inverse_world_observe(bank,scratch,true)){rc_state[bank+2u]=4u;rc_state[bank+3u]=6u;}}`:`if(!rc_inverse_world_observe(bank,scratch,false)){rc_state[bank+2u]=4u;rc_state[bank+3u]=6u;}`;
  const body=call+`if(rc_state[bank+2u]==1u){${original}}`;need(row.code.split(original).length===2,'unique original source cut '+row.name);const linked=linkResidentWGSL([row.code.replace(original,body),library]);
  return Object.freeze({...row,code:linked.code,functions:linked.functions,devicePc:Object.freeze({...row.devicePc,body})});
 });need(found===2,'both original cuts required');
 return Object.freeze({...world,pipelines:Object.freeze(pipelines),bindingTypes:Object.freeze([...world.bindingTypes,'storage']),inverseObservation:Object.freeze({profile:p.kind,sourceIdentity:p.sourceIdentity,stateWords:p.stateWords,observerWords:p.observerWords,initialCut:'begin-outer before original outer begin',postCut:'application-post-begin after last pass seal',physicalViewLengthsUnchanged:true,sourceObserverBinding:5,gpuObserverBinding:7,simultaneousEmissionAudit:false,gpuQualified:false})});
}
function reducerLibrary(p,entry='observe'){
 // Address adapters only. Source arithmetic/control order is unchanged. The
 // normal standalone reducer continues to use its original bindings/lengths.
 let code=generateInverseObservationWGSL(p.layout,{entry});
 code=code.replace(/@group\(0\) @binding\(\d+\) var<storage,[^>]+> \w+:array<u32>;/g,'');
 const at=code.indexOf('@compute @workgroup_size(1) fn main(');need(at>=0,'standalone reducer entry');let end=code.indexOf('{',at)+1,depth=1;for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;if(code[end]==='}')depth--;}need(depth===0,'balanced reducer entry');code=code.slice(0,at)+code.slice(end);
 code=code.replaceAll('rc_state','rc_event_audit').replaceAll('rc_inputs','rc_event_audit');
 if(entry==='observe'){const exact=`arrayLength(&rc_program)!=${p.layout.configWords}u`;need(code.includes(exact),'exact reducer config adapter');code=code.replace(exact,'false');}
 code=code.replace(/rc_program\[([^\]]+)\]/g,(_,index)=>`ro_config_word(${index})`);
 if(entry==='project')code=code.replaceAll('rc_scratch','rc_event_audit');
 code+=`\nfn ro_config_word(i:u32)->u32{switch i{${Array.from(p.layout.config,(v,i)=>`case ${i}u:{return ${v}u;}`).join('')}default:{return 0xffffffffu;}}}`;

 return code;
}
export function generateInverseWorldObservationWGSL(input,{entry='boundary',count=1,workgroupSize=1}={}){
 const p=assertInverseWorldObservationPlan(input);need(['initial','boundary','library'].includes(entry)&&Number.isInteger(count)&&count>0&&count<=4096&&[1,64].includes(workgroupSize),'explicit bounded shape/entry');
 const o=p.sourceOffsets,l=p.layout,off=n=>p.segments[n].offset,F=n=>{const w=numberWords(n);return`RcF64(${w[0]}u,${w[1]}u)`;};
 const declarations=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(2) var<storage,read> rc_geometry:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;@group(0) @binding(5) var<storage,read_write> rc_event_audit:array<u32>;`;
 const queries=['init','gjk','epa','finish'].map(stage=>generateConvexPointWGSL(stage).replaceAll('rc_project_convex_stage','rc_io_query_'+stage).replaceAll('rc_point_','rc_io_point_').replaceAll('rc_state','rc_event_audit'));
 const journalMetadata=p.colliderChecks.map(r=>`if(rc_state[bank+${r.at}u]!=${r.index}u||rc_state[bank+${r.at+1}u]!=${r.generation}u||rc_state[bank+${r.at+J.collider.live}u]!=1u){return false;}`).join('');
 const metadata=journalMetadata+p.bodyRows.map(r=>r.words.map((v,j)=>j===3?`if(rc_state[bank+${r.at+j}u]!=bank+${v}u){return false;}`:`if(rc_state[bank+${r.at+j}u]!=${v}u){return false;}`).join('\n')).join('\n')+'\n'+p.rows.map(r=>r.words.map((v,j)=>`if(rc_geometry[${r.row*16+j}u]!=${v}u){return false;}`).join('\n')).join('\n');
 const copyPosition=(dst,body)=>[0,1,2].map((k)=>`io_put(${dst}+${k*2}u,rc_f64_from_f32_bits(rc_state[bank+${body+6+k}u]));`).join('');
 const gatherObjects=p.rows.slice(0,3).map((r,i)=>{const base=24+12*i,b=p.bodyRows[r.ball];return`rc_event_audit[f+${base}u]=${r.key}u;${copyPosition(`f+${base+2}u`,b.body)}rc_event_audit[f+${base+8}u]=rc_state[bank+${b.at+10}u];rc_event_audit[f+${base+9}u]=rc_state[bank+${b.at+11}u];`;}).join('\n');
 const impactRows=p.rows.map((r,i)=>{const base=o.caches+r.words[7],present=r.kind===0?`rc_state[bank+${base+203}u]`:`rc_state[bank+${base+390}u]`,point=r.kind===0?201:317,imp=r.kind===0?167:291,status=r.kind===0?323:387;return`if(!initial){if(rc_state[bank+${base+status}u]!=0u||(rc_state[bank+${base+point}u]!=0u&&${present}==0u)||(${present}!=0u&&${present}!=${r.kind===0?'0x3f800000u':'1u'})||(rc_state[bank+${base+point}u]!=0u&&rc_state[bank+${base+point}u]!=0x3f800000u)||(rc_state[bank+${base+imp}u]&0x7f800000u)==0x7f800000u){io_fail(bank,4u);return false;}rc_event_audit[f+${25+12*i}u]=select(0u,1u,${present}!=0u&&rc_state[bank+${base+point}u]!=0u&&(rc_state[bank+${base+imp}u]&0x80000000u)==0u&&(rc_state[bank+${base+imp}u]&0x7fffffffu)!=0u);}`;}).join('\n');
 const queryRows=p.rows.slice(3).map((r,i)=>`{
 let hull=${r.hull}u;let result=ob+${off('inverseQuery')}u;
 if(rc_io_query_init(scratch,result,hull,point,1u)!=0u){io_fail(bank,5u);return false;}
 for(var iteration=0u;iteration<${P.gjkIterations}u;iteration++){if(rc_io_query_gjk(scratch,result,hull,point,1u)!=0u){io_fail(bank,5u);return false;}}
 if(rc_io_query_epa(scratch,result,hull,point,1u)!=0u||rc_io_query_finish(scratch,result,hull,point,1u)!=0u){io_fail(bank,5u);return false;}
 if(rc_event_audit[result+1u]!=0u&&rc_event_audit[result+1u]!=0x3f800000u){io_fail(bank,5u);return false;}
 let row=f+${24+12*(i+3)}u;rc_event_audit[row]=${r.key}u;rc_event_audit[row+2u]=1u;rc_event_audit[row+3u]=select(0u,1u,rc_event_audit[result+1u]!=0u);for(var axis=0u;axis<3u;axis++){io_put(row+4u+2u*axis,rc_f64_from_f32_bits(rc_event_audit[result+2u+axis]));}
 }`).join('\n');
 const body=`
 fn io_put(at:u32,v:RcF64){rc_event_audit[at]=v.x;rc_event_audit[at+1u]=v.y;}
 fn io_load(at:u32)->RcF64{return RcF64(rc_state[at],rc_state[at+1u]);}
 fn io_fail(bank:u32,reason:u32){let ob=(bank/${p.stateWords}u)*${p.observerWords}u;let c=ob+${off('inverseControl')}u;rc_event_audit[c+2u]=3u;rc_event_audit[c+3u]=reason;let out=ob+${off('inverseProjection')}u;for(var i=0u;i<24u;i++){rc_event_audit[out+i]=0u;}rc_event_audit[out]=0x52494f50u;rc_event_audit[out+1u]=2u;rc_event_audit[out+2u]=reason;}
 fn io_boundary_ok(bank:u32,initial:bool)->bool{
 if(rc_state[bank]!=0x52435753u||rc_state[bank+1u]!=1u||rc_state[bank+2u]!=1u||rc_state[bank+8u]!=${p.selected}u||rc_state[bank+${o.application}u]!=0u){return false;}
 let w=bank+${o.worldApplication}u;let j=bank+${o.journal}u;let c=bank+${o.ccd}u;
 if(rc_state[w]!=0x52435741u||rc_state[w+1u]!=1u){return false;}
 if(initial){return rc_state[bank+5u]==0u&&rc_state[w+${W.header.phase}u]==0u&&rc_state[bank+12u]==0u;}
 if(rc_state[w+${W.header.phase}u]!=3u||rc_state[bank+12u]!=5u||rc_state[bank+${o.scene+S.header.phase}u]!=6u||rc_state[bank+${o.broad}u]!=0u||rc_state[j]!=0u||rc_state[c]!=0u||rc_state[w+${W.header.passes}u]==0u||rc_state[w+${W.header.passSequence}u]!=rc_state[j+${J.header.sequence}u]||rc_state[w+${W.header.hSequence}u]!=rc_state[bank+5u]||rc_state[w+${W.header.eventsRestored}u]!=0u){return false;}
 if(rc_state[w+${W.header.cueAtEntry}u]!=0u){return rc_state[c+${C.offset}u]==15u&&rc_state[j+${J.header.phase}u]==3u&&rc_state[bank+${o.broad+1}u]==3u&&rc_state[w+${W.header.passes}u]==1u;}
 return rc_state[c+1u]==3u&&rc_state[c+${C.offset}u]==5u&&rc_state[j+${J.header.phase}u]==0u&&rc_state[bank+${o.broad+1}u]==0u;
 }
 fn io_metadata(bank:u32)->bool{if(rc_state[bank+${o.application+A.header.objects}u]!=4u||rc_state[bank+${o.application+A.header.selected}u]!=${p.selected}u){return false;}${metadata}return true;}
 fn rc_inverse_world_observe(bank:u32,scratch:u32,initial:bool)->bool{
 if(bank%${p.stateWords}u!=0u||bank/${p.stateWords}u>=${count}u||arrayLength(&rc_event_audit)!=${p.observerWords*count}u||bank>arrayLength(&rc_state)||arrayLength(&rc_state)-bank<${p.stateWords}u||scratch>arrayLength(&rc_scratch)||arrayLength(&rc_scratch)-scratch<${P.scratchWords}u||arrayLength(&rc_geometry)<${Math.max(...p.rows.slice(3).map(r=>r.hull+P.hullWords))}u){return false;}
 // Rejected/unsupported worlds never acquire an observation or append an event.
 if(rc_state[bank+2u]!=1u){return false;}
 let ob=(bank/${p.stateWords}u)*${p.observerWords}u;let c=ob+${off('inverseControl')}u;let s=ob+${off('inverseObservation')}u;let f=ob+${off('inverseFrame')}u;let a=bank+${o.application}u;
 if(rc_event_audit[c+2u]==3u){return false;}
 if(!io_boundary_ok(bank,initial)||!io_metadata(bank)||!ro_config()){io_fail(bank,1u);return false;}
 if(initial){if(rc_event_audit[c]!=0u||rc_event_audit[s]!=0u){io_fail(bank,2u);return false;}}
 else{if(rc_event_audit[c]!=0x52494f57u||rc_event_audit[c+1u]!=1u||rc_event_audit[c+2u]!=2u||rc_event_audit[s+5u]!=1u||rc_event_audit[s+4u]!=rc_state[bank+5u]||rc_state[bank+5u]==0xffffffffu){io_fail(bank,2u);return false;}}
 let now=io_load(a+${A.header.time}u);var dt=${F(0)};if(!initial){dt=rc_f64_from_f32_bits(rc_f64_to_f32_bits(io_load(a+${A.header.h}u)));if(!rc_f64_finite(dt)||!rc_f64_lt(${F(0)},dt)){io_fail(bank,3u);return false;}}
 if(!rc_f64_finite(now)){io_fail(bank,3u);return false;}
 ${p.bodyRows.map(r=>[0,1,2].map(k=>`if((rc_state[bank+${r.body+6+k}u]&0x7f800000u)==0x7f800000u){io_fail(bank,3u);return false;}`).join('')).join('\n')}
 for(var i=0u;i<${l.frameWords}u;i++){rc_event_audit[f+i]=0u;}
 rc_event_audit[f]=0x52494f46u;rc_event_audit[f+1u]=1u;rc_event_audit[f+2u]=select(1u,0u,initial);rc_event_audit[f+3u]=select(rc_state[bank+5u]+1u,0u,initial);io_put(f+4u,rc_f64_add(now,dt));io_put(f+6u,dt);
 ${copyPosition('f+8u',p.bodyRows[p.selected].body)}rc_event_audit[f+14u]=rc_state[bank+${p.bodyRows[p.selected].at+10}u];rc_event_audit[f+15u]=rc_state[bank+${p.bodyRows[p.selected].at+11}u];rc_event_audit[f+16u]=3u;rc_event_audit[f+17u]=4u;
 ${gatherObjects}
 ${impactRows}
 let point=vec3<f32>(${[0,1,2].map(k=>`bitcast<f32>(rc_state[bank+${p.bodyRows[p.selected].body+6+k}u])`).join(',')});
 ${queryRows}
 if(initial){for(var i=0u;i<${l.stateWords}u;i++){rc_event_audit[s+i]=0u;}rc_event_audit[s]=0x52494f53u;rc_event_audit[s+1u]=1u;rc_event_audit[s+2u]=1u;io_put(s+16u,now);io_put(s+18u,now);}
 rc_inverse_observe(s,f);if(rc_event_audit[s+2u]!=1u){io_fail(bank,6u);return false;}rc_inverse_observation_project(s,ob+${off('inverseProjection')}u);if(rc_event_audit[ob+${off('inverseProjection')+1}u]!=1u){io_fail(bank,7u);return false;}
 rc_event_audit[c]=0x52494f57u;rc_event_audit[c+1u]=1u;rc_event_audit[c+2u]=2u;rc_event_audit[c+3u]=0u;rc_event_audit[c+4u]=rc_event_audit[f+3u];rc_event_audit[c+5u]=rc_state[bank+5u];rc_event_audit[c+6u]=rc_state[bank+${o.journal+J.header.sequence}u];rc_event_audit[c+7u]=select(1u,0u,initial);return true;
 }
 `;
 const root=entry==='library'?'rc_inverse_world_observe':'main',main=entry==='library'?'':`@compute @workgroup_size(${workgroupSize}) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=${count}u){return;}rc_inverse_world_observe(gid.x*${p.stateWords}u,gid.x*${p.scratchWords}u,${entry==='initial'});}`;
 return linkResidentWGSL([declarations,generateSourceNumberWGSL(),reducerLibrary(p),reducerLibrary(p,'project'),...queries,body,main],{entry:root}).code;
}
