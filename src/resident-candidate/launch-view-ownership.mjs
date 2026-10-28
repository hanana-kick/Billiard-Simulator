/* Construction-only structural audit, not a runtime/profile ownership token.
 * Frozen metadata cannot replace a reference after this audit. Mutable launch
 * words must be exactly the sealed runtime's views, whose contents/span/detach
 * checks remain the runtime owner's responsibility at every admission boundary.
 */
import {isOwnedUint32Array} from './abi.mjs';
const typed=Object.getPrototypeOf(Uint32Array.prototype),get=k=>Object.getOwnPropertyDescriptor(typed,k).get;
const bufferOf=get('buffer'),offsetOf=get('byteOffset'),lengthOf=get('byteLength');
const need=(ok,message)=>{if(!ok)throw new RangeError('Launch view ownership: '+message);};
function visitFrozen(root,onView){
 const seen=new WeakSet();const visit=value=>{if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
  if(ArrayBuffer.isView(value)){need(isOwnedUint32Array(value)&&!Object.isExtensible(value),'non-shared nonextensible owned u32 view');new Uint8Array(bufferOf.call(value),offsetOf.call(value),lengthOf.call(value));onView(value);return;}
  const proto=Object.getPrototypeOf(value);need(Object.isFrozen(value)&&(proto===Object.prototype||proto===null||Array.isArray(value)&&proto===Array.prototype),'frozen plain metadata');const descriptors=Object.getOwnPropertyDescriptors(value);for(const key of Reflect.ownKeys(descriptors)){need(typeof key==='string'&&Object.hasOwn(descriptors[key],'value'),'data properties without accessors/symbols');visit(descriptors[key].value);}
 };visit(root);
}
/** Pure graph relationship check only. Equal bytes/backing stores are not view
 * identity, and passing this function never grants a production WeakMap brand. */
export function assertImmutableRuntimeViewAliases(launch,runtime){const runtimeViews=new WeakSet();visitFrozen(runtime,view=>runtimeViews.add(view));visitFrozen(launch,view=>need(runtimeViews.has(view),'every mutable launch view must be identity-equal to a runtime-owned view'));}
