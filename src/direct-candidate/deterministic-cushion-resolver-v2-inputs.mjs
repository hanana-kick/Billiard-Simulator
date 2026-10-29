/** Source-owned MMQ2 cushion request packing. No device, capture or physics execution. */
import {packMixedCushionConfig} from './deterministic-mixed-cushion-entry.mjs';
import {packVerifiedCushionRailMap} from './deterministic-world-cushion-commit.mjs';
export function settingsCushionResolverV2(options={}){const releaseTicks=options.releaseTicks??64,maxNodes=options.maxNodes??256,maxInitialPenetrationQuanta=options.maxInitialPenetrationQuanta??128;if(!Number.isInteger(releaseTicks)||releaseTicks<1||releaseTicks>65535||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>1024||!Number.isInteger(maxInitialPenetrationQuanta)||maxInitialPenetrationQuanta<1||maxInitialPenetrationQuanta>4096)throw RangeError('Bounded release settings');return{releaseTicks,maxNodes,maxInitialPenetrationQuanta};}
export function validateCushionResolverV2Assets(scene,hulls,rails){const verified=packVerifiedCushionRailMap(hulls,Array.from(new Int32Array(scene.buffer,scene.byteOffset).slice(4,8)));if(verified.some((x,i)=>x!==rails[i]))throw RangeError('Source-owned actual rail map');for(let i=0;i<4;i++){const h=new Int32Array(hulls[i].buffer,hulls[i].byteOffset),s=new Int32Array(scene.buffer,scene.byteOffset);if(hulls[i][1]!==scene[22+8*i]||h.slice(8,14).some((x,k)=>x!==s[16+8*i+k]))throw RangeError('Source-owned actual scene hull');}}

export function packCushionResolverV2Inputs({scene,hulls,rails,bodyCount,material,options={}}){
 const opt=settingsCushionResolverV2(options),n=bodyCount;
 if(![3,4].includes(n))throw RangeError('Complete roster');
 validateCushionResolverV2Assets(scene,hulls,rails);
 if((n*(n-1)/2+n*scene[1]+4*n)*opt.maxNodes>32768)throw RangeError('Bounded query work');
 const assets=hulls.map(x=>x.slice()),sc=scene.slice(),rm=rails.slice(),dummy=new Uint32Array(n*80),materials=assets.map((_,i)=>packMixedCushionConfig(dummy,sc,i,material));
 return {options:opt,scene:sc,rails:rm,hulls:assets,materials,
  queryConfig:new Uint32Array([0,opt.maxNodes,0,1,1,0,1,1]),
  mergeConfig:new Uint32Array([n,sc[1]]),
  releaseConfig:new Uint32Array([opt.releaseTicks,opt.maxNodes]),
  releaseConfigs:assets.map((_,i)=>new Uint32Array([opt.releaseTicks,opt.maxNodes,opt.maxInitialPenetrationQuanta,i,sc[1]]))};
}
