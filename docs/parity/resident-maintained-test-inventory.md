# Maintained resident test inventories

## Current additive HOST guard

The TEST-only committed-RET pause/resume suite is now in the maintained default
list, bringing it to50 modules. It uses only committed source/fixtures and
checks default-off semantics, exact post-RET commit/yield accounting, repeated
resumption, malformed returns, external waits and callback errors. It does not
execute a GPU or the costly withdrawal recurrence. Historical counts below
retain their original source boundaries; a new aggregate is reported separately.

This inventory updates the `5333749` source boundary. It does not replace native
receipts, historical shader profiles, or the release gates document.

## Default deterministic HOST contracts

`npm run test:resident:host` uses the explicit ordered list in
`tools/run-resident-qualification.cjs`, serial Node test execution, a fresh
runner-owned temporary directory, scrubbed native/private-input environment,
and the unchanged HOST import/child-process guard. There is no filename glob.
Missing listed files are errors, not skipped discovery. An inherited native
opt-in, private capture, preload, or adapter setting cannot activate a new path.

The eight additions are:

| Test module under `tests/` | Scope |
| --- | --- |
| `resident-candidate-worker-host.mjs` | Fake backend request/generation/cancel/loss and atomic wire-publication contracts |
| `resident-candidate-worker-client.mjs` | Fake in-process Worker client lifetime contracts |
| `resident-candidate-worker-backend.mjs` | Fake runtime/decoder/device adapter ownership contracts |
| `resident-candidate-microcode-numeric-continuation.mjs` | Small source-derived graph helper scalar differentials, malformed input and retained-phase guards |
| `resident-candidate-microcode-numeric-vm.mjs` | Small HOST VM/graph continuation transport differentials and exact source/layout profiles |
| `resident-candidate-inline-graph-compile-tests.mjs` | Compile-only payload/source pins and opt-in rejection before any file/device request |
| `resident-candidate-phased-graph-compile-tests.mjs` | Phased compile-only payload/source pins and the same early rejection |
| `resident-candidate-inline-graph-pilot-tests.mjs` | Bounded pilot/source admission negatives; no pilot runs |

These add 39 tests. The runner admission suite also adds three tests, including
missing input/dependency, altered provenance, unknown option and forbidden
entry-point cases. Neither a fake Worker nor a scalar graph differential proves
a module Worker or physical GPU trajectory. The compile-role tests do not
compile native pipelines. Their imported runner exposes a native entry only
behind an explicit opt-in; the HOST guard independently rejects GPU imports.

## Explicit source suites

`npm run test:resident:source -- --suite=NAME --plan ...` validates the named
suite's files and all required inputs without executing it. Replace `--plan`
with `--confirm-source` only when the costly work is separately scheduled.
There is no default, `all`, arbitrary Node argument, browser or GPU mode.
All input paths must be explicit absolute paths; inherited paths are scrubbed.
The same HOST guard and serial test execution remain in force.

| Suite | Required options (in addition to suite/mode) | Exact scope |
| --- | --- | --- |
| `three-components` | `--decoder-provenance`, `--three-capture-prefix` | Existing split pre-CCD/produced-roster components |
| `three-first-h` | Same | Existing genuine-three first-h source gate |
| `three-native-represented` | `--decoder-provenance` | Existing independent original CPU/WASM represented first-h comparator |
| `scale-artifacts` | `--artifact-root` | Existing frozen 8/9 artifact admission/comparator replay and decision mocks |
| `retained-owner` | `--decoder-provenance`, `--original-capture` | Genuine original initial-source construction for two banks, then fake-device retained lifecycle/publication negatives |
| `three-second-prefix` | `--decoder-provenance` | Genuine h1 to second-h prefix only |
| `three-current-empty-pairs` | `--decoder-provenance` | Current guard, BVH birth and empty-manifold components |
| `three-second-collision` | `--decoder-provenance` | Second collision/energy/current roster |
| `three-second-numerical` | `--decoder-provenance` | Current joint/spheres/post-CCD numerical components |
| `three-second-physical` | `--decoder-provenance` | Source-order final mass/BVH/current journal physical seal |
| `three-second-application` | `--decoder-provenance` | Same-bank source h2 application and every current CUE word |
| `three-retained-owners` | `--decoder-provenance` | Retained Guard/cache/physical work rearm, lifetime persistence and old-profile bytes; synthetic rearm cases are not trajectories |
| `three-retained-default-bytes` | `--decoder-provenance` | Portable exact frozen h2 source/initial/program/geometry/layout fingerprints |
| `three-retained-h` | `--decoder-provenance` | One authentic selected-2 bank, unchanged h1 bootstrap, same reusable h2/h3 advance and exact original CPU/WASM represented endpoints |
| `worker-http-assets` | `--decoder-provenance` | Local HTTP bundle bytes/MIME/hash checks; no browser |
| `browser-runtime-assets` | `--decoder-provenance`, `--original-capture`, `--baseline-runtime` | Node VM browser-like ESM plus genuine initial-source/bytecode/handler identity construction; no actual browser |
| `post-impact-represented` | `--decoder-provenance`, `--original-capture`, `--post-impact-root` | Original CPU/WASM h193 partial-outer projection against existing frozen HOST evidence |

