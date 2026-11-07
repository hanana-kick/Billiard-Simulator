# Promotion first-verified stop: proposed Chrome qualification

## Fixed scope and provenance

32 desktop1280×850 cases: four fixture shards(default3/default4/moved3/moved4), four baseline/candidate pairs per fixture in AB/BA/BA/AB order. One runner per fixture; no physical-mobile claim. Separate actual builds at ports8793/8794; baseline production277b3b7174e54b2bef16e09a9b7bfc0f5700b36d, candidate changes only optimizer-service.js(SHA256 d2723c450e14aff9632112eef0d08ce6d65eb420f5f06f20ab600783da8e3d09). Exact raw and build-wrapped embedded hashes required before a case may compute. No source replacement in a running application, production deployment, main write or retry-until-pass.

AGENTS read: real rigid-body physics, real UI components, default settings preserved, actual Korean font loaded, container/GitHub Chrome only, no user desktop. This focused desktop comparison does not replace the existing full responsive/UI release gate.

## Exact fixture inputs

Recovered corrected-live mobile-0 records, used only as immutable fixture data. Default3/default4 come from reconstructed inputs; moved3 archive13567627057 SHA33cfbd4a1c8ef65398281b649086bac009257c1215ce412ae220bc748c3b736a and moved4 archive13567434313 SHA70eea51cdba7be5fd3c70404a271a503c3d277c7dc87e4d3b2a965281f08c197 were downloaded read-only and verified.

Parent-approved controlled initialization restores the exact captured submitted PhysicsLab snapshot(world array→Uint8Array), captured game mode/cue/options and applied shot settings. This is explicitly fixture initialization, NOT UI drag coverage. Both arms use the same input bytes/settings and must re-export identical world snapshots before prediction/strike. No predicted post-shot state, prior optimizer frontier, cached winner or solution is inserted. The historical applied shot is a fixed input to the new real physics run, not an asserted result.

After initialization, prediction/precompute remain on. Actual UI controls trigger prediction refresh if needed and the strike. Natural physics runs through full rest. Actual NextShotService must admit and promote its own matching precompute; the harness never calls start/reconcile/promote directly or creates a job. Settings/request/cache stamps and current predicted-versus-actual rest matching are recorded.

## Predeclared observations

1. Initial forecast readiness: up to15s; require current receipt/settings/cue/snapshot consistency. Rested+nextShot must be reached to cover this fixture's prediction-to-promotion path; otherwise mark uncovered and preserve evidence, no replacement fixture.
2. Aim/precompute readiness: up to8s for actual worker request/evaluation, or a legitimate completed/suspended prepared frontier. Record which state actually occurs; no waiting until a favorable outcome, timer holds or forced suspension.
3. Actual UI strike and natural full rest/promotion: up to60s from strike. Require actual score+1 for the fixed input shot, real sleeping/rested world, same coordinator lineage across admission/promotion and match evidence. No artificial settlement or world replacement after setup.
4. First verified after promotion: observe up to60s from actual promote message. Natural20s budget pauses may end earlier without a result. Such unresolved computation/zero-result budget pauses are NOT stop-policy failures: record missing first-verified coverage, and do not silently Resume inside this initial observation. If first verified already exists at promotion, record latency0/already-verified rather than invent a new search start.
5. Post-first observation: fixed8s beginning at the first genuine verified result/progress observation after promotion (or observed retained verified result at promotion). Baseline is permitted to keep computing/accumulate rows. Candidate must stop after its first verified boundary, preserve identity/frontier and have no active evaluation or live nested evaluation workers after shutdown completes. The retained coordinator itself may remain alive idle; zero total Worker objects is NOT required. Cancellation/deferred last quantum latency must be logged, not assumed instantaneous.
6. Explicit continuation: actual UI Resume, at most4 configured20s slices and100s overall observation; record each slice/pending wave/cost. Preserve every earlier verified identity; report additional identity recall separately. For baseline still searching after8s, actual UI Stop first creates the comparable explicit continuation checkpoint; this is outside natural8s CPU. No retry until another identity appears.
7. Separate final lifecycle/stale phase after natural/recall observations: real UI Stop, retained genuine stale-generation callback delivery only if available, preserved settings/identities and current prediction restore(max8s). Old callback/result delivery is controlled and cannot contaminate natural CPU/recall claims. Absent stale data is uncovered, not a pass. No fake successful result.
8. Independent fresh full-rest replay of all retained new promoted-search identities from their actual post-shot request snapshot, up to40000 steps each. Original initial-shot live score and these replay scores are distinct evidence. Replay cost separate.

## Observational instrumentation contract

Use exact prior audited transport approach, with source hashes and exact receiver/args/return/error preservation checked locally before freeze. No timer delay alteration, timer hold, fake clock, planner ordering changes or instrumentation-made physics result. Native functions must be bound correctly. Interfaces must support pool/coordinator/null/disposed shapes; absent busy/search fields are unavailable/null, never fabricated zeroes. Blob resources are dynamic worker code and never classified as static HTTP assets.

Main and nested worker lineage logs: creation, request/predict/evaluate/promote/resume/suspend/cancel dispatch, worker receive, genuine result/progress receive, termination and request versions. Include raw immutable request and source hashes, candidate/job/wave IDs and parent coordinator lineage. Worker events use performance.timeOrigin+performance.now for cross-context alignment.

Observe actual OptimizerService request/promote/resume/report and actual evaluator begin/advance/finish/dispose, retaining method semantics. Log search/request/cache identity before/after promotion, firstVerifiedTarget, service-local goal versus unchanged request.options.searchGoal, pending/completed job IDs and workAttemptTotal/retry lower bounds. Synchronous advance calls aggregate count/elapsed duration by request/phase; begin→finish includes yields and is not CPU. Completed outcomes can legitimately commit/roll over on Resume; accept retained keys in same wave or logged prior-wave commitment, plus no redispatch of already completed IDs.

Nested messages used only for telemetry are intercepted before application handlers and forwarded to the root audit channel. Original worker source bytes/hashes are recorded before observational append. Instrumentation adds serialization/microtasks and can perturb timing; apply equally to both arms and disclose this overhead.

CDP shared-process CPU/state sampling approximately100ms across preparation, playback, promoted search,8s post-first, explicit continuation, Stop/stale and replay phases. Per-worker OS CPU is reported only if Chrome exposes a defensible actual metric; otherwise explicitly unavailable. Shared renderer/browser/process CPU is a sampled lower-bound estimate, losing final exited-process increments and including overlapping prediction/rendering. It is not foreground-worker CPU. Do not infer CPU savings from busy flags or worker lifetime alone.

## Qualification and reporting

Each case retains screenshot, JSON, source/input hashes, request stamps, exact observed phases and every failure/uncovered reason. Eight-case shard manifest and32-case overall expected counts are fixed. No missing case or unresolved first-result case is averaged as zero CPU. Paired post-first CPU only when both arms actually reach the requested promotion/verified condition on equivalent exact inputs. Group means/medians/ranges with n4 and all exclusions; no pooling older Node or Chrome trials. Initial solve speed and post-first idle savings are separate questions.

Before remote publication/run: review this design and exact source with test_fast_first_frontier, run receiver/worker-lineage/missing-shape contract mocks, syntax checks and source-hash verification. Parent alone publishes test branch/workflow and launches Chrome; no browser or remote write from this worker.
