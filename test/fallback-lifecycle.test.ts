import { afterEach, describe, expect, it, vi } from "vitest";
import { createBackgroundApp, type FallbackSender } from "../src/background/app";
import type { BrowserAdapter, FallbackSurface, TargetTab } from "../src/background/browser-adapter";
import type { ModelMessage } from "../src/shared/model";
import { registerBackground } from "../src/background/wiring";
import { chromeBrowserAdapter } from "../src/background/chrome-browser-adapter";

function deferred<A>() {
  let resolve!: (value: A) => void;
  const promise = new Promise<A>((done) => { resolve = done; });
  return { promise, resolve };
}

function setup(overrides: Partial<BrowserAdapter> = {}) {
  const created = deferred<string>();
  const source = { id: 1, windowId: 10, url: "chrome://settings/" };
  const surface = { tabId: 90, windowId: 91 };
  const adapter: BrowserAdapter = {
    async loadAttentionState() { return { version: 1, current: { tabId: 1, windowId: 10 }, previous: { tabId: 2, windowId: 20 } }; },
    saveAttentionState: vi.fn(async () => undefined),
    async resolveFocusedAttention() { return undefined; },
    async listEligibleTabs() { return [
      { id: 1, windowId: 10, title: "Settings", url: source.url, lastAccessed: 20, current: true },
      { id: 2, windowId: 20, title: "Orion", url: "https://github.com/acme/orion", lastAccessed: 10, current: false },
    ]; },
    openOverlay: vi.fn(async () => undefined),
    updateOverlay: vi.fn(async () => undefined),
    dismissOverlay: vi.fn(async () => undefined),
    async createFallback(_source, sessionId) { created.resolve(sessionId); return surface; },
    presentFallback: vi.fn(async (_source, _surface, current) => current()),
    updateFallback: vi.fn(async (_message: ModelMessage) => undefined),
    dismissFallback: vi.fn(async (_id: number) => ({ windowId: 10, focused: true })),
    fallbackPageUrl: () => "chrome-extension://peek/fallback.html",
    fileSchemeAccessAllowed: vi.fn(async () => true),
    revalidateTarget: vi.fn(async (id, windowId) => ({ id, windowId, current: false })),
    activateTarget: vi.fn(async () => undefined),
    ...overrides,
  };
  const app = createBackgroundApp(adapter);
  let messageListener!: (message: unknown, sender: chrome.runtime.MessageSender, respond: (value: unknown) => void) => boolean | undefined;
  let windowRemoved!: (windowId: number) => void;
  let windowFocus!: (windowId: number) => void;
  let tabActivated!: (info: { tabId: number; windowId: number }) => void;
  registerBackground({
    onActionClicked: { addListener() {} },
    onTabActivated: { addListener(listener) { tabActivated = listener; } },
    onTabRemoved: { addListener() {} },
    onWindowFocusChanged: { addListener(listener) { windowFocus = listener; } },
    onWindowRemoved: { addListener(listener) { windowRemoved = listener; } },
    onMessage: { addListener(listener) { messageListener = listener as typeof messageListener; } },
  }, app);
  const invoke = () => app.invoke(source);
  const sender = (sessionId: string): FallbackSender => ({ ...surface, windowId: surface.windowId, url: `${adapter.fallbackPageUrl()}#${sessionId}`, frameId: 0, documentId: "doc-90" });
  const runtime = (message: unknown, identity: FallbackSender) => new Promise<unknown>((resolve) => {
    const asyncResponse = messageListener(message, {
      tab: { id: identity.tabId, windowId: identity.windowId } as chrome.tabs.Tab,
      url: identity.url, frameId: identity.frameId, documentId: identity.documentId,
    } as chrome.runtime.MessageSender, resolve);
    if (!asyncResponse) resolve(undefined);
  });
  const open = async () => {
    const invocation = invoke();
    const id = await created.promise;
    const identity = sender(id);
    expect(await runtime({ kind: "peek/fallback-ready", sessionId: id }, identity)).toMatchObject({ sourceTabId: 1 });
    await runtime({ kind: "peek/fallback-mounted", sessionId: id }, identity);
    await invocation;
    return { id, identity, commit: { kind: "peek/commit" as const, sessionId: id, targetTabId: 2, targetWindowId: 20 } };
  };
  return { adapter, app, source, surface, created, sender, invoke, runtime, open, windowRemoved, windowFocus, tabActivated };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("fallback registered lifecycle", () => {
  it.each(['source-return', 'source-tab', 'late-return', 'target-then-source'])('limits expected return authority: %s', async departure => {
    const closeStarted = deferred<void>(), closeGate = deferred<void>(), activationStarted = deferred<void>(), activationGate = deferred<void>();
    let focused = 91;
    const activate = vi.fn(async () => { activationStarted.resolve(); await activationGate.promise; return { id: 2, windowId: 20 }; });
    const focus = vi.fn(async (id: number) => { focused = id; });
    vi.stubGlobal('chrome', {
      tabs: { update: activate },
      windows: {
        remove: async () => { closeStarted.resolve(); await closeGate.promise; if (focused === 91) focused = 10; },
        getLastFocused: async () => ({ id: focused, focused: true }), update: focus,
      },
    });
    const f = setup({ dismissFallback: chromeBrowserAdapter.dismissFallback, activateTarget: chromeBrowserAdapter.activateTarget });
    const { commit, identity } = await f.open();
    const pending = f.runtime(commit, identity);
    await closeStarted.promise;
    if (departure === 'source-return' || departure === 'source-tab') {
      focused = 10; f.windowFocus(10);
      if (departure === 'source-tab') f.tabActivated({ tabId: 3, windowId: 10 });
    }
    closeGate.resolve();
    if (departure === 'late-return' || departure === 'target-then-source') {
      await activationStarted.promise;
      if (departure === 'target-then-source') { focused = 20; f.windowFocus(20); }
      focused = 10; f.windowFocus(10);
    }
    activationGate.resolve();
    const cancelled = departure === 'source-tab' || departure === 'target-then-source';
    expect(await pending).toEqual(cancelled ? { ok: false, error: 'Peek session expired.' } : { ok: true });
    expect(focused).toBe(cancelled ? 10 : 20);
    if (cancelled) expect(focus).not.toHaveBeenCalled();
    if (departure === 'source-tab') expect(activate).not.toHaveBeenCalled();
  });

  it.each([
    ['overlay', 30], ['overlay', -1], ['fallback', 30], ['fallback', -1],
  ] as const)('honors observed departure during %s teardown acknowledgement: %s', async (kind, departure) => {
    const gate = deferred<void>();
    const issued = deferred<void>();
    const activate = vi.fn(async () => ({ id: 2, windowId: 20 }));
    const focus = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', {
      tabs: { sendMessage: async () => { issued.resolve(); await gate.promise; }, update: activate },
      windows: {
        remove: async () => { issued.resolve(); await gate.promise; },
        // Deliberately stale source-focused snapshot: observed departure wins.
        getLastFocused: async () => ({ id: 10, focused: true }), update: focus,
      },
    });
    const f = setup({ dismissOverlay: chromeBrowserAdapter.dismissOverlay, dismissFallback: chromeBrowserAdapter.dismissFallback, activateTarget: chromeBrowserAdapter.activateTarget });
    let id: string, identity: FallbackSender;
    if (kind === 'fallback') ({ id, identity } = await f.open());
    else { f.source.url = 'https://ordinary.test'; id = (await f.invoke()).sessionId; identity = { tabId: 1, windowId: 10 }; }
    const commit = f.runtime({ kind: 'peek/commit', sessionId: id, targetTabId: 2, targetWindowId: 20 }, identity);
    await issued.promise;
    f.windowFocus(departure);
    gate.resolve();
    expect(await commit).toEqual({ ok: false, error: 'Peek session expired.' });
    expect(activate).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it.each([{ windowId: 30, focused: true }, { windowId: 10, focused: false }])('rejects an unsafe post-close focus readback without waiting for its event: %j', async returned => {
    const f = setup({ dismissFallback: async () => returned });
    const { commit, identity } = await f.open();
    expect(await f.runtime(commit, identity)).toEqual({ ok: false, error: 'Peek session expired.' });
    expect(f.adapter.activateTarget).not.toHaveBeenCalled();
  });

  it("acknowledges automatic post-close source focus before starting the cancellable target chain", async () => {
    let queuedSourceFocus = false;
    const calls: string[] = [];
    const f = setup({ dismissFallback: chromeBrowserAdapter.dismissFallback, activateTarget: chromeBrowserAdapter.activateTarget });
    const deliverSourceFocus = () => {
      if (queuedSourceFocus) { queuedSourceFocus = false; f.windowFocus(10); calls.push('source-focus'); }
    };
    vi.stubGlobal('chrome', {
      windows: {
        async remove() { queuedSourceFocus = true; },
        async getLastFocused() { deliverSourceFocus(); return { id: 10, focused: true }; },
        async update(id: number) { calls.push(`focus-${id}`); },
      },
      tabs: { async update() { calls.push('activate'); deliverSourceFocus(); return { id: 2, windowId: 20 }; } },
    });
    const { commit, identity } = await f.open();
    expect(await f.runtime(commit, identity)).toEqual({ ok: true });
    expect(calls).toEqual(['source-focus', 'activate', 'focus-20']);
  });

  it.each(["overlay", "fallback"])("keeps cancellation authority through pending activation in %s", async (kind) => {
    const activated = deferred<chrome.tabs.Tab>();
    const started = deferred<void>();
    const update = vi.fn(async () => undefined);
    vi.stubGlobal("chrome", { tabs: { update: () => { started.resolve(); return activated.promise; } }, windows: { update } });
    const f = setup({ activateTarget: chromeBrowserAdapter.activateTarget });
    let id: string;
    let identity: FallbackSender;
    if (kind === "fallback") ({ id, identity } = await f.open());
    else {
      f.source.url = "https://ordinary.test";
      id = (await f.invoke()).sessionId;
      identity = { tabId: 1, windowId: 10 };
    }
    const switching = f.runtime({ kind: "peek/commit", sessionId: id, targetTabId: 2, targetWindowId: 20 }, identity);
    await started.promise;
    await f.runtime({ kind: "peek/cancel", sessionId: id }, identity);
    activated.resolve({ id: 2, windowId: 20 } as chrome.tabs.Tab);
    expect(await switching).toEqual({ ok: false, error: "Peek session expired." });
    expect(update).not.toHaveBeenCalled();
  });

  it("expires ordinary pending model delivery through the registered external focus event", async () => {
    const listed = deferred<readonly never[]>();
    const started = deferred<void>();
    const f = setup({ listEligibleTabs: () => { started.resolve(); return listed.promise; } });
    f.source.url = "https://ordinary.test";
    const invocation = f.invoke();
    await started.promise;
    f.windowFocus(99);
    listed.resolve([]);
    await invocation;
    expect(f.adapter.dismissOverlay).toHaveBeenCalledOnce();
    expect(f.adapter.updateOverlay).not.toHaveBeenCalled();
    expect(f.adapter.activateTarget).not.toHaveBeenCalled();
  });

  it("uses fallback for denied file capability and overlay for granted file capability", async () => {
    const denied = setup({ fileSchemeAccessAllowed: vi.fn(async () => false) });
    denied.source.url = "file:///synthetic/source.html";
    await denied.open();
    expect(denied.adapter.openOverlay).not.toHaveBeenCalled();
    expect(denied.adapter.presentFallback).toHaveBeenCalledOnce();
    const granted = setup();
    granted.source.url = "file:///synthetic/source.html";
    await granted.invoke();
    expect(granted.adapter.openOverlay).toHaveBeenCalledOnce();
    expect(granted.adapter.presentFallback).not.toHaveBeenCalled();
  });

  it("does not revive a file invocation when capability resolution follows an observed focus departure", async () => {
    const permission = deferred<boolean>();
    const f = setup({ fileSchemeAccessAllowed: () => permission.promise });
    f.source.url = "file:///synthetic/source.html";
    const invocation = f.invoke();
    f.windowFocus(99);
    permission.resolve(false);
    await invocation;
    expect(f.adapter.presentFallback).not.toHaveBeenCalled();
    expect(f.adapter.openOverlay).not.toHaveBeenCalled();
  });

  it("rejects subframe readiness without pinning it, and rejects subframe mounted acknowledgement", async () => {
    const f = setup();
    const invocation = f.invoke();
    const id = await f.created.promise;
    const identity = f.sender(id);
    expect(await f.runtime({ kind: "peek/fallback-ready", sessionId: id }, { ...identity, frameId: 1, documentId: "subframe" })).toBeUndefined();
    expect(await f.runtime({ kind: "peek/fallback-ready", sessionId: id }, identity)).toMatchObject({ sourceTabId: 1 });
    await f.runtime({ kind: "peek/fallback-mounted", sessionId: id }, { ...identity, frameId: 1 });
    expect(f.adapter.presentFallback).not.toHaveBeenCalled();
    await f.runtime({ kind: "peek/fallback-mounted", sessionId: id }, identity);
    await invocation;
    expect(f.adapter.presentFallback).toHaveBeenCalledOnce();
  });

  it.each([99, -1])("does not let a stale focused snapshot reverse observed focus departure to %s", async (windowId) => {
    const snapshot = deferred<chrome.windows.Window>();
    const get = vi.fn(() => snapshot.promise);
    const update = vi.fn(async () => undefined);
    vi.stubGlobal("chrome", { windows: { get, update } });
    const f = setup({ presentFallback: chromeBrowserAdapter.presentFallback });
    const opened = f.open();
    await vi.waitFor(() => expect(get).toHaveBeenCalled());
    f.windowFocus(windowId);
    snapshot.resolve({ id: 10, focused: true, tabs: [{ id: 1, active: true }] } as chrome.windows.Window);
    await opened;
    expect(update).not.toHaveBeenCalled();
    expect(f.adapter.dismissFallback).toHaveBeenCalledWith(91);
  });

  it("invalidates pending presentation when source-tab activation overtakes its query snapshot", async () => {
    const snapshot = deferred<chrome.windows.Window>();
    const get = vi.fn(() => snapshot.promise);
    const update = vi.fn(async () => undefined);
    vi.stubGlobal("chrome", { windows: { get, update } });
    const f = setup({ presentFallback: chromeBrowserAdapter.presentFallback });
    const opened = f.open();
    await vi.waitFor(() => expect(get).toHaveBeenCalled());
    f.tabActivated({ tabId: 99, windowId: 10 });
    snapshot.resolve({ id: 10, focused: true, tabs: [{ id: 1, active: true }] } as chrome.windows.Window);
    await opened;
    expect(update).not.toHaveBeenCalled();
    expect(f.adapter.dismissFallback).toHaveBeenCalledWith(91);
  });

  it("allows unchanged-source and expected own-popup focus events during presentation", async () => {
    const f = setup({ presentFallback: chromeBrowserAdapter.presentFallback });
    const update = vi.fn(async () => { f.windowFocus(91); });
    vi.stubGlobal("chrome", { windows: {
      get: vi.fn(async () => { f.windowFocus(10); return { focused: true, tabs: [{ id: 1, active: true }] }; }), update,
    } });
    await f.open();
    expect(update).toHaveBeenCalledWith(91, { focused: true });
    expect(f.adapter.dismissFallback).not.toHaveBeenCalled();
    expect(f.adapter.updateFallback).toHaveBeenCalledOnce();
  });

  it("delivers previous preselection from the source user context, never the transient UI context", async () => {
    const f = setup();
    await f.open();
    expect(f.adapter.updateFallback).toHaveBeenCalledWith(expect.objectContaining({ model: {
      status: "ready", tabs: [expect.objectContaining({ id: 1, current: true, previous: false }), expect.objectContaining({ id: 2, current: false, previous: true })],
    } }));
    expect(f.adapter.activateTarget).not.toHaveBeenCalled();
  });

  it("rejects unrelated, navigated, cross-extension and subframe senders at the actual message route", async () => {
    const f = setup();
    const { id, identity, commit } = await f.open();
    for (const spoof of [
      { ...identity, tabId: 1 }, { ...identity, windowId: 999 },
      { ...identity, url: `chrome-extension://other/fallback.html#${id}` },
      { ...identity, url: `https://ordinary.test/#${id}` },
      { ...identity, frameId: 1 }, { ...identity, documentId: "navigated-document" },
    ]) {
      await f.runtime({ kind: "peek/cancel", sessionId: id }, spoof);
      expect(await f.runtime(commit, spoof)).toEqual({ ok: false, error: "Peek session expired." });
    }
    expect(f.adapter.dismissFallback).not.toHaveBeenCalled();
    expect(await f.runtime(commit, identity)).toEqual({ ok: true });
    expect(f.adapter.activateTarget).toHaveBeenCalledWith({ id: 2, windowId: 20, current: false }, expect.any(Function));
  });

  it("does not activate after unexpected teardown failure and leaves the error recoverable", async () => {
    const f = setup({ dismissFallback: vi.fn(async () => { throw new Error("backend unavailable"); }) });
    const { identity, commit } = await f.open();
    expect(await f.runtime(commit, identity)).toEqual({ ok: false, error: "Peek could not switch to that tab." });
    expect(f.adapter.activateTarget).not.toHaveBeenCalled();
    vi.mocked(f.adapter.dismissFallback).mockResolvedValue({ windowId: 10, focused: true });
    expect(await f.runtime(commit, identity)).toEqual({ ok: true });
  });

  it("allows its own acknowledged removal during commit but not a prior browser-close", async () => {
    const f = setup();
    const { identity, commit } = await f.open();
    vi.mocked(f.adapter.dismissFallback).mockImplementation(async (id) => { f.windowRemoved(id); f.windowFocus(20); return { windowId: 20, focused: true }; });
    expect(await f.runtime(commit, identity)).toEqual({ ok: true });
    expect(f.adapter.activateTarget).toHaveBeenCalledOnce();
  });

  it("keeps current-source commit a history no-op without tab activation", async () => {
    const f = setup({ revalidateTarget: vi.fn(async (id, windowId) => ({ id, windowId, current: true })) });
    const { identity, commit } = await f.open();
    const history = vi.mocked(f.adapter.saveAttentionState).mock.calls.slice();
    expect(await f.runtime({ ...commit, targetTabId: 1, targetWindowId: 10 }, identity)).toEqual({ ok: true });
    expect(f.adapter.activateTarget).not.toHaveBeenCalled();
    expect(vi.mocked(f.adapter.saveAttentionState).mock.calls).toEqual(history);
  });

  it("explicitly reactivates the source tab if another tab became active behind the fallback", async () => {
    let activeTabId = 1;
    const f = setup({
      revalidateTarget: vi.fn(async (id, windowId) => ({ id, windowId, current: activeTabId === id })),
      activateTarget: vi.fn(async (target) => { activeTabId = target.id; }),
    });
    const { identity, commit } = await f.open();
    activeTabId = 99;
    expect(await f.runtime({ ...commit, targetTabId: 1, targetWindowId: 10 }, identity)).toEqual({ ok: true });
    expect(activeTabId).toBe(1);
    expect(f.adapter.activateTarget).toHaveBeenCalledExactlyOnceWith({ id: 1, windowId: 10, current: false }, expect.any(Function));
  });

  it.each(["revalidation", "teardown"])("cancellation wins during deferred %s", async (stage) => {
    const started = deferred<void>();
    const target = deferred<TargetTab>();
    const teardown = deferred<void>();
    const f = setup();
    const { id, identity, commit } = await f.open();
    if (stage === "revalidation") vi.mocked(f.adapter.revalidateTarget).mockImplementation(() => { started.resolve(); return target.promise; });
    else vi.mocked(f.adapter.dismissFallback).mockImplementationOnce(() => { started.resolve(); return teardown.promise; });
    const pending = f.runtime(commit, identity);
    await started.promise;
    await f.app.cancel({ kind: "peek/cancel", sessionId: id }, identity);
    target.resolve({ id: 2, windowId: 20, current: false });
    teardown.resolve();
    expect(await pending).toEqual({ ok: false, error: "Peek session expired." });
    expect(f.adapter.activateTarget).not.toHaveBeenCalled();
  });

  it("times out pending creation and closes its eventual window without ever focusing it", async () => {
    vi.useFakeTimers();
    const creation = deferred<FallbackSurface>();
    const started = deferred<void>();
    const f = setup({ createFallback: async () => { started.resolve(); return creation.promise; } });
    const invocation = f.invoke();
    await started.promise;
    await vi.advanceTimersByTimeAsync(10_000);
    creation.resolve(f.surface);
    await invocation;
    expect(f.adapter.dismissFallback).toHaveBeenCalledExactlyOnceWith(91);
    expect(f.adapter.presentFallback).not.toHaveBeenCalled();
    expect(f.adapter.updateFallback).not.toHaveBeenCalled();
  });

  it("bounds missing UI readiness and rejects late readiness for the closed window", async () => {
    vi.useFakeTimers();
    const f = setup();
    const invocation = f.invoke();
    const id = await f.created.promise;
    await vi.advanceTimersByTimeAsync(10_000);
    await invocation;
    expect(f.adapter.dismissFallback).toHaveBeenCalledExactlyOnceWith(91);
    expect(await f.runtime({ kind: "peek/fallback-ready", sessionId: id }, f.sender(id))).toBeUndefined();
    expect(f.adapter.presentFallback).not.toHaveBeenCalled();
  });

  it("handles a browser close delivered before window registration", async () => {
    const creation = deferred<FallbackSurface>();
    const started = deferred<void>();
    const f = setup({ createFallback: async () => { started.resolve(); return creation.promise; } });
    const invocation = f.invoke();
    await started.promise;
    f.windowRemoved(91);
    creation.resolve(f.surface);
    await invocation;
    expect(f.adapter.presentFallback).not.toHaveBeenCalled();
    expect(f.adapter.updateFallback).not.toHaveBeenCalled();
  });

  it("closes a late-created UI when its source was removed during creation", async () => {
    const creation = deferred<FallbackSurface>();
    const started = deferred<void>();
    const f = setup({ createFallback: async () => { started.resolve(); return creation.promise; } });
    const invocation = f.invoke();
    await started.promise;
    f.app.removeTabFromAttention(1);
    creation.resolve(f.surface);
    await invocation;
    expect(f.adapter.dismissFallback).toHaveBeenCalledExactlyOnceWith(91);
    expect(f.adapter.presentFallback).not.toHaveBeenCalled();
  });

  it("closes the registered window if its presentation API fails", async () => {
    const f = setup({ presentFallback: vi.fn(async () => { throw new Error("source window gone"); }) });
    await expect(f.open()).rejects.toThrow("source window gone");
    expect(f.adapter.dismissFallback).toHaveBeenCalledExactlyOnceWith(91);
    expect(f.adapter.activateTarget).not.toHaveBeenCalled();
  });

  it("does not close a replacement or activate after supersession during deferred teardown", async () => {
    const pendingClose = deferred<void>();
    const closeStarted = deferred<void>();
    const replacementCreated = deferred<string>();
    const f = setup();
    const first = await f.open();
    vi.mocked(f.adapter.dismissFallback).mockImplementationOnce(() => { closeStarted.resolve(); return pendingClose.promise; });
    const oldCommit = f.runtime(first.commit, first.identity);
    await closeStarted.promise;
    f.adapter.createFallback = async (_source, id) => { replacementCreated.resolve(id); return { tabId: 92, windowId: 93 }; };
    const replacement = f.invoke();
    const id = await replacementCreated.promise;
    const identity = { ...f.sender(id), tabId: 92, windowId: 93, documentId: "doc-92" };
    await f.runtime({ kind: "peek/fallback-ready", sessionId: id }, identity);
    await f.runtime({ kind: "peek/fallback-mounted", sessionId: id }, identity);
    await replacement;
    pendingClose.resolve();
    expect(await oldCommit).toEqual({ ok: false, error: "Peek session expired." });
    expect(f.adapter.activateTarget).not.toHaveBeenCalled();
    expect(f.adapter.dismissFallback).not.toHaveBeenCalledWith(93);
    expect(await f.runtime({ ...first.commit, sessionId: id }, identity)).toEqual({ ok: true });
  });

  it("closes when the source loses focus before presentation rather than stealing focus back", async () => {
    const f = setup({ presentFallback: vi.fn(async () => false) });
    await f.open();
    expect(f.adapter.dismissFallback).toHaveBeenCalledExactlyOnceWith(91);
    expect(f.adapter.updateFallback).not.toHaveBeenCalled();
    expect(f.adapter.activateTarget).not.toHaveBeenCalled();
  });
});