The five new genuine-three suites each run their own explicit test module and
require the original two-h CPU/WASM observer child as a checked dependency.
They build a fresh authentic t0 input; expected native observations do not seed
the candidate. They are deliberately separate because each repeats costly
source construction. At this frozen source boundary their `secondH` capability
remains false: even the final physical seal is not the later application
adoption/complete second-h gate. Later application commits `7a5059e`/`7512e3a`
are not integrated here and their separate suite is pending, not implied.

Retained-owner tests are not inexpensive toy-device tests: before their fake
device lifecycle they authenticate the original captured world, construct two
genuine count-specialized runtimes, and encode over 136,000 initialization
commands. This is why they are explicit rather than part of the default list.

### Input admission

- Decoder provenance must identify an existing WASM whose digest matches and
  the bundled `vendor/rapier.cjs` engine digest. Package suites additionally
  require every relative decoder-source digest and an existing matching license
  notice file; the notices receive only explicit read authority.
- Original captures and comparison baselines are required files with recorded
  digests. File admission alone does **not** authenticate their contents. The
  underlying original fixture/profile assertions still enforce their pinned
  identity and semantics. The runner does not deserialize or repair brands.
- Browser-like VM tests receive the original capture and baseline explicitly,
  so their optional identity test cannot silently skip for missing paths. The
  only added Node flag is the suite-owned `--experimental-vm-modules`.
- The post-impact suite requires exactly `post-impact-profile-v1/initial.v8`,
  `post-impact-profile-v1/four-final.v8`, and
  `tip-impact-coupled-created-host-v1/expected.v8` below its explicit bounded
  root. Only those three files receive guard read authority. Missing comparison
  evidence blocks the runner rather than silently skipping the comparison.
- The original five new second-h suites use original CPU/WASM, not GPU. Source
  suite success cannot authorize a numerical native slot.

## Deliberately not launched

The actual Chromium/module-Worker test (`resident-candidate-worker-browser.cjs`)
remains outside both inventories. The earlier browser infrastructure failure is
preserved; this update does not retry it or claim Worker startup. Long inline/
phased full-world pilot coordinators and native compile/run coordinators are
not test entries. Their separate, explicitly bounded workflow and numerical
scheduling remain mandatory. No source suite is automatically run by release CI.

Default HOST's seven existing optional skips remain skips: one opt-in GPU case,
four private-artifact resource/allocation cases, and two Number-program
capture/created-world cases. No new optional skip is introduced by these eight
HOST modules. No import, plan validation, mock device, package check or source
component grants browser/native trajectory, full-rest, 1024-row or release
qualification. Default backend and optional manifest activation are unchanged.

## Recorded inventory check

At this checkpoint the default list has **49 modules** and the explicit source
inventory has **13 suites / 16 test modules**. The new suites were admitted by
mock runner contract tests, not executed as physics/source qualification here.

- Focused runner contracts: **16 passed, 0 failed, 0 skipped** (0.968 s).
- Guarded full default HOST run: **275 tests, 267 passed, 1 failed, 7 skipped**
  (18.107 s, exit 1). This is **not** a passing HOST checkpoint.
- All 39 tests in the eight new modules and the three new runner tests passed.
- The unchanged failure is the historical HOST function-text assertion in
  `resident-candidate-microcode-operand-loads.mjs:27`. Its existing projection
  removes exactly two preparation guards, but does not remove the later phased
  numeric transport added in `bc1258664c2b0f13e792dd9f3cde17c67a54c238`.
  Applying that exact projection to the function source before/at that commit
  gives respectively `f8b3c9ba3f255a549563f255765f7fabfed710c7c3cf21195a69a96c5df4e54b`
  and `a4cc6687791fec3417f0734016eef24619d70ec4e8b2769e18a7053657b9173d`.
  This inventory change leaves the original evidence, assertion and source
  untouched; it neither drops the failing test nor substitutes a new hash.

