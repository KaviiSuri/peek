import { describe, expect, it, vi } from "vitest";
import { createBackgroundApp } from "../src/background/app";
import type { BrowserAdapter, SourceTab, TargetTab } from "../src/background/browser-adapter";
import { moveHighlight, initialInteraction, highlightedTab } from "../src/interaction/interaction";
import { searchTabs } from "../src/search/search";
import type { InitMessage, ModelMessage, PeekTab } from "../src/shared/model";

function fixture(): PeekTab[] {
  return [
    { id: 2, windowId: 9, title: "Orion retry", url: "https://github.com/acme/orion/pull/2", lastAccessed: 20, current: false },
    { id: 1, windowId: 4, title: "Source", url: "https://source.test", lastAccessed: 30, current: true },
  ];
}

function fakeBrowser(overrides: Partial<BrowserAdapter> = {}) {
  const calls: string[] = [];
  let delivered: InitMessage | undefined;
  let updated: ModelMessage | undefined;
  const adapter: BrowserAdapter = {
    async listEligibleTabs(_source: SourceTab) { calls.push("list"); return fixture(); },
    async openOverlay(_source: SourceTab, message: InitMessage) { calls.push("open"); delivered = message; },
    async updateOverlay(_sourceTabId: number, message: ModelMessage) { calls.push("update"); updated = message; },
    async dismissOverlay(_sourceTabId: number, _sessionId: string) { calls.push("dismiss"); },
    async revalidateTarget(tabId: number, windowId: number): Promise<TargetTab | undefined> { calls.push("revalidate"); return { id: tabId, windowId, current: false }; },
    async activateTarget(_target: TargetTab) { calls.push("activate"); },
    ...overrides,
  };
  return { adapter, calls, delivered: () => delivered, updated: () => updated };
}

