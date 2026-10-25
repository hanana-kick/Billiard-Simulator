# Solid convex projection prerequisite

The inverse observer calls `Collider.projectPoint(point, true)`. The existing
source-derived convex query implemented only `solid=false` (surface projection),
which runs EPA after GJK containment. This is not interchangeable for interior
points: solid projection returns the supplied f32 point immediately.

`experimental-convex-point.js` now accepts optional boolean `solid` (default
false). Input slot 23 carries the flag. Both reference and generated WGSL use
the same source-derived `point_epa` branch: on GJK containment, set `isInside`,
return the input point and successful status without EPA when solid is true.
Non-solid projection and feature extraction defaults are unchanged.

Source inspected: Parry 0.31.1, revision
3383f51cbbe9af70565427e7a66c605e1557c1fc,
`src/query/point/point_support_map.rs:local_point_projection_on_support_map`.
For the admitted cushion domain, cushion seeds require `identityPose: true`,
so this query needs no new world/local pose arithmetic. Other convex poses are
not newly admitted by this change.

Original-native test coverage uses unchanged pinned Rapier WASM plus the
existing verified decoder/native-hull authority. Native provenance, input bytes,
and typed roundtrip are checked by the decoder before hull export.

- 356 original non-solid face/edge/vertex/interior projections: reference max
  absolute error 0; native feature identities unchanged.
- 552 solid projections including exact faces/vertices and interior/exterior
  offsets: 260 native inside classifications; reference max absolute error 0.
- Non-boolean solid option rejected; default equals explicit false.
- Native WebGPU tests include solid and non-solid queries in one dispatch batch.
  They are gated separately by `GPU_NATIVE_MODULE` (not claimed from CPU tests).

No GPU world producer, search switch, or shot certification is added here.

Native WebGPU validation completed on the isolated checkpoint with
`GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js`,
Vulkan ICD `/usr/lib/chromium/vk_swiftshader_icd.json`, and the pinned decoder.
All five projection tests passed without skips: native/reference/WGSL max error
0 for 356 non-solid and 552 solid cases, including a mixed-mode batch. This is
actual WGSL execution on software Vulkan, not evidence of discrete-GPU speed.
