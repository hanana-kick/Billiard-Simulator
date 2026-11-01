/** Source-owned host input packing for the prepared GPU world.
 * No CPU/GPU physics, resource allocation, capture, or source rewriting. Every
 * returned upload is owned; geometry/material/clock/budgets are current inputs.
 */
import {mixedMotionRevision} from './deterministic-world-mixed-v2.mjs';
import {validateSelectedWorldTraceV2Profile} from './canonical-selected-world-trace-v2-gpu.mjs';
import {validateSelectedWorldTraceProfile} from './canonical-selected-world-trace-gpu.mjs';
import {validatePreparedWorld} from './deterministic-prepared-world.mjs';
import {validateResidentScene} from './deterministic-resident-transition.mjs';
import {validateCushionHull} from './deterministic-cushion-geometry.mjs';
import {packLandingChainCloth} from './deterministic-landing-chain.mjs';
import {deriveLandingVelocityCorrectionCap} from './deterministic-landing-3d.mjs';
import {packTubePrefixContext} from './deterministic-tube-prefix.mjs';
import {packRollingTailScene} from './deterministic-rolling-tail.mjs';
import {worldCushionSettings} from './deterministic-world-cushion-route.mjs';
import {packRollingPairEntryConfig} from './deterministic-rolling-pair-entry.mjs';
import {packQtBridgeConfig} from './deterministic-qt-bridge.mjs';
const Q=2**24,owned=x=>x instanceof Uint32Array&&Object.prototype.toString.call(x.buffer)!=='[object SharedArrayBuffer]';
export function packPreparedWorldInputs(original,scene,hulls,options,{revision=mixedMotionRevision(options)}={}){
 const rollingV2=revision==='mmq2';
 if(!Array.isArray(hulls)||hulls.length!==4||hulls.some(x=>!owned(x)))throw TypeError('Owned actual hull assets');
 const assets=hulls.map(x=>x.slice());assets.forEach(validateCushionHull);
validatePreparedWorld(original,scene);if(original.length!==192||!owned(scene))throw TypeError('One owned candidate');validateResidentScene(scene);if(!Number.isInteger(options.maxWorldSteps)||options.maxWorldSteps<1||options.maxWorldSteps>128||options.executionProfile!=='canonical-local-v1')throw RangeError('Bounded rolling-entry world profile');if(mixedMotionRevision(options)!==revision)throw RangeError('Factory and runtime mixed-motion revision must match');const traceRequested=(rollingV2?validateSelectedWorldTraceV2Profile:validateSelectedWorldTraceProfile)(options);const maxPrefixes=options.maxWorldSteps,executionProfile=options.executionProfile,rows=original.slice(),sc=scene.slice(),setup=packLandingChainCloth(sc,{...options,maxVelocityCorrectionQuanta:options.maxVelocityCorrectionQuanta??deriveLandingVelocityCorrectionCap(sc[17]),cycles:1,continuationTicks:options.durationTicks});setup.config[6]=options.maxWorldSteps;const tailMaxNodes=options.tailMaxNodes??256;if(!Number.isInteger(tailMaxNodes)||tailMaxNodes<1||tailMaxNodes>256)throw RangeError('Tail query budget');setup.config[5]=tailMaxNodes;const context=packTubePrefixContext(sc,assets,setup.options);context[14]=setup.config[4];const deadline=options.deadlineTick??0x7fffffff;if(!Number.isInteger(deadline)||deadline<rows[3]||deadline>0x7fffffff)throw RangeError('Immutable signed-range continuation deadline');context[24]=deadline;context[25]=options.deadlineTick===undefined?0:1;context[26]=options.durationTicks;setup.config[7]=deadline;const recurContext=context.slice();recurContext[13]=executionProfile==='canonical-local-v1'?1:0;const c=new Int32Array(context.buffer),s=new Int32Array(sc.buffer),tailScene=packRollingTailScene({provenance:'actual-finite-table-roster',hulls:assets,staticBounds:Array.from({length:sc[16]},(_,i)=>Array.from(s.slice(32+i*6,38+i*6),x=>x/Q)),clothTop:c[8]/Q,clothFootprint:Array.from(c.slice(9,13),x=>x/Q)}),cushionSettings=worldCushionSettings(sc,assets,context,options);
 const iterations=new Uint32Array(maxPrefixes*64);for(let i=0;i<maxPrefixes;i++)iterations[i*64]=i;
 const pairMaterial=packRollingPairEntryConfig({provenance:'immutable-equal-sphere-pair-cloth-material',mass:s[3]/Q,pairRestitution:s[11]/Q,pairFriction:s[12]/Q,clothRestitution:options.clothRestitution,clothFriction:s[13]/Q});
 return {rows,scene:sc,context,recurContext,landingConfig:setup.config,cloth:setup.cloth,tailScene,pairMaterial,iterations,qtSearchConfig:packQtBridgeConfig(),qtFixedConfig:packQtBridgeConfig({durationMode:'fixed'}),maxPrefixes,executionProfile,traceRequested,cushionSettings,revision};
}
