# Bounded original-awake activation admission

Status: seven focused native/scalar/actual-WGSL admission tests and the bounded original cue-stroke continuation through first separation pass. This component preserves the selected sphere's original `canSleep:true` activation thresholds/history; it does not substitute a never-sleep descriptor. It admits only an already-awake sphere, a disconnected two-dynamic-body cue component, and fixed guide/floor role bodies. It is not a full island manager.

The executed continuation uses an explicitly modified single-ball layout: the other two balls are removed, the selected ball is moved to x=0.4, and 72 additional application settling steps run before the centered horizontal strike. Original static table geometry, CPU laws, materials and retained-body descriptors are unchanged. This is not the original three-ball scene, and the first native microstep is an initial condition rather than GPU strike initialization.

## Source ordering

The port follows Rapier `b716d375efc0201003f0cd9ef7168eee0b62c177`:

- `rigid_body_set.rs:307–310` and `data/modified_objects.rs:42–68`: mutable API access queues a body once, including zero-valued impulses.
- `rigid_body.rs:927–932, 1451–1515`: a nonzero true-wake impulse strongly resets an already-awake body's timer without adding the SLEEP change flag. False-wake angular patch calls do not reset it.
- `pipeline/user_changes.rs:61–86`, `island_manager/manager.rs:297–355`, and `physics_pipeline/substep.rs:368–466`: consume the ordered modified queue, wrapping-increment the active-set epoch for every existing enabled entry, then clear its flags before the activation observation.
- `physics_pipeline/solve.rs:176–318`: resolve removals/pending split, observe energy in active body order at the pre-solve pose, reduce eligibility by persistent island, then solve.
- `island_manager/persistent.rs:493–545`: preserve the removed-constraint guard. A dirty multi-body island is not automatically unsupported while all its bodies are ineligible; a real split nomination or sleep transition is rejected by this bounded component.

The existing scalar/WGSL activation graph supplies the native displacement-based energy rule, timer update and strong reset. The new component does not invent a velocity threshold. Integer queues, handles, membership/order and epochs use explicit host-side u32 bookkeeping, not f32 graph packing. Generation-bearing handles are preserved.

## Initial-state and transaction contract

The one-time context includes actual activation/history and maximum extent for each role body, all four native body IDs, flags, full active body order, selected/cue persistent memberships, fixed-floor links, current modified queue, active-set epoch and sleep-scan stamp. A shared awake container does not imply physical connectivity: the selected ball must be a genuine persistent singleton.

Only `IN_MODIFIED_SET` changes are admitted. Bootstrap work, pending split, unresolved removal journal, body/type/mass/shape/position mutations, sleeping bodies and unmodeled active members are rejected. Fixed bodies must retain invalid island IDs. Initial solver topology must agree with the native persistent floor link. Exact original dirty cue-island counters are retained, not reset to zero.

`createReferenceStage` and `createGpuStage` expose transactional `prepare`, `postPatch`, `assertPrepared`, `commit`, `abort` and `snapshot` methods. These are prepared numerical phases, not a recurrent physical-world API. The trusted lifecycle supplies its own body state and its branded cue stage's post-impulse/pre-solve cue states. Native expected poses or flags are never needed by that integrated path.

Source cue API ordering is head lateral impulse, shaft lateral impulse, and, when touching, ball tip impulse then head tip impulse. Pending false-wake angular-patch modifications survive into the next pre-cycle. At first completed cue withdrawal, head, shaft and fixed guide removals retain the source order, active-set epoch increments, active swap removal and tracked modification of any moved body. Stale removed queue entries are skipped rather than processed as live bodies.

A sleep-eligible persistent island or supported split-bid condition is an explicit stop, before state commit. Sleep-scan stamp wrap is rejected because the transient scan-slot workspace is not serialized; active-set epoch wrapping remains supported and tested separately.

## Trusted lifecycle connection

`createReferenceStepperWithStages(initial, {preStage, postStage})` and its actual-GPU counterpart accept only matching private brands. The cue stage is leased to one lifecycle owner, preventing a second controller or external caller from consuming its pending transaction. Both owners' commit preconditions are checked before their synchronous commits. Failure aborts only this controller's successfully prepared transactions and always clears its busy state.

