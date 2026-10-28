# Source-owned raw carom goal checkpoint

The fixture starts with the entire initially nonoverlapping roster and an actual
raw strike; no ball is inserted or redirected during simulation. All default
physical material parameters are retained. The explicit rule configuration is
four-ball carom, zero minimum cushions, kisses allowed. This is not the default
three-cushion game and does not establish unrestricted kiss tracking.

- Raw strike: angle0°, elevation25°, speed0.5, tipX0, tipY0.2.
- Initial IDs50,8,300,19; selected cue50 becomes slot2 after canonical sorting.
- Actual cue contacts: slot0↔2 at71367, slot2↔3 at300495.
- Every body continues to model REST at3343649, original start1234.
- Owned physical journal and composite sidecar feed the real rule reducer.
- Expected compact result `[100,1,0,1]`: configured complete goal, score1.

The runner uses an explicit bounded128 component-iteration cap and the original
shot deadline. It does not claim cumulative request work/event-budget accounting,
a global physical-enclosure certificate, arbitrary-layout completion, or release.

Native software Vulkan comparison passed two tests and 2,916 literal CPU/GPU
words: full world, physical journal, composite sidecar, raw status, rule state
and compact result. There are zero intermediate readbacks and zero host physics
calls. The bounded run took75.1seconds (61.6seconds compile), sampled aggregate
RSS1055.8MiB under1500MiB, no watchdog stop; world/journal/rule buffers211,440bytes.
Evidence: `tests/canonical-raw-goal.mjs` and `/tmp/canonical-raw-goal-native.log`.
Software execution timing is not physical-GPU throughput.

## Actual late-opponent foul

A second complete source-owned raw shot uses the same first three starting balls
and strike, with opponent19 initially at
`[-0.4386177474789169, 0.03075, -0.18698344749310994]`.
Initial nonoverlap is validated. The cue reaches both target balls at the same
71367/300495 ticks, then genuinely contacts the opponent at339985. All bodies
continue to REST3343645. The rule result is complete score−1, compact
`[100,2,1,4294967295]`, not the earlier provisional goal.

Native comparison passed two tests and2,916 literal CPU/GPU state/journal/sidecar/
raw/rule/result words, zero intermediate readbacks or host physics. Total83.6s,
compile70.1s, sampled aggregate RSS1118.3MiB below1500MiB. Evidence:
`/tmp/canonical-raw-late-foul-native.log`. Together with the separate positive
checkpoint this demonstrates the configured goal remains subject to a real late
opponent foul through physical REST; it does not certify all possible shots.
