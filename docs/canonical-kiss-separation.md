# Same-descriptor kiss separation evidence

`canonical-kiss-separation.mjs` is a bounded, opt-in query over original admitted
REST/SMT2/FLIGHT descriptors. It does not enable global KISS capability, change
physics, reconstruct a trajectory with new coefficients, or infer a whole shot's
coverage from endpoints.

## Exact threshold

The source kiss separation condition is a surface gap strictly greater than
1/20000 m. With Q24 positions and summed radii R, compare

`20000² × squared_distance` against `(20000 × R + 2²⁴)²`.

CPU and WGSL use matching three-u32 arithmetic. No rounded epsilon, square-root
approximation or float64 emulation is needed. Under the admitted ±4m position and
radius≤1m descriptor domain, intermediate magnitudes fit96 bits. The CPU test uses
BigInt only as an independent exact oracle, not the runtime implementation.

## What the query establishes

Only previously seen, currently active cue/object pairs require a separation
transition. For each such pair, the query evaluates the original outward position
bounds and performs bounded subdivision:

- A certified point or interval lower distance above the threshold supplies a
  genuine separation witness and its canonical tick.
- If every cell's upper distance is at/below the threshold, separation never
  happened over that interval and the pair remains active.
- Unresolved one-tick cells, unsupported bounds or work exhaustion remain unresolved
  unless a genuine witness is subsequently found. No absence of a witness is
  treated as proof of continued contact.

An interior-excursion regression has both endpoints close but a separated midpoint;
endpoint-only reasoning would be wrong. The query finds the midpoint witness.
A witness need not be the very first crossing only when the complete interval has
been proved to contain no further impulse. Under that condition, earlier/later
separation observations are equivalent for the active-pair state before the next
impact. This is not permission to move an observation past an impact or a published
coverage boundary.

`runKissSeparationQueryCPU` supplies geometric evidence only and always reports
coverage false. `runClearSeparationPrefixCPU` separately executes the full
same-descriptor scene query and requires it to be clear before reporting interval
coverage. A genuine upcoming collision blocks that coverage even if a separation
witness exists earlier. GPU `encodeClear` runs that actual query, separation query,
and clear gate in resident dispatches with no intermediate readback. The caller
must use descriptors prepared from the owned motion producer and derive activeMask
from its actual kiss state, not accept either as a caller-authored certificate.

Existing solved-pair release word14 proves only distance>summed radii. It is not a
1/20000m separation certificate. Post-impact intervals beginning in contact need a
proper owned monotone-release/no-new-impulse adapter; this module does not silently
reinterpret an uncleared query as a solved release.

## Positive-impulse coupling

`committedPairKissSampleCPU` / GPU `encodeImpulse` consume the actual qualified pair
entry, accepted 3D response, and matching world commit slots/clock. A cue/object
KISS_SAMPLE impact observation is produced only when signed response word20, the
normal impulse, is positive. A geometry candidate or contact label is insufficient.
All-body non-cue collisions are ignored by this cue-pair tracker, not by gameplay.
Sequence0 in the returned observation is deliberately a placeholder: the owning
journal must assign chronological sequence when inserting it before the associated
PAIR event. This translator cannot attest that arbitrary supplied buffers came
from the same producer; only the owning execution composition can.

## ABI and remaining integration

The80-word separation output has version/status/cue/mask/start/end in0–5, witness
mask6, no-separation mask7, visited cells8, and actual clear-query acceptance9.
Four16-word per-body rows start at16: slot, status, relative witness tick, visited
cells, absolute witness tick. Per-body status1 witness,2 never separated,4 invalid,
5 budget,6 unresolved. Inactive rows have status0. Missing witness ticks are−1u.

Original rolling and bridge motion bounds are not yet admitted here. Full KISS
capability remains off until every accepted motion interval and all positive
impulses are bound and covered. Initial raw no-contact prefix and terminal rest
also need explicit coverage publication. CER coverage currently begins at tick0;
nonzero absolute shot starts require a consistent shot-relative rule clock or an
explicit origin extension, never invented pre-shot coverage. Previously published
intervals cannot receive retroactive samples. Late kisses affect search only before
its goal freeze; late opponent contacts still affect gameplay through full rest.

## Validation checkpoint

Native5/5: seven descriptor fixtures at two work caps, with separation and actual
full-scene clear-query gates plus three impulse observations,17,060 CPU/GPU words
identical. Exact threshold arithmetic also passes10,000 independent BigInt oracle
comparisons. Interior-excursion, ambiguous threshold, future collision, invalid
motion and work-limit cases are covered. Whole-shot KISS capability remains off.

The first native attempt exceeded the1500MiB compiler guard. Refactoring the same
bounded search into one bounds-evaluation call site per stack step removed duplicated
shader lowering, without loosening bounds or threshold. Verified retry29.896s,
sampled aggregate RSS687.48MiB, max child RSS647.81MiB. SwiftShader software Vulkan;
not physical GPU throughput or VRAM. The stack is64 cells (original horizon≤65535),
and every point/interval evaluation counts against the declared per-pair node cap.
