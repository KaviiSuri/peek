# Peek v0 acceptance contract

> **0.2.0 search amendment:** The owner approved replacing the custom matcher with the fzf JavaScript port, following their fzf-backed Telescope configuration. For nonempty queries, all terms must match; smart case, fzf scores, shorter-label ties and stable discovery order replace the original coverage/phrase/repository/recency rules below. Blank-query previous-tab/MRU ordering remains. Match positions drive safe text highlighting. See [the current behavior](../README.md#fuzzy-search) and [source/adoption details](discovery/telescope-fuzzy-matching.md). Earlier search-policy prose below is historical where it conflicts.


**Status:** adopted discovery contract with production verification pending. This document defines acceptance; it does not claim that production code exists or that release tests have passed.

**Target boundary:** Google Chrome is the stated v0 target. Dia is the browser in which Kavii exercised the discovery extensions. Dia observations are evidence about Dia only; support for Dia or other Chromium browsers is not promised by this contract.

## Product contract and provenance

| Area | Acceptance contract | Provenance |
|---|---|---|
| Job | While Chrome is focused, find and explicitly switch to an open tab from any normal window in the current profile. | User-confirmed before and during the Peek Wayfinding map. |
| Search data | Search open-tab title and URL metadata only. Favicons may aid recognition; browser recency facts may order ties. No page-content or semantic retrieval. | User-confirmed boundary; favicon/recency use operationalizes confirmed visual/search choices. |
| Invocation | Browser-scoped and user-remappable; preserve site/browser keybindings, especially Cmd+K. Physical Control+Space via reserved `_execute_action` is the suggested v0 mapping. | Browser-only and keybinding preservation are user-confirmed. Control+Space was observed to work in Kavii’s Dia trial and is an owner default pending Chrome reliability, conflict, and comfort verification. |
| Ordinary presentation | A frameless palette centred over the current injectable page. | User-confirmed after rejecting the top-right action popup. |
| Restricted presentation | On a genuinely restricted/non-injectable browser surface, open a centred browser-created extension window. Browser title bar/close chrome and somewhat different focus behavior are accepted. It uses the same results and keyboard contract. | User-confirmed. Exact failure classification, placement, and lifecycle are implementation gates. |
| Initial reveal | Do not flash an incomplete empty shell and then populate it. The first visible composition must be coherent. | User-confirmed from Dia prototype observation. Preparing content before reveal or presenting an intentional stable loading composition is an owner implementation choice. |
| Selection | Highlighting never activates. Enter or a visible numeric choice explicitly selects the exact tab and focuses its containing window; commit dismisses Peek. | User-confirmed principle; exact activation ordering is an owner default to verify. |
| Navigation | Typing supports ordinary text, digits, arrows, and Enter. Tab toggles selection mode; selection supports arrows, j/k, visible 1–9 choices, and Enter. Toggling back restores query/caret. Escape closes. | User-confirmed through the Tab-toggle discovery prototype. Shift+Tab handling is an owner accessibility default, not a separately confirmed user decision. |
| Result layout | Two-line layout B: favicon, prominent title, quieter meaningful domain/path. No static shortcut footer. Light and dark must remain readable. | User-confirmed through references and layout comparison. Exact spacing/truncation is implementation work. |
| Search priority | Strongest textual match first; recency breaks equally strong matches and never promotes a weaker match. | User-confirmed. Case normalization, contiguity preference, weak query-order influence, and concrete URL-number cases are owner-selected acceptance defaults/examples. |
| Scope exclusions | No incognito, cross-profile/global search, native companion, persistent host access, startup/all-tab injection, settings, or unrelated actions. | Current-profile/browser-only/title+URL scope and no native companion are user-confirmed. Specific permission and lifecycle constraints are owner/technical defaults. |

## Owner defaults

These defaults make the contract deterministic without pretending each detail was individually ratified.

### Previous and empty-query behavior

- “Previous” means the **previously viewed distinct tab before the current tab**.
- Track observed focused-window attention across windows. A tab merely active in an unfocused window is not treated as viewed.
- If known, preselect that previous distinct tab on open. The current tab is never substituted as “previous.”
- Selecting the already-current tab is a no-op: dismiss without destroying known previous-distinct history.
- With no trustworthy previous history, highlight an eligible non-current tab using deterministic MRU order. Fall back to current only when no eligible non-current tab exists. Do not invent history or add warning/settings clutter.
- After the previous candidate, empty-query results use MRU order with deterministic tie handling.
- Exclude the browser-created fallback window from search results and previous-history observation.

### Cancellation, focus, and failure

- Escape closes without performing tab or window activation.
- Click-away cancels without Peek activating any tab/window. If the user intentionally clicks another window, Peek does not reverse that external focus change to force the old window forward.
- Restore prior page/input focus only when that target is still connected and appropriate in the current context.
- Tab interception exists only while Peek is open. Shift+Tab follows accessible focus behavior and must not trap focus. Global browser/site keybindings remain intact.
- Validate a chosen tab/window before teardown and activation. A vanished target never causes a different tab to activate.
- Use the browser-window fallback only for classified restricted/non-injectable browser surfaces. Arbitrary injection, runtime, model, or rendering defects remain visible error states; the fallback must not silently mask them.

### Search and recognition

- Normalize case.
- Rank clue coverage before textual directness/contiguity, use query order only as a weak provisional signal, then use recency for true textual ties.
- Preserve meaningful path segments—repository, issue/PR number, document path—as width allows. Truncation may still leave identical-title/opaque-URL tabs ambiguous; v0 does not promise to solve indistinguishable metadata.
- No scoring formula, fuzzy library, or framework is prescribed by acceptance.

## Required behavior checks

### Search scenarios

Against the 30-tab ambiguity fixture:

1. `orion retry`: the two Orion tabs containing retry rank above Atlas-retry and Orion-only matches.
2. `orion`: the `acme-labs/orion` repository home ranks above more-recent issues/PRs.
3. `github auth 880`: the owner-selected PR 880 case ranks first from combined domain, title, and path clues.
4. `sched rtry`: scheduler/retry tabs are retrieved without correction; one-clue tabs remain below them.
5. Equal textual matches use recency only as the tie-breaker.
6. `outage` does not infer an Orion postmortem when that word is absent from title and URL; `orion incident` or `postmortem` retrieves it.

Adjacent-topic and synonym misses outside title/URL are accepted. Retrieval for the concrete shortened `sched rtry` case is user-confirmed. Case normalization, the PR-number example, and query-order influence are owner defaults/examples to validate, not independent user-confirmed requirements.

### Interaction and presentation

- Open → query → navigate → commit activates only the explicit target and containing window, then dismisses.
- Open → navigate → cancel performs no activation and leaves history unchanged.
- Current-tab selection remains a safe no-op and retains previous-distinct history.
- Tab mode, j/k, arrows, 1–9, Enter, Escape, query/caret restoration, and IME/accessibility guards match the contract.
- Ordinary overlay and restricted fallback show the same eligible results, ordering, and navigation.
- Initial input accepts the first intended character.
- The first visible frame is coherent in cold-after-idle and warm cases: no empty-shell-to-results flash, unstyled or mispositioned panel, or geometry jump. A deliberate stable loading/error composition is acceptable.
- Visual checks cover light/dark, long titles/paths, selected-row focus/contrast, repeated GitHub tabs, opaque Sheets tabs, and narrow available width. Do not require every metadata-identical duplicate to become distinguishable.

A `requestAnimationFrame` marker is not proof of paint. Visual acceptance requires actual target-browser observation or filmstrip evidence.

### Browser, privacy, and failure

- Chrome command assignment, conflict behavior, first invocation, cold wake, initial focus, and dismissal work in a temporary Chrome profile.
- Cmd+K and routine site/browser shortcuts remain available when Peek is closed.
- Two-window selection focuses the exact containing window; cancel does not activate a tab/window itself.
- Current-profile, second-profile, incognito, and fallback-window exclusions hold.
- Restricted surfaces take the intended fallback; arbitrary defects do not.
- Permission copy truthfully explains title/URL access and ordinary-page execution/modification while affirming no page-content search.

## Workloads and readiness evidence

- **Normal:** the existing 30-tab repeated-site fixture with similar GitHub repositories/issues/PRs, mixed sites, and opaque documents.
- **Stress:** an owner-selected 100-tab synthetic fixture that expands the same ambiguity patterns rather than adding easy unique titles. It is a test input, not a release-volume promise or latency threshold.
- **Real browser:** non-sensitive synthetic tabs across multiple windows in a temporary Chrome profile. Dia may be tested separately and reported separately.

Record cold-after-idle and warm behavior for invocation-to-input, query-to-correct-order, commit-to-target focus, and cancel-to-keyboard readiness. Compare representative find-and-switch tasks with manual tab-strip use, including wrong selections, missed keystrokes, corrections, accidental mode changes, and Kavii’s comfort. Do not invent a millisecond pass number. Readiness means the production-shaped experience is observably quicker and requires less formulation than manual finding, while meeting the correctness and visual criteria above.

## Evidence already established

### User-confirmed Dia evidence

- Option+Space conflicts with Kavii’s AeroSpace mapping and is rejected for this setup.
- Control+Space through `_execute_action` opened the centred overlay keyboard-first on fresh ordinary Dia sites after command/action path parity was introduced.
- The action-popup vehicle’s top-right placement did not satisfy the ordinary centred requirement.
- The in-page overlay was centred on ordinary Dia pages.
- The prototype visibly appended an empty shell before asynchronous results arrived. The captured host-to-model gap (~11–15 ms in retained runs) permits that flash and matches Kavii’s description, but no filmstrip proves the exact painted frame. There is no supported Effect or worker-restart root-cause claim.
- Browser chrome on the restricted-page browser-window fallback is accepted; the fallback itself has not been implemented or verified.

### Mock and built-artifact evidence

- Discovery viewers support layout B and Tab-toggle interaction comprehension.
- Pure/fake tests cover selected search, interaction, previous-distinct, no-op, vanished-target, and teardown behaviors.
- Built throwaway bundles demonstrated synchronous listener registration, `_execute_action` parity, bounded instrumentation, and isolated-fixture overlay mounting.

These are discovery artifacts, not a production foundation and not production acceptance.

## Verification gates still pending

- Google Chrome: command reliability/conflicts, ordinary overlay focus/dismissal, cold/warm coherent reveal, and permission behavior.
- Restricted fallback in Chrome and separately in Dia: classification, centring, result parity, focus/close/return behavior, and exclusion from results/history.
- Real cross-window activation and previous-distinct behavior.
- Real profile/incognito boundaries and accessibility/IME behavior.
- Production matcher results on normal and 100-tab stress inputs.
- Production-shaped emitted size and responsiveness. Minimal Effect is the settled direction, not proof of negligible cost.

These are implementation verification gates against a settled contract, not unresolved discovery choices.

## Decision audit

No unresolved user-facing v0 product decision remains in this scope. Chrome remains the target; Dia remains evidence only. The owner’s remaining work is to judge release evidence against this contract. New proposals for page-content/semantic search, global invocation, persistent host access, native companion behavior, settings, or additional capabilities require a separately scoped decision.
