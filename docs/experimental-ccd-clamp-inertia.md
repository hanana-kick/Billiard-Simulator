# Isolated CCD post-clamp world inverse inertia

`experimental-ccd-sweep-math.js` adds `worldInvInertia` to its existing CPU/shared-graph and actual WGSL stage. Input is `{ rotation, principalFrame, invPrincipalInertia }`; output is only `{ invInertia }`, a nine-element symmetric matrix. This does not change the application physics or the world owner.

## Source arithmetic and scope

- Rapier revision `b716d375efc0201003f0cd9ef7168eee0b62c177`, `src/dynamics/rigid_body_components.rs:547-595`: final-pose world mass update.
- Parry 0.31.1, `src/mass_properties/mass_properties.rs:260-272`: `MassProperties::world_inv_inertia`.
- Parry `src/utils/sdp_matrix.rs:259-269`: extract the matrix upper triangle, then mirror it into the existing flat-state layout.
- The quaternion product, scalar quaternion-to-matrix conversion, column scaling, and left-associated three-term products are the exact existing arithmetic in `experimental-free-body.js:45-48` and `experimental-world-stepper.js:70`. The shared arithmetic runtime rounds every node to f32 on CPU and WGSL. It does not use a host mass calculation on the GPU path.
- Inputs must be finite, exact f32 vectors and approximately unit quaternions under the existing `2e-5` admission tolerance. The operation does not renormalize either quaternion. Principal inverse inertia must be strictly positive on every axis or all-zero. Mixed locked/degenerate axes are rejected. The native all-zero branch returns positive zero in all nine entries.
- Isotropic spheres must still execute the matrix arithmetic: native orientation rounding produces observable off-diagonal low bits. No diagonal shortcut is used.

The operation reads no velocity, force, contact, or warm-start state and returns no updates to them. Integration into the world must retain source sequencing: clamp only next pose, advance pose, refresh mass properties, and update collider/proxy bounds without rerunning the solver or regenerating contact caches. This isolated stage does not itself establish positive-clamp world parity.

## Native assertions and provenance

The default test compares exact f32 bits, not tolerances or a duplicate JavaScript implementation:

1. Existing `tests/fixtures/active-ccd/original-e35-prediction.json`, original native pre-split body 16 tensor and orientation.
2. Two post-advance body 16 rows and the identity body 17 row, extracted from the already-recorded pinned native source capture. Extraction uses each `Stage` record with `phase == "post-advance"`, then `bodies.bodies.items[16 or 17].value`. Inputs are `pos.position.rotation` and `mprops.local_mprops.{principal_inertia_local_frame,inv_principal_inertia}`; expected values are `mprops.effective_world_inv_inertia`.

Capture SHA256: `389a010eb63b583d42a1e9d1eebba8e0c3e755b3aa43be7922181c7042ae71f1`.

Instrumented native executable SHA256: `2a7c8703e97e9d2167050465a06d0bdae0f77ad2b05cb6f5255732b76eeb7116`.

Native post-snapshot SHA256: `57021277c6e085ec51f4493b2615bbeadd041f1fe8e7fd5bd9ee17226f6eca49`. The capture confirms instrumented and independent unobserved native post-snapshot bytes are equal.

Parry source manifest SHA256: `9122c8baadf2ed6ba7b00ffd8c78c1f238179d0ee5342d9286431e070851b645`; archive SHA256: `7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e`.

The principal-frame factorization test reuses these native expected tensors with the identity quaternion on the opposite side. It checks wiring but is not claimed as an independently captured new native case. The native trace has no positive post-solve clamp; these rows validate the mass operation, not clamp integration. Anisotropic principal inertia is accepted by the formula but is not established by these spherical native fixtures.

Run lightweight CPU checks with `node --test tests/experimental-ccd-clamp-inertia.cjs tests/experimental-ccd-sweep-math.cjs`. The explicit actual-WGSL test is centrally scheduled using `GPU_NATIVE_MODULE` and `REQUIRE_WEBGPU=1`; its expectations are the captured native tensors directly, not CPU-stage outputs. GPU validation is not claimed until that test runs.

Rapier/Parry derived code retains the Apache-2.0 attribution, copyright, and `vendor/RAPIER-LICENSE.txt`. Quaternion arithmetic retains glam's MIT/Apache-2.0 notices in `vendor/GLAM-LICENSE-*.txt` and `THIRD_PARTY_NOTICES.txt`.
