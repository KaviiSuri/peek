# PEEK-6 technical-direction recommendation

## Status labels

**User-confirmed direction**

- Effect TS should inform Peek as it does Poof; Poof's UI is excluded.
- V0 is one complete capability: find and switch open Chrome tabs using title/URL metadata only.

**Verified from Poof**

- Poof creates one `ManagedRuntime` per extension context, keeps Chrome entrypoints thin, and composes context-specific Layers.
- MV3 event registration stays synchronous at the entrypoint; event callbacks hand programs to the runtime.
- Chrome capabilities sit behind narrow Effect module interfaces with typed failures and in-memory adapters.
- Persisted/wire values are decoded with Schema; tests exercise production-shaped composition through the same interfaces.
- Poof's scheduler, worker, scan backlog, content scripts, host grants, and extensive diagnostics exist for unbounded page-DOM work. Peek has no equivalent work under its confirmed no-content-access boundary.

Source evidence and line references: attached `poof-technical-fit-memo.md`.

## Recommended candidate direction

Use **minimal Effect at browser and lifecycle seams**, while keeping the two behavior-heavy modules pure:

1. **Search (pure):** title/URL normalization, forgiving retrieval, strongest-first ordering, provisional query order, recency-only ties.
2. **Interaction (pure):** typing/selection state, Tab toggle, restored query/caret, arrows, j/k, visible 1–9 choices, Enter intent, Escape cancel.
3. **Chrome tabs Effect module:** enumerate normal non-incognito current-profile tabs; expose title/URL/favicon/recency facts; track the previously visible distinct tab; commit by activating the tab and focusing its window.
4. **Invocation Effect module:** expose active/unassigned non-global command state and the event that opens the transient experience. Keep listener registration itself synchronous at the MV3 entrypoint.
5. **One composition root per real context:** construct adapters/runtime once, map only actionable failures to UI states, and keep tests on in-memory adapters.

Use Schema only where unknown data crosses Chrome storage/message boundaries. Use typed errors only when recovery differs: command unassigned, metadata unavailable, tab vanished, tab activation failed, or window focus failed. Do not create a service for every helper.

This is the preferred technical candidate, **not a final measured stack claim**.

## Explicit omissions

Do not carry over Poof's content scripts, host permissions, per-site grants, MutationObservers, iframe/shadow-root handling, worker matcher, custom scheduler, scan budget, restore system, options/import/export, storage migration framework, or multi-surface tracing. Do not select React, WXT, Vite, Bun, or a test runner merely because Poof uses them.

## Pending empirical checks

Before calling the direction final:

- verify the current supported Effect release/version from official sources; Poof pins `4.0.0-rc.110`, which is repository evidence, not a version recommendation;
- build one production-shaped test extension and record emitted artifact sizes—Poof's checked-in output is stale and cannot isolate Effect's contribution;
- measure cold and warm invocation-to-input-ready with the minimal runtime in real Chrome;
- verify MV3 worker wake/listener behavior, command registration/unassigned handling, popup focus/dismissal, cross-window previous tracking, tab activation + window focus, profile/incognito exclusion, and permission disclosure;
- confirm pure Search/Interaction tests stay simpler than browser orchestration tests.

No artificial plain-TypeScript-versus-Effect bake-off is needed to reopen the user's preference. If minimal Effect misses readiness or size expectations in the real test, reduce its role based on that evidence. No technical product blocker exists before that experiment.
