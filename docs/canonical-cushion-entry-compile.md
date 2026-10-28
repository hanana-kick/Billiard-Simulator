# MMQ2 finite-cushion entry compiler structure

The v2 entry qualifier is adapted from the unchanged v1 source. A first structural
checkpoint accumulates competing-ledger and complete-roster sample verdicts rather
than returning inside those loops. Failure reasons10/6, the finite real-hull
normal/approach/penetration qualifier, and every accepted state/impulse packet
write remain unchanged. No physics formula or tolerance changed.

CPU component3cases and source-structure1case passed. Separate native SwiftShader
component5cases/12,560words matched CPU exactly. Compile33.708s, elapsed34.737s,
sampled aggregate RSS1405.09MiB under110s/1500MiB limits. Compared with the earlier
~32.5s/1448.63MiB observation this is only a modest RSS difference, not a compile
speedup or a guarantee that full-world composition fits. The combined world had
previously exceeded the cap while compiling entry index3. No full-world rerun is
claimed for this checkpoint; a resident original-endpoint cache split is next.

## Selected original-endpoint cache

The v2 entry now samples only its selected body's original lower endpoint and
nine possible power-of-two extension endpoints in a separate resident dispatch.
The qualifier reads those exact samples instead of inlining the large original
rolling sampler twice. The original accepted full-roster sampler remains in the
qualifier. Finite-hull bounds, normals, approach, penetration, competing events,
failure priority and response packets are unchanged; no curve is fitted.

The sample payload is 640 bytes. An additional 384 bytes bind the complete original
80-word selected descriptor and selection/time/rail header, giving 1024 bytes per
reused bank. Every active slot's body, stable ID, source clock, rail, endpoint time
and slot number must match the current source before qualification. A changed
source with the same ID and clock is rejected by full descriptor comparison. A
cache is a GPU-owned immutable intermediate, not an authenticated external input.

There are four extra encoded sampler commands, each a single 16-lane workgroup;
only the selected rail performs physics. Up to 10 original selected samples are
computed, even if qualification would have stopped at an earlier extension.
This intentionally trades bounded additional sampling for a smaller compiler
graph, not a claim of universally fewer runtime arithmetic operations. Other balls
are still sampled only at the final accepted endpoint. Entry storage bindings
increase from 7 to 8, within the baseline eight-binding limit. The bank is reused;
no per-candidate trajectory or intermediate CPU readback is introduced.

The final cache source passed the five original full-entry cases (12,560 exact
CPU/GPU words), 261 cached position/velocity/spin words across extension caps
1/64/255/256, and 142 stale-cache header/descriptor/endpoint-binding mutations.
Software Vulkan compile 28.453s, elapsed 29.390s, sampled aggregate RSS 1118.32MiB,
under the unchanged 1500MiB cap. This is component evidence, not a full-world or
hardware-performance claim. Additional tests mutate the actual current ledger
body/lower/upper/horizon and selected position while retaining a previous cache.

The expanded final run also passed four actual current-ledger changes and one
current selected-position change after caching, with identical source code.
Compile 28.877s, elapsed 29.991s, sampled aggregate RSS 1122.23MiB. Independent
read-only review found no cache race, binding or qualifier change; CPU focused
tests passed 8 with 2 native skips, and type checking passed.
