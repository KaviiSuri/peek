export interface ListenerEvent<Listener> {
  addListener(listener: Listener): void
}

export interface BackgroundEvents {
  readonly actionClicked: ListenerEvent<(tab: chrome.tabs.Tab) => void>
  readonly tabActivated: ListenerEvent<(info: { tabId: number; windowId: number }) => void>
  readonly windowFocused: ListenerEvent<(windowId: number) => void>
  readonly tabRemoved: ListenerEvent<(tabId: number) => void>
  readonly message: ListenerEvent<(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | undefined>
}

export interface BackgroundHandlers {
  readonly onInvoke: (tabId?: number) => void
  readonly onTabActivated: (tabId: number, windowId: number) => void
  readonly onWindowFocused: (windowId: number) => void
  readonly onTabRemoved: (tabId: number) => void
  readonly onMessage: (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | undefined
}

/** All MV3 wake listeners are registered synchronously during module evaluation. */
export function wireBackground(
  events: BackgroundEvents,
  handlers: BackgroundHandlers
): void {
  events.actionClicked.addListener((tab) => handlers.onInvoke(tab.id))
  events.tabActivated.addListener(({ tabId, windowId }) =>
    handlers.onTabActivated(tabId, windowId)
  )
  events.windowFocused.addListener(handlers.onWindowFocused)
  events.tabRemoved.addListener(handlers.onTabRemoved)
  events.message.addListener(handlers.onMessage)
}
