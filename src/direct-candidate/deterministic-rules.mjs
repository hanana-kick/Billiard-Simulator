/** Integer RULE ABI v1. Conditional on an independently validated physical producer. */
export const RULE_EVENT=Object.freeze({OBJECT:1,CUSHION:2,FLOOR:3,KISS_SAMPLE:4,REST:5,BUDGET:6,UNSUPPORTED:7,AMBIGUOUS:8,CUE_OBSTRUCTION:9});
export const RULE_STATUS=Object.freeze({PENDING:0,PASS:1,FAIL:2,INCOMPLETE:3,UNSUPPORTED:4});
export const RULE_METHOD=Object.freeze({carom:0,direct:1,any:2,bank1:3,bank2:4,bank3:5});
export const RULE_STATE_WORDS=20;
// State: mask,cushions,frozenGoal,foul,seen,active,kisses,first,complete,invalid,
// routeCushions,pre,post,rest,unsupported,ambiguous,goalTick,budget,gameStatus,searchStatus.
/** Host gate required before CPU reduction or any native RULE upload. */
export function validateRuleConfig(c){
 if(!(c instanceof Uint32Array)||c.length!==12)throw TypeError('Packed RULE config must be twelve u32 words');
 if(![3,4].includes(c[0])||![c[1],c[2],c[3]].every(x=>x<32)||c[1]===c[2]||
    (c[0]===4&&(c[3]===c[1]||c[3]===c[2]))||
    ![4,5,8,9,10].every(i=>c[i]<=1)||(c[6]>5&&c[6]!==0xffffffff)||c[11]!==0)
  throw RangeError('Invalid packed RULE configuration');
 return c;
}
export function packRuleConfig(options={}){
 for(const key of ['threeCushion','search','allowKiss','kissFacts','conditionOnly'])if(Object.hasOwn(options,key)&&typeof options[key]!=='boolean')throw TypeError('RULE options require booleans');
 const {game=4,first=2,second=3,opponent=1,threeCushion=false,search=false,method='carom',minCushions=0,allowKiss=true,kissFacts=false,conditionOnly=false}=options;
 if(![threeCushion,search,allowKiss,kissFacts,conditionOnly].every(x=>typeof x==='boolean')||typeof method!=='string')throw TypeError('RULE options require booleans and a method string');
 if(![3,4].includes(game)||![first,second,opponent].every(n=>Number.isInteger(n)&&n>=0&&n<32)||first===second||!Number.isInteger(minCushions)||minCushions<0||minCushions>0xffffffff)throw RangeError('RULE configuration');
 return validateRuleConfig(Uint32Array.of(game,first,second,opponent,+threeCushion,+search,Object.hasOwn(RULE_METHOD,method)?RULE_METHOD[method]:0xffffffff,minCushions,+allowKiss,+kissFacts,+conditionOnly,0));
}
export function initialRuleState(c){const s=new Uint32Array(20);s[2]=0xffffffff;s[16]=0xffffffff;if(c[5]&&(c[6]>5||(!c[8]&&!c[9])))s[14]=2;return s;}
function status(s,c){
 if(s[14]&1){s[18]=4;s[19]=4;return;}
 s[18]=s[13]?2:0;
 if(s[13]&&!s[3]&&s[0]===3&&(!(c[0]===3||c[4])||s[2]>=3))s[18]=1;
 s[19]=0;
 if(c[5]){
  if(s[13])s[19]=s[8]&&!s[9]?1:2;
  if(c[10]&&s[9])s[19]=2;
 }
 if(s[17]&&!s[13]){s[18]=3;if(s[19]!==2)s[19]=3;}
 if(c[5]&&(s[14]&2))s[19]=4;
}
export function reduceRuleEvent(s,c,e){
 const k=e[0],id=e[1],flags=e[2],tick=e[3];
 if(s[13])return s; // REST is the terminal producer assertion.
 if(k===7)s[14]|=1;
 else if(k===6)s[17]=1;
 else if(k===5)s[13]=1;
 else if(k===8&&(!s[8]||tick<=s[16])){s[15]=1;s[9]=1;}
 else if(k===8){}
 else if(k===9)s[9]=1;
 else if(k===3){s[3]=1;if(!s[8]||c[0]===4)s[9]=1;}
 else if(k===4){
  if(id>=32||flags>3)s[14]|=1;
  else {const bit=(1<<id)>>>0;if(flags&2)s[5]=(s[5]&~bit)>>>0;
   if((flags&1)&&!(s[5]&bit)){if(s[4]&bit){s[6]++;if(!c[8]&&(!s[8]||tick<=s[16]))s[9]=1;}s[4]=(s[4]|bit)>>>0;s[5]=(s[5]|bit)>>>0;}
  }
 }else if(k===1||k===2){
  if(k===1&&id>=32)s[14]|=1;
  if(k===2){if(s[1]===0xffffffff)s[14]|=1;else s[1]++;}
  if(k===1){if(c[0]===4&&id===c[3]){s[3]=1;s[9]=1;}let bit=0;if(id===c[1])bit=1;if(id===c[2])bit=2;const old=s[0];s[0]|=bit;if(old!==3&&s[0]===3)s[2]=s[1];}
  if(c[5]&&!s[8]){
   if(k===2){s[10]++;if(s[7])s[12]++;else s[11]++;}
   else if(!s[7]){if(id!==c[1])s[9]=1;else s[7]=1;}
   else if(id===c[2]){s[8]=1;s[16]=tick;}
   else if(id!==c[1])s[9]=1;
   if(c[6]===1&&s[10]>0)s[9]=1;
   if(c[6]>=3&&c[6]<=5){const prefix=c[6]-2;if(s[11]>prefix||(s[7]&&s[11]!==prefix)||(c[6]===5&&s[12]>0))s[9]=1;}
   const required=Math.max(c[7],c[6]>=2?3:0);if(s[8]&&s[10]<required)s[9]=1;
  }
 }else s[14]|=1;
 status(s,c);return s;
}
export function runRulesCPU(config,events){
 validateRuleConfig(config);
 const s=initialRuleState(config);for(const e of events){if(e.length!==4||!Array.from(e).every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff))throw RangeError('RULE event is four u32 words');reduceRuleEvent(s,config,e);}status(s,config);return s;
}
export function gameplayDelta(config,state){if(state[18]===0||state[18]>=3)return null;if(config[0]===4&&state[3])return -1;return state[18]===1?1:0;}
/** A negative-condition proof, never a final score or a physical completion claim. */
export function gameplayFailureProof(config,state){
 validateRuleConfig(config);
 if(!(state instanceof Uint32Array)||state.length!==RULE_STATE_WORDS)throw TypeError('Packed RULE state required');
 return state[3]!==0&&(state[14]&1)===0&&(!state[17]||state[13]!==0)?1:0;
}
export const RULE_WGSL=String.raw`
struct RuleConfig { w: array<u32,12>, }
struct RuleState { w: array<u32,20>, }
// Host must validate config before dispatch; cancellation/producer errors take precedence.
fn rule_gameplay_failure_proof(s: RuleState,c: RuleConfig) -> u32 {
 return select(0u,1u,(c.w[0]==3u||c.w[0]==4u)&&s.w[3]!=0u&&(s.w[14]&1u)==0u&&(s.w[17]==0u||s.w[13]!=0u));
}
fn rule_init(c: RuleConfig) -> RuleState {
 var s: RuleState; s.w[2]=0xffffffffu;s.w[16]=0xffffffffu;
 if(c.w[5]!=0u&&(c.w[6]>5u||(c.w[8]==0u&&c.w[9]==0u))){s.w[14]=2u;}return s;
}
fn rule_status(s0: RuleState,c: RuleConfig) -> RuleState {
 var s=s0;
 if((s.w[14]&1u)!=0u){s.w[18]=4u;s.w[19]=4u;return s;}
 s.w[18]=select(0u,2u,s.w[13]!=0u);
 if(s.w[13]!=0u&&s.w[3]==0u&&s.w[0]==3u&&(!(c.w[0]==3u||c.w[4]!=0u)||s.w[2]>=3u)){s.w[18]=1u;}
 s.w[19]=0u;
 if(c.w[5]!=0u){if(s.w[13]!=0u){s.w[19]=select(2u,1u,s.w[8]!=0u&&s.w[9]==0u);}if(c.w[10]!=0u&&s.w[9]!=0u){s.w[19]=2u;}}
 if(s.w[17]!=0u&&s.w[13]==0u){s.w[18]=3u;if(s.w[19]!=2u){s.w[19]=3u;}}if(c.w[5]!=0u&&(s.w[14]&2u)!=0u){s.w[19]=4u;}return s;
}
fn rule_event(s0: RuleState,c: RuleConfig,e: vec4<u32>) -> RuleState {
 var s=s0;let k=e.x;let id=e.y;let flags=e.z;let tick=e.w;
 if(s.w[13]!=0u){return s;}
 if(k==7u){s.w[14]|=1u;}
 else if(k==6u){s.w[17]=1u;}
 else if(k==5u){s.w[13]=1u;}
 else if(k==8u){if(s.w[8]==0u||tick<=s.w[16]){s.w[15]=1u;s.w[9]=1u;}}
 else if(k==9u){s.w[9]=1u;}
 else if(k==3u){s.w[3]=1u;if(s.w[8]==0u||c.w[0]==4u){s.w[9]=1u;}}
 else if(k==4u){
  if(id>=32u||flags>3u){s.w[14]|=1u;}
  else {let bit=1u<<id;if((flags&2u)!=0u){s.w[5]&=~bit;}
   if((flags&1u)!=0u&&(s.w[5]&bit)==0u){if((s.w[4]&bit)!=0u){s.w[6]++;if(c.w[8]==0u&&(s.w[8]==0u||tick<=s.w[16])){s.w[9]=1u;}}s.w[4]|=bit;s.w[5]|=bit;}
  }
 }else if(k==1u||k==2u){
  if(k==1u&&id>=32u){s.w[14]|=1u;}
  if(k==2u){if(s.w[1]==0xffffffffu){s.w[14]|=1u;}else{s.w[1]++;}}
  if(k==1u){if(c.w[0]==4u&&id==c.w[3]){s.w[3]=1u;s.w[9]=1u;}var bit=0u;if(id==c.w[1]){bit=1u;}if(id==c.w[2]){bit=2u;}let old=s.w[0];s.w[0]|=bit;if(old!=3u&&s.w[0]==3u){s.w[2]=s.w[1];}}
  if(c.w[5]!=0u&&s.w[8]==0u){
   if(k==2u){s.w[10]++;if(s.w[7]!=0u){s.w[12]++;}else{s.w[11]++;}}
   else if(s.w[7]==0u){if(id!=c.w[1]){s.w[9]=1u;}else{s.w[7]=1u;}}
   else if(id==c.w[2]){s.w[8]=1u;s.w[16]=tick;}
   else if(id!=c.w[1]){s.w[9]=1u;}
   if(c.w[6]==1u&&s.w[10]>0u){s.w[9]=1u;}
   if(c.w[6]>=3u&&c.w[6]<=5u){let prefix=c.w[6]-2u;if(s.w[11]>prefix||(s.w[7]!=0u&&s.w[11]!=prefix)||(c.w[6]==5u&&s.w[12]>0u)){s.w[9]=1u;}}
   let required=max(c.w[7],select(0u,3u,c.w[6]>=2u));if(s.w[8]!=0u&&s.w[10]<required){s.w[9]=1u;}
  }
 }else{s.w[14]|=1u;}
 return rule_status(s,c);
}
`;
