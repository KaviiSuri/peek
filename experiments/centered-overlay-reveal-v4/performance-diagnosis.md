# Dia v2 first-invocation frame-stutter diagnosis

## Observation boundary

New Dia observation: keyboard-first now works. On a newly visited ordinary website, the first invocation has a small frame stutter before the overlay renders; reopening on that same document is smooth.

This is Dia evidence. The agent did not access Dia, a user profile, or Downloads. The local measurements below use the actual v2 built scripts with isolated browser/Node mocks and do not reproduce Dia’s MV3 scheduler, IPC, page workload, or renderer.

## Feedback loops built before hypotheses

### 1. Fresh document versus same-document overlay execution

`harness/performance-controller.html` creates 15 visible, fresh iframe documents sequentially. Each document:

1. dynamically executes the actual 9,762-byte `dist/unpacked/overlay.js`;
2. records script resource/load completion;
3. records host insertion via `MutationObserver`;
4. records model request/response at the mocked extension bridge;
5. records input focus;
6. records `document.fonts` state/readiness;
7. records a two-`requestAnimationFrame` presentation opportunity;
8. toggles the overlay off and repeats in the same document.

The model bridge resolves on a microtask so document work is isolated from worker/IPC latency. It returns 30 title/URL-only fixture tabs. The instrumentation never reads host-page content.

15-sample medians (milliseconds from script insertion):

| Span | Fresh document, first invocation | Same-document reopen |
|---|---:|---:|
| Host inserted / model requested | 0.60 | 0.10 |
| Input focused after model render | 0.80 | 0.30 |
| Script `load` after fetch/evaluation | 2.00 | 1.20 |
| Two-rAF opportunity | 24.80 | 32.90 |

Fresh p90 was 1.2 ms to host, 1.5 ms to focus, and 4.1 ms to script load. The first sample alone transferred the HTTP-served 9,762-byte script (`transferSize` 10,062) and took 10.2 ms to host / 11.9 ms to focus; the next 14 fresh documents used browser cache. An installed extension loads a package-local file, not this HTTP path, so that first transfer is only a harness cold-resource bound.

Two-rAF p90 was noisy (fresh 128.7 ms; same-document 48.5 ms) because sequential iframe creation/removal competes for browser frames. The median was not worse on fresh documents, so this paint proxy does **not** reproduce the reported fresh-document stutter and cannot identify actual paint time.

`document.fonts.status` was `loaded` at every invocation. The overlay uses a system font stack and no font/remote assets.

Raw data: `harness/performance-results.json`. Visual evidence: `harness/performance-controller.png`.

### 2. Cold worker process versus repeated invocation

`harness/measure-worker-timing.mjs` starts 20 fresh Node processes. Each imports the actual 211,561-byte `dist/unpacked/background.js`, then records first and repeated action-to-`executeScript` and model-message spans with immediate Chrome API mocks.

| Local Node span | Median | p90 |
|---|---:|---:|
| Fresh built-worker module import | 13.45 ms | 18.70 ms |
| First action callback → `executeScript` call | 1.79 ms | 2.18 ms |
| Second action callback → `executeScript` call | 0.034 ms | 0.041 ms |
| First get-model message roundtrip | 0.855 ms | 1.094 ms |
| Second get-model message roundtrip | 0.093 ms | 0.145 ms |

Import and action spans are deliberately separate; the harness does not claim they add exactly in Dia. This proves that cold built-worker and first runtime execution are measurably distinct from document coldness in a local process. It does not measure Chrome/Dia service-worker startup, process launch, IPC, or real tabs/windows/storage calls.

The worker happens to contain Effect and is about 211 KB, but these timings and size do not attribute cost to Effect. No dependency is blamed without a comparative build/trace.

Raw data: `harness/worker-timing-results.json`.

### 3. Regression boundary

No product/built files changed. The v2 ZIP remains SHA-256 `ab67032905c4754de0222516fa2b39b5640c024943696a63044e17428dfe1baf`. Typecheck, 20/20 tests, manifest/no-content-read boundaries, `_execute_action` parity, built worker injection, and history/navigation tests all pass.

## Ranked falsifiable causes after measurement

1. **Fresh-page main-thread/frame contention.** A new site may still be parsing, hydrating, painting, or loading while a settled same document is quiet. Prediction: waiting until the page is visibly idle before its first invocation removes the stutter; a page Performance trace shows unrelated page long tasks or frame work before/around injection. Local fixture did not reproduce this, but it also has no real-site workload.
2. **Cold MV3 worker/startup plus first runtime execution.** Reopening immediately keeps the worker/runtime warm. Prediction: after leaving the same document untouched for at least 45 seconds, stutter returns; conversely, a new document invoked immediately after recent extension activity is smooth. Local fresh-process timings show a cold/warm gap, but their magnitude cannot be transferred to Dia.
3. **Fresh-document script/JIT/style/layout path.** Prediction: a newly loaded document stutters even while the worker is demonstrably warm, and its page trace assigns the gap to injected `overlay.js`, style recalculation, layout, or paint. The isolated fixture weakens this hypothesis: fresh-document host/focus p90 stayed under 1.5 ms after the one HTTP cold-resource sample.
4. **First model/bootstrap roundtrip.** The worker may still be establishing attention state or paying first real tabs/windows/storage IPC cost. Prediction: the shell/host appears promptly but rows/focus arrive after a gap; timeline marks would place delay between model request and response. Immediate mocks measured under 1.1 ms p90, so actual Dia IPC remains unmeasured.
5. **Font or remote-asset first paint.** Prediction: trace/network/font readiness shows a load or text relayout. This is low probability: there are no remote assets or custom fonts, and local font state was always loaded.

No optimization follows from these results yet. In particular, bundle size, Effect, CSS, and model listing are not causes established by the observation.

## Smallest useful Dia discrimination—no new build

Use v2 as installed and compare two cases on an ordinary, already-loaded page:

1. **Worker-cold / document-warm:** close the overlay, leave the same document untouched with no extension activity for at least 45 seconds, then invoke.
2. **Worker-warm / document-cold:** invoke and close once, immediately navigate to a simple new ordinary HTTPS page, wait for its load indicator to stop, then invoke within a few seconds.

If only case 1 stutters, worker startup rises. If only case 2 stutters, document/page work rises. If both do, capture traces before changing code.

For the smallest trace, record Chrome/Dia DevTools **Performance** with screenshots on the ordinary page for (a) first invocation after navigation and (b) same-document reopen. Save both trace files. Compare the interval containing injected-script evaluation, style recalculation, layout, paint, and screenshots. This page trace will expose renderer/page work but generally will not prove cold extension-worker startup; opening the service-worker inspector would itself keep/warm the worker and contaminate that test.

If the two-case check and page traces remain ambiguous, an instrumented build would provide concrete benefit. It can record action receipt, before/after `executeScript`, overlay start, host append, model request/response, focus, and two-rAF timestamps using `performance.timeOrigin + performance.now()`, writing only one bounded `chrome.storage.session` timeline. That requires no additional permission or page-content read. No such package was built or proposed for installation yet.
