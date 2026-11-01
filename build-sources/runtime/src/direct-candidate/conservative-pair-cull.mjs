/** Conservative work reduction for certified planar quadratic segments only.
 * NOT a segment-admission test, source-law replacement, or Rapier broad phase.
 * Callers must establish both trajectories' validity through the common horizon.
 * Unsupported/nonfinite arithmetic fails open to the supplied pair root solver.
 * Optional diagnostic helper: measured slower than baseline on the bounded CPU
 * corpus. Do not enable by default based only on a reduced root-call counter.
 */
const bits = new DataView(new ArrayBuffer(8));
export function nextUp(x) {
 if(Number.isNaN(x)||x===Infinity)return x;
 if(x===0)return Number.MIN_VALUE;
 bits.setFloat64(0,x);let u=bits.getBigUint64(0);u+=x>0?1n:-1n;
 bits.setBigUint64(0,u);return bits.getFloat64(0);
}
export const nextDown=x=>-nextUp(-x);
const point=x=>[x,x];
const add=(a,b)=>[nextDown(a[0]+b[0]),nextUp(a[1]+b[1])];
const multiply=(a,b)=>{
 const products=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];
 return [nextDown(Math.min(...products)),nextUp(Math.max(...products))];
};
const valid=a=>a.every(Number.isFinite);
const upper=a=>a[1];
function inputValid(b,s,h){return Number.isFinite(h)&&h>=0&&Array.isArray(b.p)&&b.p.length===2&&Array.isArray(b.v)&&b.v.length===2&&Array.isArray(s.a)&&s.a.length===2&&[...b.p,...b.v,...s.a,b.r].every(Number.isFinite)&&b.r>0;}
/** Bernstein convex-hull enclosure, outward rounded at every operation. */
export function sweptSphereBounds(b,s,h){
 if(!inputValid(b,s,h))return null;
 const H=point(h),half=point(.5),bounds=[];
 for(let axis=0;axis<2;axis++){
  const p=point(b.p[axis]),vh=multiply(point(b.v[axis]),H);
  const controls=[p,add(p,multiply(vh,half)),add(add(p,vh),multiply(multiply(multiply(point(s.a[axis]),H),H),half))];
  if(controls.some(c=>!valid(c)))return null;
  const bound=[nextDown(Math.min(...controls.map(c=>c[0]))-b.r),nextUp(Math.max(...controls.map(c=>c[1]))+b.r)];
  if(!valid(bound))return null;bounds.push(bound);
 }
 return bounds;
}
// Mirror the baseline's actual rounded coefficients (not a different trajectory).
function coefficients(a,b,sa,sb){
 const p=b.p.map((x,i)=>x-a.p[i]),v=b.v.map((x,i)=>x-a.v[i]),q=sb.a.map((x,i)=>(x-sa.a[i])/2),r=a.r+b.r;
 const dot=(x,y)=>x[0]*y[0]+x[1]*y[1];
 return [dot(p,p)-r*r,2*dot(p,v),dot(v,v)+2*dot(p,q),2*dot(v,q),dot(q,q)];
}
function polynomialRange(c,h){
 const t=[0,h];let value=point(0),scale=point(1),power=point(1);
 for(let i=c.length-1;i>=0;i--)value=add(multiply(value,t),point(c[i]));
 for(let i=0;i<c.length;i++){
  scale=add(scale,multiply(point(Math.abs(c[i])),power));
  power=multiply(power,point(h));
 }
 return {value,scale};
}
function excludesBaselineTolerance(c,h){
 if(!valid(c))return false;
 const {value,scale}=polynomialRange(c,h);
 // Root isolation also evaluates a derivative tower. Do not hide its numeric
 // failures just because the original distance polynomial is separated.
 for(let d=c.slice(1).map((x,i)=>x*(i+1));d.length;d=d.slice(1).map((x,i)=>x*(i+1))){
  if(!valid(d))return false;
  const range=polynomialRange(d,h);
  if(!valid(range.value)||!valid(range.scale))return false;
 }
 // Baseline EPS is a root-acceptance tolerance, not a physical margin. Keep
 // ambiguous baseline results in the tested domain. This guard uses interval
 // products for powers, whereas baseline uses JavaScript **. Baseline diagnostic
 // parity is empirically tested, NOT a portable proof of Math.pow rounding.
 // The separate swept-AABB geometric exclusion is outward-rounded.
 const tolerance=multiply(scale,point(1e-8));
 return valid(value)&&valid(tolerance)&&value[0]>upper(tolerance);
}
export function canCullPair(a,b,sa,sb,h){
 const aa=sweptSphereBounds(a,sa,h),bb=sweptSphereBounds(b,sb,h);
 if(!aa||!bb)return false;
 if(!aa.some((range,i)=>range[1]<bb[i][0]||bb[i][1]<range[0]))return false;
 return excludesBaselineTolerance(coefficients(a,b,sa,sb),h);
}
/** Counters measure removed root solves, not wall-time or whole-shot speedup. */
export function pairTOIWithCulling(a,b,sa,sb,h,counters={},solvePairTOI){
 if(typeof solvePairTOI!=='function')throw new TypeError('Original pair solver callback required');
 counters.pairQueries=(counters.pairQueries??0)+1;
 if(canCullPair(a,b,sa,sb,h)){
  counters.pairRootCulls=(counters.pairRootCulls??0)+1;return null;
 }
 counters.pairRootSolves=(counters.pairRootSolves??0)+1;
 return solvePairTOI(a,b,sa,sb,h);
}
