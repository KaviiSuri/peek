import { Effect, Layer } from "effect"
import {
  ChromeBoundaryError,
  ChromeTabs,
  type AttentionSnapshot,
  type ChromeTabsService,
  type TabRecord
} from "./tabs.ts"

export interface ChromeApi {
  readonly getAllNormalWindows: () => Promise<readonly chrome.windows.Window[]>
  readonly sendMessage: (message: unknown) => Promise<unknown>
  readonly getCommands: () => Promise<readonly chrome.commands.Command[]>
  readonly getTab: (tabId: number) => Promise<chrome.tabs.Tab>
  readonly getWindow: (windowId: number) => Promise<chrome.windows.Window>
  readonly activateTab: (tabId: number) => Promise<unknown>
  readonly focusWindow: (windowId: number) => Promise<unknown>
}

function fromChrome<A>(operation: string, run: () => Promise<A>) {
  return Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new ChromeBoundaryError(
        operation,
        cause instanceof Error ? cause.message : String(cause),
        { cause }
      )
  })
}

function toTabRecord(tab: chrome.tabs.Tab): TabRecord | null {
  if (tab.id === undefined || tab.incognito || tab.windowId < 0) return null

  const record: TabRecord = {
    id: tab.id,
    windowId: tab.windowId,
    title: tab.title || "Untitled tab",
    url: tab.url || "Unavailable URL",
    active: tab.active
  }
  return {
    ...record,
    ...(tab.favIconUrl ? { favIconUrl: tab.favIconUrl } : {}),
    ...(tab.lastAccessed !== undefined ? { lastAccessed: tab.lastAccessed } : {})
  }
}

export function makeChromeTabsService(api: ChromeApi): ChromeTabsService {
  return {
    list: fromChrome("list normal-window tabs", async () => {
      const windows = await api.getAllNormalWindows()
      return windows
        .filter((window) => !window.incognito && window.type === "normal")
        .flatMap((window) => window.tabs ?? [])
        .map(toTabRecord)
        .filter((tab): tab is TabRecord => tab !== null)
    }),

    attention: fromChrome("read observed attention", async () => {
      const response = (await api.sendMessage({
        type: "peek-experiment:get-attention"
      })) as AttentionSnapshot | undefined

      return response ?? {
        currentTabId: null,
        previousTabId: null,
        historyAvailable: false
      }
    }),

    commandShortcut: fromChrome("read command registration", async () => {
      const commands = await api.getCommands()
      return commands.find((command) => command.name === "_execute_action")?.shortcut ?? ""
    }),

    activate: (tabId, windowId) =>
      fromChrome("activate selected tab", async () => {
        const tab = await api.getTab(tabId)
        const window = await api.getWindow(windowId)
        if (tab.id !== tabId || tab.windowId !== windowId || tab.incognito) {
          throw new Error("The selected tab is no longer an eligible normal-profile tab")
        }
        if (window.incognito || window.type !== "normal") {
          throw new Error("The selected window is no longer an eligible normal window")
        }

        await api.activateTab(tabId)
        await api.focusWindow(windowId)
      })
  }
}

const liveService = makeChromeTabsService({
  getAllNormalWindows: () =>
    chrome.windows.getAll({ populate: true, windowTypes: ["normal"] }),
  sendMessage: (message) => chrome.runtime.sendMessage(message),
  getCommands: () => chrome.commands.getAll(),
  getTab: (tabId) => chrome.tabs.get(tabId),
  getWindow: (windowId) => chrome.windows.get(windowId),
  activateTab: (tabId) => chrome.tabs.update(tabId, { active: true }),
  focusWindow: (windowId) => chrome.windows.update(windowId, { focused: true })
})

export const ChromeTabsLive = Layer.succeed(ChromeTabs, liveService)
