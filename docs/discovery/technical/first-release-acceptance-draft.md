# PEEK-7 preparatory first-release acceptance draft

This is a draft evidence checklist, not a claim that the synthetic viewers passed production acceptance. It separates explicitly user-confirmed requirements, owner-derived acceptance examples/defaults, and real-Chrome gates. A concrete example below is not an individual user decision merely because it exercises a confirmed principle.

## Explicitly user-confirmed product requirements

V0 does one job completely: while Chrome is focused, find and switch an open tab from any normal window in the current profile. It uses title and URL metadata only; it does not read page content, search other profiles, run globally, include incognito, or add history/bookmarks/actions. Favicon and Chrome-provided recency facts may support recognition and tie-breaking without widening that boundary.

The accepted interaction direction is explicit selection: highlighting never activates. The accepted navigation includes typing plus optional Tab selection mode with arrows, j/k, visible 1–9 choices, Enter, and Escape. The accepted visual direction is layout B: favicon, prominent title, and quieter meaningful domain/path, without a static shortcut footer. Search must reward strong textual relevance before recency and must not require a learned formulation strategy.

## Consolidated behavior checks

The checks below operationalize those requirements for the experiment and eventual release. Details such as the PR 880 query and Shift+Tab handling are owner-derived acceptance examples/defaults, not separately confirmed user choices.

### Opening, selection, and navigation

- Opening shows the tab list before a query is entered and preselects the **previously viewed distinct tab before the current tab**, across window attention where observed. “Previous” is never the current tab at invocation.
- Highlight movement never activates a tab. Enter explicitly selects; selection focuses the chosen tab and window, then Peek disappears.
- Selecting the already-current tab is a no-op: it dismisses without collapsing the remembered previous distinct tab.
- Escape always cancels and closes without changing the active or previous tab.
- Typing mode accepts ordinary text and digits; arrows move the highlight without corrupting the query.
- Tab toggles into and out of selection mode. In selection mode, j/k and arrows move; visible choices 1–9 select; Enter selects the highlight. Toggling back restores the exact query and caret position.
- Tab override exists only while Peek is open. Shift+Tab and accessibility/focus escape behavior must not trap focus.

### Search expectations

Using the 30-tab repeated-site fixture:

- `orion retry`: the two Orion tabs containing retry rank above Atlas-retry and Orion-only matches.
- `orion`: the `acme-labs/orion` repository home is first, regardless of a more-recent issue/PR.
- `github auth 880`: PR 880 is first by combined domain, title, and path clues.
- `sched rtry`: both scheduler/retry tabs are retrieved without correction; one-clue tabs remain below them.
- Equal textual matches use recency only as the tie-breaker; a recent weak match never outranks a stronger textual match.
- `outage` does not semantically infer **Orion incident postmortem** when `outage` is absent from title/URL. `orion incident` or `postmortem` retrieves it.

No scores or algorithm are prescribed. Observable priority is: clue coverage, textual directness/contiguity, provisional query order, then recency tie-break.

### Visual recognition

- Use chosen layout B: favicon; prominent title; quieter meaningful domain/path beneath.
- Preserve distinguishing URL portions such as repository, issue/PR number, and document path as width allows; validate long-title/path truncation rather than hiding identity.
- Selected-row contrast, text hierarchy, and focus indication remain readable in light and dark.
- No static shortcut footer. Contextual selection-mode badges/hints may appear only when useful.
- At 25–30 overlapping tabs, repeated GitHub rows and Sheets remain scannable without cramped or clipped content.

## Provisional owner defaults and examples to validate

- Previous tracking follows observed browser attention: when focus changes windows, the focused window’s visible tab becomes current and the formerly viewed distinct tab becomes previous. Background tabs merely marked active in unfocused windows do not all become “previous.” If the extension lacks observation history after first install or cleared session state, it reports that limitation rather than substituting the current tab.
- Exclude incognito even if Chrome later grants extension access there.
- Invocation is browser-scoped, user-remappable, and visibly reported if unassigned/unavailable.
- Opening is transient: input is ready immediately; focus loss cancels; commit dismisses; focus returns to the selected page.
- If a result tab vanishes before Enter, do not activate another tab accidentally: keep Peek open with refreshed results or close with a clear recoverable state.
- Request only the `tabs` metadata permission needed for arbitrary titles/URLs. Do not request page-content or broad host access.
- Technical candidate is minimal Effect at Chrome/lifecycle seams with pure Search and Interaction modules; it remains subject to real emitted-size/readiness evidence.

## Workload and evidence required

### Fixtures

1. **Normal:** the existing 30-tab fixture, retaining repeated GitHub repositories/issues/PRs, similar titles, opaque Sheets URLs, and mixed sites.
2. **Stress:** a recorded 100-tab synthetic fixture made by expanding the same ambiguity patterns, not by adding easier unique titles. This is a workload input, not a release threshold.
3. **Real test profile:** user-created temporary Chrome profile/windows with non-sensitive synthetic pages. Never inspect or install into a personal profile without explicit permission.

