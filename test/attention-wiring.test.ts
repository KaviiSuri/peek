import { describe, expect, it, vi } from "vitest";
import { createBackgroundApp } from "../src/background/app";
import type { BrowserAdapter } from "../src/background/browser-adapter";
import { registerBackground } from "../src/background/wiring";
import { searchTabs } from "../src/search/search";
import type { AttentionIdentity, AttentionState } from "../src/attention/attention";
import type { InitMessage, ModelMessage, PeekTab } from "../src/shared/model";

function deferred<A>() {
  let resolve!: (value: A) => void;
  const promise = new Promise<A>((done) => { resolve = done; });
  return { promise, resolve };
}

const A = { tabId: 1, windowId: 10 };
const B = { tabId: 2, windowId: 20 };
const tabs: PeekTab[] = [
  { id: 2, windowId: 20, title: "Current B", url: "https://b.test", lastAccessed: 200, current: true },
  { id: 3, windowId: 20, title: "Recent C", url: "https://c.test", lastAccessed: 300, current: false },
  { id: 1, windowId: 10, title: "Previous A", url: "https://a.test", lastAccessed: 100, current: false },
];

describe("registered attention event path", () => {
  it("survives delayed restore and delivers the actual previous tab as the visible initial highlight", async () => {
    const restore = deferred<unknown>();
    const saved: AttentionState[] = [];
    const candidates = new Map<string, AttentionIdentity>([["10:1", A], ["20:2", B]]);
    let delivered: ModelMessage | undefined;
    const adapter: BrowserAdapter = {
      loadAttentionState: () => restore.promise,
      async saveAttentionState(state) { saved.push(state); },
      async resolveFocusedAttention(windowId, tabId) { return candidates.get(`${windowId}:${tabId}`); },
      async listEligibleTabs() { return tabs; },
      async openOverlay(_source, _message: InitMessage) {},
      async updateOverlay(_sourceTabId, message) { delivered = message; },
      async dismissOverlay() {},
      async revalidateTarget(tabId, windowId) { return { id: tabId, windowId, current: tabId === 2 }; },
      async activateTarget() {},
    };
    const app = createBackgroundApp(adapter);
    let activated!: (info: chrome.tabs.OnActivatedInfo) => void;
    registerBackground({
      onActionClicked: { addListener() {} },
      onMessage: { addListener() {} },
      onTabActivated: { addListener(listener) { activated = listener; } },
      onTabRemoved: { addListener() {} },
      onWindowFocusChanged: { addListener() {} },
    }, app);
    app.start();

    activated({ tabId: 1, windowId: 10 });
    activated({ tabId: 2, windowId: 20 });
    restore.resolve({ version: 1, current: { tabId: 99, windowId: 99 } });
    const opened = await app.invoke({ id: 2, windowId: 20 });

    const readyTabs = delivered?.model.tabs ?? [];
    expect(readyTabs.find((tab) => tab.id === 1)?.previous).toBe(true);
    expect(searchTabs(readyTabs, "")[0]?.id).toBe(1);
    expect(saved.at(-1)).toEqual({ version: 1, current: B, previous: A });

    await expect(app.commit({
      kind: "peek/commit",
      sessionId: opened.sessionId,
      targetTabId: 1,
      targetWindowId: 10,
    }, 2)).resolves.toEqual({ ok: true });
  });

  it("current selection is a no-op and does not destroy the previous candidate", async () => {
    let stored: AttentionState = { version: 1, current: B, previous: A };
    const activateTarget = vi.fn();
    const adapter: BrowserAdapter = {
      async loadAttentionState() { return stored; },
      async saveAttentionState(state) { stored = state; },
      async resolveFocusedAttention() { return undefined; },
      async listEligibleTabs() { return tabs; },
      async openOverlay() {},
      async updateOverlay() {},
      async dismissOverlay() {},
      async revalidateTarget(tabId, windowId) { return { id: tabId, windowId, current: true }; },
      activateTarget,
    };
    const app = createBackgroundApp(adapter);
    app.start();
    const first = await app.invoke({ id: 2, windowId: 20 });
    await app.commit({ kind: "peek/commit", sessionId: first.sessionId, targetTabId: 2, targetWindowId: 20 }, 2);
    await app.invoke({ id: 2, windowId: 20 });

    expect(stored).toEqual({ version: 1, current: B, previous: A });
    expect(activateTarget).not.toHaveBeenCalled();
  });
});
