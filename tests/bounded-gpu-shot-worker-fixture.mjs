// TRANSPORT/LIFECYCLE DOUBLE ONLY. No native engine, GPUDevice, WGSL or parity claim.
import {createExclusiveShotRunner} from '../src/bounded-gpu-shot/lifecycle.mjs';
export const tick = () => new Promise(resolve => setImmediate(resolve));
export const deferred = () => {let resolve, reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
export const input = id => ({snapshot:new Uint8Array([1,2,3]),capture:{boundary:'strikeCreated',candidateInput:true,nativeSteps:72,
  apiJournalLength:131,modeCreationJournal:[],strikeCreationJournal:[],application:{id,minusZero:-0,missing:undefined,big:3n,data:new Float32Array([1.5])}}});
export function doubleOwner({step, initialize, restAt=3}={}) {
  const loss=deferred(),stats={steps:0,initialized:0,released:0,deviceDestroyed:0,flights:0,maxFlights:0,inputs:[]};
  const service=createExclusiveShotRunner({deviceLost:loss.promise,now:()=>performance.now(),renderingBusy:()=>false,yieldControl:tick,
    async initialize(input,check){stats.initialized++;stats.inputs.push(input);await initialize?.();check();
      const state={frame:0,outerStep:0,outerSubstep:0,time:0,id:input.capture.application.id,
        bytes:input.snapshot.slice(),balls:Array.from({length:4},()=>({state:{sleeping:false}})),
        cue:{present:true},scene:{manager:{awake_island:0}},game:{pending:true},shotComplete:false};
      return {world:{snapshot:()=>structuredClone(state),async step(){stats.flights++;stats.maxFlights=Math.max(stats.maxFlights,stats.flights);
        try{await step?.(state);stats.steps++;state.frame++;state.time+=1/61440;state.outerSubstep++;
          if(state.frame===restAt){state.shotComplete=true;state.cue.present=false;state.balls.forEach(b=>b.state.sleeping=true);state.scene.manager.awake_island=null;state.scoreResult={delta:0};state.game={pending:null};}
        }finally{stats.flights--;}}},release:()=>{if(stats.flights)throw Error('Early release');stats.released++;}};
    }});
  return {owner:{service,deviceLost:loss.promise,dispose(){if(stats.flights)throw Error('Early device destroy');stats.deviceDestroyed++;}},stats,loss};
}
export function messagePair() {
  const mainListeners=new Map(),hostListeners=new Map(),sent=[],received=[];
  let terminated=0;
  const emit=(listeners,type,event)=>{for(const fn of [...(listeners.get(type)??[])])fn(event);};
  const endpoint=(own,other,log)=>({addEventListener(type,fn){if(!own.has(type))own.set(type,new Set());own.get(type).add(fn);},
    removeEventListener(type,fn){own.get(type)?.delete(fn);},postMessage(value){const data=structuredClone(value);log.push(data);setImmediate(()=>emit(other,'message',{data}));}});
  const worker={...endpoint(mainListeners,hostListeners,sent),terminate(){terminated++;}};
  return {worker,host:endpoint(hostListeners,mainListeners,received),sent,received,
    emitMain:data=>emit(mainListeners,'message',{data}),emitError:message=>emit(mainListeners,'error',{message}),
    terminated:()=>terminated};
}
