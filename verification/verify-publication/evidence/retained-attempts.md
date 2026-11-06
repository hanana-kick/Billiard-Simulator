# Retained attempt history

This note preserves failures and interruption facts recoverable from the tool transcript. It is not reconstructed raw output. No additional execution was performed to obtain this note. The final passing run remains in `summary.json`, the fixture JSON/NDJSON files, and the sibling `planner-differential.log`.

## Attempt 1: harness failed before physical evaluation

Policy: at most 180 waves, 4,000 evaluations, 20,000,000 physics steps, and 300,000 ms per fixture; stop after first success plus three complete waves. Planner performance.now was fixed at 0. Baseline planner was cf7521de07fb03612650835114d2b5023600ff8c.

The coordinator ran in two VM realms. The harness compared arrays returned by each realm's Array.map using strict deep equality without normalizing the outer array's realm. Both fixture comparisons failed at their first planned-job comparison. The default3 failure displayed two empty arrays; default4 displayed structurally matching jobs. This was a test-harness realm/prototype assertion failure, not evidence of a physics or planner mismatch. Both had zero completed evaluations and zero physics steps.

Recovered exact default3 log record:

```json
{"fixture":"default3","status":"failed","waves":0,"evaluations":0,"physicsSteps":0,"firstSuccessWave":null,"wallMs":12.685861999999986,"failure":"AssertionError [ERR_ASSERTION]: Planned jobs/settings/topology differ\n\n[]\n\n    at runFixture (/workspace/scratch/f887f82f638e/verify-publication-candidate/verification/verify-publication/planner-differential.cjs:37:66)\n    at Array.map (<anonymous>)\n    at /workspace/scratch/f887f82f638e/verify-publication-candidate/verification/verify-publication/planner-differential.cjs:76:1200"}
```

The default4 log record's recovered fields were: status failed; waves 0; evaluations 0; physicsSteps 0; firstSuccessWave null; wallMs 8.415841. Its assertion message was `Planned jobs/settings/topology differ`, followed by Node's abbreviated structurally matching job display (`... Skipped lines`), and the same three stack frames shown above. The display included branch `[3,4,"carom",[{"kind":"cushion","rail":"z-"},{"kind":"object","id":3},{"kind":"object","id":4}]]:root:0`, purpose residual, and settings angle -38.55121678881403, elevation 0, speed 4.5, tipX 0, tipY 0. This paragraph is a summary of that log, not a claim that the full original record survives.

The harness fix normalized both entire planned-job arrays with structuredClone before comparing them. It did not change the runtime planner, solver, evaluator, physical settings, or validation assertions about their data.

## Attempt 2: corrected harness, superseded +3-wave stop policy

The same bounds remained in force: 180 waves, 4,000 evaluations, 20,000,000 steps, 300,000 ms per fixture. The stop policy still allowed three additional complete waves after the first committed success. This corrected run used execution session 9199.

A retained progress observation showed default3 trace sequence 398, type evaluated-and-overlay, wave 27, job id 343, purpose jacobian. The parent was told it had reached wave 27 / approximately 344 actual evaluations without a planner/state/purity mismatch. Those counts describe that observation, not the final interruption point.

The parent then requested stopping at first committed success, with no extra waves. A shell `pkill -INT -f '^node verification/verify-publication/planner-differential.cjs$' || true` was attempted, but its completion did not verify that execution session 9199 had ended. The corrected first-success-only run was started before that verification. Subsequent observations established that the old execution had continued: an old default3 fixture JSON reported status passed with postSuccessWaves 3, and default4 trace data had been written. The old default3 final wave/evaluation totals and old default4 interruption totals were not captured reliably and must not be inferred from the earlier observation.

Execution session 9199 was then explicitly interrupted using write_stdin with a control-C byte. The retained tool result confirmed `exit_code: 130`. There was no final two-fixture summary from this interrupted +3-wave run.

## Attempt 3: final first-success-only run

The bounds were unchanged. Only postSuccessWaves changed from 3 to 0. Execution session 5750 completed with exit code 0. Both fixtures passed at first committed success: default3 at 26 waves / 321 evaluations, and default4 at 79 waves / 1,318 evaluations. The latter took 291,986.259849 ms, below the original 300,000 ms bound. The bound was not extended, and this run was not retried merely to obtain a success.

The output paths were reused across attempts, which was an evidence-retention mistake. The old +3-wave run and final run overlapped briefly before session 9199 was explicitly interrupted. A temporary read of default4.ndjson showed sparse NUL bytes, consistent with overlapping writes/truncation. After the final run completed, both final NDJSON files were parsed in full and their sequence fields were checked for exact continuity from zero. There were 373 default3 records and 1,476 default4 records, both ending with committed records, with no parse error or sequence gap. Both final fixture JSON files report postSuccessWaves 0 and stopReason first-committed-success.

The final run's pass assertions, exit result, fixture summaries, and complete trace validation are retained. Because the attempts shared file paths, per-byte writer attribution during the overlap is not independently recoverable; final trace continuity alone should not be represented as such attribution. Do not treat the earlier failed/interrupted attempts as if they never occurred.

## Unrecoverable material

- Original on-disk Attempt 1 fixture files and summary were overwritten. The default3 error record above and the default4 summary/stack are recovered from the existing tool transcript.
- The complete interrupted +3-wave raw traces, exact final interruption counts, and original standalone log are not preserved.
- No precise absolute start/stop timestamps for every attempt were captured in the retained transcript. The sequence of events and the explicitly reported durations/exit code are retained instead.
- No rerun was made to manufacture missing failure evidence.
