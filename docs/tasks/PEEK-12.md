# PEEK-12 · Switch back to the previously viewed tab

Status at export: backlog. This is a snapshot; BB Tasks remains the live tracker.

## Parent

PEEK-10 · Peek v0: first-release specification. Its attached acceptance contract governs this slice.

## Execution

Type: AFK. Stories covered: 4–5, 17. All slices together form one v0 release; this ticket is not a separate feature release. Production implementation has not started merely because this ticket exists.

## What to build

Make open→Enter switch back to the previously viewed distinct tab across observed focused-window attention. Carry attention through browser events and worker lifecycle into visible preselection and explicit selection; this is not a standalone history module.

## Acceptance criteria

- [ ] Known previous distinct tab is preselected; an active tab in an unfocused window does not count as viewed. Remaining empty-query results use deterministic MRU.
- [ ] With no trustworthy history, select a non-current MRU candidate, current only when no other eligible tab exists. Do not fabricate previous history or show warning/settings clutter.
- [ ] Current-tab selection dismisses without destroying previous history; highlight/query/cancel do not update it.
- [ ] Removed tabs, window focus changes, browser attention leaving/returning, and worker idle/restart do not produce stale or invented targets. Persist only minimal validated metadata when needed.
- [ ] Internal Peek windows must be excluded from attention and results; expose this rule for the restricted-window implementation.
- [ ] Production-composition tests and a temporary-Chrome two-window demonstration cover previous preselection, no-op selection, missing history and removed targets.

## Blocked by

- PEEK-11

## Shared boundaries

Use minimal Effect only at browser/lifecycle seams; pure search/interaction and narrow production-shaped test adapters. No Poof UI, content scanning, broad host grants or native companion. Google Chrome evidence is required; Dia discovery and mocks are not production Chrome proof. Read the parent and dependency completion evidence before starting. Do not silently repair broken Git metadata or overwrite installed experiment folders.


## Recorded comments

Blocking state changed to Blocked after dependency addition by agent (thr_gdyshcku3c)

Blocked by PEEK-11 added by agent (thr_gdyshcku3c)

Blocks PEEK-15 added by agent (thr_gdyshcku3c)
