import { withBrowserFavicons } from "./favicons";
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
    return withBrowserFavicons(tabs);
  },

  async openOverlay(source: SourceTab, message: InitMessage, isCurrent): Promise<void> {
    if (!isCurrent()) return;
    await chrome.scripting.executeScript({
      target: { tabId: source.id },
      files: ["overlay.js"],
    });
    if (!isCurrent()) return;
    const window = await chrome.windows.get(source.windowId, { populate: true });
    if (!isCurrent()) return;
    if (!window.focused || !window.tabs?.some((tab) => tab.id === source.id && tab.active)) {
      throw new Error("Peek source is no longer focused");
    }
    await chrome.tabs.sendMessage(source.id, message);
    if (!isCurrent()) await chromeBrowserAdapter.dismissOverlay(source.id, message.sessionId);
  },

  async updateOverlay(sourceTabId: number, message: ModelMessage): Promise<void> {
    await chrome.tabs.sendMessage(sourceTabId, message);
  },

  async dismissOverlay(sourceTabId: number, sessionId: string): Promise<void> {
    await chrome.tabs.sendMessage(sourceTabId, { kind: "peek/dismiss", sessionId });
  },

  async createFallback(source: SourceTab, sessionId: string) {
    const sourceWindow = await chrome.windows.get(source.windowId);
    const width = Math.min(720, sourceWindow.width ?? 720);
    const height = Math.min(320, sourceWindow.height ?? 320);
    const left = sourceWindow.left === undefined || sourceWindow.width === undefined
      ? undefined
      : Math.round(sourceWindow.left + (sourceWindow.width - width) / 2);
    const top = sourceWindow.top === undefined || sourceWindow.height === undefined
      ? undefined
      : Math.round(sourceWindow.top + (sourceWindow.height - height) / 2);
    const options: chrome.windows.CreateData = {
      url: `${chrome.runtime.getURL("fallback.html")}#${encodeURIComponent(sessionId)}`,
      type: "popup",
      focused: false,
      width,
      height,
    };
    let created: chrome.windows.Window | undefined;
    try {
      created = await chrome.windows.create({
        ...options,
        ...(left === undefined ? {} : { left }),
        ...(top === undefined ? {} : { top }),
      });
    } catch (error) {
      // A window manager can place the source mostly off-screen. Chrome refuses
      // that requested center; let Chrome choose visible bounds for this case only.
      if (!(error instanceof Error) || error.message !== "Invalid value for bounds. Bounds must be at least 50% within visible screen space.") throw error;
      created = await chrome.windows.create(options);
    }
    const tab = created?.tabs?.[0];
    if (created?.id === undefined || tab?.id === undefined) {
      if (created?.id !== undefined) await chrome.windows.remove(created.id).catch(() => undefined);
      throw new Error("Chrome did not return fallback window identity");
    }
    return { tabId: tab.id, windowId: created.id };
  },

  async presentFallback(source, surface, isCurrent): Promise<boolean> {
    const window = await chrome.windows.get(source.windowId, { populate: true });
    if (!isCurrent() || !window.focused || !window.tabs?.some((tab) => tab.id === source.id && tab.active)) return false;
    await chrome.windows.update(surface.windowId, { focused: true });
    return isCurrent();
  },

  async updateFallback(message: ModelMessage): Promise<void> {
    await chrome.runtime.sendMessage(message);
  },

  async dismissFallback(windowId: number): Promise<void> {
    try {
      await chrome.windows.remove(windowId);
    } catch (error) {
      // Only Chrome's exact missing-window diagnostic is idempotent cleanup.
      if (!(error instanceof Error) || error.message !== `No window with id: ${windowId}.`) throw error;
    }
    // Chrome may resolve removal before delivering the automatic source-window
    // focus event. Read back the post-close focus while teardown still owns that
    // transition, before beginning the cancellable activation/focus chain.
    await chrome.windows.getLastFocused();
  },

  fileSchemeAccessAllowed(): Promise<boolean> {
    return chrome.extension.isAllowedFileSchemeAccess();
  },

  fallbackPageUrl(): string {
    return chrome.runtime.getURL("fallback.html");
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

  async activateTarget(target: TargetTab, isCurrent): Promise<void> {
    if (!isCurrent()) return;
    const activated = await chrome.tabs.update(target.id, { active: true });
    if (!isCurrent()) return;
    if (!activated || activated.id !== target.id || activated.windowId !== target.windowId || activated.incognito) {
      throw new Error("Peek target changed during activation");
    }
    await chrome.windows.update(target.windowId, { focused: true });
  },
};
