import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {deserialize} from 'node:v8';import {createHash} from 'node:crypto';
import {THREE_MACRO_PROFILE,COUPLED_MACRO_PROFILE,selectedSourceMacroNames,serializedMacroProfile,assertMatchingMacroProfiles,assertCreatedMacroSelection,assertCoupledMacroBudget} from './resident-candidate-macro-profile-contract.mjs';
import {microcodeExternalReference} from './resident-candidate-microcode-external-reference.mjs';
import {prepareTipImpactCreatedHost} from './resident-candidate-tip-impact-created-host.mjs';
test('legacy profile stays omitted; coupled marker is explicit, complete and cannot relabel a continuation',()=>{
 assert.equal(serializedMacroProfile({}),THREE_MACRO_PROFILE);assert.equal(selectedSourceMacroNames().length,3);assert.equal(selectedSourceMacroNames(COUPLED_MACRO_PROFILE).length,4);
 assert.equal(assertMatchingMacroProfiles({},{},{}),THREE_MACRO_PROFILE);assert.equal(assertMatchingMacroProfiles({macroProfile:COUPLED_MACRO_PROFILE},{macroProfile:COUPLED_MACRO_PROFILE}),COUPLED_MACRO_PROFILE);
 for(const value of [undefined,null,'unknown',THREE_MACRO_PROFILE])assert.throws(()=>serializedMacroProfile({macroProfile:value}));
 assert.throws(()=>assertMatchingMacroProfiles({},{macroProfile:COUPLED_MACRO_PROFILE}));assert.throws(()=>selectedSourceMacroNames('unknown'));
 const descriptors=selectedSourceMacroNames().map(name=>({name})),initial={compiled:{externalFunctions:descriptors},configuration:{externalFunctions:structuredClone(descriptors)}};assert.equal(assertCreatedMacroSelection(initial),THREE_MACRO_PROFILE);
 initial.compiled.externalFunctions.push({name:'rc_coupled_transport_advance'});assert.throws(()=>assertCreatedMacroSelection(initial),/exact selected/);
});
test('new created profile requires separately explicit original-JS cue oracle before artifact I/O',async()=>{
 for(const options of [{macroProfile:COUPLED_MACRO_PROFILE},{macroProfile:COUPLED_MACRO_PROFILE,cueNumberProfile:'legacy-double-single-v1'},{macroProfile:'unknown'},{macroProfile:null},{macroProfile:undefined},{future:[]}])await assert.rejects(()=>prepareTipImpactCreatedHost('/not-a-runtime',options));
 const dir=mkdtempSync(join(tmpdir(),'coupled-created-profile-'));try{writeFileSync(join(dir,'continuation.v8'),'unchanged');
  for(const options of [{},{macroProfile:THREE_MACRO_PROFILE},{macroProfile:COUPLED_MACRO_PROFILE,cueNumberProfile:'original-js-number-v1'}])await assert.rejects(()=>prepareTipImpactCreatedHost(dir,options),/fresh artifact directory/);
  assert.equal(readFileSync(join(dir,'continuation.v8'),'utf8'),'unchanged');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('TEST id3 reference requires explicit profile and unchanged sixth argument; source closure handles real prior statuses',()=>{
 const descriptor={id:3,name:'rc_coupled_transport_advance'},args=[0,72,64,0,0,32768].map(x=>Uint32Array.of(x));
 const bindings=[new Uint32Array(72),new Uint32Array(1),new Uint32Array(1),new Uint32Array(16).fill(0xfacefeed),new Uint32Array(1)];bindings[0][70]=1;
 const before=bindings.map(x=>x.slice());assert.throws(()=>microcodeExternalReference(descriptor,args,{bindings}),/Explicit coupled/);
 for(const budget of [0,1,32767,32769,1000000]){const bad=args.map(x=>x.slice());bad[5][0]=budget;assert.throws(()=>microcodeExternalReference(descriptor,bad,{bindings,macroProfile:COUPLED_MACRO_PROFILE}),/budget32768/);assert.deepEqual(bindings,before);}
 assert.deepEqual(microcodeExternalReference(descriptor,args,{bindings,macroProfile:COUPLED_MACRO_PROFILE}),Uint32Array.of(1));assert.deepEqual(bindings,before,'unchanged actual canonical prior-status return');
 bindings[0][70]=3;assert.deepEqual(microcodeExternalReference(descriptor,args,{bindings,macroProfile:COUPLED_MACRO_PROFILE}),Uint32Array.of(3),'source error status is not converted into pass/miss');
});
const sourcePath=process.env.RESIDENT_COUPLED_SOURCE_ONLY??new URL('../../resident-native-artifacts/coupled-four-macro-source-only.v8',import.meta.url);
test('fresh source-only fixed compilation binds original budget guard/read/branch/CALL and descriptor slots',{skip:!existsSync(sourcePath)},()=>{
 const bytes=readFileSync(sourcePath);assert.equal(createHash('sha256').update(bytes).digest('hex'),'f23e08f16a942826b754ae805e294112bae03bef0b83f47fb1d22e7cdbb3ea75');
 const artifact=deserialize(bytes);assert.equal(artifact.noState,true);const p=artifact.compiled,proof=assertCoupledMacroBudget(p.instructions,p.externalFunctions);assert.equal(proof.sourceInstructionBudget,32768);assert.equal(proof.literalCallArgument,false);
 for(const [pc,word,value]of [[40453,2,32767],[40452,2,3],[40455,3,40463],[40501,3,2962],[40507,2,2958],[40508,2,31308]]){const code=p.instructions.slice();code[pc*8+word]=value;assert.throws(()=>assertCoupledMacroBudget(code,p.externalFunctions),/bytecode proof/);}
 for(const alter of [d=>d.params[5].slot--,d=>d.approval.declarationsSha256='0'.repeat(64),d=>d.approval.numericProfile='device-f32-v1']){const descriptors=structuredClone(p.externalFunctions);alter(descriptors.find(x=>x.id===3));assert.throws(()=>assertCoupledMacroBudget(p.instructions,descriptors),/slots\/declarations\/profile/);}
});
