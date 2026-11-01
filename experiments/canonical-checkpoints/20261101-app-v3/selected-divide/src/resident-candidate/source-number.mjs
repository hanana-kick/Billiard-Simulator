// SPDX-License-Identifier: Apache-2.0
// Integer-backed IEEE-754 binary64 round-to-nearest/ties-to-even primitives.
// No WGSL f32 operation participates in these results. This does NOT by itself
// implement the host JS engine's implementation-dependent transcendental math.
export const SOURCE_NUMBER_CAPABILITY = Object.freeze({
  format: 'binary64-lo-hi-u32', rounding: 'nearest-ties-even',
  basicOperations: Object.freeze(['add', 'subtract', 'multiply', 'divide', 'sqrt', 'compare', 'f32-conversion']),
  sourceTranscendentals: false, hardwareValidated: false
});
const MASK32 = 0xffffffffn, MASK52 = (1n << 52n) - 1n, SIGN = 1n << 63n;
const EXP = 0x7ff0000000000000n, NAN = EXP | (1n << 51n);
const data = new DataView(new ArrayBuffer(8));
export function numberWords(value) { data.setFloat64(0, value, true); return Uint32Array.of(data.getUint32(0, true), data.getUint32(4, true)); }
export function wordsNumber(words) { data.setUint32(0, words[0], true); data.setUint32(4, words[1], true); return data.getFloat64(0, true); }
const bits = w => BigInt(w[0]) | BigInt(w[1]) << 32n;
const words = b => Uint32Array.of(Number(b & MASK32), Number((b >> 32n) & MASK32));
const bitLength = m => m === 0n ? 0 : m.toString(2).length;
function decoded(b) {
  const sign = b & SIGN, field = Number((b >> 52n) & 2047n), fraction = b & MASK52;
  if (field === 2047) return { sign, special: fraction ? 'nan' : 'infinity' };
  if (!field && !fraction) return { sign, zero: true, m: 0n, exponent: -1022 };
  let m = fraction | (field ? 1n << 52n : 0n), exponent = field ? field - 1023 : -1022;
  while (m < (1n << 52n)) { m <<= 1n; exponent--; }
  return { sign, m, exponent };
}
function shiftJam(m, n) { if (n <= 0) return m << BigInt(-n); const shift = BigInt(n), q = m >> shift; return q | (m !== q << shift ? 1n : 0n); }
function roundedShift(m, shift) {
  if (shift <= 0) return m << BigInt(-shift);
  const s = BigInt(shift), q = m >> s, r = m - (q << s), half = 1n << (s - 1n);
  return q + (r > half || r === half && (q & 1n) ? 1n : 0n);
}
// m is an integer magnitude; the exact represented value is m * 2**scale.
function pack(m, scale, sign = 0n) {
  if (!m) return sign;
  const shift = Math.max(bitLength(m) - 53, -1074 - scale);
  let q = roundedShift(m, shift); if (!q) return sign;
  const length = bitLength(q), exponent = scale + shift + length - 1;
  if (exponent > 1023) return sign | EXP;
  if (exponent < -1022) return sign | q;
  if (length > 53) q >>= BigInt(length - 53);
  else if (length < 53) q <<= BigInt(53 - length);
  return sign | BigInt(exponent + 1023) << 52n | q & MASK52;
}
function add(a, b) {
  const x = decoded(a), y = decoded(b);
  if (x.special === 'nan' || y.special === 'nan') return NAN;
  if (x.special || y.special) return x.special && y.special && x.sign !== y.sign ? NAN : x.special ? a : b;
  if (x.zero && y.zero) return x.sign & y.sign;
  if (x.zero) return b; if (y.zero) return a;
  let hi = x, lo = y;
  if (hi.exponent < lo.exponent || hi.exponent === lo.exponent && hi.m < lo.m) [hi, lo] = [lo, hi];
  const hm = hi.m << 3n, lm = shiftJam(lo.m << 3n, hi.exponent - lo.exponent);
  const magnitude = hi.sign === lo.sign ? hm + lm : hm - lm;
  return pack(magnitude, hi.exponent - 55, magnitude ? hi.sign : 0n);
}
function multiply(a, b) {
  const x = decoded(a), y = decoded(b), sign = x.sign ^ y.sign;
  if (x.special === 'nan' || y.special === 'nan' || x.special && y.zero || y.special && x.zero) return NAN;
  if (x.special || y.special) return sign | EXP;
  if (x.zero || y.zero) return sign;
  return pack(x.m * y.m, x.exponent + y.exponent - 104, sign);
}
function divide(a, b) {
  const x = decoded(a), y = decoded(b), sign = x.sign ^ y.sign;
  if (x.special === 'nan' || y.special === 'nan' || x.special && y.special || x.zero && y.zero) return NAN;
  if (x.special || y.zero) return sign | EXP;
  if (y.special || x.zero) return sign;
  const numerator = x.m << 56n, q = numerator / y.m, r = numerator % y.m;
  return pack(q | (r ? 1n : 0n), x.exponent - y.exponent - 56, sign);
}
function integerSqrt(n) {
  let root = 0n, remainder = 0n;
  for (let i = 63; i >= 0; i--) {
    remainder = remainder << 2n | (n >> BigInt(2 * i) & 3n);
    const trial = root << 2n | 1n;
    root <<= 1n;
    if (remainder >= trial) { remainder -= trial; root |= 1n; }
  }
  return {root, remainder};
}
function sqrt(a) {
  const x = decoded(a); if (x.zero) return a;
  if (x.special === 'nan' || x.sign) return NAN;
  if (x.special) return a;
  let {m, exponent} = x; if (exponent % 2) { m <<= 1n; exponent--; }
  const {root, remainder} = integerSqrt(m << 60n);
  return pack(root | (remainder ? 1n : 0n), exponent / 2 - 56);
}
function toF32(a) {
  const x = decoded(a), sign = Number(x.sign >> 32n);
  if (x.special) return (sign | 0x7f800000 | (x.special === 'nan' ? 0x400000 : 0)) >>> 0;
  if (x.zero) return sign;
  const scale = x.exponent - 52, shift = Math.max(29, -149 - scale);
  let q = roundedShift(x.m, shift); if (!q) return sign;
  const length = bitLength(q), exponent = scale + shift + length - 1;
  if (exponent > 127) return (sign | 0x7f800000) >>> 0;
  if (exponent < -126) return (sign | Number(q)) >>> 0;
  if (length > 24) q >>= BigInt(length - 24);
  return (sign | (exponent + 127) << 23 | Number(q & 0x7fffffn)) >>> 0;
}
function fromF32(a) {
  const sign = BigInt(a >>> 31) << 63n, field = a >>> 23 & 255, fraction = BigInt(a & 0x7fffff);
  if (field === 255) return sign | EXP | (fraction ? 1n << 51n : 0n);
  return pack(fraction | (field ? 1n << 23n : 0n), field ? field - 150 : -149, sign);
}
const binary = fn => (a, b) => words(fn(bits(a), bits(b)));
// Independent CPU-side integer model for test oracles and wire inspection only.
// The resident evaluator must call generated WGSL, never this object as fallback.
export const sourceNumberReference = Object.freeze({
  add: binary(add), sub: binary((a,b) => add(a,b ^ SIGN)), mul: binary(multiply), div: binary(divide),
  sqrt: a => words(sqrt(bits(a))), neg: a => words(bits(a) ^ SIGN), abs: a => words(bits(a) & ~SIGN),
  fromF32: a => words(fromF32(a >>> 0)), toF32: a => toF32(bits(a)),
  finite: a => ((a[1] >>> 20) & 2047) !== 2047,
  eq: (a,b) => wordsNumber(a) === wordsNumber(b), lt: (a,b) => wordsNumber(a) < wordsNumber(b)
});