### Responsiveness measurements—no guessed pass number

Record distributions separately for cold worker/runtime and warm repeats:

- invocation received → search input accepts the first character;
- keypress → correct result order painted for normal and stress fixtures;
- Enter → target tab active and target window focused;
- cancel → original tab ready for keyboard input again.

Also run the same retrieval tasks manually by tab-strip scrolling and with Peek. Record task completion time, wrong-tab selections, missed keystrokes, corrections, accidental mode changes, and Kavii's observed comfort. Readiness requires Peek to feel quicker and require less formulation than the manual workflow; discovery does not invent a millisecond cutoff.

### Failure and privacy checks

- Permission copy accurately explains access to open-tab titles/URLs and absence of page-content access.
- Unassigned/conflicted command is detected and recoverable through Chrome remapping.
- A tab closed between listing and selection cannot cause a different tab to open.
- Two-window selection focuses the correct window; cancel never changes windows.
- Second-profile and incognito tabs never appear.
- Website Cmd+K palettes remain unchanged.

## Accepted v0 limitations

- Identically titled/opaque-URL tabs may remain hard to distinguish even when recency orders them.
- Adjacent-topic or synonym queries absent from title/URL may return no result.
- Full empty-query ordering beyond the previous-tab preselection need not imply semantic importance.
- Synthetic viewers prove interaction comprehension and visual direction only; they do not prove Chrome registration, permissions, focus, cross-window history, bundle cost, or production speed.

## Unverified release gates

- A comfortable, non-disruptive shortcut must be demonstrated in real Chrome; none is selected yet.
- Initial input focus, dismissal, and keyboard focus recovery must work on the chosen test presentation.
- Cross-window previous tracking, tab activation, and containing-window focus must match the contract.
- Current-profile/incognito boundaries and `tabs` permission disclosure must be observed in a temporary test profile.
- Minimal Effect emitted size and cold/warm readiness must be measured before describing its impact as negligible.

---

# Narrow Chrome experiment outline

## What to learn

Can one test-only MV3 extension, using minimal Effect only at Chrome/lifecycle seams, establish: shortcut registration and conflicts; immediate input focus; transient cancel/select behavior; two-window activation; previous-distinct tracking; profile/incognito exclusion; permission truthfulness; and realistic cold/warm readiness?

## Test vehicle—not final architecture

Use an **action popup** solely because Chrome can bind its action to a command and its documented focus-loss closure exposes the hardest transient-lifecycle constraint with the smallest test surface. This does not select action popup for production. Do not build options, content scripts, page search, history, bookmarks, or production styling.

The popup should display actual title/URL metadata from a user-created temporary test profile and support the already-confirmed interaction contract. Matching may use only the small fixed acceptance query set; do not implement or benchmark a dummy matcher as final search performance.

## Candidate adjustments

Start with Option+Space; if Chrome/OS/site conflict evidence rejects it, change only the command mapping to Command+Shift+Space, then Command+Shift+E. Do not branch into rival stacks or presentation surfaces during this experiment.

## Minimal artifacts

- unpacked test-extension source and generated manifest, clearly labelled non-production;
- emitted file sizes and exact Effect version;
- instrumentation log with cold/warm timestamps for invocation, input-ready, results-painted, commit/cancel;
- observation table for command active/blank, GitHub/Linear/BB/Cmd+K behavior, popup focus, two-window activation/previous, vanished tab, second profile, and incognito;
- one short screen recording or screenshots proving focus, selection, cancellation, and cross-window outcome;
- user-written comfort verdict for each attempted chord.

The user manually loads the unpacked extension. The agent must not install it, attach to a personal profile, or inspect personal tabs without explicit permission.

## Success observations

- At least one candidate registers active and invokes reliably in the temporary profile without displacing Cmd+K or a routine tested shortcut.
- First typing lands in search; Tab/j/k/numbers/arrows/Enter/Escape follow the confirmed contract with no trapped focus.
- Highlighting and cancel are non-destructive; selection activates exactly the chosen tab/window and dismisses.
- Previous distinct tab works across two windows and survives no-op current selection.
- Unassigned, vanished-tab, profile/incognito, and permission states are honest and recoverable.
- Cold/warm measurements are captured, not interpreted as final production speed unless the test vehicle contains the corresponding production-shaped path.

## Stopping condition

Stop when one chord has complete evidence or all three candidates have a documented conflict/failure. Make only small fixes needed to distinguish test-harness defects from Chrome behavior, then rerun the same matrix. Do not expand scope, polish production UI, add capabilities, or choose the final architecture from this experiment alone.
