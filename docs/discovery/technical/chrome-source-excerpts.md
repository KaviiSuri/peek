# Chrome constraints — primary-source excerpts

Retrieved 2026-09-06 in isolated `agent_browser` session `peek-chrome-constraints-thr-gaza7yrmdr`. Quotes below are verbatim excerpts used to verify the companion report.

## Commands API

Source: https://developer.chrome.com/docs/extensions/reference/api/commands

- “An extension can have many commands, but may specify at most four suggested keyboard shortcuts. The user can manually add more shortcuts from the `chrome://extensions/shortcuts` dialog.”
- “Extension command shortcuts must include either Ctrl or Alt.”
- “On macOS Ctrl is automatically converted into Command.”
- “To use the Control key on macOS, replace Ctrl with MacCtrl when defining the `mac` shortcut.”
- “Shift is an optional modifier on all platforms.”
- “Certain operating system and Chrome shortcuts (e.g. window management) always take priority over Extension command shortcuts and cannot be overridden.”
- “By default, commands are scoped to the Chrome browser. This means that when the browser does not have focus, command shortcuts are inactive.”
- “If an extension attempts to register a shortcut that is already used by another extension, the second extension's shortcut won't register as expected.”
- `chrome.commands.getAll()` returns each command and “their shortcut (if active)”; a command's `shortcut` is “blank if not active.”
- The official collision-check example says to check at initial install only because “After installation the user may have intentionally unassigned commands.”
- Reserved `_execute_action` triggers the extension action and does not dispatch `commands.onCommand`.

## Tabs API

Source: https://developer.chrome.com/docs/extensions/reference/api/tabs

- “The Tabs API can be used by the service worker and extension pages, but not content scripts.”
- The `tabs` permission grants access to the sensitive `url`, `pendingUrl`, `title`, and `favIconUrl` properties.
- Host permissions can expose those properties only for matching tabs and also authorize broader interactions with matching pages.
- `activeTab` grants temporary host permission “for the current tab in response to a user invocation” and does not trigger a warning.
- `tabs.query()` “Gets all tabs that have the specified properties, or all tabs if no properties are specified.”
- `Tab.lastAccessed` (Chrome 121+) is “The last time the tab became active in its window as the number of milliseconds since epoch.”
- `Tab.active` means active in its window and “Does not necessarily mean the window is focused.”
- `tabs.update({active: true})` makes a tab active but “Does not affect whether the window is focused (see windows.update).”
- `tabs.onActivated` fires when the active tab in a window changes and includes the tab ID and window ID.

## Windows API

Source: https://developer.chrome.com/docs/extensions/reference/api/windows

- `windows.getAll()` “Gets all windows.” Its query option can populate each window with tabs.
- If populated tab `url`, `pendingUrl`, `title`, or `favIconUrl` is needed, the `tabs` permission is required.
- “The current window is the window that contains the code that is currently executing. It's important to realize that this can be different from the topmost or focused window.” For service workers, current falls back to the last active window.
- `windows.getLastFocused()` gets the window most recently focused, “typically the window ‘on top’.”
- `windows.update(windowId, {focused: true})` “brings the window to the front.”
- `windows.onFocusChanged` fires when the focused Chrome window changes and returns `WINDOW_ID_NONE` when all Chrome windows have lost focus (with a documented Linux window-manager caveat).
- A created browser window may use type `popup`; its `focused` property controls whether it opens active or inactive.

## Action popup

Source: https://developer.chrome.com/docs/extensions/develop/ui/add-popup

- A popup “is triggered by a keyboard shortcut, by clicking the extension's action icon or by calling `chrome.action.openPopup()`.”
- “Popups automatically close when the user focuses on some portion of the browser outside of the popup. There is no way to keep the popup open after the user has clicked away.”

## Side Panel API

Source: https://developer.chrome.com/docs/extensions/reference/api/sidePanel

- Availability: Chrome 114+, Manifest V3+; requires the `sidePanel` permission.
- It hosts extension content “alongside the main content of a webpage.”
- “The side panel remains open when navigating between tabs (if set to do so).”
- A side panel can be opened following a user interaction including “A keyboard shortcut.”
- `sidePanel.open()` (Chrome 116+) may only be called in response to a user action and targets a `windowId` or `tabId`.

## Chrome profiles

Source: https://support.google.com/chrome/answer/2364824?hl=en

- “With profiles, you can keep all your Chrome info separate, like bookmarks, history, passwords, and other settings.”

## macOS shortcut ownership

Source: https://support.apple.com/en-us/102650

- “Every app can have its own shortcuts, and shortcuts that work in one app might not work in another.”
- “Command–Space bar: Show or hide the Spotlight search field.”
- Apple also documents Control–Space and Control–Option–Space as input-source shortcuts when multiple input sources are used.

## Limits of these sources

The inspected Chrome pages do **not** document:

- a precedence rule specifically between a registered extension command and JavaScript keyboard handlers on the current website;
- guaranteed focus placement on a particular input when an action popup or side panel opens;
- a profile selector for `tabs.query()` or `windows.getAll()`;
- a built-in globally ordered “previously visited tab” history across windows;
- a guarantee that any syntactically valid candidate shortcut is free from OS, Chrome, webpage, or other-extension conflicts.
