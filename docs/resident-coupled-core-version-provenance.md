# Legacy macro core hashes: historical and preparation-disabled versions

The historical id0–2 test at integration `9451105` incorrectly required the
current complete VM core to retain the pre-preparation hash. The old receipt
`docs/evidence/resident-coupled-macro-admission.json` is retained **byte-for-byte**
(SHA `1dbfd8d1ba469d45bd2677cbc4e036dd19f16a258fd502e6dd51a3e9b7cafb35`).
No frozen runtime, shader, native result or production source was changed.

## Exact source boundary

Commit **`26cd3721c5b30152546e2a1245bff8df00aa0a7a`** appended
`GEOMETRY_NUMERIC_PREPARE` as ISA opcode **87**, following `EXTERNAL_CALL`86.
`generateMicrocodeVmWGSL` iterates the complete ISA list, so even the default
`intrinsics: 'none'` core gained a guarded **unsupported-op case**. It contains
no preparation helper closure or call. The later `fb038cd` candidate-lane guard
applies only to the explicitly enabled preparation profile, not this core.

For the historical test configuration (count2, locals32, stack4, instructions4,
entry0, budget4096, WGS1, storage control), this adds **exactly 258 bytes**:

- Seven local-slot range guards return localRange4 / invalid3 on bad operands.
- Otherwise the new opcode returns unsupportedPrimitive9 / unsupported4.
- Previously opcode87 reached the default unknownOpcode branch. Therefore this
  is not a claim that the new opcode's error semantics are identical, or that
  unchanged old-opcode behavior grants the new complete shader an old identity.

All three canonical source closures, approval objects and separate macro
handler shaders still match their historical hashes. Only the complete core
source identity differs in this comparison:

| Macro ID | Historical core SHA-256 | Current disabled-profile core SHA-256 |
|---:|---|---|
| 0 | `941d5e525bbdf6ad17a88433e08186de63ab6ac6be83232841f078c564aebd47` | `3fb55e44510e9960772dda2967f0e5b409ddd98359b2e62c19f6ce6ec2b1328d` |
| 1 | `045a45cdd5ab6e7f7b36718ec04d2ba5028be5d3bbec4c4e7e5e9b779c5b1f16` | `003298e16c2a6b3009ee63d66b70bf8c59f03ad46b9a3fedd80dbef488c50987` |
| 2 | `f04a423e7524906c2b3e754fbe5a1b2fd8447611858c7c841d5e0c437e0af05b` | `6f490024906e966d4cc69fc00564ab065766c902551d5846507b03da22f34b48` |

## Narrow test repair

`tests/fixtures/resident-microcode-legacy-core-profiles.json` records separate
historical/current profiles, the introducing commit, source-file hashes,
explicit test options, exact inserted text/hash and current complete core hashes.
The coupled-macro test separately checks:

1. The entire historical evidence file and existing source/approval/handler
   hashes remain unchanged.
2. Current full core bytes match their distinct versioned hashes, with no
   preparation helper/call, and **do not** match historical core identities.
3. Removing only the one pinned added case in a diagnostic in-memory string
   recovers **every preserved historical core hash exactly** (33,932 → 33,674
   bytes). This proves the text delta; the projection is never compiled,
   dispatched, exported or used to admit a historical runtime.

This is HOST source-provenance coverage, not a new native or physics result.
It also does not blame or qualify the separately optional Number-program macro:
the disabled-core mismatch already exists on untouched integration `9451105`.
