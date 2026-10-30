/** TEST ONLY inverse of the exact candidate pre-guard dispatch. Goldens remain
 * immutable. This checks structural delta, not native physics qualification. */
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const GUARD='1279c0b0a73196b34434fc3faa338d629ffc381e1ad02abaf9ee8dde347b9e80';
const ORIGINAL='95541ac4ad5d0e0df6b5db610127b784a9946a9057a4335313e96fa642e99a22';
export function restoreSupportedClearGuardDelta({definitions,commands,buffers,pipelines,expectedDispatches}){
 assert.ok(Number.isSafeInteger(expectedDispatches)&&expectedDispatches>0);
 const result=structuredClone({definitions,commands,buffers,pipelines});
 const modules=result.definitions.flatMap((d,i)=>sha(d.code)===GUARD?[i]:[]);assert.equal(modules.length,1,'One exact reviewed pre-guard module');const moduleId=modules[0];
 const matches=result.pipelines.flatMap((p,i)=>p.module===moduleId?[i]:[]);assert.equal(matches.length,1,'One guard pipeline');const pipelineId=matches[0];assert.equal(result.pipelines[pipelineId].entryPoint,'main');assert.deepEqual(result.pipelines[pipelineId].layout,{bindGroupLayouts:[{entries:[{binding:0,visibility:4,buffer:{type:'storage'}}]}]});assert.deepEqual(result.pipelines[pipelineId].constants,{});
 let removed=0;const kept=[];
 for(let i=0;i<result.commands.length;i++){
  const c=result.commands[i];if(c.kind==='dispatch'&&c.pipeline===pipelineId){
   assert.equal(c.x,1);assert.equal(c.y??1,1);assert.equal(c.z??1,1);assert.equal(c.indirect,undefined);assert.equal(c.entries.length,1);assert.equal(c.entries[0].binding,0);assert.equal(c.entries[0].offset,0);assert.equal(c.entries[0].size,1024);
   const next=result.commands[i+1];assert.equal(next?.kind,'dispatch','Guard immediately precedes original clear');assert.equal(sha(result.definitions[result.pipelines[next.pipeline].module].code),ORIGINAL,'Original shader unchanged');assert.deepEqual(c.entries[0],next.entries[0],'Same exact state view');removed++;continue;
  }
  if(c.kind==='dispatch'&&c.pipeline>pipelineId)c.pipeline--;kept.push(c);
 }
 assert.equal(removed,expectedDispatches,'Exactly one guard per world iteration');
 result.commands=kept;result.definitions.splice(moduleId,1);result.pipelines.splice(pipelineId,1);for(const p of result.pipelines){assert.notEqual(p.module,moduleId);if(p.module>moduleId)p.module--;}
 return result;
}

// Flattened world captures retain one pipeline per definition. Normalize only
// field names, then reuse every exact source/layout/view/adjacency/count check.
export function restoreSupportedClearGuardWorldPlan(plan,{expectedDispatches}){
 const guards=plan.definitions.flatMap((d,i)=>sha(d.source)===GUARD?[i]:[]);
 assert.equal(guards.length,1,'One exact reviewed world pre-guard definition');
 const guardId=guards[0],guard=plan.definitions[guardId];
 assert.deepEqual(guard.ownership,[{stride:256,base:0,length:256}]);
 assert.equal(guard.entryPoint,'main');
 for(let i=0;i<plan.commands.length;i++){
  const c=plan.commands[i];if(c.kind!=='dispatch'||c.definition!==guardId)continue;
  const next=plan.commands[i+1];assert.equal(next?.kind,'dispatch');
  assert.deepEqual(plan.definitions[next.definition].ownership[0],guard.ownership[0],'Same exact state ownership');
 }
 const rename=(object,from,to)=>Object.fromEntries(Object.entries(object).map(([key,value])=>[key===from?to:key,value]));
 const normalized=restoreSupportedClearGuardDelta({
  definitions:plan.definitions.map(d=>({...d,code:d.source})),
  commands:plan.commands.map(c=>{assert.equal(Object.hasOwn(c,'pipeline'),false);return rename(c,'definition','pipeline');}),
  buffers:plan.allocations,
  pipelines:plan.definitions.map((d,module)=>({module,entryPoint:d.entryPoint,layout:d.layout,constants:{}})),
  expectedDispatches
 });
 const commandIndexMap=new Map();let nextIndex=0;
 for(const [i,c] of plan.commands.entries())if(!(c.kind==='dispatch'&&c.definition===guardId))commandIndexMap.set(i,nextIndex++);
 assert.equal(nextIndex,normalized.commands.length);
 for(const c of normalized.commands)if(c.indirect&&Object.hasOwn(c.indirect,'ownerCommand')){
  const owner=c.indirect.ownerCommand;assert.ok(Number.isSafeInteger(owner)&&owner>=0&&owner<plan.commands.length,'Valid original indirect owner index');
  assert.ok(commandIndexMap.has(owner),'Indirect owner cannot be a removed guard');
  c.indirect.ownerCommand=commandIndexMap.get(owner);
 }
 return {...structuredClone(plan),definitions:normalized.definitions.map(({code,...d})=>d),commands:normalized.commands.map(c=>rename(c,'pipeline','definition')),allocations:normalized.buffers};
}
