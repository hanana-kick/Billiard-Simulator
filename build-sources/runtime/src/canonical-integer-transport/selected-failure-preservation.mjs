const ownedPrimaryFailures=new WeakMap();
/** Keep the original execution failure visible when a concurrent guard also rejects.
 * Neither failure is converted into a benign stale-result receipt. */
export function preserveSelectedFailure(primary, secondary, phase, secondaryIsOwnedStale=false) {
  if (primary === secondary) return primary;
  const message = primary instanceof Error ? primary.message : String(primary);
  const failure = new AggregateError([primary, secondary], `${message} (also ${phase})`, {cause: primary});
  failure.primaryError = primary; if(secondaryIsOwnedStale===true)ownedPrimaryFailures.set(failure,primary);
  if (typeof primary?.code === 'string') failure.code = primary.code;
  return failure;
}

export function selectedPrimaryFailure(error){while(error&&ownedPrimaryFailures.has(error))error=ownedPrimaryFailures.get(error);return error;}
