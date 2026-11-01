/* SPDX-License-Identifier: Apache-2.0 */
import {installResidentWorkerHost} from './worker-host.mjs';
import {initializeResidentWorker} from './worker-bootstrap.mjs';
if(typeof DedicatedWorkerGlobalScope!=='function'||!(globalThis instanceof DedicatedWorkerGlobalScope))throw new Error('Resident entry requires a dedicated module Worker');
installResidentWorkerHost(globalThis,initializeResidentWorker);
