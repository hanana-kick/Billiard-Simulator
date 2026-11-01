/** Pure owned-byte snapshot of the original selected reset contract. */
import{snapshotOwnedBytes}from'./owned-bytes.mjs';
export function snapshotSelectedInputs(engine,input){
 if(input.rawLease!==undefined||input.rawUploads!==undefined)throw Error('Selected inputs do not accept search uploads or leases');
 const list=input.initialUploads;if(!Array.isArray(list)||list.length!==engine.allocations.length||list.length>256)throw Error('Complete selected uploads required');let total=0;const seen=new Set();
 return{initialUploads:list.map(u=>{if(!u||Object.keys(u).sort().join(',')!=='index,initial'||!Number.isSafeInteger(u.index)||u.index<0||u.index>=engine.allocations.length||seen.has(u.index))throw Error('Exact unique selected upload required');seen.add(u.index);const a=engine.allocations[u.index],init=engine.initialization[u.index];total+=a.size;if(total>12*1024*1024)throw Error('Original selected input byte bound');const initial=snapshotOwnedBytes(u.initial,a.size);if(initial.byteLength!==a.size)throw Error('Complete selected allocation required');if(init.kind==='zero'&&initial.some(x=>x!==0)||init.kind==='fixed'&&(init.bytes.length!==initial.length||initial.some((x,i)=>x!==init.bytes[i])))throw Error('Selected source reset mismatch');return{index:u.index,initial};})};
}
