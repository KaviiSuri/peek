# Peek v0 first-release specification

**Status:** ready for implementation planning; production implementation and verification do not yet exist.

**Product target:** Google Chrome. Dia was Kavii’s discovery test browser and remains separately labelled evidence; this specification does not promise support for Dia or Chromium browsers generally.

## Problem Statement

Kavii routinely works with roughly 25–30 or more open tabs across multiple Chrome windows. Many tabs come from the same sites—especially similar GitHub repositories, issues, and pull requests—so titles and favicons alone are often insufficient. Finding the right tab by scanning and scrolling the tab strip is slow, and a tool that demands memorized search syntax, interrupts website shortcuts, activates tabs while browsing results, or feels slower than manual finding is not worth adopting.

Peek needs to make one high-frequency action dependable: recall a tab from a few remembered title, site, repository, issue, or path clues and switch to it explicitly, without searching page content or expanding into a general browser launcher.

## Solution

Build a focused Chrome extension that opens from a browser-scoped, user-remappable shortcut. On ordinary injectable pages it presents a frameless palette centred over the current page. On genuinely restricted/non-injectable browser surfaces it presents the same result model and keyboard interaction in a centred browser-created extension window; normal browser window chrome is accepted for this fallback.

Peek immediately exposes eligible tabs from all normal windows in the current Chrome profile. It searches title and URL metadata only, ranks stronger textual evidence before recency, and uses a two-line recognition layout: favicon, prominent title, and quieter meaningful domain/path. Highlighting is non-destructive; only explicit selection activates the chosen tab and focuses its containing window.

The interaction combines direct typing with an optional Tab-toggled selection mode. The initial visual composition must reveal coherently rather than flashing an empty shell before results. V0 contains no page-content search, global launcher, native companion, settings product, or unrelated browser actions.

## User Stories

1. As a Chrome user with many open tabs, I want to invoke Peek without leaving Chrome, so that I can find a tab without scanning the tab strip.
2. As a user on an ordinary webpage, I want Peek centred over the page, so that the search interaction feels immediate and spatially focused.
3. As a user on a restricted browser surface, I want Peek to open in a centred browser-created extension window with the same results and navigation, so that the core task remains available even when page injection is blocked.
4. As a user who remembers where I was just working, I want the previously viewed distinct tab before the current tab highlighted when trustworthy history exists, so that switching back is immediate.
5. As a first-time or reset user, I want a sensible eligible non-current tab highlighted without fabricated history or warning clutter, so that Peek remains useful before it has observed a previous tab.
6. As a user who remembers fragments rather than exact titles, I want to type ordinary title, site, repository, issue, or URL-path clues without field syntax, so that search requires little formulation.
7. As a user searching overlapping tabs, I want tabs covering more remembered clues to rank above tabs covering fewer clues, so that the intended result appears predictably.
8. As a user, I want recency to break only genuine textual ties, so that a recently used weak match cannot displace a stronger match.
9. As a user who types shortened fragments such as `sched rtry`, I want relevant scheduler/retry tabs retrieved without correction, so that minor omissions do not derail the task.
10. As a user viewing similar GitHub tabs, I want a favicon, prominent title, and meaningful domain/path—including useful repository or issue/PR portions where space permits—so that I can recognize the intended row.
11. As a keyboard user, I want arrows and Enter available while typing, so that I can move and commit without changing modes.
12. As a user who prefers j/k or numeric selection, I want Tab to enter and leave selection mode, so that those controls are available without corrupting my query.
13. As a user returning from selection mode, I want my exact query and caret restored, so that toggling modes does not lose editing context.
14. As a user, I want Escape to close Peek without Peek activating a tab or window, so that cancellation is safe.
15. As a user reviewing results, I want highlight movement to remain non-destructive, so that no tab switches until I explicitly commit.
16. As a user selecting a tab in another window, I want the exact tab activated and its containing window focused, so that selection completes the task.
17. As a user selecting the current tab, I want Peek to dismiss without destroying previous-distinct history, so that the next return action still works.
18. As a user facing a tab that closed after listing, I want Peek never to activate another tab by mistake, so that stale results fail safely.
19. As a user invoking after idle or on a fresh page, I want the first visible palette composition to be coherent and ready for my first character, so that I do not see a split empty-shell construction flash.
20. As a user in light or dark appearance, I want selected rows, title/path hierarchy, focus indication, and truncation to remain readable, so that the interface is dependable throughout my workflow.
21. As a user of website and browser commands, I want Cmd+K and other keybindings unchanged when Peek is closed, so that Peek does not take over unrelated workflows.
22. As a privacy-conscious user, I want Peek limited to current-profile normal-tab metadata and no page-content search, so that its access matches its narrow purpose.

