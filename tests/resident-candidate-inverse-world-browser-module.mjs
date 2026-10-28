// Import-shim / unchanged-generation proof only. No browser GPU or forward h.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {createInverseWorldObservationPlan,generateInverseWorldObservationWGSL} from '../src/resident-candidate/inverse-world-observation.mjs';
import {createInverseQueryInitialFixture} from './resident-candidate-inverse-query-initial-fixture.mjs';
const url=new URL('../src/resident-candidate/inverse-world-observation.mjs',import.meta.url),source=readFileSync(url,'utf8'),shim="import * as importedWorld from '../experimental-four-ball-world.js';\nconst World=importedWorld.default??globalThis.LabFourBallWorldExperimental;",sha=x=>createHash('sha256').update(x).digest('hex');
test('exact namespace/default-or-original-global shim loads actual unmodified UMD owner in an ESM realm without Node globals',()=>{
 assert.ok(source.includes(shim));const world=new URL('../src/experimental-four-ball-world.js',import.meta.url).pathname;
 const script=`import vm from 'node:vm';import fs from 'node:fs/promises';
  const context=vm.createContext({structuredClone});
  const owner=new vm.SourceTextModule(await fs.readFile(${JSON.stringify(world)},'utf8'),{context});
  const adapter=new vm.SourceTextModule(${JSON.stringify(shim+'\nexport const selected=World;')},{context});
  await adapter.link(s=>{if(s!=='../experimental-four-ball-world.js')throw Error('Unexpected shim dependency');return owner;});await adapter.evaluate();
  if(Object.keys(owner.namespace).length!==0||adapter.namespace.selected!==context.LabFourBallWorldExperimental||typeof adapter.namespace.selected.validate!=='function')throw Error('Wrong original global API');
  if('module'in context||'require'in context||'process'in context||'Buffer'in context)throw Error('Node authority leaked into ESM realm');
  console.log('original-global-bound');`;
 const r=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',script],{encoding:'utf8',timeout:30000});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'original-global-bound');
});
test('authentic initial observer layouts and all generated WGSL/hash bytes equal the previous Node default binding',async t=>{
 const oldSource=source.replace(shim,"import World from '../experimental-four-ball-world.js';");assert.notEqual(oldSource,source);const rewritten=oldSource.replace(/(from|import)\s*['"](\.[^'"]+)['"]/g,(_,kind,path)=>kind+' '+JSON.stringify(new URL(path,url).href)),old=await import('data:text/javascript;base64,'+Buffer.from(rewritten).toString('base64'));
 const f=await createInverseQueryInitialFixture(),args={seed:f.source.seed,template:f.initialization.template,topology:f.topology},current=createInverseWorldObservationPlan(args),previous=old.createInverseWorldObservationPlan(args);assert.deepEqual(current,previous);
 const hashes=[];for(const count of[1,2])for(const entry of['initial','boundary','library']){const options={count,entry,workgroupSize:1},a=generateInverseWorldObservationWGSL(current.plan,options),b=old.generateInverseWorldObservationWGSL(previous.plan,options);assert.equal(a,b,'every shader byte '+count+'/'+entry);hashes.push({count,entry,bytes:Buffer.byteLength(a),sha256:sha(a)});}t.diagnostic(JSON.stringify({scope:'exact import selection and original initial-only shader equality',hashes,gpuExecuted:false,completeBrowserClosureQualified:false}));
});
