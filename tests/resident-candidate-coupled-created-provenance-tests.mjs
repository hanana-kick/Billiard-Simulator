import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {serialize,deserialize} from 'node:v8';import {join} from 'node:path';
import {compareCoupledCreatedInitial} from './resident-candidate-coupled-created-provenance.mjs';
const dir=process.env.RESIDENT_COUPLED_CREATED_DIR,prior=process.env.RESIDENT_COUPLED_PRIOR_INITIAL;
test('fresh optional lowering retains every authenticated created-t0 word and never reuses old VM state',{skip:!dir||!prior},()=>{
 const options={freshBytes:readFileSync(join(dir,'initial.v8')),priorBytes:readFileSync(prior),freshExpectedBytes:readFileSync(join(dir,'expected.v8'))},r=compareCoupledCreatedInitial(options);
 assert.equal(r.allInitialWordsIdentical,true);assert.equal(r.compiledArtifactIdentical,false);assert.equal(r.previousEvolvedStateLoaded,false);assert.equal(r.oldVmStateRelocated,false);assert.equal(r.initialH,0);
 for(const change of[p=>p.bindings[0][5]=191,p=>p.bindings[3][0]^=1,p=>p.vmState=new Uint32Array(8),p=>p.configuration.instructionBudget=65535,p=>p.compiled.instructions[0]^=1,p=>p.macroProfile='source-three-macros-v1']){const p=deserialize(options.freshBytes);change(p);assert.throws(()=>compareCoupledCreatedInitial({...options,freshBytes:serialize(p)}));}
 const expected=deserialize(options.freshExpectedBytes);expected.referenceAuthority='legacy-double-single-v1';assert.throws(()=>compareCoupledCreatedInitial({...options,freshExpectedBytes:serialize(expected)}));
});
