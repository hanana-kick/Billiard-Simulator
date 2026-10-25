# Original whole-shot reference corpus

`tools/parity/capture-authoritative-corpus.cjs` records the unchanged pinned PhysicsLab backend, including its original cue contact, CCD, sleep, angular resistance and scoring. It does not run a GPU shot or establish backend parity.

Each compressed trace contains every application-step body observation, ordinary contact events, the original initial native snapshot bytes with SHA-256, accepted/rejected strike status, elapsed time, final rest status and score. A manifest records the engine and application source hashes. Existing output files are not overwritten. A rejected strike is distinct from an unfinished horizon and a completed shot.

The default six cases cover normal, side-spin, elevated, four-ball, blocked-corner and elevated-corner inputs. Two additional scoring inputs may be obtained by running the existing physical inverse regression with `INVERSE_PHYSICAL_EVIDENCE` set. Both inputs are replayed independently to complete rest and must score +1 before inclusion. These are backend regression fixtures, not an exhaustive search benchmark.

The verified corpus contains eight cases and 48,477 application steps (48,485 recorded frames). Seven shots complete; the blocked corner is rejected before advancing. The four-ball default scores -1, both verified goal cases score +1, and other completed cases score zero. These observations are CPU reference evidence only. GPU whole-shot equivalence remains unverified.

The capture tool accepts an absolute output directory and an optional evidence JSON path. Its default horizon is 15,360 application steps. It preserves exact initial native bytes through an explicit base64 representation rather than relying on JSON serialization of typed arrays. Source or engine changes require regenerating the corpus; old results do not certify new source.
