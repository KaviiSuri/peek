# PEEK-6: Poof technical-fit memo

**Scope:** read-only inspection of `/Users/kavii-suri/code/KaviiSuri/poof`. Poof is a technical reference only; none of its UI is used as visual inspiration. Recommendations below do not select Peek's stack.

## What Poof actually does

- Poof is an MV3 Chrome extension built with WXT/Vite, React, Effect `4.0.0-rc.110`, `@effect/platform-browser`, Vitest, and strict TypeScript settings (`package.json:1-38`, `tsconfig.json:1-15`). It ships five entrypoint families: background, content, options, popup, and release (`wxt.config.ts:20-36`).
- Each extension context builds one long-lived `ManagedRuntime` from a context-specific Layer: background worker, content script, and popup (`entrypoints/background.ts:28-48`, `entrypoints/content.ts:20-27,66-88`, `entrypoints/popup/poofRuntime.ts:19-22`). Entrypoints are intentionally thin.
- Poof keeps MV3 event-listener registration synchronous and outside Effect because its design requires listeners during the service worker module's first evaluation turn; callbacks then hand Effect programs to the runtime (`entrypoints/background.ts:7-26`, `src/background/BackgroundWiring.ts:229-263`). The complete event set and runner are injectable seams (`src/background/BackgroundWiring.ts:79-118`).
- Chrome capabilities are narrow Effect modules with typed failures and production/in-memory adapters. `ExtensionStorage` exposes get/set/remove/watch and scopes listener cleanup; its in-memory adapter gives each layer build fresh state (`src/browser/ExtensionStorage.ts:3-39,41-126`). `Tabs` exposes only Poof's three tab operations and provides configurable failure-capable test adapters (`src/browser/Tabs.ts:4-31,33-102`).
- Stored and wire data use Effect Schema and tagged unions/errors. Rule domain variants are explicit (`src/domain/Rule.ts:8-70`); the Rule Set is one versioned object (`src/domain/RuleSet.ts:9-24`); reads migrate then decode, failing loudly on malformed or newer data (`src/storage/RuleSetStore.ts:13-45`, `src/storage/RuleSetMigrations.ts:8-83`).
- Tests exercise programs through the same module interfaces with in-memory Layers. The background wiring test records Chrome event registration and production ordering, then runs against composed fakes (`src/background/BackgroundWiring.test.ts:13-175`). Vitest defaults to Node/V8; DOM tests create isolated happy-dom documents (`vitest.config.ts:1-23`).
- Poof deliberately runs even its high-frequency DOM scan path inside Effect. That choice was justified by cooperative scheduling needs and extensive V8 measurements, not by convention (`docs/adr/0011-all-logic-runs-inside-effect.md:1-59`). Its content runtime consequently composes many page, scan, scheduler, storage, and observability modules (`src/content/ContentProgram.ts:257-275,655-759,795-845`).

## Keep / adapt / leave

### Keep as design principles

1. **Thin Chrome entrypoints; logic behind testable seams.** Peek should keep unavoidable `chrome.*` registration at the edge and make the behavior callable with recorded events/adapters. Poof's background-wiring test proves this catches lifecycle defects that ordinary domain tests miss.
2. **Narrow browser adapters with failure-capable fakes.** A Peek tab module should hide enumeration, incognito exclusion, title/URL permission assumptions, tab activation, and containing-window focus behind a small interface. Tests should swap only that adapter, not mock Chrome throughout the codebase.
3. **Pure domain logic before effectful orchestration.** Matching/ranking and the typing/selection interaction state should remain pure inputs-to-results. This creates deep modules: significant behavior behind small interfaces and the same seams for callers and tests.
4. **Decode untrusted persisted/message data at the edge.** Schema validation and tagged error cases are useful when values cross Chrome storage or message boundaries. Failures the user can act on should remain distinguishable from programmer defects.
5. **One runtime per real extension context, if Effect is chosen.** Build once for that context's lifetime; do not create a runtime or call `runSync` per keystroke/result. Keep logger/runtime assembly outside domain modules so tests stay quiet and replaceable.
6. **Production-shaped composition tests.** Test that listeners are registered before work, commands dispatch the intended program, selection focuses both tab and window, and cancel performs neither. This is more valuable than testing adapters only in isolation.

### Adapt down to Peek's size

- **Use only earned seams.** Peek plausibly needs a browser-tab adapter and an invocation adapter because both have real Chrome and test implementations. Previous-tab tracking can initially live inside the browser/session module; splitting it into another service before a second implementation appears would create a hypothetical seam.
- **Model only actionable failures.** Distinguish unavailable/unassigned command, tab vanished, window focus failed, and tab metadata access failed if the UI responds differently. Do not reproduce Poof's broad error taxonomy where every operation gets a bespoke type but the user sees the same outcome.
- **Persist minimally.** If v0 stores only a remappable command state or previous-tab observation, keep a small versioned envelope only once real persisted product state exists. Poof's forward-only migration machinery is correct for valuable authored Rule Sets but premature for ephemeral search/session state.
- **Scope resources to browser lifetimes.** Listener cleanup and cancellation are worth preserving, but Peek has no page MutationObserver or forever-running content program under the confirmed no-content-access boundary.

### Leave in Poof

