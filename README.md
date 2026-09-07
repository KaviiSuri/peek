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

The palette mounts only after Chrome returns the tab model, so it never exposes an intentionally empty shell. Type a title, hostname or URL-path fragment. Arrow keys only change the highlight. Enter revalidates the exact tab and window, removes the palette, activates that tab and focuses its containing window. Escape and click-away remove the palette without activation.

## Disposable Chrome QA

```sh
npm run qa:chrome
```

The command rebuilds Peek, creates `.tmp/chrome-qa/profile`, starts a loopback-only fixture server and opens two Google Chrome windows with synthetic tabs. It never attaches to an existing session. Current branded Chrome builds may ignore command-line unpacked-extension flags. If Peek is absent, use Developer mode and Load unpacked once in that disposable profile, selecting the printed `dist/` path.

Check the following in those windows:

- Invoke with the toolbar icon and the reserved `_execute_action` shortcut without clicking the icon first on each site.
- Type the first character immediately. Confirm the first visible palette already has its input and tab rows.
- Filter `orion`, move with arrows and press Enter. Confirm the exact target tab activates and its other window comes forward.
- Reopen, move the highlight and press Escape. Confirm no tab or window activates.
- Commit the source tab. Confirm Peek only dismisses.
- Close a listed target before committing it. Confirm Peek shows "That tab is no longer open" and activates nothing.
- With Peek closed, confirm the fixture's Control+K handler and other browser shortcuts still work.
- Check light and dark system appearance, narrow width, long title/path truncation and visible input/selection focus.

Close both disposable Chrome windows after the run. Stop the fixture server with `kill $(cat .tmp/chrome-qa/fixture-server.pid)` if it remains, then remove `.tmp/chrome-qa`.

## Permission boundary

Peek requests `tabs` to read open-tab titles, URLs and favicon metadata across normal windows in the current profile. It requests `activeTab` and `scripting` to execute and modify only the ordinary page where the user invokes Peek. It does not read page content, search incognito tabs, request host access, install persistent content scripts or run at startup on every tab.

## Product documents

- [Product direction](PRODUCT.md)
- [First-release specification](docs/first-release-spec.md)
- [Acceptance contract](docs/first-release-acceptance.md)
- [Discovery archive](docs/discovery/README.md)
