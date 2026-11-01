/* SPDX-License-Identifier: Apache-2.0
 * Opt-in diagnostic observation around the exact source-owner dispatcher.
 * Only the existing event-audit binding receives snapshots. Original physics
 * state, array lengths, equations, guards, caps and request ordering are intact.
 * This is source for microcode lowering, never a giant native shader.
 */
import {composeWorldMicrocodeSource} from './world-microcode-source.mjs';
import {APPLICATION_LAYOUT as A} from './application.mjs';
import {WORLD_APPLICATION_LAYOUT as W} from './world-application.mjs';
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {RULE_LAYOUT as R} from './physical-rules.mjs';
const U=0xffffffff,need=(ok,message)=>{if(!ok)throw new RangeError('Strike checkpoints: '+message);};
const uint=(x,name)=>{need(Number.isSafeInteger(x)&&x>=0&&x<=U,name+' bounded u32');return x;};
const positive=(x,name)=>{uint(x,name);need(x>0,name+' positive');return x;};
export const STRIKE_MICROCODE_CHECKPOINTS=Object.freeze({
 magic:0x52435343,version:1,headerWords:16,
 headers:Object.freeze({magic:0,version:1,status:2,error:3,candidateId:4,h:5,outer:6,subdivisions:7,bankWords:8,sourceWords:9,timeLo:10,timeHi:11,worldStatus:12,worldReason:13,index:14,reserved:15}),
 status:Object.freeze({empty:0,complete:1,invalid:2}),errors:Object.freeze({none:0,missedBoundary:1,storageShape:2,sourceBoundary:3}),
 points:Object.freeze([{name:'before-tip',h:320,outer:5},{name:'after-tip',h:384,outer:6}].map(Object.freeze)),
 sourceAuditBinding:5,gpuAuditBinding:7,requestedH:384,sourceOuterHorizon:15360,
 capability:Object.freeze({optIn:true,diagnosticOnly:true,defaultBackend:false,physicsWrites:false,hostFutureInput:false,nativeQualified:false,fullRestQualified:false,hardwarePerformance:false})
});
const K=STRIKE_MICROCODE_CHECKPOINTS;
function functionSpan(code,name){const match=new RegExp('\\bfn\\s+'+name+'\\s*\\(').exec(code);need(match,'source function '+name);const open=code.indexOf('{',match.index);let end=open+1,depth=1;for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;else if(code[end]==='}')depth--;}need(depth===0,'balanced function '+name);return{start:match.index,open,end,text:code.slice(match.index,end)};}
const normalize=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s+/g,'');
/** EXACT observational helper contract from tests/resident-candidate-event-audit.
 * This deliberately verifies static prefix bounds rather than arrayLength:
 * appending snapshots must not increase the audit's accepted event capacity. */
