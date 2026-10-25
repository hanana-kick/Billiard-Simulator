'use strict';
// Fixed release-independent checks. This compares observable physics only;
// passing it does not certify hidden solver/cache/CCD or whole-engine parity.
const TOLERANCES=Object.freeze({position:1e-6,rotation:1e-6,linearVelocity:1e-5,angularVelocity:1e-4});
function compareTrace(reference,actual){
 const failures=[],maximum={position:0,rotation:0,linearVelocity:0,angularVelocity:0};
 const fail=(path,expected,received)=>failures.push({path,expected,received});
 for(const key of ['engineSha256','dt','steps','rested','strikeAccepted'])if(reference[key]!==actual[key])fail(key,reference[key],actual[key]);
 for(const key of ['events','score'])if(JSON.stringify(reference[key])!==JSON.stringify(actual[key]))fail(key,reference[key],actual[key]);
 if(reference.frames.length!==actual.frames?.length)fail('frames.length',reference.frames.length,actual.frames?.length);
 for(let i=0;i<reference.frames.length;i++){
  const r=reference.frames[i],a=actual.frames?.[i];if(!a)continue;
  if(r.step!==a.step)fail(`frames.${i}.step`,r.step,a.step);
  if(r.bodies.length!==a.bodies?.length)fail(`frames.${i}.bodies.length`,r.bodies.length,a.bodies?.length);
  for(let j=0;j<r.bodies.length;j++){
   const rb=r.bodies[j],ab=a.bodies?.[j];if(!ab)continue;
   for(const k of ['id','sleeping'])if(rb[k]!==ab[k])fail(`frames.${i}.bodies.${j}.${k}`,rb[k],ab[k]);
   for(const [k,tol]of Object.entries(TOLERANCES)){
    if(!Array.isArray(ab[k])||ab[k].length!==rb[k].length){fail(`frames.${i}.${j}.${k}.length`,rb[k].length,ab[k]?.length);continue;}
    for(let d=0;d<rb[k].length;d++){const error=Math.abs(rb[k][d]-ab[k][d]);maximum[k]=Math.max(maximum[k],error);if(!Number.isFinite(error)||error>tol)fail(`frames.${i}.${j}.${k}.${d}`,rb[k][d],ab[k][d]);}
   }
  }
 }
 return{equal:failures.length===0,maximum,failures,tolerances:TOLERANCES,scope:'observables-only-not-engine-certification'};
}
module.exports={TOLERANCES,compareTrace};
