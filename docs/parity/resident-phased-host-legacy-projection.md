# Historical operand-load HOST text projection

The failed aggregate from the inventory checkpoint is preserved in
`docs/evidence/resident-maintained-test-inventory-host-v2.json`. At source
`5333749`, the unchanged historical test expected the pre-phased canonical HOST
function text after removing two exact earlier preparation guards. Commit
`bc1258664c2b0f13e792dd9f3cde17c67a54c238` added opt-in phased numeric transport to
that function; default generated legacy shaders were not thereby new profiles.

The separate TEST-only repair in `resident-candidate-microcode-operand-loads.mjs`
uses `resident-microcode-phased-host-projection.json` to reverse exactly seven
reviewed text changes from that commit:

1. The new optional helper callback-name admission.
2. Waiting-macro tail guard.
3. The complete uninvoked `numericAdvance` helper block.
4. Inactive-tail guard and the original following-line indentation.
5. Active-tail status guard.
6. Active-tail opcode guard.
7. The guarded phased `NUM_EVAL` branch and original `if` spelling.

Each replacement has exact current/prior bytes and SHA256, requires exactly one
occurrence, and is enclosed by exact current and pre-phased whole-function
hashes. The pre-existing two-preparation-guard projection is then applied and
must recover the **unchanged** original historical hash. No projected text is
executed; no arbitrary branch or whitespace removal is allowed. The original
operand-load baseline JSON and production implementation remain unchanged.

Separate tests require all four historical configurations to lack continuation
mode/descriptor/tail fields, exercise their existing admitted or unsupported
`NUM_EVAL` behavior, and fail if the optional phased callback runs. Changed,
duplicated or missing reviewed text rejects. All four original generated shader
identity assertions remain intact. Current opt-in phased behavior is tested
separately by the maintained numeric-continuation and numeric-VM suites.

This patch was prepared during a numerical quiet hold and tested only after
explicit release. On `37afc58`, the focused historical/current phased group
passed **21/21, 0 skips** (2.401 s); the guarded default HOST list passed
**270 tests, 0 failed, 7 skipped** out of 277 total (17.880 s). The earlier
failed 275-test aggregate remains unchanged in its separate evidence file.
The added two projection tests account for the increase. Source suites and
actual browser/GPU execution were not run. See
`docs/evidence/resident-phased-host-legacy-projection-v1.json` for exact hashes
and counts; this is not numerical release qualification.
