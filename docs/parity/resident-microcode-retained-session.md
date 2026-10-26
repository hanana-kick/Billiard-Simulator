# Retained scalar-VM transport session (host gate)

`createMicrocodeWorldSession` owns one set of source, VM-local, control and stack
GPU buffers through multiple bounded `pump(cycles)` calls. `initialize()` is
permitted exactly once. The prepared initial plan is privately cloned; uploads
are sealed before execution and there is no write/restore/reset/horizon API.
Cumulative cycles cannot exceed immutable `vm.dispatchChunks`. Budget exhaustion
remains incomplete, not a failed billiards candidate.

`capture(label)` copies the current world-state and VM buffers into separate
preallocated diagnostic storage. It returns only a name/cycle receipt; it never
maps or replaces source authority. Later pumps use the same live buffers.
`finish()` maps once after the last pump has been captured, returns the copied
checkpoints and statistics, and prohibits further execution. `dispose()` releases
resources, including on failures. Concurrent operations and retries after a
submission failure are rejected.

The existing `runMicrocodeWorld` wrapper still admits only the strict two-h
runtime and performs its original initialize/pump/final capture/map sequence.
The separate recurrence schema is fixed at **six raw rows and eight h**, with a
new kind and assertion/serializer. It requires requestedH=8 in the source begin
shader before initialization. Relabeling the old h2 artifact or restarting a
completed h2 VM is not an admitted continuation.

Host mock tests cover retained buffer identity, unchanged initial writes,
diagnostic copies retained across pumps, zero intermediate maps, one final map,
fixed budgets, caller mutation, repeated begin, failed submissions, disposal,
and unchanged old two-h dispatch counts. Mock marker writes are transport test
signals, not physical trajectories. Schema tests preserve the old assertion and
reject metadata-only horizon changes and future-state payloads.

The next native gate must start from authentic initial-only eight-h preparation,
compare final h8 against the independent original CPU, and retain the unchanged
rule/clock/source groups. Predetermined intermediate cycle snapshots can fall
inside a source instruction or h; they are **not exact h4 checkpoints** unless
that boundary is separately established. No full-rest, physical-strike, 1024-row
or hardware-throughput claim follows from this host transport checkpoint.