## Implementation Decisions

### Invocation and surfaces

- Implement Peek as a Chrome Manifest V3 extension.
- Register wake listeners synchronously at service-worker module evaluation so Chrome can dispatch commands reliably.
- Use Chromium’s reserved `_execute_action` route for keyboard/action parity. Suggest physical Control+Space while keeping the command browser-scoped and user-remappable. Dia success does not waive Chrome verification.
- On ordinary pages, inject only after the invocation gesture and only into the active top-level page. Do not install persistent content scripts or request persistent host access.
- Use a dedicated classifier for known restricted/non-injectable browser surfaces. Only that classification selects the browser-created extension-window fallback. Injection, model, runtime, or rendering defects remain visible errors and are not silently redirected to fallback.
- The fallback is centred, transient, browser-created, and allowed to retain title bar/close chrome. It uses the same result model and interaction behavior and introduces no fallback-only features or settings.
- Exclude the fallback extension window from searchable results and previous-attention history.

### Responsibilities and seams

Use a small set of deep responsibilities rather than transplanting Poof wholesale:

1. **Search:** pure title/URL normalization, retrieval, ranking, and deterministic tie behavior.
2. **Interaction:** pure query, typing/selection mode, highlight, caret, commit, and cancel transitions.
3. **Attention:** previous-distinct/current observation semantics independent of Chrome event plumbing.
4. **Browser tabs:** narrow adapter for eligible-tab listing, target revalidation, tab activation, containing-window focus, ordinary-page injection, and fallback creation/lifecycle.
5. **Invocation and presentation:** synchronous MV3 wiring, surface choice, model delivery, teardown, focus handling, and visible error states.
6. **Composition:** one explicit composition root per extension context.

Carry forward the minimal Effect direction from PEEK-6: use Effect at browser/lifecycle boundaries where failure, dependency substitution, and composition benefit; keep Search and Interaction pure. Use narrow fakeable adapters and one runtime per extension context if needed. Do not carry Poof’s DOM scanning, scheduler/Turn, worker-matcher, host-grant, migration/options, or broad tracing machinery.

No React, WXT, Bun, bundler, component library, or prerelease dependency choice is implied. Exact stable dependencies and emitted artifacts are implementation choices that must meet the testing gates.

### Tab model and scope

- Enumerate eligible tabs across all normal windows in the current Chrome profile.
- Search title and URL metadata only. Favicons may be displayed; browser recency facts may be used for ordering.
- Exclude incognito, other profiles, browser-created fallback UI, and entries lacking eligible normal-tab identity.
- Keep any persisted/message data minimal and schema-validated at unknown-data boundaries.
- Permission copy must distinguish metadata access from ordinary-page execution: Peek can read open-tab titles/URLs and can execute/modify the invoked page to render the overlay, but product behavior does not inspect page content.

### Search ordering

- Normalize case.
- Rank clue coverage before textual directness and contiguity.
- Query order may be a weak provisional signal but never a hard rejection rule.
- Apply recency only after textual relevance is equal.
- With an empty query, preselect known previous-distinct first; order remaining eligible tabs by MRU with deterministic ties.
- Without trustworthy previous history, highlight an eligible non-current MRU candidate. Use current only when no eligible non-current tab exists; do not invent history or add configuration/warnings for this transient state.
- Preserve title/URL-only honesty: synonyms or adjacent topics absent from metadata may produce no result, and metadata-identical tabs may remain ambiguous.

### Interaction and focus

- Opening starts in typing mode with the list visible.
- Arrows move highlight in typing and selection modes. Enter commits the highlighted result.
- Tab toggles selection mode; selection enables j/k and visible 1–9 choices. Returning restores query and caret.
- Escape always cancels. Tab interception exists only while Peek is open. Shift+Tab follows an accessible, non-trapping focus path. IME composition is not hijacked.
- Highlighting, querying, mode changes, and cancellation never activate a tab.
- Before commit, revalidate target tab/window identity and eligibility. Teardown the active Peek surface, activate the exact target, then focus its containing window.
- Current-tab commit dismisses as a no-op and preserves previous-distinct history.
- Click-away performs no Peek-driven activation. Do not reverse an intentional user focus change to another window. Restore prior page/input focus only when connected and appropriate in the current context.

