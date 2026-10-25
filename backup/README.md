# Sanitized resident-source backup — experimental checkpoint

Frozen committed source: `9a0e4eed360ef0c3c3679e2f86b4d5563297d31f` (`work/resident-candidate-v1`).
Backup parent: `44bfd55124ae43d4c62f2d53db79203594c342d4`. This is source preservation only, not a release,
deployment, production numerical admission, or completion of GPU acceleration.

## Validation boundaries

- The earlier 16-owner implementation passed a bounded native six-raw-row,
  two-physics-step gate. It does not qualify the new microcode implementation.
- The new microcode CREATED-bank two-step recurrence matched all 11 original
  source groups on the HOST only. The twelve-query native pilot is a separate,
  limited SwiftShader correctness result, not whole-world recurrence.
- At backup freeze, the latest native continuation gate exited 1 while creating
  its main pipeline, before compute. The cause was not yet established. No new
  native world recurrence, physical strike, full rest, 1,024-world execution,
  hardware throughput, or hardware/software correction ratio is claimed.
- The prior backup's 326 regression and 57 browser passes do not cover this new
  source checkpoint. No aggregate regression, full real-app browser, or build
  gate was rerun for this source-only backup. Curated documents retain their
  original source-specific scope and caveats; later validation may supersede them.

## Exact source and exclusions

All source content comes from the frozen Git object, not the active worktree.
The existing public snapshot manifest is retained unchanged from the previous
backup as a historical record; it does NOT describe this resident checkpoint.
No new manifest or local worktree inventory is published. Uncommitted worktree
content is not included.
Raw logs, runtime dumps, `.v8`/`.cpuprofile` profiles, generated app bundles,
generated benchmark payloads and expected-future dumps, secrets, dependencies,
and workspace metadata are excluded. Curated evidence summaries and reproducible
test/generator source are retained; references to local artifacts are not uploads
of those artifacts. Existing checked-in fixtures and unrelated remote files are
preserved unchanged, not replaced by generated run output.

The historical `backup/checkpoints/live-three-withdrawal-wip.patch` and its
SUPERSEDED notice remain byte-for-byte unchanged. Do not apply that patch over
current source. Remote history is retained through a new child commit; local
integration history is not imported. No main change, workflow change, merge,
or deployment is part of this backup.
