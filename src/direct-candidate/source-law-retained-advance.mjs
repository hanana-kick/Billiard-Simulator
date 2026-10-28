/** Explicit unverified native bridge for a conditional retained-support domain.
 * Never publication/scoring authority. Original replay remains mandatory.
 */
import {createExperimentalRetainedSupportDomain,evaluateGeneralSlidingSegment} from './source-law-general-segment.mjs';
import {sourceLawNonaxialRHS} from './source-law-nonaxial-rhs.mjs';
import {nextDown,nextUp} from './conservative-pair-cull.mjs';
export function advanceExperimentalRetainedSupport(lab,frames,{enabled=false,errorBudget,maxEvaluations=512}={}){
 const start=performance.now(),fail=(reason,more={})=>({advanced:false,reason,worldMutated:false,...more});
 if(!enabled)return fail('retained-support-opt-in-required');
 if(!Number.isInteger(frames)||frames<1||frames>96||!Number.isFinite(lab.dt)||lab.dt<=0)return fail('invalid-frame-budget');
 const domain=createExperimentalRetainedSupportDomain(lab,frames*lab.dt,{enabled:true});
 if(!domain.eligible)return fail(domain.reason,{domain});
 const index=domain.bodies.findIndex(b=>b.velocity.some(x=>x!==0)||b.angular.some(x=>x!==0)),body=domain.bodies[index],o=lab.objects[index];
 const solution=evaluateGeneralSlidingSegment(domain,body.id,{errorBudget,maxEvaluations});
 if(solution.status!=='completed-numerical-segment')return fail(solution.reason,{domain,solution});
 const position=solution.position.map(Math.fround),velocity=solution.velocity.map(Math.fround),angular=solution.angular.map(Math.fround),q=solution.quaternion.map(Math.fround);
 position[1]=body.position[1];velocity[1]=body.velocity[1];
 if(![...position,...velocity,...angular,...q].every(Number.isFinite)||Math.hypot(...q)===0)return fail('invalid-native-endpoint',{domain,solution});
 for(let k=0;k<3;k++)if(nextDown(position[k]-body.collisionRadius)<domain.bounds[index][k][0]||nextUp(position[k]+body.collisionRadius)>domain.bounds[index][k][1])return fail('packed-endpoint-outside-domain',{domain,solution});
 const packedRegime=sourceLawNonaxialRHS({...body,position,velocity,angular},domain.materials[index]);
 if(!packedRegime.eligible)return fail('packed-endpoint-regime-boundary',{domain,solution,rhsEvaluations:solution.rhsEvaluations+domain.domainRHSEvaluations+1});
 // No projection of height, velocity, load, contact cache or sleep state.
 o.body.setTranslation({x:position[0],y:position[1],z:position[2]},false);o.body.setLinvel({x:velocity[0],y:velocity[1],z:velocity[2]},false);o.body.setAngvel({x:angular[0],y:angular[1],z:angular[2]},false);o.body.setRotation({x:q[0],y:q[1],z:q[2],w:q[3]},false);
 lab.world.propagateModifiedBodyPositionsToColliders();lab.time+=frames*lab.dt;lab.steps+=frames;
 return {advanced:true,worldMutated:true,frames,duration:frames*lab.dt,wallMs:performance.now()-start,rhsEvaluations:solution.rhsEvaluations+domain.domainRHSEvaluations+1,geometryTests:domain.geometryTests,solution,supportEvidence:domain.supportEvidence,qualifiedForScoring:false,futureNativeLoadCertified:false,nativeObserverBookkeepingEquivalent:false,observerCaveat:'intermediate source trail/path samples not replayed; authoritative replay required',nativeQuaternion: {...o.body.rotation()}};
}