export function generateSourceNumberWGSL() { return /* wgsl */ `
// Binary64 carried as (least significant word, most significant word).
alias RcF64 = vec2<u32>;
alias RcU128 = vec4<u32>;
struct RcDecoded64 { m: RcU128, exponent: i32, sign: u32, special: u32, zero: bool }
struct RcDiv128 { quotient: RcU128, remainder: RcU128 }
fn rc_u128_zero(a: RcU128) -> bool { return all(a == RcU128(0u)); }
fn rc_u128_lt(a: RcU128, b: RcU128) -> bool {
  for (var i=4u; i>0u; i--) { let k=i-1u; if(a[k]!=b[k]) { return a[k]<b[k]; } } return false;
}
fn rc_u128_add(a: RcU128, b: RcU128) -> RcU128 {
  var r=RcU128(0u); var carry=0u;
  for(var i=0u;i<4u;i++) { let s=a[i]+b[i]; let t=s+carry; r[i]=t; carry=select(0u,1u,s<a[i] || t<s); } return r;
}
fn rc_u128_sub(a: RcU128, b: RcU128) -> RcU128 {
  var r=RcU128(0u); var borrow=0u;
  for(var i=0u;i<4u;i++) { let d=a[i]-b[i]; r[i]=d-borrow; borrow=select(0u,1u,a[i]<b[i] || d<borrow); } return r;
}
fn rc_u128_shl(a: RcU128, n: u32) -> RcU128 {
  if(n>=128u) { return RcU128(0u); } if(n==0u) { return a; }
  var r=RcU128(0u); let whole=n/32u; let part=n%32u;
  for(var i=0u;i<4u;i++) { if(i>=whole) { r[i]=a[i-whole]<<part; if(part>0u && i>whole) { r[i]|=a[i-whole-1u]>>(32u-part); } } } return r;
}
fn rc_u128_shr(a: RcU128, n: u32) -> RcU128 {
  if(n>=128u) { return RcU128(0u); } if(n==0u) { return a; }
  var r=RcU128(0u); let whole=n/32u; let part=n%32u;
  for(var i=0u;i<4u;i++) { if(i+whole<4u) { r[i]=a[i+whole]>>part; if(part>0u && i+whole+1u<4u) { r[i]|=a[i+whole+1u]<<(32u-part); } } } return r;
}
fn rc_u128_bit(a: RcU128, n:u32) -> u32 { if(n>=128u) { return 0u; } return (a[n/32u]>>(n%32u))&1u; }
fn rc_u128_blen(a: RcU128) -> u32 { for(var i=4u;i>0u;i--) { let k=i-1u; if(a[k]!=0u) { return k*32u+32u-countLeadingZeros(a[k]); } } return 0u; }
fn rc_u128_jam(a:RcU128,n:u32) -> RcU128 {
  var q=rc_u128_shr(a,n); if(any(a != rc_u128_shl(q,n))) { q.x|=1u; } return q;
}
fn rc_u128_round(a:RcU128,n:i32) -> RcU128 {
  if(n<=0) { return rc_u128_shl(a,u32(-n)); }
  var q=rc_u128_shr(a,u32(n));
  let half=rc_u128_bit(a,u32(n-1));
  var lower=false;
  if(n>1) { lower=any(a != rc_u128_shl(rc_u128_shr(a,u32(n-1)),u32(n-1))); }
  if(half!=0u && (lower || (q.x&1u)!=0u)) { q=rc_u128_add(q,RcU128(1u,0u,0u,0u)); } return q;
}
fn rc_f64_pack(m:RcU128,scale:i32,sign:u32) -> RcF64 {
  if(rc_u128_zero(m)) { return RcF64(0u,sign); }
  let shift=max(i32(rc_u128_blen(m))-53,-1074-scale);
  var q=rc_u128_round(m,shift); if(rc_u128_zero(q)) { return RcF64(0u,sign); }
  let length=rc_u128_blen(q); let exponent=scale+shift+i32(length)-1;
  if(exponent>1023) { return RcF64(0u,sign|0x7ff00000u); }
  if(exponent < -1022) { return RcF64(q.x,sign|q.y); }
  if(length>53u) { q=rc_u128_shr(q,length-53u); } else if(length<53u) { q=rc_u128_shl(q,53u-length); }
  return RcF64(q.x,sign|(u32(exponent+1023)<<20u)|(q.y&0xfffffu));
}
fn rc_f64_decode(a:RcF64) -> RcDecoded64 {
  let field=(a.y>>20u)&2047u; let sign=a.y&0x80000000u;
  var m=RcU128(a.x,a.y&0xfffffu,0u,0u);
  if(field==2047u) { return RcDecoded64(m,0,sign,select(1u,2u,!rc_u128_zero(m)),false); }
  if(field==0u && rc_u128_zero(m)) { return RcDecoded64(m,-1022,sign,0u,true); }
  var exponent=-1022; if(field!=0u) { exponent=i32(field)-1023; m.y|=0x100000u; }
  for(var i=0u;i<52u && (m.y&0x100000u)==0u;i++) { m=rc_u128_shl(m,1u); exponent--; }
  return RcDecoded64(m,exponent,sign,0u,false);
}
fn rc_f64_nan() -> RcF64 { return RcF64(0u,0x7ff80000u); }
fn rc_f64_finite(a:RcF64) -> bool { return (a.y&0x7ff00000u)!=0x7ff00000u; }
fn rc_f64_zero(a:RcF64) -> bool { return a.x==0u && (a.y&0x7fffffffu)==0u; }
fn rc_f64_abs(a:RcF64) -> RcF64 { return RcF64(a.x,a.y&0x7fffffffu); }
fn rc_f64_neg(a:RcF64) -> RcF64 { return RcF64(a.x,a.y^0x80000000u); }
fn rc_f64_eq(a:RcF64,b:RcF64) -> bool {
  if(rc_f64_decode(a).special==2u || rc_f64_decode(b).special==2u) { return false; }
  return all(a==b) || (rc_f64_zero(a)&&rc_f64_zero(b));
}
fn rc_f64_lt(a:RcF64,b:RcF64) -> bool {
  if(rc_f64_decode(a).special==2u || rc_f64_decode(b).special==2u || rc_f64_eq(a,b)) { return false; }
  let sa=a.y>>31u; let sb=b.y>>31u; if(sa!=sb) { return sa!=0u; }
  let less=a.y<b.y || (a.y==b.y && a.x<b.x); return select(less,!less,sa!=0u);
}
fn rc_f64_le(a:RcF64,b:RcF64) -> bool { return rc_f64_eq(a,b) || rc_f64_lt(a,b); }
fn rc_f64_add(a:RcF64,b:RcF64) -> RcF64 {
  var x=rc_f64_decode(a); var y=rc_f64_decode(b);
  if(x.special==2u || y.special==2u) { return rc_f64_nan(); }
  if(x.special!=0u || y.special!=0u) { if(x.special!=0u && y.special!=0u && x.sign!=y.sign) { return rc_f64_nan(); } return select(b,a,x.special!=0u); }
  if(x.zero && y.zero) { return RcF64(0u,x.sign&y.sign); } if(x.zero) { return b; } if(y.zero) { return a; }
  if(x.exponent<y.exponent || (x.exponent==y.exponent && rc_u128_lt(x.m,y.m))) { let temp=x; x=y; y=temp; }
  let hm=rc_u128_shl(x.m,3u); let lm=rc_u128_jam(rc_u128_shl(y.m,3u),u32(x.exponent-y.exponent));
  var m=rc_u128_add(hm,lm); if(x.sign!=y.sign) { m=rc_u128_sub(hm,lm); }
  // Exact cancellation is positive zero in nearest-even mode.
  return rc_f64_pack(m,x.exponent-55,select(x.sign,0u,rc_u128_zero(m)));
}
fn rc_f64_sub(a:RcF64,b:RcF64) -> RcF64 { return rc_f64_add(a,rc_f64_neg(b)); }
fn rc_u128_mul(a:RcU128,b:RcU128) -> RcU128 {
  var r=RcU128(0u); for(var i=0u;i<rc_u128_blen(b);i++) { if(rc_u128_bit(b,i)!=0u) { r=rc_u128_add(r,rc_u128_shl(a,i)); } } return r;
}
fn rc_f64_mul(a:RcF64,b:RcF64) -> RcF64 {
  let x=rc_f64_decode(a); let y=rc_f64_decode(b); let sign=x.sign^y.sign;
  if(x.special==2u || y.special==2u || (x.special!=0u && y.zero) || (y.special!=0u && x.zero)) { return rc_f64_nan(); }
  if(x.special!=0u || y.special!=0u) { return RcF64(0u,sign|0x7ff00000u); }
  if(x.zero || y.zero) { return RcF64(0u,sign); }
  return rc_f64_pack(rc_u128_mul(x.m,y.m),x.exponent+y.exponent-104,sign);
}
fn rc_u128_div(a:RcU128,b:RcU128) -> RcDiv128 {
  var q=RcU128(0u); var r=RcU128(0u);
  for(var i=rc_u128_blen(a);i>0u;i--) {
    r=rc_u128_shl(r,1u); r.x|=rc_u128_bit(a,i-1u);
    if(!rc_u128_lt(r,b)) { r=rc_u128_sub(r,b); let k=i-1u; q[k/32u]|=1u<<(k%32u); }
  } return RcDiv128(q,r);
}
fn rc_f64_div(a:RcF64,b:RcF64) -> RcF64 {
  let x=rc_f64_decode(a); let y=rc_f64_decode(b); let sign=x.sign^y.sign;
  if(x.special==2u || y.special==2u || (x.special!=0u && y.special!=0u) || (x.zero && y.zero)) { return rc_f64_nan(); }
  if(x.special!=0u || y.zero) { return RcF64(0u,sign|0x7ff00000u); }
  if(y.special!=0u || x.zero) { return RcF64(0u,sign); }
  let d=rc_u128_div(rc_u128_shl(x.m,56u),y.m); var q=d.quotient; if(!rc_u128_zero(d.remainder)) { q.x|=1u; }
  return rc_f64_pack(q,x.exponent-y.exponent-56,sign);
}
fn rc_f64_sqrt(a:RcF64) -> RcF64 {
  var x=rc_f64_decode(a); if(x.zero) { return a; }
  if(x.special==2u || x.sign!=0u) { return rc_f64_nan(); } if(x.special!=0u) { return a; }
  if((x.exponent&1)!=0) { x.m=rc_u128_shl(x.m,1u); x.exponent--; }
  let n=rc_u128_shl(x.m,60u); var root=RcU128(0u); var r=RcU128(0u);
  for(var i=64u;i>0u;i--) {
    let k=2u*(i-1u); r=rc_u128_shl(r,2u); r.x|=rc_u128_bit(n,k)|(rc_u128_bit(n,k+1u)<<1u);
    var trial=rc_u128_shl(root,2u); trial.x|=1u; root=rc_u128_shl(root,1u);
    if(!rc_u128_lt(r,trial)) { r=rc_u128_sub(r,trial); root.x|=1u; }
  }
  if(!rc_u128_zero(r)) { root.x|=1u; }
  return rc_f64_pack(root,x.exponent/2-56,0u);
}
fn rc_f64_from_u32(a:u32) -> RcF64 { return rc_f64_pack(RcU128(a,0u,0u,0u),0,0u); }
fn rc_f64_from_f32_bits(a:u32) -> RcF64 {
  let sign=a&0x80000000u; let field=(a>>23u)&255u; let fraction=a&0x7fffffu;
  if(field==255u) { return RcF64(0u,sign|0x7ff00000u|select(0u,0x80000u,fraction!=0u)); }
  return rc_f64_pack(RcU128(fraction|select(0u,0x800000u,field!=0u),0u,0u,0u),select(-149,i32(field)-150,field!=0u),sign);
}
fn rc_f64_to_f32_bits(a:RcF64) -> u32 {
  let x=rc_f64_decode(a); if(x.special!=0u) { return x.sign|0x7f800000u|select(0u,0x400000u,x.special==2u); } if(x.zero) { return x.sign; }
  let scale=x.exponent-52; let shift=max(29,-149-scale); var q=rc_u128_round(x.m,shift);
  if(rc_u128_zero(q)) { return x.sign; } let length=rc_u128_blen(q); let exponent=scale+shift+i32(length)-1;
  if(exponent>127) { return x.sign|0x7f800000u; } if(exponent < -126) { return x.sign|q.x; }
  if(length>24u) { q=rc_u128_shr(q,length-24u); } return x.sign|(u32(exponent+127)<<23u)|(q.x&0x7fffffu);
}
`; }