function auditContract({count,stateWords,segments},capacity){
 const stride=4+capacity*16,r=segments.rules.offset,w=segments.worldApplication.offset,a=segments.application.offset;
 return `
fn rc_audit_base(rule:u32)->u32{if(rule<${r}u){rc_event_audit[2u]=1u;return 0xffffffffu;}let bank=rule-${r}u;if(bank%${stateWords}u!=0u||bank/${stateWords}u>=${count}u){rc_event_audit[2u]=1u;return 0xffffffffu;}return (bank/${stateWords}u)*${stride}u;}
fn rc_audit_count(rule:u32)->u32{let audit=rc_audit_base(rule);if(audit==0xffffffffu){return 0xffffffffu;}return rc_event_audit[audit];}
fn rc_audit_append(rule:u32,pairId:u32,time:vec2<u32>){
 let audit=rc_audit_base(rule);if(audit==0xffffffffu){return;}let bank=rule-${r}u;let wa=bank+${w}u;let app=bank+${a}u;let phase=rc_state[wa+${W.header.phase}u];
 if(phase!=2u&&phase!=4u){rc_event_audit[audit+2u]=2u;return;}let n=rc_event_audit[audit];if(n>=${capacity}u){rc_event_audit[audit+1u]=1u;return;}
 let h=rc_state[bank+5u];let outer=rc_state[wa+${W.header.outer}u];let sub=rc_state[wa+${W.header.substep}u];let divisions=rc_state[wa+${W.header.subdivisions}u];let after=u32(phase==4u);
 if(h==0xffffffffu||outer==0xffffffffu||sub>=divisions||divisions==0u||divisions>64u||pairId>=729u){rc_event_audit[audit+2u]=3u;return;}
 let row=audit+4u+n*16u;rc_event_audit[row]=1u;rc_event_audit[row+1u]=pairId;rc_event_audit[row+2u]=time.x;rc_event_audit[row+3u]=time.y;rc_event_audit[row+4u]=h;rc_event_audit[row+5u]=outer;rc_event_audit[row+6u]=sub;rc_event_audit[row+7u]=divisions;rc_event_audit[row+8u]=phase;rc_event_audit[row+9u]=rc_state[app+${A.header.mode}u];rc_event_audit[row+10u]=rc_state[app+${A.header.phase}u];rc_event_audit[row+11u]=h+after;rc_event_audit[row+12u]=outer+1u;rc_event_audit[row+13u]=sub+after;rc_event_audit[row+14u]=n;rc_event_audit[row+15u]=0u;rc_event_audit[audit]=n+1u;
}
fn rc_audit_nonkey(rule:u32,prior:u32,time:vec2<u32>){let audit=rc_audit_base(rule);if(audit==0xffffffffu||rc_event_audit[audit+1u]!=0u||rc_event_audit[audit+2u]!=0u){return;}if(prior>=${capacity}u||rc_event_audit[audit]!=prior+1u){rc_event_audit[audit+2u]=4u;return;}let row=audit+4u+prior*16u;if(rc_event_audit[row+1u]!=0u||rc_event_audit[row+2u]!=time.x||rc_event_audit[row+3u]!=time.y){rc_event_audit[audit+2u]=5u;return;}rc_event_audit[row]=0u;}
`;
}
export function planStrikeMicrocodeCheckpoints({count,stateWords,sourceStateWords,segments,auditCapacityPerCandidate=64,limits}={}){
 positive(count,'count');need(count<=4096,'source candidate capacity');positive(stateWords,'stateWords');positive(sourceStateWords,'sourceStateWords');need(sourceStateWords>=count*stateWords,'unchanged complete source binding');positive(auditCapacityPerCandidate,'audit capacity');need(auditCapacityPerCandidate<=65536,'existing audit cap');
 for(const name of ['rules','worldApplication','application','scene','journal','broad','cueCloth']){const s=segments?.[name];need(s&&Number.isSafeInteger(s.offset)&&Number.isSafeInteger(s.words)&&s.offset>=0&&s.words>0&&s.offset+s.words<=stateWords,'bounded original '+name+' span');}
 const auditStride=uint(4+auditCapacityPerCandidate*16,'audit stride'),auditWords=uint(count*auditStride,'audit prefix'),snapshotStride=uint(K.headerWords+stateWords,'snapshot stride'),candidateSnapshotWords=uint(K.points.length*snapshotStride,'candidate snapshots'),totalWords=uint(auditWords+count*candidateSnapshotWords,'diagnostic allocation');
 need(limits&&Number.isSafeInteger(limits.maxStorageBufferBindingSize)&&limits.maxStorageBufferBindingSize>0&&Number.isSafeInteger(limits.maxBufferSize)&&limits.maxBufferSize>0,'explicit actual/planned limits');const bytes=totalWords*4,bindingLimit=Math.min(limits.maxStorageBufferBindingSize,limits.maxBufferSize);need(bytes<=bindingLimit,'audit and full snapshots exceed one diagnostic binding; do not truncate or fake capture');
 return Object.freeze({kind:'resident-strike-checkpoint-layout-v1',count,stateWords,sourceStateWords,segments:Object.freeze(Object.fromEntries(Object.entries(segments).map(([k,v])=>[k,Object.freeze({...v})]))),auditCapacityPerCandidate,auditStride,auditWords,snapshotBase:auditWords,snapshotStride,candidateSnapshotWords,totalWords,bytes,bindingLimit,sourceAuditBinding:5,gpuAuditBinding:7,points:K.points,initialization:'fresh GPU-zeroed storage only',sourceStateLengthUnchanged:true,measured:false});
}
function observerSource(l){const w=l.segments.worldApplication.offset,a=l.segments.application.offset,s=l.segments.scene.offset,j=l.segments.journal.offset,b=l.segments.broad.offset,c=l.segments.cueCloth.offset;return `
fn rc_strike_checkpoint_invalid(out:u32,error:u32){rc_event_audit[out]=${K.magic}u;rc_event_audit[out+1u]=1u;rc_event_audit[out+3u]=error;rc_event_audit[out+2u]=2u;}
fn rc_strike_checkpoint_capture(candidate:u32,index:u32,target:u32,outer:u32){
 let out=${l.snapshotBase}u+candidate*${l.candidateSnapshotWords}u+index*${l.snapshotStride}u;
 if(arrayLength(&rc_event_audit)!=${l.totalWords}u){return;}
 if(rc_event_audit[out+2u]!=0u){return;}
 if(arrayLength(&rc_state)!=${l.sourceStateWords}u){rc_strike_checkpoint_invalid(out,2u);return;}
 let bank=candidate*${l.stateWords}u;let h=rc_state[bank+5u];if(h<target){return;}if(h>target){rc_strike_checkpoint_invalid(out,1u);return;}
 let wa=bank+${w}u;if(rc_state[wa+${W.header.phase}u]!=${W.phases.idle}u){return;}
 if(rc_state[bank]!=0x52435753u||rc_state[bank+1u]!=1u||rc_state[bank+2u]!=1u||rc_state[wa+${W.header.outer}u]!=outer||rc_state[wa+${W.header.subdivisions}u]!=64u||rc_state[wa+${W.header.substep}u]!=64u||rc_state[wa+${W.header.terminalPublished}u]!=0u||rc_state[bank+${s+S.header.phase}u]!=3u||rc_state[bank+${j+1}u]!=0u||rc_state[bank+${b+1}u]!=0u||rc_state[bank+${c}u]!=0u||rc_state[bank+${c+1}u]!=0u){rc_strike_checkpoint_invalid(out,3u);return;}
 // World is paused in this source call during VM budget yields. Completion is
 // published ONLY after every unchanged candidate word has been copied.
 for(var word=0u;word<${l.stateWords}u;word++){rc_event_audit[out+${K.headerWords}u+word]=rc_state[bank+word];}
 rc_event_audit[out]=${K.magic}u;rc_event_audit[out+1u]=1u;rc_event_audit[out+3u]=0u;rc_event_audit[out+4u]=rc_state[bank+4u];rc_event_audit[out+5u]=h;rc_event_audit[out+6u]=outer;rc_event_audit[out+7u]=64u;rc_event_audit[out+8u]=${l.stateWords}u;rc_event_audit[out+9u]=${l.sourceStateWords}u;rc_event_audit[out+10u]=rc_state[bank+${a+A.header.time}u];rc_event_audit[out+11u]=rc_state[bank+${a+A.header.time+1}u];rc_event_audit[out+12u]=rc_state[bank+2u];rc_event_audit[out+13u]=rc_state[bank+3u];rc_event_audit[out+14u]=index;rc_event_audit[out+15u]=0u;rc_event_audit[out+2u]=1u;
}
fn rc_strike_checkpoints_observe(gid:vec3<u32>){if(gid.x>=${l.count}u){return;}rc_strike_checkpoint_capture(gid.x,0u,320u,5u);rc_strike_checkpoint_capture(gid.x,1u,384u,6u);}
`;}
/** Require the ORIGINAL audit instrumenter upstream of PC/owner compilation.
 * Source cap validation remains exactly64 rows (or explicit supplied cap), even
 * though a separate snapshot tail shares its physical allocation. */
