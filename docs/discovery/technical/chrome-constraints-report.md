# Peek: Chrome constraints evidence

**Scope:** Chrome-only invocation while Chrome is focused; query normal windows in the current profile; titles/URLs only; activate only after explicit selection. Evidence gathered from current first-party Chrome documentation on 2026-09-06. This is not an implementation or a product decision.

## Executive findings

1. **A browser-scoped extension command fits the no-global-shortcut boundary.** Chrome commands are inactive while Chrome is unfocused unless explicitly marked global. Peek should not request global scope for v0.
2. **A declared shortcut is only a suggestion, not an availability guarantee.** OS/Chrome shortcuts can be unbeatable; another extension can prevent registration; the user can reassign or intentionally clear a command. `commands.getAll()` exposes whether Peek's command is active or blank.
3. **Chrome documents no website-shortcut precedence guarantee.** Even if a command registers, GitHub/Linear/BB behavior—especially Cmd+K—requires hands-on testing. No candidate below is claimed conflict-free.
4. **All normal-window tabs are enumerable, but title/URL access needs broad tab metadata permission.** `tabs.query()` can return all tabs; the `tabs` permission exposes every queried tab's title, URL, pending URL, and favicon. `activeTab` is temporary and current-tab-only, so it does not satisfy cross-window title/URL search.
5. **Switching to a result in another window is explicitly two-part.** `tabs.update({active:true})` does not focus its window; `windows.update({focused:true})` brings that window forward.
6. **Chrome's recency timestamp is useful but does not fully define “previous tab.”** `Tab.lastAccessed` (Chrome 121+) records when a tab became active *in its window*. Merely refocusing a window is not documented as updating it. Chrome exposes no built-in global previous-tab pointer.
7. **Presentation surfaces have materially different lifecycle constraints.** An action popup closes as soon as focus moves outside it. A side panel can persist across tab navigation. Chrome does not guarantee which search input receives keyboard focus on open for either surface; that must be tested.

## Fact / source / implication matrix

