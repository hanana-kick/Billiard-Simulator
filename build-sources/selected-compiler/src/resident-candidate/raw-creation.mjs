// SPDX-License-Identifier: Apache-2.0
// This binding is numerical staging only. The scene owner must separately admit
// the authenticated common prestrike allocator/creation receipt before use.
export const RAW_CUE_BINDING_LAYOUT=Object.freeze({joint:64,initialInputs:374,initialInputStride:40,createdNumericWords:90,worldCom:248,applicationConstants:1232,
 overwrites:Object.freeze(['shaft/head/guide translation+rotation','shaft/head linear velocity','source binary64 direction','initialization-input translation+rotation','created worldCOM/effectiveInvMass/effectiveWorldInvInertia before first lateral']),
 retained:Object.freeze(['source localCOM','source principal frame','source inverse principal inertia','native handles/order/allocator','joint local frames','shape/material descriptors']),nativeAllocation:false});
export function generateRawCueBindingWGSL(){return /* wgsl */ `
// No allocator admission is performed here. Call only under source-owned
// creation receipt, after raw source validation and complete clear clearance.
fn rc_raw_bind_cue_pose(raw:u32,clearance:u32,cue:u32)->bool {
 if(rc_state[raw]!=1u||rc_state[clearance]!=1u||rc_state[cue]!=0x52434351u||rc_state[cue+1u]!=1u||rc_state[cue+2u]!=1u||rc_state[cue+4u]!=1u||rc_state[cue+5u]!=0u||rc_state[cue+6u]!=0u||rc_state[cue+7u]!=0u||rc_state[cue+13u]!=0u||rc_state[cue+47u]!=0u){return false;}
 for(var role=0u;role<3u;role++){
  let input=cue+374u+role*40u;var pose=cue+64u+role*48u+6u;if(role==2u){pose=cue+64u+96u;}
  for(var j=0u;j<3u;j++){let value=rc_state[raw+124u+j];if((value&0x7f800000u)==0x7f800000u){return false;}rc_state[input+j]=value;rc_state[pose+j]=value;if(role<2u){rc_state[cue+64u+role*48u+j]=rc_state[raw+120u+j];}}
  for(var j=0u;j<4u;j++){let value=rc_state[raw+64u+j];if((value&0x7f800000u)==0x7f800000u){return false;}rc_state[input+3u+j]=value;rc_state[pose+3u+j]=value;}
 }
 for(var i=0u;i<6u;i++){rc_state[cue+1232u+i]=rc_state[raw+2u+i];}return true;
}
// Numeric is 3x30 unchanged Init.buildPlan outputs computed from device-written
// raw poses and authenticated common LOCAL attachment mass. Only initial world
// mass is adopted now. maxExtent/CCD/collider poses remain pending user changes.
fn rc_raw_bind_created_mass(cue:u32,numeric:u32)->bool {
 if(rc_state[cue+7u]!=0u||rc_state[cue+13u]!=0u||rc_state[cue+47u]!=0u){return false;}
 for(var role=0u;role<3u;role++){for(var j=0u;j<12u;j++){if((rc_state[numeric+role*30u+j]&0x7f800000u)==0x7f800000u){return false;}}}
 for(var role=0u;role<2u;role++){let q=cue+64u+role*48u;let n=numeric+role*30u;
  for(var j=0u;j<3u;j++){rc_state[cue+248u+role*3u+j]=rc_state[n+j];rc_state[q+16u+j]=rc_state[n+3u+j];}
  for(var j=0u;j<6u;j++){rc_state[q+19u+j]=rc_state[n+6u+j];}
 }
 return true;
}
`;}
/** TEST ONLY numerical binding oracle. Does not allocate or admit a world. */
export function bindRawCueForTest({raw,clearance,cue,numeric,testOnly=false}){
 if(testOnly!==true)throw new TypeError('Raw cue host binding is test-only');if(!(raw instanceof Uint32Array)||raw.length<128||raw[0]!==1||clearance!==1||!(cue instanceof Uint32Array)||cue.length<1258)throw new TypeError('Ready raw staging and clear source clearance required');
 const out=cue.slice();if(out[0]!==0x52434351||out[1]!==1||out[2]!==1||out[4]!==1||[5,6,7,13,47].some(i=>out[i]!==0))throw new RangeError('Fresh source cue state required');
 for(let role=0;role<3;role++){const input=374+role*40,pose=role<2?64+role*48+6:64+96;out.set(raw.subarray(124,127),input);out.set(raw.subarray(64,68),input+3);out.set(raw.subarray(124,127),pose);out.set(raw.subarray(64,68),pose+3);if(role<2)out.set(raw.subarray(120,123),64+role*48);}
 out.set(raw.subarray(2,8),1232);
 if(numeric){if(!(numeric instanceof Float32Array)||numeric.length!==90||numeric.some(x=>!Number.isFinite(x)))throw new TypeError('Three source initialization outputs required');const words=new Uint32Array(numeric.buffer,numeric.byteOffset,numeric.length);for(let role=0;role<2;role++){const q=64+role*48,n=role*30;out.set(words.subarray(n,n+3),248+role*3);out.set(words.subarray(n+3,n+6),q+16);out.set(words.subarray(n+6,n+12),q+19);}}
 return out;
}
