// SPDX-License-Identifier: Apache-2.0
import {installWorkerHost} from './four-ball-worker-host.mjs';
import {initializeWorkerGpu} from './four-ball-worker-bootstrap.mjs';
import {copyCurrentSourceWorkerInput} from './four-ball-worker-protocol.mjs';
if (typeof DedicatedWorkerGlobalScope !== 'function' || !(globalThis instanceof DedicatedWorkerGlobalScope))
  throw new Error('The current-source GPU entry requires one dedicated worker realm');
installWorkerHost(globalThis, () => initializeWorkerGpu({currentSource: true}),
  {copyInput: copyCurrentSourceWorkerInput});
