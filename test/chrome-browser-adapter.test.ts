import { beforeEach, describe, expect, it, vi } from "vitest";
import { chromeBrowserAdapter } from "../src/background/chrome-browser-adapter";

const getAll = vi.fn();
const getTab = vi.fn();
const getWindow = vi.fn();
const updateTab = vi.fn();
const updateWindow = vi.fn();
const executeScript = vi.fn();
const sendMessage = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("chrome", {
    runtime: { id: "peek-extension" },
    windows: { getAll, get: getWindow, update: updateWindow },
    tabs: { get: getTab, update: updateTab, sendMessage },
    scripting: { executeScript },
  });
});

describe("Chrome browser adapter", () => {
  it("lists tabs only from normal non-incognito windows and excludes Peek's own pages", async () => {
    getAll.mockResolvedValue([
      {
        id: 1, type: "normal", incognito: false,
        tabs: [
          { id: 10, windowId: 1, title: "Source", url: "https://source.test", lastAccessed: 4, active: true, incognito: false },
          { id: 11, windowId: 1, title: "Peek", url: "chrome-extension://peek-extension/fallback.html", incognito: false },
        ],
      },
      { id: 2, type: "normal", incognito: true, tabs: [{ id: 20, windowId: 2, title: "Private", url: "https://private.test", incognito: true }] },
      { id: 3, type: "popup", incognito: false, tabs: [{ id: 30, windowId: 3, title: "Popup", url: "https://popup.test", incognito: false }] },
    ]);

    const tabs = await chromeBrowserAdapter.listEligibleTabs({ id: 10, windowId: 1 });
    expect(getAll).toHaveBeenCalledWith({ populate: true, windowTypes: ["normal"] });
    expect(tabs).toEqual([{ id: 10, windowId: 1, title: "Source", url: "https://source.test", lastAccessed: 4, current: true }]);
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

  it("activates the exact tab before focusing its containing window", async () => {
    updateTab.mockResolvedValue({});
    updateWindow.mockResolvedValue({});
    await chromeBrowserAdapter.activateTarget({ id: 21, windowId: 7, current: false });
    expect(updateTab).toHaveBeenCalledWith(21, { active: true });
    expect(updateWindow).toHaveBeenCalledWith(7, { focused: true });
    expect(updateTab.mock.invocationCallOrder[0]).toBeLessThan(updateWindow.mock.invocationCallOrder[0]!);
  });
});
