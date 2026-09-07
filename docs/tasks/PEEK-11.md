# PEEK-11 · Open Peek and switch to a tab in Chrome

Status at export: backlog. This is a snapshot; BB Tasks remains the live tracker.

## Parent

PEEK-10 · Peek v0: first-release specification. Its attached acceptance contract governs this slice.

## Execution

Type: AFK. Stories covered: 1–2, 6, 10–11, 14–16, 21–22. All slices together form one v0 release; this ticket is not a separate feature release. Production implementation has not started merely because this ticket exists.

## What to build

Deliver an installable production MV3 extension: invoke on an ordinary page, see centred two-line tab results, filter title/URL, navigate with arrows, then explicitly commit or cancel. Include all normal windows in the current profile. This is the first working path, not a scaffolding-only ticket.

Before coding, record the remaining UI framework, bundler, package manager, test runner and stable dependency-version choices in a short decision artifact attached here. Verify current APIs/releases from primary sources and explain fit and alternatives briefly. Carry forward minimal Effect at browser/lifecycle boundaries, pure Search/Interaction, synchronous wake listeners, narrow fakeable adapters and validation of unknown messages/storage. Do not reopen Effect preference or inherit Poof tooling automatically. No new user approval gate for routine tooling choices; raise only a genuine conflict with the spec.

## Acceptance criteria

- [ ] Reproducible build emits a loadable MV3 artifact; selected stack and commands are documented. Do not reuse throwaway prototypes as the production foundation.
- [ ] Reserved _execute_action unifies icon/keyboard invocation; suggest remappable browser-scoped Control+Space. Verify fresh ordinary-page keyboard invocation in a temporary Chrome profile without per-site icon priming.
- [ ] Overlay is centred, begins in typing mode, and displays favicon/title/meaningful path with basic readable light/dark selection and no static shortcut footer.
- [ ] Title/URL filter, arrows, Enter and Escape work end-to-end. Highlight/query/cancel never activate; explicit commit revalidates the exact target and focuses its containing window. Current-target commit simply dismisses.
- [ ] Only current-profile normal non-incognito tabs are eligible. No persistent host access, startup/all-tab injection, native companion, remote code or page-content search. Explain metadata access versus invoked-page execution honestly.
- [ ] Tests exercise invoke→model→filter→navigate→commit/cancel through production composition with fakeable browser calls. Real Chrome evidence covers two-window selection, cancellation, first-character delivery and preservation of closed-Peek site/browser shortcuts.
- [ ] Provide deliberate empty/error states, basic teardown and safe focus restoration; no deliberate empty-shell flash. Later tickets expand ranking, history, modes, restricted-page support and adverse-timing coverage; this slice alone is not releasable v0.
- [ ] Confirm a usable checkout before implementation. Existing discovery worktree Git metadata was broken; do not silently repair unrelated metadata or overwrite loaded Downloads folders.

## Blocked by

None - can start immediately.

## Shared boundaries

Use minimal Effect only at browser/lifecycle seams; pure search/interaction and narrow production-shaped test adapters. No Poof UI, content scanning, broad host grants or native companion. Google Chrome evidence is required; Dia discovery and mocks are not production Chrome proof. Read the parent and dependency completion evidence before starting. Do not silently repair broken Git metadata or overwrite installed experiment folders.


## Recorded comments

Blocks PEEK-12 added by agent (thr_gdyshcku3c)

Blocks PEEK-13 added by agent (thr_gdyshcku3c)

Blocks PEEK-14 added by agent (thr_gdyshcku3c)
