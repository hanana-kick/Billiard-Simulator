/** Evaluate the ORIGINAL retained K=0 comparison recipe, not a new real-K
 * simulation. Exact encoded reference is distinct from a physical enclosure or
 * presentation interpolation. The slip norm's stop bracket remains unavailable.
 */
import {SLIP_BRIDGE_VERSION,slipBridgePositionBoundsCPU,validateSlipBridgeRows} from './deterministic-slip-bridge.mjs';
import {QT_BRIDGE_VERSION,qtBridgePositionBoundsCPU,validateQtBridgeRows} from './deterministic-qt-bridge.mjs';
import {fractionTerm} from './deterministic-microtail-fraction.mjs';
import {multiplyWide} from './deterministic-axial.mjs';
import {divideWide} from './deterministic-contact.mjs';
const T=2**20;
const midpoint=([lo,hi])=>lo+Math.floor((hi-lo)/2);
function ratio(a,b,d,up=false){if(!Number.isInteger(d)||d<=0)throw RangeError('Original reference denominator');const w=multiplyWide(Math.abs(a),Math.abs(b)),r=divideWide(w[0],w[1],d),negative=(a<0)!==(b<0);if(!r.valid||r.quotient>0x7ffffffe)throw RangeError('Reference arithmetic');return (negative?-1:1)*(r.quotient+((up?!negative:negative)&&r.remainder!==0?1:0));}
export function validateBridgeTraceDescriptor(packet){if(!(packet instanceof Uint32Array)||Object.prototype.toString.call(packet.buffer)==='[object SharedArrayBuffer]'||packet.length!==128||packet[1]!==1||![SLIP_BRIDGE_VERSION,QT_BRIDGE_VERSION].includes(packet[3]))throw RangeError('Original accepted owned bridge descriptor');const qt=packet[3]===QT_BRIDGE_VERSION;(qt?validateQtBridgeRows:validateSlipBridgeRows)(packet.slice(64));if(packet[0]!==packet[64]||packet[4]<1||packet[4]>packet[66]||packet[4]>65535||qt&&packet[52]!==1)throw RangeError('Original bridge identity/duration');(qt?qtBridgePositionBoundsCPU:slipBridgePositionBoundsCPU)(packet,0,packet[4]);return packet;}
export function sampleBridgeTraceReferenceCPU(packet,t){validateBridgeTraceDescriptor(packet);if(!Number.isInteger(t)||t<0||t>packet[4])throw RangeError('Original bridge sample clock');const s=new Int32Array(packet.buffer,packet.byteOffset,packet.length),qt=packet[3]===QT_BRIDGE_VERSION;
 const base={id:packet[0],relativeTick:t,sourceKind:qt?'QT_BRIDGE':'SLIP_BRIDGE',referenceKind:'original-K0-comparison',interpolation:false};
 if(t===0)return {...base,status:'exact-boundary',state:s.slice(72,79)};
 if(t===packet[4])return {...base,status:'exact-boundary',state:s.slice(16,23)};
 if(!qt&&t>=packet[6]&&t<packet[7])return {...base,status:'unavailable',reason:'ORIGINAL_SLIP_STOP_BRACKET',bracket:[packet[6],packet[7]]};
 const positions=(qt?qtBridgePositionBoundsCPU:slipBridgePositionBoundsCPU)(packet,t,t),ranges=[...positions.reference];
 let acc,qd;
 if(qt){acc=[[s[32],s[33]],[s[34],s[35]]];qd=[[s[36],s[37]],[s[38],s[39]]];}
 else if(t>=packet[7]||packet[35]===0){ranges.push([s[18],s[18]],[s[19],s[19]],[s[20],s[20]],[s[21],s[21]]);}
 else {acc=[0,1].map(j=>{const u=s[32+j],lo=ratio(Math.abs(u),s[36],s[35]),hi=ratio(Math.abs(u),s[36],s[34],true);return u>=0?[-hi,-lo]:[lo,hi];});qd=[[-ratio(acc[1][1],5,2,true),-ratio(acc[1][0],5,2)],[ratio(acc[0][0],5,2),ratio(acc[0][1],5,2,true)]];}
 if(acc)for(const [offset,rates]of [[74,acc],[76,qd]])for(let j=0;j<2;j++)ranges.push([s[offset+j]+fractionTerm(rates[j][0],t,1),s[offset+j]+fractionTerm(rates[j][1],t,1,true)]);
 const spin=Math.sign(s[78])*Math.max(0,Math.abs(s[78])-fractionTerm(s[70],t,1)),values=[...ranges.map(midpoint),spin];
 if(values.some(x=>!Number.isSafeInteger(x)||Math.abs(x)>0x7fffffff))throw RangeError('Reference sample overflow');const state=new Int32Array(values);
 if(Array.from(state).some(x=>!Number.isSafeInteger(x)))throw RangeError('Reference sample overflow');
 return {...base,status:'bounded-source-reference',canonicalState:false,referenceState:state,referenceRanges:ranges,positionEnclosure:positions.inflated};
}
