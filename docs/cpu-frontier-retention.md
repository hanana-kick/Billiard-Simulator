# Retained-frontier CPU search

The existing experimental `cpu-event-window-inverse` option now retains one best observed numerical root at each work-budget rotation and admits up to seven fresh roots in its default eight-root frontier. The default `inverse-constraints` option and the older `cpu-event-inverse` option are unchanged.

The retained root keeps its exact solver state, pending probe IDs and completed partial-wave observations. Other roots remain dormant and can resume. Existing deterministic scoring and the branch-ID tie break choose the retained root. Passing `carryBest: false` to the adaptive coordinator restores complete-frontier rotation.

This changes scheduling only. Physics, scoring, contact observation, geometry, numerical solver, acceptance conditions and independent full-rest verification are unchanged. A prefix observation cannot certify a route. Fresh independent verification takes priority over frontier rotation.

The change does not prove completeness, optimality or a speed improvement on every layout. In eight frozen additional layouts at a nominal 400,000 outer-step cap, the original policy solved three and retention solved four, with no previously solved case lost in that sample. Two four-ball cases used unchanged work. Four layouts remained unresolved. An unresolved time/work window does not mean the layout is impossible.

## Tests

- `npm run test:frontier-retention` verifies exact continuation, fresh admission, replacement by a stronger observation, independent verification priority, pause/resume and input validation.
- `npm test` includes these contracts and the existing native physics and worker regressions.
- `tests/e2e/cpu-event-window-search.spec.cjs` verifies real Worker search, applying the route, full-rest live scoring, predicted contacts and cancellation/resume.
- `scripts/verify-next-shot-cache-route.cjs` checks a configured four-ball layout, reports whether the next route is ready before rest, and verifies exact-rest adoption followed by normal live replay with matching predicted contacts and a +1 full-rest result. This is a functional example, not a random-layout benchmark.

Next-shot preparation is described in [next-shot-precompute.md](next-shot-precompute.md). It keeps planning and evaluation off the live playback thread, uses one speculative Worker during motion, and suspends speculative work when playback frames show pressure. It can still need more search after actual rest.
