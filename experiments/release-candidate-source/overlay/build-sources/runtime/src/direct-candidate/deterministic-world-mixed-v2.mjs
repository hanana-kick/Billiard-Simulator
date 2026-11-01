/** Explicit MMQ2 world route. Original rolling sources, no fitted SMT2 law. */
import {prepareMixedMotionV2CPU} from './deterministic-mixed-motion-v2.mjs';
import {runMixedPairEntryV2CPU} from './deterministic-mixed-pair-v2.mjs';
import {runMixedClearPrefixV2CPU} from './deterministic-mixed-clear-v2.mjs';
import {runCushionResolverV2CPU} from './deterministic-cushion-resolver-v2.mjs';
import {commitWorldRollingStopV2CPU} from './deterministic-world-rolling-stop-v2.mjs';
const NONE=0xffffffff,V=0x4d4d5102;
export function mixedMotionRevision(options={}){const value=options.mixedMotionRevision??'mmq1';if(value!=='mmq1'&&value!=='mmq2')throw RangeError('Explicit mmq1 or mmq2 motion revision');return value;}
function pendingSource(s){return s[1]===7&&[6,7].includes(s[2])&&s[6]===NONE&&s[40]===0&&Array.from({length:s[3]},(_,i)=>s[64+i*48+40]).every(m=>m===0||m===1||m===3);}
export function commitWorldMixedClearV2CPU(current,rows,prefix,context){
 const state=current.state.slice(),dense=current.dense.slice(),s=new Int32Array(state.buffer),a=new Int32Array(prefix.advanced.buffer),r=new Int32Array(rows.buffer),h=prefix.clearTicks;
 const fail=()=>({state,dense,cleared:false});
 if(state.length!==256||dense.length!==256||context.length!==160||state[3]<3||state[3]>4||rows.length!==state[3]*80||prefix.advanced.length!==160||prefix.query.length!==1056||state[8]!==state[5]||context[13]!==1||prefix.advanced[0]!==0x4d435001||prefix.advanced[3]!==state[3]||![1,6].includes(prefix.query[1])||prefix.query[11]!==h||(prefix.query[1]===6&&h===state[4])||!pendingSource(state)||!h||h>state[4]||prefix.query[0]!==V||prefix.query[2]!==state[4]||prefix.advanced[1]!==1||prefix.advanced[2]!==h||state[5]>0x7fffffff-h||state[5]+h>context[24]||state[56]>=0x7fffffff)return fail();
 for(let i=0;i<state[3];i++){const b=i*80,z=16+i*32,w=64+i*48;if(rows[b]!==V||rows[b+4]!==state[w+22]||rows[b+17]!==state[w+23]||rows[b+5]!==1||rows[b+7]!==i||rows[b+48]!==context[4]||rows[b+49]!==context[8]||rows[b+50]!==context[7]||rows[b+6]!==state[5]||rows[b+2]!==state[4]||rows[b+3]!==state[w]||prefix.advanced[z]!==state[w]||rows[b+1]!==state[w+40]||Array.from(r.slice(b+8,b+17)).some((x,j)=>x!==s[w+24+j]))return fail();if(rows[b+1]===3&&(context[5]>16*2**24||context[6]>4*2**24||rows[b+24]!==context[6]||rows[b+25]||rows[b+26]||rows[b+27]||rows[b+28]||[context[16],context[17],Math.min(context[18],context[19]),Math.min(context[20],context[21]),context[22]].some((x,k)=>x!==rows[b+29+k])||2*context[6]>7*context[5]))return fail();}
 const originalH=state[4],d=new Int32Array(dense.buffer);dense.fill(0);state[4]=h;state[5]+=h;state[8]=state[5];state[1]=12;state[2]=0;state[7]=0;state[56]++;state[60]=h<originalH?64:0;
 for(let i=0;i<state[3];i++){const b=64+i*48,z=16+i*32,k=i*64; s.set(a.slice(z+1,z+10),b+24);s.fill(0,b+9,b+15);state[b+39]=1;let mode=rows[i*80+1];if(mode===3)mode=a[z+4]||a[z+6]?3:0;else{mode=a[z+4]||a[z+6]||a[z+7]||a[z+9]?1:0;if(mode===1&&a[z+7]===a[z+6]&&a[z+9]===-a[z+4]&&2*context[6]<=7*context[5])mode=3;}state[b+40]=mode;state[7]|=mode<<(2*i);d[k]=mode;d[k+1]=s[b+22];for(let j=0;j<3;j++){d[k+4+j]=d[k+16+j]=a[z+1+j];d[k+20+j]=d[k+48+j]=a[z+4+j];d[k+24+j]=a[z+7+j];}d[k+28]=a[z+16];d[k+30]=a[z+17];d[k+32]=a[z+18];d[k+34]=a[z+19];d[k+36]=a[z+20];d[k+37]=a[z+22];d[k+38]=a[z+21];d[k+40]=a[z+23];d[k+41]=1;}
 return{state,dense,cleared:true};
}
export function resolveSupportedPrefixV2CPU(prepared,smooth,scene,hulls,context,material,rebuild,{maxNodes=256,cushionSettings=null,journal=null,captureSourceDescriptors=false}={}){
 if(!pendingSource(prepared.state))return;
 const descriptors=prepareMixedMotionV2CPU(prepared,prepared.rows,smooth,context),pair=runMixedPairEntryV2CPU(descriptors,scene,{horizonTicks:prepared.state[4],maxNodes},material);
 if(captureSourceDescriptors)prepared.sourceDescriptors=descriptors;
 prepared.mixedQuery=pair.query;
 if(pair.entry[1]===1&&pair.response[1]===1&&pair.state[1]===8){const next=rebuild(prepared,pair,context);prepared.state=next.state;prepared.dense=next.dense;if(next.state[1]===1){next.state[1]=12;next.state[52]++;prepared.pair=pair;prepared.kind='mixed-pair-v2';}return;}
 if(pair.query[1]===5){prepared.state[1]=5;prepared.state[2]=85;return;}
 let ledger=pair.query;
 if(cushionSettings){const result=runCushionResolverV2CPU(prepared,descriptors,scene,hulls,context,cushionSettings.rails,cushionSettings.material,cushionSettings);prepared.cushionAttempt=result;ledger=result.cushion?.query??ledger;if(result.committed||result.cleared){if(result.committed)journal?.capture(result.impact.state);Object.assign(prepared,result,{kind:result.committed?'finite-cushion-v2':'finite-cushion-clear-v2',cushionImpactState:result.impact?.state});if(prepared.state[1]===1)prepared.state[1]=12;return;}}
 const stop=commitWorldRollingStopV2CPU(prepared,descriptors,ledger,scene,context);prepared.stopAttempt=stop;if(stop.committed){Object.assign(prepared,stop);prepared.state[1]=12;return;}
 const prefix=runMixedClearPrefixV2CPU(descriptors,scene,{horizonTicks:prepared.state[4],maxNodes}),clear=commitWorldMixedClearV2CPU(prepared,descriptors,prefix,context);if(clear.cleared)Object.assign(prepared,clear,{kind:'mixed-clear-prefix-v2',clearPrefix:prefix});
}
