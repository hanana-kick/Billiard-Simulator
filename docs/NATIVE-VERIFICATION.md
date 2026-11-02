# Optional native manual-shot path: verification and limitations

This source candidate is a partial functional improvement, **not an overall real-time performance qualification**. It does not establish general search performance, Mac/Metal behavior, or performance on a user's device.

## User-visible path

Build with `npm run build:release`. Open the resulting application, choose **GPU 실험 새 게임**, read the replacement warning, and confirm **배치·점수 교체 후 시작**. This explicitly replaces the practice scene/score. Manual preparation starts enabled only in this opted-in native session; the visible idle switch can disable it. Ordinary CPU mode is not silently replaced. No console command is required.

Initial GPU preparation and re-preparation have a disclosed maximum acceptance budget of five minutes, with progress and cancellation. This is a compatibility budget, not a startup-speed improvement. A timed-out asynchronous GPU compiler cannot necessarily be interrupted immediately; late completion must not install an owner.

## Observed verification

One local Linux Chrome 156 / SwiftShader run used trusted UI input, full-resolution rendering and unchanged timing thresholds. Cold preparation took **201.616 seconds**: within the current 300-second budget, **outside the former 180-second budget**. Earlier deadline and harness failures remain failures; this result does not erase them.

| Case | First changed pixel after Strike | Current-size REST bitmap after Strike | Playback buffering | Final canvas |
| --- | ---: | ---: | ---: | --- |
| Complete matching prepared result | 218.4 ms | 3,526.7 ms | 0 ms | 1248 × 516 |
| Matching preparation still pending | 3,100.7 ms | 6,247.8 ms | 0 ms after playback begins | 1248 × 516 |
| Edit away and back; stale preparation rejected | 754.9 ms | 8,368.7 ms | 4,583.1 ms | 896 × 516 |

The ready case required real idle computation beforehand: observed idle lead 5,204.1 ms, background run 4,355.5 ms. That work is not free or included in click latency. The pending case still delays first presentation. The edit case opened the manual sidebar to use genuine angle controls, so its viewport differs and it is not a geometry-matched timing comparison. Physical shot duration was approximately 3.188 seconds. **Ready-hit conditional acceptance passed; overall interactive acceptance failed.**

All three resulting worlds (2,916 words each) and original normalized CPU traces (82 × 2,048 words each) matched exactly for candidate IDs 4, 6 and 9. Candidate 9 was freshly computed from original inputs, never from GPU outputs. This is normalized CPU trace equivalence, not an assertion that the entire raw GPU trace serialization equals the CPU serialization. Original sampling incompleteness/held intervals remain explicit; no synthetic motion or CPU fallback supplies GPU results.

Two moved-prefix cancellation/reset cycles, exact-target stale preparation settlement, fresh full upload after invalidation, and final destructive reset passed. The retained GPU allocation contract is 9,051,588 bytes. Completed native runs retain 92 bounded runTo batch completions / 260 logical endpoints; these are not 92 GPU queue fences. The selected reference execution has 73 source queue fences. Late-prefix-after-cancel handling also has targeted HOST regressions; the final browser run did not itself observe a late post-cancel packet.

### Authenticated build identities

- Original physics source: `75c09c39e6d97085f4c4bf8045f0f892f121130d00340128101602de7df0e2df`
- Native program: `1a25d028c347bce2b081fa717b028ff102f9f2c26f7a24c44918065f7d609bec`
- Transform: `f4d43d5163e912d60169c72b9ee3a03bed399f3d716be013a7e1927673dbe0c9`
- Runtime: `d53ccaebe31d3d710226f2f03d23eb95b00db8af0c4ce13c4c8d187ee3f35e26`
- Controller: `d524ad7595b3915fa42b02432b42e6921f2d2d7c2f2fd9a169295acf8930b693`
- Worker: `706b244ef8897367b8d1cee539c1fbe860210159400bd4a0d614a2e59d69b20c`

## Reproduce source/build checks

From this checkout, install the locked dependencies, prepare the bundled engine, and build:

```sh
npm ci
npm run prepare:engine
npm run build:release
npm run typecheck
node --test tests/compiled-release-build.cjs tests/native-structural-integration.mjs tests/native-bounded-repeat-integration.mjs tests/native-superseded-core.mjs
```

The structural integration tests use authenticated original inputs retained by this checkout's successful `.compiled-build` release receipt. They fail explicitly if a build is missing. An explicit `NATIVE_TERMINAL_ORIGINAL_ASSETS` directory is supported for reproducibility, but no sibling experiment checkout is implicitly required.

The optional contact-completeness test needs an independently generated original CPU oracle. Generate one from this checkout after the build (the output directory must not exist):

```sh
node -e "const fs=require('node:fs'),path=require('node:path');fs.writeFileSync('manual-oracle-config.json',JSON.stringify({sourceRoot:process.cwd(),assetRoot:path.resolve('dist/canonical-controller-assets/wasm-gpu-programs'),outputDirectory:path.resolve('.verification/manual-candidate-3'),candidateId:3}))"
mkdir -p .verification
node tools/prepare-manual-ticket-cpu-oracle.mjs manual-oracle-config.json
NATIVE_MANUAL_CONTACT_ORACLE="$PWD/.verification/manual-candidate-3" node --test tests/prepared-manual-contact-completeness.mjs
```

Without this explicit oracle, only that optional case reports SKIP with an explanation; the remaining negative cases still run. The helper verifies the original physics source and input manifest before computing. It is test tooling, never imported by the application.

Historical header-copy/four-chunk A/B tests require explicit historical baseline directories via `NATIVE_HEADER_COPY_BASELINE` and `NATIVE_FOURCHUNK_BASELINE`. Without them, the four historical comparison cases report explicit SKIP; current implementation tests still run. Such skips are not evidence of historical A/B reproduction.

HOST tests, type checking and deterministic build checks do not substitute for real browser/GPU qualification. No deployment or publication is implied by this document.
