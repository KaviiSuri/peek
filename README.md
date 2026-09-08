# Peek

Peek is a keyboard-first Chrome tab finder. Invoke on an ordinary page, filter open tabs by title or URL, move with the arrow keys, commit with Enter or cancel with Escape. When Chrome has observed a previously viewed distinct tab, Peek highlights it first so open → Enter returns there immediately.

This is not the complete v0. Peek includes forgiving title/URL clue matching, a Tab-toggled keyboard selection mode, and a transient extension-window fallback for known restricted pages.

## Development

Peek requires Node 24.15 or newer and npm 11.

```sh
npm ci
npm run build
npm test
npm run typecheck
```

`npm run build` writes the unpacked MV3 extension to `dist/`. The build contains `manifest.json`, the background and shared palette bundles, and the static fallback extension page. The extension bundles all executable code and styles. The worker reads Chrome's browser-owned favicon endpoint and sends bounded PNG data to the palette. The palette never loads remote favicon URLs. Chrome's own page/icon loading is separate from Peek's rendering.

The [tooling decision note](docs/tooling-decisions.md) records the selected versions and rationale. The [fallback implementation note](docs/restricted-page-fallback.md) records classification, provenance, lifecycle and evidence limits.

## Load in Chrome

1. Run `npm run build`.
2. Create a fresh temporary Chrome profile. Do not use a personal profile for acceptance testing.
3. Open `chrome://extensions`, enable Developer mode, choose Load unpacked and select this checkout's `dist/` directory.
4. Open `chrome://extensions/shortcuts`. Confirm Peek's Open Peek command uses Control+Space or assign another browser-scoped shortcut if Chrome reports a conflict.
5. Open ordinary synthetic pages in at least two normal windows. Press Control+Space or click Peek's toolbar action.
6. Open `chrome://settings/` or another known restricted Chrome surface. Invocation opens the same palette in a transient browser window, requesting source-centred bounds that Chrome or the OS may adjust. Chrome Web Store pages are also explicitly classified because Chrome blocks extension injection there despite their HTTPS scheme. File URLs use fallback only when Chrome's file-access capability is denied.

The [technical qualification matrix](docs/final-technical-acceptance.md) separates passing source checks, unfinished final Chrome qualification, and the later human trial. An open palette does not survive worker suspension transparently: Enter reports expiry without switching; Escape and a fresh invocation recover.

The palette first mounts a complete, centred loading composition with its input focused, then replaces the loading row with Chrome's tab model without replacing the input or query. Type a title, hostname or URL-path fragment; ordinary digits remain query text. Arrow keys only change the highlight. Enter revalidates the exact tab and window, removes the palette, activates that tab and focuses its containing window. Escape and click-away remove the palette without activation.

Tab enters selection mode without changing the query. In selection mode, arrows or j/k move the highlight and the visible 1–9 badges commit the corresponding rows. Tab returns to typing and restores the exact caret or text-selection range. Shift+Tab is deliberately not intercepted; when focus leaves the closed-shadow palette, Peek cancels without restoring over the new focus destination. Composition keystrokes are left to the browser/IME and cannot navigate, commit, toggle mode or cancel Peek prematurely. Escape, focus leaving the transient fallback, its browser close button, and explicit commit close the fallback window. Peek never forces the source window forward after the user has focused another normal window.

## Disposable Chrome QA

```sh
npm run qa:chrome
```

The command rebuilds Peek, creates a unique `.tmp/chrome-qa/profile-*` directory, starts a loopback-only fixture server and launches the installed Google Chrome binary with that new profile. It never attaches to an existing session. Its file-capability controls change only this disposable extension's file grant and re-enable it after Chrome's configuration reload; no personal/global browser or OS permission changes. It loads the exact `dist/` directory through Chrome DevTools Protocol's official experimental `Extensions.loadUnpacked` method, verifies Chrome reports it enabled, and closes the test browser when done.

