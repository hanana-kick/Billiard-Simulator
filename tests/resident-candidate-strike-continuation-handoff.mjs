// TEST ONLY lean INITIALIZATION handoff. No source physics generator, Rapier,
// CPU oracle, comparator, expected state or GPU execution is imported here.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
export const STRIKE_INITIAL_KIND='resident-native-strike-initialization-only-v1';
export const STRIKE_CHECKPOINT_SCHEDULE=Object.freeze([{name:'before-tip',targetH:320,requestH:320,outer:5},{name:'after-tip',targetH:384,requestH:64,outer:6}].map(Object.freeze));
const hash=x=>createHash('sha256').update(x).digest('hex');
export function assertStrikeInitialRuntime(p){
 assert.equal(p?.kind,STRIKE_INITIAL_KIND);assert.deepEqual(Object.keys(p).sort(),['kind','identity','count','input','init','sharedGeometry','layout','checkpointSchedule','physicsExecutorIncluded'].sort());
 assert.equal(p.physicsExecutorIncluded,false,'handoff supplies initialization, not an unmeasured complete executor');assert.equal(p.count,1);assert.deepEqual(p.checkpointSchedule,STRIKE_CHECKPOINT_SCHEDULE);
 const inspect=(v,path)=>{if(v===null||typeof v!=='object'){assert.notEqual(typeof v,'function',path+' data only');return;}if(v instanceof Uint32Array)return;assert.ok(Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype,path+' plain initial records');for(const[k,x]of Object.entries(v)){assert.doesNotMatch(k,/expected|snapshot|scoring|results|future|oracle/i,path+' excludes assertion-only data');inspect(x,path+'.'+k);}};inspect(p,'runtime');
 assert.equal(p.identity.kind,'original-prestrike-raw-controls');for(const k of ['sourceArtifactSha256','preStrikeIdentity','createdIdentity','rawInputSha256'])assert.match(p.identity[k],/^[0-9a-f]{64}$/);
 assert.deepEqual(Object.keys(p.identity.row).sort(),['id','settings']);assert.deepEqual(Object.keys(p.identity.row.settings).sort(),['angle','elevation','speed','tipX','tipY'].sort());assert.ok(Object.values(p.identity.row.settings).every(Number.isFinite));
 assert.ok(p.input instanceof Uint32Array&&p.input.length===16);assert.equal(hash(p.input),p.identity.rawInputSha256);assert.equal(p.input[0],p.identity.row.id);
 const d=new DataView(p.input.buffer,p.input.byteOffset,p.input.byteLength);['angle','elevation','speed','tipX','tipY'].forEach((k,i)=>assert.ok(Object.is(d.getFloat64(8+i*8,true),p.identity.row.settings[k])));
 const names=['inputs','rawState','rawProgram','rawGeometry','rawScratch','worldState','worldTemplate','worldProgram','numericScratch'];assert.deepEqual(Object.keys(p.init.resources).sort(),names.sort());
 for(const k of ['inputs','rawState','rawScratch','worldState','numericScratch'])assert.ok(Number.isSafeInteger(p.init.resources[k])&&p.init.resources[k]>0,k+' fresh allocation size only');
 for(const k of ['rawProgram','rawGeometry','worldTemplate','worldProgram'])assert.ok(p.init.resources[k] instanceof Uint32Array,k+' source initial words');
 assert.equal(p.init.resources.inputs,16);assert.equal(p.init.count,1);assert.equal(p.init.hostReadbacksBeforeH,0);assert.equal(p.init.numericalGpuExecuted,false);assert.equal(p.init.dispatches,p.init.commands.reduce((sum,x)=>sum+x.repeat,0));
 for(const x of p.init.commands){assert.ok(Number.isSafeInteger(x.repeat)&&x.repeat>0);assert.ok(Object.hasOwn(p.init.stages,x.stage));}
 for(const x of Object.values(p.init.stages)){assert.equal(typeof x.code,'string');assert.ok(x.code.length>0);assert.equal(x.resources.length,x.bindingTypes.length);assert.ok(x.resources.every(k=>names.includes(k)));}
 assert.equal(p.init.initialUploads.length,1);assert.equal(p.init.initialUploads[0].resource,'worldState');assert.equal(p.init.initialUploads[0].offsetWords,p.layout.stateWords);assert.deepEqual(p.init.initialUploads[0].data,p.layout.fixedCcd);
 assert.ok(p.sharedGeometry instanceof Uint32Array);assert.equal(p.init.resources.worldState,p.layout.stateWords+p.layout.fixedCcd.length);assert.equal(p.identity.rule.maxOuterSteps,15360,'original16-second query horizon remains unchanged');
 return p;
}
export function inspectStrikeInitialRuntime(directory){
 assert.equal(globalThis.PhysicsLab,undefined,'lean inspection must not import source physics');assert.equal(globalThis.ShotSearchCore,undefined);assert.equal(globalThis.LabController,undefined);
 const m=JSON.parse(readFileSync(join(directory,'runtime-manifest.json'))),bytes=readFileSync(join(directory,'runtime.v8'));assert.equal(hash(bytes),m.runtimeSha256);const p=assertStrikeInitialRuntime(deserialize(bytes));
 return{kind:'resident-strike-initial-only-host-inspection',runtimeSha256:m.runtimeSha256,count:p.count,checkpoints:p.checkpointSchedule,expectedFileOpened:false,gpuExecuted:false,physicsExecutorIncluded:false,rssBytes:process.memoryUsage().rss};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{assert.equal(process.argv[2],'inspect');assert.ok(process.argv[3]);console.log(JSON.stringify(inspectStrikeInitialRuntime(resolve(process.argv[3]))));}catch(e){console.error(e);process.exitCode=1;}}
