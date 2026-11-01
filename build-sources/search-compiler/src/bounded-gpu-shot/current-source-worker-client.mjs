// SPDX-License-Identifier: Apache-2.0
// Explicit opt-in; no product gameplay/search backend is selected here.
import {createWorkerClientTransport} from './four-ball-worker-transport.mjs';
import {copyCurrentSourceWorkerInput, exactKeys} from './four-ball-worker-protocol.mjs';
export function createCurrentSourceFourBallWorkerClient(options = {}) {
  exactKeys(options, ['onProgress'], 'Current-source worker accepts onProgress only');
  if (options.onProgress != null && typeof options.onProgress !== 'function') throw new TypeError('onProgress must be a function');
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('Secure worker context required; no CPU fallback');
  if (typeof Worker !== 'function') throw new Error('Dedicated workers unavailable; no CPU fallback');
  const worker = new Worker(new URL('./current-source-worker-entry.mjs', import.meta.url),
    {type: 'module', name: 'experimental-current-source-four-ball-gpu'});
  return createWorkerClientTransport(worker, {...options, copyInput: copyCurrentSourceWorkerInput});
}