export function composeStrikeMicrocodeCheckpoints(pc,template,{auditCapacityPerCandidate=64,limits,sourceStateWords=pc?.totalStateWords,source=composeWorldMicrocodeSource(pc)}={}){
 need(pc?.maxH===384,'existing original PC must request384h; do not relabel an h2 artifact');need(pc.begin?.code?.includes('rc_state[cb+6u]=384u;'),'actual original begin must request384h, not metadata alone');need(pc.bindingTypes?.length===6&&pc.bindingTypes[5]==='storage','original audited source binding5 required');need(source?.kind==='resident-world-microcode-source-v1'&&source.entry==='rc_micro_world_run','exact original dynamic source dispatcher');need(template?.state?.length===pc.stateWords||template?.stateWords===pc.stateWords,'matching source candidate layout');
 need(source.sourceBytecode instanceof Uint32Array&&source.sourceBytecode.length===pc.bytecode.length&&source.sourceBytecode.every((w,i)=>w===pc.bytecode[i])&&source.entries?.length===pc.pipelines.length&&source.entries.every((e,i)=>e.sourceCode===pc.pipelines[i].code),'dispatcher retains these exact source owner bodies and PC');
 const l=planStrikeMicrocodeCheckpoints({count:pc.count,stateWords:pc.stateWords,sourceStateWords,segments:template.segments,auditCapacityPerCandidate,limits}),contract=auditContract(l,auditCapacityPerCandidate);
 need(/@group\(0\)\s*@binding\(5\)\s*var<storage,read_write>\s*rc_event_audit:array<u32>;/.test(source.code),'exact audit storage declaration');
 for(const name of ['rc_audit_base','rc_audit_count','rc_audit_append','rc_audit_nonkey'])need(normalize(functionSpan(source.code,name).text)===normalize(functionSpan(contract,name).text),'unchanged static-prefix audit helper '+name);
 const f=functionSpan(source.code,source.entry),marker='switch originalPipeline{',switchAt=f.text.indexOf(marker);need(switchAt>=0&&f.text.indexOf(marker,switchAt+1)<0,'one original owner switch');const open=f.text.indexOf('{',switchAt);let end=open+1,depth=1;for(;depth&&end<f.text.length;end++){if(f.text[end]==='{')depth++;else if(f.text[end]==='}')depth--;}need(depth===0&&normalize(f.text.slice(end))==='}}','owner switch must immediately precede original loop/function endings');
 const hook='\n  rc_strike_checkpoints_observe(gid);\n',insertion=f.start+end,code=source.code.slice(0,insertion)+hook+source.code.slice(insertion)+'\n'+observerSource(l);
 return Object.freeze({...source,kind:'resident-strike-checkpoint-microcode-source-v1',code,functions:source.functions+3,checkpointLayout:l,originalSource:source,hook:Object.freeze({offset:insertion,text:hook,boundary:'after original owner returns; fully completed latched outer only'}),capability:K.capability});
}
/** Initial-only handoff for a caller-owned compact VM. This does not compile
 * or run physics, bind future banks, choose candidates, or change the query
 * horizon. Expected snapshots and actual measurements stay outside this API. */
