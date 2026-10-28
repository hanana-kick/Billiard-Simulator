# MMQ2 original rolling extension — isolated CPU checkpoint

No production/default routing changes. MMQ1 modules and their native-reference
snapshots remain unchanged. MMQ2 has explicit version `0x4d4d5102`, still **80**
words per body (the 64-word packets elsewhere are SMT2 input or dense state).

Common ID, original tick/horizon, complete p/v/q, radius, mass, gravity, cloth and
normal-spin drag retain their offsets. For kind3 only:

| Words | Meaning |
|---|---|
|24|Original rolling coefficient K|
|25|Incoming kinetic radius rho|
|26..28|Original x/z position and normal-spin errors|
|29..33|Original five rolling budgets|
|34|Original rolling-partial recipe version|
|35..47,51..63,76..79|Reserved zero|
|64..75|Original-anchor 12-word rolling geometry cache|

The 32-word rolling-tail recipe is reconstructed losslessly from these and the
common words. No SMT2 fitting or constant-acceleration endpoint repacking occurs.
Producer scope is explicit canonical-local context13=1; foreign source/global
uncertainty ownership remains unsupported. Linked qx=vz, qz=−vx, cloth center and
zero vertical velocity are checked. Independent qy decay is retained. The producer also verifies the inherited
no-slip condition2K≤7F against immutable source context (F≤16Q). A linked
state relabelled mode3 cannot override insufficient available cloth friction.
The standalone low-level recipe has no F field and inherits this source admission.

Bounds use original rolling position intervals and original incoming error growth.
Full state samples use the existing rollingPartial law and retain its seven error
words (sample80..86), kinetic radius87 and endpoint mode88. Bounds are never event
or impulse authority. Kind3 source packets that fail local budgets remain invalid.

The original object-record indices stay fixed. Two kind6 regime records are
appended per rolling body: translational stop (subkind0), normal-spin stop
(subkind1). Unlike an advisory stop cache, these participate earliest selection
and minimum proved-clear prefix. Every impact adapter must check all records
through its extended upper time, so a simultaneous/earlier regime cannot be
silently bypassed. A stop boundary requires its genuine regime continuation;
this module does not manufacture an impulse or jump across a stop bracket.

At maximum four bodies and twenty static objects, the ledger has102 records,
within its128-record capacity. Work validation includes all appended records.

CPU tests:11 pass,1 imported native skip. Old kinds0..2 preserve every queried
bound/sample and full ledger word except explicit query version metadata. Rolling
samples match original rollingPartial words, including signed qy, K=0 and tiny
norm cases. Cache/linked-state tampering and invalid source ownership reject.
This checkpoint does not yet provide MMQ2 WGSL or finite-cushion integration.

## Isolated numeric GPU checkpoint (not world integration)

`deterministic-mixed-motion-v2-gpu.mjs` reuses the original rollingPartial WGSL
arithmetic rather than a fitted polynomial. The primitive kernel returns bounds
and full sampled states/receipts. Native SwiftShader software Vulkan18 cases,
7,776 exact CPU/GPU words passed; compilation18.858s, bounded process19.526s,
aggregate1084.58MiB/max child1050.36MiB within1500MiB/110s. This is correctness
only, not hardware throughput. The stop-aware complete ledger native run remains
pending until recorded separately. Existing v1 shaders and references are unchanged.

`deterministic-mixed-cushion-v2.mjs` is a CPU-only finite hull/entry adapter using
the v2 bounds/sampler/query with the unchanged impulse packet ABI. An original
rolling wall case has EDGE root23766..23767, penetration45, response19 iterations
and residual38. Earlier or exactly coincident qy stop blocks response; a stop one
tick later does not. Legacy SMT2 cushion packets/responses remain word-identical
except query version. Combined CPU suite14 passed,1 imported native skip.

## Optimized original-law geometry and producer qualification

The initial full-query shader exceeded the unchanged110s watchdog at1184.87MiB.
Replacing repeated full128-word rollingPartial calls in geometry subdivision with
the same cached rollingPoint law plus scalar/vector directed velocity and exact
receipt-budget formulas removed the compilation bottleneck; no tolerance changed.
Full endpoint sampling still uses rollingPartial, never an endpoint fit.

Expanded signed/diagonal and65535-tick native bank:36 primitive cases15,552 words
and20 full-ledger cases21,120 words exact,2/2 tests passed;17.338s bounded process,
aggregate1013.96MiB/max child978.21MiB. Includes negative components and noninteger
speed norm with distinct floor/ceiling norm bounds.

