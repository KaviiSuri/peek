# Peek centred overlay instrumented v3 report

## Scope

V3 is a separate diagnostic package for one optional cold-after-idle versus immediate-reopen pair. It preserves v2 invocation, overlay, tab/history, and navigation behavior and makes no optimization.

Kavii’s “split frame” description is a subtle visual hitch, not a long loading delay. Timing markers can narrow where time passes; they cannot determine which pixels appeared, prove paint, or identify a flash/layout shift. That would require renderer screenshots/trace evidence, which is deliberately not added to the user workload now.

## Instrumentation

Each action creates a random run ID. Each worker instance creates a random worker-instance ID and records its time origin/module-entry estimate. Worker markers cover action callback entry and exact `chrome.scripting.executeScript` call start/end. Overlay markers cover overlay module entry, host append, model request/response, input focus, and two rAF callbacks.

Markers retain context `timeOrigin`, `now`, and `timeOrigin + now`. Within-context deltas are the strongest signal. The sum supports approximate cross-context ordering only. Different worker-instance IDs establish that different instrumented worker globals handled the runs; they do not expose or time browser work before `action-entry`.

To avoid perturbing the critical path more than necessary:

- action-entry/start markers are synchronous memory writes;
- no storage is awaited before injection;
- the first three overlay markers piggyback on the existing model request;
- later overlay markers use one small message after the second rAF;
- bounded session persistence begins after injection completes;
- no keepalive, inspector, polling, alarm, startup injection, or background tab injection exists.

Instrumentation still has non-zero allocation/message/storage overhead and must not be treated as production performance.

## Privacy and bounds

Exact permissions are unchanged: `tabs`, `activeTab`, `scripting`, `storage`. There are no host permissions or persistent content scripts.

The export reconstructs an allow-listed schema containing only marker names/status, run/worker IDs, and clocks. It excludes URLs, titles, queries, page text/content, and tab/window IDs. Storage keeps at most 4 runs and 16 markers per run. Tests reject malformed markers, strip extra fields, and verify privacy/bounds.

## Export and workload

A package-local `diagnostics.html` is declared as the extension Options page. It is opened manually only after both trials and reads one known session key. Its download button produces `peek-v3-timeline.json` without a downloads permission. Opening it after measurement cannot contaminate the preceding cold/warm pair.

The single requested pair is: wait at least 45 seconds on the same closed-overlay page; invoke and note hitch yes/no; Escape; invoke again within 3 seconds and note hitch yes/no; Escape; then open Options and export. This creates exactly two action runs.

## Verification

- strict TypeScript: pass;
- 25/25 tests: pass, including all v2 history/navigation/interaction tests plus timeline correlation, bounds, protocol, and privacy tests;
- manifest/boundary checks: pass;
- built action parity and actual built-worker action→injection/timeline/privacy harness: pass;
- actual built overlay isolated-browser mount/model/focus/rAF-batch QA: pass with no current console/page errors;
- actual built diagnostic page isolated-browser rendering/privacy QA: pass with no current console/page errors;
- dependency tree and ZIP integrity: pass.

Built size: 227,712 unpacked bytes; 226,015 bundled JavaScript. V3 ZIP SHA-256: `ebe88ee7ccf5fb6fc4218486fba7435df2cac00b2379540479b3dde51d871984`.

V2 remains separate and unchanged at SHA-256 `ab67032905c4754de0222516fa2b39b5640c024943696a63044e17428dfe1baf`. No Downloads or user browser/profile files were accessed or modified.

## What one export can establish

- Same worker-instance ID: both action callbacks ran in the same instrumented worker global.
- Different worker-instance IDs: the worker global restarted between runs, supporting—but not proving—a wake-related explanation.
- Long action-entry→execute-start: first runtime/dispatch work after callback entry.
- Long execute span: browser injection plus script execution until the API promise resolves.
- Long overlay model request→response: worker/model IPC and model work.
- Host/focus/rAF ordering: when code reached those opportunities, not what was painted.

It cannot measure keypress→worker creation/action delivery, browser work before extension code, or actual pixel presentation. The paired export narrows the hypothesis and should not become an open-ended Wayfinding blocker.
