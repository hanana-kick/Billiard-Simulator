# Original inverse observation reducer: opt-in resident source port

**Boundary:** generated WGSL observation state, HOST source differential proof.
No GPU execution, world observation producer, convex query, terminal scorer join,
solver adapter, final-gameplay authority or default activation is implemented.
This is not a physical simulation and captured native frames are TEST inputs,
never proposed runtime future-state uploads.

## Source and numerical profile

The port follows `src/inverse-events.js`: `createObservation`, initial sample,
`sampleObservation`, `observeEpisodes`, `reduceSubstep`, `consume`, and the
observation-only fields of `projectResult`. The focused numerical test pins the
source section SHA256 and compares every retained helper AST against the original
`raw-strike.mjs` / `source-number.mjs` bodies. The exact profile is
`v8-13.6.233-fast-hypot-binary64-v1`, **not universal ECMAScript/browser parity**.

All source Number values use binary64 low/high u32 words. Arithmetic uses the
existing integer-backed, round-to-nearest/ties-even f64 operations; no f32, FMA,
vector dot or Euclidean-hypot replacement. Existing pinned V8 three-argument
hypot's scaling/compensation and its upstream license remain intact. The
relative-segment dot reductions start at +0 and preserve original multiply/add
order. Signed-zero residuals are retained. Finite vector/clock domains and safe
contact-cell quotients are checked; unsupported derived nonfinite geometry or
capacity never means an evaluated miss.

Contact-cell computation divides original `firstImpact.time / stepDt` first,
then performs exact positive finite safe-domain `Math.round` (including -0 and
ties). It does not use `floor(x + .5)`. Negative, nonfinite or larger-than-safe
quotients are unsupported with no scalar output payload. The original JSON cell
string is only serialized after these exact tuple values; JSON's own -0 behavior
is unchanged. Physical/scorer success cannot be inferred from a contact cell.

## Explicit flat contract

`inverse-observation-layout.mjs` exports:

- `createInverseObservationLayout({topology,objectIds,rails,eventCapacity,numberProfile})`
- `initializeInverseObservationState(layout, originalStartTime)`
- `packInverseObservationFrame(layout, frame)` (HOST initial/test packing only)
- `decodeInverseObservationState(layout, words)` (TEST/diagnostic inspection)

Topology has 1..64 original object/cushion stages. The fixed ordered roster admits
at most 8 distinct uint32 object IDs and the 4 original rail keys. These are
**capacity limits**, not claims of supported arbitrary worlds. Event tape capacity
is explicit 1..4096, default256; overflow reports unsupported, never truncates the
published event history. Unknown IDs/ranges, repeated roster keys, changed order,
invalid phase/clock and partial buffers are rejected.

The common config holds the exact topology and roster. A frame has a 24-word
header, followed by 12 words per target in source object-then-cushion order:

- original initial or after-world-step-before-application phase and sequence;
- original binary64 time, actual stepDt, cue position and radius;
- each sphere's original ID, position, radius and positive-impulse Boolean;
- each cushion's original rail ID, impulse Boolean, actual convex `projectPoint`
  presence/point/isInside. Null stays null; there is no ideal-plane substitute.

The state has a 64-word header, 12 words/stage, 2 words/target, 8 words/event slot.
It retains nullable stage residuals, map-presence and active episode flags,
repeat-stage gap/returning state, undefined/null/measurement distinction,
previous cue/target measurement, exact clocks, event prefix, first object impact,
ordered event tape and exact unexpected/ambiguous mismatch group.
For 2 stages, 3 spheres, 4 rails, capacity256: state is
`64 + 24 + 14 + 2048 = 2150` words (8600 bytes); frame108 words (432 bytes).
This is an arithmetic size, not measured GPU memory availability.

## Source-ordered behavior

`generateInverseObservationWGSL(layout,{count,workgroupSize,entry})` emits an
explicitly bounded shader; one lane owns one candidate. Bindings use existing
logical names: state0 RW, config/program1 read, projection scratch3 RW, frame4
read. Counts 1..4096 are generator shape admission, **not qualified throughput**.

- Initial sampling never creates an impulse episode, even when its frame's
  impulse bit is true (same original semantics).
- Positive solver impulses, not the debounced presentation event log, start
  episodes. Separation threshold .00005 and convex-isInside branch are exact.
- A persistent episode cannot satisfy a repeated stage. A repeat must depart and
  start returning; gap hysteresis is exactly1e-10.
- The closest relative chord is sampled only across a continuous no-impact
  interval at the same stage. It never creates an event or certifies contact.
- Each pending event in one frame uses the identical original `time - start`.
  Unique fixed roster keys make source stable sort/dedup exactly one ordered
  object-then-cushion group; multiple distinct contacts remain ambiguous.
