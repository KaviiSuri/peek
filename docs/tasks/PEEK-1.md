# PEEK-1 · Find what makes Peek worth using every day

Status at export: done. This is a snapshot; BB Tasks remains the live tracker.

## Destination
Find our way to an agreed, buildable first-release spec: tab-finding experience, moodboard-backed visual direction, Poof-informed technical approach, and daily-use acceptance criteria. The map discovers what good means; it does not execute implementation.

## Notes
Kavii is the first user and product decision-maker; this thread owns continuity and tracking. Use /wayfinder, /grilling and /domain-modeling, adapted to one focused question at a time. Consult /bb-orchestrate-threads before any useful delegation; do not force delegation. No code, mockups, research dispatch or implementation merely because the map exists. References precede mockups. Complete one decision per subsequent working session, with Kavii for HITL decisions. Use native dependency edges. Tasks has no assignee CLI: claim a child by attaching its owner thread and marking it in_progress; do not pick an already claimed child.

Confirmed pre-map agreements remain in PRODUCT.md; new map decisions live in child resolution comments. This index links to them without duplicating their detail. Existing constraints include Chrome-only invocation, all windows in the current profile, title/URL retrieval, immediate list, previous-tab default selection and explicit activation only. Untitled tabs may remain ambiguous. Normal workload is 25–30+ tabs with repeated sites, especially GitHub. Preserve website shortcuts. Two-key invocation preferred; three-key needs hands-on testing. No Neovim-style invocation sequence. Explore both quiet/native and distinctive visual directions in light and dark.

## Decisions so far
Pre-map agreements: PRODUCT.md and originating discovery conversation.

- Which visual direction feels right for Peek? — reference direction agreed; details in the resolved child ticket below.

::task{key="PEEK-2" title="Which visual direction feels right for Peek?"}

- Which result layout makes overlapping tabs easiest to recognise? — Kavii selected variant B; details and prototype evidence in the resolved child ticket below.

::task{key="PEEK-8" title="Which result layout makes overlapping tabs easiest to recognise?"}

- What must search match to feel effortless? — expectations settled with explicit owner defaults; empirical matching risks remain for testing.

::task{key="PEEK-3" title="What must search match to feel effortless?"}

- Which browser constraints must the experience respect? — preparation settled; real Chrome behavior remains an explicit validation gate.

::task{key="PEEK-4" title="Which browser constraints must the experience respect?"}

- Which result-navigation interaction feels fastest without getting in the way? — Kavii kept Tab-toggle selection after trying the prototype; real Chrome invocation remains a separate open child decision.

::task{key="PEEK-5" title="Which result-navigation interaction feels fastest without getting in the way?"}

- Which parts of Poof’s technical approach belong in Peek? — minimal Effect/browser boundaries adopted; exact version and runtime evidence remain experiment gates.

::task{key="PEEK-6" title="Which parts of Poof’s technical approach belong in Peek?"}

- Which invocation shortcut works reliably in real Chrome? — discovery direction settled; Dia evidence and remaining Chrome/restricted-fallback checks preserved in ticket, not claimed complete implementation.

::task{key="PEEK-9" title="Which invocation shortcut works reliably in real Chrome?"}

- What evidence makes v0 ready for daily use? — acceptance contract adopted with explicit owner defaults; no production-pass claim.

::task{key="PEEK-7" title="What evidence makes v0 ready for daily use?"}

## Not yet specified
No unresolved discovery decisions. Carry the recorded verification gates into spec and implementation; do not turn them into ongoing prototype maintenance.

## Out of scope
Implementation and production UI during this map. Additional v0 capabilities beyond finding and switching open tabs. Cross-profile search, global invocation, semantic/content retrieval promises, automatic folders, history, bookmarks, recently closed tabs and browser actions remain future-release candidates, not forgotten requirements.

## Recorded comments

Status changed to In Progress by agent (thr_gdyshcku3c)

Labels changed to wayfinder:map by agent (thr_gdyshcku3c)

Started two Pi child investigations, concurrency capped at two: Opus 4.8 medium curates visual references; GPT-5.6 Sol medium verifies Chrome constraints. Kavii waived human review gates for Wayfinding research only. Workers write isolated thread-storage artifacts, not repository files. Product decisions remain open for conversation; no implementation or merge authority granted. Parent verifies evidence and synthesizes findings.

Wayfinding destination reached. All eight child decision tickets are resolved; first-release specification published as the task below with adopted acceptance attached. Chrome target and Dia-only observations remain distinct; prototype defects are recorded as future acceptance work, not polished indefinitely. No production implementation or passing release verification claimed. Next phase is implementation planning from this spec, not further Wayfinding.

::task{key="PEEK-10" title="Peek v0: first-release specification"}

Status changed to Done by agent (thr_gdyshcku3c)
