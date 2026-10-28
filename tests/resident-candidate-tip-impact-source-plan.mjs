// HOST SOURCE PREPARATION ONLY. This explicit audited profile is separate from
// all accepted seven-binding source/runtime gates. Inputs are initial-only.
import assert from 'node:assert/strict';
import {buildWorldInitializationCommands,packWorldInitializationRows} from '../src/resident-candidate/world-initialization.mjs';
import {generateWorldHPlan} from '../src/resident-candidate/world-h.mjs';
import {compileWorldDevicePc} from '../src/resident-candidate/world-device-pc.mjs';
import {compileWorldSourceOwners} from '../src/resident-candidate/world-owners.mjs';
import {RULE_LAYOUT as R} from '../src/resident-candidate/physical-rules.mjs';
import {NUMERIC_PROFILE} from '../src/resident-candidate/numeric-profile.mjs';
import {RAW_PC_SAFE_TRANSPORTS} from './resident-candidate-raw-world-pc-runner.mjs';
import {instrumentWorldHEmissions} from './resident-candidate-event-audit.mjs';
import {TIP_IMPACT_MICROCODE_CHECKPOINTS,composeTipImpactMicrocodeCheckpoints} from '../src/resident-candidate/tip-impact-microcode-checkpoints.mjs';
const ROWS=Object.freeze([{id:219,settings:{angle:310,elevation:85,speed:4.5,tipX:.2,tipY:-.1}},{id:522,settings:{angle:9,elevation:8,speed:0,tipX:0,tipY:0}}]);
export function createTipImpactSourcePlan({initializationPlan,rows,sweeps=1}={}){
 assert.deepEqual(rows,ROWS,'fixed independently admitted219 + invalid522 roster');assert.ok(Number.isSafeInteger(sweeps)&&sweeps>0&&sweeps<=65536,'bounded explicit diagnostic work');
 assert.equal(initializationPlan.template.state[initializationPlan.template.segments.rules.offset+R.maxSteps],15360,'original16-second physical query horizon');
 const count=2,frames=192,template=initializationPlan.template,init=buildWorldInitializationCommands(initializationPlan,count);
 const original=generateWorldHPlan(template,{count,numericProfile:NUMERIC_PROFILE.PRESERVED_F32,...RAW_PC_SAFE_TRANSPORTS});
 // Audit wrappers invoke exact original source helpers; static event cap64 is
 // sealed BEFORE PC/owner compilation, never patched into compiled owners.
 const source=instrumentWorldHEmissions(template,original,{capacityPerCandidate:64});
 const phasePc=compileWorldDevicePc(source,{programBase:template.program.length,controlTailBase:init.resources.worldState,maxH:frames});
 const pc=compileWorldSourceOwners(template,source,phasePc,{controlVisitPolicy:'single-call',controlPartition:'source-closures-v1'});
 for(const key of ['count','stateWords','scratchWords','programBase','controlTailBase','controlWords','maxH'])assert.equal(pc[key],phasePc[key]);assert.deepEqual(pc.bytecode,phasePc.bytecode);assert.deepEqual(pc.bindingTypes,source.bindingTypes);assert.equal(pc.bindingTypes.length,6);assert.equal(pc.maxH,TIP_IMPACT_MICROCODE_CHECKPOINTS.requestedH);
 const program=new Uint32Array(template.program.length+pc.bytecode.length);program.set(template.program);program.set(pc.bytecode,pc.programBase);
 return Object.freeze({template,count,init,source,phasePc,pc,program,input:packWorldInitializationRows(initializationPlan,rows),frames,sweeps,sourceMode:'owners',dispatches:init.dispatches+1+pc.sweep.length*sweeps});
}
export function composeTipImpactSourcePlan(g,{limits}={}){
 assert.equal(g?.frames,192);assert.equal(g.count,2);assert.equal(g.source.audit.capacityPerCandidate,64);
 return composeTipImpactMicrocodeCheckpoints(g.pc,g.template,{limits});
}
