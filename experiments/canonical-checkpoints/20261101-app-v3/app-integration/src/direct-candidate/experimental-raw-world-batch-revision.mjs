/** Host scheduling domains only. Both revisions use the SAME 0850a4d shader pins.
 * The extended domain must be explicitly requested; it does not import newer
 * cushion/kiss physics and does not change the default66-prefix bound. */
export const RAW_WORLD_BATCH_REVISIONS=Object.freeze({'0850a4d':66,'0850a4d+host128-v1':128});
export function rawWorldBatchPrefixLimit(revision='0850a4d'){
 if(!Object.hasOwn(RAW_WORLD_BATCH_REVISIONS,revision))throw RangeError('Explicit reviewed raw-world pipeline revision');
 return RAW_WORLD_BATCH_REVISIONS[revision];
}
