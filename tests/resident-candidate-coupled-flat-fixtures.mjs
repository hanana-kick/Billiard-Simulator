// Identical prepared numerical fixtures from resident-candidate-coupled-solver.mjs.
// Geometry is not asserted here; unmodified original solver is the oracle.
const f=Math.fround,vec=x=>x.map(f),zero=()=>[0,0,0],clone=x=>structuredClone(x);
const common={dt:f(1/960),lengthUnit:1,normalizedMaxLinearVelocity:1000,dynamicFrequency:30,
  dynamicDamping:5,staticFrequency:120,staticDamping:5,warmstartCoefficient:.8,
  normalizedMaxCorrectiveVelocity:10,frictionInBiasPass:false,gravity:[0,f(-9.81),0],
  substeps:12,pgsIterations:4,stabilizationIterations:1};
function body(x=0,z=0){const radius=f(.03),mass=f(.17),inertia=f(f(f(.4)*mass)*f(radius*radius)),inv=f(1/inertia);
  return {linear:vec([.4,0,.15]),angular:vec([1,2,-3]),translation:vec([x,radius-.00001,z]),rotation:[0,0,0,1],
    invMass:Array(3).fill(f(1/mass)),invInertia:[inv,0,0,0,inv,0,0,0,inv],principalInertia:Array(3).fill(inertia),
    invPrincipalInertia:Array(3).fill(inv),principalFrame:[0,0,0,1],userForce:zero(),userTorque:zero(),
    gravityScale:1,linearDamping:0,angularDamping:0,gyroscopic:true,allowFastRotation:false,radius};}
const baseContact=()=>({warmWorld:zero(),warmImpulse:0,impulse:0,friction:f(.2),restitution:f(.8)});
function cloth(b){const p=b.translation,r=b.radius;return {...baseContact(),normal:[0,1,0],anchor1:[p[0],0,p[2]],anchor2:[0,-r,0],dp1:[p[0],f(p[1]-r),p[2]],dp2:[0,-r,0],friction:f(.25),restitution:0};}
function pair(a,b){const delta=b.translation.map((x,i)=>f(x-a.translation[i])),length=Math.hypot(...delta),n=vec(delta.map(x=>x/length)),p1=n.map(x=>f(x*a.radius)),p2=n.map(x=>f(-x*b.radius));return {...baseContact(),normal:n,anchor1:p1,anchor2:p2,dp1:p1,dp2:p2};}
function convex(b,normal){const n=vec(normal),dp=n.map(x=>f(-b.radius*x));return {...baseContact(),normal:n,anchor1:b.translation.map((x,i)=>f(x+dp[i])),anchor2:dp,dp1:b.translation.map((x,i)=>f(x+dp[i])),dp2:dp,friction:f(.15),restitution:f(.7)};}
function fixture(count=4,rails=true){
  const bodies=Array.from({length:count},(_,i)=>body((i-(count-1)/2)*.0599));
  bodies.forEach((b,i)=>b.linear=vec([1-i*.4,0,(i%2?-.03:.02)]));
  const descriptors=[],contacts=[];
  for(let i=0;i<count-1;i++){descriptors.push({kind:'dynamic-sphere',body1:i,body2:i+1});contacts.push(pair(bodies[i],bodies[i+1]));}
  bodies.forEach((b,i)=>{descriptors.push({kind:'cloth',body1:null,body2:i});contacts.push(cloth(b));});
  if(rails){for(const [i,n]of[[0,[0,0,1]],[count-1,[-1,0,0]]]){descriptors.push({kind:'static-convex',body1:null,body2:i});contacts.push(convex(bodies[i],n));}}
  const order=contacts.map((_,i)=>i);if(order.length>3)[order[1],order[2]]=[order[2],order[1]];
  contacts[0].warmImpulse=f(.0001);contacts[0].impulse=f(.0004);contacts[0].warmWorld=vec([0,.00001,-.00003]);
  return {spec:{bodyCount:count,substeps:common.substeps,pgsIterations:common.pgsIterations,stabilizationIterations:common.stabilizationIterations,contacts:descriptors,contactOrder:order},input:{...common,bodies,contacts}};
}
function largestFixture(){const fx=fixture(4,true);while(fx.spec.contacts.length<27){const i=fx.spec.contacts.length,b=i%4,n=i%2?[0,0,-1]:[0,1,0];fx.spec.contacts.push({kind:'static-convex',body1:null,body2:b});fx.input.contacts.push(convex(fx.input.bodies[b],n));fx.spec.contactOrder.push(i);}return fx;}

export {fixture,largestFixture};
