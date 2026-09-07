import { Effect } from "effect"
import {
  emptyAttention,
  isAttentionState,
  isVisibleNormalWindow,
  observeVisibleTab,
  removeTab,
  type AttentionState
} from "./core/attention.ts"
import { wireAttentionEvents } from "./background/wiring.ts"

const storageKey = "peek-experiment:attention-v1"

const readAttention = Effect.tryPromise({
  try: async () => {
    const stored = await chrome.storage.session.get(storageKey)
    const value: unknown = stored[storageKey]
    return isAttentionState(value) ? value : emptyAttention
  },
  catch: (cause) => new Error(`read attention: ${String(cause)}`)
})

const writeAttention = (state: AttentionState) =>
  Effect.tryPromise({
    try: () => chrome.storage.session.set({ [storageKey]: state }),
    catch: (cause) => new Error(`write attention: ${String(cause)}`)
  })

const updateAttention = (update: (state: AttentionState) => AttentionState) =>
  Effect.flatMap(readAttention, (state) => writeAttention(update(state)))

const visibleTabInWindow = (windowId: number) =>
  Effect.tryPromise({
    try: async () => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) return null
      const window = await chrome.windows.get(windowId)
      if (!isVisibleNormalWindow(window)) return null
      const [tab] = await chrome.tabs.query({ active: true, windowId })
      return tab?.id ?? null
    },
    catch: (cause) => new Error(`read visible tab: ${String(cause)}`)
  })

let work = Promise.resolve<void>(undefined)

function enqueue(program: Effect.Effect<void, Error>): void {
  work = work
    .then(() => Effect.runPromise(program))
    .catch((cause: unknown) => console.warn("Peek experiment attention event failed", cause))
}

function observeFocusedWindow(windowId: number): void {
  enqueue(
    Effect.flatMap(visibleTabInWindow(windowId), (tabId) =>
      tabId === null ? Effect.void : updateAttention((state) => observeVisibleTab(state, tabId))
    )
  )
}

// Register wake listeners synchronously. Do not move registration behind an Effect.
wireAttentionEvents(
  {
    tabActivated: chrome.tabs.onActivated,
    windowFocused: chrome.windows.onFocusChanged,
    tabRemoved: chrome.tabs.onRemoved
  },
  {
    // Ignore activation events in unfocused windows; those tabs were not viewed.
    onTabActivated: (_tabId, windowId) => observeFocusedWindow(windowId),
    onWindowFocused: observeFocusedWindow,
    onTabRemoved: (tabId) => enqueue(updateAttention((state) => removeTab(state, tabId)))
  }
)

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    typeof message !== "object" ||
    message === null ||
    (message as { type?: unknown }).type !== "peek-experiment:get-attention"
  ) {
    return false
  }

  work
    .then(() => Effect.runPromise(readAttention))
    .then((state) =>
      sendResponse({
        ...state,
        historyAvailable: state.previousTabId !== null
      })
    )
    .catch((cause: unknown) => {
      console.warn("Peek experiment could not answer attention query", cause)
      sendResponse({ ...emptyAttention, historyAvailable: false })
    })
  return true
})

// Cold bootstrap can establish current, but cannot invent a previous tab.
enqueue(
  Effect.flatMap(readAttention, (state) => {
    if (state.currentTabId !== null) return Effect.void
    return Effect.flatMap(
      Effect.tryPromise({
        try: async () => {
          const window = await chrome.windows.getLastFocused({ windowTypes: ["normal"] })
          if (window.incognito || window.id === undefined) return null
          const [tab] = await chrome.tabs.query({ active: true, windowId: window.id })
          return tab?.id ?? null
        },
        catch: (cause) => new Error(`bootstrap visible tab: ${String(cause)}`)
      }),
      (tabId) => (tabId === null ? Effect.void : writeAttention({ currentTabId: tabId, previousTabId: null }))
    )
  })
)
