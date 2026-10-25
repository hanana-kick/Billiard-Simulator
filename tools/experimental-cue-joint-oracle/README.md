# Pinned scalar cue-joint diagnostic

This is an observation-only Rust diagnostic, not the original WASM oracle and
not a replacement world solver. It exposes Rapier's unchanged scalar joint row
builder, modified Gram-Schmidt finalizer, warmstart, and row solve functions for
the two cue joints. It does not step a physics world or feed production gameplay.

Source pins:

- Rapier 0.36.0: `b716d375efc0201003f0cd9ef7168eee0b62c177` (JS engine 0.21.0).
- Rapier source archive SHA256: `67825e5487ff84582777132f1ede42e8b865984246825ba9de6ff07ed2a8fdb1`.
- Parry 0.31.1 archive SHA256: `7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e`.
- Original Apache-2.0 licenses remain intact in the copied source tree.

## Build isolation and provenance

Set these environment variables to prepared local directories/files:

- `RAPIER_SOURCE_ROOT`, `RAPIER_SOURCE_ARCHIVE`
- `PARRY_SOURCE_ROOT`, `PARRY_SOURCE_ARCHIVE`
- `CUE_JOINT_SOURCE_COPY`: a new, separate output directory
- `CARGO_HOME`, `RUSTUP_HOME`, `CARGO_TARGET_DIR`: prepared Rust cache and a separate build target

Run `node tools/experimental-cue-joint-oracle/build-native.cjs`.
`--check-source` verifies archives and source files without writing or compiling;
`--prepare-only` additionally creates and audits the isolated instrumented copy.
Builds are offline and Cargo.lock-pinned, with one compilation job.

The script verifies every archived Rust source, Cargo manifest, and license
against its pinned official archive. It copies Rapier without hard links, adds
one diagnostic module, and appends only a module declaration and a public
re-export. It verifies that all original source files in the copy are byte-identical
except those two append-only changes. The original source is checked again after
compilation. It refuses overlapping or unrecognized existing copy directories.

`cue-joint-oracle-provenance.json` in the target directory records the original
source manifest, individual helper/velocity/builder/rotation/integration hashes,
the observation-only patch hash, diagnostic revision, compiler, enabled features,
and resulting binary hash. The binary also reports the compiled-in patch hash.
Changing the instrumentation requires a fresh copy directory, never silently
modifying an already verified copy. The Node wrapper checks its current module
and host hashes against this proof before invoking the binary.

## JSON protocol

The executable reads one JSON request on stdin and writes `{metadata,result}`.
Use `--version` to inspect its provenance identity without running rows.
Every input floating-point leaf may be a JSON number (rounded once to f32), or
`{bits: uint32}` for exact bit input. Outputs use `{value: number|null,bits:uint32}`;
`bits` is authoritative for signed zero, infinity, and NaN. The wrapper exports
`f32Bits` and `floatValue` for conversion.

Input fields:

- `kind`: `flex` or `guide`.
- `frame1`, `frame2`: `{translation:[x,y,z],rotation:[x,y,z,w]}` in world space.
  Quaternions are used exactly as provided, without renormalization.
- `body1`, `body2`: `{world_com:[x,y,z],im:[x,y,z],ii:[m11,m12,m13,m22,m23,m33],linear:[x,y,z],angular:[x,y,z]}`.
  `ii` is the effective world inverse inertia, not its square root.
- `dt`: actual internal substep duration, finite and positive.
- `erp_inv_dt`, `cfm_coeff`: exact prepared joint softness coefficients.
- `max_corrective_velocity`: effective length-scaled maximum limit bias.
- Optional `limits`: guide linear-X bounds, default `[-0.08,0.13]`; ignored for flex.
- Optional `warmstart`: `{impulses:[...],coefficient,apply:boolean}`. The 4 or 6
  row seeds are multiplied by the coefficient in f32 after finalization; `apply`
  invokes the unchanged source `warmstart_generic` in scalar order.
- Optional `solve_iterations`: integer 0 through 8, default 1.
- Optional `remove_bias_before_solve`: default false; invokes the unchanged source method.

Flex mask 57 produces angular locks 0,1,2 followed by linear lock 0. Guide mask
62 produces angular locks 0,1,2, linear locks 1,2, and linear limit 0. There are
no motors, friction rows, or coupled axes. Each joint is finalized separately.

The result includes helper bases, cross matrices, linear/angular errors;
`rows_before_finalize`, `rows` (finalized with seeds), `rows_after_solve`;
post-warmstart velocities; each sweep's impulses and velocities; and final body
velocities. Helper matrices are arrays of columns. Rows contain all Jacobians,
inverse-inertia Jacobians, inverse masses, bounds, accumulated impulse, inverse
left-hand side, RHS with/without bias, CFM gain/coefficient, and writeback identity.
Writeback axes are source spatial DOFs: 0..2 linear, 3..5 angular.

## Bounded probe

Set `CUE_JOINT_ORACLE_BIN` to the built executable and
`CUE_JOINT_ORACLE_PROVENANCE` to its proof file, then run
`node tools/experimental-cue-joint-oracle/smoke.cjs`.
The eight probes cover four/six-row order, basic source effective masses,
interior/boundary/outside guide limits, coefficient-scaled warmstart application,
and exact signed-zero input. They do not prove world-step, contact, CCD, SIMD,
GPU, or original-WASM parity.
