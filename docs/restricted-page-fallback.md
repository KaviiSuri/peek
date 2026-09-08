# Restricted-page fallback

PEEK-15 extends the merged PEEK-11 through PEEK-14 implementation. It does not complete PEEK-16 hardening or PEEK-17 human qualification.

## Classification

`src/background/restricted-surface.ts` selects a presentation from the invoked tab's URL before any injection attempt. Chrome-owned schemes and other extensions' pages use fallback. Both the current HTTPS Chrome Web Store host and the legacy `/webstore` path are explicit restrictions. An arbitrary HTTPS host, a lookalike host/path, missing URL, or malformed metadata does not become a restriction merely because injection fails.

Observed in disposable branded Google Chrome 152:

- `chrome://settings/`: `Cannot access a chrome:// URL`.
- `https://chromewebstore.google.com/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm`: `The extensions gallery cannot be scripted.` No install or account interaction occurs.
- `https://peek-control.example/ordinary`: controlled synthetic document fulfillment at that exact URL; action invocation creates the normal overlay and subsequent injection succeeds.

For file URLs, the adapter queries `chrome.extension.isAllowedFileSchemeAccess()` before injection: denied files use fallback; granted files remain ordinary. Capability resolution belongs to the session, so delayed completion cannot revive a cancelled invocation. Unclassified URLs still attempt the ordinary path and retain an error if Chrome refuses execution. Origin-inheriting documents are not blanket file restrictions. Tests cover additional explicit browser schemes, but they are not claims of a real-browser matrix across Chrome variants. Dia remains untested.

Unexpected invocation failure is logged and shown by an action badge/title. Model failures remain the shared palette's error composition. Neither route silently opens another presentation.

## Shared presentation and provenance

`src/palette.ts` contains the shipped rendering, Search and Interaction integration, query/highlight reconciliation, caret restoration, IME/modifier guards, visible-digit mapping and listener cleanup. `overlay.ts` installs it into the invoked page. `fallback.ts` installs the same controller into a packaged extension document. There is no fallback matcher or separate keyboard state machine.

A session retains the source user tab/window independently of the fallback tab/window. Chrome returns the popup identity through `windows.create`. The fallback's ready handshake may arrive first; the background waits for that creation result and checks its tab, window, extension URL, session fragment, top frame and document identity. A separate mounted acknowledgement prevents model delivery from overtaking initial mount. Fallback model messages accept only the worker context and their own session. Commit/cancel messages from other tabs, frames, URLs or replacement documents fail closed. The original overlay sender-tab check remains in place.

Own-extension URLs remain excluded by the existing normal-window listing, attention resolver and target revalidation policies, including own-extension pages placed in a normal window. An unassociated Peek page cannot become a source user tab.

## Lifecycle and focus

Creation is initially unfocused. After a validated mount, Peek focuses the popup only if its session is current and the original source tab is still active in the focused source window. This avoids focusing a late-created obsolete UI. Registered external-focus/source-activation events also invalidate pending presentation: a stale `focused:true` API snapshot cannot reverse a newer observed departure. Own-popup focus is expected, and commit teardown may let Chrome focus another window before explicit target activation; those phases are not cancelled by their expected focus events. Background source-tab activation after the popup is visible remains an explicit selection case, not pending-presentation cancellation. A ten-second readiness deadline releases the session; an eventual creation result is closed, never presented. Removed-window bookkeeping belongs only to pending creation and is discarded after registration, rather than accumulating every browser close for the lifetime of the worker.

Escape, focus exit and click-away close the extension page locally as well as notifying the background. This still closes a transient page if its worker session has expired. Browser window removal expires the session. Source removal cancels a pending fallback. Superseded or cancelled model/validation/teardown completions cannot activate a target or close a replacement window.

Commit revalidates identity and eligibility, acknowledges teardown, then activates the exact tab and focuses its containing window. Only Chrome's exact missing-window diagnostic makes repeated removal benign. Unexpected teardown errors propagate and cannot produce a successful switch. A true current-source selection closes without activation or history changes. If another tab became active behind the popup, selecting the source explicitly reactivates it instead of treating invocation-time identity as a no-op.

Cancellation never calls tab activation or source-window focus restoration. Chrome chooses the next window on close. An intentional focus change to another normal window is not reversed.

## Placement and permissions

Requested outer size is at most 720 by 320 CSS pixels, capped to the source browser bounds, with `left`/`top` calculated from that source's center. Chrome or the OS may clamp or rearrange those bounds. A reproduced window-manager case placed the source mostly off-screen; Chrome rejected its requested center with `Invalid value for bounds. Bounds must be at least 50% within visible screen space.` Only that exact rejection retries creation without coordinates so Chrome can choose visible placement. Other creation failures propagate. QA records source bounds, actual popup bounds, center deltas, content viewport, focused input and timestamps. It does not claim screen centering or label sampled geometry as first paint. The browser frame accounts for the difference between outer and content bounds.

The shared palette switches to compact input and title/location rows below 180 CSS pixels of viewport height. One complete row fits at 74px: 8px margins + 2px border + 30px input + 2px list padding + 32px row. Below that budget the result list is hidden, the header says `Resize to select`, and Enter/digit/pointer commits cannot target hidden rows; resizing restores the same query, caret and selection. Narrow layouts suppress the mode badge before it can consume the query input; below 240px they also drop the optional search icon and constrain the count, preserving usable query width. Real Chrome QA reproduces the observed 716×148 physical screenshot as 358×74 CSS pixels at DPR2, 236×189 and 175×189 narrow cases, 175×74, and a 175×60 input-only control. It checks nonzero usable input dimensions as well as containment, visible digits and accessibility exposure. The three-normal-window native case that originally exposed clipping remains in the suite.

No permission was added. The [extension API](https://developer.chrome.com/docs/extensions/reference/api/extension#method-isAllowedFileSchemeAccess) exposes the existing file grant without changing it. Chrome's [windows API](https://developer.chrome.com/docs/extensions/reference/api/windows) documents creation, placement, focus and removal without a separate windows permission. The existing `tabs` permission permits reading metadata from populated window results. Chrome's [content-script documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) documents gesture-scoped programmatic injection with `activeTab` and the distinction between document schemes and origin-inheriting frames.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build`. The original 82 tests remain, with additional registered-message, actual fallback-entry, adapter and deferred-lifecycle regressions.

Final evidence uses:

```sh
PEEK_QA_REQUIRE_COMMITTED=1 PEEK_QA_NATIVE_SHORTCUT=1 \
  PEEK_QA_OUTPUT=/absolute/evidence/path npm run qa:chrome
```

The QA command creates a disposable branded-Chrome profile. Its CDP unpacked load grants file access by default; the granted-file control confirms ordinary injection. QA then changes only that disposable extension's file grant through Chrome's extension-management page, re-enables it after Chrome's resulting disable/reload, and proves denied injection plus fallback. Production code only reads the grant. No personal/global browser or OS permission is changed. QA retains the fixed 50 ms character probe and failure diagnostics. Native app activation and keyboard events target only the positively identified spawned PID; they do not change OS shortcuts or request new accessibility grants. Native Cmd+W exercises Chrome's own window-close route. Final Control+Space checks use fresh restricted and ordinary tabs without prior action invocation.

Commit observations wait for the first completed post-teardown tab-activation/window-focus API chain, then assert its identities. The API observers return the original promises and do not swallow errors. Popup disappearance alone is not treated as commit completion. Chrome screenshots and geometry are timestamped samples, not a first-frame filmstrip. CDP composition checks do not prove physical OS IME candidate-window behavior.
