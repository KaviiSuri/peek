import { describe, expect, it } from "vitest";
import { meaningfulLocation, searchTabs } from "../src/search/search";
import type { PeekTab } from "../src/shared/model";
import { normalSearchFixture, stressSearchFixture } from "./fixtures/search-fixtures";

const tabs: PeekTab[] = [
  { id: 1, windowId: 1, title: "Current notes", url: "https://docs.example/current", lastAccessed: 500, current: true },
  { id: 2, windowId: 2, title: "Fix retry in Orion scheduler", url: "https://github.com/acme/orion/pull/21", lastAccessed: 300, current: false },
  { id: 3, windowId: 1, title: "Orion repository", url: "https://github.com/acme/orion", lastAccessed: 400, current: false },
  { id: 4, windowId: 1, title: "Retry notes", url: "https://docs.example/atlas", lastAccessed: 600, current: false },
];

describe("searchTabs", () => {
  it("filters case-insensitive title and URL tokens with stronger combined evidence first", () => {
    expect(searchTabs(tabs, "ORION retry").map((tab) => tab.id)).toEqual([2, 4, 3]);
    expect(searchTabs(tabs, "github orion").map((tab) => tab.id)).toEqual([3, 2]);
  });

  it("keeps an eligible non-current tab selected before the current tab on an empty query", () => {
    expect(searchTabs(tabs, "").map((tab) => tab.id)).toEqual([4, 3, 2, 1]);
  });

  it("puts a trustworthy previous distinct tab before newer MRU candidates", () => {
    const withPrevious = tabs.map((tab) => ({ ...tab, previous: tab.id === 2 }));
    expect(searchTabs(withPrevious, "").map((tab) => tab.id)).toEqual([2, 4, 3, 1]);
  });

  it("orders the agreed 30-tab ambiguity cases by coverage and textual evidence before recency", () => {
    expect(normalSearchFixture).toHaveLength(30);

    const orionRetry = searchTabs(normalSearchFixture, "orion retry").map((tab) => tab.id);
    expect(orionRetry.slice(0, 2).sort((left, right) => left - right)).toEqual([1, 4]);
    expect(Math.max(orionRetry.indexOf(1), orionRetry.indexOf(4))).toBeLessThan(Math.min(orionRetry.indexOf(6), orionRetry.indexOf(9)));

    expect(searchTabs(normalSearchFixture, "orion")[0]?.id).toBe(6);
    expect(searchTabs(normalSearchFixture, "github auth 880")[0]?.id).toBe(11);

    const shortened = searchTabs(normalSearchFixture, "sched rtry").map((tab) => tab.id);
    expect(shortened.slice(0, 2)).toEqual([4, 1]);
    expect(Math.max(shortened.indexOf(1), shortened.indexOf(4))).toBeLessThan(Math.min(shortened.indexOf(3), shortened.indexOf(9)));
    expect(searchTabs(normalSearchFixture, "SCHED RTRY").slice(0, 2).map((tab) => tab.id)).toEqual([4, 1]);
  });

  it("keeps recency behind nonempty textual evidence and uses it only for genuine textual ties", () => {
    const repositoryChildrenMadeNewer = normalSearchFixture.map((tab) => tab.id === 5 ? { ...tab, lastAccessed: 999_999 } : tab);
    expect(searchTabs(repositoryChildrenMadeNewer, "orion")[0]?.id).toBe(6);

    const duplicates: PeekTab[] = [
      { id: 81, windowId: 1, title: "Hiring pipeline tracker", url: "https://docs.google.com/spreadsheets/d/older/edit", lastAccessed: 18, current: false },
      { id: 82, windowId: 2, title: "Hiring pipeline tracker", url: "https://docs.google.com/spreadsheets/d/newer/edit", lastAccessed: 200, current: false },
      { id: 83, windowId: 1, title: "Untitled spreadsheet", url: "https://docs.google.com/spreadsheets/d/hiring-pipeline/edit", lastAccessed: 900, current: false },
    ];
    expect(searchTabs(duplicates, "hiring pipeline").map((tab) => tab.id)).toEqual([82, 81, 83]);
  });

  it("limits repository-home preference to the supported GitHub hostname", () => {
    const hosts: PeekTab[] = [
      { id: 301, windowId: 1, title: "northstar/lumen", url: "https://github.unrelated/northstar/lumen", lastAccessed: 999, current: false },
      { id: 302, windowId: 1, title: "northstar/lumen", url: "https://github.com/northstar/lumen", lastAccessed: 1, current: false },
    ];
    expect(searchTabs(hosts, "lumen").map((tab) => tab.id)).toEqual([302, 301]);
  });

  it("keeps literal textual strength ahead of an approximate repository-home match", () => {
    const directnessTabs: PeekTab[] = [
      { id: 311, windowId: 1, title: "northstar/retry", url: "https://github.com/northstar/retry", lastAccessed: 999, current: false },
      { id: 312, windowId: 1, title: "Rtry notes", url: "https://notes.example/rtry", lastAccessed: 1, current: false },
    ];
    expect(searchTabs(directnessTabs, "rtry").map((tab) => tab.id)).toEqual([312, 311]);
  });

  it("keeps a nonblank punctuation query literal instead of treating it as an empty query", () => {
    const punctuationTabs: PeekTab[] = [
      { id: 201, windowId: 1, title: "C++ reference", url: "https://developer.example/cpp", lastAccessed: 1, current: false },
      { id: 202, windowId: 1, title: "Meeting notes", url: "https://notes.example/today", lastAccessed: 999, current: false, previous: true },
    ];
    expect(searchTabs(punctuationTabs, "++").map((tab) => tab.id)).toEqual([201]);
    expect(searchTabs(punctuationTabs, "%%")).toEqual([]);
    expect(searchTabs(punctuationTabs, "   ").map((tab) => tab.id)).toEqual([202, 201]);
  });

  it("does not infer words absent from title and URL but retrieves explicit incident and postmortem clues", () => {
    expect(searchTabs(normalSearchFixture, "outage")).toEqual([]);
    expect(searchTabs(normalSearchFixture, "orion incident")[0]?.id).toBe(23);
    expect(searchTabs(normalSearchFixture, "postmortem")[0]?.id).toBe(23);
  });

  it("generalizes repository, cross-field, numeric and dropped-character behavior beyond the named fixture", () => {
    const holdout: PeekTab[] = [
      { id: 101, windowId: 1, title: "northstar/lumen", url: "https://github.com/northstar/lumen", lastAccessed: 1, current: false },
      { id: 102, windowId: 1, title: "Fix retry in scheduler", url: "https://github.com/northstar/lumen/pull/451", lastAccessed: 4, current: false },
      { id: 103, windowId: 2, title: "Scheduler retry backoff fails", url: "https://github.com/northstar/lumen/issues/450", lastAccessed: 3, current: false },
      { id: 104, windowId: 2, title: "Lumen release checklist", url: "https://github.com/northstar/lumen/issues/455", lastAccessed: 10_000, current: false },
      { id: 105, windowId: 2, title: "Fix retry in uploader", url: "https://github.com/northstar/atlas/pull/91", lastAccessed: 9_000, current: false },
      { id: 106, windowId: 1, title: "Auth middleware cleanup", url: "https://github.com/harbor/pulse/pull/912", lastAccessed: 2, current: false },
      { id: 107, windowId: 1, title: "Auth middleware cleanup", url: "https://github.com/harbor/pulse/pull/911", lastAccessed: 8_000, current: false },
    ];

    expect(searchTabs(holdout, "lumen")[0]?.id).toBe(101);
    expect(searchTabs(holdout, "lumen retry").slice(0, 2).map((tab) => tab.id).sort()).toEqual([102, 103]);
    expect(searchTabs(holdout, "github auth 912")[0]?.id).toBe(106);
    expect(searchTabs(holdout, "sched rtry").slice(0, 2).map((tab) => tab.id)).toEqual([103, 102]);
  });

  it("handles an ambiguity-preserving 100-tab workload deterministically", () => {
    expect(stressSearchFixture).toHaveLength(100);
    const startedAt = performance.now();
    const first = searchTabs(stressSearchFixture, "sched rtry").map((tab) => tab.id);
    const elapsedMs = performance.now() - startedAt;
    const second = searchTabs(stressSearchFixture, "sched rtry").map((tab) => tab.id);

    expect(first[0]).toBe(4);
    expect(first.indexOf(1)).toBeLessThan(first.indexOf(3));
    expect(first.indexOf(1)).toBeLessThan(first.indexOf(9));
    expect(first).toEqual(second);
    expect(new Set(stressSearchFixture.map((tab) => new URL(tab.url).hostname)).size).toBeLessThan(10);
    console.info(`100-tab ambiguity search measured ${elapsedMs.toFixed(3)} ms (informational; no pass threshold)`);
  });
});

describe("meaningfulLocation", () => {
  it("keeps the host and useful path while dropping a root slash", () => {
    expect(meaningfulLocation("https://github.com/acme/orion/pull/21?view=files")).toBe("github.com/acme/orion/pull/21?view=files");
    expect(meaningfulLocation("https://example.com/")).toBe("example.com");
  });
});
