// LEAN native test adapter: exact frozen8/9 artifacts, not production brands.
import assert from 'node:assert/strict';import {deserialize} from 'node:v8';
import {scaleHash,assertScaleGatePlan,SCALE_RUN_AUTHORIZATION,SCALE_ACTUAL_KIND} from './resident-candidate-scale-native-contract.mjs';
import {createMacroDiagnosticEngine} from './resident-candidate-macro-native-engine.mjs';
const plans=new WeakMap();
const metadataCopy=value=>{const copy=structuredClone(value),freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};return freeze(copy);};
export function loadScaleMacroGatePlan(input,expectedSha256){assert.match(expectedSha256,/^[a-f0-9]{64}$/);const bytes=Buffer.from(input);assert.equal(scaleHash(bytes),expectedSha256,'lead-selected immutable scale gate file');const p=assertScaleGatePlan(deserialize(bytes));const token=Object.freeze({kind:'resident-scale-test-owned-plan-v1',gateSha256:expectedSha256,source:metadataCopy(p.source),stats:Object.freeze({...p.stats}),resourcePolicy:Object.freeze({...p.resourcePolicy}),assertionContract:Object.freeze({...p.assertionContract}),pipelineOrder:Object.freeze(p.compileOrder.map(i=>p.descriptors[i].name)),t0Boundary:p.schedule.t0Boundary});plans.set(token,p);return token;}
const engine=createMacroDiagnosticEngine({planForToken:token=>plans.get(token),runAuthorization:SCALE_RUN_AUTHORIZATION,actualKind:SCALE_ACTUAL_KIND});
export const compileScaleMacroGate=engine.compileGate;
export const createScaleMacroRetainedCompiler=engine.createRetainedCompiler;
