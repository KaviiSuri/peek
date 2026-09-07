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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("chrome", {
    runtime: { id: "peek-extension" },
    windows: { getAll, get: getWindow, getLastFocused, update: updateWindow },
    tabs: { get: getTab, update: updateTab, sendMessage },
    scripting: { executeScript },
    storage: { session: { get: getStorage, set: setStorage } },
  });
});

describe("Chrome browser adapter", () => {
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
    await chromeBrowserAdapter.openOverlay({ id: 10, windowId: 1 }, message);
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 10 }, files: ["overlay.js"] });
    expect(sendMessage).toHaveBeenCalledWith(10, message);
    expect(executeScript.mock.invocationCallOrder[0]).toBeLessThan(sendMessage.mock.invocationCallOrder[0]!);
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
    updateTab.mockResolvedValue({});
    updateWindow.mockResolvedValue({});
    await chromeBrowserAdapter.activateTarget({ id: 21, windowId: 7, current: false });
    expect(updateTab).toHaveBeenCalledWith(21, { active: true });
    expect(updateWindow).toHaveBeenCalledWith(7, { focused: true });
    expect(updateTab.mock.invocationCallOrder[0]).toBeLessThan(updateWindow.mock.invocationCallOrder[0]!);
  });
});
