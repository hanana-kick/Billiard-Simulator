# Fixed audited impact runtime: eight bindings

This test-only profile admits exactly rows 219 and 522, with the previously
verified raw five-parameter values, and requestedH=192 baked before initialization.
The h2/h8 six-row and h8/h64 two-row profiles remain distinct and unchanged.

- Source kind: `resident-raw-tip-impact-initial-only-runtime-v1`.
- Microcode kind: `resident-raw-tip-impact-microcode-runtime-v1`.
- Source serializer/assertion: `serializeRawTipImpactPcRuntime` and
  `assertSerializedRawTipImpactPcRuntime`.
- Microcode assertion: `assertMicrocodeTipImpactRuntime`.
- `plan.audit` is the fixed `resident-tip-impact-checkpoint-layout-v1` returned by
  the source observer; `vm.eventAudit` must be true.

## Binding and authority contract

Original source PC begin uses six bindings, with event audit at **source binding
5**. Core VM and all three external handlers use eight bindings: immutable
microcode5, VM state6, actual event audit7. Initializer bindings are unchanged.
The runtime checks the actual device supports eight storage bindings before any
shader compilation or allocation. No source-ID/GPU-binding-number substitution
is made in the original physics helpers.

The audit buffer is allocated fresh and GPU-zeroed, with **no host upload path**.
Its GPUBuffer must differ from every world/program/geometry/scratch/input/code/VM
buffer. Metadata cannot contain an uploaded tape or expected state. The event
prefix remains 64 rows per candidate (2056 total words); larger snapshot storage
cannot enlarge this cap. Two full-bank slots at h128/outer2 and h192/outer3 follow
that prefix. Source state length and all original rule horizons remain unchanged.

Each diagnostic capture copies world, VM and the **entire actual audit buffer**
to a separate diagnostic allocation. The retained session does not map between
pumps. A single final map returns checkpoint `auditWords`; unaudited profiles do
not gain that field, and missing audit storage never falls back to an empty tape.
The source observer and assertion-only comparator separately establish completed
outer boundaries, real tip emission and rejected-lane emptiness.

## Host proof and remaining gate

`tests/resident-candidate-tip-impact-runtime-tests.mjs` checks six/eight binding
routing, source5 versus GPU7, fresh-zero/no-upload behavior, full tape-and-tail
copy persistence, unchanged source/VM lengths, one final map, alias rejection,
actual binding limits, and strict fixed-cap/layout admission. Its marker writes
are deliberately nonphysical transport tests; they do not claim real events.
Existing runtime/cache/operand-load host tests cover unchanged seven-binding
behavior. No source f64 helper, numerical profile, macro body, scalar-VM opcode or
control-cache semantic changes are part of this port.

Native audited192 execution, actual row219 tip tape and all original source/clock
comparisons remain required. This checkpoint is not full-rest, late-foul, 1024-row
or hardware-performance qualification. The old h320/h384 observer is untouched.

## Authentic source compiler checkpoint

The separate `resident-candidate-tip-impact-compiler.mjs` host gate lowers the
freshly admitted, genuinely instrumented count2/h192 source, not synthetic
transport descriptors. It verifies all three macro approvals against both the
unobserved audited dispatcher and canonical source closures. The complete source
lowers to 135,571 static scalar instructions, with 7,786 packed local words and
call depth15; 46 static audit-store and10 audit-read sites remain reachable.
Those are instruction sites, **not measured emitted events or execution counts**.

The cached eight-binding core and all external shaders parse. Removing only the
audit declaration from each external shader exactly recovers the corresponding
seven-binding shader, including numerical helper bodies and handoff protocol.
The initial-only compiled artifact contains bytecode/configuration and source
identities, no world banks or future snapshots. Curated identities are recorded
in `docs/evidence/resident-tip-impact-compiler-proof.json`. Two host groups pass;
no shader pipeline or physical recurrence is executed by this compiler gate.

## Local diagnostic prerequisites (not standalone regressions)

The two diagnostic test files above currently depend on untracked local `/tmp`
artifacts. A fresh checkout alone cannot run them. The reported passes were made
against already prepared local artifacts; they are not claims of standalone CI
coverage. Missing or mismatched input must fail, not skip or silently substitute
a synthetic source. Do not regenerate artifacts over evidence of an active run.

- `resident-candidate-tip-impact-runtime-tests.mjs` reads
  `/tmp/resident-raw-pc-isolated-native-v2/runtime.v8` and
  `/tmp/resident-native-strike-continuation-v1/runtime.v8`. Their source-owned
  generators are the **host-only prepare** commands below. This test deliberately
  derives transport mocks from those layouts; it does not execute the resulting
  mock shaders or establish a real 192-h trajectory.

  ```sh
  node tests/resident-candidate-raw-world-pc-isolated.mjs prepare /tmp/resident-raw-pc-isolated-native-v2
  node tests/resident-candidate-strike-continuation-fixture.mjs prepare /tmp/resident-native-strike-continuation-v1
  node --test tests/resident-candidate-tip-impact-runtime-tests.mjs
  ```

- `resident-candidate-tip-impact-compiler.mjs` requires
  `/tmp/resident-tip-impact-observer-source.v8`, pinned to SHA-256
  `0100d54ceeffc33c7aa46c2da705d7fd6d036b9a3b1b977206df64dffbc03c5c`.
  Its prerequisite was a host preparation using `createTipImpactFixture()`, then
  `createTipImpactSourcePlan({initializationPlan, rows})` and
  `composeTipImpactSourcePlan(g, {limits})`, with planned limits 128 MiB per
  storage binding and 256 MiB per buffer. Only this exact ordered object was
  V8-serialized: `{code: source.code, entry: source.entry,
  originalCode: source.originalSource.code, sourceBytecodeHash: sha256(g.pc.bytecode),
  sourceStateWords: g.pc.totalStateWords, count: 2, maxH: 192}`. No seed, expected
  bank or future snapshot belongs in that payload. Run the compiler diagnostic
  only after verifying the pinned payload; it writes the initial-only compiled
  artifact and diagnostic report back to `/tmp`.

  ```sh
  node --test tests/resident-candidate-tip-impact-compiler.mjs
  ```

The new isolated impact coordinator prepares authentic source, initial-only
runtime and separately stored expected evidence afresh. Its own source-owned
preparation/validation is the intended reproducible gate; these local diagnostics
must not be advertised as substitutes. Native execution and publication require
their separate authorization and unchanged numerical/assertion gates.
