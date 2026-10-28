# Canonical raw strike: usable bounded entry, not the whole raw-input domain

`src/direct-candidate/deterministic-raw-strike.mjs` receives yaw, elevation,
strength (cue speed), and both tip offsets and computes the ball's complete 3D
position, velocity, and `q = Rω`. Ordinary initially resting-ball strikes are
supported. A successful initializer result means **post-cue state available**,
not a successful billiards shot, full-world admission, or gameplay pass.

## Validated checkpoint

- Native Vulkan/SwiftShader: **72 cases, all 9,216 result words exactly equal to
  CPU**. This includes 67 rows against a non-empty obstacle roster (63 admitted,
  four unsupported/budget), three blocking/clearance rows, and two translated
  high-elevation overflow regressions. A real second GPU phase also consumed the
  resident output before the only readback, preserving p/v/q/tick/status.
- All **seven tests pass**. Six separately compiled stages total 66,098 source
  bytes. Compile 7.416 s: initialization .698, clearance-pre .689, cue-contact
  4.418, cloth/advance .765, clearance-post .649, finalization .154 s.
- Primary 67-row dispatch + diagnostic readback 2.690 s; 16,386 dispatches for the
  explicit 4,096-step budget. No performance claim for exhaustive raw search.
- Primary allocation: scene 96 B + raw 4,288 B + result 34,304 B + scratch 8,576 B +
  optional diagnostic readback 34,304 B = **81,568 B**.
- Watchdog process elapsed 14.663 s, exit 0, peak owned-process-group RSS 538,136 KiB;
  no timeout/RSS limit, and no remaining owned process after cleanup.
- Current evidence: `native-receipt.json`, `native-process.json`, `native.log` in
  `artifacts/canonical-raw-strike/`. Earlier monolithic successes are named
  superseded; failed compile/watchdog receipts are retained, not counted as
  numerical validation of the current backend.

CPU checks cover impulse/real-arm torque, total cue+ball momentum including guide
reactions, common-origin angular ledgers, passive energy, independent SI dynamics,
timestep refinement, center/off-center/elevation, boundaries and exact translated
scene invariance. The diagnostic range sample is reproducible with
`node tools/probe-canonical-raw-strike.mjs <output.json>`.

Run:

```sh
node --test tests/deterministic-raw-strike.mjs
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
REQUIRE_WEBGPU=1 VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
/usr/bin/flock -x -w 300 /tmp/billiard-native-gpu.lock \
python3 tools/run-canonical-raw-strike-native.py
```

Native execution holds the shared flock through bounded process-group cleanup.
The runner records phase timing, enforces 180 s and 1.5 GiB owned-group RSS limits,
and kills only its own process group. Do not run competing native compilers.

## What was reused, and what was not

`src/physics.js:10–11,143–209` provides the physical model, not a target velocity
or fitted impulse: 0.210 kg / 0.03075 m solid sphere (`I = .4mR²`), 0.54 kg cue,
0.012 kg tip end, 0.006 m tip radius, 1.35 m shaft length, 0.12 m flexible end,
normal Kelvin–Voigt coefficients 1,000,000 N/m and 110 N·s/m, tangential
coefficients 400,000 N/m and 10 N·s/m, Coulomb tip coefficient .70, and transverse
cue spring/damping 1,200 N/m / 1 N·s/m. The normal force is non-tensile. The
common world contact point includes half the compression exactly as the source
law does. Source `pose` supplies side/up/direction and spherical tip offset.

Source `material` gives cloth friction .20. Source `angularPatchResistance`
gives rolling length .00045 m and spin length .00035 m, capped by the lesser
of support normal impulse and `mg h`. These are retained while the sphere is
supported. The rigid sphere-plane tangent effective inverse mass is `3.5/m`,
with an actual two-dimensional Coulomb disk; normal support removes only
closing velocity. No positive vertical velocity is clamped or projected away:
that case is unsupported. Restitution .20 would apply to new cloth impacts,
but this checkpoint admits persistent support only and rejects lift/relanding.
The free-flight mode has gravity and no artificial cloth impulse.

