/** Opt-in canonical committed-event RULE contract. No physics or global receipt gate. */
import {packRuleConfig,validateRuleConfig,initialRuleState,reduceRuleEvent,RULE_WGSL} from './deterministic-rules.mjs';
export const CER_VERSION=0x43525201;
export const CER_STATE_WORDS=48;
export const CER_EVENT=Object.freeze({PAIR:1,CUSHION:2,OFF_TABLE:3,KISS_SAMPLE:4,CLOTH_LANDING:5,MODEL_REST:6,BUDGET:7,CANCEL:8,UNSUPPORTED:9,INCOMPLETE:10,ROUTE_AMBIGUOUS:11,CUE_OBSTRUCTION:12,KISS_COVERAGE:13});
export const CER_METHOD=Object.freeze({carom:0,direct:1,any:2,bank1:3,bank2:4,bank3:5,turn:6,grand:7,return:8,cross:9,allWalls:10});
export const CER_CAPABILITY=Object.freeze({CONTACTS:1,KISS:2,RAILS:4});
/** Binding requirements, not a geometry implementation or caller-supplied proof. */
export const CER_MOTION_FACT_INTERFACE=Object.freeze({
 version:1,kind:'canonical-complete-separation-impulse-intervals',
 separationNumerator:1,separationDenominator:20000,separationComparison:'strictly-greater',
 required:Object.freeze(['full non-cue sphere roster','contiguous intervals from tick zero','all intervening separation/positive-impulse observations','common nonwrapping canonical clock','no omitted or unresolved transitions']),
 endpointOnlySupported:false,implementedByThisModule:false,
});
export const CER_OPERATION=Object.freeze({ACTIVE:0,MODEL_REST:1,BUDGET:2,CANCEL:3,UNSUPPORTED:4,INCOMPLETE:5});
export function validateCanonicalRuleConfig(c){
 if(!(c instanceof Uint32Array)||c.length!==16)throw TypeError('Canonical RULE config is sixteen u32 words');
 const base=c.slice(0,12);if(c[6]<=10)base[6]=Math.min(c[6],2);validateRuleConfig(base);
 if((c[6]>10&&c[6]!==0xffffffff)||c[13]!==c[0]||c[12]>=c[13]||[c[1],c[2],c[3]].some(x=>x>=c[13]||x===c[12])||c[14]>7||c[15]!==CER_VERSION||c[9]!==((c[14]>>>1)&1))throw RangeError('Canonical RULE roster/capability/version');
 return c;
}
export function packCanonicalRuleConfig(options={}){
 const {cue=0,n=options.game??4,capabilities=1,method='carom',...rest}=options;
 if(!Number.isInteger(cue)||!Number.isInteger(n)||!Number.isInteger(capabilities)||cue<0||cue>=32||![3,4].includes(n)||capabilities<0||capabilities>7||typeof method!=='string')throw RangeError('Canonical RULE options');
 if(Object.hasOwn(rest,'kissFacts')&&typeof rest.kissFacts!=='boolean')throw TypeError('kissFacts must be boolean');
 const code=Object.hasOwn(CER_METHOD,method)?CER_METHOD[method]:0xffffffff;
 const base=packRuleConfig({...rest,method:code<=5?method:'any',kissFacts:!!(capabilities&2)}),c=new Uint32Array(16);c.set(base);c[6]=code;c.set([cue,n,capabilities,CER_VERSION],12);return validateCanonicalRuleConfig(c);
}
const baseConfig=c=>{const b=c.slice(0,12);if(c[6]>=6&&c[6]<=10)b[6]=2;return b;};
const pop=x=>{let n=0;while(x){n+=x&1;x>>>=1;}return n;};
export function initialCanonicalRuleState(c){validateCanonicalRuleConfig(c);const s=new Uint32Array(48);s.set(initialRuleState(baseConfig(c)));s[34]=(1<<c[13])-1;if(!(c[14]&1)){s[14]|=1;s[32]=4;s[33]=4;}if(c[5]&&c[6]>=6&&c[6]<=10&&!(c[14]&4))s[14]|=2;refresh(s,c);return s;}
function refresh(s,c){
 if(s[14]&1){s[18]=4;s[19]=4;return;}
 s[18]=s[13]?(s[3]===0&&s[0]===3&&(!(c[0]===3||c[4])||s[2]>=3)?1:2):0;
 s[19]=c[5]&&s[13]?(s[8]&&!s[9]?1:2):0;
 if(c[5]&&(s[14]&2))s[19]=4;
 if(s[32]===2||s[32]===3||s[32]===5){s[18]=3;if(s[19]!==4)s[19]=3;}
}
function unsupported(s,c){s[14]|=1;s[32]=4;s[33]=4;refresh(s,c);return s;}
function rule(s,c,k,id,flags,tick){reduceRuleEvent(s.subarray(0,20),baseConfig(c),[k,id,flags,tick]);}
function route(s,c,k,rail){
 if(!c[5]||s[8])return;
 const m=c[6];
 if(k===2){
  if(rail===0){s[30]=1;if(m>=6&&m<=10)s[14]|=2;}
  const bit=rail===0?0:1<<(rail-1);
  if(!s[7])s[20]|=bit;
  else {s[21]|=bit;if(s[12]<3){s[22]|=bit;s[27+s[12]]=rail;}if(s[12]>=2&&rail!==0&&rail===s[24]&&rail!==s[23])s[25]=1;s[24]=s[23];s[23]=rail;}
 }
}
function routeFinish(s,c){
 const m=c[6];if(!c[5]||m<6||m>10)return;
 if(m<=9&&s[11]>0)s[9]=1;
 if(m===10&&s[7]&&(s[20]!==15||s[12]>0))s[9]=1;
 if(s[8]){
  let ok=false;
  if(m===6)ok=s[11]===0&&s[12]>=3&&pop(s[22])===3;
  if(m===7)ok=s[11]===0&&s[12]>=4&&pop(s[21])>=3;
  if(m===8)ok=s[11]===0&&s[25]!==0;
  if(m===9)ok=s[11]===0&&s[12]>=3&&((s[27]===3&&s[28]===4&&s[29]===3)||(s[27]===4&&s[28]===3&&s[29]===4));
  if(m===10)ok=s[11]>=4&&s[20]===15&&s[12]===0;
  if(!ok)s[9]=1;
 }
}
/** Events must come from committed canonical physics, never pending geometry. */
export function reduceCanonicalRuleEvent(s,c,e){
 if(s[32]!==0)return s;
 const [k,a,b,d,tick,seq,flags,reserved]=e;
 if(reserved!==0||seq!==s[37]+1||tick<s[36]||seq===0)return unsupported(s,c);
 s[36]=tick;s[37]=seq;
 const body=a<c[13],cue=a===c[12],contact=k>=1&&k<=5;
 if(contact&&(!body||flags!==1))return unsupported(s,c);
 if(k>=7&&k<=12&&(a!==0||b!==0||flags!==0||((k===7||k===8||k===11||k===12)&&d!==0)))return unsupported(s,c);
 if(k===1){if(b>=c[13]||a===b||d!==0)return unsupported(s,c);if(cue||b===c[12]){const other=cue?b:a;route(s,c,1,0);rule(s,c,1,other,0,tick);routeFinish(s,c);}}
 else if(k===2){if(b>4||d!==0)return unsupported(s,c);if(cue){route(s,c,2,b);rule(s,c,2,0,0,tick);routeFinish(s,c);}}
 else if(k===3){if(b!==0||d!==0)return unsupported(s,c);if(cue)rule(s,c,3,0,0,tick);}
 else if(k===4){if(!cue||b>=c[13]||a===b||d>3||!(c[14]&2)||(s[39]!==0&&tick<=s[38]))return unsupported(s,c);rule(s,c,4,b,d,tick);}
 else if(k===5){if(b!==0||d>1)return unsupported(s,c);/* cloth landing is not floor */}
 else if(k===6){
  if(a!==s[34]||b!==s[34]||d!==1||flags!==1)return unsupported(s,c);
  if(c[5]&&!c[8]&&(s[39]===0||s[38]!==tick))s[14]|=2;
  s[35]=b;s[32]=1;rule(s,c,5,0,0,tick);
 }
 else if(k===7){s[32]=2;s[33]=3;s[17]=1;}
 else if(k===8){s[32]=3;s[33]=8;}
 else if(k===9){s[32]=4;s[33]=d===12?12:4;s[14]|=1;}
 else if(k===10){if(d<9||d>11)return unsupported(s,c);s[32]=5;s[33]=d;}
 else if(k===11)rule(s,c,8,0,0,tick);
 else if(k===12)rule(s,c,9,0,0,tick);
 else if(k===13){if(!(c[14]&2)||a!==(s[34]^(1<<c[12]))||b!==s[38]||d!==0||flags!==1)return unsupported(s,c);s[38]=tick;s[39]=1;}
 else return unsupported(s,c);
 refresh(s,c);return s;
}
export function runCanonicalRulesCPU(config,events){validateCanonicalRuleConfig(config);const s=initialCanonicalRuleState(config);for(const e of events){if(e.length!==8||!Array.from(e).every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff))throw RangeError('Canonical event is eight u32 words');reduceCanonicalRuleEvent(s,config,e);}return s;}
export function finalizeCanonicalRuleCPU(id,s,c){
 const out=Uint32Array.of(id,3,11,0x80000000);
 if(s[32]===4){out[1]=4;out[2]=s[33];return out;}
 if(s[32]!==1){if(s[32]!==0)out[2]=s[33];return out;}
 if(s[18]!==1&&s[18]!==2){out[1]=4;out[2]=6;return out;}
 out[3]=c[0]===4&&s[3]?0xffffffff:s[18]===1?1:0;
 if(s[18]===2){out[1]=2;out[2]=1;return out;}
 if(c[5]&&s[19]!==1&&s[19]!==2){out[1]=s[19]===3?3:4;out[2]=s[19]===3?3:5;return out;}
 out[1]=!c[5]||s[19]===1?1:2;out[2]=out[1]===1?0:2;return out;
}
export const CANONICAL_RULE_WGSL=RULE_WGSL+String.raw`
struct CERConfig {w:array<u32,16>,}
struct CERState {w:array<u32,48>,}
fn cer_base(c:CERConfig)->RuleConfig {var b:RuleConfig;for(var i=0u;i<12u;i++){b.w[i]=c.w[i];}if(c.w[6]>=6u&&c.w[6]<=10u){b.w[6]=2u;}return b;}
fn cer_refresh(s0:CERState,c:CERConfig)->CERState {
 var s=s0;if((s.w[14]&1u)!=0u){s.w[18]=4u;s.w[19]=4u;return s;}
 s.w[18]=0u;if(s.w[13]!=0u){s.w[18]=select(2u,1u,s.w[3]==0u&&s.w[0]==3u&&(!(c.w[0]==3u||c.w[4]!=0u)||s.w[2]>=3u));}
 s.w[19]=0u;if(c.w[5]!=0u&&s.w[13]!=0u){s.w[19]=select(2u,1u,s.w[8]!=0u&&s.w[9]==0u);}
 if(c.w[5]!=0u&&(s.w[14]&2u)!=0u){s.w[19]=4u;}
 if(s.w[32]==2u||s.w[32]==3u||s.w[32]==5u){s.w[18]=3u;if(s.w[19]!=4u){s.w[19]=3u;}}return s;
}
fn cer_init(c:CERConfig)->CERState {
 var s:CERState;let b=rule_init(cer_base(c));for(var i=0u;i<20u;i++){s.w[i]=b.w[i];}s.w[34]=(1u<<c.w[13])-1u;
 if((c.w[14]&1u)==0u){s.w[14]|=1u;s.w[32]=4u;s.w[33]=4u;}
 if(c.w[5]!=0u&&c.w[6]>=6u&&c.w[6]<=10u&&(c.w[14]&4u)==0u){s.w[14]|=2u;}return cer_refresh(s,c);
}
fn cer_unsupported(s0:CERState,c:CERConfig)->CERState {var s=s0;s.w[14]|=1u;s.w[32]=4u;s.w[33]=4u;return cer_refresh(s,c);}
fn cer_rule(s0:CERState,c:CERConfig,k:u32,id:u32,flags:u32,tick:u32)->CERState {
 var s=s0;var b:RuleState;for(var i=0u;i<20u;i++){b.w[i]=s.w[i];}b=rule_event(b,cer_base(c),vec4<u32>(k,id,flags,tick));for(var i=0u;i<20u;i++){s.w[i]=b.w[i];}return s;
}
fn cer_route(s0:CERState,c:CERConfig,k:u32,rail:u32)->CERState {
 var s=s0;if(c.w[5]==0u||s.w[8]!=0u){return s;}let m=c.w[6];
 if(k==2u){
  if(rail==0u){s.w[30]=1u;if(m>=6u&&m<=10u){s.w[14]|=2u;}}
  var bit=0u;if(rail!=0u){bit=1u<<(rail-1u);}
  if(s.w[7]==0u){s.w[20]|=bit;}else{
   s.w[21]|=bit;if(s.w[12]<3u){s.w[22]|=bit;s.w[27u+s.w[12]]=rail;}
   if(s.w[12]>=2u&&rail!=0u&&rail==s.w[24]&&rail!=s.w[23]){s.w[25]=1u;}
   s.w[24]=s.w[23];s.w[23]=rail;
  }
 }return s;
}
fn cer_route_finish(s0:CERState,c:CERConfig)->CERState {
 var s=s0;let m=c.w[6];if(c.w[5]==0u||m<6u||m>10u){return s;}
 if(m<=9u&&s.w[11]>0u){s.w[9]=1u;}
 if(m==10u&&s.w[7]!=0u&&(s.w[20]!=15u||s.w[12]>0u)){s.w[9]=1u;}
 if(s.w[8]!=0u){var ok=false;
  if(m==6u){ok=s.w[11]==0u&&s.w[12]>=3u&&countOneBits(s.w[22])==3u;}
  if(m==7u){ok=s.w[11]==0u&&s.w[12]>=4u&&countOneBits(s.w[21])>=3u;}
  if(m==8u){ok=s.w[11]==0u&&s.w[25]!=0u;}
  if(m==9u){ok=s.w[11]==0u&&s.w[12]>=3u&&((s.w[27]==3u&&s.w[28]==4u&&s.w[29]==3u)||(s.w[27]==4u&&s.w[28]==3u&&s.w[29]==4u));}
  if(m==10u){ok=s.w[11]>=4u&&s.w[20]==15u&&s.w[12]==0u;}
  if(!ok){s.w[9]=1u;}
 }return s;
}
fn cer_event(s0:CERState,c:CERConfig,e:array<u32,8>)->CERState {
 var s=s0;if(s.w[32]!=0u){return s;}
 let k=e[0];let a=e[1];let b=e[2];let d=e[3];let tick=e[4];let seq=e[5];let flags=e[6];
 if(e[7]!=0u||seq!=s.w[37]+1u||tick<s.w[36]||seq==0u){return cer_unsupported(s,c);}
 s.w[36]=tick;s.w[37]=seq;let body=a<c.w[13];let cue=a==c.w[12];let contact=k>=1u&&k<=5u;
 if(contact&&(!body||flags!=1u)){return cer_unsupported(s,c);}
 if(k>=7u&&k<=12u&&(a!=0u||b!=0u||flags!=0u||((k==7u||k==8u||k==11u||k==12u)&&d!=0u))){return cer_unsupported(s,c);}
 if(k==1u){if(b>=c.w[13]||a==b||d!=0u){return cer_unsupported(s,c);}if(cue||b==c.w[12]){let other=select(a,b,cue);s=cer_route(s,c,1u,0u);s=cer_rule(s,c,1u,other,0u,tick);s=cer_route_finish(s,c);}}
 else if(k==2u){if(b>4u||d!=0u){return cer_unsupported(s,c);}if(cue){s=cer_route(s,c,2u,b);s=cer_rule(s,c,2u,0u,0u,tick);s=cer_route_finish(s,c);}}
 else if(k==3u){if(b!=0u||d!=0u){return cer_unsupported(s,c);}if(cue){s=cer_rule(s,c,3u,0u,0u,tick);}}
 else if(k==4u){if(!cue||b>=c.w[13]||a==b||d>3u||(c.w[14]&2u)==0u||(s.w[39]!=0u&&tick<=s.w[38])){return cer_unsupported(s,c);}s=cer_rule(s,c,4u,b,d,tick);}
 else if(k==5u){if(b!=0u||d>1u){return cer_unsupported(s,c);}}
 else if(k==6u){if(a!=s.w[34]||b!=s.w[34]||d!=1u||flags!=1u){return cer_unsupported(s,c);}if(c.w[5]!=0u&&c.w[8]==0u&&(s.w[39]==0u||s.w[38]!=tick)){s.w[14]|=2u;}s.w[35]=b;s.w[32]=1u;s=cer_rule(s,c,5u,0u,0u,tick);}
 else if(k==7u){s.w[32]=2u;s.w[33]=3u;s.w[17]=1u;}
 else if(k==8u){s.w[32]=3u;s.w[33]=8u;}
 else if(k==9u){s.w[32]=4u;s.w[33]=select(4u,12u,d==12u);s.w[14]|=1u;}
 else if(k==10u){if(d<9u||d>11u){return cer_unsupported(s,c);}s.w[32]=5u;s.w[33]=d;}
 else if(k==11u){s=cer_rule(s,c,8u,0u,0u,tick);}
 else if(k==12u){s=cer_rule(s,c,9u,0u,0u,tick);}
 else if(k==13u){if((c.w[14]&2u)==0u||a!=(s.w[34]^(1u<<c.w[12]))||b!=s.w[38]||d!=0u||flags!=1u){return cer_unsupported(s,c);}s.w[38]=tick;s.w[39]=1u;}
 else{return cer_unsupported(s,c);}return cer_refresh(s,c);
}
fn cer_finalize(id:u32,s:CERState,c:CERConfig)->vec4<u32> {
 var out=vec4<u32>(id,3u,11u,0x80000000u);
 if(s.w[32]==4u){out.y=4u;out.z=s.w[33];return out;}
 if(s.w[32]!=1u){if(s.w[32]!=0u){out.z=s.w[33];}return out;}
 if(s.w[18]!=1u&&s.w[18]!=2u){out.y=4u;out.z=6u;return out;}
 out.w=select(0u,1u,s.w[18]==1u);if(c.w[0]==4u&&s.w[3]!=0u){out.w=0xffffffffu;}
 if(s.w[18]==2u){out.y=2u;out.z=1u;return out;}
 if(c.w[5]!=0u&&s.w[19]!=1u&&s.w[19]!=2u){out.y=select(4u,3u,s.w[19]==3u);out.z=select(5u,3u,s.w[19]==3u);return out;}
 out.y=select(2u,1u,c.w[5]==0u||s.w[19]==1u);out.z=select(2u,0u,out.y==1u);return out;
}
`;
