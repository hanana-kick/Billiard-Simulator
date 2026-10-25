// SPDX-License-Identifier: Apache-2.0
// Local, explicit opt-in evaluation of a bounded copied list. No search hook,
// product backend switch, implicit CPU replay, or parallel-shot speed claim.
import {createCurrentSourceFourBallWorkerClient} from './current-source-worker-client.mjs';
import {createEvaluationQueue} from './evaluation-queue.mjs';
import {exactKeys} from './four-ball-worker-protocol.mjs';
export {EVALUATION_CAPABILITY} from './evaluation-queue.mjs';
export {EVALUATION_LIMITS} from './evaluation-input.mjs';
export function createBoundedFourBallEvaluationClient(options = {}) {
  exactKeys(options, ['onProgress'], 'Evaluation client accepts onProgress only');
  if (options.onProgress != null && typeof options.onProgress !== 'function') throw new TypeError('onProgress must be a function');
  return createEvaluationQueue(createCurrentSourceFourBallWorkerClient(), options);
}
