# Peek Chrome discovery spike

**Throwaway test vehicle—not production Peek and not a production UI/build-stack choice.** It exists only to let Kavii manually test Chrome command registration, popup focus/dismissal, explicit tab selection, cross-window focus, and observed previous-distinct-tab behavior.

## Exact experiment choices

- MV3 action popup, because it is the smallest surface that exercises Chrome's browser-scoped `_execute_action` command and focus-loss dismissal.
- Plain DOM/CSS for this disposable popup. This does not choose Peek's production UI stack.
- Effect **3.22.1**, the stable `latest` version returned by the official npm registry when prepared. Effect is limited to browser/lifecycle seams; interaction, attention history, and the transparent filter are pure TypeScript.
- Suggested test candidate: **Option+Space** (`Alt+Space` in the manifest). Chrome may leave it unassigned or the OS may consume it; registration is a measurement, not an assumption.

## Permissions

- `tabs`: read titles, URLs, favicons, window IDs, and Chrome-provided `lastAccessed` values for open tabs. Required because this experiment compares arbitrary open tabs across normal windows.
- `storage`: keep only `{ currentTabId, previousTabId }` in `chrome.storage.session`, so MV3 worker suspension does not immediately erase observed attention history. Session storage is cleared when the extension/browser session ends; no query, page content, or durable history is stored.
- `incognito: not_allowed`: the package cannot run in incognito.

There are **no host permissions, content scripts, page-content access, cloud calls, history/bookmark permissions, options page, or global shortcut**.

## Build contents

Load [`dist/unpacked`](dist/unpacked) as an unpacked extension. [`peek-chrome-discovery-spike.zip`](peek-chrome-discovery-spike.zip) contains the same five loadable files for transfer; unzip it before using Chrome's “Load unpacked.”

## Smallest manual next step

In a **user-created temporary Chrome profile**, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this package's `dist/unpacked` directory. Do not load it into a personal profile.

Then open `chrome://extensions/shortcuts` and check whether **Option+Space** is actually assigned. If evidence rejects it, manually try **Command+Shift+Space**, then **Command+Shift+E**. Do not assign Cmd+K.

## Synthetic temporary-profile fixture

Create only non-sensitive tabs in the temporary profile, with at least two normal windows and some repeated/similar titles. The experiment reads live tabs from that profile. Its filter is deliberately simple and disclosed in the popup: every whitespace-separated token must literally occur, case-insensitively, in title + URL. Do not judge final fuzzy ranking or search performance from it.

## Manual observation sequence

1. **Registration/conflict:** record whether Chrome reports the candidate assigned; invoke it over ordinary pages and check that each site's Cmd+K remains unchanged.
2. **Initial focus:** type one character immediately after invocation; it must land in the input. The popup's observation log records script-evaluation-to-focus and list-read durations, but cannot measure shortcut-keypress-to-popup-start because Chrome exposes no invocation timestamp for `_execute_action`.
3. **Navigation/cancel:** type a filter, move with arrows, toggle selection with Tab, use j/k and a visible 1–9 choice, then Escape on another run. Highlight/cancel must never activate.
4. **Explicit selection:** Enter a result in the same window, then in the other window. Chrome must activate that exact tab and then focus its containing window.
5. **Previous distinct:** visit A, then B, including a cross-window change; invoke. A—not B—must be preselected. Filter to/select already-current B, reopen, and confirm A is still previous.
6. **Boundaries:** verify incognito and another profile never appear. The extension is installed only in the temporary profile, so another profile is a separate extension context by Chrome design.
7. **Dismissal/comfort:** click away and use Escape; record whether focus returns comfortably and whether the chord is quicker/less disruptive than manual tab-strip finding.

A tab closed between list and Enter is covered by a fake-boundary regression test; real-popup focus loss makes this race awkward to manufacture. Treat real behavior as pending unless naturally observed.

Use [`manual-observations.md`](manual-observations.md) to record outcomes. Stop after one candidate has complete evidence or all three candidates have documented failures.

## Instrumentation limits

The expandable popup log records:

- popup script evaluation → browser facts ready;
- tab-list call/render duration and eligible count;
- first/subsequent input events;
- mode changes, cancel requests, commit requests;
- activation promise duration or failure.

These are local popup observations only. They do not establish shortcut-keypress latency, paint timing outside the popup, final production performance, or cold/warm classification by themselves. Console/popup logs disappear with the popup unless copied into the observation sheet.

## Automated evidence

`npm run verify` performs strict TypeScript checking, pure attention/interaction/filter tests, fake Chrome wiring and selection tests, a production-shaped bundle, and manifest/output validation. These tests do **not** establish real Chrome registration, focus, dismissal, profile boundaries, or user comfort.

## Cleanup

In the temporary profile, open `chrome://extensions` and choose **Remove** for “Peek Chrome Discovery Spike,” then delete the temporary profile if it is no longer needed. Delete this experiment directory when discovery evidence has been captured. No changes are required in Peek or Poof.
