# Peek centred-overlay experiment report

## Prepared result

A new disposable MV3 package was built entirely at `centered-overlay-experiment`; the prior popup experiment and Downloads folder were untouched. No extension was loaded, no browser/profile was accessed, and no Dia/Chrome success is claimed.

Source/build history: isolated repo branch `prototype/centered-overlay`, commit `d4f954c`.

## Behavior in the package

- Browser-scoped custom command maps `mac` to `MacCtrl+Space`—physical Control+Space—and is labelled Dia test candidate, not universal default.
- No action popup. The command or action click injects/toggles `overlay.js` only in the invoked active top frame, in the isolated world.
- One closed-Shadow-DOM host is centred with fixed positioning. Repeat invocation removes it. Escape/click-away cancel; global listeners and host are torn down; prior page focus is restored if still valid.
- Real normal-window tab title/URL metadata comes from the worker. Rows use text nodes only, a local generic icon, and the disclosed literal all-token test filter.
- Explicit commit validates the exact target, requests source-overlay teardown, activates the tab, then focuses its window. Current selection tears down with no activation; vanished targets fail before teardown/activation when detected.
- Restricted injection errors create a per-tab red `!`, exact action-title/service-worker diagnostic, and session diagnostic. No framed-window fallback or error tab is created.

## Permissions and audited boundary

Exact permissions: `tabs`, `activeTab`, `scripting`, `storage`; `incognito: not_allowed`.

Static verification confirms no `host_permissions`, persistent `content_scripts`, action popup, options surface, remote fetch/socket APIs, DOM content-reading APIs, unsafe HTML assignment, all-frame injection, or startup injection. The test **can execute and modify the invoked active page DOM**; “no page-content search/read” is a source-audited behavior boundary, not something `activeTab` enforces.

## Automated verification

`npm run verify` passed:

- strict TypeScript no-emit check;
- **20/20** Node tests: attention history, unfocused-window exclusion, interaction/caret, literal filtering, synchronous MV3 wiring, single-host toggle/idempotent teardown, protocol validation, top-tab injection seam, teardown-before-activation order, current no-op, vanished target, and incognito exclusion;
- esbuild bundle;
- manifest/artifact, physical Mac Control mapping, injection-scope, no-content-read, and no-unsafe-eval checks.

`npm ls --all --json` reports a clean dependency tree. ZIP integrity passed for all three files. Full output: `verification.log`.

## Emitted artifact

| File | Bytes |
|---|---:|
| `background.js` | 211,921 |
| `overlay.js` | 9,762 |
| `manifest.json` | 726 |
| **Total unpacked** | **222,409** |
| **Bundled JavaScript** | **221,683** |

`peek-centered-overlay-experiment.zip` SHA-256: `f9462c717e870db324e8d69f1ae82c89824e5cb6b4073c697f4df7ee6904ef19`.

Pinned experiment dependencies remain `effect@3.22.1`, `typescript@7.0.2`, `@types/chrome@0.2.9`, `@types/node@26.4.1`, and `esbuild@0.28.2`. These are not production choices.

## Still requires Kavii’s manual Dia evidence

- command assignment/no conflict and actual initial input focus;
- centred placement, light/dark readability, toggle/cancel/focus restoration, and Cmd+K non-interference;
- exact injection result/error on ordinary HTTPS, “In Dia”/new-tab, and settings/extensions surfaces;
- exact two-window selection and previous-distinct behavior;
- whether ordinary-page-only coverage is acceptable.

Mocks/static checks cannot establish those facts, Chrome behavior, top-layer/fullscreen robustness, final ranking, or production performance.

## Smallest next step

After parent verification, copy/unzip the attached ZIP to a **new** clearly named directory. In Kavii’s existing temporary Dia profile, disable the old popup experiment, manually load this new three-file unpacked folder, verify Control+Space assignment, and test one ordinary HTTPS page before anything else.
