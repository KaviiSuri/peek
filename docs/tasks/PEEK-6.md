# PEEK-6 · Which parts of Poof’s technical approach belong in Peek?

Status at export: done. This is a snapshot; BB Tasks remains the live tracker.

## Question
After inspecting Poof at /Users/kavii-suri/code/KaviiSuri/poof and understanding Peek’s browser and interaction requirements, which Effect TS patterns fit this small product, and which would add unnecessary complexity? Poof is a technical reference only; its UI is excluded. Do not choose a stack from familiarity alone. Separate observed Poof facts from proposed Peek choices; settle trade-offs with Kavii. No implementation, scaffold or research dispatch during charting.

## Recorded comments

Blocking state changed to Blocked after dependency addition by agent (thr_gdyshcku3c)

Blocked by PEEK-4 added by agent (thr_gdyshcku3c)

Blocked by PEEK-5 added by agent (thr_gdyshcku3c)

Blocks PEEK-7 added by agent (thr_gdyshcku3c)

Blocking state changed to Not blocked after PEEK-5 moved to Done by agent (thr_gdyshcku3c)

Status changed to In Progress by agent (thr_gdyshcku3c)

Attached poof-technical-fit-memo.md after read-only inspection of Poof instructions, scope, package/config, ADRs, entrypoints, Effect modules/Layers/errors, storage/schema boundaries, and tests. Source paths and line ranges are cited.

Keep/adapt: thin Chrome entrypoints; synchronous MV3 listener wiring outside the effect runtime; narrow browser adapters with failure-capable in-memory implementations; pure search and interaction modules; schema validation at persisted/message edges; one runtime per extension context only if Effect is chosen; production-shaped composition tests.

Leave in Poof: per-node Effect hot path, custom scheduler/Turn, worker matcher, scan backlog/tracing, content scripts, host grants, DOM/shadow/frame/restore machinery, broad Layer graph, options/import/export, and Poof-specific observability. Those answer unbounded page-content work Peek explicitly does not have.

Minimal responsibility seams proposed: pure Search, pure Interaction, Chrome tabs, Invocation/wiring, and one composition root. No framework/package selection.

Main consequential trade-off: whether Effect earns its runtime for Peek v0 versus plain TypeScript behind the same seams. Resolve later through a small production-shaped measurement of emitted size, cold-open readiness, worker wake behavior, and test clarity—not by familiarity. Poof proves browser-context feasibility but not Peek performance. Its checked-in output is stale and cannot attribute size to Effect; memo labels that limitation.

No product blocker found. Cross-window previous observation and transient-surface behavior remain evidence items from PEEK-4. PEEK-6 status unchanged; no repo edits, code, installs, tests, or user questions.

Kavii approved continuing: consolidate technical recommendation and acceptance checklist, then one narrow real-Chrome experiment, then first-release spec. GPT child is synthesizing a minimal Effect-oriented recommendation respecting the stated Poof preference; no stack-by-inertia or production implementation. Real-browser and performance claims remain unverified.

Attached technical-direction-recommendation.md (SHA-256 7af14cf16e13312573e96f305bc0d0d6c51aba906417f1ac95d9f219b4fe0362). Preferred candidate: minimal Effect at Chrome/lifecycle seams, pure Search and Interaction modules, one composition root per context, synchronous MV3 registration, narrow fakeable adapters, and Schema only at unknown-data edges. Explicitly omits Poof content/scan/scheduler/host-grant/options/migration machinery and makes no UI/build-tool choice. This is not a final stack claim: current Effect version, emitted size, cold/warm input readiness, worker wake behavior, and Chrome focus/activation behavior remain measured gates. Poof remained clean; no implementation or status change.

Owner resolution: carry forward minimal Effect at browser/lifecycle boundaries, pure search and interaction modules, thin synchronously wired Chrome entrypoints, narrow fakeable adapters and production-shaped tests. Omit Poof DOM/scanning/scheduling/host-grants/options machinery. This adopts the technical direction consistent with Kavii’s preference, not a full production stack or performance claim. Exact experiment dependency version, emitted size and browser readiness must be verified; these remain in the real-Chrome experiment. No React/WXT/Bun choice inferred from Poof.

Status changed to Done by agent (thr_gdyshcku3c)