The automated run exercises the real extension worker, injected overlay, and restricted-page extension-window fallback against synthetic tabs. It asserts first-character preservation, title/URL filtering, a digit-bearing typing query, Tab mode and exact caret restoration, j/k navigation, exact visible digit commit, resize-driven digit-label coherence, Shift+Tab focus-exit cancellation, a branded-Chrome composition event route, exact cross-window commit and focus, Escape and backdrop cancellation with active-tab identity checks, exact current-target no-op, stale-target safety and a closed-Peek site shortcut. Its restricted-page phase records Chrome's actual script-injection rejection on browser-owned surfaces, verifies the explicit HTTPS Chrome Web Store classification separately, measures the popup against its source-window bounds, checks result/keyboard parity, provenance and self-exclusion, cross-window and current-source commit, Escape/focus-away/browser-close cleanup, and clean reinvocation. Its 30-tab ambiguity phase verifies combined clues, bare repository preference, a URL PR number, dropped characters, case normalization, an honest synonym miss, explicit postmortem retrieval and exact result-to-tab commit through the shipped overlay matcher. A 100-tab ambiguity-preserving fixture is covered by the production search tests without an arbitrary timing threshold. The Chrome run also records exact current/previous/selected tab identities across two focused windows, ignores activation in an unfocused window, checks removed-history fallback, and stops/restarts the worker to prove session restoration still preselects the previous tab. It measures loading/ready/error panel bounds and input visibility at normal, 480×720 narrow and 900×240 short viewports. Fallback regression controls additionally reproduce 358×74 CSS pixels at DPR2, narrow 236×189 and 175×189, 175×74, and an input-only 175×60 viewport; hidden rows cannot be committed, and the three-window native clipping case remains in the run. Screenshots use sequential sample numbers; `report.json` records actual capture/query observation intervals and explicitly does not treat them as paint timestamps. Evidence defaults to `.tmp/chrome-qa/evidence`; set `PEEK_QA_OUTPUT=/absolute/path` to retain it elsewhere.

CDP's `Extensions.triggerAction` covers the real action/listener path but not Chrome's browser-accelerator dispatcher. The run checks `chrome.commands.getAll()` reports physical Control+Space (`⌃Space`) on macOS. When macOS event-posting permission is already available, run `PEEK_QA_NATIVE_SHORTCUT=1 npm run qa:chrome`; the harness creates a fresh synthetic tab with no prior Peek host/action invocation, verifies its exact active identity plus the spawned Chrome PID's executable and disposable profile, then sends Control+Space directly to that PID with CoreGraphics `CGEvent.postToPid`. In native mode, the restricted checks also use already-authorized PID-targeted Cmd+W to test Chrome's window-close route and check fresh `chrome://version/` invocation. Default mode closes the target through CDP and does not claim native window-control evidence. Set `PEEK_QA_REQUIRE_COMMITTED=1` to reject dirty-source final runs. The macOS setup explicitly activates only the spawned disposable app because a tab/window API update can leave a background app unfocused. Add `PEEK_QA_FINAL=1` with native mode to run the 30/100-tab qualification, natural-idle/warm samples, profile canaries and favicon request checks. This longer run detaches worker debugging before idle and records lost-focus attempts separately. A compiled, disposable-PID-checked key helper timestamps the native post, excluding compilation from product latency.

Otherwise, run `PEEK_QA_MANUAL_SHORTCUT=1 npm run qa:chrome` and press Control+Space when prompted. Both paths capture `10-physical-shortcut-fresh-tab.png` and record the result. Do not claim the default automated action trigger as keyboard evidence.

## Permission boundary

Peek requests `tabs` to read open-tab titles, URLs and favicon metadata across normal windows in the current profile. The narrow `favicon` permission lets its worker read Chrome's extension-owned `_favicon` endpoint. No host permission or web-accessible favicon resource is requested. Missing, invalid or oversized icons use a title initial; an invocation attempts at most 100 icons with six concurrent reads and a one-second cancellation deadline. It stores no persistent icon cache. Creating and closing its transient extension window needs no additional permission. It requests `activeTab` and `scripting` to execute and modify only the ordinary page where the user invokes Peek. The `storage` permission stores only current/previous tab and window numeric IDs in `chrome.storage.session`, so the state survives service-worker suspension but ends with the browser session; no title, URL or page content is persisted. Peek does not read page content, search incognito tabs, request host access, install persistent content scripts or run at startup on every tab.

## Product documents

- [Product direction](PRODUCT.md)
- [First-release specification](docs/first-release-spec.md)
- [Acceptance contract](docs/first-release-acceptance.md)
- [Discovery archive](docs/discovery/README.md)
