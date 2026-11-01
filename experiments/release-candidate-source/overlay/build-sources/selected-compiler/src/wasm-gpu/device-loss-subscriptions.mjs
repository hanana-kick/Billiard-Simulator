/** One device-lifetime reaction, removable owner listeners. Removing a listener
 * does not assert GPU completion; owners unsubscribe only after real drain. */
const devices=new WeakMap();
export function subscribeDeviceLoss(device,listener){
 if(typeof device?.lost?.then!=='function'||typeof listener!=='function')throw TypeError('Device loss promise and listener required');
 let state=devices.get(device);
 if(!state){
  state={listeners:new Set(),settled:false,value:null};devices.set(device,state);
  const settle=value=>{if(state.settled)return;state.settled=true;state.value=value;const listeners=[...state.listeners];state.listeners.clear();for(const fn of listeners){try{fn(value);}catch{ /* A faulty observer cannot prevent loss delivery to other owners. */ }}};
  Promise.resolve(device.lost).then(settle,settle);
 }
 let live=true;
 if(state.settled)queueMicrotask(()=>{if(live){try{listener(state.value);}catch{ /* Match settled delivery isolation. */ }}});else state.listeners.add(listener);
 return ()=>{live=false;state.listeners.delete(listener);};
}
