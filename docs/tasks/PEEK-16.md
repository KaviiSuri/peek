# PEEK-16 · Keep Peek coherent through delays and failures

Status at export: backlog. This is a snapshot; BB Tasks remains the live tracker.

## Parent

PEEK-10 · Peek v0: first-release specification. Its attached acceptance contract governs this slice.

## Execution

Type: AFK. Stories covered: 10, 18–20. All slices together form one v0 release; this ticket is not a separate feature release. Production implementation has not started merely because this ticket exists.

## What to build

Harden the full user journey in both presentations under worker idle, delayed model delivery, vanished targets and errors. Finish layout-B recognition and light/dark behavior under real workloads. Extend baseline protections from earlier slices rather than postponing all quality work here.

## Acceptance criteria

- [ ] Cold-after-idle and warm opening reveal a coherent first composition without empty-shell construction, unstyled/mispositioned intermediate UI or geometry jump; first intended character is retained.
- [ ] Preparing content before reveal or a deliberate stable loading composition is allowed. Observe actual Chrome frames or capture a filmstrip; rAF/timestamps alone are not visual proof.
- [ ] Cancel during pending model delivery wins: late responses cannot resurrect the palette/window. Repeated invocation and teardown do not create duplicate UI or leaking listeners.
- [ ] Target closure or identity/eligibility change before commit never activates an unrelated tab. Activation/focus/model failures produce deliberate recoverable behavior, not restricted fallback masking.
- [ ] Light/dark checks cover long paths/titles, meaningful distinguishing URL portions, favicons, selection/focus contrast, narrow widths and 30/100-tab workloads. No permanent footer; do not promise to disambiguate metadata-identical tabs.
- [ ] Failure-injection composition tests cover timing races for both presentations; real Chrome cold/warm and visual evidence supplement them. Record emitted size and timing distributions without inventing millisecond acceptance thresholds.

## Blocked by

- PEEK-15

## Shared boundaries

Use minimal Effect only at browser/lifecycle seams; pure search/interaction and narrow production-shaped test adapters. No Poof UI, content scanning, broad host grants or native companion. Google Chrome evidence is required; Dia discovery and mocks are not production Chrome proof. Read the parent and dependency completion evidence before starting. Do not silently repair broken Git metadata or overwrite installed experiment folders.


## Recorded comments

Blocking state changed to Blocked after dependency addition by agent (thr_gdyshcku3c)

Blocked by PEEK-15 added by agent (thr_gdyshcku3c)

Blocks PEEK-17 added by agent (thr_gdyshcku3c)
