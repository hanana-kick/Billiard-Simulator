# Explicit inverse GPU search coordinator

`createInverseGpuSearchCoordinator` is an opt-in same-realm service. The existing
public `OptimizerService` and its default CPU inverse path are unchanged.

```js
const service = createInverseGpuSearchCoordinator({
  backend: 'webgpu', R: originalRapier, controller, decoder, device,
  req, onProgress: report => { /* owned original result-shaped report */ }
});
const report = await service.run();
service.cancel();
// Explicitly acknowledge that interrupted physical jobs restart from h0:
if (service.resume({restartPhysicalJobs:true})) await service.run();
await service.dispose();
```

The request must select `searchAlgorithm: 'inverse-constraints'`, four-ball carom,
and an original finite positive `solveTimeMs` (default20,000ms). It must contain the
current source's full `snapshot({trails:false})`. The source must be paused,
motionless, without cue/pending game/windup/cooldown, with the requested selection.
The service owns the request but not the visible controller, decoder or device.
`run` is exclusive per instance and per device; disposal waits for cancellation
and GPU cleanup. Only explicit cancellation or planner continuation can resume. An interrupted
physical job is not a numerical GPU continuation: its owner/scorer/observer was
disposed, and the pending job must restart from h0. Unsupported/error/stale work requires a new request.

## What computes where

- **CPU static geometry:** unchanged `LabInverseGeometry` and
  `LabInversePlanner.planWave` / `commitWave`, with original topology, root-solver
  order, constraints and budgets. No legacy sampler is invoked.
- **Original CPU static queries and strike admission:**
  `inspectOriginalInverseInput` executes the original inverse begin/finish path
  without advancing. It uses only freshly restored private worlds whose `step`
  method throws, plus tracked native world/queue cleanup. No global engine hook is
  changed. Clearance-only jobs and genuinely rejected strikes retain their exact
  original outcomes, including signed constraints, reasons and zero physical steps.
  Accepted static inspections are disposed, never stepped or reused for physics.
- **Original source preparation:** accepted jobs use the cohesive current-source
  capture/import/admission helper. This performs native static creation/query and
  read-only import, not native forward simulation.
- **GPU physical evaluation:** accepted jobs are grouped in at most four-owner
  waves through the accepted `evaluateInverseGpuWave`. Original post-creation
  static clearance/inequalities must agree exactly; disagreement is an explicit
  coordination failure, not a substituted constraint or physical miss.

A planner wave may contain more than four probes. The coordinator keeps all of
its original IDs/order, handles static outcomes, executes bounded physical chunks,
and calls `commitWave` once only when the entire original wave is available.
Unlike the original worker service's between-wave deadline check, this opt-in
service also arms a wall-clock timer. A slow physical wave is interrupted at the
requested deadline, reported as `time-limit` (not user `cancelled`), and its
incomplete planner wave is not committed. Completed pending jobs remain available
for explicit resume with the original planner continuation. No interrupted
candidate is converted to a miss and no physical horizon is shortened.

A budget notification is emitted as soon as the timer runs. An already submitted
GPU operation, source import or construction must drain before resources can be
released, so this is not a hard real-time cleanup guarantee. After budget expiry
no new physical step starts; at most the in-flight committed step finishes. The
bounded current operation/cleanup latency is distinct from active solving time.

## Failure, cancellation and result semantics

The original planner result shape remains, with backend/accounting diagnostics.
A GPU unsupported/error is **not** submitted to the solver as a physical miss.
The service stops partial with `gpu-unsupported` / `gpu-failed`, preserves only
previous complete planner commits, and never claims exhaustive/no-solution proof.
Cancellation preserves completed planner waves and accepted pending job outcomes.
It does **not** retain an interrupted physical owner. Such reports set
`physicalStateRetained:false`, `restartRequired:true` and `continuable:false`;
`resume({restartPhysicalJobs:true})` explicitly acknowledges a fresh h0 replay.
Repeated identical short budgets can make no physical progress. This checkpoint
must not be advertised as interactive numerical pause/resume. A future retained
GPU session needs a separate bounded ownership contract. Source identity/time/steps/shots/selection/readiness
changes invalidate results; stale reports contain no publishable shots.

The caller still owns search-generation/user-intent invalidation and result commit
into the UI. Progress callbacks are synchronous and receive detached reports.
The service does not call native `advance`, `stepTrial`, a worker CPU fallback or
any alternative search algorithm. Cancellation is reported as cancellation even
when an independent GPU owner committed a whole substep before observing it.
`lastGpuWave` diagnostics retain only outcome status/committed counts, not a
fabricated partial score.

## Acceptance and remaining work

Host tests execute the **real planner** with controlled geometry/evaluation
contracts:20 mixed jobs, exact original IDs/order,3 four-owner chunks, deadline interruption without partial-wave commit, static-only waves, cancellation/resume, device lease/disposal,
source changes and unsupported/error isolation.8/8 pass. The genuine native static
inspector test matches original clearance/rejected/accepted constraints and
prohibits forward steps;1/1 passes. Existing planner regressions6/6 also pass.
These are not claims of completed native GPU search or a positive goal.

`inverse-gpu-search-coordinator-native.cjs` passed actual lifecycle coverage:
genuine source/planner/preparation, real GPU dispatch followed by **explicit
cancellation**, no native forward calls, no partial planner commit and native
buffer cleanup before device destruction. It must stay labeled cancellation
coverage, not successful search acceptance.

