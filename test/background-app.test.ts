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
  let storedAttention: unknown;
  const adapter: BrowserAdapter = {
    async loadAttentionState() { return storedAttention; },
    async saveAttentionState(state) { storedAttention = state; },
    async resolveFocusedAttention(windowId, tabId) {
      return windowId !== undefined && tabId !== undefined ? { windowId, tabId } : undefined;
    },
    async listEligibleTabs(_source: SourceTab) { calls.push("list"); return fixture(); },
    async openOverlay(_source: SourceTab, message: InitMessage) { calls.push("open"); delivered = message; },
    async updateOverlay(_sourceTabId: number, message: ModelMessage) { calls.push("update"); updated = message; },
    async dismissOverlay(_sourceTabId: number, _sessionId: string) { calls.push("dismiss"); },
    async createFallback() { calls.push("create-fallback"); return { tabId: 90, windowId: 91 }; },
    async presentFallback() { return true; },
    async updateFallback(_message: ModelMessage) { calls.push("update-fallback"); },
    async dismissFallback(_windowId: number) { calls.push("dismiss-fallback"); },
    fallbackPageUrl() { return "chrome-extension://peek-extension/fallback.html"; },
    async fileSchemeAccessAllowed() { return true; },
    async revalidateTarget(tabId: number, windowId: number): Promise<TargetTab | undefined> { calls.push("revalidate"); return { id: tabId, windowId, current: false }; },
    async activateTarget(_target: TargetTab) { calls.push("activate"); },
    ...overrides,
  };
  return { adapter, calls, delivered: () => delivered, updated: () => updated };
}

