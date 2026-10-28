// Lean TEST-only local operator entrypoint. No automatic continuation, physics,
// GPU owner, manifest mutation, or expected data access. Explicit target hashes.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writePilotDecision} from './resident-candidate-tip-impact-pilot-barrier.mjs';
export function parsePilotDecisionArguments(args){
  const [dir,decision,...flags]=args;assert.ok(dir,'explicit local artifact directory');assert.ok(['continue','abort'].includes(decision),'explicit continue or abort');
  const names=['cost-sha256','gpu-invocation-id','manifest-sha256','runtime-sha256'];assert.equal(flags.length,names.length,'all receipt identities required');
  const values={};for(const flag of flags){const at=flag.indexOf('=');assert.ok(flag.startsWith('--')&&at>2);const key=flag.slice(2,at);assert.ok(names.includes(key)&&!Object.hasOwn(values,key),'known unique identity flag');values[key]=flag.slice(at+1);}
  return {dir:resolve(dir),options:{decision,costSha256:values['cost-sha256'],gpuInvocationId:values['gpu-invocation-id'],manifestSha256:values['manifest-sha256'],runtimeSha256:values['runtime-sha256']}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const{dir,options}=parsePilotDecisionArguments(process.argv.slice(2));console.log(JSON.stringify(writePilotDecision(dir,options)));}
  catch(error){console.error(error);process.exitCode=1;}
}
