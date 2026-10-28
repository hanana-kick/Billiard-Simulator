# Two-row probe and independently initialized first outer

This opt-in diagnostic uses the unchanged original rows **219** (`310°, 85°, 4.5, tip .2/−.1`) and **522** (invalid zero speed). It does not replace the accepted six-row gates or qualify 1,024 candidates, cue impact, full rest, or hardware throughput. The query horizon and source physics caps are unchanged.

- Probe: born h8, 2,048 fixed VM cycles, one final-map capture.
- Outer: **fresh initial-only born h64**, 8,192 fixed cycles in blocks **512 / 1,536 / 6,144**. Each block copies diagnostics on-device; all captures are mapped only after the last block. Intermediate copies may be mid-h and carry no exact-boundary success claim.
- Both use the accepted cached-control VM, WGS64, 65,536 microinstruction budget, call-frame allocation, and exact-source cue / numeric-graph / broad macros at WGS1.
- Both profiles are preflighted and compiled before any source/VM buffers; broad compiles first. One device and pipeline cache survive the explicit decision pause. Probe buffers are disposed; no completed h8 bank is restarted as h64.

## Three-role execution

Run these from the coordinator's **frozen worktree**. Numerical execution requires its globally serialized slot; the commands below do not authorize another concurrent GPU task.

```sh
node tests/resident-candidate-small-strike-isolated.mjs prepare "$ARTIFACT_DIR"
RUN_RESIDENT_SMALL_STRIKE_GPU=1 REQUIRE_WEBGPU=1 \
  node tests/resident-candidate-small-strike-isolated.mjs gpu "$ARTIFACT_DIR"
```

The GPU process writes `probe/actual.v8` and `probe-receipt.json`, then **waits**. In another process:

```sh
# Independent original all11 assertion; leaves the GPU waiting by default.
node tests/resident-candidate-small-strike-isolated.mjs assert-probe "$ARTIFACT_DIR"

# Only after the coordinator reviews measured cost and explicitly chooses GO:
node tests/resident-candidate-small-strike-isolated.mjs assert-probe "$ARTIFACT_DIR" --continue

# Alternatively, explicitly release the retained device without running h64:
node tests/resident-candidate-small-strike-isolated.mjs abort "$ARTIFACT_DIR"
```

`--continue` reruns the strict assertion and publishes GO only if it passes. A failed or incomplete probe never writes GO. There is no automatic timeout-to-GO, implicit continuation, or overwrite of an existing decision. The decision is atomically published with exactly the GPU invocation ID, both runtime hashes, probe actual hash, and `go`/`abort`; unknown fields or physical state payloads are rejected.

After an authorized outer run finishes:

```sh
node tests/resident-candidate-small-strike-isolated.mjs assert-outer "$ARTIFACT_DIR"
```

This requires both unchanged **all11 original source-owner parity** and `compareSmallStrikeNativeFirstOuterProjection` against genuine `PhysicsLab` outer1/h64 clocks, bodies, cue, scorer and retained history. It does **not** fabricate an empty emission tape. Full accepted-emission-tape coverage remains false; later impact qualification requires the separate audited binding/port.

## Authority and evidence

`probe/runtime.v8` and `outer/runtime.v8` contain common raw initial inputs, immutable programs/shaders and identities only. Original created seeds, future source h8/h64 states and native outer expectations live exclusively in separately hashed `expected.v8` files. The GPU role never opens them or imports the original CPU world. Runtime/source/shader/bytecode/roster hashes are checked before compilation and again before outer initialization and independent assertion.

The host suite (`node --test tests/resident-candidate-small-strike-isolated-tests.mjs`) covers exact profiles, stale/replayed/extra-field decisions, no automatic continuation, retained-state/terminal/rejection guards, authentic CPU preparation and equal shader/bytecode inputs. Its deliberately fake terminal-header output **fails the physics comparator and publishes no GO even with `--continue`**. These are host tests, not GPU performance or numerical qualification.

## Actual probe checkpoint

The separately admitted `[219,522]` **h8 probe passed** at source `de9a2b6`:
one genuine row219 trajectory matched all eleven original source groups;
invalid row522 remained rejected at h0/reason2. This does not replace the older
six-row h8 gate or constitute impact/full-rest/1,024-row qualification.

On SwiftShader, quiet-window probe pump wall was **311.107 s**, raw initialization
4.612 s, steady end-to-end315.722 s. Both profiles' cold precompilation was
101.625 s separately (26 distinct pipelines). These are host-wall observations,
not GPU timestamps or hardware calibration; reducing the roster did not give
linear time scaling. The h8 result used8,192 pump dispatches, one final map and
no CPU-produced future state.

After the independent all11 assertion, an explicit hash-bound GO was published.
A **fresh born-h64** request is now running on the same retained device/cache;
probe source/VM buffers were destroyed, not restarted. Its measured-input rate
projection is about41.5 minutes, not an observed h64 result. Independent host
work is allowed on a separate branch during this correctness run, so its elapsed
time will not be a controlled benchmark. No h192/full-shot run follows
automatically. Current seven-binding native outer projection does not have a
full accepted-emission tape; that remains a separate audited profile.

Probe identities, exact counters, separate timings and GO receipt are recorded
in `docs/evidence/resident-small-strike-probe-native-v1.json`.
# First-outer terminal result: native parity FAIL

The frozen `de9a2b6` raw `[219,522]` request completed its predetermined h64
transport on 2026-10-26. The native process exited0, but the **unchanged**
independent comparator exited1: `$.history.count` was7, actual PhysicsLab
expected8. Transport and all eleven source-owner groups passed first; those
source expectations share the contact-only seed omission and do **not** qualify
original-native parity. Other native represented groups (balls/cue/clock/rules/
game) matched. This is negative evidence, not a green first-outer milestone.

The authenticated capture contains eight prestrike events and the accepted new
stroke. The exporter/packer retained only seven contact events. Original
`PhysicsLab.emit` checks unfiltered `events.slice(-8)`, so the omitted stroke
occupies a real debounce slot. The frozen raw clone also has count7/head7.
Both producer initialization and independent source expectations require repair;
the native history gate, timestamp/FIFO semantics and rejected-row behavior must
remain intact. No live bank was patched and no further physics was scheduled.

Pump wall time was2471.656s; steady end-to-end was2476.339s. This was a software
GPU correctness run with independent host work allowed after the probe, not a
calibrated speed ratio. It used one initialization, three device-only diagnostic
copies of source/VM, and one final map. The final VM PC independently points just
after immutable HALT for both rows. Evidence is preserved in
`docs/evidence/resident-small-strike-first-outer-native-negative-v1.json`.

