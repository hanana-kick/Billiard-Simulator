'use strict';
// Native Dawn's root/adapter/device wrappers stay strongly reachable until the
// last awaited test dispatch finishes. This changes no physics or assertions.
const owners = globalThis.__billiardNativeTestGpuOwners ??= new Set();
function retain(gpu, adapter, device, label) {
  const owner = {gpu, adapter, device, label}; owners.add(owner);
  const record = phase => console.error(JSON.stringify({nativeGpuLifetime: label, phase, memory: process.memoryUsage()}));
  record('retained');
  const timer = setInterval(() => record('running'), 60000); timer.unref();
  const listener = event => console.error(JSON.stringify({nativeGpuError: label, message: String(event.error?.message ?? event.error)}));
  device.addEventListener?.('uncapturederror', listener);
  return () => { clearInterval(timer); device.removeEventListener?.('uncapturederror', listener); device.destroy(); owners.delete(owner); record('released'); };
}
module.exports = {retain};
