# Opt-in CPU world boundary capture

This is **CPU-reference diagnostic plumbing**, not GPU-produced trace evidence.
The canonical CPU continuation entry points accept runtime-only options:

- `selectedTraceCapture(record)`: synchronous callback.
- `selectedTraceMaxRecords`: separate observer cap, default 512, range 1–4096.

No observer is attached by default: no observer state snapshots, original-source
retention, or extra trace arrays are created. The immutable physics/work settings
and compact rules result are unchanged.

An initial zero-duration record exposes the original raw-handoff/prepared-world
boundary. Later records cover accepted advancing phases and terminal REST.
Rejected nonadvancing attempts are not relabeled as accepted motion. A real
impact whose departure remains pending is retained at its actual advanced clock.
Raw contact itself is not reconstructed by this hook.

Each callback receives a deep-cloned source-owned payload containing `kind`,
`startTick`, `endTick`, `beforeState`, `afterState`, `context`, `cloth`, and `source`.
Rolling tails/pairs also retain original `rollingRows`, `tail`, and `pair`.
Mixed motion retains original smooth inputs/outputs only when capture is active.
Pair/cushion resolutions retain original `sourceDescriptors`; cushion traces must
split original-prefix-to-impact and departure-to-final-state using their separate
original descriptors, never reuse the final 64-tick departure duration as the
pre-impact horizon. Canonical roster IDs remain separate from internal source
recipe slots.

The observer cannot change future physics through the payload. Callback errors,
async callbacks, malformed observer configuration, and record-cap exhaustion stop
capture and set `selectedTraceCaptureStatus.incomplete` with a reason; they do not
change physical state, raw handoff, journal, rule state, or compact result. Async
callbacks are unsupported and later rejected promises are contained. The status
reports callback invocations, not retained renderer records or full-trajectory
coverage. A consumer must separately classify unsupported source intervals.

Tests compare full results with tracing disabled, enabled, recursively mutated
snapshots, throwing/async callbacks, and overflow/invalid caps. Actual raw
cushion, goal, and late-foul fixtures retain their original compact results and
REST clocks. The selected-trace adapter performs separate recipe/coverage checks;
no curve fitting or endpoint interpolation is authorized by this boundary hook.

## Stable roster IDs versus signed helper IDs

The latest mixed-world probe/prepare and microtail smooth-row producers use the
internal roster slot (0–3) as the signed smooth recipe ID in both CPU and WGSL.
The canonical world and identity packets retain the original full `u32` IDs.
No position, velocity, spin, material, clock, or numerical-law expression changed.

A real raw goal with all original IDs increased by `0x80000000` now crosses mixed
flight/ordinary landing and microtail processing and reaches REST at 3343649.
Its trace test checks both stable high-bit roster IDs and slot-local original
smooth inputs/outputs; this is not merely a packing test.

Qualification:

- Ordinary goal and high-bit goal: 2 native tests, 5,832 exact CPU/GPU final words
  (2,916 each), including raw handoff, world/dense, journals, rules and compact.
- Ordinary goal and late-foul references: all 5,832 final CPU words unchanged
  from before the slot-ID changes (REST clocks 3343649/3343645).
- Integrated CPU suite: 37 passed, 12 native-only skips; typecheck clean.
- Native source hashes unchanged before/after. Software Vulkan SwiftShader,
  157.405 s total and 1385.62 MiB sampled aggregate RSS, under 240 s/1500 MiB.

This live-world identity extension does **not** retroactively qualify the frozen
0850 experimental batch revision. That revision needs its own execution-admission
guard or a separately qualified revision; the selected trace and live-world
results cannot be substituted for frozen-batch evidence.
