import { Effect, Layer } from "effect"
import { markWorkerForTab } from "../instrumentation/worker-timeline.ts"
import {
  BrowserBoundaryError,
  BrowserTabs,
  type BrowserTabsService,
  type TabRecord
} from "./tabs.ts"

export interface ChromeApi {
  readonly getAllNormalWindows: () => Promise<readonly chrome.windows.Window[]>
  readonly getTab: (tabId: number) => Promise<chrome.tabs.Tab>
  readonly getWindow: (windowId: number) => Promise<chrome.windows.Window>
  readonly activateTab: (tabId: number) => Promise<unknown>
  readonly focusWindow: (windowId: number) => Promise<unknown>
  readonly injectOverlay: (tabId: number) => Promise<unknown>
  readonly requestTeardown: (tabId: number) => Promise<unknown>
}

function fromChrome<A>(operation: string, run: () => Promise<A>) {
  return Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new BrowserBoundaryError(
        operation,
        cause instanceof Error ? cause.message : String(cause),
        { cause }
      )
  })
}

function toTabRecord(tab: chrome.tabs.Tab): TabRecord | null {
  if (tab.id === undefined || tab.incognito || tab.windowId < 0) return null
  return {
    id: tab.id,
    windowId: tab.windowId,
    title: tab.title || "Untitled tab",
    url: tab.url || "Unavailable URL",
    active: tab.active,
    ...(tab.lastAccessed !== undefined ? { lastAccessed: tab.lastAccessed } : {})
  }
}

export function makeBrowserTabsService(api: ChromeApi): BrowserTabsService {
  return {
    list: fromChrome("list normal-window tabs", async () => {
      const windows = await api.getAllNormalWindows()
      return windows
        .filter((window) => !window.incognito && window.type === "normal")
        .flatMap((window) => window.tabs ?? [])
        .map(toTabRecord)
        .filter((tab): tab is TabRecord => tab !== null)
    }),

    injectOverlay: (tabId) =>
      fromChrome("inject centred overlay", async () => {
        await api.injectOverlay(tabId)
      }),

    commit: (sourceTabId, targetTabId, targetWindowId) =>
      fromChrome("commit selected tab", async () => {
        // Validate identity and eligibility before teardown or activation.
        const tab = await api.getTab(targetTabId)
        const window = await api.getWindow(targetWindowId)
        if (
          tab.id !== targetTabId ||
          tab.windowId !== targetWindowId ||
          tab.incognito ||
          window.incognito ||
          window.type !== "normal"
        ) {
          throw new Error("The selected tab is no longer an eligible normal-profile tab")
        }

        await api.requestTeardown(sourceTabId)
        if (targetTabId === sourceTabId) return "current-no-op" as const
        await api.activateTab(targetTabId)
        await api.focusWindow(targetWindowId)
        return "activated" as const
      })
  }
}

const liveService = makeBrowserTabsService({
  getAllNormalWindows: () =>
    chrome.windows.getAll({ populate: true, windowTypes: ["normal"] }),
  getTab: (tabId) => chrome.tabs.get(tabId),
  getWindow: (windowId) => chrome.windows.get(windowId),
  activateTab: (tabId) => chrome.tabs.update(tabId, { active: true }),
  focusWindow: (windowId) => chrome.windows.update(windowId, { focused: true }),
  injectOverlay: async (tabId) => {
    markWorkerForTab(tabId, "execute-script-start")
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        files: ["overlay.js"],
        world: "ISOLATED",
        injectImmediately: true
      })
      markWorkerForTab(tabId, "execute-script-end", "ok")
      return result
    } catch (cause) {
      markWorkerForTab(tabId, "execute-script-end", "error")
      throw cause
    }
  },
  requestTeardown: (tabId) =>
    chrome.tabs.sendMessage(tabId, { type: "peek-centered-overlay:teardown" })
})

export const BrowserTabsLive = Layer.succeed(BrowserTabs, liveService)
