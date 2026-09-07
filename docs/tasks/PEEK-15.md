# PEEK-15 · Find tabs from restricted browser pages

Status at export: backlog. This is a snapshot; BB Tasks remains the live tracker.

## Parent

PEEK-10 · Peek v0: first-release specification. Its attached acceptance contract governs this slice.

## Execution

Type: AFK. Stories covered: 3, 14–17, 22. All slices together form one v0 release; this ticket is not a separate feature release. Production implementation has not started merely because this ticket exists.

## What to build

Invoke Peek on genuinely restricted/non-injectable browser pages using a centred transient browser-created extension window. Reuse the existing model, ordering and keyboard interaction rather than creating a second product mode. Browser title-bar/close chrome is accepted; no native companion or fallback-only settings.

## Acceptance criteria

- [ ] Explicit classification selects fallback for restricted/non-injectable browser pages. Arbitrary injection/model/runtime/render defects remain visible errors and are not silently masked by fallback.
- [ ] In temporary Chrome, demonstrate representative browser-owned/restricted pages and an ordinary-page control. Record actual supported cases and centring behavior rather than assuming all Chromium variants match.
- [ ] Fallback uses the same eligible tabs, previous preselection, ranking, typing/selection modes and exact commit behavior as the overlay.
- [ ] Fallback UI is excluded from results and attention history. Opening/closing it must not corrupt previously viewed tab state or treat its own tab as the current user target.
- [ ] Escape, window close, click-away and explicit commit clean up the transient UI and restore keyboard attention appropriately; never reverse intentional focus changes to another window.
- [ ] Composition parity tests and real Chrome evidence verify placement, window chrome, cross-window selection, current-tab no-op, cancellation and exclusion. Dia support is not inferred; no personal profile or Dia automation without explicit permission.

## Blocked by

- PEEK-12
- PEEK-13
- PEEK-14

## Shared boundaries

Use minimal Effect only at browser/lifecycle seams; pure search/interaction and narrow production-shaped test adapters. No Poof UI, content scanning, broad host grants or native companion. Google Chrome evidence is required; Dia discovery and mocks are not production Chrome proof. Read the parent and dependency completion evidence before starting. Do not silently repair broken Git metadata or overwrite installed experiment folders.


## Recorded comments

Blocking state changed to Blocked after dependency addition by agent (thr_gdyshcku3c)

Blocked by PEEK-12 added by agent (thr_gdyshcku3c)

Blocked by PEEK-13 added by agent (thr_gdyshcku3c)

Blocked by PEEK-14 added by agent (thr_gdyshcku3c)

Blocks PEEK-16 added by agent (thr_gdyshcku3c)
