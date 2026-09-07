# PEEK-13 · Find overlapping tabs from imperfect clues

Status at export: backlog. This is a snapshot; BB Tasks remains the live tracker.

## Parent

PEEK-10 · Peek v0: first-release specification. Its attached acceptance contract governs this slice.

## Execution

Type: AFK. Stories covered: 6–9. All slices together form one v0 release; this ticket is not a separate feature release. Production implementation has not started merely because this ticket exists.

## What to build

Connect the shipped title/URL matcher to the real result list and explicit target selection. Reproduce the agreed ambiguity cases without requiring query syntax or semantic/page-content search.

## Acceptance criteria

- [ ] Use the 30-tab ambiguity fixture and an ambiguity-preserving 100-tab stress fixture. Preserve the fixture facts needed to reproduce expectations in test data.
- [ ] orion retry ranks the two Orion/retry matches above Atlas-retry and Orion-only; bare orion prefers acme-labs/orion repository home over more-recent issues/PRs.
- [ ] github auth 880 ranks PR 880 first; sched rtry retrieves scheduler/retry matches above one-clue matches.
- [ ] Case normalization and forgiving retrieval work; clue coverage precedes directness/contiguity. Query order is at most a weak signal. Recency breaks textual ties only; ties remain deterministic.
- [ ] outage does not infer a postmortem absent that word in title/URL; orion incident or postmortem retrieves it. Identical/opaque metadata ambiguity remains an accepted limitation.
- [ ] Pure query examples plus composition/UI tests prove correct ordering, visible highlight reconciliation and exact target commit after query changes. No arbitrary numeric scoring formula becomes a public contract.

## Blocked by

- PEEK-11

## Shared boundaries

Use minimal Effect only at browser/lifecycle seams; pure search/interaction and narrow production-shaped test adapters. No Poof UI, content scanning, broad host grants or native companion. Google Chrome evidence is required; Dia discovery and mocks are not production Chrome proof. Read the parent and dependency completion evidence before starting. Do not silently repair broken Git metadata or overwrite installed experiment folders.


## Recorded comments

Blocking state changed to Blocked after dependency addition by agent (thr_gdyshcku3c)

Blocked by PEEK-11 added by agent (thr_gdyshcku3c)

Blocks PEEK-15 added by agent (thr_gdyshcku3c)
