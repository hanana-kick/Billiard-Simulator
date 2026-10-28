// Fixture-only module: no node:test registration. Definitions moved verbatim.
import assert from 'node:assert/strict';
import {fixture} from './mixed-motion-v2.mjs';import {wall,scene,hulls} from './mixed-motion-query.mjs';
import {mixedRollingRecipeCPU,sampleMixedMotionV2CPU} from '../../src/direct-candidate/deterministic-mixed-motion-v2.mjs';import {prepareRollingBoundsCPU} from '../../src/direct-candidate/deterministic-rolling-bounds.mjs';
import {runMixedCushionEntryV2CPU} from '../../src/direct-candidate/deterministic-mixed-cushion-v2.mjs';import {runMixedCushionEntryCPU} from '../../src/direct-candidate/deterministic-mixed-cushion-entry.mjs';
const material={mass:.21,restitution:.8,friction:.14,clothRestitution:0,clothFriction:.2,maxPointErrorQuanta:64,maxNormalErrorQuanta:4096};
function rollingWall(spin=0){const p=new Int32Array(wall.packet.buffer),f=fixture({h:wall.packet[2],speed:p[11],spin}),s=new Int32Array(f.rows.buffer);s.set(p.slice(8,11),8);f.rows.set(prepareRollingBoundsCPU(mixedRollingRecipeCPU(f.rows,0)).slice(0,12),64);return f.rows;}

export {material,rollingWall};
