/** Portable structural digest. Definition references use exact canonical shader,
 * layout, entrypoint and constants hashes, independent of definition numbering.
 * Every ordered command, binding view and allocation remains in the digest.
 */
import {createHash} from 'node:crypto';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const encode=x=>JSON.stringify(canonical(x));
const hash=x=>createHash('sha256').update(encode(x)).digest('hex');
export function supportedClearGraphDigest({definitions,commands,allocations}){
 const signatures=definitions.map(hash),h=createHash('sha256');h.update('supported-clear-canonical-graph-v1\n');h.update(encode(signatures.slice().sort())+'\n');h.update(encode(allocations)+'\n');
 for(const c of commands)h.update(encode(c.kind==='dispatch'?{...c,definition:signatures[c.definition]}:c)+'\n');
 return h.digest('hex');
}
