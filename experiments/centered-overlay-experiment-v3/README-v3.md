# Peek centred overlay instrumented v3

Disposable Dia experiment for one optional paired capture of the subtle first-frame hitch. It preserves v2 behavior and permissions; it is not an optimization or production architecture.

## Permission and privacy boundary

Exact permissions remain:

```json
["tabs", "activeTab", "scripting", "storage"]
```

There are still no host permissions, persistent content scripts, startup injection, polling, alarms, remote assets, native code, or page-content reads. The overlay can modify the invoked page because `activeTab` + `scripting` permit explicit injection after the user gesture.

The session timeline contains only random run/worker IDs, context-local clock values, marker names, and execute success/error status. It contains no page URLs, titles, queries, text, content, or tab/window IDs. Storage is capped at the latest 4 runs and 16 markers per run.

## What v3 records

Worker context:

- action callback entry—the first point extension code can observe;
- `chrome.scripting.executeScript` call start/end.

Overlay context:

- overlay module entry after bundled dependencies initialize;
- host append;
- model request/response;
- input focus;
- first and second `requestAnimationFrame` callbacks.

Each marker carries its context `performance.timeOrigin`, `performance.now()`, and their sum. That sum permits approximate cross-context ordering, but independent worker/renderer clocks and scheduling mean it is not a precision distributed trace. rAF is only a frame opportunity; it does not prove that pixels were painted or distinguish a flash/layout shift by itself. V3 cannot measure keypress-to-worker-start because no extension code executes before the worker receives the action.

Instrumentation overhead is not zero: synchronous clock samples, three small marker objects attached to the existing model request, session writes after injection completion, and one extra small message after the second rAF. It does not await storage before injection or keep the worker alive intentionally.

## Parent verification and loading

Do not replace v2 or copy into Downloads. After the parent verifies the ZIP, unzip v3 into a **new** folder. In the temporary Dia profile, disable v2 and load v3 unpacked. Confirm physical Control+Space on `dia://extensions/shortcuts` (or Dia’s equivalent). Do not open the service-worker inspector.

## One paired capture only

Use one ordinary page where reopening was already smooth:

1. Ensure the overlay is closed. Leave that same page untouched for at least 45 seconds. Do not click the extension, open extension pages, or inspect its worker.
2. Press Control+Space once. Note only whether the subtle split-frame hitch is visible.
3. Press Escape to close it without creating another action run.
4. Within 3 seconds, press Control+Space once more. Note whether the immediate reopen hitches.
5. Press Escape.
6. Only now, right-click the v3 toolbar icon and choose **Options**. If Dia hides that item: open the v3 extension’s Details card and select **Extension options**.
7. On “Peek v3 timing export,” click **Download timeline JSON** once and provide `peek-v3-timeline.json` with the two visual yes/no observations.

Opening Options happens after both trials, so it cannot warm the worker before measurement. No inspector or repeated install is needed.

## Reading the pair

The latest two full runs are the cold-after-idle and immediate reopen. Matching `workerInstanceId` values mean both action callbacks ran in the same worker instance; different IDs support a worker restart between them. This narrows worker-wake versus renderer-side work but is not proof of startup cost: worker creation before `action-entry` remains unobservable.

Compare marker deltas within each context first. Treat `comparableEpochMs` cross-context differences as approximate. A long action→execute start span points to first runtime/dispatch work after callback entry. A long execute span includes browser injection/evaluation work. A long overlay model-request→response span points to worker/model IPC. Host/focus/rAF ordering cannot prove what visual pixels flashed; a real renderer Performance trace would be required for that, and is intentionally outside this one-pair test unless the data shows a concrete need.
