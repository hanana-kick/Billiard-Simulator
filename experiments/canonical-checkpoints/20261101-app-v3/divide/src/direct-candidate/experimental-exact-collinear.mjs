/** CPU proof of a separately versioned exact axis-aligned event policy. No GPU/default route. */
import {validateSmoothRows} from './deterministic-smooth-segment.mjs';
import {canonicalPositionWithin,canonicalVelocitySpinWithin} from './deterministic-state-domain.mjs';
const T=1048576n,Z={n:0n,d:1n};
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const c=a%b;a=b;b=c;}return a;};
function r(n,d=1n){n=BigInt(n);d=BigInt(d);if(!d)throw RangeError('Rational zero denominator');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);n/=g;d/=g;if(n.toString(2).length>1024||d.toString(2).length>1024)throw RangeError('Rational proof domain');return {n,d};}
const add=(a,b)=>r(a.n*b.d+b.n*a.d,a.d*b.d),neg=a=>r(-a.n,a.d),sub=(a,b)=>add(a,neg(b)),mul=(a,b)=>r(a.n*b.n,a.d*b.d),div=(a,b)=>r(a.n*b.d,a.d*b.n),cmp=(a,b)=>{const v=a.n*b.d-b.n*a.d;return v<0n?-1:v>0n?1:0;},sign=a=>a.n<0n?-1:a.n>0n?1:0,abs=a=>a.n<0n?neg(a):a;
const floor=a=>a.n>=0n?a.n/a.d:-((-a.n+a.d-1n)/a.d),ceil=a=>-floor(neg(a));
function nearestEven(a){const s=sign(a),n=a.n<0n?-a.n:a.n,q=n/a.d,rem=n%a.d;return BigInt(s)*(q+(2n*rem>a.d||2n*rem===a.d&&q%2n?1n:0n));}
const serialized=a=>({numerator:a.n.toString(),denominator:a.d.toString()});
const receipt=a=>({value:Number(nearestEven(a)),error:nearestEven(a)*a.d===a.n?0:1,exact:serialized(a)});
export const EXACT_COLLINEAR_POLICY='experimental-exact-axis-events-v1';

