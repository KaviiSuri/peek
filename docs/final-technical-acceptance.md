# Final technical qualification

PEEK-16 includes the required PEEK-23 favicon and PEEK-25 ordinary-focus fixes. PEEK-17 remains Kavii's human comparison and daily-use decision. This document does not authorize publication or claim human acceptance.

## Changes and boundaries

The starting commit was `52308b8eb8d01e5ef1314c6d620a6be8091f45a6`, verified clean with 136 tests, typecheck and build. The existing MV3, Effect, TypeScript, esbuild, Vitest and closed Shadow DOM stack is unchanged.

Ordinary sessions now expire on external window focus, source activation departure and source closure. Local blur, visibility and page-hide handlers dismiss without restoring over an external destination. The injection adapter checks session ownership after injection and before init, checks the focused source window/tab, and dismisses its own init if cancellation crosses delivery. Replacement registration precedes awaited cleanup. Fallback still mounts unfocused before presentation, with its existing readiness/provenance/source guards.

Commit retains its session until the activation/focus chain completes. Ordinary departure remains authoritative during dismissal acknowledgement. Fallback teardown validates the returned focused window as the source or selected target; observed external focus/NONE or a new source/target-window selection wins over an older snapshot. Its one-event return allowance expires when any different focus is observed. A focus readback is not treated as a causal event barrier. Global action status is generation-guarded, including late commit callbacks. Cancellation between tab activation and window focus prevents the subsequent focus call. An already-issued Chrome API operation cannot be withdrawn; Peek does not try to undo it by forcing focus elsewhere. Duplicate commits cannot start a second chain. A delayed failure cannot render or refocus an obsolete controller. Unexpected teardown errors remain retryable; activation errors after teardown leave a non-focusing action badge/title, cleared on the next successful invocation.

The worker reads Chrome's extension-owned `_favicon` endpoint, never the remote `favIconUrl`. Only bounded PNG data reaches either palette. The renderer independently rejects URL/SVG payloads. The added `favicon` permission is narrow; there are no host grants, web-accessible resources, remote scripts or content search. Chrome's own favicon/page requests are not Peek palette requests. Missing icons retain a title initial. Reads have six-way concurrency, a one-second abort deadline, at most 100 candidates and 32 KiB per emitted image. No persistent icon cache is added.

Chrome's official [favicon documentation](https://developer.chrome.com/docs/extensions/how-to/ui/favicons) describes the permission and extension-owned endpoint. Content-script direct access would require a web-accessible resource; fetching in the worker avoids that exposure. The original observed defect was a cross-origin image request with the invoked origin as Referer. Main-world ResourceTiming exposure was not observed, and is not claimed here.

Selected path colors were measured at approximately 3.80:1 in light mode and 3.83:1 in dark mode. They now target 4.66:1 and 4.69:1 against the opaque selected-row backgrounds. Placeholder/count/mode text is also stronger. There is no opening translation/fade, so the complete initial composition appears in its final position. Layout B, compact geometry, 80px input minimum, exact visible numeric choices and input-only hidden-commit protection remain.

## Resource ownership

- Background sessions expire on cancellation, replacement, source departure/removal, successful commit, activation failure or worker suspension. An open palette whose worker naturally suspended fails Enter safely with an expired-session error; Escape and a fresh invocation recover. It does not transparently retain the open session. Fallback creation has its existing ten-second readiness deadline and closes late windows.
- Only pending fallback creation retains removed-window IDs; it discards that set after registration.
- Palette resize, blur, visibility, page-hide and focus listeners are removed at teardown. One runtime receiver is installed per document. Closed-session replay IDs are limited to the latest 128; production late init is also guarded by the background owner at every injection/delivery boundary.
- Attention stores only current/previous numeric identities in session storage. Its event log is discarded when outstanding observations resolve. Observation/load waits have five-second lifecycle deadlines, so a hung observation cannot retain the event log indefinitely. A late observation after expiry is ignored. Storage writes are serialized rather than timed out, with one pending latest snapshot and a separately acknowledged snapshot. This prevents a late old write from overtaking a newer one while allowing attention state to progress; failures retry on the next observation or preparation. This is a cleanup deadline, not an invocation SLA or browsing-history archive.
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

Native-post timestamps exclude compilation/startup of the compiled key helper. Input, query/order, commit and cancellation intervals include CDP observation overhead. Trace screenshot events use Chrome timestamps. Sequential screenshots are observations, not first-paint timestamps. Geometry is now captured in one synchronous DOM evaluation rather than mixing bounds across OS resizes. Tracing starts on the source page before the gesture; source-page tracing does not itself prove a new fallback window's first paint. Captured frames still require inspection. CDP input omits platform-native virtual keycodes; genuine native CGEvent checks remain separate.

## All 22 stories

**Automated source checks pass; final Chrome qualification is incomplete.** Production checkpoint `62b1950` passes 185 tests, typecheck and build. Twenty-two isolated author mutations fail on their intended behavior assertions, including all favicon resource bounds, teardown departures, obsolete return authority, global recovery status and acknowledged-state ABA persistence. Parent review remains independent.

