// SPDX-License-Identifier: Apache-2.0
// All configuration comes from bundled build assets, NEVER operation messages.
import {createSnapshotDecoder} from '../../tools/rapier-snapshot-decoder/browser.mjs';
import {loadWorkerRuntime} from './four-ball-worker-runtime.mjs';
async function bundled(name, json = false) {
  const response = await fetch(new URL(name, import.meta.url), {credentials: 'same-origin'});
  if (!response.ok) throw new Error('Bundled worker asset unavailable: ' + name + ' (' + response.status + ')');
  return json ? response.json() : new Uint8Array(await response.arrayBuffer());
}
export async function initializeWorkerGpu({currentSource = false} = {}) {
  if (!globalThis.navigator?.gpu) return {status: 'unsupported', reason: 'worker-webgpu-unavailable'};
  // Standard default query only. No flags, fallback adapter or CPU substitution.
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return {status: 'unsupported', reason: 'worker-webgpu-adapter-unavailable'};
  const device = await adapter.requestDevice(); let service;
  try {
    const build = await bundled('four-ball-worker-assets.json', true);
    if (build.schema !== 'bounded-four-ball-worker-assets-v1') throw new TypeError('Build-pinned worker assets required');
    const decoder = await createSnapshotDecoder({engineVersion: '0.21.0', provenance: build.provenance,
      expectedWasmSha256: build.expectedWasmSha256,
      engineBytes: await bundled('four-ball-worker-engine.bin'), wasmBytes: await bundled('four-ball-worker-decoder.wasm')});
    const runtime = await loadWorkerRuntime();
    service = currentSource ? runtime.createCurrentSourceFourBallShotService({device, decoder}) :
      runtime.createBoundedFourBallShotService({device, decoder});
    return {service, deviceLost: device.lost, dispose() {device.destroy();}};
  } catch (error) {
    await service?.dispose(); device.destroy(); throw error;
  }
}
