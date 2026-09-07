import type { PeekTab } from "../../src/shared/model";

interface FixtureFact {
  readonly title: string;
  readonly url: string;
}

const originalFacts: readonly FixtureFact[] = [
  { title: "Fix flaky retry in scheduler", url: "https://github.com/acme-labs/orion/pull/2481" },
  { title: "Fix flaky websocket reconnect test", url: "https://github.com/acme-labs/orion/pull/2478" },
  { title: "Scheduler drops jobs under load", url: "https://github.com/acme-labs/orion/issues/2455" },
  { title: "Flaky test: scheduler retry backoff", url: "https://github.com/acme-labs/orion/issues/2460" },
  { title: "Bump orion to v3.2 and update deps", url: "https://github.com/acme-labs/orion/pull/2490" },
  { title: "acme-labs/orion", url: "https://github.com/acme-labs/orion" },
  { title: "Atlas: memory leak in tile cache", url: "https://github.com/acme-labs/atlas/issues/1207" },
  { title: "Cache eviction for tile store", url: "https://github.com/acme-labs/atlas/pull/1210" },
  { title: "Fix flaky retry in uploader", url: "https://github.com/acme-labs/atlas/pull/1188" },
  { title: "Refactor auth middleware", url: "https://github.com/nimbus/pulse/pull/874" },
  { title: "Refactor auth middleware (part 2)", url: "https://github.com/nimbus/pulse/pull/880" },
  { title: "Auth token refresh race condition", url: "https://github.com/nimbus/pulse/issues/869" },
  { title: "RFC: unify auth middleware", url: "https://github.com/nimbus/pulse/discussions/71" },
  { title: "Add idempotency keys to payments", url: "https://github.com/orbit-hq/ledger/pull/333" },
  { title: "Duplicate charge on retry", url: "https://github.com/orbit-hq/ledger/issues/330" },
  { title: "Fix flaky payment webhook test", url: "https://github.com/orbit-hq/ledger/pull/341" },
  { title: "Beacon: dark mode contrast fixes", url: "https://github.com/vela/beacon/issues/55" },
  { title: "Dark mode contrast fixes for beacon", url: "https://github.com/vela/beacon/pull/58" },
  { title: "CI · orion — run #2481 failing", url: "https://github.com/acme-labs/orion/actions/runs/2481" },
  { title: "Notifications", url: "https://github.com/notifications?query=is:unread" },
  { title: "Q3 revenue forecast v4", url: "https://docs.google.com/spreadsheets/d/1a9-synthetic-kQ/edit" },
  { title: "Hiring pipeline tracker", url: "https://docs.google.com/spreadsheets/d/1f2-synthetic-Xm/edit" },
  { title: "Orion incident postmortem", url: "https://docs.google.com/document/d/1z7-synthetic-Pq/edit" },
  { title: "Peek — product discovery", url: "https://docs.google.com/document/d/1c4-synthetic-Vt/edit" },
  { title: "PEEK-8 Which result layout is clearest", url: "https://linear.app/camb/issue/PEEK-8" },
  { title: "Peek — palette explorations", url: "https://figma.com/file/2Kd-synthetic/Peek-explorations" },
  { title: "Eng weekly notes", url: "https://notion.so/camb/Eng-weekly-synthetic" },
  { title: "Query all tabs across Chrome windows", url: "https://stackoverflow.com/questions/12345678" },
  { title: "chrome.tabs.query() — reference", url: "https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/query" },
  { title: "Vite + Peek dev server", url: "http://localhost:5173/popup/index.html" },
];

export const normalSearchFixture: readonly PeekTab[] = originalFacts.map((fact, index) => ({
  id: index + 1,
  windowId: index % 3 + 1,
  ...fact,
  // Deliberately make repository children newer than the repository home.
  lastAccessed: index === 5 ? 10 : 10_000 - index,
  current: false,
}));

const repeatedFacts: readonly FixtureFact[] = [
  { title: "Retry worker stalls in scheduler", url: "https://github.com/ember-labs/solstice/issues/510" },
  { title: "Fix scheduler retry jitter", url: "https://github.com/ember-labs/solstice/pull/511" },
  { title: "Scheduler capacity notes", url: "https://github.com/ember-labs/harbor/issues/512" },
  { title: "Retry upload after timeout", url: "https://github.com/ember-labs/harbor/pull/513" },
  { title: "Auth middleware cleanup", url: "https://github.com/harbor/pulse/pull/912" },
  { title: "Auth middleware cleanup", url: "https://github.com/harbor/pulse/pull/911" },
  { title: "Release checklist", url: "https://github.com/ember-labs/solstice/issues/514" },
];

export const stressSearchFixture: readonly PeekTab[] = Array.from({ length: 100 }, (_, index) => {
  const fact = index < originalFacts.length
    ? originalFacts[index]!
    : repeatedFacts[(index - originalFacts.length) % repeatedFacts.length]!;
  const copy = Math.floor(Math.max(0, index - originalFacts.length) / repeatedFacts.length);
  return {
    id: index + 1,
    windowId: index % 4 + 1,
    title: index < originalFacts.length ? fact.title : `${fact.title} · workspace ${copy + 1}`,
    url: index < originalFacts.length ? fact.url : `${fact.url}?workspace=${copy + 1}`,
    lastAccessed: 100_000 - index,
    current: false,
  };
});
