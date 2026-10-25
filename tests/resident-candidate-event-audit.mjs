// TEST ONLY. Device-side accepted-emission tape. No expected future data is
// bound, no physics state is written, and the production compact ABI is intact.
import assert from 'node:assert/strict';
import {WORLD_APPLICATION_LAYOUT as WA} from '../src/resident-candidate/world-application.mjs';
import {APPLICATION_LAYOUT as A} from '../src/resident-candidate/application.mjs';
export const EVENT_AUDIT_LAYOUT=Object.freeze({headerWords:4,rowWords:16,header:Object.freeze({count:0,overflow:1,contractError:2,reserved:3}),row:Object.freeze({keyed:0,pairId:1,timeLo:2,timeHi:3,hCommitted:4,outerCompleted:5,substepAtEntry:6,subdivisions:7,worldPhase:8,applicationMode:9,applicationPhase:10,nativeHCompleted:11,outerOrdinal:12,substepCompleted:13,order:14,reserved:15}),defaultCapacity:1024,maxCapacity:65536,binding:5,production:false});
function span(code,name){const match=new RegExp('\\bfn '+name+'\\(').exec(code);if(!match)return null;const start=match.index,open=code.indexOf('{',start);assert.ok(open>=0);let depth=1,end=open+1;for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;else if(code[end]==='}')depth--;}assert.equal(depth,0,'balanced source helper '+name);return{start,end,text:code.slice(start,end)};}
/** Preserve every source helper body verbatim. Only its declaration name is
 * changed, then a test wrapper invokes it before recording the receipt. */
