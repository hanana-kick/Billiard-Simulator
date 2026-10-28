# Opt-in finite-cushion world continuation

`enableCushionContinuation: true` composes the original finite hull entry,
3D cushion/cloth response, source-bound departure, and existing recurring world.
It is off by default and does not alter the shipped UI physics.
The request wrapper binds the actual admitted scene's uniform cushion and cloth
material; per-hull overrides and unsupported scene material remain rejected.

The impact state is journaled **before** departure. Departure is a new finite
all-roster query, not suppression of the most recent rail ID. A complete precise
finite ledger may also prove the entire original accepted segment CLEAR when the
coarse AABB blocked it: this commits the original producer endpoint, advances the
clear-prefix counter, and does not increment impact counters or emit an event.
All source identities, other balls, deadline, and receipts remain binding.

## Tests and limits

`tests/deterministic-world-cushion-route.mjs` includes:

- A genuine finite impact and bounded 64-tick departure, with the journal timestamp
  equal to the impact timestamp rather than departure time.
- Disabled option and absent actual-material rejection.
- Default physical coefficients (gravity 9.81, cloth friction .2, rolling length
  .00045, spin length .00035, cushion restitution .82/friction .15,
  cloth restitution .2) on actual finite table hulls. An explicitly prepared
  nonzero-spin incoming body reaches one cushion, releases, crosses an event-free
  finite CLEAR segment, and reaches full encoded REST at tick 4500883.
- Original deadline exhaustion cannot fabricate REST.
- Opt-in native tests comparing every world state/dense/diagnostic and journal word.

The default-material case uses an original smooth horizon of 8192 ticks and a
40-prefix work cap, with unchanged accuracy/admission budgets. The 16384-tick
horizon remains conservatively pending in this fixture; it is not promoted to
success. The smaller 4096-tick horizon also reaches REST but needs more prefixes.
That fixture is prepared-world, not raw. A separate request-bound actual raw
fixture in `tests/canonical-world-continuation.mjs` moves the selected cue to x=1.3
and uses angle 0, elevation 25, speed 1, tipX .2, tipY 0. With the same 8192-tick
horizon and cap 64, CPU raw production, one genuine cushion, departure and full
REST at tick 5628965 pass with the complete original four-ball roster. Its
allowKiss=true/minCushions=0 rules report a complete miss. This does not establish
complete rolling/airborne cushion coverage.
KISS coverage remains independently gated. Physical validity is separately tested;
neither Rapier trajectory matching nor a global enclosure receipt is used as a
release prerequisite.

CPU route/regression run: 20 passed, 8 native-only skipped; typecheck clean.

## Native actual-raw checkpoint

The focused actual-raw fixture passed **2,916/2,916 exact CPU/GPU words**,
including raw handoff, full world/dense/diagnostics, journal/auxiliary journal,
rules and compact result. The full encoded REST tick is 5628965, one genuine
cushion event is retained, and every body's velocity and surface spin is zero.
There are zero intermediate readbacks and zero host physics phases.
Pre-run production source hashes match this committed checkpoint. Source edits
were held until the terminal result; later inactive-gating edits are a separate
qualification.

- World compile: 63.602 s; lazy cushion resolver compile: 74.450 s.
- Submit-to-done: 3.609 s; total bounded process: 150.328 s.
- Sampled aggregate RSS: 1136.86 MiB, under the 1500 MiB limit.
- Execution watchdog: 240 s inside the shared native lock.
- Encoded dispatch commands: 22,297; buffer clears: 2,112.
- World/journal/rule allocation metric: 339,392 bytes, including cushion-bank
  assets but excluding resident raw producer allocations; this is not total
  process memory.

The initial cold combined compile exceeded a 120-second watchdog without parity
evidence. Two 300-second lock waits expired before execution (not simulation
failures). The successful run used an 1800-second lock wait and the unchanged
240-second actual execution limit.

These timings are single-sample software Vulkan SwiftShader observations,
not hardware performance claims. The prepared-only native tests remain available
but this checkpoint is the stronger complete four-ball actual-raw path. This
checkpoint does not claim complete cushion coverage, KISS authorization for
collided paths, or deployment/default-engine approval.

## GPU-owned inactive-bank gating (separate qualification)

The owner phase remains direct. It writes candidate-local indirect arguments for
all 25 heavy phases: 20 single-workgroup commands and 5 complete-roster commands.
Only the direct owner writes the shared config; heavy passes bind it read-only or
only consume it as indirect arguments. Unknown dispatch shapes are rejected.
Inactive or invalid-owner inputs copy original state/dense, clear exposed
entry/response/proof/descriptors, and execute zero heavy workgroups. Active
arithmetic shaders are unchanged. There is no host activity predicate or extra
readback. This is single-bank gating, not per-candidate batch/tile gating.

World `cushionIndirectDispatchesEncoded` counts commands, not executed workgroups.
For a four-ball inactive bank encode, the previous 40 heavy workgroups become
zero; the direct owner still executes. The total encoded command count therefore
need not decrease. The extra descriptor clear makes 14 clears per bank encode.

Component qualification passed 18,936 exact words (finite CLEAR and
active/inactive/invalid-owner/active reuse), with unchanged source hashes.
Full actual-raw world qualification of this optimization also passed all 2,916
words, with identical REST tick 5628965 and unchanged source hashes before/after.
The world metrics record 1,600 encoded indirect commands, 22,297 total commands,
2,176 clears, and 339,440 allocated bytes (48 bytes more for two config banks).
The bounded process took 150.634 s with 1133.94 MiB sampled aggregate RSS.
World compilation took 68.816 s, cushion compilation 70.639 s, and submit-to-done
2.857 s. These are separate single-sample SwiftShader observations; the measured
work-elimination property is zero heavy workgroups for inactive banks, not an
asserted general timing speedup. CPU regressions remain 20 passed/8 native skips;
typecheck passes.
