# Peek centred overlay experiment

**Disposable Dia proving test—not production Peek, not a Chrome result, and not a final architecture.** This package tests whether a browser-scoped command can inject a centred, focused shell into one ordinary active page without persistent host access or page-content search.

## Before loading

Disable the earlier **Peek Chrome Discovery Spike** first. Both experiments may otherwise compete for Control+Space. Do not overwrite its Downloads folder.

Unzip `peek-centered-overlay-experiment.zip` into a **new clearly named directory**, such as `Downloads/Peek-Centred-Overlay-Experiment`, in the existing user-created temporary Dia profile only.

## Smallest manual loading step

In that temporary Dia profile: reopen the extensions-management page used for the prior load → Developer mode → **Load unpacked** → select the new folder containing `manifest.json`, `background.js`, and `overlay.js`. Then open its extension-shortcuts page and confirm the experiment says **Control+Space**.

The manifest uses the reserved `_execute_action` command with `"mac": "MacCtrl+Space"`. In Chromium command syntax, that is physical Control—not `Ctrl`, which maps to Command on macOS. With no action popup, keyboard and icon invocation now share `chrome.action.onClicked`; there is no separate custom `commands.onCommand` injection path. Injection starts from that action callback without awaiting unrelated diagnostic/query work. This parity change targets the observed first-keyboard-versus-icon difference without claiming why Dia behaved that way. Control+Space remains a Dia candidate, not a universal or Chrome default.

## Exact permissions

- `tabs`: reads title, URL, window ID, and Chrome-provided recency metadata for open tabs across normal windows.
- `activeTab`: after the command/action gesture, temporarily grants access to the invoked active tab.
- `scripting`: executes `overlay.js` in the active top frame. This can execute and modify that page's DOM. The experiment mounts its own shell and does not read page text/content.
- `storage`: stores only session-scoped `{currentTabId, previousTabId}` and the last injection/selection diagnostic. No query or durable browsing history is stored.

`incognito` is `not_allowed`. There are no `host_permissions`, persistent `content_scripts`, remote assets, native companion, history/bookmark permissions, or action popup. Nothing injects at startup or into every tab.

## What the package does

- Control+Space or clicking the extension action injects/toggles one centred overlay in the current top frame.
- A closed Shadow DOM isolates experiment styling. All tab titles/URLs are written with `textContent`; no unsafe HTML is used.
- The result rows use a local generic icon slot, prominent title, and quieter domain/path. No remote favicon is fetched.
- The filter is literal and test-only: every whitespace-separated token must occur in title + URL. It is not final fuzzy search or ranking.
- Typing, arrows, Tab selection mode, j/k, visible 1–9, Enter, Escape, and query/caret restoration follow the accepted interaction slice. Modified browser keys and composition are not captured. Cmd+K is untouched.
- Escape, click-away, or repeat invocation removes the host/listeners and restores the pre-overlay focused element if it still exists. Explicit selection asks the worker to tear down first, then activate the exact tab and focus its window. Current-tab selection tears down without changing previous.

## Manual test order

### 1. Ordinary HTTPS page first

1. Open a non-sensitive ordinary HTTPS page in the temporary profile.
2. Press Control+Space. Confirm one shell appears centred over the page and the first typed character lands in its input.
3. Press Control+Space again: it should remove the existing shell, not create a duplicate.
4. Reopen; exercise typing, arrows, Tab, j/k, 1–9, Enter, Escape, and click-away. Highlight/cancel must not switch tabs. Check the page's Cmd+K behavior before and after.

Stop if initial injection or focus fails; record the exact diagnostic before testing selection.

### 2. Restricted/browser-owned surfaces

Try the Dia “In Dia”/new-tab surface and one settings/extensions surface. No fallback window or error tab is created. On failure, the extension action gets a red `!`; hover it for the exact error in its title. The same diagnostic is logged in the extension service-worker console and stored in `chrome.storage.session` under `peek-centered-overlay:last-diagnostic-v1`. Record the exact error in `manual-observations.md`.

To retrieve only that record before reloading/restarting the extension, open this extension's service-worker inspector and run:

```js
chrome.storage.session
  .get("peek-centered-overlay:last-diagnostic-v1")
  .then(({ ["peek-centered-overlay:last-diagnostic-v1"]: diagnostic }) =>
    console.log(diagnostic)
  )
```

This reads one extension-session key, not tabs, page content, or all extension storage.

A failure here is an expected coverage measurement, not a broken ordinary-page result. Do not infer Chrome behavior from Dia.

### 3. Selection only after ordinary-page success

Use two normal windows with non-sensitive tabs. Confirm explicit Enter/number selection focuses the exact target window, Escape/click-away never switches, previously viewed distinct tab is initially highlighted across window attention, and selecting current leaves that previous value intact.

## Known limits

- Basic fixed positioning and maximum z-index do not promise top-layer/fullscreen/dialog dominance.
- A page navigation destroys the injected document and shell.
- Page CSS is isolated by Shadow DOM, but browser/page lifecycle can still remove the host.
- This package does not measure final ranking, production performance, Chrome behavior, or universal restricted-page coverage.
- The generic local icon is deliberate: no remote assets are loaded in this proving slice.

## Cleanup

Remove “Peek Centred Overlay Experiment” from the temporary Dia profile, then re-enable the old experiment only if further comparison is needed. Delete the new unpacked folder when evidence is captured. No Peek/Poof changes are involved.
