import { beforeEach, describe, expect, it, vi } from "vitest";
import { chromeBrowserAdapter } from "../src/background/chrome-browser-adapter";

const getAll = vi.fn();
const getTab = vi.fn();
const getWindow = vi.fn();
const updateTab = vi.fn();
const updateWindow = vi.fn();
const executeScript = vi.fn();
const sendMessage = vi.fn();
const getStorage = vi.fn();
const setStorage = vi.fn();
const getLastFocused = vi.fn();
const createWindow = vi.fn();
const removeWindow = vi.fn();
const runtimeSendMessage = vi.fn();
const isAllowedFileSchemeAccess = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("chrome", {
    runtime: { id: "peek-extension", getURL: (path: string) => `chrome-extension://peek-extension/${path}`, sendMessage: runtimeSendMessage },
    windows: { getAll, get: getWindow, getLastFocused, update: updateWindow, create: createWindow, remove: removeWindow },
    tabs: { get: getTab, update: updateTab, sendMessage },
    scripting: { executeScript },
    extension: { isAllowedFileSchemeAccess },
    storage: { session: { get: getStorage, set: setStorage } },
  });
});

describe("Chrome browser adapter", () => {
  it("does not send late init after cancellation during script injection", async () => {
    let release!: () => void;
    executeScript.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    let current = true;
    const opening = chromeBrowserAdapter.openOverlay({ id: 10, windowId: 1 }, {
      kind: "peek/init", sessionId: "pending", sourceTabId: 10, sourceWindowId: 1,
      model: { status: "loading", tabs: [] },
    }, () => current);
    current = false;
    release();
    await opening;
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("dismisses only its own late init when cancellation crosses the send boundary", async () => {
    executeScript.mockResolvedValue([]);
    getWindow.mockResolvedValue({ focused: true, tabs: [{ id: 10, active: true }] });
    let current = true;
    sendMessage.mockImplementationOnce(async () => { current = false; });
    await chromeBrowserAdapter.openOverlay({ id: 10, windowId: 1 }, {
      kind: "peek/init", sessionId: "pending-send", sourceTabId: 10, sourceWindowId: 1,
      model: { status: "loading", tabs: [] },
    }, () => current);
    expect(sendMessage.mock.calls[1]).toEqual([10, { kind: "peek/dismiss", sessionId: "pending-send" }]);
  });

  it("never focuses a window after cancellation during exact tab activation", async () => {
    let release!: (tab: unknown) => void;
    updateTab.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    let current = true;
    const activation = chromeBrowserAdapter.activateTarget({ id: 21, windowId: 7, current: false }, () => current);
    current = false;
    release({ id: 21, windowId: 7 });
    await activation;
    expect(updateWindow).not.toHaveBeenCalled();
  });

  it("does not focus the stale containing window when the activated target has moved", async () => {
    updateTab.mockResolvedValue({ id: 21, windowId: 8 });
    await expect(chromeBrowserAdapter.activateTarget({ id: 21, windowId: 7, current: false }, () => true)).rejects.toThrow("target changed");
    expect(updateWindow).not.toHaveBeenCalled();
  });

  it.each([true, false])("reads Chrome file-scheme capability without changing the grant (%s)", async (allowed) => {
    isAllowedFileSchemeAccess.mockResolvedValue(allowed);
    await expect(chromeBrowserAdapter.fileSchemeAccessAllowed()).resolves.toBe(allowed);
    expect(isAllowedFileSchemeAccess).toHaveBeenCalledOnce();
  });

  it("excludes per-tab incognito entries, non-normal windows and Peek's own pages from listing", async () => {
    getAll.mockResolvedValue([
      {
        id: 1, type: "normal", incognito: false,
        tabs: [
          { id: 10, windowId: 1, title: "Source", url: "https://source.test", lastAccessed: 4, active: true, incognito: false },
          { id: 11, windowId: 1, title: "Peek", url: "chrome-extension://peek-extension/fallback.html", incognito: false },
          { id: 12, windowId: 1, title: "Private tab", url: "https://private-tab.test", incognito: true },
        ],
      },
      { id: 2, type: "normal", incognito: true, tabs: [{ id: 20, windowId: 2, title: "Private", url: "https://private.test", incognito: true }] },
      { id: 3, type: "popup", incognito: false, tabs: [{ id: 30, windowId: 3, title: "Popup", url: "https://popup.test", incognito: false }] },
    ]);

    const tabs = await chromeBrowserAdapter.listEligibleTabs({ id: 10, windowId: 1 });
    expect(getAll).toHaveBeenCalledWith({ populate: true, windowTypes: ["normal"] });
    expect(tabs).toEqual([{ id: 10, windowId: 1, title: "Source", url: "https://source.test", lastAccessed: 4, current: true }]);
  });

  it("persists only the validated attention payload in extension session storage", async () => {
    getStorage.mockResolvedValue({ peekAttentionV1: { version: 1, current: { tabId: 10, windowId: 1 } } });
    await expect(chromeBrowserAdapter.loadAttentionState()).resolves.toEqual({ version: 1, current: { tabId: 10, windowId: 1 } });
    const state = { version: 1 as const, current: { tabId: 10, windowId: 1 } };
    await chromeBrowserAdapter.saveAttentionState(state);
    expect(setStorage).toHaveBeenCalledWith({ peekAttentionV1: state });
  });

  it("observes only an active tab in the actually focused eligible window", async () => {
    getWindow.mockResolvedValue({
      id: 1, type: "normal", incognito: false, focused: true,
      tabs: [{ id: 10, windowId: 1, active: true, incognito: false, url: "https://source.test" }],
    });
    getTab.mockResolvedValue({ id: 10, windowId: 1, active: true, incognito: false, url: "https://source.test" });
    await expect(chromeBrowserAdapter.resolveFocusedAttention(1, 10)).resolves.toEqual({ tabId: 10, windowId: 1 });

    getWindow.mockResolvedValue({ id: 1, type: "normal", incognito: false, focused: false, tabs: [] });
    await expect(chromeBrowserAdapter.resolveFocusedAttention(1, 10)).resolves.toBeUndefined();

    getWindow.mockResolvedValue({ id: 1, type: "normal", incognito: false, focused: true, tabs: [] });
    getTab.mockResolvedValue({ id: 11, windowId: 1, active: true, incognito: false, url: "chrome-extension://peek-extension/fallback.html" });
    await expect(chromeBrowserAdapter.resolveFocusedAttention(1, 11)).resolves.toBeUndefined();
  });

  it("resolves the visible active tab when a normal window gains focus", async () => {
    getWindow.mockResolvedValue({
      id: 7, type: "normal", incognito: false, focused: true,
      tabs: [{ id: 21, windowId: 7, active: true, incognito: false, url: "https://target.test" }],
    });
    await expect(chromeBrowserAdapter.resolveFocusedAttention(7)).resolves.toEqual({ tabId: 21, windowId: 7 });
    expect(getWindow).toHaveBeenCalledWith(7, { populate: true });
  });

  it("injects only the active top-level tab before delivering its complete model", async () => {
    executeScript.mockResolvedValue([]);
    sendMessage.mockResolvedValue({ ok: true });
    const message = {
      kind: "peek/init" as const,
      sessionId: "s",
      sourceTabId: 10,
      sourceWindowId: 1,
      model: { status: "ready" as const, tabs: [] },
    };
    getWindow.mockResolvedValue({ focused: true, tabs: [{ id: 10, active: true }] });
    await chromeBrowserAdapter.openOverlay({ id: 10, windowId: 1 }, message, () => true);
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 10 }, files: ["overlay.js"] });
    expect(sendMessage).toHaveBeenCalledWith(10, message);
    expect(executeScript.mock.invocationCallOrder[0]).toBeLessThan(sendMessage.mock.invocationCallOrder[0]!);
  });

  it("creates a centred transient extension window and returns its exact provenance", async () => {
    getWindow.mockResolvedValue({ id: 4, left: 100, top: 50, width: 1200, height: 800 });
    createWindow.mockResolvedValue({ id: 91, tabs: [{ id: 90, windowId: 91 }] });

    await expect(chromeBrowserAdapter.createFallback({ id: 10, windowId: 4 }, "session / one")).resolves.toEqual({ tabId: 90, windowId: 91 });
    expect(createWindow).toHaveBeenCalledWith({
      url: "chrome-extension://peek-extension/fallback.html#session%20%2F%20one",
      type: "popup",
      focused: false,
      width: 720,
      height: 320,
      left: 340,
      top: 290,
    });
  });

  it("lets Chrome place the popup visibly only for its exact off-screen bounds rejection", async () => {
    getWindow.mockResolvedValue({ id: 4, left: 1225, top: 41, width: 500, height: 906 });
    createWindow.mockRejectedValueOnce(new Error("Invalid value for bounds. Bounds must be at least 50% within visible screen space."))
      .mockResolvedValueOnce({ id: 91, tabs: [{ id: 90 }] });
    await expect(chromeBrowserAdapter.createFallback({ id: 10, windowId: 4 }, "s")).resolves.toEqual({ tabId: 90, windowId: 91 });
    expect(createWindow.mock.calls[0]?.[0]).toMatchObject({ left: 1225, top: 334, focused: false });
    expect(createWindow.mock.calls[1]?.[0]).toEqual({ url: "chrome-extension://peek-extension/fallback.html#s", type: "popup", focused: false, width: 500, height: 320 });
  });

  it("does not retry or mask an arbitrary popup creation failure", async () => {
    getWindow.mockResolvedValue({ id: 4, left: 100, top: 50, width: 1200, height: 800 });
    createWindow.mockRejectedValue(new Error("backend unavailable"));
    await expect(chromeBrowserAdapter.createFallback({ id: 10, windowId: 4 }, "s")).rejects.toThrow("backend unavailable");
    expect(createWindow).toHaveBeenCalledOnce();
  });

  it("routes fallback model delivery through extension messaging and makes teardown idempotent", async () => {
    runtimeSendMessage.mockResolvedValue(undefined);
    removeWindow.mockRejectedValue(new Error("No window with id: 91."));
    getLastFocused.mockResolvedValue({ id: 4, focused: true });
    const message = { kind: "peek/model" as const, sessionId: "s", model: { status: "ready" as const, tabs: [] } };
    await chromeBrowserAdapter.updateFallback(message);
    await expect(chromeBrowserAdapter.dismissFallback(91)).resolves.toEqual({ windowId: 4, focused: true });
    expect(runtimeSendMessage).toHaveBeenCalledWith(message);
    expect(removeWindow).toHaveBeenCalledWith(91);
  });

  it("propagates unexpected fallback close failures rather than pretending teardown succeeded", async () => {
    removeWindow.mockRejectedValue(new Error("backend unavailable"));
    await expect(chromeBrowserAdapter.dismissFallback(91)).rejects.toThrow("backend unavailable");
    removeWindow.mockRejectedValue(new Error("No window with id: 92."));
    await expect(chromeBrowserAdapter.dismissFallback(91)).rejects.toThrow("No window with id: 92.");
  });

  it("focuses a ready fallback only while its source is still active and its session is current", async () => {
    const source = { id: 10, windowId: 4 };
    const surface = { tabId: 90, windowId: 91 };
    getWindow.mockResolvedValue({ focused: true, tabs: [{ id: 10, active: true }] });
    await expect(chromeBrowserAdapter.presentFallback(source, surface, () => false)).resolves.toBe(false);
    expect(updateWindow).not.toHaveBeenCalled();
    getWindow.mockResolvedValue({ focused: false, tabs: [{ id: 10, active: true }] });
    await expect(chromeBrowserAdapter.presentFallback(source, surface, () => true)).resolves.toBe(false);
    expect(updateWindow).not.toHaveBeenCalled();
    getWindow.mockResolvedValue({ focused: true, tabs: [{ id: 10, active: true }] });
    await expect(chromeBrowserAdapter.presentFallback(source, surface, () => true)).resolves.toBe(true);
    expect(updateWindow).toHaveBeenCalledExactlyOnceWith(91, { focused: true });
  });

  it("revalidates exact tab and window identity and rejects incognito targets", async () => {
    getTab.mockResolvedValue({ id: 21, windowId: 7, active: false, incognito: false, url: "https://target.test" });
    getWindow.mockResolvedValue({ id: 7, type: "normal", incognito: false });
    await expect(chromeBrowserAdapter.revalidateTarget(21, 7)).resolves.toEqual({ id: 21, windowId: 7, current: false });

    getWindow.mockResolvedValue({ id: 7, type: "normal", incognito: true });
    await expect(chromeBrowserAdapter.revalidateTarget(21, 7)).resolves.toBeUndefined();
  });

  it("rejects Peek's own extension URL during exact target revalidation", async () => {
    getTab.mockResolvedValue({
      id: 21,
      windowId: 7,
      active: false,
      incognito: false,
      url: "chrome-extension://peek-extension/fallback.html",
    });
    getWindow.mockResolvedValue({ id: 7, type: "normal", incognito: false });

    await expect(chromeBrowserAdapter.revalidateTarget(21, 7)).resolves.toBeUndefined();
  });

  it("activates the exact tab before focusing its containing window", async () => {
    updateTab.mockResolvedValue({ id: 21, windowId: 7 });
    updateWindow.mockResolvedValue({});
    await chromeBrowserAdapter.activateTarget({ id: 21, windowId: 7, current: false }, () => true);
    expect(updateTab).toHaveBeenCalledWith(21, { active: true });
    expect(updateWindow).toHaveBeenCalledWith(7, { focused: true });
    expect(updateTab.mock.invocationCallOrder[0]).toBeLessThan(updateWindow.mock.invocationCallOrder[0]!);
  });
});