Retained artifacts are in PEEK-16's worker evidence (`thr_isnxp6bej2`). `teardown-focus-replay.json`, `return-authority-replay.json`, `target-tab-departure-replay.json`, `activation-focus-replay.json`, late-overlay control/departure, `late-save-replay.json` and `stale-action-status-replay.json` exercise production modules with deterministic deferred adapters. These are not native Chrome evidence.

`chrome-candidate-17/final-qualification.json` is **earlier-source partial evidence**, not a final pass: real HTTP `application/pdf` produced a usable palette; both presentations emitted browser PNGs without the remote canary request; second-profile/incognito canaries were excluded; and open palettes naturally idled after 30.013s/30.077s, failed Enter without changing active/focused identities, then recovered by closing/reinvoking. Its 30-tab ordinary light/dark path contrast was 4.6648/4.6946. No completed timing samples were recorded; screenshot trace events were empty.

Subsequent harness corrections cover keycodes, released native modifiers, worker reload identity, atomic geometry and page-scoped trace streams. Latest desktop attempt 20 stopped with personal Dia as foreground owner; earlier diagnostics recorded System Information. Neither app was controlled. Their causal relationship to synthetic input is not established. Browser ownership was released; native QA remains paused pending the parent's quiet-desktop grant.

Warm/natural-idle 30/100-tab distributions, both presentations' final reveal/visual inspection, and a complete exact-source Chrome run remain required technical work. They are not moved to PEEK-17.

| Story | Technical coverage | Final evidence |
| --- | --- | --- |
| 1 Browser-scoped invocation | Reserved action and manifest/wiring tests pass | Final native run pending |
| 2 Centred ordinary overlay | Coherent-append and compact geometry tests pass; opening animation removed | Final frames/bounds pending |
| 3 Restricted fallback | Provenance, readiness, teardown and return-authority tests/replays pass | Final settings/store/file/PDF run pending |
| 4 Previous distinct | Attention/wiring tests and delayed-save restart replay pass (previous=3) | Final native identities pending |
| 5 No-history default | Removed-history and single-eligible composition/search tests pass | Deterministic pass |
| 6 Ordinary metadata clues | Production search tests cover 30/100 ambiguity fixtures | Final 30/100 browser run pending |
| 7 Coverage before partials | Orion/GitHub adversarial search tests pass | Deterministic pass; final UI run pending |
| 8 Recency only ties | Adversarial search ordering tests pass | Deterministic pass |
| 9 Shortened clues | `sched rtry` production-search test passes | Deterministic pass; final UI run pending |
| 10 Recognition layout B | PNG/initial and exact decoded-byte bounds pass; prior ordinary screenshots retained | Both final visual reviews pending |
| 11 Typing/arrows/Enter | Shared-controller tests pass | Corrected-driver Chrome run pending |
| 12 Tab/j/k/visible digits | Exact visible labels and compact/input-only controller tests pass | Final native/layout run pending |
| 13 Query/caret | Exact disturbed backward-range restoration test passes | Final Chrome run pending |
| 14 Safe Escape | Deferred production routes/replays cover model, validation, teardown and activation | Deterministic pass; final Chrome identities pending |
| 15 Non-destructive highlight | Controller/composition tests require explicit commit before activation | Deterministic pass |
| 16 Exact cross-window target | Actual-adapter activation, teardown, return-authority and target-reselection replays pass | Final first-chain Chrome run pending |
| 17 Current no-op | Source-current drift and preserved-attention tests pass | Final Chrome identities pending |
| 18 Stale target | Closed/moved/ineligible checks and recoverable-error tests pass | Final Chrome recovery run pending |
| 19 Coherent initial input | Controller-state tests pass; prior open-idle safe expiration is documented, not seamless continuation | First-frame evidence and timing distributions pending |
| 20 Appearance/accessibility | Narrow/short, roles and composition tests pass; prior ordinary contrast passes | Both final visual/contrast reviews pending |
| 21 Closed shortcuts | Local focus/composition guards pass | Corrected-driver and native-control rerun pending |
| 22 Scope/privacy | Manifest, PNG boundary, all resource-bound tests/mutations pass; prior profile canaries retained | Final Chrome canaries pending |

## Human trial boundary

After the parent independently reviews the exact committed candidate, build that SHA using the commands above. Use a temporary profile and synthetic tabs first; do not overwrite an existing loaded experiment. Open `chrome://extensions/shortcuts` to confirm/remap the browser-scoped command.

Try `orion retry`, `github auth 880`, `sched rtry`, an opaque document and an honest miss. Compare find-and-switch time and mistakes with the tab strip. Try arrows/Enter and Tab/j/k/digits, including switching back to the previous tab. Repeat from an ordinary page and `chrome://settings/`.

Kavii owns comfort, corrections, missed keys in actual daily use, comparison with manual finding, personal OS/window-manager conflicts and a physical OS IME candidate-window trial. CDP composition and native PID dispatch do not establish those human checks. No personal profile is loaded automatically and no release/tag/store upload is authorized.
