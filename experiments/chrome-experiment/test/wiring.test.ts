import assert from "node:assert/strict"
import test from "node:test"
import { wireAttentionEvents, type ListenerEvent } from "../src/background/wiring.ts"

function fakeEvent<Listener>(): ListenerEvent<Listener> & { listeners: Listener[] } {
  const listeners: Listener[] = []
  return {
    listeners,
    addListener: (listener) => listeners.push(listener)
  }
}

test("all MV3 wake listeners register synchronously and forward facts", () => {
  const tabActivated = fakeEvent<(info: { tabId: number; windowId: number }) => void>()
  const windowFocused = fakeEvent<(windowId: number) => void>()
  const tabRemoved = fakeEvent<(tabId: number) => void>()
  const seen: string[] = []

  wireAttentionEvents(
    { tabActivated, windowFocused, tabRemoved },
    {
      onTabActivated: (tabId, windowId) => seen.push(`tab:${tabId}@${windowId}`),
      onWindowFocused: (windowId) => seen.push(`window:${windowId}`),
      onTabRemoved: (tabId) => seen.push(`removed:${tabId}`)
    }
  )

  assert.deepEqual(
    [tabActivated.listeners.length, windowFocused.listeners.length, tabRemoved.listeners.length],
    [1, 1, 1]
  )
  tabActivated.listeners[0]!({ tabId: 7, windowId: 2 })
  windowFocused.listeners[0]!(2)
  tabRemoved.listeners[0]!(7)
  assert.deepEqual(seen, ["tab:7@2", "window:2", "removed:7"])
})
