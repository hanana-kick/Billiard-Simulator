// SPDX-License-Identifier: Apache-2.0
// Borrowed-device variant for the same explicit bounded evaluation API.
// Initialize the trusted runtime as required by four-ball.mjs before calling.
import {createCurrentSourceFourBallShotService} from './four-ball.mjs';
import {createEvaluationQueue} from './evaluation-queue.mjs';
import {exactKeys} from './four-ball-worker-protocol.mjs';
export function createBoundedFourBallEvaluationService(options) {
  exactKeys(options, ['device', 'decoder', 'scheduling', 'onProgress'], 'Evaluation service accepts device, decoder, scheduling and onProgress only');
  const {onProgress, ...serviceOptions} = options;
  if (onProgress != null && typeof onProgress !== 'function') throw new TypeError('onProgress must be a function');
  const service = createCurrentSourceFourBallShotService(serviceOptions);
  return createEvaluationQueue({...service, ready: Promise.resolve({status: 'ready', capability: service.capability}),
    deviceLost: options.device.lost}, {onProgress});
}
