# Contact graph Chrome investigation

This verification-only branch is a direct child of pressure-recovery baseline 0434bb76d2a0538c318ba447b066f319ffa82ef2. The sole production change is src/inverse-events.js. No main update or deployment is authorized.

Both arms retain pressure recovery, enable next-shot precompute, and rebuild the actual bundled UI. Baseline reconstruction replaces only inverse-events.js with the byte-exact frozen baseline. Every src file is hash-checked, and commit paths are allowlisted. The browser verifies served compiled HTML and key inline modules, including inverse-events.

Recipes were frozen before outcomes; their bytes and SHA-256 remain unchanged. Five layouts plus a 0.25x four-ball cell, four repetitions, two arms: 48 attempts, 24 pairs, balanced alternating order. Fresh sandboxed Chrome per attempt. Full physical rest, native +1 replay, unchanged physical stepping, before/after state identity, all failures and raw records, total/post-rest latencies, raw rAF intervals, long tasks and pressure evidence are retained. No warmup discard or outcome-based layout tuning.

Native timing did not establish improvement, so this run investigates user-visible latency and responsiveness, not promotion. Browser harness drives actual application controller actions and is not itself an exhaustive gesture test. Existing backup browser validation and canonical CPU workflows still run on backup/**; Pages push is main-only and both upload/deploy jobs have main-only guards. No workflows are weakened.

Strict error gates retain font CDN failures and do not silently discard them. GitHub runner scheduling, OS caches and 20-second search budgets may affect results. Missing/failed attempts must accompany all summaries. Runtime correctness and strict errors are distinct fields. No speedup conclusion is valid if identity or replay gates fail.

Prepared locally only. Correctness gate and parent permission are required before creating the GitHub verification branch.