Existing `cue-slice.mjs` remains a useful native-f32 one-step material component
with source-observation tolerances. It is not integer-exact, does not integrate a
stroke, and explicitly lacks full-shot authority. Existing `raw-pose.mjs` is a
native-f32 pose/sufficient-AABB-clearance component, not a strike initializer.
Neither is used as a host per-candidate calculation or authoritative canonical
strike result. Existing integer contact arithmetic (`deterministic-contact-math`)
is reused for bounded, explicitly rounded multiplication, division, vector norm,
and tangent-disk operations.

## Named canonical model difference: ideal guide, not finite Rapier equality

The application explicitly supplies physical **transverse** compliance. Its
longitudinal and angular guide/flex constraints are generic Rapier joints; it
does not set their softness. In pinned Rapier revision
`b716d375efc0201003f0cd9ef7168eee0b62c177`:

- `src/dynamics/joint/generic_joint.rs:306–327` stores softness and initializes
  `SpringCoefficients::joint_defaults()`.
- `src/dynamics/integration_parameters.rs:35–45,77–82` describes spring-like
  constraint softness/drift stabilization and sets the default joint natural
  frequency **1e6 Hz**, damping ratio **1.0**.
- The same file `:85–143` describes ERP/CFM as regularization and solver impulse
  softening. This is distinct from the application's explicit 1,200 N/m flex.

This implementation is the **canonical ideal axial/angular guide limit**:
shaft angular velocity is zero and its velocity is axial; the head has the
same axial velocity plus its own transverse displacement/velocity and physical
finite mass. Tip and lateral spring impulses determine those velocities. Cue
angular inertia does not enter the ideal locked-rotation dynamics; its torque
is not discarded: external guide reaction impulse and common-origin torque have their
own ledgers. This is a justified intended-guide interpretation, not proof that
finite-softness/source Rapier trajectories or cue poses are identical.

The cloth constraint is likewise a canonical rigid unilateral supported-contact
law with source material coefficients, not the source engine's finite-softness
contact iteration. These differences are named in the exported capability and
here rather than hidden behind exact CPU/GPU parity.

## Numeric contract

- Raw rows are 16 words: ID/version/budget, yaw and elevation in **Q16 degrees**,
  speed and offsets in Q24. Finite input encoding never wraps. Duplicate IDs,
  malformed/reserved words, noninteger budgets, and shared mutable arrays reject.
- Physical states use signed Q24; `q` is radius times angular velocity, not raw
  angular velocity. Time is Q20; one integration step is 16 ticks = `2^-16 s`.
  This step is 6.25% shorter than the source `1/(960×64) s`, not falsely described
  as the same schedule.
- Immutable source coefficients are encoded once. Large raw forces/stiffness
  are **not** forced into Q24: the calculation uses normalized **step impulses**
  `J/m` and coefficients such as `kn*h/m`, which fit the declared integer range.
- Integer CORDIC, integer square root, and integer arithmetic operate on-device.
  No native floating point, trig builtin, source replay, host candidate pose,
  host impulse, or host physics between GPU phases is used.
- The CPU is an exact mirror of canonical packed integer execution. Equality is
  for the **same packed raw/scene inputs**, not a statement that encoding leaves
  arbitrary JavaScript Number inputs unchanged.
- CPU independent oracle uses source SI parameters and ordinary floating-point
  mechanics, not canonical helper functions. `h, h/2, h/4` comparisons are
  convergent in the tested center/elevated cases. Tests quantify the current
  local error; they do not assert a global integration-error theorem. An independent
60-case edge probe (53 admitted) found a larger discrepancy at yaw 37.12345°,
elevation 60°, speed 4.5m/s, offsets (.42,.42): canonical vs SI `h/4` combined
`‖Δv‖+‖Δq‖ = .137507 m/s`; SI `h→h/2` change .092250 and `h/2→h/4` .044586.
It converges, but the two tighter .015 m/s refinement fixtures are **not a
whole-domain precision bound**. See `independent-extreme-refinement.json`.

## Admission, clearance, and explicit gaps

Admitted encoding envelope: yaw magnitude ≤3600°, elevation 0–85°, speed
0.5–4.5 m/s, tip offset radius ≤.6, ≤4096 fixed steps. The .6 envelope comes from
the current search's normalized tip bound; it is **not** a physical miscue
threshold. Source raw `strike` allows radius <1 and speed up to10 m/s, so this
module does **not** cover all raw source inputs. Tip sliding is modeled and
reported; actual chalk/tip loss/miscue classification is not implemented.

