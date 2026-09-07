import { describe, expect, it, vi } from "vitest";
import { createBackgroundApp } from "../src/background/app";
import type { BrowserAdapter, SourceTab, TargetTab } from "../src/background/browser-adapter";
import { moveHighlight, initialInteraction, highlightedTab } from "../src/interaction/interaction";
import { searchTabs } from "../src/search/search";
import type { InitMessage, PeekTab } from "../src/shared/model";

function fixture(): PeekTab[] {
  return [
    { id: 2, windowId: 9, title: "Orion retry", url: "https://github.com/acme/orion/pull/2", lastAccessed: 20, current: false },
    { id: 1, windowId: 4, title: "Source", url: "https://source.test", lastAccessed: 30, current: true },
  ];
}

function fakeBrowser(overrides: Partial<BrowserAdapter> = {}) {
  const calls: string[] = [];
  let delivered: InitMessage | undefined;
  const adapter: BrowserAdapter = {
    async listEligibleTabs(_source: SourceTab) { calls.push("list"); return fixture(); },
    async openOverlay(_source: SourceTab, message: InitMessage) { calls.push("open"); delivered = message; },
    async dismissOverlay(_sourceTabId: number, _sessionId: string) { calls.push("dismiss"); },
    async revalidateTarget(tabId: number, windowId: number): Promise<TargetTab | undefined> { calls.push("revalidate"); return { id: tabId, windowId, current: false }; },
    async activateTarget(_target: TargetTab) { calls.push("activate"); },
    ...overrides,
  };
  return { adapter, calls, delivered: () => delivered };
}

describe("production background composition", () => {
  it("runs invoke, model, filter, highlight, exact revalidation, dismiss, tab activation and window focus adapter path", async () => {
    const fake = fakeBrowser();
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    const delivered = fake.delivered();
    expect(delivered?.model.tabs).toHaveLength(2);

    const results = searchTabs(delivered?.model.tabs ?? [], "orion");
    const state = moveHighlight(initialInteraction(results), results, 1);
    const target = highlightedTab(state, results) ?? results[0];
    expect(target?.id).toBe(2);

    const response = await app.commit({
      kind: "peek/commit",
      sessionId: opened.sessionId,
      targetTabId: target!.id,
      targetWindowId: target!.windowId,
    }, 1);
    expect(response).toEqual({ ok: true });
    expect(fake.calls).toEqual(["list", "open", "revalidate", "dismiss", "activate"]);
  });

  it("cancels without revalidation, dismissal, tab activation or window focus calls", async () => {
    const fake = fakeBrowser();
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    app.cancel({ kind: "peek/cancel", sessionId: opened.sessionId }, 1);
    expect(fake.calls).toEqual(["list", "open"]);
  });

  it("fails a vanished or mismatched target before teardown and never activates another tab", async () => {
    const fake = fakeBrowser({ revalidateTarget: vi.fn(async () => undefined) });
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    const response = await app.commit({ kind: "peek/commit", sessionId: opened.sessionId, targetTabId: 2, targetWindowId: 9 }, 1);
    expect(response).toEqual({ ok: false, error: "That tab is no longer open." });
    expect(fake.calls).toEqual(["list", "open"]);
  });

  it("dismisses a current-target commit without activation", async () => {
    const fake = fakeBrowser();
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    await app.commit({ kind: "peek/commit", sessionId: opened.sessionId, targetTabId: 1, targetWindowId: 4 }, 1);
    expect(fake.calls).toEqual(["list", "open", "revalidate", "dismiss"]);
  });

  it("does not let a cancel from another sender discard the source tab's session", async () => {
    const fake = fakeBrowser();
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });

    app.cancel({ kind: "peek/cancel", sessionId: opened.sessionId }, 99);
    const response = await app.commit({
      kind: "peek/commit",
      sessionId: opened.sessionId,
      targetTabId: 2,
      targetWindowId: 9,
    }, 1);

    expect(response).toEqual({ ok: true });
    expect(fake.calls).toEqual(["list", "open", "revalidate", "dismiss", "activate"]);
  });

  it("rejects commits from a different sender tab", async () => {
    const fake = fakeBrowser();
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    const response = await app.commit({ kind: "peek/commit", sessionId: opened.sessionId, targetTabId: 2, targetWindowId: 9 }, 99);
    expect(response.ok).toBe(false);
    expect(fake.calls).toEqual(["list", "open"]);
  });
});
