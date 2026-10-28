/** Original continuum source-law RHS under PREPARED flat constant load N=mg.
 * Not a native solver patch or trajectory integrator. Native patch uses the
 * measured normal impulse capped by mg*h; that is NOT assumed to equal mg*h
 * in an arbitrary live contact. Caller must qualify support separately.
 */
const fail=reason=>({eligible:false,reason});
const finite=a=>a.every(Number.isFinite);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export function sourceLawNonaxialRHS(body,material){
 if(body.provenance!=='prepared-flat-constant-load'||body.otherContact||body.externalForce)return fail('unsupported-support-or-coupling');
 const {gravity:g,clothFriction:mu,rollingLength:lr,spinLength:ls}=material;
 const loadGravity=material.normalLoadGravity??g,capGravity=material.patchCapGravity??g;
 if(![body.velocity,body.angular].every(x=>Array.isArray(x)&&x.length===3)||!finite([...body.velocity,...body.angular,body.radius,body.mass,g,loadGravity,capGravity,mu,lr,ls])||body.radius<=0||body.mass<=0||g<=0||loadGravity<=0||capGravity<0||mu<0||lr<0||ls<0)return fail('invalid-state-or-material');
 if(body.velocity[1]!==0)return fail('vertical-motion');
 const r=body.radius,m=body.mass,w=body.angular,v=body.velocity;
 const surface=[-r*w[2],0,r*w[0]],slip=[v[0]-surface[0],0,v[2]-surface[2]],tangent=[w[0],0,w[2]];
 if(!finite([...surface,...slip]))return fail('nonfinite-derived-state');
 if((w[2]!==0&&surface[0]===0)||(w[0]!==0&&surface[2]===0))return fail('underflow-surface-motion');
 const slipSpeed=Math.hypot(slip[0],slip[2]),tangentSpeed=Math.hypot(w[0],w[2]);
 if(!finite([slipSpeed,tangentSpeed]))return fail('nonfinite-derived-state');
 // Zero slip is a rolling/static-friction regime, not kinetic friction with
 // an arbitrarily retained direction. Zero tangent spin is a torque-direction
 // boundary; source-local solve must choose the continuation there.
 const boundaries=[];
 if(slipSpeed===0)boundaries.push('slip-zero-unqualified-rolling');
 if(tangentSpeed===0)boundaries.push('tangential-spin-zero');
 if(boundaries.length)return {...fail('regime-boundary'),boundaries};
 const load=m*loadGravity,patchLoad=m*Math.min(loadGravity,capGravity),inertia=.4*m*r*r,frictionMagnitude=mu*load,rollingTorqueMagnitude=patchLoad*lr,spinTorqueMagnitude=patchLoad*ls;
 const beta=spinTorqueMagnitude/inertia,frictionRate=frictionMagnitude/m,rollingRate=rollingTorqueMagnitude/inertia;
 if(!finite([load,patchLoad,inertia,frictionMagnitude,rollingTorqueMagnitude,spinTorqueMagnitude,beta,frictionRate,rollingRate])||load===0||inertia===0||(mu>0&&(frictionMagnitude===0||frictionRate===0))||(lr>0&&capGravity>0&&(rollingTorqueMagnitude===0||rollingRate===0))||(ls>0&&capGravity>0&&(spinTorqueMagnitude===0||beta===0)))return fail('unrepresentable-derived-law');
 const force=slip.map(x=>-frictionMagnitude*(x/slipSpeed));
 const contactTorque=[-r*force[2],0,r*force[0]];
 const rollingTorque=tangent.map(x=>-rollingTorqueMagnitude*(x/tangentSpeed));
 const normalTorque=[0,-spinTorqueMagnitude*Math.sign(w[1]),0];
 if((mu>0&&Math.hypot(...force)===0)||(lr>0&&capGravity>0&&Math.hypot(...rollingTorque)===0)||(force[2]!==0&&contactTorque[0]===0)||(force[0]!==0&&contactTorque[2]===0))return fail('underflow-force-or-torque');
 const torque=contactTorque.map((x,k)=>x+rollingTorque[k]+normalTorque[k]);
 const acceleration=force.map(x=>x/m),angularAcceleration=torque.map(x=>x/inertia);
 const slipDerivative=[acceleration[0]+r*angularAcceleration[2],0,acceleration[2]-r*angularAcceleration[0]];
 const power=dot(force,v)+dot(torque,w);
 const normalSpinStopTime=w[1]!==0&&beta>0?Math.abs(w[1])/beta:Infinity;
 if(!finite([power,...force,...torque,...acceleration,...angularAcceleration,...slipDerivative])||(w[1]!==0&&beta>0&&!Number.isFinite(normalSpinStopTime)))return fail('unrepresentable-derived-rate');
 return {eligible:true,profile:'source-law-prepared-nonaxial-sliding-rhs-v1',positionDerivative:[...v],velocityDerivative:acceleration,angularDerivative:angularAcceleration,slip,slipDerivative,slipSpeed,tangentialAngularSpeed:tangentSpeed,normalSpinStopped:w[1]===0,normalSpinStopTime,normalSpinStopTimeUnderflow:w[1]!==0&&beta>0&&normalSpinStopTime===0,force,contactTorque,rollingTorque,normalTorque,inertia,normalLoad:load,patchLoad,power,boundaryIndicators:{slipSpeed,tangentialAngularSpeed:tangentSpeed,normalAngular:w[1]},futureTangentialBoundaryCertified:false,trajectoryAdvanced:false};
}