describe("production background composition", () => {
  it.each(["focus", "activation", "close"])("expires and dismisses ordinary sessions on source departure: %s", async (departure) => {
    const fake = fakeBrowser();
    const app = createBackgroundApp(fake.adapter);
    const opened = await app.invoke({ id: 1, windowId: 4 });
    if (departure === "focus") app.observeWindowFocus(9);
    if (departure === "activation") app.observeTabActivation(3, 4);
    if (departure === "close") app.removeTabFromAttention(1);
    await Promise.resolve();
    expect(fake.calls).toContain("dismiss");
    await expect(app.commit({ kind: "peek/commit", sessionId: opened.sessionId, targetTabId: 2, targetWindowId: 9 }, 1))
      .resolves.toEqual({ ok: false, error: "Peek session expired." });
    expect(fake.calls).not.toContain("activate");
  });

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
    let signalList!: () => void;
    const listStarted = new Promise<void>((resolve) => { signalList = resolve; });
    let receiveInit!: (message: InitMessage) => void;
    const initReady = new Promise<InitMessage>((resolve) => { receiveInit = resolve; });
    const fake = fakeBrowser({
      async openOverlay(_source, message) { fake.calls.push("open"); receiveInit(message); },
      async listEligibleTabs() { fake.calls.push("list"); signalList(); return tabsReady; },
    });
    const app = createBackgroundApp(fake.adapter);
    const invocation = app.invoke({ id: 1, windowId: 4 });
    const init = await initReady;
    await listStarted;

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

  it("keeps an arbitrary ordinary-page injection failure visible instead of opening fallback", async () => {
    const fake = fakeBrowser({
      async openOverlay() { fake.calls.push("open-error"); throw new Error("synthetic renderer defect"); },
    });
    const app = createBackgroundApp(fake.adapter);

    await expect(app.invoke({ id: 1, windowId: 4, url: "https://ordinary.test" })).rejects.toThrow("open overlay failed");
    expect(fake.calls).toEqual(["open-error"]);
  });

  it("runs the same model and exact commit path in a provenance-checked restricted fallback", async () => {
    let createdSessionId = "";
    let signalCreated!: () => void;
    const created = new Promise<void>((resolve) => { signalCreated = resolve; });
    const fake = fakeBrowser({
      async createFallback(_source, sessionId) { fake.calls.push("create-fallback"); createdSessionId = sessionId; signalCreated(); return { tabId: 90, windowId: 91 }; },
    });
    const app = createBackgroundApp(fake.adapter);
    const invocation = app.invoke({ id: 1, windowId: 4, url: "chrome://settings/" });
    await created;
    const sender = { tabId: 90, windowId: 91, url: `chrome-extension://peek-extension/fallback.html#${createdSessionId}` };
    const init = await app.fallbackReady(createdSessionId, sender);
    expect(init?.model).toEqual({ status: "loading", tabs: [] });
    app.fallbackMounted(createdSessionId, sender);
    const opened = await invocation;

    expect(fake.calls).toEqual(["create-fallback", "list", "update-fallback"]);
    await expect(app.commit({ kind: "peek/commit", sessionId: opened.sessionId, targetTabId: 2, targetWindowId: 9 }, 1))
      .resolves.toEqual({ ok: false, error: "Peek session expired." });
    await expect(app.commit({ kind: "peek/commit", sessionId: opened.sessionId, targetTabId: 2, targetWindowId: 9 }, sender))
      .resolves.toEqual({ ok: true });
    expect(fake.calls).toEqual(["create-fallback", "list", "update-fallback", "revalidate", "dismiss-fallback", "activate"]);
  });

  it("accepts early fallback readiness but rejects stale or unrelated page provenance", async () => {
    let releaseCreation!: () => void;
    const creation = new Promise<void>((resolve) => { releaseCreation = resolve; });
    let createdSessionId = "";
    const fake = fakeBrowser({
      async createFallback(_source, sessionId) { fake.calls.push("create-fallback"); createdSessionId = sessionId; await creation; return { tabId: 90, windowId: 91 }; },
    });
    const app = createBackgroundApp(fake.adapter);
    const invocation = app.invoke({ id: 1, windowId: 4, url: "chrome://newtab/" });
    await Promise.resolve();
    expect(await app.fallbackReady(createdSessionId, { tabId: 90, windowId: 91, url: "https://unrelated.test/" })).toBeUndefined();
    const ready = app.fallbackReady(createdSessionId, { tabId: 90, windowId: 91, url: `chrome-extension://peek-extension/fallback.html#${createdSessionId}` });
    releaseCreation();
    expect((await ready)?.sessionId).toBe(createdSessionId);
    app.fallbackMounted(createdSessionId, { tabId: 90, windowId: 91, url: `chrome-extension://peek-extension/fallback.html#${createdSessionId}` });
    await invocation;
  });

  it("cancels and cleans up while fallback readiness is pending", async () => {
    let createdSessionId = "";
    let signalCreated!: () => void;
    const created = new Promise<void>((resolve) => { signalCreated = resolve; });
    const fake = fakeBrowser({
      async createFallback(_source, sessionId) { fake.calls.push("create-fallback"); createdSessionId = sessionId; signalCreated(); return { tabId: 90, windowId: 91 }; },
    });
    const app = createBackgroundApp(fake.adapter);
    const invocation = app.invoke({ id: 1, windowId: 4, url: "chrome://settings/" });
    await created;
    const sender = { tabId: 90, windowId: 91, url: `chrome-extension://peek-extension/fallback.html#${createdSessionId}` };
    expect(await app.fallbackReady(createdSessionId, sender)).toBeDefined();
    await app.cancel({ kind: "peek/cancel", sessionId: createdSessionId }, sender);
    await invocation;

    expect(fake.calls).toEqual(["create-fallback", "dismiss-fallback"]);
  });

  it("cleans a late-created superseded fallback without closing its replacement", async () => {
    let releaseFirst!: () => void;
    const firstCreation = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const sessionIds: string[] = [];
    const dismissed: number[] = [];
    const fake = fakeBrowser({
      async createFallback(_source, sessionId) {
        fake.calls.push("create-fallback");
        sessionIds.push(sessionId);
        if (sessionIds.length === 1) { await firstCreation; return { tabId: 90, windowId: 91 }; }
        return { tabId: 92, windowId: 93 };
      },
      async dismissFallback(windowId) { fake.calls.push("dismiss-fallback"); dismissed.push(windowId); },
    });
    const app = createBackgroundApp(fake.adapter);
    const first = app.invoke({ id: 1, windowId: 4, url: "chrome://settings/" });
    await Promise.resolve();
    const second = app.invoke({ id: 1, windowId: 4, url: "chrome://settings/" });
    while (sessionIds.length < 2) await Promise.resolve();
    const replacementId = sessionIds[1]!;
    const replacementSender = { tabId: 92, windowId: 93, url: `chrome-extension://peek-extension/fallback.html#${replacementId}` };
    expect(await app.fallbackReady(replacementId, replacementSender)).toBeDefined();
    app.fallbackMounted(replacementId, replacementSender);
    await second;
    releaseFirst();
    await first;

    expect(dismissed).toEqual([91]);
    await expect(app.commit({ kind: "peek/commit", sessionId: replacementId, targetTabId: 2, targetWindowId: 9 }, replacementSender)).resolves.toEqual({ ok: true });
    expect(dismissed).toEqual([91, 93]);
  });

  it("expires fallback provenance when browser window chrome closes", async () => {
    let createdSessionId = "";
    let signalCreated!: () => void;
    const created = new Promise<void>((resolve) => { signalCreated = resolve; });
    const fake = fakeBrowser({
      async createFallback(_source, sessionId) { fake.calls.push("create-fallback"); createdSessionId = sessionId; signalCreated(); return { tabId: 90, windowId: 91 }; },
    });
    const app = createBackgroundApp(fake.adapter);
    const invocation = app.invoke({ id: 1, windowId: 4, url: "chrome://settings/" });
    await created;
    const sender = { tabId: 90, windowId: 91, url: `chrome-extension://peek-extension/fallback.html#${createdSessionId}` };
    await app.fallbackReady(createdSessionId, sender);
    app.fallbackMounted(createdSessionId, sender);
    await invocation;
    app.observeWindowRemoved(91);

    await expect(app.commit({ kind: "peek/commit", sessionId: createdSessionId, targetTabId: 2, targetWindowId: 9 }, sender))
      .resolves.toEqual({ ok: false, error: "Peek session expired." });
  });
});
