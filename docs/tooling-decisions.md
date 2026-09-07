# Tooling decisions for PEEK-11

Recorded before production code on 2026-09-07. The product and architecture decisions in the first-release specification remain unchanged.

## Choices

| Area | Choice | Reason |
|---|---|---|
| UI | Browser DOM APIs, a closed Shadow DOM root, HTML and CSS. No UI framework. | Peek has one transient palette and a small state model. A framework would add runtime and build weight without simplifying this slice. Shadow DOM isolates the injected palette from page styles. |
| Bundler | esbuild 0.28.2 | It emits self-contained MV3 scripts without remote assets or runtime loaders. A short checked-in build script keeps entrypoints and copied static files explicit. WXT and Vite are unnecessary for two extension contexts and are not inherited from Poof. |
| Package manager | npm 11 with a committed `package-lock.json` | npm ships with the selected Node runtime and gives reproducible `npm ci` installs. Bun was a Poof choice, not a Peek requirement. |
| Test runner | Vitest 5.0.0 with jsdom 30.0.1 where DOM behavior is needed | Vitest runs TypeScript tests through esbuild and supports Node and DOM suites. Production-composition tests use recorded browser adapters rather than Chrome mocks spread through the code. |
| Language | TypeScript 7.0.2 with `@types/chrome` 0.2.9 and `@types/node` 26.5.0 | Strict TypeScript checks the pure Search and Interaction contracts plus the Chrome adapter and build-script boundaries. |
| Effects and schema | Effect 3.22.1 | This is the current stable `latest` release. Peek uses it only in the browser-facing composition flow and uses `Schema` to decode unknown runtime messages. Search, interaction and rendering remain plain TypeScript. The Poof 4.0 release-candidate pin is not used. |

The build, test, typecheck and isolated Chrome QA commands are `npm run build`, `npm test`, `npm run typecheck` and `npm run qa:chrome`. `qa:chrome` creates a disposable profile and synthetic local fixture, loads only `dist/`, and never attaches to an existing browser session. See the README for exact behavior and manual checks.

## Primary-source checks

Package versions came from each package's npm registry `latest` tag on 2026-09-07. The selected Node 24.19.0 runtime satisfies esbuild's Node 18 minimum, TypeScript's Node 16.20 minimum, Vitest's Node 24 range and jsdom's Node 24.15 minimum.

Chrome's official extension documentation confirms the browser contracts used here:

- [`chrome.commands`](https://developer.chrome.com/docs/extensions/reference/api/commands) documents the reserved `_execute_action` command and user-remappable shortcuts.
- [`chrome.scripting`](https://developer.chrome.com/docs/extensions/reference/api/scripting) documents `activeTab` plus `scripting` as sufficient permission for gesture-scoped injection.
- [`chrome.tabs`](https://developer.chrome.com/docs/extensions/reference/api/tabs) documents tab metadata, `tabs.query`, `tabs.get` and `tabs.update`.
- [`chrome.windows`](https://developer.chrome.com/docs/extensions/reference/api/windows) documents window enumeration and `windows.update(..., { focused: true })`.

No React, WXT, persistent content script, host permission or remote asset is included.

PEEK-12 adds Chrome's `storage` permission solely for a schema-validated `chrome.storage.session` record containing current/previous numeric tab and window IDs. Session scope survives MV3 worker suspension without persisting browsing metadata across browser sessions; titles, URLs and content are never stored for attention history.