export function buildStrikeMicrocodeCheckpointRuntime({initialization,input,program,sharedGeometry,pc,template,rule,identity,limits,auditCapacityPerCandidate=64}={}){
 need(rule?.maxOuterSteps===K.sourceOuterHorizon,'original16-second query horizon must remain15360 outers');need(initialization?.count===pc?.count&&initialization.hostReadbacksBeforeH===0,'matching initial-only raw initializer');need(input instanceof Uint32Array&&input.length===pc.count*16&&program instanceof Uint32Array&&sharedGeometry instanceof Uint32Array,'owned raw rows and immutable source words');need(typeof initialization.resources?.worldState==='number'&&initialization.resources.worldState===pc.controlTailBase,'fresh unchanged world allocation before PC tails');need(program.length===pc.programBase+pc.bytecode.length&&program.slice(pc.programBase).every((w,i)=>w===pc.bytecode[i]),'unchanged source PC words');need(identity&&typeof identity.preStrikeIdentity==='string'&&typeof identity.sourceIdentity==='string','explicit original source identities');
 need(initialization.resources.worldTemplate instanceof Uint32Array&&initialization.resources.worldTemplate[template.segments.rules.offset+R.maxSteps]===K.sourceOuterHorizon,'actual original rule words keep the16-second horizon');
 const inspect=(v,path)=>{if(v===null||typeof v!=='object'){need(typeof v!=='function',path+' plain data');return;}if(v instanceof Uint32Array)return;need(Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype,path+' plain data');for(const[k,x]of Object.entries(v)){need(!/expected|snapshot|scoring|results|future|oracle/i.test(k),path+' cannot contain assertion-only data');inspect(x,path+'.'+k);}};inspect(initialization,'initialization');inspect(identity,'identity');
 const composed=composeStrikeMicrocodeCheckpoints(pc,template,{limits,auditCapacityPerCandidate});
 return Object.freeze({kind:'resident-strike-checkpoint-initial-only-runtime-v1',count:pc.count,requestedH:384,originalRule:Object.freeze({...rule}),identity:Object.freeze({...identity}),initialization,input,program,sharedGeometry,pc,source:composed,diagnostics:Object.freeze({words:composed.checkpointLayout.totalWords,initialization:'GPU-zeroed',sourceBinding:5,gpuBinding:7,sourceStateWords:pc.totalStateWords,sourceStateLengthUnchanged:true}),readback:Object.freeze({when:'after all bounded VM work; never between h/checkpoints',mappings:1,includes:Object.freeze(['final world','VM control','entire audit and checkpoint storage']),requiredSnapshots:2}),capability:K.capability});
}
/** POST-execution diagnostic decode. Missing/partial/overflow/invalid captures
 * fail the test and never alter or fabricate the physical PASS/MISS status. */
