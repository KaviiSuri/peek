import { describe, expect, it } from "vitest";
import { meaningfulLocation, searchTabs } from "../src/search/search";
import type { PeekTab } from "../src/shared/model";

const tabs: PeekTab[] = [
  { id: 1, windowId: 1, title: "Current notes", url: "https://docs.example/current", lastAccessed: 500, current: true },
  { id: 2, windowId: 2, title: "Fix retry in Orion scheduler", url: "https://github.com/acme/orion/pull/21", lastAccessed: 300, current: false },
  { id: 3, windowId: 1, title: "Orion repository", url: "https://github.com/acme/orion", lastAccessed: 400, current: false },
  { id: 4, windowId: 1, title: "Retry notes", url: "https://docs.example/atlas", lastAccessed: 600, current: false },
];

describe("searchTabs", () => {
  it("filters case-insensitive title and URL tokens with stronger combined evidence first", () => {
    expect(searchTabs(tabs, "ORION retry").map((tab) => tab.id)).toEqual([2]);
    expect(searchTabs(tabs, "github orion").map((tab) => tab.id)).toEqual([3, 2]);
  });

  it("keeps an eligible non-current tab selected before the current tab on an empty query", () => {
    expect(searchTabs(tabs, "").map((tab) => tab.id)).toEqual([4, 3, 2, 1]);
  });

  it("does not infer words absent from title and URL", () => {
    expect(searchTabs(tabs, "outage")).toEqual([]);
  });
});

describe("meaningfulLocation", () => {
  it("keeps the host and useful path while dropping a root slash", () => {
    expect(meaningfulLocation("https://github.com/acme/orion/pull/21?view=files")).toBe("github.com/acme/orion/pull/21?view=files");
    expect(meaningfulLocation("https://example.com/")).toBe("example.com");
  });
});
