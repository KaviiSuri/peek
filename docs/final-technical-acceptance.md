# Final technical qualification

PEEK-16 includes the required PEEK-23 favicon and PEEK-25 ordinary-focus fixes. PEEK-17 remains Kavii's human comparison and daily-use decision. This document does not authorize publication or claim human acceptance.

## Changes and boundaries

The starting commit was `52308b8eb8d01e5ef1314c6d620a6be8091f45a6`, verified clean with 136 tests, typecheck and build. The existing MV3, Effect, TypeScript, esbuild, Vitest and closed Shadow DOM stack is unchanged.

Ordinary sessions now expire on external window focus, source activation departure and source closure. Local blur, visibility and page-hide handlers dismiss without restoring over an external destination. The injection adapter checks session ownership after injection and before init, checks the focused source window/tab, and dismisses its own init if cancellation crosses delivery. Replacement registration precedes awaited cleanup. Fallback still mounts unfocused before presentation, with its existing readiness/provenance/source guards.

Commit retains its session until the activation/focus chain completes. Cancellation between tab activation and window focus prevents the subsequent focus call. An already-issued Chrome API operation cannot be withdrawn; Peek does not try to undo it by forcing focus elsewhere. Duplicate commits cannot start a second chain. A delayed failure cannot render or refocus an obsolete controller. Unexpected teardown errors remain retryable; activation errors after teardown leave a non-focusing action badge/title, cleared on the next successful invocation.

The worker reads Chrome's extension-owned `_favicon` endpoint, never the remote `favIconUrl`. Only bounded PNG data reaches either palette. The renderer independently rejects URL/SVG payloads. The added `favicon` permission is narrow; there are no host grants, web-accessible resources, remote scripts or content search. Chrome's own favicon/page requests are not Peek palette requests. Missing icons retain a title initial. Reads have six-way concurrency, a one-second abort deadline, at most 100 candidates and 32 KiB per emitted image. No persistent icon cache is added.

Chrome's official [favicon documentation](https://developer.chrome.com/docs/extensions/how-to/ui/favicons) describes the permission and extension-owned endpoint. Content-script direct access would require a web-accessible resource; fetching in the worker avoids that exposure. The original observed defect was a cross-origin image request with the invoked origin as Referer. Main-world ResourceTiming exposure was not observed, and is not claimed here.

Selected path colors were measured at approximately 3.80:1 in light mode and 3.83:1 in dark mode. They now target 4.66:1 and 4.69:1 against the opaque selected-row backgrounds. Placeholder/count/mode text is also stronger. There is no opening translation/fade, so the complete initial composition appears in its final position. Layout B, compact geometry, 80px input minimum, exact visible numeric choices and input-only hidden-commit protection remain.

## Resource ownership

- Background sessions expire on cancellation, replacement, source departure/removal, successful commit or activation failure. Fallback creation has its existing ten-second readiness deadline and closes late windows.
- Only pending fallback creation retains removed-window IDs; it discards that set after registration.
- Palette resize, blur, visibility, page-hide and focus listeners are removed at teardown. One runtime receiver is installed per document. Closed-session replay IDs are limited to the latest 128; production late init is also guarded by the background owner at every injection/delivery boundary.
- Attention stores only current/previous numeric identities in session storage. Its event log is discarded when outstanding observations resolve. Observation/load/save waits have five-second lifecycle deadlines, so a hung API cannot retain the event log indefinitely. A late observation after expiry is ignored. This is a cleanup deadline, not an invocation SLA or browsing-history archive.
- Favicon work is invocation-local with no growing cache. Rendering listeners belong to discarded row nodes.

## Reproduction

```sh
npm ci
npm test
npm run typecheck
npm run build
PEEK_QA_REQUIRE_COMMITTED=1 PEEK_QA_NATIVE_SHORTCUT=1 PEEK_QA_FINAL=1 \
  PEEK_QA_OUTPUT=/absolute/evidence/path npm run qa:chrome
```