The scene must explicitly declare a complete isolated sphere / fixed-AABB
roster and `materialProfile: 'physicslab-defaults-v1'`. Missing/other material
profiles and unrecognized scene/raw settings (including material overrides)
are rejected, not ignored. Gravity alone is independently configurable 0–20 m/s²;
other material/mass/radius coefficients are the named defaults only. For support mode, the initially stationary sphere must be exactly at
encoded cloth top + encoded radius. Free-flight mode must remain separated from
the cloth throughout the entire stroke. The complete cue sweep is checked,
including shaft and neck versus the selected ball; only the selected tip/ball
contact is exempt. Capsule envelopes contain the real cue cylinders; fixed
obstacles use outward-rounded AABBs. Each step checks a conservative motion-
inflated envelope, not only endpoints. Selected-ball versus moving-cue checks
use 2× the maximum body/part displacement, bounding their relative displacement;
fixed obstacles need only one motion envelope. A 256-position-quantum clearance margin
is explicit. Conservative unresolved overlap means **unsupported**, not an
invented collision or a feasible clearance assertion.

This is **not** a source-world adapter, a complete convex sweep implementation,
or a global geometry-error enclosure theorem. A missing/wrong obstacle roster
cannot be repaired by the numeric kernel. There is no authority for arbitrary
moving other bodies, cue/cloth contact, cue/rail/other-ball impact, new cloth
impact, jump/landing during a stroke, or a source snapshot with unresolved
settled penetration. Such cases need explicit later components; do not silently
encode them as a clear isolated world. The recorded output on rejection is
partial diagnostic state only and must not be handed to the event engine.

Reason codes: 1 raw domain; 2 cue/obstacle clearance unresolved; 3 required cloth
coupling/lift/relanding; 4 step budget after contact; 5 numeric/deep-contact/guide
travel guard; 6 outside declared tip/miscue envelope; 7 budget before contact.
Status 1 is ready, 4 unsupported, 5 unfinished budget. The source guide travel
limits (-.08,+.13 m) are enforced as an unsupported boundary, not solved impacts.

## Resident API and downstream limits

```js
const engine = await createRawStrikeGPU(device);
const bank = engine.createBank(packStrikeScene(scene), packRawStrikes(raw));
const encoder = device.createCommandEncoder();
bank.encode(encoder);
// Bind bank.resultBuffer as read-only input to a later GPU phase here.
// No mapping/host physics is needed between the phases.
device.queue.submit([encoder.finish()]);
// Dispose only after the device is finished using it.
```

Runtime compilation uses six smaller resident stages: initialization, clearance-
pre, cue contact, cloth/advance, clearance-post, and finalization. The host enqueues
four stage dispatches per allowed step plus initialization/finalization; it never reads or re-encodes
candidate physics between them. A 32-word device scratch row retains tip spring, shaft anchor, pre-step poses,
contact episode flags and arithmetic status; completed candidates return early.
All output and scratch/error words are reset by initialization before use.
The large monolithic WGSL constant is a versioned extraction template, not the
runtime pipeline: its fully checked compilation exceeded the tested compiler's
resource budget, so it is not the validated runtime pipeline. Checked addition
uses genuinely branchless `any(vec<bool>)` plus `select`, not short-circuit
`||`/`&&`; error state is persisted only at phase boundaries. Exact 64/32 division
reads its fixed 32-bit loop bound from immutable scene word 9 (validated to equal 32),
preventing compiler unrolling without changing a single division result.

Each result is 128 words. Important offsets:

| Word | Meaning |
|---:|---|
| 0,1,2 | candidate ID, status, reason |
| 3,4,5,7 | integrated steps, contact steps, slip steps, elapsed Q20 ticks |
| 8,12,16 | complete Q24 p, v, q vectors |
| 20,24,28 | direction, spherical surface offset, original tip center |
| 32,36,40 | final head position/velocity, cue axial speed |
| 44,48 | tip impulse/m; ball torque impulse/(mR) |
| 52,56,60 | head transverse velocity/displacement; axial displacement |
| 64–79 | original packed raw row, unchanged |
| 84,88,92,96 | cloth impulse/m, cloth torque/(mR), resistance Δq, support mode |
| 100,104 | external guide impulse/m and torque impulse/m about recorded origin |
| 108,112,116,120 | tip/gravity/cloth/patch torque ledgers per ball mass about recorded origin |
| 124 | any output v or q component exceeds4 m/s |
| 97 | sticky checked-add overflow bit; any such error prevents acceptance |
| 125–127 | explicit torque origin = initial sphere center |