The separately tracked historical provenance assertion needs its own reviewed
version-bound repair. Browser infrastructure and numerical release gates remain
unchanged and unverified by this inventory update.

## Successor: separate second-h application suite

After the above passing repair checkpoint, this successor explicitly integrates
source dependency commits `7a5059e` and `7512e3a` unchanged and adds
`three-second-application` to `test:resident:source`. The current inventory is
therefore **14 source suites / 17 source test modules**; the 49-module default
HOST list is unchanged. Prior inventory/failure/result receipts remain snapshots
of their own source boundaries, not rewritten evidence.

```
npm run test:resident:source -- --suite=three-second-application --decoder-provenance=/absolute/decoder-provenance.json --plan
```

Execution additionally requires replacing `--plan` with `--confirm-source`
and separate scheduling. Admission requires the second-application source,
the original two-h observer child, and the complete current-cue oracle helper.
The suite starts from authentic t0, runs the same-bank source path through two
inner h steps, then compares original CPU/WASM observations, application fields
and all 2,678 current cue words. It completes zero outer steps. Its source
`nativeWholeHVerified`, runtime integration and GPU qualification remain false;
it is not general recurrence or full rest. This inventory update runs only its
runner admission tests, not the costly source suite itself.

Successor runner verification: **17/17 focused contracts passed, 0 skips**
(0.909 s); guarded default HOST **278 total, 271 passed, 0 failed, 7 skipped**
(19.573 s). One new admission test explains the increase. Exact receipt:
`docs/evidence/resident-second-application-source-suite-admission-v1.json`.

## Successor: reusable genuine-three retained source gates

Three additional suites are explicit opt-ins, bringing the current source
inventory to **17 suites / 20 test modules**. The 49-module default HOST list,
default application tests, CI and all numerical/native scheduling are unchanged.
No default/all convenience alias launches the approximately 82-second retained
physics/source gate.

```sh
npm run test:resident:source -- --suite=three-retained-owners --decoder-provenance=/absolute/decoder-provenance.json --plan
npm run test:resident:source -- --suite=three-retained-default-bytes --decoder-provenance=/absolute/decoder-provenance.json --plan
npm run test:resident:source -- --suite=three-retained-h --decoder-provenance=/absolute/decoder-provenance.json --plan
```

After separate HOST resource scheduling, replace only `--plan` with
`--confirm-source`. Use a disk-backed existing `TMPDIR`; the runner creates and
removes a child directory and retains the HOST import/child guard. All three
suites require explicit authenticated decoder provenance. The retained-h and
default-byte tests now honor that explicit environment path instead of requiring
a developer's sibling worktree path. Expected native fixture arrays remain
comparison-only and never seed the candidate. No inherited after-turn capture,
GPU variable or private runtime becomes an input. Original fixture helpers and
oracle/golden dependencies must exist; they are not independent suite entries.

The three existing direct-gate receipts are respectively **5/5**, **1/1**, and
**10/10**. The last uses the same compiled advance and one 73,920-word bank for
h2 and h3, with all five native physical bodies, full scene/BVH/roster, all
2,678 CUE words, joint/CCD numerical words, all 144 floor words, retained empty
cache recurrence and exact application/history comparisons. Its original
continuous PhysicsLab observer executes only three inner h steps and zero
completed outer steps. The admitted no-emission/inactive-CCD selected-2 domain
does not qualify general active contact, cue withdrawal, outer64, emitted
ThreeBallGame, full rest, a browser Worker or GPU. See
`resident-three-ball-retained-h-source-plan.md` and the release matrix.

This wiring checkpoint was authored during a native quiet hold without running
tests or source generation. After explicit hold release, frozen `a1ae4fa`
passed the real guarded entry points independently of the earlier direct runs:

| Gate | Terminal result |
| --- | --- |
| Focused HOST/source runner admission | 18/18 passed, 0 skipped; 0.970 s |
| Explicit retained owner suite | 5/5 passed, 0 skipped; 9.497 s |
| Explicit retained unchanged-byte suite | 1/1 passed, 0 skipped; 10.268 s |
| Explicit retained source h1/h2/h3 suite | 10/10 passed, 0 skipped; 77.879 s |
| Guarded default HOST | 279 total: 272 passed, 0 failed, 7 unchanged skips; 17.909 s |

All three explicit `--plan` admissions also passed. No import/child guard was
widened; no new optional skip or native job was introduced. Exact source/log
hashes, decoder/engine provenance and suite definitions are retained in
`../evidence/resident-three-retained-source-suites-v1.json`. The seven default
skips remain unqualified, not passes. These source-only results do not satisfy
the missing release-matrix domains above.
