/** Bounded scheduler ABI policy, matched against the actual bundled WASM.
 * INPUT and STREAM each hold this many u32 handles. Physics and submission
 * chunk size are unchanged; increasing both arrays adds 512 KiB per instance.
 */
export const WASM_GPU_COMMAND_CAPACITY = 131072;
export const WASM_GPU_MAX_CHUNK = 4096;
export function assertWasmGpuSchedulerLimits(exports) {
 if(typeof exports?.abi_version!=='function'||typeof exports?.capacity!=='function'||typeof exports?.max_chunk!=='function'||exports.abi_version()!==1||exports.capacity()!==WASM_GPU_COMMAND_CAPACITY||exports.max_chunk()!==WASM_GPU_MAX_CHUNK)throw Error('Scheduler ABI version/capacity/chunk mismatch');
 return exports;
}