All torque ledgers use world-axis components **about the recorded initial sphere
center**, not about coordinate zero. Relative arms are formed before cross
products, removing irrelevant large world offsets. Vector/dot/cross/accumulator
addition is checked in CPU and WGSL; overflow becomes numeric unsupported,
including before accepted separation and after final output-velocity calculation.
Exact translation regressions preserve individual guide/tip/cloth ledgers at
shifted high-elevation scenes, rather than letting cancelling signed wraps hide.

Do not clip output to fit downstream kernels. A diagnostic probe of 1,080
specified raw cases admitted 921 and rejected 159 for cloth lift/coupling;
195 admitted outputs exceeded the current event kernels'4 m/s component cap.
Max observed absolute components: **v 5.480600 m/s, q 7.723329 m/s**; max observed
q norm 7.886814 m/s. These are observations, **not** proven domain maxima. In
ideal passive persistent-support mechanics, the total initial cue kinetic
energy yields norm bounds `|v| ≤ speed*sqrt(.54/.210)` and
`|q| ≤ speed*sqrt(.54/(.4*.210))`, i.e. 7.216054 / 11.409582 m/s at speed 4.5.
Those continuum energy bounds are not a global quantization-error proof.
Word 124 is a **legacy 4 m/s range warning**, not an admission clamp. A downstream
v4/q4 consumer must reject those states; a separately validated wider consumer
must check its actual v/q/slip bounds instead of treating that legacy flag as a
rejection. No shared event caps are edited by this component.

## Measured approach work; no shortcut enabled

Across the 921 admitted diagnostic cases: 664,365 approach steps and 91,673
contact steps out of 756,038 integrated steps — **87.8746% pre-contact**.
Approach range 175–1,573 (mean 721.35); contact range 59–151 (mean 99.54).
The centered speed-2 case has 394 approach + 80 contact = 474 steps.

For initially supported rest, the cue's axial speed is unchanged before contact,
its lateral spring state stays zero, and gravity/support leave ball p/v/q fixed.
A future exact-discrete first-touch jump could therefore remove work, but would
need whole-approach clearance and identical gravity/cloth ledger accumulation,
plus explicit counter/profile semantics. Free-flight with nonzero gravity is
not stationary. **No approach shortcut is enabled in this validated checkpoint.**

## Actual configured parameter count — no invented grid

There is no configured Cartesian enumeration of the five parameters:

- `src/optimizer-core.js:18–23` exposes candidate budgets **48, 128, 320**;
  explicit test budgets permit 1–1024. These are attempts, not all combinations.
- `:30–33` rounds normalized proposals to 1e-5 and clamps current search bounds:
  speed .5–4.5, tipX ±.55, tipY ±.45, radial bound .6. Rounding precision does
  **not** mean the application enumerates every point of that lattice.
- `:56–95` uses initial settings, geometry seeds, Halton proposals and local
  refinement. Elevation can be fixed or searched over 0–85° (or user bounds).
- `src/inverse-planner.js:56` uses bounded continuous inverse solves (40 solver
  iterations per branch), and the controller configures a 20,000 ms solve budget;
  it does not define a finite exhaustive five-dimensional grid.

If explicit finite sets A,E,V,X,Y are later supplied, the unfiltered count is
`|A|*|E|*|V|*|X|*|Y|`; with the current radial tip restriction it is exactly
`|A|*|E|*|V| * Σ[x∈X,y∈Y] 1[x²+y²≤.6²]`, before any geometry/state-dependent
feasibility filters (and after canonical encoding deduplication, if required).
Spin-off makes the tip-set count 1; fixed elevation makes the elevation count 1.
For full source raw-domain counting, use the source strict radius<1 and its
actual speed bound instead. No yaw/elevation/speed/offset spacing is invented
here. The 1,080-case range probe is explicitly a diagnostic sample set only.
