# Optional resident inverse terminal observations (contract only)

**Implemented:** an opt-in, source-owned HOST ABI/pack/decode/validation seam in
`src/resident-candidate/inverse-terminal-observation.mjs` and focused host tests.
**Not implemented:** resident GPU accumulation, GPU terminal publication, solver
adapter, worker/UI selection, actual winner replay, or qualified batch capacity.
The module imports Node hashing for host preparation/validation; it is not wired
into the browser runtime. No existing solver, planner, scorer, or backend changes.

The public candidate-filter ABI stays **16 bytes** (`abi.mjs: RESULT_WORDS=4`).
PASS/MISS cannot supply inverse derivatives. This separate mode is **256 bytes per
row** plus an initial-only identity contract, not a trajectory/readback stream.
1024 records would be 256 KiB (4096 would be 1 MiB): arithmetic estimates only,
not execution/allocation measurements. The codec's maximum4096 does not qualify
4096 worlds or broaden any current fixed raw-physics roster.

## Actual source consumers

| Consumer | Required terminal values / exact use |
|---|---|
| `inverse-solver.js:53–57` | `residuals[3]`, `inequalities[9]`, `residualStage`, `eventPrefix`, `residualAvailable`, `contactCell`; row identity and feasibility/Jacobian continuity |
| `inverse-solver.js:60–70,268` | `goalVerified` causes a **new verify-purpose probe**, never direct root acceptance |
| `inverse-solver.js:180–207` | `verified` only on verify; unsupported/reason handling; nullable signed `clearance` for clearance restoration |
| `inverse-planner.js:66–73` | outer `steps` accounting; original candidate ID maps back to solverId |
| `inverse-planner.js:22–30,78` | a successful original `physicalResult` for archive identity, method/contact metadata, distance/speed ranking; absent from this scalar ABI |

`inverse-events.js:240–252` is the actual producer projection. Its current source
does **not** emit the solver's optional `physicalGoal`, `verification`, or `reason`
fields. The host selector rejects those fields if newly introduced instead of
silently dropping them; such producer evolution needs a versioned extension.
Transport reason codes explain unsupported/incomplete/cancellation/errors; no
Boolean-to-solver adapter or fabricated source failure text is installed.
Detailed events, all historical stage residuals, first-impact exact time, path,
maximum height, score and distance are not consumed by the numerical solver and
are deliberately not copied into this optional terminal record.

## Wire schema (little-endian u32 words, exact binary64 payloads)

64 words / 256 bytes, version1, magic `0x5243494f`:

| Words | Value |
|---|---|
| 0–5 | magic, version, candidate ID, transport status, reason, original purpose |
| 6 | availability / nullable-clearance presence / nullable-cell presence / goalVerified / verified bits |
| 7–10 | stage tag(index or clearance), stage index, eventPrefix, outer steps |
| 11 | boundary: none, initial-clearance, physical-stop, full-rest, horizon-probe |
| 12–19 | SHA256 of the entire immutable initial identity contract |
| 20–25 | three binary64 residuals |
| 26–43 | nine binary64 inequalities, in unchanged source order |
| 44–45 | nullable binary64 signed clearance |
| 46 | first object ID (when cell present) |
| 47 | reserved zero |
| 48–51 | binary64 native stepDt, binary64 already-rounded time-cell integer |
| 52–63 | reserved zero |

The source `contactCell` is exactly
`JSON.stringify([firstImpact.id, firstImpact.stepDt, Math.round(time/stepDt)])`.
GPU accumulation must perform that original rounding; host decoding merely
formats the already-returned tuple and never derives it from a trajectory.
The current first-impact object identity, positive exact stepDt and safe-integer
rounded cell must be representable; malformed/overflow fields reject explicitly.

The initial-only contract binds source SHA, original initial-snapshot SHA, request
SHA, generation, explicit `gameMode`/`mode`, derived full-shot policy, and complete ordered candidate ID/purpose/
topology/settings mapping. Contract hashing tags Number bit patterns, including
signed zero. Caller must bind those digests to genuine immutable inputs; these
hashes are provenance checks, not cryptographic proof of GPU computation. No
future arrays or predicted outcomes are allowed in the identity contract.

### Nulls and nonfinite values

- Original absent active residual remains `residualAvailable:false`. The source
  itself carries `[0,0,0]` in `residuals`; that carrier is never an available root.
- Clearance and contact cell preserve actual `null` independently of zero.
  Their absent wire payload is canonical zero padding, not a returned value.
- Residuals are finite because the source reducer throws on nonfinite residuals.
  Inequalities and nullable clearance preserve exact Number values, **including
  NaN/Infinity if supplied by the source**, rather than inventing finite values.
  The original solver's `rows()` then rejects nonfinite inequalities unchanged.
- Dense arrays, exact field sets, reserved bits, roster/order, row IDs, purpose,
  source/request generation, lengths and shared-memory aliasing are validated.

### Source query vs final gameplay (mode is mandatory)

Admission binds `gameMode` (`four` or `free`) and original search `mode`
(`target`, `direct`, `carom`, `three`; `optimizer-core.js:13` and
`optimizer.js:6–12`). `direct` is explicitly an early route-only query, not an
implicit three-cushion gameplay request or a newly qualified physical fixture. The
first four-ball scope is `carom` only. `requiresFullRest` must equal the original
`fullShot = (gameMode === 'four')`; it cannot be independently toggled.
`inverseTerminalObservationScope` always reports `gpuProducerImplemented:false`
and `finalGameplayQualified:false`: a codec is not a physical certificate.

