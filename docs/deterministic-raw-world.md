# Canonical raw strike → full prepared world (opt-in)

This is a **bounded numerical entry**, not production wiring, a gameplay PASS/MISS,
legacy Rapier equality, or a global enclosure theorem. It leaves the validated raw
material integrator unchanged. See [`deterministic-raw-strike.md`](deterministic-raw-strike.md)
for its ideal-guide interpretation, compliant finite-end dynamics, timestep error,
raw input coverage, and source parameter-count findings.

## Public entry

```js
const binding = prepareRawWorldBinding(canonicalRequest, {
  absoluteTick, // explicit common Q20 initial clock, 0..INT_MAX
  sceneKey, requestKey, // opaque u32 transport bindings, NOT geometric proofs
});
const batch = prepareRawWorldBatch(binding, canonicalCandidates, {
  maximumSteps: 2048, // separate 1..4096 raw work cap; default 4096
});
const cpu = runRawWorldCPU(batch); // {raw, world, status}

const engine = await createRawWorldGPU(device);
const bank = engine.createBank(batch);
bank.encode(commandEncoder); // raw six stages, then one resident handoff
// bank.preparedWorldBuffer: N × 192 words (PW1)
// bank.handoffStatusBuffer: N × 16 words
// bank.rawResultBuffer: N × 128 words (unchanged full strike provenance)
const next = preparedWorldEngine.createBank(bank.preparedWorldBuffer, bank.count);
next.encode(commandEncoder); // real full-state classifier, no host candidate physics
// Submit once; dispose/destroy only after completion.
```

The full exact scene/request/candidate identity strings remain in immutable host
metadata. Numeric scene/request keys only bind a caller's buffers; they are not
hash certificates. Contract validators revalidate transported/structured-cloned
identities. Private WeakMap-owned numeric inputs are copied on preparation.
`snapshotRawWorldBatch` returns **diagnostic copies**, never aliases.

Only `runRawWorldCPU(batch)` and `createRawWorldGPU(...).createBank(batch)` are
physical entry points. Both privately own the raw producer and its immutable
scene. There is deliberately **no public unbound raw-result handoff**: a genuine
ready result from a different scene with the same selected position/settings
must not be transplanted into a blocked scene. The exported WGSL is a low-level
kernel, not independent scene/physics authority. Synthetic ABI gate tests are
not physical strikes.

## Admitted initial scene

- Complete **3 or 4 equal solid spheres**, source kind `ball`, radius 0.03075 m,
  mass 0.210 kg, stable sorted unique u32 IDs. No subset/truncation.
- Every body's **actual initial v and ω must be exactly zero**. An unchanged
  stationary supported body may share the elapsed strike clock without any
  omitted dynamics; a moving/elevated body may not.
- Default material parameters and source settings exactly match the canonical
  contract. Non-default settings, boxes, moved statics, unsupported rotations,
  altered mass/radius, unsupported counts, and strict-carried profile reject.
- One finite unrotated rectangular cloth and four complete cushion geometries;
  every other admitted static retained. Positions are within the downstream
  ±4 m component domain; immutable geometry bounds must fit the raw ±8 m domain.
- For each sphere, encoded y must be **exactly encoded cloth top+encoded radius**,
  with its horizontal radius strictly inside the finite cloth footprint.
  Source settled penetration/elevation is not snapped onto support. A regression
  uses the actual Rapier construction's settled y and rejects it.
- Every initial sphere is conservatively separated from every non-cloth static
  AABB and from other spheres. Unresolved overlap/contact is unsupported.

The raw domain remains speed 0.5–4.5 m/s, elevation 0–85°, |yaw|≤3600°, and normalized
radial tip offset ≤ 0.6. UI values outside it are retained in identity and become
unsupported; they are never clamped. `admitted` on contract metadata is only a
necessary gate; this adapter adds actual support/clearance admission.

## Complete geometry ownership

Source statics have no object IDs. The contract's deterministic sorted **static
slot** is therefore the canonical owner identifier, scoped by the exact scene
identity. `binding.ownedCloth` records the one cloth's slot and ownership law;
`binding.obstacleOwners` records each raw AABB owner in matching order.