| Status | Verified fact | Primary source | Implication for later product testing |
|---|---|---|---|
| Documented | Extension commands must include Ctrl or Alt. On macOS, `Ctrl` in a suggested key becomes Command; `MacCtrl` explicitly means Control; Shift is optional. Supported non-letter keys include Space, Comma, Period, arrows, Home/End/PageUp/PageDown, Insert/Delete. | [Commands API — key requirements](https://developer.chrome.com/docs/extensions/reference/api/commands#key-combination-requirements) | A plain unmodified key or Vim-like multi-stroke sequence is not a native extension command. macOS candidates need an explicit platform mapping. |
| Documented | OS and Chrome shortcuts can take priority and cannot be overridden. `Ctrl+Alt` is disallowed because of AltGr. | [Commands API — key requirements](https://developer.chrome.com/docs/extensions/reference/api/commands#key-combination-requirements) | Syntax validity is not proof a shortcut fires. Reserved Chrome/macOS combinations are hard failures, not preferences. |
| Documented | Commands default to browser scope and are inactive when Chrome lacks focus. Global is optional; ChromeOS does not support it; global suggested keys are tightly limited. | [Commands API — scope](https://developer.chrome.com/docs/extensions/reference/api/commands#scope) | Default scope matches Peek v0. There is no product need to request global scope or interfere with other apps. |
| Documented | Only four default shortcut suggestions may be declared. Users may add/remap shortcuts at `chrome://extensions/shortcuts`. | [Commands API — concepts](https://developer.chrome.com/docs/extensions/reference/api/commands#concepts) | Keep the command surface small. User reassignment is a required escape hatch, not an edge case. |
| Documented | A shortcut already used by another extension may fail to register. `commands.getAll()` returns the active shortcut, blank when inactive. Chrome's example recommends collision checking at install only because later blank state may be intentional. | [Commands API — verify registered commands](https://developer.chrome.com/docs/extensions/reference/api/commands#verify-commands-registered), [getAll](https://developer.chrome.com/docs/extensions/reference/api/commands#getAll) | Peek can distinguish “active binding” from “unassigned/conflicted,” but the API does not explain *why* it is blank. Later UX should not silently assume invocation works. |
| Unknown in inspected docs | Chrome does not state a general precedence rule between active extension commands and website JavaScript handlers. | Absence noted across [Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands) | Cmd+K and every candidate must be tried on GitHub, Linear, BB, normal text inputs, and browser chrome. Preserve Cmd+K rather than relying on undocumented precedence. |
| Documented | `tabs.query()` returns matching tabs, or all tabs with no filters. `windowType` can limit results; `incognito` is exposed for exclusion. | [Tabs API — query](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-query) | Querying `windowType: normal` and excluding incognito is consistent with “all normal windows in this profile.” No content scripts are needed just to enumerate. |
| Documented | The `tabs` permission exposes sensitive `url`, `pendingUrl`, `title`, and `favIconUrl`. Host permissions expose those fields only on matching hosts but also permit broader page interaction. `activeTab` is temporary and current-tab-only. | [Tabs API — permissions](https://developer.chrome.com/docs/extensions/reference/api/tabs#permissions) | Title+URL search across arbitrary sites has a real metadata-privacy cost. `tabs` is the narrowly relevant broad metadata grant; `activeTab` alone cannot power the promised list. Whether favicon is needed remains a product choice. |
| Documented | `windows.getAll({populate:true})` can return windows with tabs; sensitive tab metadata still requires `tabs`. “Current window” may differ from focused/topmost; service workers fall back to last active. | [Windows API](https://developer.chrome.com/docs/extensions/reference/api/windows) | Avoid treating “current” as a reliable synonym for focused. The invocation context/window must be handled deliberately in any later design. |
| Documented | Making a tab active does not focus its containing window. `windows.update(...focused:true)` brings a window forward. | [Tabs API — update](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-update), [Windows API — update](https://developer.chrome.com/docs/extensions/reference/api/windows#method-update) | Explicit result selection across windows requires both tab activation and window focus. Highlight movement should perform neither. |
| Documented | `Tab.lastAccessed` (Chrome 121+) is the timestamp when a tab became active in its window. `Tab.active` does not imply the window is focused. `tabs.onActivated` covers active-tab changes; `windows.onFocusChanged` separately covers window focus. | [Tabs API — Tab](https://developer.chrome.com/docs/extensions/reference/api/tabs#type-Tab), [tabs.onActivated](https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onActivated), [windows.onFocusChanged](https://developer.chrome.com/docs/extensions/reference/api/windows#event-onFocusChanged) | `lastAccessed` can support recency ordering, but “the tab just left” across window-focus changes needs explicit product semantics and a hands-on scenario. The docs do not promise a global access history. |
| Documented | Action popups can open from a keyboard shortcut and automatically close when focus moves elsewhere in the browser; they cannot be kept open after click-away. | [Add a popup](https://developer.chrome.com/docs/extensions/develop/ui/add-popup) | Good for transient search, but any click-away dismisses state. Test initial input focus, Escape, re-open behavior, and selection into another window. |
| Documented | Side panels require `sidePanel`, are available Chrome 114+ MV3+, can open from a keyboard shortcut/user action, and may remain open across tab navigation. | [Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) | A persistent surface avoids popup dismissal but consumes browser space and may remain visible after switching. Initial keyboard focus is still undocumented and needs testing. |
| Documented | `windows.create()` can create a browser `popup` window and can request focused or inactive state. | [Windows API — create](https://developer.chrome.com/docs/extensions/reference/api/windows#method-create) | A separate window is technically available, but brings window-management behavior and is not selected here. Test only if transient/persistent built-in surfaces fail. |
| Documented + deduction | Chrome says profiles keep Chrome information separate. Neither `tabs.query()` nor `windows.getAll()` exposes a `profileId` filter. | [Chrome profiles](https://support.google.com/chrome/answer/2364824?hl=en), [Tabs query](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-query), [Windows getAll](https://developer.chrome.com/docs/extensions/reference/api/windows#method-getAll) | **Deduction:** the API offers no way to opt into arbitrary other profiles, which aligns with v0 exclusion. The inspected docs do not explicitly state the enumeration boundary, so verify with two profiles during hands-on acceptance rather than overclaiming. |

## Presentation comparison (constraints only)

| Surface | Documented behavior | Focus/keyboard unknowns to verify |
|---|---|---|
| Action popup | Keyboard-triggerable via the action command; transient; closes on focus outside. | Does the intended search field reliably receive focus? Does Escape close only Peek? What happens when selection focuses a different Chrome window? |
| Side panel | Keyboard/user-action open; window/tab-targetable; can persist while tabs change. | Does opening move focus from the page into the panel on the target macOS/Chrome version? How does the user return focus to the page? Is persistence distracting? |
| Separate Chrome popup window | Chrome can create type `popup` and request focused state. | Window placement, focus stealing, lifecycle, Spaces/full-screen behavior, and whether it feels heavier than manual tab switching. |
| In-page UI | Not required for enumeration; page interaction would add `activeTab`, host permission, or scripting considerations. | Restricted/special pages, website keyboard/event interference, CSS isolation, and focus restoration. The inspected sources do not justify selecting this route. |

## Shortcut candidates for a later hands-on comparison

These are **test inputs**, not recommendations. Each is syntactically allowed by the Commands API and avoids Cmd+K. Availability must be checked through both `commands.getAll()` and actual keystrokes.

| Candidate on macOS | Why include it | Required checks |
|---|---|---|
| **Option+Space** (`Alt+Space`) | Two physical keys; tests the stated preference without consuming Cmd+K. | Can it register and fire? Does it interfere with typing, macOS input behavior, launcher utilities, or website shortcuts? |
| **Command+Shift+Space** | Three physical keys; Space is supported; useful contrast to the two-key candidate. | OS/Chrome priority, other-extension conflict, website behavior, ergonomics in repeated use. |
| **Command+Shift+E** | Three-key alpha alternative so the comparison is not only Space-based. | Same checks; also verify Chrome feature shortcuts and target-site handling on the actual version. |

**Negative controls / do not treat as candidates:** Cmd+K is reserved for existing website palettes by product requirement; Apple documents Command+Space as Spotlight and Chrome says OS shortcuts cannot be overridden ([Apple shortcuts](https://support.apple.com/en-us/102650)); Space-s-f is a multi-stroke modal sequence unsupported by the native Commands API.

## Bounded hands-on checklist for PEEK-5

1. Confirm the assigned candidate is nonblank in Chrome's extension-shortcut UI/API.
2. Invoke from GitHub repository, issue, and PR pages; Linear; BB; a normal text field; omnibox focus; DevTools focus; and a Chrome internal page.
3. Confirm Cmd+K behavior is unchanged on target websites.
4. For each candidate, record: failed invocations, accidental invocations, overwritten typing, page/browser action triggered instead, and perceived hand strain. Do not infer “conflict-free” from one page.
5. Compare popup and side-panel focus: first typed character lands in search; arrows/selection keys do not mutate or scroll the page; Escape and click-away are predictable; returning focus to the chosen tab is reliable.
6. Use at least two normal Chrome windows. Select a result in the background window and confirm both its tab and containing window become active only after explicit selection.
7. Include a window-focus-only scenario to determine whether `lastAccessed` matches Kavii's meaning of “tab just left.”
8. Open a second Chrome profile and confirm it is absent from v0 results; separately confirm incognito exclusion.

## Remaining product questions (not answered by docs)

- Does “previously accessed tab” mean previous active tab within one window, or the tab visible before Peek across window-focus changes?
- Is a transient action popup's automatic dismissal desirable, or does a persistent side panel feel less disruptive despite occupying space?
- Is Option+Space comfortable and non-disruptive in Kavii's real macOS setup, or is a three-key chord safer?
- Is exposing all open-tab titles and URLs via `tabs` acceptable for this narrowly scoped feature? Is favicon recognition valuable enough to display, even though permission scope is unchanged?
- What minimum Chrome version is acceptable if `lastAccessed` (121+) or side panel (114+) is relied on?

## Verification and gaps

- Read and cross-checked the official Commands, Tabs, Windows, action-popup, Side Panel, Chrome profiles, and Apple macOS shortcut documentation in an isolated browser session. Exact excerpts are preserved in [`chrome-source-excerpts.md`](./chrome-source-excerpts.md).
- No extension was installed, no shortcut assigned, no browsing profile attached, and no Chrome/user settings were changed.
- No claim of website precedence, initial UI focus, globally conflict-free shortcuts, or explicit cross-profile API isolation is made because the inspected primary sources do not establish those facts.
