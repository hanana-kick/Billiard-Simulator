import {packRollingTail} from '../src/direct-candidate/deterministic-rolling-tail.mjs';
import {runRollingPartialCPU} from '../src/direct-candidate/deterministic-rolling-partial.mjs';
const Q=2**24,T=2**20,K=Math.round(2.5*9.81*.00045/.03075*Q),S=Math.round(2.5*9.81*.00035/.03075*Q),rows=[];
for(const [vx,vz,steps] of [[2,0,10],[1.2,.8,10],[-2,0,10],[.2,0,2]]) {
 const b={profile:'canonical-supported-rolling-v1',id:1,mode:3,radius:Math.round(.03075*Q),rolling:K,normalSpinDrag:S,incomingKineticRadius:0,state:[0,0,Math.round(vx*Q),Math.round(vz*Q),Math.round(vz*Q),-Math.round(vx*Q),Math.round(.03*Q)],positionErrors:[0,0],normalSpinError:0,budgets:[2000,2000,20000,20000,20000]},source=packRollingTail([b]);let cur=source;
 for(let i=0;i<steps;i++){const r=runRollingPartialCPU(cur,65535).output;if(r[1]!==1||r[10]!==1)throw Error('unqualified');const s=new Int32Array(r.buffer);cur=packRollingTail([{...b,state:Array.from(s.slice(16,23))}]);}
 const direct=runRollingPartialCPU(source,steps*65535).output;rows.push({vx,vz,steps,ticks:steps*65535,source:Array.from(new Int32Array(source.buffer)),sequential:Array.from(new Int32Array(cur.buffer).slice(8,15)),anchor:Array.from(new Int32Array(direct.buffer).slice(16,23)),anchorQualified:direct[1]===1&&direct[10]===1,anchorErrors:Array.from(direct.slice(24,31))});
}
console.log(JSON.stringify(rows,null,2));
