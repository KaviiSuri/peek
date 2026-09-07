import { describe, expect, it } from "vitest";
import { highlightedTab, initialInteraction, moveHighlight, setQuery } from "../src/interaction/interaction";
import type { PeekTab } from "../src/shared/model";

const tabs: PeekTab[] = [
  { id: 10, windowId: 1, title: "One", url: "https://one.test", lastAccessed: 2, current: false },
  { id: 20, windowId: 2, title: "Two", url: "https://two.test", lastAccessed: 1, current: false },
];

describe("interaction", () => {
  it("starts safely, wraps arrows and exposes the highlighted tab", () => {
    let state = initialInteraction(tabs);
    expect(highlightedTab(state, tabs)?.id).toBe(10);
    state = moveHighlight(state, tabs, -1);
    expect(highlightedTab(state, tabs)?.id).toBe(20);
    state = moveHighlight(state, tabs, 1);
    expect(highlightedTab(state, tabs)?.id).toBe(10);
  });

  it("keeps a valid highlight after filtering and reconciles a removed one", () => {
    const state = { query: "", highlightedTabId: 20 };
    expect(setQuery(state, "two", tabs).highlightedTabId).toBe(20);
    expect(setQuery(state, "one", tabs.slice(0, 1)).highlightedTabId).toBe(10);
    expect(setQuery(state, "none", []).highlightedTabId).toBeUndefined();
  });
});
