# Optional microtail source trace

`deterministic-microtail-trace.mjs` evaluates the **original encoded microtail
recipe**, not a trajectory inferred from the final state. It does not change
world acceptance, compact results, shader numerics, defaults, or app wiring.

`packMicrotailTraceSource` takes the original 32-word microtail input, 16-word
cloth, 160-word context, accepted 96-word microtail and 96-word residual-fraction
outputs, original start Q20 tick, and stable body ID (distinct from an internal
slot ID). Both accepted outputs must match their original source evaluation
word for word. The existing checked contact arithmetic evaluates the same
finite bounce recurrence. Its aggregate p/v/q, quantization error, normal and
tangential impulses, and rational duration must exactly equal the accepted
producer output before a trace source can be returned.

The 12-word header plus original source/outputs uses 412 words. Each impact is
12 words: exact relative seconds numerator, nine p/v/q words, and two tangential
impulse words. The denominator is original encoded gravity. Since initial
normal speed is at most 127 quanta and restitution is strictly below one, the
encoded speed decreases by at least one quantum each impact: at most 127 records.
Thus a packet uses at most **1936 u32 words**, fitting one SST1 source payload.
No floating or rounded per-impact clock is substituted for the rational time.

`sampleMicrotailTraceSource(packet, {numerator, denominator, side})` accepts exact
rational seconds relative to the original start. Integer Q20 time is represented
as `{numerator: tick - packet[2], denominator: 2**20}`. It returns:

- the original start state;
- exact quantized post-impact recurrence states at matching rational times;
- the accepted residual-fraction endpoint at the common integer end tick;
- explicit unsupported for intra-flight, intra-fraction, and uncaptured
  pre-impact queries, never linear or invented ballistic interpolation.

The original source exposes swept bounds but does not define a packed point
sampler for those interiors. Merely possessing an analytic physical description
would not justify claiming an exact encoded source sample. Source validation is
structural during sampling; a transported packet must pass
`revalidateMicrotailTraceSource`, which re-establishes exact source/output/event
consistency. Sampling is a single body's microtail component: full-roster common
clock composition and source-owned world capture remain the world owner's job.
No native resident trace implementation or full-shot trace is claimed here.

Validation: `node --test tests/deterministic-microtail-trace.mjs` passes 3 tests,
covering 508 original accepted configurations (every speed 1..127, four encoded
restitutions), over 8000 rational boundary samples, exact fractional endpoint,
full qy, arbitrary stable ID, unchanged source ownership, and tampering refusal.
