/** Preserve the operation failure as primary; cleanup failure never implies a verified retirement. */
const owned=new WeakMap();
export const isOwnedCleanupFailure=error=>!!error&&typeof error==='object'&&owned.has(error);
export function withCleanupFailure(primary,cleanup,stage){
 const previous=primary&&typeof primary==='object'?owned.get(primary):null;
 const first=previous?.primary??primary,failures=Object.freeze([...(previous?.failures??[]),Object.freeze({stage:String(stage),message:String(cleanup?.message??cleanup)})]);
 const message=String(first?.message??first)+'\n정리 실패 · 완료 미확인: '+failures.map(f=>f.stage+': '+f.message).join('; ');
 const error=new AggregateError([primary,cleanup],message,{cause:primary});
 error.primaryFailure=first;error.cleanupFailures=failures;error.cleanupVerified=false;
 if(primary?.deviceLoss??first?.deviceLoss)error.deviceLoss=primary?.deviceLoss??first.deviceLoss;
 if(primary?.gpuPreparation??first?.gpuPreparation)error.gpuPreparation=primary?.gpuPreparation??first.gpuPreparation;
 owned.set(error,{primary:first,failures});return error;
}
