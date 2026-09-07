import type { AttentionIdentity, AttentionState } from "../attention/attention";
import type { BrowserAdapter, SourceTab, TargetTab } from "./browser-adapter";
import type { InitMessage, ModelMessage, PeekTab } from "../shared/model";

const ATTENTION_STORAGE_KEY = "peekAttentionV1";

function isEligibleWindow(window: chrome.windows.Window): boolean {
  return window.type === "normal" && window.incognito !== true;
}

function ownExtensionUrl(url: string | undefined): boolean {
  return Boolean(url?.startsWith(`chrome-extension://${chrome.runtime.id}/`));
}

export function isEligibleAttentionTarget(tab: chrome.tabs.Tab, window: chrome.windows.Window): boolean {
  return isEligibleWindow(window) && window.focused === true && tab.active === true && tab.incognito !== true &&
    tab.id !== undefined && tab.windowId === window.id && !ownExtensionUrl(tab.url);
}

export const chromeBrowserAdapter: BrowserAdapter = {
  async loadAttentionState(): Promise<unknown> {
    const stored = await chrome.storage.session.get(ATTENTION_STORAGE_KEY);
    return stored[ATTENTION_STORAGE_KEY];
  },

  async saveAttentionState(state: AttentionState): Promise<void> {
    await chrome.storage.session.set({ [ATTENTION_STORAGE_KEY]: state });
  },

  async resolveFocusedAttention(windowId?: number, tabId?: number): Promise<AttentionIdentity | undefined> {
    try {
      const window = windowId === undefined
        ? await chrome.windows.getLastFocused({ populate: true })
        : await chrome.windows.get(windowId, { populate: true });
      const tab = tabId === undefined
        ? window.tabs?.find((candidate) => candidate.active)
        : await chrome.tabs.get(tabId);
      if (!tab || !isEligibleAttentionTarget(tab, window)) return undefined;
      return { tabId: tab.id!, windowId: window.id! };
    } catch {
      return undefined;
    }
  },

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
