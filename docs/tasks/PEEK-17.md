# PEEK-17 · Qualify the complete Peek v0 for daily use

Status at export: backlog. This is a snapshot; BB Tasks remains the live tracker.

## Parent

PEEK-10 · Peek v0: first-release specification. Its attached acceptance contract governs this slice.

## Execution

Type: HITL. Stories covered: All 22. All slices together form one v0 release; this ticket is not a separate feature release. Production implementation has not started merely because this ticket exists.

## What to build

Qualify the packaged production extension against the PEEK-10 acceptance contract, then ask Kavii to compare representative find-and-switch tasks with manual tab finding. Agents prepare fixtures, evidence and installation instructions; the human contribution is daily-use comfort and release judgment, not routine technical approvals. A test report alone does not make failing requirements pass.

## Acceptance criteria

- [ ] Use a reproducible packaged build with exact version/hash and installation/remapping instructions. Verify emitted manifest, permissions, bundled assets and no remote code or page-content search.
- [ ] Temporary Chrome checks cover command registration/conflicts, fresh-page keyboard invocation, worker cold/warm behavior, first keystrokes, two-window attention/commit/cancel and restricted-window parity.
- [ ] Verify current-profile, second-profile, incognito and Peek-window exclusions, plus truthful permission copy. No personal browser profile access; do not relaunch the manually stopped Dia investigation.
- [ ] Execute normal 30-tab and ambiguity-preserving 100-tab workloads, ranking cases, coherent reveal, stale-target failures, light/dark, keyboard accessibility and IME checks. Attach results and explicit evidence gaps.
- [ ] Record invocation-to-input, query ordering, commit-to-focus and cancel readiness distributions. Compare against manual tab finding; capture wrong selections, corrections, missed keystrokes and accidental mode changes, not merely timing.
- [ ] Kavii evaluates shortcut comfort, recognition and whether Peek is quicker with less query formulation. Report Dia results separately if explicitly tested; Chrome remains the target.
- [ ] Every required acceptance criterion has evidence or remains a release blocker. Route failures to concrete follow-up work and rerun affected checks; do not mark the release qualified with required gaps outstanding.
- [ ] Publish a concise release recommendation with known accepted limitations and evidence links. No production release/distribution is authorized merely by this ticket decomposition.

## Blocked by

- PEEK-16

## Shared boundaries

Use minimal Effect only at browser/lifecycle seams; pure search/interaction and narrow production-shaped test adapters. No Poof UI, content scanning, broad host grants or native companion. Google Chrome evidence is required; Dia discovery and mocks are not production Chrome proof. Read the parent and dependency completion evidence before starting. Do not silently repair broken Git metadata or overwrite installed experiment folders.


## Recorded comments

Blocking state changed to Blocked after dependency addition by agent (thr_gdyshcku3c)

Blocked by PEEK-16 added by agent (thr_gdyshcku3c)
