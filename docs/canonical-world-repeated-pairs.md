# Recurrent rolling pair commits

The canonical-local CPU/GPU world can now execute qualified rolling pair entries
after an earlier collision, rather than stopping solely because a pair counter
was already nonzero. The unchanged rolling query/entry qualification, original
full 3D contact solver and all-body reconstruction are reused. Positive elapsed
time is mandatory. Failed entries, ambiguous geometry and exhausted query budgets
remain pending/budget outcomes, not misses or invented impacts.

Every committed pair updates its counter and absolute tick once, and captures an
ordinary physical pair journal event. First-pair diagnostic buffers are separate
from the reusable latest-entry scratch; later events and no-ops cannot overwrite
them. All body states advance on the same clock. Existing bounded world work
iterations and original shot deadline remain in force.

2026-10-27 software Vulkan verification: four layouts, 11,392 literal CPU/GPU
words across full state, journal and auxiliary sidecar. Three layouts contain two
actual rolling pairs ([0,1], then [2,3]) and reach REST; a closer competing layout
stays pending. Two tests passed. Total 83.8 seconds, compile70.6 seconds, sampled
aggregate RSS1103.3MiB under1500MiB. Evidence:
`/tmp/world-repeated-pairs-native.log`.

This component evidence is not a claim of complete two-red scoring or late-foul
coverage. Genuine selected-cue two-target and late-opponent fixtures are separate
physical integration tests; full-game release and hardware throughput remain
unverified.

## Selected-cue targets and late opponent

A second prepared physical checkpoint reruns complete initially nonoverlapping
rosters: selected cue→first target→second target→REST, and a separate roster with
an initially placed opponent along the later cue route. That latter simulation
commits all three selected-cue contacts; the original explicit66-iteration cap
remains pending, while the explicit128 cap continues every body to real model
REST. No object is inserted during motion. The host option upper bound is now128
in all three owning entry points; existing caller/default64 budgets are unchanged,
129 is rejected, and no accuracy setting or original deadline is altered. This
is a component work cap, not cumulative request work/event-budget certification.

Seven native layouts (the previous four plus two-target REST, late opponent66,
and late opponent128) matched19,936 literal state/journal/sidecar words. Three
tests passed,97.5seconds/1064.6MiB sampled aggregate RSS, no watchdog stop.
Evidence `/tmp/world-targets-late-foul-native.log`. These are prepared physical
journals, not yet actual raw-owned goal/late-foul rule results.
