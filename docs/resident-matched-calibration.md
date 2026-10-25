# Matched hardware/software calibration bundle

## Scope and stopping boundary

This is a local diagnostic runner, not the production app. The only runnable
cell is the frozen accepted `135b168` workload: **six raw five-parameter rows,
four accepted and two rejected, two pre-strike physics h**, 16 owner kernels,
2,048 fixed sweeps, 101,082 dispatches per repeat. Original source caps,
precision profile, shader bytes, row order and phase order are unchanged.
It is not a full strike, full-rest/late-foul test, compact-result benchmark,
1,024-physical-candidate measurement, or universal numerical qualification.
The default CPU app, inverse planner, public qualification mask and deployment
are unchanged.

Preparation is complete after host checks and local export. **No new browser,
GPU, software-grid, server, upload or publication run is part of this checkpoint.**
Paired measurement awaits the selected physical GPU and explicit permission.
There is no measured hardware/software correction factor. The old native Dawn
SwiftShader timings are provenance only, not the numerator for a new browser
ratio: both reports must come from this identical browser bundle.

## Local artifact

Build (host-only; requires the pinned accepted local archive):

```sh
node tools/build-resident-calibration-bundle.mjs
```

Default output: `/tmp/resident-calibration-bundle/`. `README.txt` is the entry
instruction; `index.html` is the page. After execution permission is obtained,
serve the extracted directory on the selected computer using:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory /path/to/resident-calibration-bundle
```

Open `http://localhost:8765/` in a WebGPU-capable browser. Do **not** open
`file://.../index.html`: ES-module/fetch restrictions require localhost or an
otherwise authorized secure origin. This localhost command is an instruction,
not an already started server. There are no external assets, auto-run GPU work,
telemetry or upload functions. Inputs load only when requested; GPU work starts
only on the explicit measurement button. The report downloads locally.

## Measurement contract

- Same bundle SHA, runtime binary/source/shader/harness hashes, candidate rows,
  dimensions, command sequence, precision and timestamp mode on both targets.
- Record actual adapter vendor/device/fallback status, browser/version,
  features and limits. Known software adapters cannot be labeled hardware;
  missing adapter proof fails closed. Browser backend/driver details that are
  unavailable remain explicitly unavailable, not inferred from "native".
- Use matching browser/backend versions where available. Cross-host browser
  results are **measured end-to-end comparisons**, not isolated GPU multipliers.
- One cold run plus at least two fresh-buffer warm runs; all shader modules
  preflight before expensive pipeline creation. Cold compilation is separate;
  warm samples reuse identical pipelines but never prior output state.
- Direct end-to-end wall interval includes fresh allocation, initial upload,
  initialization, two-h pump and final state readback/validation. Encoding,
  submission, queue-drain wall wait, initialization, pump and readback are
  separately reported. Queue-drain wall time is **not GPU execution time**.
- Optional required `timestamp-query` measures the existing compute passes;
  if unsupported it fails explicitly. Choose the same explicit `off` mode on
  both targets if necessary. Missing or zero-resolution measurements are not
  fabricated. Raw timestamps retain implementation-dependent quantization.
- Initial-only data enters the GPU. Independent expected future states and
  comparators load only after GPU transport ends and the device is released.
  All 11 original-source state groups, rejected h0/PC/tail checks and identical
  fresh-repeat outputs must pass before any report is ratio-eligible.
- This diagnostic returns one full final state bank for independent checking;
  it does not claim the eventual compact terminal-output performance.

`report-template.json` deliberately contains null, unmeasured values and a
different kind; the ratio checker rejects it. Only runner-generated, source-
passing reports with identical workload keys qualify. The pair output gives
direct measured hardware time and category-specific median ratios; it never
predicts a full shot or assumes equal CPU costs on different computers.

## Planned dimensions are not runnable evidence

The page lists 1 / 16 / 64 / 256 / 1,024 only as **unmeasured allocation plans**.
There are no generated accepted payloads for those dimensions. The fixed
1,024 plan uses 512 + 512 tiles on both adapters; each world binding would be
129,191,904 bytes below the 128-MiB cap. This is arithmetic, not measured VRAM,
simultaneous execution, distinct candidate coverage, or throughput. Each new
cell needs its own original-source parity gate before paired timing.

## Host validation, not browser validation

```sh
node --test tests/resident-candidate-portable-payload-tests.mjs \
  tests/resident-candidate-browser-benchmark-runtime-tests.mjs \
  tests/resident-candidate-world-comparison-tests.mjs \
  tests/resident-candidate-calibration-report.mjs \
  tests/resident-candidate-calibration-controller.mjs
```

These check lossless portable data (including BigInt, special numbers, maps and
typed bits), accepted archive hashes, exact comparator extraction/replay,
mocked WebGPU transport/timing/error contracts, controller ordering and ratio
rejection. The mock controller returns archived words only to exercise the
assertion wiring; it is **not new physics execution or a measured report**.
Actual browser compatibility, physical-adapter precision, timing-query support
and paired performance remain pending authorized execution. Full real-app UI
tests and deployment are not claimed by this diagnostic checkpoint.