`deterministic-mixed-motion-v2-producer.mjs` supplies the resident five-binding
source producer (state, SMT2 rows, SMT2 outputs, immutable context, descriptors).
Native9 cases2,160 descriptor words exact,1/1 passed;1.314s process, aggregate
460.29MiB. Includes linked-state rejection, insufficient F, F=16Q acceptance and
F above inherited limit rejection. Host runner does no CPU physics; `encode`
composes directly with resident buffers.

## Original rolling finite-hull GPU qualification

`deterministic-mixed-cushion-v2-gpu.mjs` reuses the original finite-feature query,
admission, and coupled impulse solver. Only the original descriptor bounds/full
sampler are versioned. Interval-norm names are explicitly adapted; original wide
arithmetic and rounded norm semantics remain unchanged. Six resident stage APIs
and buffers match the v1 cushion adapter; stage0 is the explicit MMQ2 ledger.

Native5 cases12,560 words exact across query, all actual hull times, admission,
full roster, endpoint contact packets and unchanged impulse/state. Includes
original rolling entry, earlier/tied qy stop refusal, later-stop acceptance and
legacy SMT2 parity.1/1 passed; compilation32.505s, process33.419s, aggregate
1448.63MiB/max child1417.71MiB within1500MiB/110s. This is a component test,
not end-to-end world REST or hardware throughput.

The extended maximum-capacity ledger bank also passed native22 cases23,232 exact
words, including four rolling bodies/twenty obstacles102 records;8.960s process,
aggregate899.06MiB. V2 clear/release and owning world integration remain separate.

## V2 local clear and owned departure adapters

`deterministic-mixed-clear-v2.mjs` emits original full p/v/q and local error
receipts for both an all-CLEAR horizon and a strictly shorter positive common
clear prefix. Budget/domain refusal or a zero-prefix stop cannot advance.
Advanced q-error receipts preserve original partial-law `qx,qz,qy` order;
only dense XYZ receipts permute to `qx,qy,qz`. A follow-up ABI audit corrected
an earlier v2-only double permutation; tests compare deliberately distinct
qz/qy errors against the original sample, not merely CPU/GPU self-parity.
No qy loss or SMT2 refit is allowed.

`deterministic-cushion-release-v2.mjs` retains the owned last-contact check, actual
finite hull roster/rail identity, complete other-object ledger and endpoint
separation proof. A rolling departure uses original horizontal velocity only as
a geometric outward-sign witness: before a translational stop, its geometric
derivative is a positive scalar multiple of that vector. The independent full
velocity enclosure must also be outward, and both rolling stop records must be
clear. Neither hull ID exclusion nor selected-record deletion is introduced.

CPU cases include real original rolling entry → coupled impulse → owned-world
commit → SMT2 departure, plus isolated source-owned rolling departures and qy /
translation stop refusal (the latter are branch probes, not claims that the
chosen physical impact naturally yields rolling). Global receipt / full-world
REST certification and publication remain outside these component adapters.

Native clear bank: seven cases / 10,304 complete query+advanced+dense words exact,
including signed qy, full clear, positive shorter prefix, maximum roster/obstacle
capacity, unchanged SMT2, budget refusal and zero-prefix regime stop. Compile
18.874s; combined imported suite20/20, bounded process47.651s, aggregate820.82MiB
(max child784.20MiB),1500MiB/110s limits. SwiftShader software Vulkan, not hardware
throughput. Queue wait is not included in execution duration.

Native owned-release bank:16 cases /17,920 complete query+proof words exact,
including actual post-impact departures, permuted hull roster, stale ownership /
mode / status, inward geometric derivative, competing body and obstacle, work
budget, and isolated kind3 outward / qy-stop / translation-stop branches.
Compile20.853s; bounded process21.766s, aggregate1030.85MiB (max child994.23MiB),
1500MiB/110s limits. Component-local certification only; integration stays explicit.

Advanced-error ABI correction requalification: original-sample assertions18passed,
2native skipped in CPU suite; isolated native7cases10,304words exact, bounded
14.705s, aggregate897.17MiB/max child859.18MiB under1500MiB/110s. This supersedes
the earlier advanced-q-error permutation claim; dense errors now also match
original distinct qz/qy receipts under the inherited world mapping.
