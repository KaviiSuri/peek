import { Effect, ManagedRuntime } from "effect"
import { wireBackground } from "./background/wiring.ts"
import { BrowserTabsLive } from "./browser/chrome-tabs-live.ts"
import { BrowserTabs, type OverlayModel } from "./browser/tabs.ts"
import {
  emptyAttention,
  isAttentionState,
  isVisibleNormalWindow,
  observeVisibleTab,
  removeTab,
  type AttentionState
} from "./core/attention.ts"
import { isOverlayRequest, type OverlayResponse } from "./protocol.ts"

const attentionKey = "peek-centered-overlay:attention-v1"
const diagnosticKey = "peek-centered-overlay:last-diagnostic-v1"
const runtime = ManagedRuntime.make(BrowserTabsLive)

const readAttention = Effect.tryPromise({
  try: async () => {
    const stored = await chrome.storage.session.get(attentionKey)
    const value: unknown = stored[attentionKey]
    return isAttentionState(value) ? value : emptyAttention
  },
  catch: (cause) => new Error(`read attention: ${String(cause)}`)
})

const writeAttention = (state: AttentionState) =>
  Effect.tryPromise({
    try: () => chrome.storage.session.set({ [attentionKey]: state }),
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

let attentionWork = Promise.resolve<void>(undefined)

function enqueueAttention(program: Effect.Effect<void, Error>): void {
  attentionWork = attentionWork
    .then(() => Effect.runPromise(program))
    .catch((cause: unknown) => console.warn("Peek overlay attention event failed", cause))
}

function observeFocusedWindow(windowId: number): void {
  enqueueAttention(
    Effect.flatMap(visibleTabInWindow(windowId), (tabId) =>
      tabId === null ? Effect.void : updateAttention((state) => observeVisibleTab(state, tabId))
    )
  )
}

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

async function clearDiagnostic(tabId: number): Promise<void> {
  await Promise.allSettled([
    chrome.action.setBadgeText({ tabId, text: "" }),
    chrome.action.setTitle({ tabId, title: "Toggle Peek centred overlay test" })
  ])
}

async function recordDiagnostic(tabId: number, operation: string, cause: unknown): Promise<void> {
  const exactError = errorText(cause)
  const diagnostic = {
    at: new Date().toISOString(),
    tabId,
    operation,
    exactError
  }
  console.warn("Peek centred overlay diagnostic", diagnostic)
  await Promise.allSettled([
    chrome.storage.session.set({ [diagnosticKey]: diagnostic }),
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#c83b3b" }),
    chrome.action.setBadgeText({ tabId, text: "!" }),
    chrome.action.setTitle({
      tabId,
      title: `Peek overlay unavailable — ${operation}: ${exactError}`
    })
  ])
}

function invoke(tabId: number | undefined): void {
  if (tabId === undefined) {
    console.warn("Peek overlay action supplied no active tab id")
    return
  }

  // Start injection directly from the action gesture; do not await unrelated work first.
  void runtime.runPromise(
    Effect.gen(function* () {
      const browser = yield* BrowserTabs
      yield* browser.injectOverlay(tabId)
    })
  ).catch((cause: unknown) => recordDiagnostic(tabId, "injection", cause))
}

async function modelFor(sourceTabId: number): Promise<OverlayModel> {
  await attentionWork
  const [tabs, attention] = await Promise.all([
    runtime.runPromise(
      Effect.gen(function* () {
        const browser = yield* BrowserTabs
        return yield* browser.list
      })
    ),
    Effect.runPromise(readAttention)
  ])
  return {
    tabs,
    currentTabId: sourceTabId,
    previousTabId: attention.previousTabId,
    historyAvailable: attention.previousTabId !== null
  }
}

function handleMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean | undefined {
  if (!isOverlayRequest(message)) return undefined
  const sourceTabId = sender.tab?.id
  if (sourceTabId === undefined) {
    sendResponse({ ok: false, error: "Message did not originate from an eligible tab" } satisfies OverlayResponse)
    return false
  }

  void (async () => {
    try {
      if (message.type === "peek-centered-overlay:get-model") {
        sendResponse({ ok: true, model: await modelFor(sourceTabId) } satisfies OverlayResponse)
        return
      }
      if (message.type === "peek-centered-overlay:commit") {
        const outcome = await runtime.runPromise(
          Effect.gen(function* () {
            const browser = yield* BrowserTabs
            return yield* browser.commit(
              sourceTabId,
              message.targetTabId,
              message.targetWindowId
            )
          })
        )
        sendResponse({ ok: true, outcome } satisfies OverlayResponse)
        return
      }
      await clearDiagnostic(sourceTabId)
      sendResponse({ ok: true } satisfies OverlayResponse)
    } catch (cause) {
      await recordDiagnostic(sourceTabId, message.type, cause)
      sendResponse({ ok: false, error: errorText(cause) } satisfies OverlayResponse)
    }
  })()
  return true
}

// Register every MV3 wake listener synchronously during service-worker evaluation.
wireBackground(
  {
    actionClicked: chrome.action.onClicked,
    tabActivated: chrome.tabs.onActivated,
    windowFocused: chrome.windows.onFocusChanged,
    tabRemoved: chrome.tabs.onRemoved,
    message: chrome.runtime.onMessage
  },
  {
    onInvoke: invoke,
    // Ignore activation in unfocused windows; it was not viewed.
    onTabActivated: (_tabId, windowId) => observeFocusedWindow(windowId),
    onWindowFocused: observeFocusedWindow,
    onTabRemoved: (tabId) =>
      enqueueAttention(updateAttention((state) => removeTab(state, tabId))),
    onMessage: handleMessage
  }
)

// Cold bootstrap establishes current only; it never invents previous history.
enqueueAttention(
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
      (tabId) =>
        tabId === null
          ? Effect.void
          : writeAttention({ currentTabId: tabId, previousTabId: null })
    )
  })
)