export function runExactCollinearCPU(original,{durationTicks=original?.[2]}={}){
  validateSmoothRows(original);
  if(original.length!==64)throw RangeError('One exact-axis source row');
  if(!Number.isInteger(durationTicks)||durationTicks<1||durationTicks>65535||durationTicks>original[2])throw RangeError('Bounded source horizon');
  const row=new Int32Array(original.slice().buffer),reject=reason=>({accepted:false,reason,integrationPolicy:EXACT_COLLINEAR_POLICY,gpuQualified:false});
  if(row.slice(24,32).some(v=>v!==0))return reject('requires-exact-canonical-anchor');
  const axis=row[11]===0&&row[12]===0&&(row[10]!==0||row[13]!==0)?0:row[10]===0&&row[13]===0&&(row[11]!==0||row[12]!==0)?1:-1;
  if(axis<0)return reject('not-exactly-axis-aligned');
  if(row[4]<=0||row[5]<0||row[6]<0||5n*BigInt(row[4])<=2n*BigInt(row[5]))return reject('nonsticking-material-domain');
  let p=r(row[8+axis]),v=r(row[10+axis]),w=r(axis===0?row[13]:-row[12]);
  if(!sign(add(v,w)))return reject('initial-slip-zero');
  const F=r(row[4]),K=r(row[5]),H=r(durationTicks,T),events=[],phases=[];let left=H,time=Z,mode=1,low=p,high=p;
  const bound=x=>{if(cmp(x,low)<0)low=x;if(cmp(x,high)>0)high=x;};
  const advance=(dt,a,b,phase)=>{
    const at=t=>add(p,add(mul(v,t),div(mul(a,mul(t,t)),r(2))));
    if(sign(a)){const turn=div(neg(v),a);if(cmp(turn,Z)>0&&cmp(turn,dt)<0)bound(at(turn));}
    const next=at(dt);bound(next);phases.push({kind:phase,startTick:serialized(mul(time,r(T))),durationTicks:serialized(mul(dt,r(T)))});
    p=next;v=add(v,mul(a,dt));w=add(w,mul(b,dt));time=add(time,dt);left=sub(left,dt);
  };
  for(let guard=0;sign(left)>0&&guard<5;guard++){
    if(mode===0){advance(left,Z,Z,'rest');break;}
    if(mode===3){
      const a=mul(r(-2*sign(v),7),K),b=neg(a),stop=sign(a)?div(neg(v),a):null;
      if(stop&&cmp(stop,left)<=0){advance(stop,a,b,'rolling');if(sign(v)||sign(w))throw Error('Exact rolling stop invariant');mode=0;events.push({kind:'rolling-stop',tick:serialized(mul(time,r(T)))});}
      else advance(left,a,b,'rolling');
      continue;
    }
    const su=sign(add(v,w)),sw=sign(w)||-su,a=mul(r(-su),F),b=sub(mul(r(-5*su,2),F),mul(r(sw),K));
    const slip=div(neg(add(v,w)),add(a,b)),qt=sign(w)&&sign(w)!==sign(b)?div(neg(w),b):null;
    if(cmp(slip,Z)<=0||qt&&cmp(qt,Z)<=0)throw Error('Positive event time invariant');
    const qtFirst=qt&&cmp(qt,slip)<0,event=qtFirst?qt:slip;
    if(cmp(event,left)>0){advance(left,a,b,'sliding');continue;}
    advance(event,a,b,'sliding');
    if(qtFirst){if(sign(w))throw Error('Exact qt crossing invariant');events.push({kind:'qt-zero',tick:serialized(mul(time,r(T)))});}
    else{if(sign(add(v,w)))throw Error('Exact slip crossing invariant');mode=sign(v)?3:0;events.push({kind:mode===3?'slip-zero':'simultaneous-motion-stop',tick:serialized(mul(time,r(T)))});}
  }
  if(sign(left))return reject('phase-bound');
  const spin=mul(r(Math.sign(row[14])),cmp(abs(r(row[14])),mul(r(row[6]),H))>0?sub(abs(r(row[14])),mul(r(row[6]),H)):Z);
  const normalStop=row[14]===0?Z:row[6]>0?div(abs(r(row[14])),r(row[6])):null;
  if(row[14]!==0&&normalStop&&cmp(normalStop,H)<=0)events.push({kind:'normal-spin-zero',tick:serialized(mul(normalStop,r(T)))});
  if(mode===0&&!sign(spin)){
    const motionEvent=events.find(e=>e.kind==='rolling-stop'||e.kind==='simultaneous-motion-stop'),motionStop=r(motionEvent.tick.numerator,motionEvent.tick.denominator),normalTick=mul(normalStop??Z,r(T));
    events.push({kind:'rest',tick:serialized(cmp(motionStop,normalTick)>0?motionStop:normalTick)});
  }
  events.sort((a,b)=>cmp(r(a.tick.numerator,a.tick.denominator),r(b.tick.numerator,b.tick.denominator)));
  const exact=[r(row[8]),r(row[9]),Z,Z,Z,Z,spin];exact[axis]=p;exact[2+axis]=v;exact[axis===0?5:4]=axis===0?w:neg(w);
  const packed=exact.map(receipt),endpoint=packed.map(x=>x.value),errors=packed.map(x=>x.error),uRounded=axis===0?endpoint[2]+endpoint[5]:endpoint[3]-endpoint[4],wRounded=axis===0?endpoint[5]:-endpoint[4];
  if(mode===1&&sign(add(v,w))&&!uRounded||sign(w)&&!wRounded||mode===3&&sign(v)&&!endpoint[2+axis]||sign(spin)&&!endpoint[6])return reject('rounding-would-change-regime');
  if(mode===3&&uRounded!==0)throw Error('Symmetric rolling rounding invariant');
  if(errors.some((e,i)=>e>row[16+i]))return reject('unchanged-budget');
  if(!canonicalPositionWithin([endpoint[0],0,endpoint[1]])||!canonicalVelocitySpinWithin([endpoint[2],0,endpoint[3]],[endpoint[4],endpoint[6],endpoint[5]]))return reject('canonical-state-domain');
  const bounds=[[row[8],row[8]],[row[9],row[9]]];bounds[axis]=[Number(floor(low)),Number(ceil(high))];if(bounds.flat().some(x=>Math.abs(x)>4*2**24))return reject('swept-position-domain');if(endpoint[0]<bounds[0][0]||endpoint[0]>bounds[0][1]||endpoint[1]<bounds[1][0]||endpoint[1]>bounds[1][1])throw Error('Quantized endpoint sweep invariant');
  return {accepted:true,integrationPolicy:EXACT_COLLINEAR_POLICY,gpuQualified:false,source:original.slice(),durationTicks,axis,mode,nominalRest:mode===0&&!sign(spin),endpoint,errors,exact:packed.map(x=>x.exact),positionBounds:bounds,events,phases,globalReceiptCertified:false};
}