The source fixture has 16 statics. Its raw obstacle count is **22**, explicitly:

- **15 actual non-cloth statics**, each exactly once, as outward AABBs;
- **3 other stationary spheres**, each exactly once, as enclosing AABBs;
- **4 finite-support exclusion guards**, not actual added collision bodies.

The remaining **one cloth is owned by the dedicated persistent support law** and
finite footprint. It is neither omitted nor duplicated as a collision obstacle.
Tests verify every non-cloth static slot and other body ID appears exactly once.

The four exclusion slabs cover the outside of the finite cloth footprint, from
−8 m through cloth top. They cause raw clearance to reject a sphere approaching
or crossing an unsupported edge at **every microstep**, without introducing a
collision response. The raw capsule/ball swept guards still apply. A test moves
actual surrounding rails away and starts a strong strike just inside the finite
cloth: rejection occurs **after real compliant contact begins**, before a world
packet can be admitted. Raw initial position ≤ 4 m and component velocity ≤ 32 m/s for
at most 1/16 s keep the sphere inside ±6 m during accepted microsteps, within these
±8 m exclusion guards.

AABB/plane tests can reject feasible shots (including cues outside the finite
cloth whose continuation would be below the extended plane). They never claim
an exact hull collision or synthesize a response. Other-sphere movement/contact,
cloth lift/relanding during the strike, or cue/static interaction remains
unsupported. This is conservative admission, not complete geometry coverage.

## Resident state and failure ABI

The 192-word PW1 packet is defined by `deterministic-prepared-world.mjs`:
header 32 plus 4 × 40-word body records. Header carries candidate ID, complete count,
common absolute Q20 tick, modelVersion 1, canonical-local profile 1, sourceKind 1
(raw strike), selected slot, and opaque scene/request keys. All reserved and
unused words remain zero.

On success, selected p/v/q are copied **word-for-word** from the raw result.
All other body records (IDs, radius, mass, p, zero v/q) remain unchanged. No
preferred direction, mode hint, or fabricated enclosure is inserted. Full qy and
noncollinear slip survive. The downstream initializer derives actual modes.

The exact shared state-domain predicate checks **|v| ≤ 8 m/s and |q| ≤ 16 m/s** using
wide squared norms, plus ±4 m position components. Raw word 124 is only the old
4 m/s-component warning and is **not** admission authority. No output is clipped.
An actual strong centered strike above the old limit passes this handoff.

Handoff status 16 words:

|Word|Meaning|
|---|---|
|0|candidate ID|
|1|1 ready for initialization,4 unsupported,5 incomplete|
|2|handoff reason (below)|
|3–5|unchanged raw status, raw reason, raw version|
|6|PW1 version|
|7|raw elapsed Q20 tick|
|8–9|scene/request opaque bindings|
|10|accepted absolute Q20 tick; zero on failure|
|11|raw-world ABI version 0x52575701|
|12–15|reserved zero|

Reasons: 0 none; 1 raw failure/work budget; 2 raw-row/version/origin/numeric
identity; 3 state domain; 4 clock overflow; 5 contract candidate admission;
6 support mismatch; 7 elapsed-duration budget.
Raw status 4/5 stays unsupported/incomplete. A failed row writes a **zero/invalid
PW1**, never a ready initial world, MISS, score, or terminal gameplay result.
The real GPU initializer turns that zero packet into pending state 7/reason 64.
### Elapsed-duration budget

`request.budget.maximumTicks` is the **total elapsed Q20 duration from raw-start,
including the strike**, not an absolute clock and never a completion proof.
The contract's `createCanonicalShotClock(request, absoluteTick)` binds the
original start, maximum duration, checked signed-range deadline, and exact
request-bound clock identity. Binding fails before execution if start+duration
would exceed the declared clock range. `binding.shotClock` must accompany later
phases; they must not reset elapsed duration at the post-strike PW1 clock.

