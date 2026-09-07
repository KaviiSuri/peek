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

  it("refreshes the default highlight when the query changes", () => {
    const ranked = [tabs[0]!, tabs[1]!];
    const previousPartial = { query: "retry", highlightedTabId: 20 };
    expect(setQuery(previousPartial, "orion retry", ranked).highlightedTabId).toBe(10);
    expect(setQuery(previousPartial, "none", []).highlightedTabId).toBeUndefined();
  });

  it("preserves a valid manual highlight for same-query model reconciliation and replaces a removed one", () => {
    const manuallyHighlighted = { query: "orion retry", highlightedTabId: 20 };
    expect(setQuery(manuallyHighlighted, "orion retry", tabs).highlightedTabId).toBe(20);
    expect(setQuery(manuallyHighlighted, "orion retry", tabs.slice(0, 1)).highlightedTabId).toBe(10);
  });
});
