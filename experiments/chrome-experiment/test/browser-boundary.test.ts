import assert from "node:assert/strict"
import test from "node:test"
import { Effect, Layer } from "effect"
import { selectTab } from "../src/application/select-tab.ts"
import {
  makeChromeTabsService,
  type ChromeApi
} from "../src/browser/chrome-tabs-live.ts"
import { ChromeTabs, type TabRecord } from "../src/browser/tabs.ts"

const selected: TabRecord = {
  id: 22,
  windowId: 4,
  title: "Orion retry",
  url: "https://github.com/acme/orion/issues/22",
  active: false
}

function api(overrides: Partial<ChromeApi> = {}): { api: ChromeApi; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    api: {
      getAllNormalWindows: async () => [],
      sendMessage: async () => ({
        currentTabId: 11,
        previousTabId: 9,
        historyAvailable: true
      }),
      getCommands: async () => [{ name: "_execute_action", shortcut: "Alt+Space" }],
      getTab: async (tabId) => ({ id: tabId, windowId: 4, incognito: false } as chrome.tabs.Tab),
      getWindow: async (windowId) =>
        ({ id: windowId, type: "normal", incognito: false, focused: false, alwaysOnTop: false } as chrome.windows.Window),
      activateTab: async (tabId) => {
        calls.push(`tab:${tabId}`)
      },
      focusWindow: async (windowId) => {
        calls.push(`window:${windowId}`)
      },
      ...overrides
    }
  }
}

test("explicit selection activates tab before focusing its window", async () => {
  const fake = api()
  const layer = Layer.succeed(ChromeTabs, makeChromeTabsService(fake.api))
  const outcome = await Effect.runPromise(Effect.provide(selectTab(selected, 11), layer))

  assert.equal(outcome, "activated")
  assert.deepEqual(fake.calls, ["tab:22", "window:4"])
})

test("selecting current is a no-op and does not cross the Chrome boundary", async () => {
  const fake = api()
  const layer = Layer.succeed(ChromeTabs, makeChromeTabsService(fake.api))
  const outcome = await Effect.runPromise(Effect.provide(selectTab(selected, 22), layer))

  assert.equal(outcome, "current-no-op")
  assert.deepEqual(fake.calls, [])
})

test("a vanished tab fails before any other tab or window can be activated", async () => {
  const fake = api({ getTab: async () => { throw new Error("No tab with id 22") } })
  const result = await Effect.runPromiseExit(makeChromeTabsService(fake.api).activate(22, 4))

  assert.equal(result._tag, "Failure")
  assert.deepEqual(fake.calls, [])
})

test("listing excludes incognito windows and preserves title/URL metadata", async () => {
  const normalTab = {
    id: 1,
    windowId: 1,
    title: "GitHub Orion",
    url: "https://github.com/acme/orion",
    active: true,
    incognito: false
  } as chrome.tabs.Tab
  const incognitoTab = {
    id: 2,
    windowId: 2,
    title: "Private",
    url: "https://example.test/private",
    active: true,
    incognito: true
  } as chrome.tabs.Tab
  const fake = api({
    getAllNormalWindows: async () => [
      { id: 1, type: "normal", incognito: false, tabs: [normalTab] } as chrome.windows.Window,
      { id: 2, type: "normal", incognito: true, tabs: [incognitoTab] } as chrome.windows.Window
    ]
  })

  const tabs = await Effect.runPromise(makeChromeTabsService(fake.api).list)
  assert.deepEqual(tabs.map(({ id, title, url }) => ({ id, title, url })), [
    { id: 1, title: "GitHub Orion", url: "https://github.com/acme/orion" }
  ])
})