The sequence is owned cue preparation, original enabled-CCD prediction check, own contact geometry, actual source activation observation, contact/free-body numerical solve, post-pose CCD check, original angular patch, pending queue writeback, then commit. Original `canSleep` and CCD settings remain unchanged. Active CCD, unsupported geometry or a sleep transition does not silently fall back to another backend.

`experimental-world-stepper` configuration/prepared exports only validate and execute numerical stages. A phase string alone is not whole-world admission, and the strict standalone controller still rejects original sleep/CCD-enabled descriptors even if callers add phase strings. The lifecycle itself must produce the actual activation/CCD evidence before commit.

## Explicit exclusions

Full manager serialization/free lists, arbitrary body removal or merge/split, sleeping-island wake propagation, active CCD/TOI, arbitrary mutations and complete application scenes remain unsupported. The original joint `assembly_epoch` and selection caches are serde-skipped and cannot be recovered as authoritative values from a snapshot. A queued joint-body modification reports a required assembly invalidation; the cue numerical component rebuilds rows each step. No hidden persistent-joint-cache identity is claimed.

Prepared-native wake/counter fixtures are distinct from the complete original cue-stroke recurrence. The latter must independently compare the full owned trajectory with unchanged original `PhysicsLab` methods, using one initial snapshot only. All numeric thresholds remain those of the existing component/global contracts; integer flags, queue order and selected serialized manager fields are compared exactly.

## Executed focused evidence

Run with the native snapshot decoder and actual WebGPU prerequisites described in the component guides:

```sh
REQUIRE_WEBGPU=1 node --test --test-concurrency=1 tests/experimental-awake-activation.cjs
```

The seven focused tests pass with no skips. Actual native API fixtures and actual WGSL activation execution retain the fixed criteria: exact activation timers, flags, body IDs, ordered modified queues, persistent memberships and u32 epochs, with `2e-6 * max(1, abs(native))` for previous-pose history. An initial active-set epoch of `4294967294` becomes `1` after three enabled queued bodies are processed. At native f32 h, a zero true-wake impulse preserves a `0.125` timer before observation, yielding `0.12501627206802368`; a nonzero impulse resets it before observation, yielding `0.00001627604251552839`.

The tests also reject unsupported sleep eligibility, scan-stamp wrap, incorrect membership and mutation flags; reject descriptor/token bypass through strict standalone factories; and verify rollback on active-CCD refusal and exclusive cue ownership. Surgical initial-state counter/timer edits are explicitly prepared-phase fixtures, not whole-stroke recurrence evidence.

## Executed original-stroke continuation

The combined suite passes 12/12 with no skips, including the seven focused tests and five original-stroke/oracle/rollback tests. Each backend owns 445 continued microsteps after one native initial microstep. The unchanged application runs at JS h `1 / 61440`, approximately 7.2591145833 ms total, with original `canSleep:true`, CCD enabled and 12 solver substeps. The actual trajectory includes approach, one contact episode with 76 touching microsteps, and first cue separation/removal. Expected native endpoints are assertions only, never recurrent inputs.

Each live body's IDs, flags, activation counters and thresholds, ordered modified queue, active order/epoch, scan stamp and persistent membership match the native observations exactly at every endpoint. Source previous-pose history retains its fixed numerical bound. Each backend's maximum compared numerical residual is `1.7347234745631684e-19`. Raw signed-zero differences remain (53 scalar, 54 GPU observations), as do subnormal differences (19 scalar, 16 GPU observations); this is numerical parity under the fixed criteria, not bit identity.

An earlier h2 inverse-inertia failure was traced to the oracle retaining Rapier's live `SdpMatrix3` scratch view across other native getters. Immediate copying equals independently serialized `mprops` exactly, while a delayed read reproduces the corrupt observation. The corrected fixture checks and retains the independent serialized tensor at every microstep; no candidate arithmetic, production method or tolerance was changed to resolve that failure.

This short continuation does not prove later rolling-to-rest/sleep, arbitrary strokes, active CCD or whole-engine equivalence. See [the cue continuation guide](gpu-cue-stroke-continuation.md) for the full bounded input contract.