- All events continue to append after topology completion/mismatch. No source
  early stop is invented by this component.

State status `READY` only means reducer continuation is valid, not physical
success or terminal. `UNSUPPORTED` and `FAILED` have no solver/pass authority.
Malformed frames change only failure header before source-state mutations.
Capacity/numeric errors during reduction may leave a diagnostic partial state;
that state is poisoned and cannot resume or publish an evaluated observation.

The `project` entry emits a 24-word **observation-only** projection: residual
presence/vector, prefix/stage, topology-matched flag, source substep count and
first-impact time/dt/rounded-cell tuple. No inequality, clearance, scorer success,
outer physical completion, game score or pass flag is invented. The original
`projectResult` scorer/constraint join remains a separate explicit integration
boundary; supplying a host scorer result cannot certify a GPU trajectory.

## HOST proof commands

```sh
node --test --test-concurrency=1 \
  tests/resident-candidate-inverse-reducer.mjs \
  tests/resident-candidate-inverse-reducer-numbers.mjs \
  tests/resident-candidate-inverse-reducer-native-stream.mjs
```

The generated WGSL is compiled by the unchanged scalar compiler and executed by
its TEST VM with independent f64 primitive models, compared to unchanged
`LabInverseEvents`. This proves these source fixtures, **not shader compilation
or execution on a device**. The default native-stream cases capture two fresh
128-h original CPU prefixes, retaining only current frame/state and stream hashes.

Full known-source stream proof is explicitly HOST-only:

```sh
RESIDENT_INVERSE_FULL_STREAM=1 node --test --test-concurrency=1 \
  tests/resident-candidate-inverse-reducer-native-stream.mjs
```

It uses fresh original positive/late-foul placements and source horizon; after an
irreversible query stop it continues the same actual PhysicsLab for the
observation-only full-rest oracle (not repeated terminal `stepTrial`). Frames are
independent test inputs, not evidence of a GPU producer. There are no private
artifact paths, stored future banks or per-instruction logs.

## Required next integration gates

1. A same-world device producer must obtain original primary-vs-pair collider
   impulses, actual solid convex projections, binary64 application clock plus
   actual f32-widened native dt, correct sphere/rail order and initial sample.
2. Invoke exactly once after the complete original world solver call, before
   application patches/events. CCD rollback/internal iterations and transport
   dispatch yields are **not** observations. Provisional/failed world transactions
   must not publish either observation state or terminal records.
3. A bounded native shader gate must compare every retained source field/word to
   independent actual source streams, then genuine same-world production must be
   independently qualified. No host frame upload may masquerade as that proof.
4. Join actual resident scorer, constraints/clearance, outer clock and status with
   the legacy observation-v1 query contract; missing geometry/numerics and
   unfinished/cancel/stale/failed states remain valueless authority.
5. The separately named final-gameplay policy has different identity/receipt
   requirements. Observation-v1 remains legacy query semantics, including early
   free-mode/direct query outcomes, and cannot be relabeled final gameplay.

## Corrected HOST checkpoint

The final corrected source passed 9 focused scalar/numeric groups and both fresh
full source streams. A review regression specifically proves finite inputs whose
intermediates produce `Infinity - Infinity` cannot turn source `max(0, NaN)` into
a zero-gap observation. Another interleaves two candidate programs at 37-op
budgets and proves complete lane isolation plus inert padded invocation.

- Positive holdout: 5480 native h / 5039 original outer steps; 2 impulse episodes,
  prefix2; 20,034,984 HOST scalar reducer instructions, ~25.36 s.
- Late-opponent-foul holdout: 5415 h / 4974 outer; legacy query terminates at h1427,
  but the same original world continues for the observation-only rest oracle;
  3 impulse episodes, prefix2; 19,836,767 instructions, ~24.42 s.

Every retained observation field is compared at every source pre-application
boundary, not just the last output. Stream hashes and exact source/shader metadata
are in [the curated evidence](evidence/resident-inverse-observation-host.json).
These are HOST differential costs, not GPU timing or a hardware speed estimate.
The earlier uncorrected full-stream result is not used as final source evidence.

Standalone frame/config bindings are not yet integration mappings. In particular
frame4 is a read-only component/test view, not authority for the actual world to
write it through the current VM's read-only ID4. A production mapping must place
frame/config spans in existing writable resident state/scratch using admitted
base offsets, or separately qualify a device-only producer binding, without
exceeding existing storage-binding limits. Do not add a host upload per h or
assume a ninth storage binding. The 8600-byte per-row observation state must be
included in future exact bank admission; the current allocation profile has not
been silently enlarged.
