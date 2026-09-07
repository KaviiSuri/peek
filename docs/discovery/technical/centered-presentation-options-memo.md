# PEEK-9: centred presentation options

## New evidence, kept narrow

**Kavii-confirmed in Dia:** Option+Space conflicts with his AeroSpace remap; Control+Space opens the experiment without another reported action. The loaded UI says “In Dia,” appears at the top-right with browser/window chrome, and does not meet his confirmed requirement: **centred over the page, like Raycast**.

This is Dia evidence, not Chrome evidence. Dia says it is Chromium-based, but its own release notes describe Chromium side-panel support as a separately added compatibility feature; that is not a promise that every Chrome extension surface behaves identically. Chrome documentation below defines Chrome facts only. [Dia 1.10.1 release notes](https://www.diabrowser.com/release-notes/1-10-1-year-end-release)

## Options

### 1. Action popup — not viable for the centred requirement

Chrome documents action popups as UI shown from the toolbar action, automatically sized between 25×25 and 800×600. The documented APIs choose the popup document; `openPopup()` can choose a browser `windowId`. They expose no screen coordinates, page-relative coordinates, or centred-placement control. The browser owns the anchor/placement. Changing CSS cannot move that outer surface. [Chrome `action` API](https://developer.chrome.com/docs/extensions/reference/api/action)

**Conclusion:** keep the existing popup only as historical shortcut/focus evidence. Do not evolve it into the final presentation.

### 2. Separate extension popup window — centreable, but not an over-page overlay

`chrome.windows.create()` supports `type: "popup"`, `focused`, `left`, `top`, `width`, and `height`; Chrome specifies that dimensions include the window frame. The extension can centre those bounds relative to the previously focused normal browser window without reading page content or adding host permission. Chrome exposes no documented create/update control that makes this window frameless or always-on-top. It is a separate focused browser window, with browser/OS frame behavior and custom blur/close lifecycle. [Chrome `windows` API](https://developer.chrome.com/docs/extensions/reference/api/windows)

This can be broadly available where page injection is unavailable, and a `popup`-type window can be excluded from normal-window previous-tab tracking. It still does not satisfy “centred over the page like Raycast” faithfully: the visible frame, focus transition, z-order, and Dia rendering are browser/OS owned. Dia’s exact frame and placement must be observed; Chrome docs cannot answer them.

### 3. Programmatic in-page overlay — closest viable extension-only match, not universal

A browser-scoped `commands` shortcut is an explicit gesture that can grant `activeTab`. With both `activeTab` and `scripting`, Chrome permits `scripting.executeScript()` in the active tab using a temporary host grant; no persistent `host_permissions` entry is required. The injected isolated-world script can mount a centred overlay and communicate with the extension service worker for the title/URL-only tab list. It need not inspect page text or implement content search. [Chrome `activeTab`](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) · [Chrome `scripting`](https://developer.chrome.com/docs/extensions/reference/api/scripting) · [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

Permission wording must remain exact: this design **can execute code in and modify the active page’s DOM after invocation**. Choosing not to read page content is an audited behavior boundary, not a limitation enforced by `activeTab`. `activeTab` is temporary—normally until navigation or tab close—and does not make every page injectable.

The important limitation is structural. Chrome’s valid extension match schemes are HTTP, HTTPS, wildcard HTTP(S), and file; browser-internal schemes such as `chrome://` are not valid injection match targets. `activeTab` supplies temporary host permission but does not turn an unsupported/restricted document into an injectable one. Dia’s internal-page schemes and restrictions are undocumented here, so “In Dia,” new-tab, settings, extension, PDF, and other browser-owned surfaces require direct Dia observation rather than a Chrome promise. [Chrome match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)

Page overlays also inherit page-surface risks: fullscreen behavior, extreme z-index/CSS, DOM replacement, and navigation can remove them. Shadow DOM and isolated-world execution reduce collisions; they do not create a universal browser-level overlay.

### 4. Other genuine alternatives

- **Side panel:** Chrome defines it as UI alongside webpage content and potentially persistent. It is not centred or transient, so it contradicts the confirmed interaction. It also depends on Dia’s version-specific side-panel support. [Chrome `sidePanel`](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- **Regular extension tab:** universal extension UI, but replaces/creates a tab rather than appearing over the page.
- **Native companion/Raycast-style app:** can own a frameless centred window even over restricted pages, but requires native installation, lifecycle/signing, and likely `nativeMessaging`; it is a major product/distribution expansion and not justified for v0.

There is no documented Chrome extension surface that is simultaneously frameless, centred over arbitrary pages, browser-scoped, and available on every browser-owned/restricted page.

## Recommendation

Test **the programmatic in-page overlay** next because it is the only narrow extension-only candidate that directly exercises Kavii’s confirmed spatial requirement. Preserve all existing product boundaries:

- command remains browser-scoped; use Kavii’s Dia-working Control+Space only as the Dia test candidate, not a Chrome default;
- permissions added for the test are exactly `activeTab` and `scripting`; retain `tabs` only for all-open-tab title/URL metadata and session storage only if previous tracking remains in the slice;
- inject a static centred shell in the top frame, use a tiny fixed list, and do not read page text, benchmark ranking, or add persistent host permissions;
- remove the overlay on Escape, explicit selection, reinvocation, and navigation; highlighting remains non-activating.

**Product trade-off parent should take back to Kavii only if the test succeeds:** accept “centred overlay on injectable ordinary pages, explicitly unavailable on restricted/browser-owned pages” for v0, or pay for the visibly different separate-window fallback. Universal Raycast-like presentation would require leaving the extension-only boundary.

## One narrow proving test

Without changing the installed experiment until separately authorized, prepare one disposable overlay build and have Kavii manually load it in his test Dia profile. Observe only:

1. Control+Space injects one centred, initially focused shell on an ordinary HTTPS page; Cmd+K remains untouched.
2. Typing, Tab mode, arrows/j/k, 1–9, Enter, Escape, reinvocation, and click-away behavior remain local and non-destructive.
3. A second normal window selects/focuses the exact target and preserves previous-distinct semantics.
4. Invocation on Dia’s “In Dia”/new-tab and one other browser-owned page records the actual success or injection error; no fallback is silently substituted.
5. Permission presentation and source inspection confirm no `host_permissions` and no page-content reads.

Stop after those observations. They prove or reject the centred-overlay candidate in Dia; they do not establish Chrome behavior, universal page coverage, final styling, or production performance.
