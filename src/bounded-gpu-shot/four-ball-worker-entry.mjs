// SPDX-License-Identifier: Apache-2.0
import {installWorkerHost} from './four-ball-worker-host.mjs';
import {initializeWorkerGpu} from './four-ball-worker-bootstrap.mjs';
if (typeof DedicatedWorkerGlobalScope !== 'function' || !(globalThis instanceof DedicatedWorkerGlobalScope))
  throw new Error('The bounded GPU entry must run in one dedicated worker realm');
installWorkerHost(globalThis, initializeWorkerGpu);
