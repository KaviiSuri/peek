# Build and automated verification report

## Result

A usable, unpacked MV3 action-popup test vehicle was built entirely under this experiment directory. It was **not installed or loaded**, no Chrome profile was accessed, and no real-browser behavior is claimed.

## Dependency choice

- `effect@3.22.1`, pinned from the official npm registry's stable `latest` response on 2026-09-06. See `effect-version-evidence.md`.
- Poof's Effect 4 release candidate was not reused.
- Build-only dependencies are exact-pinned with `package-lock.json`.
- Third-party scripts were inspected before install. npm's local policy did not execute esbuild's pending postinstall; the platform optional binary worked without approval or fallback download.

## Automated commands and results

`npm run verify`:

- TypeScript strict no-emit check: pass.
- Node tests: **15 passed, 0 failed**.
- Tests cover pure previous-distinct attention transitions, same-current no-op, cross-window ID movement, ignoring unfocused-window activation, removal, query/caret mode round-trip, bounded navigation, transparent filter, synchronous listener wiring, explicit activation order, current no-op, vanished-tab failure, and incognito exclusion in fake adapters.
- esbuild MV3 bundle: pass.
- Manifest/output contract check: pass. Exact permissions are `tabs` and `storage`; `incognito` is `not_allowed`; no host permissions/content scripts/options surfaces; output references exist.

`npm ls --all --json`: dependency tree clean.

`unzip -t peek-chrome-discovery-spike.zip`: all five files pass archive integrity.

Full output is in `verification.log`; the resolved dependency tree is in `dependency-tree.json`.

## Build size

| File | Bytes |
|---|---:|
| `background.js` | 199,705 |
| `popup.js` | 212,833 |
| `manifest.json` | 722 |
| `popup.html` | 1,107 |
| `popup.css` | 2,254 |
| **Total unpacked** | **416,621** |
| **Bundled JavaScript** | **412,538** |

ZIP: 136 KiB on disk; SHA-256 `6aa99150a4727462b747487cd9f488cbee67918da40e254f5c3c07ab0c2749b7`.

This is a real emitted-size observation for this deliberately small Effect-shaped vehicle, not a production budget verdict. The two independent MV3 contexts duplicate Effect runtime code.

## Supported claims

- Package is structurally loadable as an unpacked MV3 extension according to static manifest/output checks.
- Browser seams use pinned stable Effect; interaction/attention/filter logic is pure TypeScript.
- Fake-boundary tests establish exact tab-before-window activation order, no Chrome call for current-tab no-op, and failure before activation when a tab has vanished.
- Listener registration occurs synchronously at service-worker module evaluation.

## Unsupported or pending claims

Only manual use in a user-created temporary Chrome profile can establish:

- whether Option+Space registers and feels comfortable;
- website/OS conflicts and Cmd+K non-interference;
- actual first-input focus and popup dismissal/focus recovery;
- actual cross-window activation and previous-distinct behavior;
- actual profile/incognito boundary presentation and permission disclosure;
- cold/warm Chrome readiness and comparison with manual tab-strip finding.

The popup cannot measure shortcut-keypress-to-ready because `_execute_action` provides no keypress timestamp. Its literal all-token filter is not final fuzzy search and must not be benchmarked as final ranking.
