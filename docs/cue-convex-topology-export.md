# Initial native convex topology export

`src/experimental-cue-convex-topology.js` copies the selected collider's native
`SharedShape::ConvexPolyhedron` geometry into an immutable, bounded plain object.
It does not construct a hull from triangles or points, step a world, query
contacts, transfer contact caches, or import native contact answers.

This is infrastructure for the experimental fresh cue contact path. It does not
establish manifold, solver, CCD, persistent-contact, or whole-world parity.

## Pinned source identity

- TypeScript Rapier engine: `0.21.0`, source revision
  `b716d375efc0201003f0cd9ef7168eee0b62c177`.
- Bundled engine SHA256:
  `fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4`.
- Parry crate: `parry3d 0.31.1`, source revision
  `3383f51cbbe9af70565427e7a66c605e1557c1fc`.
- Official Parry crate archive SHA256:
  `7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e`.

Relevant source files are Parry's `src/shape/convex_polyhedron.rs`,
`src/shape/shared_shape.rs`, `src/shape/shape.rs`, `src/math/mod.rs`; Rapier's
`src/data/arena.rs`, `src/geometry/collider_set.rs`, `src/geometry/collider.rs`,
`bindings/typescript/src/utils.rs`; and glam's
`src/features/impl_serde.rs`. Source geometry fields retain their original
serialization order. The decoded shape is the original `TypedShape` enum
variant 11, not a recursively discovered descendant of an unrelated shape.

## API

```js
const D = require('../tools/rapier-snapshot-decoder');
const T = require('../src/experimental-cue-convex-topology.js');

// Capture the intended initial world before stepping. Use the pinned decoder
// and an explicitly selected native exporter binary, as its own docs require.
const decoded = D.decodeWorld(world, {
  engineVersion: '0.21.0',
  binary: process.env.RAPIER_SNAPSHOT_DECODER,
});
const hull = T.exportNativeHull(decoded, collider.handle, D);
T.assertNativeHull(hull); // Returns hull; throws if not admitted.
const shape = { type: 'convex', points: hull.points, nativeTopology: hull };
```

Exports are `FORMAT`, `SOURCE`, `LIMITS`, `exportNativeHull`, and
`assertNativeHull`. In a non-CommonJS script the module is available as
`globalThis.LabCueConvexTopologyExperimental`.

`exportNativeHull` is synchronous and Node-only, like the supplied decoder.
`assertNativeHull` itself has no Node dependency. The caller must keep export
and packing in the same module instance: JSON copies, structured clones, and
manually assembled objects do not inherit the private `WeakSet` admission.
Pass the subsequently packed geometry buffer, not an untrusted topology clone,
across worker/browser boundaries. There is intentionally no public admission or
rehydration escape hatch.

The caller owns the initial-capture timing. The snapshot format has no step
counter from which this helper can prove that no step occurred. The helper
copies only the selected shape's geometry, never a pose, velocity, impulse,
manifold, contact graph, collision result, or feature selection. Snapshot
identity in the output is audit metadata, not a contact-query input.

## Output contract

The returned object and every nested array/object are frozen, with no reference
back to a mutable decoder node:

```text
{
  format: 'parry-0.31.1-native-convex-topology-v1',
  source: {
    rapierVersion, rapierRevision, engineSha256,
    parryVersion, parryRevision, parryCrateSha256
  },
  handle: { index, generation, bitsHex },
  snapshot: { inputSha256, byteLength },
  verification: {
    nativeBincodeByteIdentical: true,
    javascriptTypedReencodeByteIdentical: true
  },
  points: [[x, y, z], ...],
  vertices: [{ first, num }, ...],
  faces: [{ first, count, normal: [x, y, z] }, ...],
  edges: [{ vertices: [a, b], faces: [a, b], dir: [x, y, z], deleted }, ...],
  verticesAdjToFace: [originalVertexId, ...],
  edgesAdjToFace: [originalEdgeId, ...],
  facesAdjToVertex: [originalFaceId, ...],
  edgesAdjToVertex: [originalEdgeId, ...]
}
```

Coordinates and directions are finite source `f32` values represented exactly
as JavaScript numbers, including signed zero. No normalization, sorting,
triangulation, deduplication, renumbering, or geometric recomputation occurs.

Native field mappings are:

- `Vertex.first_adj_face_or_edge` → `vertices[].first`.
- `Vertex.num_adj_faces_or_edge` → `vertices[].num`.
- `Face.first_vertex_or_edge` → `faces[].first`.
- `Face.num_vertices_or_edges` → `faces[].count`.
- The four native snake-case adjacency vectors → corresponding camel-case
  output arrays, in unchanged order.