export function decodeStrikeMicrocodeCheckpoints(words,layout,{candidate=0}={}){
 need(layout?.kind==='resident-strike-checkpoint-layout-v1','declared diagnostic layout');need(words instanceof Uint32Array&&words.length===layout.totalWords,'complete final diagnostic allocation');uint(candidate,'candidate');need(candidate<layout.count,'bounded candidate');
 const audit=candidate*layout.auditStride,n=words[audit];need(n<=layout.auditCapacityPerCandidate&&words[audit+1]===0&&words[audit+2]===0&&words[audit+3]===0,'audit overflow/contract/reserved failure');
 const snapshots=layout.points.map((point,index)=>{const at=layout.snapshotBase+candidate*layout.candidateSnapshotWords+index*layout.snapshotStride,header=words.slice(at,at+K.headerWords);need(header[0]===K.magic&&header[1]===1&&header[2]===1&&header[3]===0,'missing/incomplete/invalid checkpoint '+point.name);need(header[5]===point.h&&header[6]===point.outer&&header[7]===64&&header[8]===layout.stateWords&&header[9]===layout.sourceStateWords&&header[12]===1&&header[13]===0&&header[14]===index&&header[15]===0,'exact checkpoint source boundary '+point.name);const bank=words.slice(at+K.headerWords,at+layout.snapshotStride);need(bank[4]===header[4]&&bank[5]===header[5],'snapshot/header source identity');return Object.freeze({name:point.name,header,words:bank});});
 return Object.freeze({snapshots:Object.freeze(snapshots),auditPrefix:words.slice(0,layout.auditWords),auditRows:n,sourceStateWritten:false,physicsParity:'not established by decoding; native snapshot and event comparators required'});
}
