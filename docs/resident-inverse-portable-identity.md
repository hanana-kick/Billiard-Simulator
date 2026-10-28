# Portable inverse-observation identities

The four optional observation modules now use the independently tested
`source-sha256.mjs` rather than Node `crypto`. Their source/data identities, WGSL
and 256-byte record ABI are unchanged. The terminal codec also serializes Number
bits with intrinsic byte views instead of `Buffer`, and uses the existing owned
Uint32 validation instead of assuming a browser SharedArrayBuffer global.

HOST evidence: 20 source-SHA/codec/browser-global tests plus 8 genuine-initial
query/join tests passed. An independent Node-SHA copy of the same module produces
identical terminal contracts, raw input words, generated join WGSL, mapped-source
proof hashes and full mapped kernel SHA. Signed zero, subnormals, null fields and
nonfinite inequality bits retain their original semantics. Tests temporarily
remove Buffer/SharedArrayBuffer globals and still reject actual shared views.

This removes direct Node builtin imports from these four optional modules; it
is not a claim that every transitive application dependency has passed a browser
bundle gate. The Node-reference module loader is TEST-only. It performs no GPU
or forward physical evaluation. No default backend or qualification changes.

## Original world namespace adapter

`inverse-world-observation.mjs` now selects the existing Node CommonJS default or
the unchanged original `LabFourBallWorldExperimental` browser global via a
namespace import. The authenticated original world source is not transformed.
A focused no-Node ESM-realm test evaluates the actual unmodified world and this
exact shim; the selected API is the original global, with no synthetic default.
This tests the import seam, not the complete transitive browser bundle.

A separate authentic initial-only comparison regenerates all six observer
shaders (count1/count2 × initial/boundary/library) through both the old Node
binding and new binding. Every layout and shader byte/hash is identical. Two
HOST tests pass, without forward h, GPU or source-rule changes. Complete browser
closure/build and native physical qualification remain independent gates.
