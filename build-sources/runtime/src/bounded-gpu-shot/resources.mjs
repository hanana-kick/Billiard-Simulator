// SPDX-License-Identifier: Apache-2.0
// Internal native-resource ownership. No shaders, physics, or backend selection.
// Track actual native buffers, including a stage whose async constructor rejects
// before the world's normal owned-stage list can take responsibility for it.
export function createGpuResourceScope(device) {
  const refs = new Set(); let created = 0, destroyed = 0, collectedCount = 0, peak = 0;
  const collected = new FinalizationRegistry(ref => {
    if (refs.delete(ref)) collectedCount++;
  });
  const forget = (ref, kind) => {
    collected.unregister(ref);
    if (refs.delete(ref)) { if (kind === 'destroyed') destroyed++; else collectedCount++; }
  };
  const scoped = new Proxy(device, {get(target, property) {
    if (property === 'createBuffer') return descriptor => {
      const buffer = device.createBuffer(descriptor), ref = new WeakRef(buffer);
      refs.add(ref); created++; peak = Math.max(peak, refs.size);
      collected.register(buffer, ref, ref);
      // Only this operation's newly allocated native object is wrapped. Keep
      // the real GPUBuffer (not a proxy) for WebGPU bind-group type checking.
      const destroy = buffer.destroy.bind(buffer);
      try { Object.defineProperty(buffer, 'destroy', {configurable: true, value() {
        destroy(); forget(ref, 'destroyed');
      }}); } catch { /* Nonextensible implementations retain weak cleanup tracking. */ }
      return buffer;
    };
    if (property === 'destroy') return () => { throw new Error('Borrowed GPUDevice must not be destroyed'); };
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  }});
  return {device: scoped,
    snapshot: () => ({buffersCreated: created, buffersDestroyed: destroyed,
      buffersCollected: collectedCount, trackedBuffers: refs.size, peakTrackedBuffers: peak}),
    dispose() {
      let failure = null;
      for (const ref of refs) {
        const buffer = ref.deref();
        try { buffer?.destroy(); forget(ref, buffer ? 'destroyed' : 'collected'); }
        catch (e) { failure ??= new Error(String(e?.message ?? e)); }
      }
      if (failure) throw failure;
    }};
}
