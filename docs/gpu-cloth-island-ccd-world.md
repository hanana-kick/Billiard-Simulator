# Enabled CCD in bounded coupled recurrence

The shared cloth-island owner has an opt-in `ccdMode: 'source-inactive-only'`
contract with the actual original `ccdEnabled: true` and
`maxCcdSubsteps: 4`. This is distinct from its default globally disabled CCD
experiment. It does not implement active time-of-impact handling.

Before solving, each dynamic body's own entry state and carried effective force
are passed through the source pre-CCD predicate. After the shared source solve,
its own old and next poses are passed through the source post-CCD predicate.
The resulting `ccd_vels` are candidate outputs. Neither predicates nor next
physics state are read from the native replay.

Only two inactive results permit the private state commit. Active CCD or the
explicit unsupported angular branch permanently latches a halt, retaining the
last committed frame and state. No subsequent call silently advances a no-CCD
world. The angular application phase, when separately admitted, is after the
post-solve CCD check, matching the original application order.

Native `ccd_thickness` and body maximum extent come from the one initial
snapshot. Effective forces are carried from the candidate's own preceding
solve. Fixed original force/torque, collider geometry, no COM offset, awake
never-sleep bodies and existing continuous top-face floor contacts are still
required. Original dual channels, source graph colors and separate contact
caches are unchanged.

The native test retains body CCD enabled and global max substeps 4. It compares
both bodies, all contact caches and native `ccd_vels` through ball contact birth,
loaded impact and separation. It includes a permanent first-active halt sentinel.
The strict actual GPU run passes 7/7 tests without skips, including the unchanged
CCD-off regression. Both backends advance 224 enabled-CCD frames plus 224
default regression frames. All asserted body, cache, proxy, event and native
`ccd_vels` fields have maximum observed absolute error 0; no tolerance changed.

Enabled fixtures retain the no-law island's 96-frame head-on and 128-frame
oblique-spin horizons, approximately 0.100000005215 and 0.133333340287 seconds.
The preceding 34 native preparation steps take approximately 0.035416668514
seconds. Ball contact begins/ends at frames 18/22 and 19/23, respectively;
reporting impulse peaks are 0.18734011054039001 and 0.18200063705444336. Both
floor contacts remain active, with independent refresh counts 78/78 and128/124.

These results establish real own-state progression with original CCD flags
while CCD remains provably inactive. They do not establish active TOI handling,
complete shots, native sleep or the separately composed angular application
law. The test's initial fast-body sentinel confirms refusal and retained state,
not successful integration of an active CCD event.
