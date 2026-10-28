# Isolated static-cushion response with optional coupled cloth

Experimental three-dispatch chain: actual finite-hull time query → certified
one-hull admission → one homogeneous sphere/static-contact response. All stages
are GPU resident; no intermediate host physics or readback occurs. Only admission
status 1 with all five proof bits permits response. Unresolved local corners,
grazing, representation caps and resource/range failures remain non-results.

There is exactly **one dynamic body**. The static cushion has zero inverse mass
and inertia; it is not a fake second sphere. Full three-component velocity and
surface spin `q=R*omega` are retained. No global competing-event ownership,
general post-impact motion continuation, full-shot result or production backend
selection is supplied. Other balls/hulls can still preempt this isolated chain.

## Chosen upper representative and error contract

This response is evaluated at the admission interval's **upper tick**, not at
an asserted exact root time. It chooses:

- contact point: integer floor midpoint of each admitted upper point interval;
- normal: exact integer normalization of the upper-normal interval midpoint,
  with power-of-two rescaling before normalization;
- body center, velocity and q: the original anchored Q24 recurrence at that tick.

The midpoint is not claimed to lie exactly on the hull. Its ceil Euclidean
maximum deviation from the complete upper point box is measured and must fit
`maxPointErrorQuanta`. The normalized direction's maximum deviation from the
complete upper normal box must fit `maxNormalErrorQuanta`. Unit-length defect
must be at most four Q24 units. These are explicit per-candidate caps, not a
change in state precision or an epsilon allowing a separated ball to collide.

These caps bound the **chosen upper representative against the continuous upper
contact family**. They do not bound its difference from the earlier exact root
point/normal; root-to-upper motion would additionally require the full bracket
B bound. The impulse solve is for the chosen encoded Jacobian, not an interval
solve proving the same impulse for every possible contact geometry.

The normalized real arm is `(chosenPoint-storedCenter)/R`, never a unit-radius
shortcut. Its length is checked against the certified penetration plus point
and upper-position rounding errors. Cushion penetration and declared cloth
overlap are each limited to R/8. Centers are never projected to contact.

## Cloth ownership is checked over the entire prefix

Optional cloth is an explicit finite horizontal face: top plus `[xmin,xmax,
zmin,zmax]` in the response state.

- **Inactive cloth:** a directed bound on `y(t)-top-R` must remain strictly
  positive over `[0,upperTick]`. This conservative infinite-plane exclusion can
  reject clear paths outside the finite face, but cannot silently miss an earlier
  floor crossing.
- **Active cloth:** require constant y, `vy=ay=0`, an initial support gap within
  `[-clothOverlapQuanta,0]`, and directed x/z bounds strictly inside the declared
  finite footprint throughout `[0,upperTick]`.

Unsupported flight/landing or support that leaves the face returns pending;
checking only the final position would be insufficient. Tests include an earlier
floor crossing ending above the floor, and an x/z excursion returning inside
before the cushion event. Both refuse without impulse. No infinite cloth is
invented outside its supplied face.

For bounded cloth penetration, the common cloth point is the encoded midpoint
between the plane and sphere's closest bottom point, matching the explicit
finite-overlap common-point policy. Its actual offset and arm are retained.
The supplied prepared polynomial's motion-law validity is still a caller
obligation; this component does not reconstruct force/contact history.

## Solver

Use state `(v,q)` and normalized impulse `lambda=J/m`. For each normal/tangent
constraint, the one-body Jacobian is

```
row = [direction, ((point-center)/R) cross direction]
D   = diag(1,1,1, 5/2,5/2,5/2)
K   = row * D * transpose(row)
```

There is no second-body factor of two. Normal constraints enforce nonnegative
impulse and the named restitution target. Each contact has two tangential
coordinates with a Coulomb coefficient disk; a bounded projected iteration solves
cushion and optional cloth together. Friction uses downward coefficient products
and exact integer disk projection. The encoded basis Gram defect must be at most
16 Q24 units; its small nonorthonormality is part of the chosen numeric model,
not a claim of exact unquantized Euclidean friction for every geometry in the
admission intervals. Tests check the coefficient disk with exact BigInt squares.

The shared [contact arithmetic](deterministic-contact-math.md) is unchanged from
the 3D pair solver. Residual, iteration and numeric range checks remain explicit.
A high-friction fixture reaches the state/range guard, and an iteration-one
fixture remains incomplete; neither is accepted by loosening precision or limits.

## Input/output and resource limits

`packCushionResponseState(cases)` requires provenance
`prepared-isolated-static-cushion-cloth`. This declares an isolated test family,
not independent proof of other-world exclusion. Motion rows are the existing
16-word time-query ABI. Response state is 32 words per candidate:

