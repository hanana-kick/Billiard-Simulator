# Minimal original BVH operation trace

## Scope and non-oracle boundary

The original corner shot remains unchanged: constructor layout, yaw
12.905686665770533 degrees, e35, tipX .25, speed10, original material values,
maxCCD4 and 64 cue subdivisions. This is engine-accepted source discovery,
not UI reachability or independent holdout evidence.

This trace is for validating a BVH component. It is not an end-to-end candidate
world and must not be used to feed future expected operations, boxes, tree
nodes, candidates, or states into a production world. Such a world must derive
its operations and boxes from its own recurrent state. Native/WASM future
broad-phase states in the artifact are assertions only.

The genuine original JS/WASM application owns all trajectory recurrence,
including compliant cue impulses, angular resistance, cue withdrawal and the
clock switch. Before and after each actual world step, snapshot bytes are
observed without changing the application. Each original boundary is then
restored independently for a native source diagnostic step, once with the
observer enabled and once disabled. The two resulting complete native world
snapshots must be byte-identical. This is not uninterrupted native application
recurrence from created alone; that would also require the JS application
driver between native steps.

The separate component recurrence uses one initial created broad-phase state,
then only the ordered source operation inputs. Future native trees are never
reseeded. Compare every resulting component tree and scheduler field against
the separately saved expected native state, and compare each source CCD query
against its expected native leaf order.

## Minimal read-only observations

Pinned pristine Rapier source is copied to a new isolated directory. Its
physics expressions and their order are unchanged. All changed files and the
observer code are hashed, and the pristine official-source manifest is checked
before and after compilation. Existing sources and binaries are not overwritten.

- update: after the original update_workspace computation and before its leaf
  writes, capture ordered leaf index, computed AABB and skin, removed indices,
  actual forced-reinsertion indices, and currently live collider indices.
- setAabb: capture the original computed box and skin immediately before the
  original tree write.
- join: record the actual PhysicsPipeline optimizer join call. A join with no
  pending optimization is intentionally included as a no-op.
- query: immediately before the original full-BVH CCD traversal, independently
  read the same swept box and leaf iterator. Record its exact leaf order plus
  moving body/collider identities. This does not replace the original iterator.
- phase labels distinguish pre-split and post-solve/pre-clamp query sites.

Typed serde observation preserves exact native f32 bits in the raw JSONL.
A normalized compact artifact contains only initial/expected broad state and
operation records, not 396 full-world JSON snapshots.

## Two-boundary pilot

The isolated observer compiled successfully. Its first pilot used:

1. The genuine created snapshot, advanced by a generic engine-only native step.
   It retained live cue/joints and proved observer neutrality. It is explicitly
   not the actual application h1 because the application's substep clock and
   pre-step forces were not applied for this smoke test.
2. Existing genuine original h396 pre/post snapshots.

Both instrumented and unobserved native final worlds were byte-identical.
h396 native broad-phase bytes exactly equaled original WASM broad bytes. Its
complete native world SHA256 also equaled the previously established unmodified
direct probe SHA256:

de4dcf4c116b9047da67ed40c04c2dee7a0422a06a60b4fddddd0d4a704fd634.

The actual h396 raw leaf order is [0,8,4,17,16] in both pre- and post-solve CCD
queries. The unchanged source filters reduce the primary collider casts to
cloth0, front-cushion8, right-cushion4, exactly matching the multiple-TOI witness.

Pilot artifacts are /tmp/multi-toi-bvh-pilot-input-v1.bin,
/tmp/multi-toi-bvh-pilot-observed-v1.jsonl, and
/tmp/multi-toi-bvh-pilot-normalized-v1.json. The first normalized row includes
the actual created frame72 initial broad-phase tree.

## Reproduction interfaces

- tests/multi-toi-original-bvh-build.cjs verifies official source archives and
  compiles a new isolated observer from the adjacent Rust capture/main files.
