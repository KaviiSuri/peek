import type { BrowserAdapter, SourceTab, TargetTab } from "./browser-adapter";
import type { InitMessage, ModelMessage, PeekTab } from "../shared/model";

function isEligibleWindow(window: chrome.windows.Window): boolean {
  return window.type === "normal" && window.incognito !== true;
}

function ownExtensionUrl(url: string | undefined): boolean {
  return Boolean(url?.startsWith(`chrome-extension://${chrome.runtime.id}/`));
}

export const chromeBrowserAdapter: BrowserAdapter = {
  async listEligibleTabs(source: SourceTab): Promise<readonly PeekTab[]> {
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
    const tabs: PeekTab[] = [];
    for (const window of windows) {
      if (!isEligibleWindow(window)) continue;
      for (const tab of window.tabs ?? []) {
        if (tab.incognito || tab.id === undefined || tab.windowId === undefined || ownExtensionUrl(tab.url)) continue;
        tabs.push({
          id: tab.id,
          windowId: tab.windowId,
          title: tab.title?.trim() || tab.url || "Untitled tab",
          url: tab.url || "",
          ...(tab.favIconUrl ? { favIconUrl: tab.favIconUrl } : {}),
          lastAccessed: tab.lastAccessed ?? 0,
          current: tab.id === source.id,
        });
      }
    }
    return tabs;
  },

  async openOverlay(source: SourceTab, message: InitMessage): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId: source.id },
      files: ["overlay.js"],
    });
    await chrome.tabs.sendMessage(source.id, message);
  },

  async updateOverlay(sourceTabId: number, message: ModelMessage): Promise<void> {
    await chrome.tabs.sendMessage(sourceTabId, message);
  },

  async dismissOverlay(sourceTabId: number, sessionId: string): Promise<void> {
    await chrome.tabs.sendMessage(sourceTabId, { kind: "peek/dismiss", sessionId });
  },

  async revalidateTarget(tabId: number, windowId: number): Promise<TargetTab | undefined> {
    try {
      const [tab, window] = await Promise.all([
        chrome.tabs.get(tabId),
        chrome.windows.get(windowId),
      ]);
      if (
        tab.id !== tabId ||
        tab.windowId !== windowId ||
        tab.incognito ||
        !isEligibleWindow(window) ||
        ownExtensionUrl(tab.url)
      ) return undefined;
      return { id: tabId, windowId, current: tab.active };
    } catch {
      return undefined;
    }
  },

  async activateTarget(target: TargetTab): Promise<void> {
    await chrome.tabs.update(target.id, { active: true });
    await chrome.windows.update(target.windowId, { focused: true });
  },
};
