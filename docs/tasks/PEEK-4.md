# PEEK-4 · Which browser constraints must the experience respect?

Status at export: done. This is a snapshot; BB Tasks remains the live tracker.

## Question
Which invocation, focus and tab-access constraints must shape Peek before we choose shortcuts or technical tools? Scope is Chrome-focused invocation, all windows in the current profile, no cross-profile access. Establish verified browser facts before recommending choices; do not assume shortcuts are available. Preserve website command palettes, especially Cmd+K. Identify practical candidates and limitations for a later hands-on comparison. No implementation or delegation by default. Resolve product trade-offs with Kavii; cite any inspected primary sources.

## Recorded comments

Blocks PEEK-5 added by agent (thr_gdyshcku3c)

Blocks PEEK-6 added by agent (thr_gdyshcku3c)

Status changed to In Progress by agent (thr_gdyshcku3c)

Primary-source investigation complete; report and verbatim source excerpts attached.

Key evidence:
- Native extension commands are browser-scoped by default, matching Chrome-focused-only invocation. Chrome/OS shortcuts can win; another extension can prevent registration; users can remap or clear bindings. `commands.getAll()` reveals active versus blank but not the reason. Chrome does not document general precedence against webpage JavaScript shortcuts, so GitHub/Linear/BB and Cmd+K preservation still require hands-on checks.
- `tabs.query()` can enumerate all matching tabs. Cross-window title/URL search needs the `tabs` metadata permission; `activeTab` is current-tab-only and insufficient. Selecting a tab in another window requires both tab activation and window focus.
- `Tab.lastAccessed` (Chrome 121+) means last became active *in its window*, not a documented global previous-tab history. Window-focus-only behavior remains a product/test question.
- Action popups are keyboard-triggerable but close on external focus; side panels can persist. Chrome docs do not guarantee initial input focus for either.
- Defensible test inputs, not recommendations: Option+Space, Command+Shift+Space, Command+Shift+E. No candidate is claimed conflict-free. Apple documents Command+Space as Spotlight, so it is a negative control, not a candidate.

Primary sources: https://developer.chrome.com/docs/extensions/reference/api/commands ; https://developer.chrome.com/docs/extensions/reference/api/tabs ; https://developer.chrome.com/docs/extensions/reference/api/windows ; https://developer.chrome.com/docs/extensions/develop/ui/add-popup ; https://developer.chrome.com/docs/extensions/reference/api/sidePanel ; https://support.google.com/chrome/answer/2364824?hl=en ; https://support.apple.com/en-us/102650

Open decisions for Kavii: semantics of “tab just left” across windows; popup versus persistent side panel; two-key Option+Space comfort versus three-key chords; acceptance of broad open-tab title/URL metadata access; minimum Chrome version. No implementation or settings changes performed.

Attached browser-constraints-decision-note.md, a short synthesis of existing primary-source evidence. It separates settled Chrome/product constraints from recommended but unconfirmed owner defaults and empirical checks. Recommended defaults: previous means the last actually visible tab across windows; transient non-destructive interaction that dismisses on commit or cancel; exclude incognito; title/URL metadata only with no content/host access; non-global user-remappable invocation; no shortcut choice before hands-on evidence. Popup auto-close is retained only as a documented lifecycle constraint, not an architecture selection.

The note separates a throwaway local viewer experiment for navigation comfort from real Chrome registration/conflict/profile/window tests that require a later explicitly authorized minimal extension. No genuine preparation blocker remains. Final shortcut selection, cross-window previous semantics, and actual focus behavior remain empirical gates, not authorization to implement. Status unchanged.

Owner resolution for preparation: documented browser constraints are sufficient to proceed to a local navigation experiment. Adopt transient typing-ready interaction, cancel without switching, non-global remappable invocation, no page-content access and non-incognito scope as OWNER DEFAULTS where not already confirmed. Correct the note’s ambiguous previous-tab wording: select the distinct tab viewed BEFORE the currently viewed tab, not the tab visible at invocation. Cross-window tracking is provisional. API facts in the confirmed section are documented evidence, not separate Kavii approvals. No presentation architecture or shortcut selected. Real Chrome registration/conflicts/focus/permissions remain mandatory later evidence; local simulation cannot validate them.

Status changed to Done by agent (thr_gdyshcku3c)

Blocks PEEK-9 added by agent (thr_gdyshcku3c)