describe("production background composition", () => {
  it("opens a stable input before model work, then runs filter, highlight, exact revalidation, dismiss, activation and focus", async () => {
    const fake = fakeBrowser();
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    expect(fake.delivered()?.model).toEqual({ status: "loading", tabs: [] });
    const updated = fake.updated();
    expect(updated?.model.tabs).toHaveLength(2);

    const results = searchTabs(updated?.model.tabs ?? [], "orion");
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
    expect(fake.calls).toEqual(["open", "list", "update", "revalidate", "dismiss", "activate"]);
  });

  it("does not deliver a late model after cancellation during deferred enumeration", async () => {
    let releaseTabs!: (tabs: readonly PeekTab[]) => void;
    const tabsReady = new Promise<readonly PeekTab[]>((resolve) => { releaseTabs = resolve; });
    let receiveInit!: (message: InitMessage) => void;
    const initReady = new Promise<InitMessage>((resolve) => { receiveInit = resolve; });
    const fake = fakeBrowser({
      async openOverlay(_source, message) { fake.calls.push("open"); receiveInit(message); },
      async listEligibleTabs() { fake.calls.push("list"); return tabsReady; },
    });
    const app = createBackgroundApp(fake.adapter);
    const invocation = app.invoke({ id: 1, windowId: 4 });
    const init = await initReady;

    app.cancel({ kind: "peek/cancel", sessionId: init.sessionId }, 1);
    releaseTabs(fixture());
    await invocation;

    expect(fake.calls).toEqual(["open", "list"]);
    expect(fake.updated()).toBeUndefined();
  });

  it("cancels without revalidation, dismissal, tab activation or window focus calls", async () => {
    const fake = fakeBrowser();
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    app.cancel({ kind: "peek/cancel", sessionId: opened.sessionId }, 1);
    expect(fake.calls).toEqual(["open", "list", "update"]);
  });

  it("fails a vanished or mismatched target before teardown and never activates another tab", async () => {
    const fake = fakeBrowser({ revalidateTarget: vi.fn(async () => undefined) });
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    const response = await app.commit({ kind: "peek/commit", sessionId: opened.sessionId, targetTabId: 2, targetWindowId: 9 }, 1);
    expect(response).toEqual({ ok: false, error: "That tab is no longer open." });
    expect(fake.calls).toEqual(["open", "list", "update"]);
  });

  it("dismisses a current-target commit without activation", async () => {
    const fake = fakeBrowser();
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    await app.commit({ kind: "peek/commit", sessionId: opened.sessionId, targetTabId: 1, targetWindowId: 4 }, 1);
    expect(fake.calls).toEqual(["open", "list", "update", "revalidate", "dismiss"]);
  });

  it("does not dismiss or activate after a valid cancellation while target revalidation is pending", async () => {
    let releaseTarget!: (target: TargetTab) => void;
    const targetReady = new Promise<TargetTab>((resolve) => { releaseTarget = resolve; });
    let signalRevalidation!: () => void;
    const revalidationStarted = new Promise<void>((resolve) => { signalRevalidation = resolve; });
    const fake = fakeBrowser({
      async revalidateTarget() { fake.calls.push("revalidate"); signalRevalidation(); return targetReady; },
    });
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    const commit = app.commit({ kind: "peek/commit", sessionId: opened.sessionId, targetTabId: 2, targetWindowId: 9 }, 1);
    await revalidationStarted;

    app.cancel({ kind: "peek/cancel", sessionId: opened.sessionId }, 1);
    releaseTarget({ id: 2, windowId: 9, current: false });

    await expect(commit).resolves.toEqual({ ok: false, error: "Peek session expired." });
    expect(fake.calls).toEqual(["open", "list", "update", "revalidate"]);
  });

  it("does not dismiss or activate an in-flight commit after a newer invocation supersedes its session", async () => {
    let releaseTarget!: (target: TargetTab) => void;
    const targetReady = new Promise<TargetTab>((resolve) => { releaseTarget = resolve; });
    let signalRevalidation!: () => void;
    const revalidationStarted = new Promise<void>((resolve) => { signalRevalidation = resolve; });
    const fake = fakeBrowser({
      async revalidateTarget() { fake.calls.push("revalidate"); signalRevalidation(); return targetReady; },
    });
    const app = createBackgroundApp(fake.adapter);
    const first = await app.invoke({ id: 1, windowId: 4 });
    const commit = app.commit({ kind: "peek/commit", sessionId: first.sessionId, targetTabId: 2, targetWindowId: 9 }, 1);
    await revalidationStarted;

    await app.invoke({ id: 1, windowId: 4 });
    releaseTarget({ id: 2, windowId: 9, current: false });

    await expect(commit).resolves.toEqual({ ok: false, error: "Peek session expired." });
    expect(fake.calls.filter((call) => call === "dismiss" || call === "activate")).toEqual([]);
  });

  it("does not activate after a valid cancellation while overlay dismissal is pending", async () => {
    let releaseDismiss!: () => void;
    const dismissReady = new Promise<void>((resolve) => { releaseDismiss = resolve; });
    let signalDismiss!: () => void;
    const dismissStarted = new Promise<void>((resolve) => { signalDismiss = resolve; });
    const fake = fakeBrowser({
      async dismissOverlay() { fake.calls.push("dismiss"); signalDismiss(); return dismissReady; },
    });
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    const commit = app.commit({ kind: "peek/commit", sessionId: opened.sessionId, targetTabId: 2, targetWindowId: 9 }, 1);
    await dismissStarted;

    app.cancel({ kind: "peek/cancel", sessionId: opened.sessionId }, 1);
    releaseDismiss();

    await expect(commit).resolves.toEqual({ ok: false, error: "Peek session expired." });
    expect(fake.calls).toEqual(["open", "list", "update", "revalidate", "dismiss"]);
  });

  it("does not activate after a newer invocation supersedes a commit during overlay dismissal", async () => {
    let releaseDismiss!: () => void;
    const dismissReady = new Promise<void>((resolve) => { releaseDismiss = resolve; });
    let signalDismiss!: () => void;
    const dismissStarted = new Promise<void>((resolve) => { signalDismiss = resolve; });
    let dismissCount = 0;
    const fake = fakeBrowser({
      async dismissOverlay() {
        fake.calls.push("dismiss");
        dismissCount += 1;
        if (dismissCount === 1) { signalDismiss(); await dismissReady; }
      },
    });
    const app = createBackgroundApp(fake.adapter);
    const first = await app.invoke({ id: 1, windowId: 4 });
    const commit = app.commit({ kind: "peek/commit", sessionId: first.sessionId, targetTabId: 2, targetWindowId: 9 }, 1);
    await dismissStarted;

    await app.invoke({ id: 1, windowId: 4 });
    releaseDismiss();

    await expect(commit).resolves.toEqual({ ok: false, error: "Peek session expired." });
    expect(fake.calls.filter((call) => call === "activate")).toEqual([]);
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
    expect(fake.calls).toEqual(["open", "list", "update", "revalidate", "dismiss", "activate"]);
  });

  it("rejects commits from a different sender tab", async () => {
    const fake = fakeBrowser();
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    const response = await app.commit({ kind: "peek/commit", sessionId: opened.sessionId, targetTabId: 2, targetWindowId: 9 }, 99);
    expect(response.ok).toBe(false);
    expect(fake.calls).toEqual(["open", "list", "update"]);
  });
});
