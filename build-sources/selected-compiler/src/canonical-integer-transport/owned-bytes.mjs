/** Copy caller bytes before any await using trusted intrinsics. Typed-array
 * subclasses, shared storage and shadowed view metadata are not admission data. */
const prototype=Uint8Array.prototype;
export function snapshotOwnedBytes(value,maximum){
 if(!(value instanceof Uint8Array)||Object.getPrototypeOf(value)!==prototype||['buffer','byteOffset','byteLength','length','slice','subarray',Symbol.iterator].some(k=>Object.hasOwn(value,k))||!(value.buffer instanceof ArrayBuffer)||!Number.isSafeInteger(maximum)||maximum<1||value.byteLength<1||value.byteLength>maximum)throw TypeError('Plain bounded nonshared bytes required');
 const out=new Uint8Array(value.byteLength);Uint8Array.prototype.set.call(out,value);return out;
}
