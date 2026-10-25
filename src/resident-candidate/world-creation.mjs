import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
/* SPDX-License-Identifier: Apache-2.0
 * Raw-pose → original created-cue numeric aliases. This precedes the first
 * lateral impulse. The scene initializer still owns the later first-user-change
 * mass/extent/registration receipt; we do NOT consume its mask prematurely.
 */
import {generateRawCueBindingWGSL} from './raw-creation.mjs';

import {generateCueCanonicalBridgeWGSL} from './cue-bridge.mjs';
export const WORLD_CREATION_LAYOUT=Object.freeze({words:16,header:Object.freeze({status:0,role:1,pending:2,numericStatus:3,complete:4}),capability:Object.freeze({rawNumericalBindings:true,nativeAllocation:false,wholeH:false})});
export function generateWorldCreationWGSL(template,stage,{numericProfile=NUMERIC_PROFILE.PRESERVED_F32}={}){
 if(!['begin','gather','evaluate','scatter','finish'].includes(stage))throw new RangeError('Explicit created numeric stage required');
 for(const name of['cue','bodies','rawPose','rawCreation'])if(!Number.isInteger(template?.segments?.[name]?.offset))throw new RangeError('Created world '+name+' segment required');
 const o=Object.fromEntries(Object.entries(template.segments).map(([k,v])=>[k,v.offset])),p=template.programOffsets.cue;
 let code='',body='';
 if(stage==='begin'){code=generateRawCueBindingWGSL();body=`if(rc_state[c]!=0u||rc_state[c+4u]!=0u){return;}if(!rc_raw_bind_cue_pose(bank+${o.rawPose}u,clearance,q)){rc_state[c]=4u;return;}rc_state[c+1u]=0u;rc_state[c+2u]=0u;`;}
 if(stage==='gather')body=`if(rc_state[c]!=0u||rc_state[c+4u]!=0u||rc_state[c+2u]!=0u||rc_state[c+1u]>=3u){return;}let input=q+374u+rc_state[c+1u]*40u;for(var i=0u;i<40u;i++){rc_scratch[scratch+i]=rc_state[input+i];}rc_state[c+2u]=1u;`;
 if(stage==='evaluate'){code=generateProfiledNumericWGSL(numericProfile);body=`if(rc_state[c]!=0u||rc_state[c+2u]!=1u){return;}let program=${p}u+rc_program[${p+24}u];if(rc_program[program+3u]!=40u||rc_program[program+4u]!=30u){rc_state[c]=4u;return;}rc_state[c+3u]=rc_num_eval(program,scratch);rc_state[c+2u]=2u;`;}
 if(stage==='scatter')body=`if(rc_state[c]!=0u||rc_state[c+2u]!=2u){return;}if(rc_state[c+3u]!=1u){rc_state[c]=4u;return;}let program=${p}u+rc_program[${p+24}u];let outputs=program+rc_program[program+8u];let dest=q+494u+rc_state[c+1u]*30u;for(var i=0u;i<30u;i++){rc_state[dest+i]=rc_scratch[scratch+rc_program[outputs+i]];}rc_state[c+1u]++;rc_state[c+2u]=0u;`;
 if(stage==='finish'){code=generateRawCueBindingWGSL()+'\n'+generateCueCanonicalBridgeWGSL();body=`if(rc_state[c]!=0u||rc_state[c+4u]!=0u){return;}if(rc_state[c+1u]!=3u||rc_state[c+2u]!=0u||!rc_raw_bind_created_mass(q,q+494u)||rc_cue_to_canonical(q,bank+${o.bodies}u)!=1u){rc_state[c]=4u;return;}rc_state[c+4u]=1u;`;}
 return code+`\nfn rc_world_creation_stage(bank:u32,clearance:u32,scratch:u32){let c=bank+${o.rawCreation}u;let q=bank+${o.cue}u;${body}}\n`;
}
