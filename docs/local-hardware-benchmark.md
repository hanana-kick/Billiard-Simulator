# Local paired browser benchmark (not hardware evidence)

This optional diagnostic does not change the application/default engine. Its explicit
`pipelineRevision` is **0850a4d**, not the later host128 or cushion/KISS extensions.
It is not a substitute for the actual-app release/browser tests.

## Build and run

From the repository root, with the existing pinned local dependencies installed:

```sh
node tools/hardware-benchmark/build.mjs
node tools/hardware-benchmark/check.mjs
node tools/hardware-benchmark/serve.mjs
# Open http://127.0.0.1:4179 in your own browser; click 측정 시작.
```

Build output defaults to `/tmp/billiard-hardware-benchmark`; both build and server
accept an explicit output directory as their first argument. The server binds only
127.0.0.1 and only serves an allowlist. No external CDN, installation, remote desktop,
telemetry, upload, or automatic download is involved. Export JSON is a user button.
Keep the output together when moving it to another computer, and serve it on that
computer's localhost (or an independently arranged secure origin). `file://` is not
supported. No automatic publishing is performed.

The build extracts the CPU dependency graph from local git commit **0850a4d** into
a temporary directory; it does not use the moving CPU implementation. It bundles
the independently frozen experimental GPU pipeline, whose shader pins are verified
at runtime. Source hashes, worker hash, fixture hash and reference hash are included
in the manifest. Missing local git history causes a failure, not silent substitution.
The test helper is local CPU-only and is not exposed by the HTTP server.

## What is compared

* Immutable four-ball scene and raw/template SHA256 identities match the existing
  scale CPU reference. N1/3/32 use the first N unique candidate IDs in that reference.
  Parameters cycle through angles 0/90/330, speed .5, elevation 25, tip (.2, 0).
* Optional N256 must be explicitly selected. No arbitrary widths, full per-tick
  trajectories, or unbounded candidate buffers are allocated. Each lane has a fixed
  128-event diagnostic journal. This is a narrow mixed REST/pending domain, not a
  goal guarantee or complete search coverage.
* Each N first compares all **2916 u32 words per candidate**, CPU/reference/GPU,
  exactly, and hashes the exact words and candidate list. Failure aborts reporting
  a successful ratio. Timed GPU repeats use compact-only 16-byte/lane readback and
  compare every compact result. CPU compact repeats are also checked.
* CPU is one JavaScript worker, sequential, **not all-core CPU throughput**. Timing
  includes its batch allocations and algorithmic journal/history overhead but skips
  additional full diagnostic serialization. GPU timing includes per-run allocations,
  upload calls, encoding, submission, waiting, compact readback and teardown.
* One warmup per N; 3/5/7 measured repeats; alternating CPU/GPU order; raw samples
  and min/median/max retained. Compilation is outside repeated run timing. Keep the
  tab visible and other GPU workloads idle; thermal/JIT/browser variance remains.
* The exported supported-domain envelope explicitly retains missing cumulative
  work/event accounting. Stop terminates the worker; submitted GPU work may still
  finish asynchronously. Long compile/run times are not silently timeout successes.

## Timing semantics and calibration

`factoryWallMs` and `engineCompileMs` distinguish overall pipeline setup from the
engine compilation timer. `hostPrepareMs`, `encodeMs`, `submitToQueueDoneMs`, and
`readbackMs` come from the engine. Instrumented `uploadHostCallMs` is only synchronous
`queue.writeBuffer` host-call cost, **not device transfer duration**; it overlaps
host preparation, so do not add it again. `submitHostCallMs` is similarly part of
queue time. Queue-completion wall time is not an isolated shader GPU timestamp.

The in-report ratio is same-browser sequential CPU wall time / selected WebGPU
compact end-to-end time, for that N only. It is **not** a software-WebGPU versus
physical-GPU calibration. WebGPU availability never establishes hardware.

For a genuinely paired software/hardware investigation, run the *same built folder*
in both explicitly characterized environments, keeping workload/N fixed, then export
both JSON files manually:

```sh
node tools/hardware-benchmark/compare.mjs software.json selected-adapter.json
```

The comparator rejects different worker/fixture/reference/candidate/result hashes.
It prints observed A/B medians and ratios only for matching N. This is the measured
factor `T_A(N) / T_B(N)`; no global factor or unpaired cloud-to-hardware reverse
estimate is produced. A fallback request may return no adapter. Adapter info fields
and fallback status are recorded only when actually exposed; absent values are null.
Even `isFallbackAdapter:false` does not independently attest a physical GPU. External
hardware/driver evidence and a real paired run remain necessary to call a ratio
hardware acceleration. Exports always leave physical-hardware verification false.

## Local verification recorded 2026-10-27

* Build succeeded; two builds produced identical worker, fixture and reference hashes.
* Frozen CPU exact checks passed N1/3/32: **104,976 words** total; compact reruns matched.
* No-WebGPU worker smoke test reports failure with explicit unavailable explanation
  and `adapter:null`; no measurement is fabricated.
* Sandbox-preserving `/usr/bin/chromium` Playwright launch failed before opening the
  page (`socket() failed: Operation not permitted`, crashpad initialization). Browser
  UI/download execution and browser GPU execution remain **unverified here**.
* A supported `require_escalated` retry, still preserving the Chromium sandbox,
  also failed before launch: sandbox wrapper could not create its session mount on
  a read-only filesystem. No restricted directory was read and no sandbox bypass
  was attempted. The browser verification blocker remains.
* The existing cloud browser also could not reach the loopback server, and does
  not permit local-file navigation. No benchmark page or worker was executed through
  that browser, and no alternate protocol/security bypass was attempted.
* No native GPU lock or physical GPU was used. Existing native SwiftShader evidence
  is software only. The user's requested physical CPU/GPU calibration remains open.
