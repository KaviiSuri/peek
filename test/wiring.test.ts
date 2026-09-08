import { describe, expect, it, vi } from "vitest";
import { registerBackground } from "../src/background/wiring";
import type { BackgroundApp } from "../src/background/app";

function setup(report = vi.fn()) {
  let actionListener: ((tab: chrome.tabs.Tab) => void) | undefined;
  let messageListener: ((message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => boolean | undefined) | undefined;
  let activatedListener: ((info: chrome.tabs.OnActivatedInfo) => void) | undefined;
  let removedListener: ((tabId: number) => void) | undefined;
  let focusedListener: ((windowId: number) => void) | undefined;
  let windowRemovedListener: ((windowId: number) => void) | undefined;
  const app: BackgroundApp = {
    start: vi.fn(),
    observeTabActivation: vi.fn(),
    observeWindowFocus: vi.fn(),
    removeTabFromAttention: vi.fn(),
    observeWindowRemoved: vi.fn(),
    invoke: vi.fn(async () => ({ sessionId: "s", model: { status: "ready" as const, tabs: [] } })),
    fallbackReady: vi.fn(async () => undefined),
    fallbackMounted: vi.fn(),
    commit: vi.fn(async () => ({ ok: true as const })),
    cancel: vi.fn(async () => undefined),
  };
  registerBackground({
    onActionClicked: { addListener(listener) { actionListener = listener; } },
    onMessage: { addListener(listener) { messageListener = listener as typeof messageListener; } },
    onTabActivated: { addListener(listener) { activatedListener = listener; } },
    onTabRemoved: { addListener(listener) { removedListener = listener as (tabId: number) => void; } },
    onWindowFocusChanged: { addListener(listener) { focusedListener = listener; } },
    onWindowRemoved: { addListener(listener) { windowRemovedListener = listener; } },
  }, app, report);
  return {
    app,
    actionListener: () => actionListener!,
    messageListener: () => messageListener!,
    activatedListener: () => activatedListener!,
    removedListener: () => removedListener!,
    focusedListener: () => focusedListener!,
    windowRemovedListener: () => windowRemovedListener!,
  };
}

describe("synchronous MV3 wiring", () => {
  it.each([true, false])('new invocation owns global action status when old failure=%s settles last', async oldFails => {
    let resolve!: (value: Awaited<ReturnType<BackgroundApp['invoke']>>) => void, reject!: (error: Error) => void;
    const old = new Promise<Awaited<ReturnType<BackgroundApp['invoke']>>>((yes, no) => { resolve = yes; reject = no; });
    const report = vi.fn(), wired = setup(report);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const success = { sessionId: 's', model: { status: 'ready' as const, tabs: [] } };
    vi.mocked(wired.app.invoke).mockReturnValueOnce(old);
    if (oldFails) vi.mocked(wired.app.invoke).mockResolvedValueOnce(success);
    else vi.mocked(wired.app.invoke).mockRejectedValueOnce(new Error('current failure'));
    wired.actionListener()({ id: 1, windowId: 10 } as chrome.tabs.Tab);
    wired.actionListener()({ id: 2, windowId: 20 } as chrome.tabs.Tab);
    await Promise.resolve();
    if (oldFails) reject(new Error('obsolete failure')); else resolve(success);
    await Promise.resolve();
    errorLog.mockRestore();
    expect(report).toHaveBeenCalledExactlyOnceWith(2, !oldFails);
  });

  it('does not let an obsolete commit callback overwrite a newer invocation status', async () => {
    let resolve!: (value: Awaited<ReturnType<BackgroundApp['commit']>>) => void;
    const old = new Promise<Awaited<ReturnType<BackgroundApp['commit']>>>(yes => { resolve = yes; });
    const report = vi.fn(), wired = setup(report), respond = vi.fn();
    wired.actionListener()({ id: 1, windowId: 10 } as chrome.tabs.Tab);
    await Promise.resolve(); report.mockClear();
    vi.mocked(wired.app.commit).mockReturnValueOnce(old);
    wired.messageListener()({ kind: 'peek/commit', sessionId: 's', targetTabId: 3, targetWindowId: 30 }, { tab: { id: 1 } as chrome.tabs.Tab }, respond);
    wired.actionListener()({ id: 2, windowId: 20 } as chrome.tabs.Tab);
    await Promise.resolve();
    resolve({ ok: false, error: 'Peek could not switch to that tab.' });
    await Promise.resolve();
    expect(respond).toHaveBeenCalledWith({ ok: false, error: 'Peek could not switch to that tab.' });
    expect(report).toHaveBeenCalledExactlyOnceWith(2, false);
  });

  it("reports a non-focusing action error after failed switching but not after cancellation", async () => {
    const report = vi.fn();
    const wired = setup(report);
    const response = vi.fn();
    const message = { kind: "peek/commit", sessionId: "s", targetTabId: 2, targetWindowId: 3 };
    const sender = { tab: { id: 1 } as chrome.tabs.Tab };
    vi.mocked(wired.app.commit).mockResolvedValueOnce({ ok: false, error: "Peek could not switch to that tab." });
    wired.messageListener()(message, sender, response);
    await Promise.resolve();
    expect(report).toHaveBeenCalledExactlyOnceWith(1, true);
    vi.mocked(wired.app.commit).mockResolvedValueOnce({ ok: false, error: "Peek session expired." });
    wired.messageListener()(message, sender, response);
    await Promise.resolve();
    expect(report).toHaveBeenCalledOnce();
  });

  it("registers action and message listeners before asynchronous work", () => {
    const wired = setup();
    expect(wired.actionListener()).toBeTypeOf("function");
    expect(wired.messageListener()).toBeTypeOf("function");
    expect(wired.activatedListener()).toBeTypeOf("function");
    expect(wired.removedListener()).toBeTypeOf("function");
    expect(wired.focusedListener()).toBeTypeOf("function");
    expect(wired.windowRemovedListener()).toBeTypeOf("function");
  });

  it("routes the action click used by both the icon and reserved _execute_action command", () => {
    const wired = setup();
    wired.actionListener()({ id: 7, windowId: 8, incognito: false } as chrome.tabs.Tab);
    expect(wired.app.invoke).toHaveBeenCalledWith({ id: 7, windowId: 8 });
  });

  it("routes attention events through the synchronously registered owners", () => {
    const wired = setup();
    wired.activatedListener()({ tabId: 7, windowId: 8 });
    wired.focusedListener()(9);
    wired.removedListener()(10);
    wired.windowRemovedListener()(11);
    expect(wired.app.observeTabActivation).toHaveBeenCalledWith(7, 8);
    expect(wired.app.observeWindowFocus).toHaveBeenCalledWith(9);
    expect(wired.app.removeTabFromAttention).toHaveBeenCalledWith(10);
    expect(wired.app.observeWindowRemoved).toHaveBeenCalledWith(11);
  });

  it("validates fallback readiness with extension-page sender provenance", async () => {
    const wired = setup();
    const sendResponse = vi.fn();
    const sender = {
      tab: { id: 90, windowId: 91, url: "chrome-extension://peek-extension/fallback.html#s" } as chrome.tabs.Tab,
      url: "chrome-extension://peek-extension/fallback.html#s",
    };
    expect(wired.messageListener()({ kind: "peek/fallback-ready", sessionId: "s" }, sender, sendResponse)).toBe(true);
    await Promise.resolve();
    expect(wired.app.fallbackReady).toHaveBeenCalledWith("s", { tabId: 90, windowId: 91, url: sender.url });
    wired.messageListener()({ kind: "peek/fallback-mounted", sessionId: "s" }, sender, sendResponse);
    expect(wired.app.fallbackMounted).toHaveBeenCalledWith("s", { tabId: 90, windowId: 91, url: sender.url });
  });

  it("decodes commit messages and keeps malformed messages outside the app", () => {
    const wired = setup();
    const sendResponse = vi.fn();
    expect(wired.messageListener()({ kind: "wrong" }, {}, sendResponse)).toBe(false);
    expect(wired.app.commit).not.toHaveBeenCalled();
    expect(wired.messageListener()({ kind: "peek/commit", sessionId: "s", targetTabId: 2, targetWindowId: 3 }, { tab: { id: 1 } as chrome.tabs.Tab }, sendResponse)).toBe(true);
    expect(wired.app.commit).toHaveBeenCalledWith(expect.objectContaining({ targetTabId: 2, targetWindowId: 3 }), { tabId: 1 });
  });
});
