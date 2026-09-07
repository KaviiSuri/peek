import assert from "node:assert/strict"
import test from "node:test"
import { wireBackground, type ListenerEvent } from "../src/background/wiring.ts"

function fakeEvent<Listener>(): ListenerEvent<Listener> & { listeners: Listener[] } {
  const listeners: Listener[] = []
  return { listeners, addListener: (listener) => listeners.push(listener) }
}

test("action, attention, removal, and message listeners register synchronously", () => {
  const actionClicked = fakeEvent<(tab: chrome.tabs.Tab) => void>()
  const tabActivated = fakeEvent<(info: { tabId: number; windowId: number }) => void>()
  const windowFocused = fakeEvent<(windowId: number) => void>()
  const tabRemoved = fakeEvent<(tabId: number) => void>()
  const message = fakeEvent<(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | undefined>()
  const seen: string[] = []

  wireBackground(
    { actionClicked, tabActivated, windowFocused, tabRemoved, message },
    {
      onInvoke: (tabId) => seen.push(`invoke:${tabId ?? "active"}`),
      onTabActivated: (tabId, windowId) => seen.push(`tab:${tabId}@${windowId}`),
      onWindowFocused: (windowId) => seen.push(`window:${windowId}`),
      onTabRemoved: (tabId) => seen.push(`removed:${tabId}`),
      onMessage: () => { seen.push("message"); return true }
    }
  )

  assert.deepEqual(
    [actionClicked, tabActivated, windowFocused, tabRemoved, message]
      .map((event) => event.listeners.length),
    [1, 1, 1, 1, 1]
  )
  actionClicked.listeners[0]!({ id: 8 } as chrome.tabs.Tab)
  tabActivated.listeners[0]!({ tabId: 9, windowId: 3 })
  windowFocused.listeners[0]!(3)
  tabRemoved.listeners[0]!(9)
  message.listeners[0]!({}, {}, () => undefined)
  assert.deepEqual(seen, [
    "invoke:8",
    "tab:9@3",
    "window:3",
    "removed:9",
    "message"
  ])
})
