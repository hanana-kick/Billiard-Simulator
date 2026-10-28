// Assertion-only evidence. Never imported by the runtime/GPU role.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex');
export const PINS=Object.freeze({
  coupled:'51df3ee40d56d9cd9b5c27637d93655e491d78800c0bbcc9d80235abf531c605',
  scalar:'c1013531a239adb273544bbf39e2840821131c89fb555f059416c67c2a0f051c',
  initial:'74c67de5efd476cbbe394678cfc927ac5ed6d70a3b38c5e24697dd735895eb75',
  expected:'c04be6c729651540a1993f0f4addbc7f4c1338851a5d141e5e107688e65e2b23'
});
/** Six whole source bindings, including dirty scratch and complete event audit.
 * The independently changed VM lowering is deliberately NOT relocated/copied. */
export function compareCoupledFinalBindings(coupled,scalar){
  assert.equal(coupled.bindings.length,6);assert.equal(scalar.bindings.length,6);
  return coupled.bindings.map((words,binding)=>{assert.ok(words instanceof Uint32Array);assert.ok(scalar.bindings[binding] instanceof Uint32Array);assert.deepEqual(words,scalar.bindings[binding],`entire final source binding ${binding}`);return{binding,words:words.length,sha256:sha(words),exact:true};});
}
export function createCoupledH192Evidence({coupledBytes,scalarBytes,result,expectedBytes,initialBytes}){
  for(const[key,bytes]of Object.entries({coupled:coupledBytes,scalar:scalarBytes,expected:expectedBytes,initial:initialBytes}))assert.equal(sha(bytes),PINS[key],`${key} immutable evidence identity`);
  const current=deserialize(coupledBytes),previous=deserialize(scalarBytes);
  assert.equal(result.status,'completed');assert.equal(result.error,null);assert.equal(result.gpuExecuted,false);assert.equal(result.createdInput,true);assert.equal(result.rawInput,false);assert.equal(result.worldH,192);assert.equal(result.macroProfile,'source-coupled-macro-v1');
  assert.equal(result.hostContinuationSha256,PINS.coupled);assert.equal(result.initialSha256,PINS.initial);
  assert.deepEqual(result.completedComparisons,[{h:128,all11SourceGroups:true,nativeOuter:true,events:0},{h:192,all11SourceGroups:true,nativeOuter:true,events:1}]);
  for(const key of['all11SourceGroups','nativePhysicsLabOuter','fullAcceptedEmissionTapeQualified'])assert.equal(result.comparison[key],true,key);
  assert.equal(result.comparison.rawToStrikeQualified,false);assert.equal(result.comparison.events,1);
  assert.equal(current.totalPumps,16529);assert.equal(previous.totalPumps,21457);assert.deepEqual(result.coreSteps,['361168594','2511']);
  assert.deepEqual(result.calls,{rc_cue_flat_advance:768,rc_num_eval:13309,rc_world_broad_commit_collision:192,rc_coupled_transport_advance:84});
  assert.equal(current.historyProfile,'source-full-application-history-v1');assert.equal(previous.historyProfile,current.historyProfile);
  const bindings=compareCoupledFinalBindings(current,previous);
  const oldCore=690143272,newCore=361168594,oldPumpCommands=21457*4,newPumpCommands=16529*5;
  return{kind:'resident-coupled-created-h192-evidence-v1',status:'pass',sourceHead:'8174eace67adcaf005ab79144bd89fd148461ade',artifactHashes:PINS,
    inputs:{createdT0:true,rawInput:false,rows:[219,522],frames:192,physicalDtChanged:false,physicalQueryHorizonChanged:false,futureRuntimeInputs:false},
    gates:{all11SourceGroups:true,nativePhysicsLabOuter:true,fullAcceptedEmissionTapeQualified:true,checkpoints:[128,192],acceptedEvents:1,exactFinalBindings:bindings,vmLayoutRelocated:false},
    observedHost:{totalPumps:16529,acceptedCoreInstructions:newCore,rejectedCoreInstructions:2511,calls:result.calls,wallMs:result.hostWallMs,includesPrefix:true,macroCallbacksExecuteCanonicalScalarSource:true},
    scheduleCounts:{priorPumps:21457,currentPumps:16529,priorCoreInstructions:oldCore,currentCoreInstructions:newCore,coreInstructionReductionFraction:1-newCore/oldCore,priorPumpDispatches:oldPumpCommands,currentPumpDispatches:newPumpCommands,pumpDispatchReductionFraction:1-newPumpCommands/oldPumpCommands,initializationAndCaptureExcluded:true,notMeasuredGpuTime:true},
    qualification:{gpuExecuted:false,rawToStrike:false,fullRest:false,queryTerminal:false,native1024:false,hardwarePerformance:false},
    limitations:['HOST source macro callbacks still execute canonical scalar math; core counts exclude that work.','Every source binding equals the previous qualified three-macro final, but this equality alone is not an independent original-physics oracle. The separate all11/native/tape gates remain mandatory.','Added fifth handler leaves only 3.71% fewer pump commands; no whole-runtime speed claim or long-shot extrapolation.','The separately passed three-call native component gate does not qualify this complete GPU trajectory.']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const[currentDir,previousFile,output]=process.argv.slice(2);assert.ok(currentDir&&previousFile&&output,'explicit assertion-only input paths and evidence output');
  const read=name=>readFileSync(resolve(currentDir,name));
  const evidence=createCoupledH192Evidence({coupledBytes:read('continuation.v8'),scalarBytes:readFileSync(previousFile),result:JSON.parse(read('result.json')),expectedBytes:read('expected.v8'),initialBytes:read('initial.v8')});
  writeFileSync(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(evidence));
}
