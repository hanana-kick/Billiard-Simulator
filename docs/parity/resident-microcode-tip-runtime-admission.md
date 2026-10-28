# Fixed tip-row diagnostic admission

Two new test-runtime profiles are explicit, separate from the unchanged
six-row/two-h and six-row/eight-h gates:

| Profile | Rows | Source request |
|---|---|---|
| `resident-raw-tip-probe-initial-only-runtime-v1` | 219, 522 | h8 from initialization |
| `resident-raw-tip-outer-initial-only-runtime-v1` | 219, 522 | h64 from initialization |

The fixed input values are row219 `(310,85,4.5,0.2,-0.1)` and invalid row522
`(9,8,0,0,0)`, in angle/elevation/speed/tipX/tipY order. This roster is a bounded
qualification fixture chosen after independent source chronology, not an expert
shot prior or a hardcoded physics outcome. Neither profile claims tip contact by
h64. The new APIs do not admit arbitrary counts/horizons or h192.

Admission verifies ordered row metadata **and decoded raw Float64 input words**,
including candidate IDs and signed-zero distinctions. The source PC begin shader
must guard exactly two rows and contain the profile's baked requestedH. Changing
only metadata or relabeling a completed request cannot extend a trajectory.

The microcode wrapper kinds are `resident-raw-tip-probe-microcode-runtime-v1` and
`resident-raw-tip-outer-microcode-runtime-v1`. They use the existing retained
session: fresh initialization for each independent h8/h64 run, shared compiled
device/cache only, never reopening a completed VM. The old one-shot two-h wrapper
still rejects both new kinds.

Host schema tests use synthetic descriptors and authentic raw row bytes; no
shader executes in those tests. They reject wrong rows/order/count, altered
metadata or raw settings, future-state payloads, incorrect baked horizons and
unknown kinds. Native h8/h64 source parity and original latched outer-clock
comparison remain separate required gates.