export function instrumentWorldHEmissions(template,plan,{capacityPerCandidate=EVENT_AUDIT_LAYOUT.defaultCapacity}={}){
 assert.equal(plan?.kind,'resident-source-world-h-plan');assert.equal(plan.stateWords,template.state.length);assert.equal(plan.bindingTypes.length,5);assert.ok(Number.isInteger(capacityPerCandidate)&&capacityPerCandidate>0&&capacityPerCandidate<=EVENT_AUDIT_LAYOUT.maxCapacity);
 const stride=4+capacityPerCandidate*16,r=template.segments.rules.offset,w=template.segments.worldApplication.offset,a=template.segments.application.offset,words=plan.count*stride;
 const support=`@group(0) @binding(5) var<storage,read_write> rc_event_audit:array<u32>;
fn rc_audit_base(rule:u32)->u32{if(rule<${r}u){rc_event_audit[2u]=1u;return 0xffffffffu;}let bank=rule-${r}u;if(bank%${plan.stateWords}u!=0u||bank/${plan.stateWords}u>=${plan.count}u){rc_event_audit[2u]=1u;return 0xffffffffu;}return (bank/${plan.stateWords}u)*${stride}u;}
fn rc_audit_count(rule:u32)->u32{let audit=rc_audit_base(rule);if(audit==0xffffffffu){return 0xffffffffu;}return rc_event_audit[audit];}
fn rc_audit_append(rule:u32,pairId:u32,time:vec2<u32>){
 let audit=rc_audit_base(rule);if(audit==0xffffffffu){return;}let bank=rule-${r}u;let wa=bank+${w}u;let app=bank+${a}u;let phase=rc_state[wa+${WA.header.phase}u];
 if(phase!=2u&&phase!=4u){rc_event_audit[audit+2u]=2u;return;}let n=rc_event_audit[audit];if(n>=${capacityPerCandidate}u){rc_event_audit[audit+1u]=1u;return;}
 let h=rc_state[bank+5u];let outer=rc_state[wa+${WA.header.outer}u];let sub=rc_state[wa+${WA.header.substep}u];let divisions=rc_state[wa+${WA.header.subdivisions}u];let after=u32(phase==4u);
 if(h==0xffffffffu||outer==0xffffffffu||sub>=divisions||divisions==0u||divisions>64u||pairId>=729u){rc_event_audit[audit+2u]=3u;return;}
 let row=audit+4u+n*16u;rc_event_audit[row]=1u;rc_event_audit[row+1u]=pairId;rc_event_audit[row+2u]=time.x;rc_event_audit[row+3u]=time.y;rc_event_audit[row+4u]=h;rc_event_audit[row+5u]=outer;rc_event_audit[row+6u]=sub;rc_event_audit[row+7u]=divisions;rc_event_audit[row+8u]=phase;rc_event_audit[row+9u]=rc_state[app+${A.header.mode}u];rc_event_audit[row+10u]=rc_state[app+${A.header.phase}u];rc_event_audit[row+11u]=h+after;rc_event_audit[row+12u]=outer+1u;rc_event_audit[row+13u]=sub+after;rc_event_audit[row+14u]=n;rc_event_audit[row+15u]=0u;rc_event_audit[audit]=n+1u;
}
fn rc_audit_nonkey(rule:u32,prior:u32,time:vec2<u32>){let audit=rc_audit_base(rule);if(audit==0xffffffffu||rc_event_audit[audit+1u]!=0u||rc_event_audit[audit+2u]!=0u){return;}if(prior>=${capacityPerCandidate}u||rc_event_audit[audit]!=prior+1u){rc_event_audit[audit+2u]=4u;return;}let row=audit+4u+prior*16u;if(rc_event_audit[row+1u]!=0u||rc_event_audit[row+2u]!=time.x||rc_event_audit[row+3u]!=time.y){rc_event_audit[audit+2u]=5u;return;}rc_event_audit[row]=0u;}
`;
 const pipelines=plan.pipelines.map(p=>{let code=p.code;const history=span(code,'rc_rules_append_history'),nonkey=span(code,'rc_rules_append_nonkey_history');assert.ok(!nonkey||history,'nonkey emission requires original history appender');let wrappers='';
  for(const source of[history,nonkey].filter(Boolean).sort((x,y)=>y.start-x.start)){const name=/fn (\w+)/.exec(source.text)[1];code=code.slice(0,source.start)+source.text.replace('fn '+name+'(','fn rc_audit_original_'+name+'(')+code.slice(source.end);}
  if(history)wrappers+='\nfn rc_rules_append_history(b:u32,pairId:u32,time:vec2<u32>){rc_audit_original_rc_rules_append_history(b,pairId,time);rc_audit_append(b,pairId,time);}\n';
  if(nonkey)wrappers+='\nfn rc_rules_append_nonkey_history(b:u32,time:vec2<u32>){let prior=rc_audit_count(b);rc_audit_original_rc_rules_append_nonkey_history(b,time);rc_audit_nonkey(b,prior,time);}\n';
  return Object.freeze({...p,code:support+code+wrappers,functions:p.functions+4+Number(!!history)+Number(!!nonkey),audit:Object.freeze({historyWrapped:!!history,nonkeyWrapped:!!nonkey})});
 });
 return Object.freeze({...plan,pipelines:Object.freeze(pipelines),bindingTypes:Object.freeze([...plan.bindingTypes,'storage']),audit:Object.freeze({kind:'test-only-device-emission-audit',capacityPerCandidate,strideWords:stride,words,bytes:words*4,initialHistoryReemitted:false,physicsWrites:false,intermediateReadback:false})});
}
/** Final readback only. Overflow/contract errors fail this TEST, not physics. */
export function decodeWorldEmissionAudit(words,plan,{candidate=0}={}){
 assert.ok(words instanceof Uint32Array&&words.length===plan.audit.words,'complete final audit readback');assert.ok(Number.isInteger(candidate)&&candidate>=0&&candidate<plan.count);const b=candidate*plan.audit.strideWords,count=words[b];assert.equal(words[b+1],0,'test-only emission audit overflow');assert.equal(words[b+2],0,'test-only emission audit contract');assert.equal(words[b+3],0,'audit reserved word');assert.ok(count<=plan.audit.capacityPerCandidate);
 return Array.from({length:count},(_,i)=>{const p=b+4+i*16,x=Object.fromEntries(Object.entries(EVENT_AUDIT_LAYOUT.row).map(([k,v])=>[k,words[p+v]]));assert.equal(x.order,i);assert.equal(x.reserved,0);assert.ok(x.keyed<=1);if(!x.keyed)assert.equal(x.pairId,0);return x;});
}