### Coherent reveal and errors

- Do not expose the prototype’s empty shell while awaiting the asynchronous tab model.
- The implementation may assemble initial content before reveal or show an intentional stable loading composition. Acceptance concerns the coherent first visible state, not a mandated rendering algorithm.
- Cancellation/teardown wins over late asynchronous model completion; no delayed reveal may resurrect a closed surface.
- Provide deliberate empty and error states that preserve the same stable geometry and keyboard escape.
- A `requestAnimationFrame` callback is a scheduling opportunity, not proof of paint or absence of visual flash.

## Testing Decisions

Testing approach is an owner default under the adopted PEEK-7 acceptance authority. Tests assert external behavior and responsibility contracts rather than internal Effect operations, CSS implementation, or a specific fuzzy-search score.

### Highest useful seam

The primary production-shaped seam exercises:

**invoke → obtain eligible model → query/order → navigate → commit or cancel → observe browser adapter calls and surface teardown**

Run the same scenarios for ordinary overlay and restricted fallback. Use a fakeable browser adapter for deterministic composition tests, then repeat the browser-dependent acceptance set in a temporary Chrome profile. Avoid a collection of low-value tests coupled to internal helper functions.

### Pure behavior tests

- Search cases: `orion retry`, bare `orion`, owner-derived `github auth 880`, `sched rtry`, textual ties with recency, case normalization, and honest `outage` miss.
- Interaction cases: typing, digits, arrows, Tab round trip, j/k, visible 1–9, Enter, Escape, caret restoration, IME guard, and highlight reconciliation after result changes.
- Attention cases: previously viewed distinct before current, focused-window observation, no current substitution, no-op current commit, missing-history non-current fallback, MRU remainder, removed tabs, and fallback-window exclusion.

### Browser-boundary and composition tests

- Synchronous command/action wiring and `_execute_action` parity.
- Current-profile normal-window listing and incognito exclusion.
- Restricted-surface classification versus arbitrary-error handling.
- Target revalidation before teardown/activation; vanished target cannot activate another tab.
- Exact cross-window tab activation followed by containing-window focus.
- Cancel/click-away performs no activation; focus restoration occurs only when appropriate.
- Late model completion cannot reveal a cancelled surface.
- Ordinary/fallback model, ordering, and keyboard parity.
- Permission and manifest checks reject page-content APIs, persistent host grants, startup/all-tab injection, remote code/assets, and unintended global behavior.

Poof provides prior art for synchronously wired background listeners, narrow Effect Layers/adapters, schema boundaries, in-memory failure-capable fakes, and production-shaped composition tests. Reuse those testing ideas, not Poof’s content-scanning architecture. See **PEEK-6 — Which parts of Poof’s technical approach belong in Peek?** and the [technical direction recommendation](discovery/technical/technical-direction-recommendation.md).

### Fixtures and real-browser acceptance

- Run the normal 30-tab fixture with repeated GitHub repositories/issues/PRs, mixed sites, similar titles, and opaque documents.
- Run an owner-selected 100-tab stress fixture that expands the same ambiguity patterns. It is a workload input, not an arbitrary performance threshold.
- Verify light/dark, long title/path truncation, selected-row readability, focus indication, and narrow available width. Do not require metadata-identical opaque duplicates to become distinguishable.
- In a temporary Google Chrome profile, verify shortcut registration/conflicts, keyboard-first invocation, cold-after-idle and warm coherent reveal, first-character delivery, ordinary focus/dismissal, two-window commit, cancellation, current-profile/incognito boundaries, and permissions.
- Verify restricted fallback in Chrome; report Dia separately if tested. Check centring, accepted window chrome, result/navigation parity, Escape/commit close behavior, source-context return behavior, and exclusion from results/history.
- Preserve Cmd+K and representative site/browser shortcuts.
- Exercise actual keyboard and accessibility behavior, including Tab/Shift+Tab, focus visibility/restoration, and a real IME where available.
- Compare representative find-and-switch tasks with manual tab-strip use. Record wrong selections, missed keystrokes, corrections, accidental mode changes, and user comfort.

Record cold and warm distributions, but invent no millisecond pass threshold. Release readiness requires the production-shaped path to feel quicker and require less formulation than manual finding while meeting correctness, privacy, accessibility, and coherent-reveal criteria.

No discovery prototype result counts as a passing production test.

## Out of Scope

