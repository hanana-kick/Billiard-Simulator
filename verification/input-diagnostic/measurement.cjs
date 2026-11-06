'use strict';
function installMeasurement(){
 const m=globalThis.__measure={origin:performance.timeOrigin,events:[],eventTiming:[],frames:[],longTasks:[],renderInputs:[],handlerInputs:[],notify:[],progress:[],phase:'init',finished:false};
 function receive(e){const start=performance.now(),r={type:e.type,trusted:e.isTrusted,eventAt:e.timeStamp,entered:start,x:e.clientX,y:e.clientY,phase:m.phase,coalesced:e.getCoalescedEvents?.().map(x=>({at:x.timeStamp,x:x.clientX,y:x.clientY}))||[]};m.events.push(r);r.exited=performance.now();requestAnimationFrame(ts=>{r.rafTimestamp=ts;r.rafEntered=performance.now();});}
 for(const type of ['pointermove','pointerdown','pointerup','click'])addEventListener(type,receive,{capture:true});
 const supported=PerformanceObserver.supportedEntryTypes||[];m.supported=supported;
 if(supported.includes('event')){m.eventObserver=new PerformanceObserver(list=>{for(const e of list.getEntries())m.eventTiming.push({name:e.name,startTime:e.startTime,processingStart:e.processingStart,processingEnd:e.processingEnd,duration:e.duration,interactionId:e.interactionId,cancelable:e.cancelable,phase:m.phase});});m.eventObserver.observe({type:'event',buffered:true,durationThreshold:16});}
 if(supported.includes('longtask')){m.longObserver=new PerformanceObserver(list=>{for(const e of list.getEntries())m.longTasks.push({at:e.startTime,duration:e.duration,name:e.name});});m.longObserver.observe({type:'longtask',buffered:true});}
 let last=null;const frame=ts=>{const entered=performance.now();m.frames.push({ts,entered,gap:last==null?null:entered-last,phase:m.phase});last=entered;if(!m.finished)requestAnimationFrame(frame);};requestAnimationFrame(frame);
 m.export=()=>{m.finished=true;m.eventObserver?.disconnect();m.longObserver?.disconnect();const {export:_,eventObserver,longObserver,...v}=m;return v;};
}
function workerBootstrap(){
 const stats={progress:[],started:null,finished:null,origin:performance.timeOrigin};let service;
 onmessage=async({data})=>{if(data.type!=='run')return;try{await RAPIER.init();stats.started=performance.now();service=new OptimizerService(p=>{const begin=performance.now();if(data.mode!=='silent')postMessage({type:'progress',value:p,workerAt:begin});stats.progress.push({at:begin,end:performance.now(),evaluations:p.evaluations,steps:p.physicsSteps});},r=>{stats.finished=performance.now();postMessage({type:'result',value:r,stats});},e=>postMessage({type:'error',value:String(e),stats}),{background:false,coordinator:true});service.request(data.request);}catch(e){postMessage({type:'error',value:String(e),stats});}};
}
module.exports={installMeasurement,workerBootstrap};