- tests/multi-toi-original-bvh-inputs.cjs replays the fixed original shot and
  writes framed native pre/post snapshot input. It checks exact prior created
  and h394–396 snapshot hashes and audits that no original-ball setter ran.
- tests/multi-toi-original-bvh-capture.cjs runs the observer against that input,
  requires every source/native broad state to equal original WASM, and checks
  continuity of broad-state hashes between successive boundaries. It emits a
  provenance object with initialBroadPhase and frames. Each frame contains
  records and expectedNativeBroad; each record has phase and operation.
- tests/multi-toi-original-bvh-gate.cjs requires the persisted artifact when
  REQUIRE_MULTI_TOI_BVH_COMPONENT_CAPTURE=1 and
  MULTI_TOI_BVH_COMPONENT_CAPTURE names its absolute path.

## Actual application h1–396 result

The subsequent coordinated run completed all 396 genuine original application
world steps, including the live cue, cue withdrawal and clock switch. No input
value changed and no additional input candidate was executed. The input helper
verified the exact prior created snapshot and all overlapping h394–396 original
snapshots. Only the two original cue setLinvel calls occurred; no original-ball
setter ran.

All 396 instrumented/unobserved complete native snapshots were byte-identical.
All 396 native broad-phase serialized states were byte-identical to the actual
original WASM broad-phase states. Every native end broad hash matched the next
original start broad hash. Thus the operation sequence describes one continuous
original broad-phase recurrence, even though the native diagnostics themselves
start independently at each original boundary.

Captured operations: 396 updates, 1,392 joins, 2,859 setAabb calls and 816 full-BVH
CCD query streams. The normalized artifact is 4,918,444 bytes and contains broad
state only; the bit-exact raw typed JSONL is 20,883,652 bytes. The framed input
contains raw pre/post snapshots, not full-world JSON dumps.

Initial identity remains exact and separately labeled:

- Genuine created world SHA256:
  5daa1cc43aaea8b4145176d546c6b8681eef7e04a2fa28153a77f9843ba950e6.
- Actual h1-pre world SHA256, after application clock/pre-step changes:
  e546bd11db999e7108292d1b6a59414f604da2ed063f1f316af282e4cfcf3e3a.
- Their broad-phase bytes and normalized trees are identical, SHA256:
  7312d15d16d832652dfce3541a44addb7ccc2c79995ba9216bf15d2191d0441e.

Evidence artifacts:

- /tmp/multi-toi-bvh-application-inputs-v1.bin, SHA256
  6754059dea599986b0c042bc79ec37c2b9ac5e4d011d9fa3ea48858975daf592.
- /tmp/multi-toi-bvh-application-trace-v1.json, SHA256
  cb60e12acb901ad3c396edb67d2952c1e46c7f2c29b6d1eeeeb7b1a0c7450aa8.
- /tmp/multi-toi-bvh-application-trace-v1.json.raw.jsonl, SHA256
  74ac50de7d6c626b47ee907f9682fe887d9aeca6eccf397ec4a20896a1cb6ae2.

The required persisted source gate passes 2/2 tests. It verifies source and
binary provenance, no ball setters, every original/native broad match, every
boundary continuity check, the independently established h396 native full-world
hash, and all four final source query orders [0,8,4,17,16].

This remains a component evidence result, not integrated CPU/WGSL world parity.
Full native-versus-WASM world bytes were equal at 73 steps; the remaining 323
worlds differ outside the exact broad-phase equality proved here. This minimal
trace does not classify every such difference. The separately established h396
comparison still has exactly the prior four signed-zero contact-cache differences.
Neither source-native full-world equality nor CPU/GPU full-world equality is
inferred from broad-phase success.

The source component consumer receives initialBroadPhase once and the ordered
operation inputs. Expected native trees and expected query leaves remain
assertions only. Its CPU/WGSL implementation and execution are a separate gate.
