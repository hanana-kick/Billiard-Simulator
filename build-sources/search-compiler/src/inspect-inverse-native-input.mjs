// Original static clearance and strike-admission semantics, never a native
// forward trajectory. Guards are attached only to freshly restored owned worlds.
import './inverse-events.js';
export function inspectOriginalInverseInput(R,req,topology,settings,purpose='evaluate'){
 if(!R?.World?.restoreSnapshot||!R?.EventQueue||!globalThis.PhysicsLab)throw new Error('Original native static preparation unavailable');
 if(!['clearance','evaluate','residual','jacobian','trial','verify'].includes(purpose))throw new Error('Unsupported inverse preparation purpose');
 const releases=[];let attemptedSteps=0,e=null,problem=null;
 const tracked=object=>{const free=object.free;let freed=false;object.free=function(){if(!freed){freed=true;return free.call(this);}};releases.push(()=>object.free());return object;};
 const protect=world=>{tracked(world);world.step=function(){attemptedSteps++;throw new Error('Native forward stepping prohibited in inverse static preparation');};return world;};
 class StaticWorld extends R.World{
  constructor(...args){super(...args);protect(this);}
  static restoreSnapshot(...args){return protect(R.World.restoreSnapshot(...args));}
 }
 class StaticQueue extends R.EventQueue{constructor(...args){super(...args);tracked(this);}}
 const staticR={...R,World:StaticWorld,EventQueue:StaticQueue};
 try{
  e=globalThis.LabInverseEvents.begin(staticR,req,topology,settings,{purpose});
  if(attemptedSteps)throw new Error('Native forward preparation attempt rejected');
  if(e.done)return{kind:purpose==='clearance'?'clearance':'rejected',outcome:globalThis.LabInverseEvents.finish(e),nativeForwardSteps:0};
  return{kind:'physical',clearance:e.clearance,inequalities:e.inequalities.slice(),nativeForwardSteps:0};
 }catch(error){problem=error;throw error;}finally{
  const failures=[];try{if(e)globalThis.LabInverseEvents.dispose(e);}catch(error){failures.push(error);}
  for(const release of releases.reverse())try{release();}catch(error){failures.push(error);}
  if(failures.length){if(problem)problem.cleanupErrors=failures.map(e=>String(e.message??e));else throw failures[0];}
 }
}