The raw entry starts with the entire duration remaining and computes only this
immutable metadata decision:

```
fixedStepTicks = 16
availableFullSteps = floor(maximumTicks / fixedStepTicks)
effectiveMaximumSteps = min(requestedMaximumSteps, availableFullSteps)
```

`batch.maximumSteps` retains the separately requested work cap;
`batch.effectiveMaximumSteps` and `batch.boundByDuration` expose the actual cap.
No fractional microstep, parameter adjustment, or host candidate physics is
introduced. Positive capped rows still use the unchanged raw integrator.
Its work counter also bounds the iteration that detects separation, so an
exhausted boundary remains incomplete without an established finish; no extra
integration step is borrowed to manufacture completion. The current ordinary
fixture finishes at T = 7,696 ticks: a duration of T through T + 15 remains
conservatively incomplete; T + 16 allows the final check and returns ready at
elapsed T, not T + 16. Exact-endpoint regressions cover all three cases.

When no full step fits (duration 1–15 Q20 ticks), **no raw pose, force, or
integration kernel is dispatched** and CPU does not call the raw solver. The
only GPU dispatch writes metadata status: admitted input is INCOMPLETE,
reason 7; PW1 and the raw result are zero. Raw status/version zero explicitly
mean **no raw result/provenance exists**, not that a physical zero-duration shot
was solved. Invalid contract candidates remain unsupported. For a positive
cap, raw exhaustion stays incomplete; reason 7 identifies a duration-limited
cap, while reason 1 retains separate work-only exhaustion. A cap tied on both
limits is also duration-limited.

Every returned raw elapsed tick is within the duration cap, and a ready PW1
requires checked start+elapsed arithmetic. Sufficient non-binding duration
budgets preserve every normal raw/world/status word. Later event/work budgets
and remaining total duration still require the continuation producer's guards;
this initializer does not claim full-shot budget qualification or termination.

A new canonical-local reference starts at the accepted encoded post-strike
world. No inherited global physical enclosure is fabricated.

## Validation and limits

The suite includes actual source table statics, 3/4 roster and stable-ID tests,
full spin/noncollinear-slip preservation, shifted epoch/scene/candidate identity
rejection, actual strong strike range, immutable-copy tests, cloth/box/material/
UI unsupported cases, complete geometry ownership, and finite-support crossing.
Native tests chain all raw rows→PW1→the actual full-state initializer resident,
with one end readback. Additional synthetic shader probes exercise rejection
priority, malformed words, INT_MIN, norm limits, and failure-word clearing; those
probes are explicitly not physical entry receipts.

Measured native checkpoint: **9/9 tests passed**, 67 raw candidates, 64 ready;
**56,816 chain words checked**, including all 67 resident prepared initializers.
Of these, **55,280 are literal CPU/GPU comparisons**. The remaining 1,536 words
are the 3 unsupported rows, checked against explicit pending state `[0,7,64]`
and zero dense data; the strict CPU PW1 validator rejects invalid headers rather
than returning that pending packet. Raw/handoff/PW1 failure words themselves are
CPU/GPU identical for all 67 rows. Another 19 synthetic ABI gate probes compare
3,952 words against independent expected ABI outputs, not physical trajectories.
Eleven additional elapsed-duration/work/clock cases compare **3,696 literal
CPU/GPU words**; both substep-duration cases assert zero raw-physics dispatches. Preflight took
23.1 ms, raw pipeline compilation 6.660 s, handoff compilation 52.9 ms, and the
primary resident chain submit/readback 2.107 s. The process exited 0 in 14.87 s,
peak owned-group RSS 890,728 KiB, with no timeout or remaining process.

All shader modules are parsed/validated before heavy pipelines are compiled.
Native invocation holds `/tmp/billiard-native-gpu.lock` through bounded process
cleanup, with 180 s timeout and 1.5 GiB owned-process-group RSS watchdog. See
`artifacts/canonical-raw-world/` for exact current receipt, phase log, process
exit/RSS evidence and source hashes. No UI/production wiring or approach-jump
optimization is included.
