# Four-ball floor loss, flight, and landing

This is a bounded parity implementation, not activation of GPU gameplay or a claim
that arbitrary CPU/Rapier shots are supported on the GPU.

## Original input and outcome

The source fixture uses the unchanged application controller, legal ball placement,
and a stroke with angle 0°, elevation 20°, tip `(0, -0.88)`, and speed 2. The
initial cue-clearance check accepts this input. During the actual stroke, however,
the cue tip contacts the cloth and emits `cue-obstruction`. This is therefore a
reachable, actually obstructed stroke, **not a valid search recommendation**.
Neither the input nor the original engine is altered to manufacture a jump.

The recorded source sequence loses ball-floor impulse at h377, loses its point
at h425, removes the cue at h464, removes the floor pair at h515, reaches its apex
at h594, recreates the floor pair at h677, and lands with positive impulse at
h680. Original rest is h5346. The application score remains zero and the next
cue is player 2. Search obstruction validation must remain independent of the
application score result.

## Implemented ownership

- A branded source-owned cue-cloth cache carries geometry, recycling, feature IDs,
  anchors and warm-start state. It is never seeded from future oracle frames.
- One shared arithmetic graph solves the original two cue joints and the cloth
  contact in source order. CPU reference and actual WGSL execute the same graph.
- Cue application forces precede broad/narrow phase; constraint solving is
  deferred until the current geometry and authoritative solver roster exist.
- The journal owns pair birth/removal, activation, withdrawal stop events and
  graph generation. The roster preserves source collider-removal color residue.
- A strict analytic cylinder/sphere separation query resolves the previously
  unsupported separated neck/sphere case. Actual/predicted contact still rejects;
  this is not a rigid cue contact solver and does not disable collision checks.
- Floor pair disappearance and reappearance continue through the existing
  free-body, floor-contact, island, CCD and cache owners. No floor is forced on.
- Final preflight failures roll back every owner, including public cache state.

## Evidence and comparison contract

At checkpoint `5f60929`, CPU and actual WebGPU (Dawn Vulkan SwiftShader) each
matched all 681 steps through landing against the original Rapier record.
There were 23 full world checkpoints and seven rollback/retry checkpoints.
Maximum observed absolute state error was `9.39385763620848e-9`.
Software GPU execution is not a hardware-performance measurement.

At checkpoint `ebe16b0`, both CPU and actual WGSL also matched all 5,346 steps
through original rest, including 25 full checkpoints and eight rollback/retries.
The maximum observed absolute error remained `9.39385763620848e-9`; the added
cue-cloth cache comparisons had zero numerical error, with 16 counted signed-zero
differences per backend across the checkpoints (not byte-identical caches).
Original score, next cue,
all-body sleeping, and repeated completed-step idempotence were verified.

The checkpoint assertion additionally compares every native-owned
cue-cloth field conditionally. Missing point/solver scratch is not fabricated
as zero. Integer/boolean metadata is exact; numerical cache tolerance remains
2e-6. Source-frame data is comparison-only. Compact storage retains every native
value and reproduces the assertion transcript before being accepted.

The raw original withdrawal drain was also captured independently: h463 emits
nothing; h464 emits one stop for collider 0 to collider 25. JavaScript exposes
handles and the start/stop boolean, not native removal flag bits.

## Remaining scope

The product importer still restricts input to the default initial shot. This
research owner is not routed into ordinary gameplay or search. Live-cue noncue
pair changes, airborne ball/ball or ball/cushion combinations, and actual rigid
shaft/neck collisions remain guarded where unimplemented. No claim is made of
arbitrary-input equivalence, hardware acceleration, or full search throughput.