| Words | Meaning |
|---|---|
| 0–3 | ID, version `0x43520101`, iterations, residual budget |
| 4–7 | mass, cloth top, active mask (0/1), cloth overlap quanta |
| 8–13 | q anchor xyz, qRate xyz |
| 14–17 | combined cushion restitution/friction, cloth restitution/friction |
| 18–19 | chosen-point error cap, chosen-normal error cap |
| 20–23 | finite cloth xmin/xmax/zmin/zmax |
| 24 | explicit canonical advancement mode: 0 generic (default), 3 exact rolling |
| 25–31 | zero |

All physical scalars are Q24 except dimensionless integer masks/budgets. Mass is
positive through 4 kg; q and solver velocity components are bounded by 4; qRate
by 64; radius is 4096 Q24 units through 1 m. Point error cap 0–64 quanta, normal
error cap 1–4096, cloth overlap 0–4096 subject to R/8; iterations 1–256 and
residual budget 16–1024. The time-query batch/node caps also apply. Raw shared
mutable buffers reject. Scene and admission configuration snapshot before await.

Response: 128 words per candidate:

- 0–7: ID/status/reason/iterations/residual/cloth mask/version/NO_PASS.
- 8–13: all final v/q; 14–15: mass/radius; 16–21: six impulse coefficients.
- 22–30: cushion normal/tangent basis; 31–35: point error, normal error,
  Gram defect, unit defect, cloth midpoint offset.
- 36–47: two common points and normalized arms; 48–57: effective masses,
  restitution targets and tangential iteration denominators.
- 58–63: arithmetic counters, admission proof mask and time interval.
- 64–72: stored upper center and pre-impact v/q.
- 73–79: hull/stored-feature/material metadata, penetration and representation caps.
- 80–81: global authority and continuation authority, both zero.
- 82–83: whole-prefix cloth proof flag and directed floor-gap lower bound.
- 84–127: zero.

Status 1 means numerical convergence for the chosen prepared response; 4 rejects
invalid/range states, 5 is incomplete and 6 remains pending. Prior admission
clear/reject/incomplete statuses propagate. Early-refusal/failed-solver state
words are diagnostics, not an authoritative physical continuation.
Response reasons: 1 invalid geometry/domain; 2 iteration limit; 3 numeric range;
4 representation cap; 5 chosen contact not closing; 6 cloth prefix unproved.
Prior admission reasons are carried as 10+reason.

## Evidence and scope

Native SwiftShader **3/3 passed in 9.34 s**: 17 mixed candidates / **2,176 output
words exactly CPU/GPU identical**, plus nonzero-offset and mutation-isolation
batches. Three dispatches, zero intermediate readbacks. Compile about 7.62 s;
shader sizes 9,503 / 11,147 / 11,817 bytes. Shared scene/config 9,800 bytes,
inputs 3,264 bytes, resident time/admission 8,704 bytes, output/readback 8,704
bytes. First submit/readback about 100.6 ms in this software-GPU observation.
The first compile attempt used a reserved WGSL identifier; it was renamed before
this passing receipt. Existing 3D-contact native parity also passed 5/5 with
70 cases / 8,960 identical words after shared arithmetic extraction.

Passing-response fixtures are checked against an independent Number Jacobian
solve, isolated static-wall restitution, coupled nose/cloth, side-spin torque,
oblique spin, coefficient cones, energy and external momentum/angular impulse.
Observed maximum differences were:

- v/q reference: `3.74e-6`, about 63 Q24 units; test gate is twice the declared
  64-quantum residual budget, not a universal physical accuracy bound.
- normalized momentum balance: `1.20e-7`, about 2 Q24 units; gate 8 units.
- normalized torque balance: `8.33e-9`, about 4.6 times R/Q; gate 8R/Q.

All checks refer to the declared chosen-contact model and prepared fixtures.
They do not certify source Rapier parity, exact-root impulses, all geometry in
an interval packet, hardware throughput or full-shot accuracy. Subsequent CPU
checks additionally cover leaving/re-entering the finite cloth footprint; no
shader changes were needed for that regression.

```sh
node --test tests/deterministic-cushion-response.mjs
REQUIRE_WEBGPU=1 \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
node --test --test-concurrency=1 tests/deterministic-contact-3d.mjs tests/deterministic-cushion-response.mjs
```

## Canonical rolling advancement extension

Optional `canonicalMode:3` uses the shared `deterministic-canonical-spin.mjs` contract, not inferred rolling: vy=Ay=qy=qRateY=0, qx=vz, qz=−vx, qRateX=Az and qRateZ=−Ax must hold exactly in input words. Other mode values or broken identities reject. After evaluating the pre-impact upper velocity, mode3 reconstructs qx=vz/qz=−vx, matching canonical directional advancement rather than independently flooring opposite signed terms. Generic mode0 remains unchanged. This affects pre-impact state only; no response spin component is projected or deleted, and mode3 does not authorize post-response rolling continuation. The global merger marks current mode UNKNOWN and coefficients dirty after a response.