## Checks and bounded support

Before extracting geometry, the helper requires the decoder's pinned constants,
schema version, Rapier source revision, engine version/hash, Parry version, and
both successful full-snapshot byte-roundtrip flags. It then re-encodes the entire
typed tree and verifies its byte length and SHA256 against the decoder's original
input identity. Editing a decoded tree while leaving its old flags intact is
rejected. This integrity check does not interpret or export contact state.

The native decoder and its provenance checks remain the trust boundary. The
helper does not independently rebuild the native exporter, authenticate an
arbitrarily supplied decoder implementation, or hash a local source archive.
The Parry revision and archive hash describe the pinned source used to derive
the parser, while engine identity/roundtrip checks are enforced at runtime.

A collider handle is **not** numerically cast to an integer. The helper reads
its exact `f64` bits, matching Rapier's bindings: low 32 bits are the arena index,
high 32 bits the generation. Only the exact occupied entry at
`SnapshotWorld.colliders → ColliderSet.colliders → Arena.items[index]` is used.
Free/missing slots and stale generations are rejected. Nonfinite numeric handle
bit patterns are explicitly unsupported.

Supported bounds are inclusive:

- 4–32 points, and exactly one vertex record per original point.
- 4–64 faces.
- 6–96 original edges, **including deleted edges**.
- At most 256 entries in **each** adjacency vector.
- An unrounded direct `ConvexPolyhedron` shape only. Compound, rounded,
  triangular mesh, or other shape variants are unsupported.

Validation checks contiguous face/vertex ranges, all referenced indices,
nonrepeating polygon loops, consecutive face-vertex edge endpoints, live
face/edge incidence, and exact source-ordered inverse vertex adjacency. Each
live edge must join two distinct vertices and two distinct faces. Deleted edges
must have valid stored vertex/face indices but must not appear in live
adjacency; their stored face IDs may coincide. Deleted entries are retained at
their original indices. Native degeneracies with orphaned adjacency or invalid
stored indices fail closed rather than being silently repaired.

The first-4 rule is essential: Parry's
`ConvexPolyhedron::local_support_feature` selects a face by its original normal,
then copies **the first `min(face.count, 4)` original adjacency entries**. It
does not choose an area-maximizing quadrilateral or reconstruct a new boundary.
A consumer must preserve both original vertex IDs and original edge IDs for
those entries. A face with more than four vertices remains intact in this host
export even if the bounded feature buffer contains only its first four.

`assertNativeHull` verifies private admission and recursive immutability, then
rechecks topology before packing. It does not admit a merely similar plain
object. Bounds/shape failures carry `code: 'unsupported-native-hull'` and
`unsupported: true`; schema, provenance, stale-handle, mutation, and adjacency
failures have specific `native-hull-*` or `invalid-native-topology` codes.

## Verification record

Source inspection, a JavaScript syntax check, and a lightweight pure-JavaScript
fixture validation were completed on 2026-10-24. The validation used an
already-decoded, read-only initial `PhysicsLab` snapshot independently supplied
by the integration task, with:

- 37,715 bytes.
- SHA256 `d736c6964006af5ae74d05cfeba99ad8e48d02ee15293affe6e224c36c9ff269`.
- Eight native convex shapes.
- Native bincode roundtrip, JavaScript typed re-encode, and live-world-byte-
  unchanged flags all true.

All eight exports pass the topology checks and recursive-freeze assertions.
Original point order and every deleted-edge flag match the source tree exactly:

- Four rails each have 22 points, 13 faces, 60 original edges including 27
  deleted edges, and 66 entries per adjacency vector. Their largest face has
  11 original vertices.
- Four cushions each have 8 points, 6 faces, 18 original edges including 6
  deleted edges, and 24 entries per adjacency vector. All faces have four
  vertices.

Negative checks reject JSON/structured clones and deep mutation for all eight
exports, stale handle generations, absent arena slots, a non-convex selected
shape, a decoded tree changed after verification, either missing roundtrip
flag, and wrong source revision/engine version/engine hash/Parry version.
These checks invoked no native binary, WASM, or GPU. This record is not a claim
that the downstream CPU/GPU manifold path or the full application has passed
testing.

The downstream bounded integration checkpoint subsequently passed12/12 tests without skips: original-hull CPU322pairs and actual-WGSL fresh578pairs (including retained boxes), with exact point counts/order/feature IDs and zero measured numeric maxima against native. Geometry admission remains separate from full application or persistent-contact correctness.
