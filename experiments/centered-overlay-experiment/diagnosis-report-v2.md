# Centred overlay first-invocation diagnosis and v2 package

## Reported/reproduced in Dia

Kavii reports a repeatable per-site split in the temporary Dia profile:

1. On every newly visited ordinary website, keyboard-only Control+Space does not open the overlay and a red `!` appears.
2. Clicking the extension icon opens the overlay on that site.
3. Control+Space then works on that site.

This establishes **keyboard-first versus action-click divergence in Dia**. It does not by itself establish the cause or Chrome behavior.

## Tight built-artifact feedback loops

### Service worker

`node harness/check-built-background.mjs`

The actual minified `dist/unpacked/background.js` imports successfully under a recorded Chrome-API harness, synchronously registers all event families, and the action callback reaches exactly one isolated top-frame `chrome.scripting.executeScript({ files: ["overlay.js"] })` call. No built-worker launch/wiring exception reproduced.

### Overlay mount

The actual minified `dist/unpacked/overlay.js` was loaded from `harness/fixture.html` in a fresh isolated browser with only the extension bridge mocked. Browser QA passed with no current console/page errors: host present, model rows rendered, and input-focus call observed. A second built-script load produced host count 0, listener count 0, and one removal message—no duplicate host. Evidence: `harness/built-overlay-v2.png` (local fixture, not Dia).

These loops disprove a general “built worker cannot launch” or “built overlay cannot mount/focus” defect. They cannot emulate Dia’s temporary-host-grant implementation.

## Structural defect removed—without claiming root cause

V1 routed keyboard through custom `commands.onCommand`, while the working icon used `action.onClicked`. The red-capable regression `node harness/check-command-action-parity.mjs` failed against v1 because `_execute_action` was absent; captured in `harness/parity-red.log`.

V2 removes that divergence:

- manifest command is reserved `_execute_action` with macOS `MacCtrl+Space`;
- there is no action popup, so shortcut and icon flow through `chrome.action.onClicked`;
- the separate custom `commands.onCommand` listener is removed;
- injection starts directly from the action callback, without awaiting tab query or diagnostic clearing first.

The same parity regression is green after the change. This is a narrow pathway-parity fix supported by the observation; it is **not** a claim that Dia withheld `activeTab` from v1 custom commands. [Chrome’s primary `activeTab` documentation](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab#invoking-activeTab) says a commands keyboard shortcut is an `activeTab`-enabling gesture, so any Dia-specific difference needs the exact diagnostic and v2 observation.

## Exact prior diagnostic retrieval

Before extension reload/restart/removal clears session storage, Kavii can open only this extension’s service-worker inspector and run:

```js
chrome.storage.session
  .get("peek-centered-overlay:last-diagnostic-v1")
  .then(({ ["peek-centered-overlay:last-diagnostic-v1"]: diagnostic }) =>
    console.log(diagnostic)
  )
```

This reads one known extension-session key only—not tabs, page content, or all storage. Record `operation` and `exactError`. A host-permission/access message would support the temporary-grant hypothesis; no diagnostic would favor command delivery/diagnostic-path hypotheses. Neither outcome should be guessed.

## V2 verification

- Strict TypeScript check: pass.
- Unit/fake-boundary tests: **20/20 pass**.
- Boundary checks: pass—`_execute_action`, physical `MacCtrl+Space`, no custom command, no pre-injection query/diagnostic await, exact permissions unchanged, no host permissions/content scripts/page-content reads.
- Built worker action-path harness: pass.
- Built overlay isolated-browser mount/focus/cleanup: pass.
- Dependency tree and ZIP integrity: pass.

V2 build: 222,053 unpacked bytes; 221,323 bundled JS. Package `peek-centered-overlay-experiment-v2.zip` SHA-256: `ab67032905c4754de0222516fa2b39b5640c024943696a63044e17428dfe1baf`.

Fix commit: `5efbe9b` on isolated branch `prototype/centered-overlay`.

V1 preservation check: original ZIP remains SHA-256 `f9462c717e870db324e8d69f1ae82c89824e5cb6b4073c697f4df7ee6904ef19`; original README remains SHA-256 `add813ca4621c9d0a15ce7bcbde83f7f9f9eb2cd87992578de3f7e6029c14206`.

## Smallest next test

After parent verification, unzip v2 into a **new** folder. In the existing temporary Dia profile, disable v1, load v2, confirm Control+Space assignment, then test keyboard first—without icon click—on two newly visited ordinary HTTPS origins. Record red badge/exact diagnostic if either fails. Only then retest interaction and restricted pages.

No permissions were broadened; Downloads and user browser/profile were not accessed or modified by the agent.
