# Peek

Peek is a keyboard-first Chrome tab finder. PEEK-11 implements the first production slice: invoke on an ordinary page, filter open tabs by title or URL, move with the arrow keys, commit with Enter or cancel with Escape.

This is not the complete v0. Previous-tab history, forgiving matching, Tab selection mode and the restricted-page fallback belong to later tickets.

## Development

Peek requires Node 24.15 or newer and npm 11.

```sh
npm ci
npm run build
npm test
npm run typecheck
```

`npm run build` writes the unpacked MV3 extension to `dist/`. The build contains `manifest.json`, `background.js` and `overlay.js`. The extension has no remote code or runtime assets.

The [tooling decision note](docs/tooling-decisions.md) records the selected versions and rationale.

## Load in Chrome

1. Run `npm run build`.
2. Create a fresh temporary Chrome profile. Do not use a personal profile for acceptance testing.
3. Open `chrome://extensions`, enable Developer mode, choose Load unpacked and select this checkout's `dist/` directory.
4. Open `chrome://extensions/shortcuts`. Confirm Peek's Open Peek command uses Control+Space or assign another browser-scoped shortcut if Chrome reports a conflict.
5. Open ordinary synthetic pages in at least two normal windows. Press Control+Space or click Peek's toolbar action.

The palette first mounts a complete, centred loading composition with its input focused, then replaces the loading row with Chrome's tab model without replacing the input or query. Type a title, hostname or URL-path fragment. Arrow keys only change the highlight. Enter revalidates the exact tab and window, removes the palette, activates that tab and focuses its containing window. Escape and click-away remove the palette without activation.

## Disposable Chrome QA

```sh
npm run qa:chrome
```

The command rebuilds Peek, creates a unique `.tmp/chrome-qa/profile-*` directory, starts a loopback-only fixture server and launches the installed Google Chrome binary with that new profile. It never attaches to an existing session. It loads the exact `dist/` directory through Chrome DevTools Protocol's official experimental `Extensions.loadUnpacked` method, verifies Chrome reports it enabled, and closes the test browser when done.

The automated run exercises the real extension worker and injected overlay against synthetic tabs. It asserts first-character preservation, title/URL filtering, exact cross-window commit and focus, Escape and backdrop cancellation, current-target no-op, stale-target safety and a closed-Peek site shortcut. It captures a reveal filmstrip plus light, dark, narrow, filtered and error screenshots. Evidence defaults to `.tmp/chrome-qa/evidence`; set `PEEK_QA_OUTPUT=/absolute/path` to retain it elsewhere.

CDP's `Extensions.triggerAction` covers the real action/listener path but not Chrome's browser-accelerator dispatcher. The run checks `chrome.commands.getAll()` reports physical Control+Space (`⌃Space`) on macOS. To complete the physical-key gate, run `PEEK_QA_MANUAL_SHORTCUT=1 npm run qa:chrome`; when prompted, press Control+Space in the focused disposable Chrome window. The harness waits up to 30 seconds, captures `07-physical-shortcut.png`, and records the result. Do not claim the default automated action trigger as keyboard evidence.

## Permission boundary

Peek requests `tabs` to read open-tab titles, URLs and favicon metadata across normal windows in the current profile. It requests `activeTab` and `scripting` to execute and modify only the ordinary page where the user invokes Peek. It does not read page content, search incognito tabs, request host access, install persistent content scripts or run at startup on every tab.

## Product documents

- [Product direction](PRODUCT.md)
- [First-release specification](docs/first-release-spec.md)
- [Acceptance contract](docs/first-release-acceptance.md)
- [Discovery archive](docs/discovery/README.md)
