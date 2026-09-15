# Development and browser testing

## Build

Use Node 24.15 or newer and npm 11.

```sh
npm ci
npm run build
npm test
npm run typecheck
```

The build writes the unpacked Manifest V3 extension to `dist/`, including the background worker, palette bundles, fallback page, icons and third-party notices. All executable code and styles ship in the extension.

For acceptance testing, load `dist/` into a fresh Chrome profile rather than a personal profile. Set the shortcut at `chrome://extensions/shortcuts`. Exercise ordinary pages across two windows and a restricted page such as `chrome://settings`.

The [tooling decisions](tooling-decisions.md) explain the stack. The [restricted-page implementation notes](restricted-page-fallback.md) cover the temporary window, source validation and cleanup.

## Keyboard isolation

On ordinary pages, Peek renders the palette in an initial `about:blank` iframe inside a closed shadow root. Keyboard events in that document do not reach the page's capture or bubble handlers. This requires no additional host permissions, web-accessible resources or remote scripts. It is an event boundary, not protection against an actively hostile same-origin page.

The loading view and ready results share an input element, so delivering the tab model does not replace the query or caret. This does not recover keystrokes sent before the palette mounts or gains focus. [Startup input loss remains open](https://github.com/KaviiSuri/peek/issues/8).

Tab toggles selection mode and restores the query's caret or selection on return. Shift+Tab follows normal focus navigation; leaving the palette cancels it. Composition events must not prematurely navigate, commit, change mode or cancel. The fallback window closes on commit, Escape, focus departure or its browser close button. Peek must not pull the source window forward after the user moves elsewhere.

## Headless keyboard regression

```sh
npm run qa:keyboard
```

This rebuilds the extension and launches a disposable, headless Chrome profile with local fixtures. It covers ordinary pages and restrictive `frame-src` and `style-src` policies, checking:

- Keyboard isolation and renderer editing commands.
- Focus return and departure, resize, and retired sessions.
- Top-frame message validation.

Evidence goes to `.tmp/keyboard-qa`. Set `PEEK_KEYBOARD_OUTPUT` to use another directory.

This run sends no native desktop events and does not access the OS clipboard. Its clipboard and IME checks use synthetic events to test whether the renderer blocks default behavior. They do not establish that physical input works.

## Broader Chrome regression

```sh
npm run qa:chrome
```

The script builds Peek, starts a loopback fixture server, and launches the installed Google Chrome binary with a unique `.tmp/chrome-qa/profile-*` directory. It never attaches to an existing browser session. It loads `dist/` through CDP's experimental `Extensions.loadUnpacked` command, verifies that Chrome enabled the extension, and closes the test browser when done.

File-access tests change only this disposable extension's file grant and re-enable it after Chrome reloads the configuration. They do not change personal browser or OS permissions.

The script exercises the worker, ordinary-page palette and restricted-page fallback. Coverage includes search ordering, selection and caret behavior, exact destination activation, previous-tab restoration, worker restart, cancellation, stale targets, and narrow or short windows. It checks that hidden results cannot be selected by number. The 30-tab search fixture preserves ambiguous titles and URLs; production search tests also cover a 100-tab fixture.

Fallback tests record Chrome's script-injection rejection, check the explicit Chrome Web Store classification, and test source validation, self-exclusion, geometry and cleanup. The viewport cases include a 175-by-60-pixel input-only window.

Evidence goes to `.tmp/chrome-qa/evidence`. Set `PEEK_QA_OUTPUT` to use another directory. Screenshots have sequential sample numbers. The report records observation intervals, not paint timestamps.

### Physical shortcut checks

The default CDP action trigger exercises Peek's action listener, not Chrome's keyboard-shortcut dispatcher. Do not report that run as proof of the physical shortcut.

For a manual check:

```sh
PEEK_QA_MANUAL_SHORTCUT=1 npm run qa:chrome
```

Press Control+Space when prompted. The script captures `10-physical-shortcut-fresh-tab.png` and records the result.

On macOS, if event-posting permission is already available:

```sh
PEEK_QA_NATIVE_SHORTCUT=1 npm run qa:chrome
```

This run uses desktop focus. Coordinate with anyone using the machine. The script verifies the spawned Chrome PID, executable, disposable profile and active synthetic tab before sending PID-targeted Control+Space. It also uses PID-targeted Command+W for fallback window-close checks. It does not grant OS permissions. The default run closes windows through CDP and provides no native window-control evidence.

The macOS setup activates only the spawned disposable browser. Updating a tab or window through the Chrome API alone may leave the app unfocused.

### Final qualification options

- `PEEK_QA_REQUIRE_COMMITTED=1` rejects dirty-source runs.
- `PEEK_QA_FINAL=1`, together with native shortcut mode, adds the 30/100-tab qualification, idle and warm samples, profile checks and favicon request checks.

The longer run detaches worker debugging before idle measurements and records lost-focus attempts separately. Its compiled key helper checks the disposable PID and timestamps the native event post, excluding compilation from the measured interval.

Passing a readiness-gated input check does not prove that typing immediately after invocation is preserved. Neither CDP observations nor screenshot capture intervals establish first paint. Consult the [qualification matrix](final-technical-acceptance.md) and [remaining manual checks](https://github.com/KaviiSuri/peek/issues/9) before making release claims.

## Favicon and storage boundaries

The worker reads Chrome's browser-owned favicon endpoint and passes bounded PNG data to the palette. The palette never loads remote favicon URLs itself. Chrome's own browsing and favicon fetching are separate.

Each invocation attempts at most 100 icons, with six concurrent reads and a one-second cancellation deadline. Missing, invalid or oversized icons use a title initial. There is no persistent icon cache.

Only current and previous tab and window IDs go into `chrome.storage.session`. Titles, URLs and queries are not persisted there. Creating the temporary fallback window requires no additional permission. See the [privacy policy](../PRIVACY.md) for the full data-handling description.