The command loads the exact unpacked build into a new disposable branded Google Chrome profile. Native input targets a positively identified process with existing event-posting permission. It does not change OS shortcuts, Accessibility grants, personal profiles or Downloads installations. Do not run parallel focus QA.

The fixed 50ms character probe remains, including failure diagnostics. It is not a universal latency SLA. Natural idle requires worker-debugging detach and actual target disappearance without forced termination. The source must remain focused immediately before native posting; a focus-lost attempt is recorded as unmeasured, not silently refocused and called cold. Forced restart and fresh-profile startup remain separately labelled.

Native-post timestamps exclude compilation/startup of the compiled key helper. Input, query/order, commit and cancellation intervals include CDP observation overhead. Trace screenshot events and screencast metadata use Chrome timestamps. Sequential screenshots are observations, not first-paint timestamps. Fallback screencast attachment alone cannot prove first paint; browser tracing starts before the gesture and captured content must be inspected.

## All 22 stories

The exact-source final browser report and remaining gaps will be recorded below after qualification. A pending row is not passed by moving it to PEEK-17.

| Story | Technical coverage | Final evidence |
| --- | --- | --- |
| 1 Browser-scoped invocation | Reserved action, native PID-targeted Control+Space, registered command | Pending exact-source run |
| 2 Centred ordinary overlay | Real bounds, coherent composition, no opening translation | Pending |
| 3 Restricted fallback | Chrome settings/store/file capability, source-centred bounds, provenance | Pending |
| 4 Previous distinct | Registered attention routes, exact identities and first delivered selection | Pending |
| 5 No-history default | Removed history and single-eligible pure/composition tests | Pending |
| 6 Ordinary metadata clues | Actual typed query and result identity on 30/100 ambiguity fixtures | Pending |
| 7 Coverage before partials | Orion retry and combined GitHub clues | Pending |
| 8 Recency only ties | Adversarial pure search and production model ordering | Pending |
| 9 Shortened clues | `sched rtry` retrieval without correction | Pending |
| 10 Recognition layout B | Favicon PNG/fallback, repeated repositories, long opaque docs | Pending |
| 11 Typing/arrows/Enter | Shared controller and actual Chrome | Pending |
| 12 Tab/j/k/visible digits | Both contexts, exact displayed labels, compact/input-only guards | Pending |
| 13 Query/caret | Exact disturbed backward range restored | Pending |
| 14 Safe Escape | Pending model/validation/teardown/activation; focus and active identities | Pending |
| 15 Non-destructive highlight | No activation until explicit commit | Pending |
| 16 Exact cross-window target | First completed activation/focus chain, session lifetime | Pending |
| 17 Current no-op | Source-current drift regression and preserved attention | Pending |
| 18 Stale target | Closed/moved/ineligible target revalidation and error recovery | Pending |
| 19 Coherent initial input | Stable loading/ready/empty/error, native idle/warm samples | Pending |
| 20 Appearance/accessibility | Light/dark, contrast, narrow/short, combobox/listbox, composition | Pending |
| 21 Closed shortcuts | Site Cmd+K, Shift+Tab, native browser controls | Pending |
| 22 Scope/privacy | Emitted manifest, worker PNG boundary, disposable profile/incognito canaries | Pending |

## Human trial boundary

After the parent independently reviews the exact committed candidate, build that SHA using the commands above. Use a temporary profile and synthetic tabs first; do not overwrite an existing loaded experiment. Open `chrome://extensions/shortcuts` to confirm/remap the browser-scoped command.

Try `orion retry`, `github auth 880`, `sched rtry`, an opaque document and an honest miss. Compare find-and-switch time and mistakes with the tab strip. Try arrows/Enter and Tab/j/k/digits, including switching back to the previous tab. Repeat from an ordinary page and `chrome://settings/`.

Kavii owns comfort, corrections, missed keys in actual daily use, comparison with manual finding, personal OS/window-manager conflicts and a physical OS IME candidate-window trial. CDP composition and native PID dispatch do not establish those human checks. No personal profile is loaded automatically and no release/tag/store upload is authorized.