- Page-content search, semantic search, embeddings, or inferred adjacent topics.
- Cross-profile or incognito search.
- Global invocation outside Chrome or a Neovim-style leader sequence.
- Persistent host permissions, startup/all-tab injection, native companion software, or remote code.
- Settings/options as a product feature; the restricted fallback is not a settings surface.
- History, bookmarks, recently closed tabs, page navigation, browser actions, automatic folders, and other launcher capabilities. These remain possible future-release candidates, not v0 promises.
- Solving ambiguity when title/URL metadata is genuinely identical or opaque.
- Exact pixel values, UI framework, bundler, package manager, or prerelease dependency selection in this product specification.
- Continued polishing or adopting the throwaway discovery extensions as production foundations.
- Declaring support for Dia or Chromium browsers generally from Dia discovery evidence.

## Further Notes

### Decision provenance

| Decision | Canonical task | Evidence/synthesis |
|---|---|---|
| Raycast-inspired readability; favicon/title/meaningful path; no static footer | **PEEK-2 — Which visual direction feels right for Peek?** | [Visual reference report](discovery/visual/visual-reference-report.md) |
| Two-line result layout B | **PEEK-8 — Which result layout makes overlapping tabs easiest to recognise?** | [Result-layout viewer](discovery/visual/prototype-result-layouts.html) |
| Strongest textual relevance first; recency only on ties; title/URL boundary | **PEEK-3 — What must search match to feel effortless?** | [Search acceptance note](discovery/technical/search-acceptance-note.md) |
| Chrome API/permission/shortcut constraints | **PEEK-4 — Which browser constraints must the experience respect?** | [Chrome constraints report](discovery/technical/chrome-constraints-report.md), [decision note](discovery/technical/browser-constraints-decision-note.md) |
| Tab-toggle typing/selection interaction | **PEEK-5 — Which result-navigation interaction feels fastest without getting in the way?** | [Tab-toggle discovery prototype](discovery/visual/prototype-keyboard-tab.html) |
| Minimal Effect boundaries and Poof exclusions | **PEEK-6 — Which parts of Poof’s technical approach belong in Peek?** | [Poof fit memo](discovery/technical/poof-technical-fit-memo.md), [technical recommendation](discovery/technical/technical-direction-recommendation.md) |
| Control+Space Dia evidence; centred overlay; restricted-window fallback; coherent reveal | **PEEK-9 — Which invocation shortcut works reliably in real Chrome?** | [Centred options memo](discovery/technical/centered-presentation-options-memo.md), canonical task resolution comments |
| Daily-use acceptance authority | **PEEK-7 — What evidence makes v0 ready for daily use?** | [Adopted acceptance contract](first-release-acceptance.md) |

Task comments are the canonical decision record. This specification synthesizes them for implementation; it does not replace the Wayfinding map with a competing set of decisions.

### Evidence limits and learned false starts

- No production implementation exists. All extension packages and HTML viewers are throwaway discovery/proving artifacts.
- The original action-popup vehicle proved useful for command/focus exploration but failed the ordinary-page centred requirement.
- The first centred-overlay experiment used a custom command path while icon click used the action path. Dia required per-site icon priming in that build. The v2 `_execute_action` parity build worked keyboard-first on fresh ordinary Dia sites with unchanged permissions. This supports the route decision; it does not prove the exact original Dia cause or Google Chrome behavior.
- Kavii identified a brief empty-box-then-results flash. Prototype code appended the shell before awaiting the model, and retained timing showed an approximately 11–15 ms host-to-model-response gap. That ordering can permit the observed flash, but no filmstrip captured the exact painted frame. Do not attribute it to Effect or a worker restart. Production must satisfy coherent-reveal acceptance instead of preserving the prototype sequence.
- Local mocks established selected logic and bundle execution only. They do not establish actual Chrome focus, paint, permission, worker lifecycle, profile, or cross-window behavior.

### Verification checklist carried into implementation

- Google Chrome evidence remains required even though the invocation/presentation discovery decision is closed.
- Dia evidence remains separately labelled; supported-browser expansion requires a later decision.
- Restricted fallback implementation and focus lifecycle remain unverified.
- Production matcher, real cross-window attention/activation, profile/incognito boundaries, coherent visual reveal, accessibility/IME behavior, permission copy, emitted size, and cold/warm responsiveness remain gates.
- These are verification work against settled acceptance, not open discovery questions and not reasons to continue prototype maintenance.
