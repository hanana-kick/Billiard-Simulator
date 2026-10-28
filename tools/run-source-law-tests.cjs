'use strict';
// CPU-only focused tests. The npm script first runs existing prepare:engine.
const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),engine=path.join(root,'vendor','rapier.cjs');
if(!fs.existsSync(engine))throw Error('Run npm run prepare:engine before source-law tests');
const result=spawnSync(process.execPath,['--test','tests/source-law-normal-spin.mjs','tests/source-law-collinear-segment.mjs','tests/source-geometry-horizon.mjs','tests/source-law-candidate-evaluator.mjs','tests/source-law-axial-advance.mjs','tests/source-law-cost-gate.mjs','tests/source-law-landing-event.mjs','tests/source-law-nonaxial-rhs.mjs','tests/source-law-general-segment.mjs','tests/source-law-raw-candidate.mjs','tests/source-law-retained-advance.mjs'],{
 cwd:root,stdio:'inherit',env:{...process.env,DIRECT_CUE_RAPIER_PATH:engine}
});
if(result.error)throw result.error;
process.exitCode=result.status??1;