- **Effect on every hot-path operation, custom scheduler, turn abstraction, worker matcher, scan backlog, and tracing.** Poof earned these through unbounded DOM work and an 8ms cooperative budget. Peek ranks roughly tens of tab metadata records and has no equivalent scan. Transplanting this machinery would add interface and runtime cost without leverage.
- **Content-script, host-permission, per-site grant, shadow-root, iframe, DOM restore, and page-status architecture.** Peek's confirmed title/URL-only scope needs the `tabs` metadata permission, not page content or host access.
- **Poof's number of Layers and cross-context diagnostics.** The 861-line `PopupState` module and large `ContentServices` union reflect Poof's many capabilities (`src/popup/PopupState.ts:30-168,745-766`; `src/content/ContentProgram.ts:257-275`). They are evidence of Poof's problem size, not a starter template for one-capability Peek.
- **Options-page/import/export/migration infrastructure and specialized observability.** None is justified until Peek has durable settings or failures that cannot be diagnosed with bounded lifecycle logs.
- **Poof's package-manager and UI choices.** ADR-0012 explains Bun/Vitest/WXT for Poof (`docs/adr/0012-bun-installs-vitest-tests.md:1-18`); it does not establish that Peek should use Bun, WXT, React, or Vitest.

## Minimal suggested responsibility boundaries

These are responsibility seams, not prescribed packages or class names:

1. **Search module (pure):** title/URL normalization, forgiving retrieval, strongest-first ordering, query-order provisional signal, and recency-only ties. Input is query + tab facts; output is ordered results.
2. **Interaction module (pure):** query, typing/selection mode, highlighted result, restored caret/query, number/j/k/arrow behavior, Enter commit intent, and Escape cancel intent. It emits intent; it never calls Chrome.
3. **Chrome tabs module:** list normal non-incognito current-profile tabs with allowed metadata; identify the actually visible previous tab across windows; on commit activate the chosen tab and focus its window. This hides the two-step Chrome operation established in PEEK-4.
4. **Invocation/wiring module:** synchronously register Chrome listeners, expose active/unassigned shortcut state, open the transient experience, and dispatch intents into one context runtime. The shortcut remains unselected pending authorized Chrome tests.
5. **Composition root:** choose concrete adapters once per extension context and map actionable failures to the transient UI. If Effect is used, this is where its Layer and `ManagedRuntime` belong.

The deletion test is useful here: deleting the Search or Interaction module would spread substantial behavior into UI handlers, so both earn their interfaces. Deleting a one-method wrapper around a one-off helper would not; do not create it.

## Browser suitability and measured caution

- Poof demonstrates that Effect can run in MV3 worker, content-script, popup, and options contexts in this repository. It does **not** prove Peek's popup/open latency or bundle cost is acceptable.
- The checked-in `.output/chrome-mv3` is stale relative to `package.json` (generated manifest says `0.1.0`; package says `0.2.0`) and was modified 2026-08-22. Its uncompressed artifacts are 390,188 B background, 422,419 B content script, and 573,115 B shared JSX/runtime chunk. Those numbers cannot be attributed to Effect alone or treated as a current release measurement; they only justify measuring a production-shaped Peek build before committing to the runtime.
- Poof pins a release-candidate Effect version. API stability, supported browser targets, tree-shaking, and maintenance expectations require current primary-source verification before Peek adopts it.

## Consequential unresolved technical decisions

1. **Does Effect earn its runtime in Peek v0?** The browser seams, typed failures, scoped listeners, and production-shaped fakes fit well; the current feature may still be simple enough that plain TypeScript with the same interfaces is shallower and faster to start. This is the only meaningful Poof-derived stack trade-off.
2. **Where does cross-window previous-tab observation live?** Product semantics are recommended in PEEK-4, but Chrome's `lastAccessed` does not provide a documented global previous pointer. A production-shaped experiment must verify the event/lifecycle behavior before freezing the adapter contract.
3. **What transient surface is used?** Not answered here. The interface needs open/ready, commit-dismiss, cancel-dismiss, and focus restoration; action-popup auto-close is a constraint, not a selection.

No additional architecture decision blocks discovery. A later bounded technical spike can compare plain TypeScript versus minimal Effect on emitted size, cold-open readiness, worker wake behavior, and test clarity after a presentation surface is chosen.

## Primary documentation to verify later

- Effect v4's current stable/RC status, browser support, Layer/ManagedRuntime lifecycle guidance, and bundling/tree-shaking behavior.
- Chrome MV3 service-worker listener-registration/wake guarantees for the exact invocation design.
- Chrome focus behavior for the eventual presentation surface and the authorized shortcut-registration experiment already separated in PEEK-4.
- WXT/Vite output behavior only if WXT becomes a candidate; Poof's configuration is project evidence, not upstream compatibility proof.

## Blocker assessment

**No product blocker appears in Poof's technical approach.** Poof provides reusable seam, runtime-composition, validation, and testing patterns, but most of its Effect machinery answers DOM/content problems Peek explicitly does not have. The consequential stack decision—plain TypeScript or minimal Effect at browser seams—should be resolved by a small production-shaped measurement, not by copying Poof or choosing from familiarity. PEEK-6 remains in progress for parent synthesis.
