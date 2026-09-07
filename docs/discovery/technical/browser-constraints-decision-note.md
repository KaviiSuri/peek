# PEEK-4 browser-constraints decision note

Evidence basis: the attached Chrome primary-source report and excerpts. This note narrows product behavior; it does not select a stack, UI architecture, or shortcut.

## Confirmed requirements

- Peek is invoked only while Chrome is focused, searches all normal windows in the current profile, and does not search other profiles.
- Results use tab title and URL metadata only. Chrome requires the `tabs` permission for arbitrary tabs' titles/URLs; `activeTab` alone is insufficient. Page content, content scripts, and broad host access are not required for this capability.
- Highlighting a result does not activate it. Explicit selection must activate the tab and focus its containing window; Chrome documents these as separate effects.
- Invocation must preserve routine website palettes, especially Cmd+K. No shortcut can be assumed available: Chrome/OS shortcuts may take priority, another extension may prevent registration, and webpage precedence is not generally documented.
- Chrome commands are browser-scoped by default and can be user-remapped or cleared. `commands.getAll()` can reveal active versus blank bindings, but not why a binding is blank.
- A Chrome action popup automatically closes when focus moves outside it. That is a lifecycle constraint, not a decision to use a popup. Chrome does not guarantee initial search-input focus for popup or side-panel surfaces.

## Recommended owner defaults

These are sensible defaults for parent assessment, **not Kavii-confirmed decisions**:

1. **“Previous tab” means the tab that was actually visible immediately before invocation, across Chrome windows.** A tab merely marked active in an unfocused window does not count. Chrome's `lastAccessed` timestamp alone does not guarantee this global meaning, so acceptance should test the behavior rather than assume the API supplies it.
2. **Use a transient interaction contract.** Peek opens ready for typing, remains non-destructive while highlighting, commits only on explicit selection, then dismisses. Escape or focus loss cancels without switching. This specifies lifecycle, not whether the eventual surface is an action popup, side panel, separate window, or another permitted presentation.
3. **Exclude incognito in v0.** Search normal non-incognito windows only, even if the extension is later allowed in incognito.
4. **Use title/URL metadata only.** Do not request page-content access or host permissions to improve matching. The required `tabs` metadata permission remains a visible privacy trade-off to disclose.
5. **Use a non-global, user-remappable invocation.** If the proposed binding is unavailable or intentionally cleared, surface that state rather than silently assuming it works.
6. **Do not select a shortcut before hands-on testing.** Option+Space, Command+Shift+Space, and Command+Shift+E remain test candidates only. Cmd+K and Command+Space are excluded.

## Bounded empirical checks

### A. Throwaway local viewer — navigation only

This can be tested without an extension using the existing 30-tab synthetic fixture in a local viewer:

- opening state shows all tabs and preselects the previously visible tab;
- typing immediately enters the query;
- moving highlight never switches or mutates a tab;
- navigation keys do not interfere with query entry or scroll the underlying page;
- Enter is the sole commit action; Escape and focus loss cancel;
- compare direct navigation while typing against one explicit selection-mode alternative;
- repeat with similar GitHub results, duplicated titles, light/dark presentation, and rapid reopen/return-to-previous flows.

This viewer can establish comfort, mistakes, and lifecycle expectations. It **cannot** validate Chrome shortcut registration, website conflicts, real popup focus, permissions, cross-window tab activation, or profile boundaries.

### B. Real Chrome checks — require later extension authorization

Shortcut selection requires a minimal Chrome extension test and is **not authorized implementation yet**. Once explicitly authorized:

- assign each candidate and confirm it is active via Chrome's shortcut UI and `commands.getAll()`;
- test from GitHub, Linear, BB, text fields, omnibox, DevTools, and Chrome internal pages while confirming Cmd+K is unchanged;
- test two normal windows: selection activates the chosen tab and focuses its window only after Enter;
- test a window-focus-only transition to verify the recommended cross-window “previous” meaning;
- confirm second-profile and incognito tabs are excluded;
- record failed, accidental, or intercepted invocations rather than declaring any chord globally conflict-free.

## Consequential risks and blocker assessment

- The cross-window previous-tab meaning is recommended but unconfirmed, and Chrome does not provide it as a documented global history primitive. It needs empirical verification.
- The final shortcut cannot be chosen responsibly without the later authorized extension test.
- Initial input focus and dismissal behavior must be verified on whichever presentation surface is eventually explored.

**No genuine product blocker remains in PEEK-4 preparation.** Browser constraints and defaults are specific enough to proceed to the bounded local keyboard experiment. Real Chrome shortcut selection remains a later authorization-and-evidence gate, not permission to implement now. Task status is unchanged.