For **non-four/free** queries, `optimizer-core.js:255,282,293` may stop after a
latched goal plus cue removal while other balls remain awake. Its latched-goal
branch no longer applies general contact/bounds checks. Actual `ThreeBallGame`
can still receive a later selected-cue/floor event and finish with delta0/turn
switch; Controller finishes gameplay after motion stops. Therefore non-four
records retain the exact source search-query success under `physical-stop`,
explicitly **original-early-search-query-only**, and this version rejects their
being labelled `full-rest`. A replay equality result carries the same scope; it
never upgrades that early query verdict to final-gameplay verification. No
three-ball policy or current source verdict is changed by this codec.

## Terminal status is not physical success

`evaluated` means a supported source observation exists at an explicit original
boundary, not a Boolean miss or global no-solution proof. Successful full-shot
values require `full-rest`. Initial clearance queries retain their real signed
measurement and source unavailable-residual semantics, not a fake stroke.

`unsupported`, `incomplete`, `cancelled`, `stale`, and `failed` are distinct,
valueless envelopes. They carry no numerical payload and must not enter
`commitWave` as evaluated misses. Explicit reasons cover missing source geometry,
numerical/scope/capacity support, transport budget, unfinished physical
verification, cancellation, stale source, device loss and execution errors.

An intermediate residual/Jacobian/trial probe may publish original finite-horizon
observations under `horizon-probe`, but cannot claim goal verification. A
verify-purpose horizon is incomplete, not an ordinary evaluated negative.
`four-ball-shot-incomplete` / `cue-tail-incomplete` are rejected by the source
selector as incomplete verification. The adapter remains unimplemented; this
contract does not silently change the current CPU solver's horizon semantics.

## Exact accumulation boundary required for the future GPU port

Reuse the semantics, not the host readback loop, of `inverse-events.js:54–143` and
`docs/inverse-observation-contract.md` / `commit-only-inverse-world-observation.md`:

1. One initial sample at `initial-before-world-step`.
2. One sample per committed native-equivalent world step at
   `after-world-step-before-application`, after final CCD clamp/solver impulses,
   before angular patches, application time/events and outer bookkeeping.
3. Sample original positive contact impulses using correct pair/primary collider
   identities; use actual solid convex cushion projections, not ideal planes.
4. Preserve separation/re-entry (0.00005), simultaneous event grouping (1e-9),
   source order, stage freezing, previous relative segment/closest measurement,
   required-return logic and exact source-number operation order.
5. Keep all pair/episode/previous-measurement/stage accumulators GPU-resident.
   Rollback/cancellation publishes no speculative receipt; final publication only.

The PhysicsLab debounced presentation history is a **different stream**. It is
used by original `ShotSearchCore.observePhysicalEvent`; it is not a replacement
for inverse impulse episodes. Scoring `observePhysicalStep` runs only after all
substeps/application callbacks at the original latched outer boundary
(`optimizer-core.js:248–299`, `experimental-four-ball-physical-scoring.mjs`).
Opponent/floor/obstruction failure can stop irreversibly before rest. Four-ball
success waits for absent cue **and all sleeping**, so late foul still overrides a
latched goal. Native dt and double application time remain separate. Existing
max4 host-orchestrated observation evidence does not qualify this resident port.

## Already-qualified winner display replay, not CPU probe fallback

For the four-ball resident target, the future executor must first qualify the
actual GPU verify-purpose result, including full rest and original rules. **Only that winner** is eligible for
original replay to build its display/path and original `physicalResult` distance,
contacts/method/archive artifact. Replay is separately timed and source-bound.
No CPU residual forward evaluations may fill missing GPU probes or replace
unsupported/unfinished GPU outcomes.

`assertInverseWinnerReplayAgreement` is a comparison-only HOST helper. It performs
no replay and grants **no GPU qualification**. It requires verified terminal
values, unchanged source/snapshot/request/generation/candidate/settings/topology,
exact comparison of the returned terminal values, original physical success,
and a finite original ranking distance. Any mismatch throws explicitly. It does
not return/attach a substitute `physicalResult` or commit to the planner. Fields
not returned by the GPU (such as trajectory/distance) cannot be claimed compared
to an absent GPU trajectory; independent full physical/tape gates remain separate.

Current `commitWave` needs the real winning artifact before a verified branch can
enter its archive. Missing replay is a pending integration requirement, **not a
miss**. The adapter and winner lifecycle must later attach that validated artifact
without using it to re-decide GPU candidate qualification. The default CPU
planner, geometric enumeration and finite-difference scheduling stay untouched.

## Host evidence

`tests/resident-candidate-inverse-terminal-observation.mjs` uses unchanged stored
original outcomes from `tests/fixtures/inverse-observation-original.json`
(source2ed077e), current pure source observation/projectResult functions and the
actual current inverse solver. It proves scalar bit/field round-trip, source
null/nonfinite semantics, exact solver continuation from original vs decoded
observations, malformed/stale/unsupported/incomplete distinctions and winner
comparison refusal. Fixture identity envelopes are explicitly synthetic **codec**
fixtures, not invented original snapshots or GPU proof. No forward replay ran.

The tests do not establish GPU accumulation or numerical agreement on new shots.
All release gates in `resident-release-gates.md` still apply.

Host command (no native/GPU tests enabled):

```sh
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
node --test tests/resident-candidate-inverse-terminal-observation.mjs \
  tests/inverse-constraint-solver.cjs tests/inverse-observation-data.cjs \
  tests/inverse-planner.cjs tests/inverse-events.cjs
```

Result: **78 PASS, 0 FAIL, 6 SKIP**, including all9 new codec/consumer/scope
groups. The6 opt-in native forward tests remain skipped, not claimed passed.
No GPU, forward physics replay, build/UI, or release qualification was run.

Follow-up scope regression: the actual `direct` mode is accepted as early route-query-only, changes the immutable identity hash, and cannot enter four-ball admission. This adds one host codec test without a new physical fixture or GPU run.