Remaining acceptance before public activation:
1. Completed genuine positive-goal coordinator result, original planner-prefix
   comparison and independent original fresh verification through physical rest.
2. A stated bounded ordinary search budget/domain, then wider admission coverage;
   runtime unsupported branches must remain visible rather than hidden as misses.
3. Browser dependency/asset packaging for the experimental owners and pinned
   decoder, WebGPU capability/device-loss behavior and actual browser lifecycle.
4. Explicit UI/service hookup, responsive progress/cancellation/source-generation
   invalidation and result commit, followed by full real-app/browser regression.
5. Worker transport/authority design if moving away from the accepted same-realm
   boundary. Current prepared candidates intentionally cannot be serialized.

A known genuine positive holdout exists at positions1=(-.5,0),2=(-.8,.4),
3=(.0435,.0435),4=(.2615,-.2), current settings angle0/elevation8/speed2/tip0.
Original full rest5480h scores+1 without opponent contact. However the unchanged
planner's ordinary direct topology seeds are approximately(-.49419°,1.42756) and
(4.33572°,4.5), not the current successful controls. Merely setting that known shot
is not proof that the planner finds it within a short budget. Original CPU planner
tracing must establish candidate/wave cost before a longer positive GPU acceptance.
No seed injection, physics change or artificial horizon reduction is permitted.


## Actual lifecycle and original CPU positive trace

The first native integration attempt was preserved: it refused the original
solver's `residual` purpose before any physical GPU work. The whitelist was
corrected to the solver's actual `residual`, `jacobian`, `trial`, `verify` purposes
(and manual `evaluate` / static `clearance`), retaining original labels and
verify-only certification. No formula, seed or physics was changed.

The retry passed genuine planner → static inspection → cohesive preparation →
actual GPU continuation → **explicit cancellation**. The owner committed14h;
planner commits/evaluations stayed0; native forward calls0. All tracked native
buffers were destroyed before device destruction (live0, peak623 buffers /
5,571,292 requested bytes). Total16.52s; sampled RSS about552MB. The returned
report explicitly required physical restart. This is cancellation/cleanup
coverage, not a completed search or positive GPU goal. Native wall-budget expiry
coverage remains separate from the passed host timer contract.

A separately labeled original-CPU-only trace used the positive holdout above,
ordinary fixed8°/spin-off/speed.5–4.5 options, `allowKiss:true`, maxCushions0,
maxKisses0, horizon8 seconds, and a20-second search budget. It completed naturally
in3.250s (4.059s including baseline and fresh verification):4 original planner
waves,9 evaluations,61,979 outer physical steps /65,129 native solver substeps,
and1 verified result. The first genuine geometric root succeeded without seed
injection: angle-0.4941926608278209, elevation8, speed1.42756406625702, zero tip.
Its separately requested verification and independent fresh original replay both
succeeded through full rest (5,350 outer steps /5,980 observed solver substeps).
The current0°/2 setting was only the known-positive baseline, not a planner seed.

CPU evidence: `/tmp/inverse-positive-planner-trace-20s.v8` and `.json` (all original
completed outcomes, wave IDs and settings). The original source stayed unchanged.
The high-speed second root consumed extra Jacobian/horizon work. Same complete
9-job GPU execution is estimated55–95minutes from measured observer throughput;
reaching the first verified archive still requires the first2 complete planner
waves,7jobs /49,139 solver substeps, estimated40–75minutes. No such long GPU run
has been started. Ordinary20-second GPU slices cannot finish these jobs with this
restart-only service; a sufficiently long explicitly budgeted run or retained
physical continuation is needed. This is a cost estimate, not a speed claim.

## Actual 20-second wall-budget expiry

The same genuine native planner/preparation/GPU harness also passed with
`GPU_COORDINATOR_BUDGET_TEST=1 REQUIRE_WEBGPU=1`, a real 20,000 ms original budget,
and **no user-cancellation trigger**. The timer reported `time-limit` at
20,004.98 ms, before the drained wave was published; `run()` returned after
20,018.06 ms. This measured notification/drain behavior is not a hard real-time
promise for other devices or long non-interruptible constructors.

The physical owner committed 39 substeps across 1,135 queue submissions before
abortion. The original planner committed no interrupted work: `tested=0`,
`gpuEvaluations=0`, and no cached candidate outcome. Native forward calls were
zero. The source snapshot remained exactly unchanged. The report explicitly had
`stopCause=time-limit`, `restartRequired=true`, `physicalStateRetained=false`,
`resumeMode=planner-continuation-physical-restart`, and `continuable=false`;
implicit `resume()` was rejected. This is budget/cleanup acceptance, not a
completed search, successful goal, numerical pause, or repeated-slice progress.

After drain, before device destruction, tracked live buffers and bytes were zero
(peak 623 buffers / 5,571,292 requested bytes). Total test duration was 20.56 s;
end-of-run sampled process RSS was 624,402,432 bytes (not peak RSS). Evidence:
`/tmp/inverse-coordinator-native-budget20s.log`. An initial shell launch failed
because `/usr/bin/time` was unavailable, before any numerical process started;
that output is preserved in the sibling `-launch-error.log`. The retry used Node
process memory reporting. No long positive GPU search was launched.
