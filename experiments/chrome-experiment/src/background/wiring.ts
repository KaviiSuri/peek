export interface ListenerEvent<Listener> {
  addListener(listener: Listener): void
}

export interface BackgroundEvents {
  readonly tabActivated: ListenerEvent<(info: { tabId: number; windowId: number }) => void>
  readonly windowFocused: ListenerEvent<(windowId: number) => void>
  readonly tabRemoved: ListenerEvent<(tabId: number) => void>
}

export interface AttentionHandlers {
  readonly onTabActivated: (tabId: number, windowId: number) => void
  readonly onWindowFocused: (windowId: number) => void
  readonly onTabRemoved: (tabId: number) => void
}

/** Registers all MV3 wake listeners synchronously during module evaluation. */
export function wireAttentionEvents(
  events: BackgroundEvents,
  handlers: AttentionHandlers
): void {
  events.tabActivated.addListener(({ tabId, windowId }) =>
    handlers.onTabActivated(tabId, windowId)
  )
  events.windowFocused.addListener((windowId) => handlers.onWindowFocused(windowId))
  events.tabRemoved.addListener((tabId) => handlers.onTabRemoved(tabId))
}
