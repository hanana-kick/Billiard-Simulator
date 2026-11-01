// SPDX-License-Identifier: Apache-2.0
// Explicit opt-in. Creating this client never changes the product backend.
import {createWorkerClientTransport} from './four-ball-worker-transport.mjs';
export function createBoundedFourBallWorkerClient(options = {}) {
  if (!options || Object.keys(options).some(k => k !== 'onProgress'))
    throw new TypeError('Worker client accepts optional onProgress only');
  if (options.onProgress != null && typeof options.onProgress !== 'function')
    throw new TypeError('onProgress must be a function');
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('Secure worker context required; no CPU fallback');
  if (typeof Worker !== 'function') throw new Error('Dedicated workers unavailable; no CPU fallback');
  const worker = new Worker(new URL('./four-ball-worker-entry.mjs', import.meta.url),
    {type: 'module', name: 'experimental-bounded-four-ball-gpu'});
  return createWorkerClientTransport(worker, options);
}
